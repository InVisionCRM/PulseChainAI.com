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
import { HEX_ADDRESS, heartsToHex, LATE_PENALTY_SCALE_DAYS } from './hexDay';
import { SEL } from './rescue';
import { hexSubgraphQuery, type HexNet } from './subgraph';

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
  /**
   * When the owner came back and ended the stake, if they have.
   *
   * The point of the whole exercise: a rescue only freezes the damage, it does
   * not hand anybody their HEX. This is the proof that somebody read the note,
   * turned up and collected.
   */
  claimedAt: number | null;
  /** What they walked away with — the stakeEnd's own payout figure. */
  claimedPayoutHex: number | null;
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
        claimedAt: null,
        claimedPayoutHex: null,
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

  // Who has since collected. Independent of the pricing below and allowed to
  // fail on its own: not knowing whether someone claimed must not cost the
  // page its figures.
  try {
    const claims = await fetchClaims(net, rescues.map((r) => r.stakeId));
    for (const r of rescues) {
      const c = claims.get(r.stakeId);
      if (!c) continue;
      r.claimedAt = c.at;
      r.claimedPayoutHex = c.payoutHex;
    }
  } catch {
    /* nobody shown as claimed rather than a wrong page */
  }

  let records = new Map<string, GoodAccountingRecord>();
  try {
    records = await fetchGoodAccountings(net, rescues.map((r) => r.stakeId));
  } catch {
    return rescues; // best effort: the list is still true, just unpriced
  }

  for (const r of rescues) {
    const ga = records.get(r.stakeId);
    if (!ga) continue;
    r.principalHex = ga.principalHex;
    r.payoutHex = ga.payoutHex;
    r.penaltyHex = ga.penaltyHex;
    r.claimableHex = Math.max(0, ga.principalHex + ga.payoutHex - ga.penaltyHex);
    r.bleedPerDay = (ga.principalHex + ga.payoutHex) / LATE_PENALTY_SCALE_DAYS;
  }
  return rescues;
}

/**
 * Which of these stakes their owners have since ended, and for how much.
 *
 * A rescue is only ever performed on a stake that is still locked, so any
 * `stakeEnd` on one of ours necessarily happened afterwards — no need to
 * compare timestamps to tell "claimed after we froze it" from "ended anyway".
 */
async function fetchClaims(
  net: HexNet,
  stakeIds: string[],
): Promise<Map<string, { at: number; payoutHex: number }>> {
  const out = new Map<string, { at: number; payoutHex: number }>();
  const ids = [...new Set(stakeIds)];
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500).map((id) => `"${id}"`).join(',');
    const d = await hexSubgraphQuery<{
      stakeEnds: { stakeId: string; timestamp: string; payout: string }[];
    }>(net, `{ stakeEnds(where:{ stakeId_in: [${chunk}] }, first: 1000){ stakeId timestamp payout } }`);
    for (const e of d.stakeEnds ?? []) {
      out.set(String(e.stakeId), {
        at: Number(e.timestamp) * 1000,
        payoutHex: heartsToHex(e.payout),
      });
    }
  }
  return out;
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
  /** Total still claimable across every rescue we could price. */
  claimableHex: number;
  /** Total HEX/day of bleeding stopped. */
  bleedStoppedPerDay: number;
  /** Penalty already taken before we got there — the part we could NOT save. */
  penaltyHex: number;
  /** Rescues we could not price, so the totals are known to be incomplete. */
  unpriced: number;
  /** Owners who came back and ended the stake after we froze it. */
  claimed: number;
  /** HEX those owners actually collected. */
  claimedHex: number;
  biggest: Rescue | null;
  /** Closest call: the highest share of gross already burned when we froze it. */
  closestCall: Rescue | null;
}

export function totalsFor(rescues: Rescue[]): RescueTotals {
  let claimableHex = 0;
  let claimed = 0;
  let claimedHex = 0;
  let bleedStoppedPerDay = 0;
  let penaltyHex = 0;
  let unpriced = 0;
  let biggest: Rescue | null = null;
  let closestCall: Rescue | null = null;
  let worstFrac = -1;

  for (const r of rescues) {
    // Counted outside the pricing guard: whether somebody collected is known
    // from the stakeEnd alone and does not depend on the rescue being priced.
    if (r.claimedAt != null) {
      claimed++;
      claimedHex += r.claimedPayoutHex ?? 0;
    }
    if (r.claimableHex == null) {
      unpriced++;
      continue;
    }
    claimableHex += r.claimableHex;
    bleedStoppedPerDay += r.bleedPerDay ?? 0;
    penaltyHex += r.penaltyHex ?? 0;
    if (!biggest || (biggest.claimableHex ?? 0) < r.claimableHex) biggest = r;
  }

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

  return { count: rescues.length, claimableHex, bleedStoppedPerDay, penaltyHex, unpriced, claimed, claimedHex, biggest, closestCall };
}
