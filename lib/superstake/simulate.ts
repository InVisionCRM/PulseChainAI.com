// Forward projection for SuperStake — what happens over the next N cycles, for
// the pool and for one holder, under assumptions the reader sets.
//
// This is the mirror of `cycleHeadToHead`, which scores a single cycle from
// figures that already exist. Here nothing exists yet: each cycle's ending state
// becomes the next one's opening state, so the compounding is simulated rather
// than asserted. Same constants, same formulas — a projection that disagreed
// with the record's own maths would be worthless.
//
// Every number returned is a consequence of the inputs. Nothing is smoothed,
// padded or floored to look better, and a run that shrinks the pool returns a
// shrinking pool.

import { HOLDER_PAYOUT_RATE, REFLECTION_RATE, S_SHARE, TOLL } from './model';

/** The 2% of every trade that buys HEX for the pool. */
export const BUY_TAX_RATE = 0.02;
/** The 1% of every trade that buys pSSH and burns it. */
export const BURN_TAX_RATE = 0.01;

export interface SimInputs {
  /** What the holder puts in, USD. 0 runs the pool projection alone. */
  amountUsd: number;
  /** How many 60-day cycles to project. */
  cycles: number;
  /** Days per cycle. */
  cycleDays: number;
  /** Average pSSH trade volume per day, USD, at the start. */
  dailyVolumeUsd: number;
  /** Compounding change in daily volume per cycle, as a percent. */
  volumeDriftPct: number;
  /** Opening prices. */
  pHex: number;
  pSsh: number;
  /** Compounding price change per cycle, as a percent. */
  hexDriftPct: number;
  psshDriftPct: number;
  /** Pool state at the start. */
  poolHex: number;
  supply: number;
  /** HEX network state. */
  shareRate: number;
  /** Share rate only ever climbs; this is its growth per cycle, as a percent. */
  shareRateDriftPct: number;
  payoutPerTshare: number;
  /** Reinvest the holder's HEX earnings into more pSSH at each end-stake. */
  compound: boolean;
}

export interface SimCycle {
  /** 1-based cycle index within the projection. */
  n: number;
  // ── the pool ──
  /** HEX staked at the start of this cycle. */
  poolHex: number;
  /** T-shares that stake earns. */
  poolTShares: number;
  /** HEX the stake itself yields over the cycle. */
  poolYieldHex: number;
  /** The 1% handed to holders at the end-stake, in HEX. */
  payoutHex: number;
  /** HEX the 2% buy-tax bought over the cycle. */
  boughtHex: number;
  /** HEX staked at the start of the *next* cycle. */
  poolHexNext: number;
  /** What came in against what went out. Above 1 and the pool grows. */
  coverRatio: number;
  // ── supply ──
  supply: number;
  /** pSSH the 1% burned over the cycle. */
  burnedTokens: number;
  sSharesLeft: number;
  // ── prices and volume used for this cycle ──
  pHex: number;
  pSsh: number;
  volumeUsd: number;
  // ── the holder ──
  /** pSSH held entering this cycle. */
  tokens: number;
  /** That holding as a share of supply. */
  supplyShare: number;
  /** Holder's slice of the end-stake payout, HEX. */
  holderPayoutHex: number;
  /** Holder's slice of the reflections, HEX. */
  holderReflectionHex: number;
  /** Both, this cycle. */
  holderHex: number;
  /** Every cycle so far, including this one. */
  holderHexCumulative: number;
  /** pSSH bought with this cycle's earnings, when compounding. */
  compoundedTokens: number;
  /** Value of the holding plus HEX earned (or, compounding, just the holding). */
  holderValueUsd: number;
  /** The same dollars left in HEX from the start, for comparison. */
  holdHexValueUsd: number;
  /** The same dollars in a rolling native HEX stake, for comparison. */
  stakeHexValueUsd: number;
}

export interface SimResult {
  cycles: SimCycle[];
  /** Convenience handles on the last cycle. */
  final: SimCycle;
  /** HEX the holder earned across the whole run. */
  totalHolderHex: number;
  /** That HEX at the final price. */
  totalHolderHexUsd: number;
  /** Ending value against what went in. */
  holderMultiple: number;
  /** Pool's ending HEX against its opening HEX. */
  poolMultiple: number;
  /** Cycles whose intake covered their own payout. */
  coveredCycles: number;
  /** True when supply never fell below one S-share. */
  supplySurvived: boolean;
  /** What the holder started with, after the entry toll. */
  openingTokens: number;
}

/**
 * The pool's T-shares for a given HEX principal. Same formula the head-to-head
 * uses for a native stake, because that is exactly what the pool opens — and it
 * reproduces the recorded 107.55 T-shares from 4,790,629 HEX at share rate
 * 46,129, which is the check that it's the right formula.
 */
export function tSharesFor(hex: number, days: number, shareRate: number): number {
  if (!(hex > 0) || !(shareRate > 0)) return 0;
  const lpb = 1 + (Math.min(days, 3641) - 1) / 1820;
  return (hex * lpb + (hex * Math.min(hex, 150e6)) / 1.5e9) / shareRate;
}

const pct = (p: number) => 1 + p / 100;

/**
 * Run the projection. Returns null only when the inputs can't describe a run at
 * all — a caller showing "—" is better than one showing a fabricated curve.
 */
