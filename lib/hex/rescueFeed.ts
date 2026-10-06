// Reading back what the keeper actually rescued.
//
// The public Rescue Wall and the per-stake claim page both need the same
// question answered: which stakes did WE good-account, and what is each one
// worth now? This is the one place that answers it.
//
// Two sources, each doing what only it can:
//
//   • THE CHAIN, stored. A keeper rescue is a HEX StakeGoodAccounting event
//     whose sender is the keeper; the event itself carries the principal,
//     interest and penalty it froze. lib/hex/rescueSync.ts copies every one into
//     hex_rescues once its block is final, and each read here syncs first, so
//     the table is never more than one sync behind the chain.
//
//   • THE SUBGRAPH tells us what happened AFTER: whether the owner has since
//     ended the stake and collected. That keeps changing, so it is read live.
//
// The keeper's explorer history used to be walked on every render instead.
// On 2026-10-06 that walk took ~146 s (194 pages), past both the 60 s build
// limit and this page's 120 s refresh limit, and the explorer was missing
// real rescues from a block it wrongly marks "lost consensus".

import { fetchStakeEnds, type StakeEndRecord } from './stakeEnds';
import { heartsToHex, LATE_PENALTY_SCALE_DAYS } from './hexDay';
import { SEL } from './rescue';
import { syncRescues } from './rescueSync';
import { readRescueRows, readRescueRow, type RescueRow } from '@/lib/db/hexRescues';
import type { HexNet } from './subgraph';


/**
 * The keeper whose rescues the wall shows.
 *
 * Public information — it is the `from` of every rescue transaction already on
 * chain — so it is safe in a client bundle and safe to hard-default. The env
 * var exists so a different deployment can point at its own keeper without a
 * code change.
 */
export const KEEPER_ADDRESS = (
  process.env.NEXT_PUBLIC_HEX_RESCUE_KEEPER ?? '0x210f046dc2e66b06c4daa17bf97077454a22dfe7'
).toLowerCase();

export interface Rescue {
  stakeId: string;
  stakerAddr: string;
  txHash: string;
  /** Unix ms the rescue was mined. */
  timestamp: number;
  /** The note we left in the calldata. */
  message: string | null;
  /** What the rescue transaction cost in gas, in wei: gasUsed × effectiveGasPrice
   *  from its receipt. */
  feeWei: string;
  /** Principal, from the frozen good-accounting record. */
  principalHex: number | null;
  /** Interest earned, frozen at the good-accounting day. */
  payoutHex: number | null;
  /** Penalty taken before we froze it — the damage already done. */
  penaltyHex: number | null;
  /** What the staker can still claim by ending the stake. */
  claimableHex: number | null;
  /** HEX/day this stake was losing when we stopped it. */
  bleedPerDay: number | null;

  // --- what happened after the rescue ---
  /**
   * Whether the owner has since ended the stake and taken their HEX.
   * Null means the lookup did not resolve, which is not the same as "no" —
   * a failed chunk must not be shown to someone as "nobody came for it".
   */
  claimed: boolean | null;
  /** Unix ms the owner ended it, when they have. */
  claimedAt: number | null;
  /** Days between our good-accounting and their collection. */
  daysToClaim: number | null;
  /** HEX they actually received: principal + payout - penalty, as recorded. */
  claimedHex: number | null;
  /**
   * True when the end record confirms the stake was unlocked before it ended —
   * on-chain proof the rescue is what stopped the bleeding, not a coincidence.
   */
  endConfirmsRescue: boolean | null;
}

/** Decode a `stakeGoodAccounting` call back into its arguments and note. */
export function decodeRescueCalldata(
  raw: string,
): { stakerAddr: string; index: number; stakeId: string; message: string | null } | null {
  const hex = raw.replace(/^0x/, '').toLowerCase();
  if (!hex.startsWith(SEL.stakeGoodAccounting.replace(/^0x/, ''))) return null;
  const body = hex.slice(8);
  if (body.length < 64 * 3) return null;
  try {
    const stakerAddr = `0x${body.slice(24, 64)}`;
    const index = Number(BigInt(`0x${body.slice(64, 128)}`));
    const stakeId = BigInt(`0x${body.slice(128, 192)}`).toString();
    const tail = body.slice(192);
    // The note is plain UTF-8 appended after the arguments. Anything that
    // doesn't decode cleanly is treated as absent rather than shown as mojibake.
    let message: string | null = null;
    if (tail.length > 0) {
      const decoded = Buffer.from(tail, 'hex').toString('utf8');
      message = /�/.test(decoded) ? null : decoded.trim() || null;
    }
    return { stakerAddr, index, stakeId, message };
  } catch {
    return null;
  }
}

