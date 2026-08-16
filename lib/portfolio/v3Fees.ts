// Uncollected fees on a Uniswap-V3 position, read from the pool.
//
// `positions(tokenId)` reports `tokensOwed0/1`, but those only move when the
// position is touched — mint, burn, collect. A position left alone for months
// reports zero owed while having earned plenty, so reading tokensOwed alone
// understates fees, usually to nothing.
//
// The real figure is the pool's fee-growth accumulator, which is what the
// periphery itself computes on collect:
//
//   feeGrowthInside = feeGrowthGlobal − feeGrowthBelow − feeGrowthAbove
//   fees            = liquidity · (feeGrowthInside − feeGrowthInsideLast) / 2¹²⁸
//                     + tokensOwed
//
// where below/above flip depending on which side of the range the price is on.
// Every quantity is a uint256 that is *expected* to wrap — Uniswap relies on
// unchecked overflow so the differences come out right — so all arithmetic here
// is done in BigInt masked to 256 bits, never in floating point.
//
// Selectors below were each verified against a live 9mm V3 pool on PulseChain
// (0xe4baadcb…ae3e): slot0 and both feeGrowthGlobal reads return data, and
// ticks(int24) returns its eight words with liquidityGross set and initialized
// true. This works for any V3 fork — 9mm, LibertySwap, or otherwise — because
// it only touches the standard pool interface.

import { ethCall } from './evmRpc';
import type { ChainId } from '@/services';

const SEL = {
  slot0: '0x3850c7bd',
  feeGrowthGlobal0X128: '0xf3058399',
  feeGrowthGlobal1X128: '0x46141319',
  ticks: '0xf30dba93', // ticks(int24)
} as const;

const MASK = (1n << 256n) - 1n;
/** Uniswap's accumulators are meant to overflow; subtraction wraps. */
const sub = (a: bigint, b: bigint) => (a - b) & MASK;

const word = (hex: string, i: number) => hex.replace(/^0x/, '').slice(i * 64, i * 64 + 64);
const big = (w: string) => BigInt('0x' + (w || '0'));

/** int24 → the 256-bit two's-complement word an eth_call expects. */
function tickArg(tick: number): string {
  return (BigInt(tick) & MASK).toString(16).padStart(64, '0');
}

/** int24 out of a returned word. */
function toInt24(w: string): number {
  let v = BigInt('0x' + w);
  if (v >= 1n << 255n) v -= 1n << 256n;
  return Number(v);
}

export interface PositionFeeInput {
  tickLower: number;
  tickUpper: number;
  /** Position liquidity, raw uint128. */
  liquidity: bigint;
  feeGrowthInside0Last: bigint;
  feeGrowthInside1Last: bigint;
  /** Already-credited fees the periphery is holding for this position. */
  owed0: bigint;
  owed1: bigint;
}

export interface V3Fees {
  /** Raw token units, decimals not applied. */
  fee0: bigint;
  fee1: bigint;
}

/**
 * Fees this position could collect right now, in raw token units.
 *
 * Returns null when the pool won't answer — better an absent figure than a
 * zero that reads as "this position has earned nothing".
 */
export async function uncollectedFees(
  chain: ChainId,
  pool: string,
  p: PositionFeeInput,
  /**
   * Optional reader, so a caller scanning many positions can share one cache.
   * A wallet with fifty positions usually spans a handful of pools, and every
   * position in a pool re-reads the same slot0 and fee-growth globals.
   */
  read?: (to: string, data: string) => Promise<string | null>,
): Promise<V3Fees | null> {
  const call = read ?? ((to: string, data: string) => ethCall(chain, to, data));
  const [slot0Hex, g0Hex, g1Hex, lowerHex, upperHex] = await Promise.all([
    call(pool, SEL.slot0),
    call(pool, SEL.feeGrowthGlobal0X128),
    call(pool, SEL.feeGrowthGlobal1X128),
    call(pool, SEL.ticks + tickArg(p.tickLower)),
    call(pool, SEL.ticks + tickArg(p.tickUpper)),
  ]);
  if (!slot0Hex || !g0Hex || !g1Hex || !lowerHex || !upperHex) return null;
  if (lowerHex.length < 2 + 64 * 8 || upperHex.length < 2 + 64 * 8) return null;

  const tickCurrent = toInt24(word(slot0Hex, 1));
  const global0 = big(word(g0Hex, 0));
  const global1 = big(word(g1Hex, 0));
  // ticks(): liquidityGross, liquidityNet, feeGrowthOutside0, feeGrowthOutside1, …
  const lowerOut0 = big(word(lowerHex, 2));
  const lowerOut1 = big(word(lowerHex, 3));
  const upperOut0 = big(word(upperHex, 2));
  const upperOut1 = big(word(upperHex, 3));

  const below0 = tickCurrent >= p.tickLower ? lowerOut0 : sub(global0, lowerOut0);
  const below1 = tickCurrent >= p.tickLower ? lowerOut1 : sub(global1, lowerOut1);
  const above0 = tickCurrent < p.tickUpper ? upperOut0 : sub(global0, upperOut0);
  const above1 = tickCurrent < p.tickUpper ? upperOut1 : sub(global1, upperOut1);

  const inside0 = sub(sub(global0, below0), above0);
  const inside1 = sub(sub(global1, below1), above1);

  const earned0 = (p.liquidity * sub(inside0, p.feeGrowthInside0Last)) >> 128n;
  const earned1 = (p.liquidity * sub(inside1, p.feeGrowthInside1Last)) >> 128n;

  return { fee0: earned0 + p.owed0, fee1: earned1 + p.owed1 };
}
