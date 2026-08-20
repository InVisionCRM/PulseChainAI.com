// Reading back what the keeper actually rescued.
//
// The public Rescue Wall and the per-stake claim page both need the same
// question answered: which stakes did WE good-account, and what is each one
// worth now? This is the one place that answers it.
//
// Two sources, each doing what only it can:
//
//   • BLOCKSCOUT tells us which rescues were OURS. The HEX subgraph indexes
//     `stakeGoodAccountings` by the STAKER, not by whoever called it, so it
//     cannot distinguish our keeper's work from anyone else's. Blockscout can
//     list transactions FROM the keeper address, and the stakeId is recoverable
//     from each one's calldata, so that is the authoritative "was this us".
//
//   • THE SUBGRAPH tells us what each rescue FROZE. `stakeGoodAccountings`
//     carries the payout and penalty as recorded at good-accounting — the real
//     numbers, locked in, not a time-based estimate. lib/hex/goodAccounting.ts
//     already fetches and models exactly that, so this reuses it rather than
//     re-deriving the maths.
//
// Deliberately no database. The chain already stores all of this permanently,
// a rescue is immutable once mined, and a table would be a second copy that can
// drift from the truth. It also means the wall works on any deployment with no
// migration, which matters for a page whose whole point is being publicly
// verifiable.

import { fetchGoodAccountings, type GoodAccountingRecord } from './goodAccounting';
import { fetchStakeEnds, type StakeEndRecord } from './stakeEnds';
import { HEX_ADDRESS, heartsToHex, LATE_PENALTY_SCALE_DAYS } from './hexDay';
import { SEL } from './rescue';
import type { HexNet } from './subgraph';

const BLOCKSCOUT: Record<HexNet, string> = {
  pulsechain: 'https://api.scan.pulsechain.com/api/v2',
  ethereum: 'https://eth.blockscout.com/api/v2',
};

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

/**
 * A Blockscout row is a rescue only if the chain says it WORKED.
 *
 * The test used to be `if (t.status && t.status !== 'ok') continue` — absence
 * of failure rather than presence of success — and a pending transaction has
 * `status: null`, so every one of them sailed through. During a keeper run that
 * is most of the list: the wall filled with rescues dated 1970 (no timestamp
 * yet), with no figures (the subgraph cannot price what has not mined), and
 * counted them in its totals. Some of those then revert, so the wall was
 * crediting rescues that never happened.
 *
 * Verified against the live keeper mid-run: `result: "pending"`, `status: null`,
 * `timestamp: null`, `block_number: null`. Seven of its transactions did revert
 * (receipt status `0x0`), and Blockscout marks those `status: "error"` with
 * `result: "awaiting_internal_transactions"` — so demanding "ok" excludes both
 * the not-yet-mined and the failed, which is the only honest set to show
 * someone about their own money.
 */
function isMinedRescue(t: any): boolean {
  const to = String(t?.to?.hash ?? t?.to?.address_hash ?? '').toLowerCase();
  if (to !== HEX_ADDRESS.toLowerCase()) return false;
  if (String(t?.status ?? '') !== 'ok') return false;
  // A rescue with no timestamp cannot be dated on the page, and the only rows
  // missing one are rows that have not mined.
  return !!t?.timestamp;
}

/**
 * Walk the keeper's transactions newest-first, decoding the rescues.
 *
 * `stopAt` lets a single-stake lookup quit as soon as it finds its rescue
 * instead of pulling the whole history to answer one question.
 */
async function walkRescues(
  net: HexNet,
  limit: number,
  stopAt?: string,
): Promise<Rescue[]> {
  const out: Rescue[] = [];
  let nextParams = '';

  // 50 rows a page. The ceiling is a runaway guard, not a budget: the loop
  // already stops at `limit`, and the old 10-page cap silently truncated the
  // wall once the keeper passed 500 transactions.
  for (let page = 0; page < 60 && out.length < limit; page++) {
    const url = `${BLOCKSCOUT[net]}/addresses/${KEEPER_ADDRESS}/transactions?filter=from${nextParams}`;
    let data: any;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { Accept: 'application/json' } });
      if (!r.ok) break;
      data = await r.json();
    } catch {
      break;
    }

    const items: any[] = data?.items ?? [];
    if (items.length === 0) break;

    let found = false;
    for (const t of items) {
      if (!isMinedRescue(t)) continue;

      const decoded = decodeRescueCalldata(String(t?.raw_input ?? ''));
      if (!decoded) continue;
      if (stopAt && decoded.stakeId !== stopAt) continue;

      out.push({
        stakeId: decoded.stakeId,
        stakerAddr: decoded.stakerAddr,
        txHash: String(t?.hash ?? ''),
        timestamp: Date.parse(t.timestamp),
        message: decoded.message,
        principalHex: null,
        payoutHex: null,
        penaltyHex: null,
        claimableHex: null,
        bleedPerDay: null,
        claimed: null,
        claimedAt: null,
        daysToClaim: null,
        claimedHex: null,
        endConfirmsRescue: null,
      });
      if (stopAt) { found = true; break; }
    }
    if (found) break;

    const np = data?.next_page_params;
    if (!np) break;
    nextParams = `&${new URLSearchParams(
      Object.entries(np).map(([k, v]) => [k, String(v)]),
    ).toString()}`;
  }

  return out.slice(0, limit);
}