export function simulate(input: SimInputs): SimResult | null {
  const {
    amountUsd, cycles, cycleDays, dailyVolumeUsd, volumeDriftPct,
    hexDriftPct, psshDriftPct, shareRateDriftPct, payoutPerTshare, compound,
  } = input;

  if (!(cycles > 0) || !(cycleDays > 0)) return null;
  if (!(input.pHex > 0) || !(input.pSsh > 0)) return null;
  if (!(input.poolHex > 0) || !(input.supply > 0) || !(input.shareRate > 0)) return null;

  // Entry costs the 5.5% toll, same as anywhere else on the page.
  const openingTokens = amountUsd > 0 ? (amountUsd * (1 - TOLL)) / input.pSsh : 0;

  let poolHex = input.poolHex;
  let supply = input.supply;
  let pHex = input.pHex;
  let pSsh = input.pSsh;
  let shareRate = input.shareRate;
  let dailyVolume = dailyVolumeUsd;
  let tokens = openingTokens;
  let cumulativeHex = 0;
  /** HEX the holder has taken and kept, when not compounding. */
  let bankedHex = 0;

  // The two comparisons, carried alongside.
  const holdHex = amountUsd > 0 ? amountUsd / input.pHex : 0;
  let stakeHex = holdHex;

  const out: SimCycle[] = [];

  for (let n = 1; n <= cycles; n++) {
    const volumeUsd = dailyVolume * cycleDays;

    // ── the pool over this cycle ──
    const poolTShares = tSharesFor(poolHex, cycleDays, shareRate);
    const poolYieldHex = poolTShares * payoutPerTshare * cycleDays;
    const payoutHex = HOLDER_PAYOUT_RATE * (poolHex + poolYieldHex);
    const boughtHex = pHex > 0 ? (BUY_TAX_RATE * volumeUsd) / pHex : 0;
    const poolHexNext = poolHex + poolYieldHex - payoutHex + boughtHex;
    // What came in (own yield + what the tax bought) against the 1% paid out.
    const coverRatio = payoutHex > 0 ? (poolYieldHex + boughtHex) / payoutHex : 0;

    // ── supply over this cycle ──
    const burnedTokens = pSsh > 0 ? (BURN_TAX_RATE * volumeUsd) / pSsh : 0;
    const supplyNext = Math.max(0, supply - burnedTokens);

    // ── the holder ──
    // Their share is taken against the supply they held through, before the
    // cycle's burn — the burn is what *raises* the share for the next cycle.
    const supplyShare = supply > 0 ? tokens / supply : 0;
    const holderPayoutHex = supplyShare * payoutHex;
    const holderReflectionHex = pHex > 0 ? (supplyShare * REFLECTION_RATE * volumeUsd) / pHex : 0;
    const holderHex = holderPayoutHex + holderReflectionHex;
    cumulativeHex += holderHex;

    // Prices for the *next* cycle — this cycle was earned at this cycle's price.
    const pHexNext = pHex * pct(hexDriftPct);
    const pSshNext = pSsh * pct(psshDriftPct);

    let compoundedTokens = 0;
    if (compound && holderHex > 0 && pSsh > 0) {
      // Sell the HEX at this cycle's price, buy pSSH, pay the toll again.
      compoundedTokens = (holderHex * pHex * (1 - TOLL)) / pSsh;
    } else {
      bankedHex += holderHex;
    }

    // A native HEX stake, rolled the same way, for the comparison line.
    const stakeTShares = tSharesFor(stakeHex, cycleDays, shareRate);
    stakeHex += stakeTShares * payoutPerTshare * cycleDays;

    const tokensAfter = tokens + compoundedTokens;
    const holderValueUsd = tokensAfter * pSsh + bankedHex * pHex;

    out.push({
      n,
      poolHex, poolTShares, poolYieldHex, payoutHex, boughtHex, poolHexNext, coverRatio,
      supply, burnedTokens, sSharesLeft: supply / S_SHARE,
      pHex, pSsh, volumeUsd,
      tokens, supplyShare,
      holderPayoutHex, holderReflectionHex, holderHex,
      holderHexCumulative: cumulativeHex,
      compoundedTokens,
      holderValueUsd,
      holdHexValueUsd: holdHex * pHex,
      stakeHexValueUsd: stakeHex * pHex,
    });

    // ── roll forward ──
    poolHex = poolHexNext;
    supply = supplyNext;
    tokens = tokensAfter;
    pHex = pHexNext;
    pSsh = pSshNext;
    shareRate *= pct(shareRateDriftPct);
    dailyVolume *= pct(volumeDriftPct);
  }

  const final = out[out.length - 1];
  return {
    cycles: out,
    final,
    totalHolderHex: cumulativeHex,
    totalHolderHexUsd: cumulativeHex * final.pHex,
    holderMultiple: amountUsd > 0 ? final.holderValueUsd / amountUsd : 0,
    poolMultiple: input.poolHex > 0 ? final.poolHexNext / input.poolHex : 0,
    coveredCycles: out.filter((c) => c.coverRatio >= 1).length,
    supplySurvived: out.every((c) => c.supply >= S_SHARE),
    openingTokens,
  };
}

/**
 * Daily volume at which a cycle exactly covers its own payout — the line the
 * "will it shrink?" question turns on. Solved directly rather than searched:
 * payout = yield + (2% × volume) / pHex, so volume = (payout − yield) × pHex / 2%.
 */
export function breakEvenDailyVolume(
  poolHex: number,
  cycleDays: number,
  shareRate: number,
  payoutPerTshare: number,
  pHex: number,
): number {
  if (!(poolHex > 0) || !(cycleDays > 0) || !(pHex > 0)) return 0;
  const yieldHex = tSharesFor(poolHex, cycleDays, shareRate) * payoutPerTshare * cycleDays;
  const payout = HOLDER_PAYOUT_RATE * (poolHex + yieldHex);
  const gap = Math.max(0, payout - yieldHex);
  return (gap * pHex) / BUY_TAX_RATE / cycleDays;
}