/** A stored rescue as the wall shows it, before the live "collected?" lookup. */
function fromRow(r: RescueRow): Rescue {
  const principalHex = heartsToHex(r.principalHearts.toString());
  const payoutHex = heartsToHex(r.payoutHearts.toString());
  const gross = principalHex + payoutHex;
  // The event's penalty is NOT capped: HEX computes gross × daysLate / 700
  // and only caps what it takes (`cappedPenalty`) at the gross. A stake
  // 1,305 days late records 186% of its gross. What was actually taken —
  // and split 50/50 between Origin and the stakers' payout pool — is the
  // capped amount.
  const penaltyHex = Math.min(heartsToHex(r.penaltyHearts.toString()), gross);
  return {
    stakeId: r.stakeId,
    stakerAddr: r.stakerAddr,
    txHash: r.txHash,
    timestamp: r.minedAt,
    message: r.message,
    feeWei: r.feeWei.toString(),
    principalHex,
    payoutHex,
    penaltyHex,
    claimableHex: gross - penaltyHex,
    bleedPerDay: gross / LATE_PENALTY_SCALE_DAYS,
    claimed: null,
    claimedAt: null,
    daysToClaim: null,
    claimedHex: null,
    endConfirmsRescue: null,
  };
}

/**
 * Every rescue this keeper has performed, newest first.
 *
 * No limit, because the caller totals this list: a limit that quietly cuts it
 * off does not shorten the wall, it under-reports how much HEX was saved.
 * Throws if the chain cannot be synced, so the page keeps its last full copy.
 */
export async function fetchRescues(net: HexNet = 'pulsechain'): Promise<Rescue[]> {
  await syncRescues(net);
  return withCollections(net, (await readRescueRows(net)).map(fromRow));
}

/**
 * Whether each owner has since ended the stake and collected.
 *
 * An absent end means the stake is still sitting there — but only if the
 * lookup actually ran. When it fails every `claimed` stays null: reporting
 * that as "nobody claimed anything" would be a lie about money.
 */
async function withCollections(net: HexNet, rescues: Rescue[]): Promise<Rescue[]> {
  if (rescues.length === 0) return rescues;
  const ends: Map<string, StakeEndRecord> | null = await fetchStakeEnds(net, rescues.map((r) => r.stakeId)).catch(() => null);
  if (!ends) return rescues;
  for (const r of rescues) {
    const end = ends.get(r.stakeId);
    if (!end) {
      r.claimed = false;
      continue;
    }
    r.claimed = true;
    r.claimedAt = end.timestamp;
    r.claimedHex = Math.max(0, end.principalHex + end.payoutHex - end.penaltyHex);
    r.endConfirmsRescue = end.prevUnlocked;
    // Measured from the rescue, which is the moment the loss stopped.
    r.daysToClaim = Math.max(0, (end.timestamp - r.timestamp) / 86_400_000);
  }
  return rescues;
}

/** One rescue by stake id, or null if this keeper never touched that stake. */
export async function fetchRescue(net: HexNet, stakeId: string): Promise<Rescue | null> {
  await syncRescues(net);
  const row = await readRescueRow(net, stakeId);
  return row ? (await withCollections(net, [fromRow(row)]))[0] : null;
}

/** Wei to PLS, keeping six decimals — the precision every figure here shows. */
export const weiToPls = (wei: bigint) => Number(wei / 10n ** 12n) / 1e6;

export interface KeeperBurn {
  /** PLS the keeper spent on gas per day, averaged over the window. */
  plsPerDay: number;
  /** Days actually averaged over — shorter than asked if the history is. */
  windowDays: number;
}

/**
 * What the keeper spends on gas, from the actual fee of every rescue it mined
 * in the trailing window. Failed attempts are not rescues and are not counted
 * — 7 of them, 728 PLS, as of 2026-10-06. Null when the window holds none.
 *
 * A trailing window, not the whole history: the first days cleared a backlog
 * (Aug 20 2026 alone burned 3.85M PLS against ~20K on an ordinary day), and an
 * all-time average would put that burst into every future day.
 */
export function keeperBurn(rescues: Rescue[], days: number, now: number): KeeperBurn | null {
  const since = now - days * 86_400_000;
  const recent = rescues.filter((r) => r.timestamp >= since);
  if (!recent.length) return null;
  const firstEver = Math.min(...rescues.map((r) => r.timestamp));
  // A history shorter than the window is averaged over what exists.
  const windowDays = firstEver > since ? Math.max(1, (now - firstEver) / 86_400_000) : days;
  const wei = recent.reduce((sum, r) => sum + BigInt(r.feeWei), 0n);
  return { plsPerDay: weiToPls(wei) / windowDays, windowDays };
}

