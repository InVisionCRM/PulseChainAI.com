// HEX Whale Unlock Radar — pure helpers. Behavioral "sell vs re-stake"
// propensity is derived purely from a wallet's own history: of its past
// stake-ends, how many were followed by a new stake start within a short
// window. No I/O here.

import { hexDayToDate } from './hexDay';

export const WHALE_MIN_HEX = 1_000_000;
export const UNLOCK_WINDOW_DAYS = 30;
const RESTAKE_WINDOW_SEC = 14 * 86_400; // a new stake within 14d of an end = "re-staked"
// When a whale has no end history to learn from, assume a coin-flip for the
// aggregate sell-pressure estimate (clearly labeled in the UI).
const UNKNOWN_SELL_PROB = 0.5;

export type WhaleBias = 'restake' | 'sell' | 'mixed' | 'unknown';

export interface WhaleStake {
  stakeId: string;
  stakerAddr: string;
  principalHex: number;
  tShares: number;
  startDay: number;
  endDay: number;
  daysToEnd: number;
  endDateMs: number;
  priorEnds: number;
  restakeRate: number | null; // null when no prior ends
  sellProb: number | null;
  bias: WhaleBias;
}

export interface CalendarBucket {
  day: number; // HEX day
  dateMs: number;
  hex: number;
  count: number;
}

export interface WhaleRadarData {
  network: 'pulsechain' | 'ethereum';
  currentDay: number;
  stakes: WhaleStake[];
  totalEndingHex: number;
  /** Behavior-weighted estimate of HEX likely to be sold (Σ principal × sellProb). */
  estSellHex: number;
  calendar: CalendarBucket[];
}

/**
 * Re-stake propensity from a wallet's history: fraction of past stake-ends that
 * were followed by a new stake within RESTAKE_WINDOW_SEC. Returns null when the
 * wallet has no prior ends to learn from.
 */
export function restakePropensity(startTimestamps: number[], endTimestamps: number[]): { rate: number | null; count: number } {
  if (!endTimestamps.length) return { rate: null, count: 0 };
  const starts = [...startTimestamps].sort((a, b) => a - b);
  let restaked = 0;
  for (const e of endTimestamps) {
    if (starts.some((s) => s > e && s <= e + RESTAKE_WINDOW_SEC)) restaked++;
  }
  return { rate: restaked / endTimestamps.length, count: endTimestamps.length };
}

export function classifyBias(rate: number | null): WhaleBias {
  if (rate == null) return 'unknown';
  if (rate >= 0.66) return 'restake';
  if (rate <= 0.34) return 'sell';
  return 'mixed';
}

/** Build a single whale stake row from raw values + the wallet's behavior. */
export function buildWhaleStake(
  raw: { stakeId: string; stakerAddr: string; principalHex: number; tShares: number; startDay: number; endDay: number },
  currentDay: number,
  history: { rate: number | null; count: number },
): WhaleStake {
  const sellProb = history.rate == null ? null : 1 - history.rate;
  return {
    ...raw,
    daysToEnd: Math.max(0, raw.endDay - currentDay),
    endDateMs: hexDayToDate(raw.endDay).getTime(),
    priorEnds: history.count,
    restakeRate: history.rate,
    sellProb,
    bias: classifyBias(history.rate),
  };
}

/** Total ending HEX, behavior-weighted sell estimate, and a per-day calendar. */
export function summarize(stakes: WhaleStake[]): Pick<WhaleRadarData, 'totalEndingHex' | 'estSellHex' | 'calendar'> {
  const totalEndingHex = stakes.reduce((s, k) => s + k.principalHex, 0);
  const estSellHex = stakes.reduce((s, k) => s + k.principalHex * (k.sellProb ?? UNKNOWN_SELL_PROB), 0);

  const byDay = new Map<number, CalendarBucket>();
  for (const k of stakes) {
    const b = byDay.get(k.endDay) ?? { day: k.endDay, dateMs: k.endDateMs, hex: 0, count: 0 };
    b.hex += k.principalHex;
    b.count += 1;
    byDay.set(k.endDay, b);
  }
  const calendar = [...byDay.values()].sort((a, b) => a.day - b.day);
  return { totalEndingHex, estSellHex, calendar };
}
