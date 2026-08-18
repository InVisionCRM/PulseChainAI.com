// The macro unlock schedule — when every locked HEX stake on the chain comes
// due. Pure: the route sums stakes into per-day buckets, the browser rolls
// those days up into whatever window the viewer picked.

import type { LockedStake } from './lockedStakes';

/** One HEX day's worth of maturing stakes. */
export interface UnlockBucket {
  /** HEX day the stakes mature on. */
  day: number;
  hex: number;
  tShares: number;
  stakes: number;
}

export interface UnlockSchedule {
  currentDay: number;
  /** Days that have maturing stakes, ascending. Days with none are absent. */
  buckets: UnlockBucket[];
  /**
   * Stakes already past their end day and still not ended — due, overdue, and
   * (unless good-accounted, which is filtered out upstream) bleeding the
   * late-end penalty.
   */
  overdue: UnlockBucket;
  /**
   * The slice of `overdue` that has been good-accounted: shares already
   * returned, payout and penalty frozen, HEX still sitting in the contract.
   * Good-accounting can only run on a matured stake, so this is always a
   * subset of the overdue bucket rather than anything still to come.
   */
  frozen: { hex: number; stakes: number };
  totals: { hex: number; tShares: number; stakes: number };
  /** Share of the chain's real locked totals these buckets represent. */
  coverage: { hexPct: number; tSharesPct: number };
  /** Furthest-dated maturity in the sample. */
  lastDay: number;
}

const HEARTS = 1e8;
const TSHARE = 1e12;

const empty = (day: number): UnlockBucket => ({ day, hex: 0, tShares: 0, stakes: 0 });

// A good-accounted stake still holds its HEX but its shares have already gone
// back to the network, so it counts toward what is due and not toward T-Shares.
const add = (b: UnlockBucket, s: LockedStake) => {
  b.hex += Number(s.stakedHearts) / HEARTS;
  if (!s.goodAccounted) b.tShares += Number(s.stakeShares) / TSHARE;
  b.stakes += 1;
};

/**
 * Sum locked stakes into one bucket per maturity day. `stakes` must already
 * have ended and good-accounted stakes removed.
 */
export function buildSchedule(
  stakes: LockedStake[],
  currentDay: number,
  network: { tShares: number; hexLocked: number },
): UnlockSchedule {
  const byDay = new Map<number, UnlockBucket>();
  const overdue = empty(currentDay);
  const totals = { hex: 0, tShares: 0, stakes: 0 };
  const frozen = { hex: 0, stakes: 0 };

  for (const s of stakes) {
    if (s.goodAccounted) {
      frozen.hex += Number(s.stakedHearts) / HEARTS;
      frozen.stakes += 1;
    }
    const day = Number(s.endDay);
    if (!Number.isFinite(day)) continue;
    if (day < currentDay) {
      add(overdue, s);
    } else {
      let b = byDay.get(day);
      if (!b) byDay.set(day, (b = empty(day)));
      add(b, s);
    }
    totals.hex += Number(s.stakedHearts) / HEARTS;
    if (!s.goodAccounted) totals.tShares += Number(s.stakeShares) / TSHARE;
    totals.stakes += 1;
  }

  const buckets = [...byDay.values()].sort((a, b) => a.day - b.day);
  return {
    currentDay,
    buckets,
    overdue,
    frozen,
    totals,
    coverage: {
      hexPct: network.hexLocked > 0 ? (totals.hex / network.hexLocked) * 100 : 0,
      tSharesPct: network.tShares > 0 ? (totals.tShares / network.tShares) * 100 : 0,
    },
    lastDay: buckets.length ? buckets[buckets.length - 1].day : currentDay,
  };
}

/**
 * Assemble a schedule from per-day buckets that were already summed elsewhere
 * (the Postgres mirror does the summing in SQL). Same shape and same overdue
 * split as `buildSchedule`, just starting a step later.
 */
export function scheduleFromBuckets(
  daily: UnlockBucket[],
  currentDay: number,
  network: { tShares: number; hexLocked: number },
  frozen: { hex: number; stakes: number } = { hex: 0, stakes: 0 },
): UnlockSchedule {
  const overdue = empty(currentDay);
  const buckets: UnlockBucket[] = [];
  const totals = { hex: 0, tShares: 0, stakes: 0 };
  for (const b of [...daily].sort((a, z) => a.day - z.day)) {
    if (b.day < currentDay) {
      overdue.hex += b.hex;
      overdue.tShares += b.tShares;
      overdue.stakes += b.stakes;
    } else {
      buckets.push(b);
    }
    totals.hex += b.hex;
    totals.tShares += b.tShares;
    totals.stakes += b.stakes;
  }
  return {
    currentDay,
    buckets,
    overdue,
    frozen,
    totals,
    coverage: {
      hexPct: network.hexLocked > 0 ? (totals.hex / network.hexLocked) * 100 : 0,
      tSharesPct: network.tShares > 0 ? (totals.tShares / network.tShares) * 100 : 0,
    },
    lastDay: buckets.length ? buckets[buckets.length - 1].day : currentDay,
  };
}

// ---------------------------------------------------------------------------
// Rolling days up for display
// ---------------------------------------------------------------------------

export type Grain = 'day' | 'week' | 'month' | 'quarter';

export const GRAIN_DAYS: Record<Grain, number> = { day: 1, week: 7, month: 30, quarter: 91 };

export interface SeriesPoint extends UnlockBucket {
  /** Running total of `hex` from the start of the window to here. */
  cumHex: number;
  /** Running total of `tShares`. */
  cumTShares: number;
}

/**
 * Roll per-day buckets into fixed-width periods anchored on `currentDay`, and
 * carry a running total alongside. Periods with nothing maturing are KEPT as
 * zeroes — a gap in the schedule is information, and dropping empty periods
 * would squash the time axis into something that lies about spacing.
 */
export function toSeries(
  buckets: UnlockBucket[],
  currentDay: number,
  horizonDays: number,
  grain: Grain,
): SeriesPoint[] {
  const width = GRAIN_DAYS[grain];
  const periods = Math.max(1, Math.ceil(horizonDays / width));
  const out: SeriesPoint[] = Array.from({ length: periods }, (_, i) => ({
    ...empty(currentDay + i * width),
    cumHex: 0,
    cumTShares: 0,
  }));

  for (const b of buckets) {
    const offset = b.day - currentDay;
    if (offset < 0 || offset >= periods * width) continue;
    const p = out[Math.floor(offset / width)];
    p.hex += b.hex;
    p.tShares += b.tShares;
    p.stakes += b.stakes;
  }

  let cumHex = 0;
  let cumT = 0;
  for (const p of out) {
    cumHex += p.hex;
    cumT += p.tShares;
    p.cumHex = cumHex;
    p.cumTShares = cumT;
  }
  return out;
}

/** The heaviest single day in the schedule, by HEX maturing. */
export function biggestDay(buckets: UnlockBucket[]): UnlockBucket | null {
  return buckets.reduce<UnlockBucket | null>((best, b) => (!best || b.hex > best.hex ? b : best), null);
}

/**
 * The day by which `fraction` (0–1) of the scheduled HEX has come due — the
 * "half of everything locked is free by …" read.
 */
export function dayForFraction(buckets: UnlockBucket[], fraction: number): number | null {
  const total = buckets.reduce((s, b) => s + b.hex, 0);
  if (total <= 0) return null;
  const target = total * fraction;
  let run = 0;
  for (const b of buckets) {
    run += b.hex;
    if (run >= target) return b.day;
  }
  return buckets.length ? buckets[buckets.length - 1].day : null;
}