export interface RescueTotals {
  count: number;
  /** Rescues whose owner has since ended the stake and taken the HEX. */
  claimed: number;
  /** Rescued and still sitting there, waiting for someone to collect. */
  unclaimed: number;
  /** Total HEX collected by owners across the claimed rescues. */
  claimedHex: number;
  /** Claimable HEX still frozen in the unclaimed rescues, waiting for owners. */
  unclaimedHex: number;
  /**
   * Median days owners took to collect after a rescue. Median, not mean: the
   * distribution has a long tail of people who take most of a year, and one of
   * those drags an average somewhere no real staker sits.
   */
  medianDaysToClaim: number | null;
  /** Longest gap between a rescue and its collection, so far. */
  slowestClaim: Rescue | null;
  /** Total still claimable across every rescue we could price. */
  claimableHex: number;
  /** Total HEX/day of bleeding stopped. */
  bleedStoppedPerDay: number;
  /** Penalty already taken before we got there — the part we could NOT save. */
  penaltyHex: number;
  /** Rescues we could not price, so the totals are known to be incomplete. */
  unpriced: number;
  biggest: Rescue | null;
  /** Closest call: the highest share of gross already burned when we froze it. */
  closestCall: Rescue | null;
  /** PLS spent on gas across every rescue so far. Failed attempts are not
   *  rescues and are not in it (7 of them, 728 PLS, as of 2026-10-06). */
  gasPls: number;
}

export function totalsFor(rescues: Rescue[]): RescueTotals {
  let claimableHex = 0;
  let claimed = 0;
  let unclaimed = 0;
  let claimedHex = 0;
  let unclaimedHex = 0;
  let slowestClaim: Rescue | null = null;
  const claimDays: number[] = [];
  let bleedStoppedPerDay = 0;
  let penaltyHex = 0;
  let unpriced = 0;
  let biggest: Rescue | null = null;
  let closestCall: Rescue | null = null;
  let worstFrac = -1;
  let gasWei = 0n;

  for (const r of rescues) {
    gasWei += BigInt(r.feeWei);
    if (r.claimableHex == null) {
      unpriced++;
      continue;
    }
    claimableHex += r.claimableHex;
    bleedStoppedPerDay += r.bleedPerDay ?? 0;
    penaltyHex += r.penaltyHex ?? 0;
    if (!biggest || (biggest.claimableHex ?? 0) < r.claimableHex) biggest = r;
  }

  // Counted over every rescue, priced or not — whether someone collected does
  // not depend on our being able to price it.
  for (const r of rescues) {
    if (r.claimed === true) {
      claimed++;
      claimedHex += r.claimedHex ?? 0;
      if (r.daysToClaim != null) claimDays.push(r.daysToClaim);
      if (r.daysToClaim != null && (slowestClaim?.daysToClaim ?? -1) < r.daysToClaim) slowestClaim = r;
    } else if (r.claimed === false) {
      unclaimed++;
      unclaimedHex += r.claimableHex ?? 0;
    }
    // r.claimed === null is unknown and deliberately counted in neither.
  }
  claimDays.sort((a, b) => a - b);
  const medianDaysToClaim = claimDays.length
    ? claimDays.length % 2
      ? claimDays[(claimDays.length - 1) / 2]
      : (claimDays[claimDays.length / 2 - 1] + claimDays[claimDays.length / 2]) / 2
    : null;

  // Closest call is chosen AFTER the biggest is known, and never lands on the
  // same stake: two headline cards pointing at one rescue reads as a bug, and
  // the second slot is more useful showing a different stake's story. When
  // every rescue happened at a similar age — which is the normal case, since
  // the keeper sweeps daily — the largest stake tends to win both on raw
  // penalty, so this genuinely fires.
  for (const r of rescues) {
    if (r.claimableHex == null || r === biggest) continue;
    const gross = (r.principalHex ?? 0) + (r.payoutHex ?? 0);
    const frac = gross > 0 ? (r.penaltyHex ?? 0) / gross : 0;
    if (frac > worstFrac) {
      worstFrac = frac;
      closestCall = r;
    }
  }

  return {
    count: rescues.length, claimed, unclaimed, claimedHex, unclaimedHex, medianDaysToClaim, slowestClaim,
    claimableHex, bleedStoppedPerDay, penaltyHex, unpriced, biggest, closestCall,
    gasPls: weiToPls(gasWei),
  };
}
