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

/**
 * Inverse of `projectedTShares`: the HEX principal a `stakedDays`-long stake
 * needs in order to mint `targetTShares` at the current T-Share rate.
 *
 * Solved exactly rather than searched, because the contract's bonus algebra is
 * a quadratic in principal — BPB scales with the principal itself:
 *   effective = p·(1 + L + min(p, BPB_MAX)/BPB)   where L = cappedExtraDays/LPB
 * Below the BPB cap that is `p²/BPB + p(1+L) − E = 0`; at or above the cap the
 * BPB term is the constant 0.1 and it collapses to a straight division.
 */
export function hexForTShares(
  targetTShares: number,
  stakedDays: number,
  tShareRateHex: number,
): number {
  if (!(targetTShares > 0) || !(tShareRateHex > 0) || !(stakedDays > 0)) return 0;
  const effective = targetTShares * tShareRateHex; // bonus-weighted HEX required
  const cappedExtraDays = stakedDays > 1 ? Math.min(stakedDays - 1, LPB_MAX_BONUS_DAYS) : 0;
  const l = 1 + cappedExtraDays / LPB;
  // Root of p²/BPB + p·l − effective = 0, valid while p stays under the BPB cap.
  const p = (BPB / 2) * (Math.sqrt(l * l + (4 * effective) / BPB) - l);
  if (p <= BPB_MAX_HEX) return p;
  // Past the cap the bonus stops growing with size: effective = p·(l + 0.1).
  return effective / (l + BPB_MAX_HEX / BPB);
}
