// Pure HEX stake math — Longer-Pays-Better (LPB) + Bigger-Pays-Better (BPB)
// share bonuses, ported from the HEX contract's `_stakeStartBonusHearts`.
// Deterministic, no I/O. Used by the HEX Stake Strategist to project a *new*
// hypothetical stake's T-Shares and yield.
//
//   LPB — up to +200% shares, maxing at 3640 bonus-days (a 3641-day stake).
//   BPB — up to +10%  shares, maxing at 150,000,000 HEX of principal.
//
// The contract works in "hearts" (1 HEX = 1e8 hearts); since every term here is
// a ratio of hearts, we can work directly in whole-HEX units and the bonus
// fractions come out identical.

export const HEX_MAX_STAKE_DAYS = 5555;

// LPB = 364 * 100 / 20. A stake earns one bonus-day per staked day beyond the
// first, capped at LPB_MAX_BONUS_DAYS — so the full LPB bonus is reached at
// 3641 staked days and never grows after that.
const LPB = 1820;
export const LPB_FULL_BONUS_DAYS = 3641; // first length that captures 100% of LPB

const LPB_MAX_BONUS_DAYS = 3640;
export const BPB_MAX_HEX = 150_000_000;
// BPB in whole-HEX units: BPB_MAX_HEX * 100 / 10.
const BPB = BPB_MAX_HEX * 10;

/**
 * Combined LPB+BPB share bonus, expressed as a fraction of principal
 * (0 = no bonus, 2.0 = +200%). Matches the contract's algebra:
 *   bonus = cappedExtraDays / LPB + cappedHex / BPB
 */
export function bonusMultiplier(principalHex: number, stakedDays: number): number {
  const cappedExtraDays = stakedDays > 1 ? Math.min(stakedDays - 1, LPB_MAX_BONUS_DAYS) : 0;
  const cappedHex = Math.min(Math.max(principalHex, 0), BPB_MAX_HEX);
  return cappedExtraDays / LPB + cappedHex / BPB;
}

/** Bonus-weighted HEX that actually earns shares (principal + bonus). */
export function effectiveHex(principalHex: number, stakedDays: number): number {
  return principalHex * (1 + bonusMultiplier(principalHex, stakedDays));
}

/**
 * T-Shares a new stake would receive.
 * `tShareRateHex` is the current HEX-per-T-Share rate (LiveData.tshareRateHEX).
 */
export function projectedTShares(
  principalHex: number,
  stakedDays: number,
  tShareRateHex: number,
): number {
  if (!tShareRateHex || tShareRateHex <= 0) return 0;
  return effectiveHex(principalHex, stakedDays) / tShareRateHex;
}

export interface StakeProjection {
  days: number;
  tShares: number;
  /** Gross HEX yield over the full term at the assumed daily payout/T-Share. */
  projectedYieldHex: number;
  /** Yield as a % of principal over the full term. */
  roiPct: number;
  /** Annualized ROI. */
  apyPct: number;
}

/**
 * Project a stake outcome assuming a constant daily payout per T-Share.
 * `dailyPayoutPerTShare` is in HEX (LiveData.payoutPerTshare, or a trailing
 * average). This is a scenario, not a guarantee — future payouts are unknown.
 */
export function projectStake(
  principalHex: number,
  stakedDays: number,
  tShareRateHex: number,
  dailyPayoutPerTShare: number,
): StakeProjection {
  const tShares = projectedTShares(principalHex, stakedDays, tShareRateHex);
  const projectedYieldHex = tShares * dailyPayoutPerTShare * stakedDays;
  const roiPct = principalHex > 0 ? (projectedYieldHex / principalHex) * 100 : 0;
  const apyPct = stakedDays > 0 ? (roiPct * 365) / stakedDays : 0;
  return { days: stakedDays, tShares, projectedYieldHex, roiPct, apyPct };
}

/** Project across a set of stake lengths (for the ROI/APY-vs-length curve). */
export function projectionCurve(
  principalHex: number,
  tShareRateHex: number,
  dailyPayoutPerTShare: number,
  lengths: number[],
): StakeProjection[] {
  return lengths.map((d) => projectStake(principalHex, d, tShareRateHex, dailyPayoutPerTShare));
}

/**
 * A spread of stake lengths to chart: dense early (where the LPB bonus is
 * climbing) and always including the 3641-day LPB cap and the 5555-day max.
 */
export function defaultLengths(): number[] {
  const set = new Set<number>([1]);
  for (let d = 90; d <= HEX_MAX_STAKE_DAYS; d += 90) set.add(d);
  set.add(LPB_FULL_BONUS_DAYS);
  set.add(HEX_MAX_STAKE_DAYS);
  return [...set].sort((a, b) => a - b);
}

// ── Penalty math (for the Stake Doctor) ─────────────────────────────────────
//
// HEX charges an Early-End-Stake penalty before a stake's committed term, a
// 14-day penalty-free grace at the end, then a Late-End penalty after that.

export const EARLY_PENALTY_MIN_DAYS = 90;
export const LATE_GRACE_DAYS = 14;

/** Length of the early-end penalty window: max(90, floor((committed+1)/2)). */
export function earlyPenaltyDays(committedDays: number): number {
  return Math.max(EARLY_PENALTY_MIN_DAYS, Math.floor((committedDays + 1) / 2));
}

/**
 * Estimated Early-End-Stake penalty in HEX ≈ the payout accrued over the
 * penalty window (T-Shares × daily payout × penaltyDays). When this exceeds the
 * yield served so far, the difference comes out of principal. Estimate only —
 * it assumes the current daily payout per T-Share.
 */
export function estimatedEarlyPenaltyHex(
  tShares: number,
  dailyPayoutPerTShare: number,
  committedDays: number,
): number {
  return tShares * dailyPayoutPerTShare * earlyPenaltyDays(committedDays);
}

export type StakeStatus = 'locked' | 'grace' | 'late';

export interface StakeTiming {
  status: StakeStatus;
  servedDays: number;
  /** Days until the committed end day (0 once reached). */
  daysToEnd: number;
  /** Days until the penalty-free window opens (0 if open or past). */
  opensInDays: number;
  /** Days remaining inside the 14-day penalty-free window (only when in grace). */
  graceDaysLeft: number;
  /** Days elapsed past the penalty-free window (only when late). */
  daysPastGrace: number;
  progressPct: number;
}

/** Exact day-based timing/status for an active stake. */
export function stakeTiming(startDay: number, endDay: number, committedDays: number, currentDay: number): StakeTiming {
  const servedDays = Math.max(0, currentDay - startDay);
  const graceEnd = endDay + LATE_GRACE_DAYS;
  let status: StakeStatus = 'locked';
  if (currentDay >= startDay && currentDay <= endDay) status = 'locked';
  else if (currentDay > endDay && currentDay <= graceEnd) status = 'grace';
  else if (currentDay > graceEnd) status = 'late';
  return {
    status,
    servedDays,
    daysToEnd: Math.max(0, endDay - currentDay),
    opensInDays: Math.max(0, endDay - currentDay),
    graceDaysLeft: status === 'grace' ? Math.max(0, graceEnd - currentDay) : 0,
    daysPastGrace: status === 'late' ? currentDay - graceEnd : 0,
    progressPct: committedDays > 0 ? Math.min(100, (servedDays / committedDays) * 100) : 0,
  };
}