/**
 * Every rescue this keeper has performed, newest first.
 *
 * The default covers the whole history rather than a page of it, because the
 * caller totals this list: a limit that quietly cuts it off does not shorten
 * the wall, it under-reports how much HEX was saved.
 */
export async function fetchRescues(net: HexNet = 'pulsechain', limit = 2_000): Promise<Rescue[]> {
  return enrich(net, await walkRescues(net, limit));
}

/**
 * Fill in the frozen figures from the subgraph.
 *
 * A rescue with no good-accounting record keeps its nulls rather than being
 * given zeros — "we could not read this" and "this is worth nothing" are very
 * different statements to put in front of someone about their own money.
 */
async function enrich(net: HexNet, rescues: Rescue[]): Promise<Rescue[]> {
  if (rescues.length === 0) return rescues;
  const ids = rescues.map((r) => r.stakeId);

  // The two halves of a rescue's story, fetched together: what we froze, and
  // whether the owner has since come to collect it.
  let records = new Map<string, GoodAccountingRecord>();
  let ends = new Map<string, StakeEndRecord>();
  try {
    [records, ends] = await Promise.all([fetchGoodAccountings(net, ids), fetchStakeEnds(net, ids)]);
  } catch {
    return rescues; // best effort: the list is still true, just unpriced
  }

  for (const r of rescues) {
    const ga = records.get(r.stakeId);
    if (ga) {
      r.principalHex = ga.principalHex;
      r.payoutHex = ga.payoutHex;
      r.penaltyHex = ga.penaltyHex;
      r.claimableHex = Math.max(0, ga.principalHex + ga.payoutHex - ga.penaltyHex);
      r.bleedPerDay = (ga.principalHex + ga.payoutHex) / LATE_PENALTY_SCALE_DAYS;
    }

    // An absent end means the stake is still sitting there — but only if the
    // lookup actually ran. `ends` is empty when the whole fetch failed, and
    // reporting that as "nobody claimed anything" would be a lie about money.
    if (ends.size === 0) continue;
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

/**
 * One rescue by stake id, or null if this keeper never touched that stake.
 *
 * Stops at the matching transaction rather than pulling and pricing the whole
 * history to answer about one stake — this page is linked from every on-chain
 * message, so it has to stay quick and has to keep working as the keeper's
 * history grows.
 */
export async function fetchRescue(net: HexNet, stakeId: string): Promise<Rescue | null> {
  const found = await walkRescues(net, 1, stakeId);
  if (found.length === 0) return null;
  return (await enrich(net, found))[0] ?? null;
}

export interface RescueTotals {
  count: number;
  /** Rescues whose owner has since ended the stake and taken the HEX. */
  claimed: number;
  /** Rescued and still sitting there, waiting for someone to collect. */
  unclaimed: number;
  /** Total HEX collected by owners across the claimed rescues. */
  claimedHex: number;
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
}

export function totalsFor(rescues: Rescue[]): RescueTotals {
  let claimableHex = 0;
  let claimed = 0;
  let unclaimed = 0;
  let claimedHex = 0;
  let slowestClaim: Rescue | null = null;
  const claimDays: number[] = [];
  let bleedStoppedPerDay = 0;
  let penaltyHex = 0;
  let unpriced = 0;
  let biggest: Rescue | null = null;
  let closestCall: Rescue | null = null;
  let worstFrac = -1;

  for (const r of rescues) {
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
    count: rescues.length, claimed, unclaimed, claimedHex, medianDaysToClaim, slowestClaim,
    claimableHex, bleedStoppedPerDay, penaltyHex, unpriced, biggest, closestCall,
  };
}
