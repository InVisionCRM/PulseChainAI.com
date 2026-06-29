// Authoritative "was this stake good-accounted?" check.
//
// Why this exists: the leaderboard/overdue logic infers how much of a matured
// stake has "bled out" purely from `currentDay - endDay` (see
// `latePenaltyStatus` in hexDay.ts and `activeOverdue` in leaderboards.ts). That
// estimate is WRONG the moment anyone calls HEX's `stakeGoodAccounting` on the
// stake. Good-accounting removes the stake's shares from the global pool and
// LOCKS IN the payout + late-end penalty as of the day it ran — the stake stops
// earning *and* stops bleeding. A stake good-accounted 50 days past grace is
// frozen at ~7% penalty forever, even if it is now 700+ days "late"; our
// time-based estimate would mark it 100% depleted and silently drop it.
//
// The only for-sure signal is on-chain: the HEX `StakeGoodAccounting` event
// (indexed by the subgraph as `stakeGoodAccountings`), or equivalently a
// non-zero `unlockedDay` on the stake with no matching end. This module queries
// the subgraph the rest of the app already uses and returns the FROZEN numbers.

import { hexSubgraphQuery, type HexNet } from './subgraph';
import { LATE_PENALTY_GRACE_DAYS, LATE_PENALTY_SCALE_DAYS, heartsToHex } from './hexDay';

export interface GoodAccountingRecord {
  stakeId: string;
  stakerAddr: string;
  /** Principal (HEX) as recorded at good-accounting. */
  principalHex: number;
  /** Interest reward (HEX) accrued up to the good-accounting day. */
  payoutHex: number;
  /** Penalty (HEX) FROZEN at the good-accounting day — does not grow after. */
  penaltyHex: number;
  /** Unix ms when good-accounting ran. */
  timestamp: number;
}

interface RawGA {
  stakeId: string;
  stakerAddr: string;
  stakedHearts: string;
  payout: string;
  penalty: string;
  timestamp: string;
}

const GA_FIELDS = 'stakeId stakerAddr stakedHearts payout penalty timestamp';

const toRecord = (g: RawGA): GoodAccountingRecord => ({
  stakeId: String(g.stakeId),
  stakerAddr: g.stakerAddr.toLowerCase(),
  principalHex: heartsToHex(g.stakedHearts),
  payoutHex: heartsToHex(g.payout),
  penaltyHex: heartsToHex(g.penalty),
  timestamp: Number(g.timestamp) * 1000,
});

/**
 * Good-accounting records for a set of stakeIds, keyed by stakeId. Chunked to
 * stay within subgraph query limits. Best-effort per chunk: a failing chunk is
 * skipped rather than failing the whole lookup.
 */
export async function fetchGoodAccountings(
  net: HexNet,
  stakeIds: (string | number)[],
): Promise<Map<string, GoodAccountingRecord>> {
  const out = new Map<string, GoodAccountingRecord>();
  const ids = [...new Set(stakeIds.map(String))];
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500).map((id) => `"${id}"`).join(',');
    try {
      const d = await hexSubgraphQuery<{ stakeGoodAccountings: RawGA[] }>(
        net,
        `{ stakeGoodAccountings(where:{ stakeId_in: [${chunk}] }, first: 1000){ ${GA_FIELDS} } }`,
      );
      for (const g of d.stakeGoodAccountings ?? []) out.set(String(g.stakeId), toRecord(g));
    } catch {
      /* best-effort: skip this chunk */
    }
  }
  return out;
}

/** Fetch the good-accounting record for a single stake, or null if none. */
export async function fetchGoodAccounting(
  net: HexNet,
  stakeId: string | number,
): Promise<GoodAccountingRecord | null> {
  const m = await fetchGoodAccountings(net, [stakeId]);
  return m.get(String(stakeId)) ?? null;
}

export type StakeAccountingState =
  | 'active' // term not yet served
  | 'ended' // staker ended it (authoritative)
  | 'good-accounted' // good-accounting ran: penalty + payout frozen (authoritative)
  | 'bleeding' // matured, unended, NOT good-accounted: late penalty still growing
  | 'matured'; // matured, unended, within the 14-day grace (no penalty yet)

export interface StakeAccountingStatus {
  state: StakeAccountingState;
  /** True when we have on-chain proof (an end or good-accounting event). When
   *  false, the figures are a time-based ESTIMATE that may be wrong. */
  confirmed: boolean;
  /** Penalty in HEX — frozen if good-accounted/ended, else estimated from time. */
  penaltyHex: number;
  /** Penalty as a share (0–1) of the gross return (principal + interest). For an
   *  unaccounted stake we only know principal, so this is an upper-bound estimate. */
  penaltyFraction: number;
  /** HEX the staker can still claim. 0 only when truly fully depleted. */
  netClaimableHex: number;
  /** HEX day the penalty was frozen (good-accounting day), if known. */
  frozenOnDay?: number;
  note: string;
}

/**
 * Decide a matured stake's true status. Pass the good-accounting record (from
 * `fetchGoodAccountings`) when one exists; `hasEnd` is whether a stakeEnd event
 * exists for this stakeId. `currentDay` is today's HEX day.
 *
 * The contract's late-end penalty (mirrored here) is
 * `grossReturn * daysPastGrace / 700`, where `daysPastGrace` is measured to the
 * day accounting happened — which good-accounting freezes. Without good-accounting
 * we can only estimate `grossReturn` as the principal (interest is unknown
 * off-chain), so the estimate is an UPPER bound on the loss.
 */
export function classifyMaturedStake(args: {
  principalHex: number;
  endDay: number;
  currentDay: number;
  hasEnd: boolean;
  ga: GoodAccountingRecord | null;
}): StakeAccountingStatus {
  const { principalHex, endDay, currentDay, hasEnd, ga } = args;

  if (ga) {
    const gross = ga.principalHex + ga.payoutHex;
    const frozenOnDay = Math.round(
      endDay + LATE_PENALTY_GRACE_DAYS + (gross > 0 ? (ga.penaltyHex / gross) * LATE_PENALTY_SCALE_DAYS : 0),
    );
    return {
      state: 'good-accounted',
      confirmed: true,
      penaltyHex: ga.penaltyHex,
      penaltyFraction: gross > 0 ? Math.min(1, ga.penaltyHex / gross) : 0,
      netClaimableHex: Math.max(0, ga.principalHex + ga.payoutHex - ga.penaltyHex),
      frozenOnDay,
      note:
        'Good-accounted on-chain — penalty and payout are FROZEN. The stake is ' +
        'NOT still bleeding; remaining HEX stays claimable until the staker ends it.',
    };
  }

  if (hasEnd) {
    return {
      state: 'ended',
      confirmed: true,
      penaltyHex: 0,
      penaltyFraction: 0,
      netClaimableHex: 0,
      note: 'Stake already ended on-chain.',
    };
  }

  // Unended and not good-accounted: the late penalty is genuinely still growing.
  const daysPastGrace = Math.max(0, currentDay - endDay - LATE_PENALTY_GRACE_DAYS);
  const frac = Math.min(1, daysPastGrace / LATE_PENALTY_SCALE_DAYS);
  const inGrace = currentDay - endDay <= LATE_PENALTY_GRACE_DAYS;
  return {
    state: inGrace ? 'matured' : 'bleeding',
    confirmed: false,
    penaltyHex: principalHex * frac,
    penaltyFraction: frac,
    netClaimableHex: Math.max(0, principalHex * (1 - frac)),
    note:
      'No good-accounting or end event found — figures are a TIME-BASED ESTIMATE ' +
      'from principal only. Verify on-chain before treating as fully depleted.',
  };
}
