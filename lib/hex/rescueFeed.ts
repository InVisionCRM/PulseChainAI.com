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
 * Every rescue this keeper has performed, newest first.
 *
 * `limit` bounds the Blockscout paging, not the result: a page holds 50, so
 * this walks until it has enough or runs out.
 */
export async function fetchRescues(net: HexNet = 'pulsechain', limit = 100): Promise<Rescue[]> {
  const out: Rescue[] = [];
  let nextParams = '';

  for (let page = 0; page < 10 && out.length < limit; page++) {
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

    for (const t of items) {
      // Only successful calls into HEX count — a reverted one rescued nothing.
      const to = String(t?.to?.hash ?? t?.to?.address_hash ?? '').toLowerCase();
      if (to !== HEX_ADDRESS.toLowerCase()) continue;
      if (t?.status && t.status !== 'ok') continue;

      const decoded = decodeRescueCalldata(String(t?.raw_input ?? ''));
      if (!decoded) continue;

      out.push({
        stakeId: decoded.stakeId,
        stakerAddr: decoded.stakerAddr,
        txHash: String(t?.hash ?? ''),
        timestamp: t?.timestamp ? Date.parse(t.timestamp) : 0,
        message: decoded.message,
        principalHex: null,
        payoutHex: null,
        penaltyHex: null,
        claimableHex: null,
        bleedPerDay: null,
      });
    }

    const np = data?.next_page_params;
    if (!np) break;
    nextParams = `&${new URLSearchParams(
      Object.entries(np).map(([k, v]) => [k, String(v)]),
    ).toString()}`;
  }

  return enrich(net, out.slice(0, limit));
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

/** One rescue by stake id, or null if this keeper never touched that stake. */
export async function fetchRescue(net: HexNet, stakeId: string): Promise<Rescue | null> {
  const all = await fetchRescues(net, 500);
  return all.find((r) => r.stakeId === stakeId) ?? null;
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
  biggest: Rescue | null;
  /** Closest call: the highest share of gross already burned when we froze it. */
  closestCall: Rescue | null;
}

export function totalsFor(rescues: Rescue[]): RescueTotals {
  let claimableHex = 0;
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

  return { count: rescues.length, claimableHex, bleedStoppedPerDay, penaltyHex, unpriced, biggest, closestCall };
}
