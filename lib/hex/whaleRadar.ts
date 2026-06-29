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

/** One past stake-end and what the wallet did next — the evidence behind the
 *  sell/re-stake rating. `restaked` is true when a new stake started within
 *  RESTAKE_WINDOW_SEC of this end. */
export interface RestakeEvent {
  endStakeId: string;
  endTimestamp: number; // unix seconds
  endHex: number;
  endTx?: string;
  restaked: boolean;
  restakeStakeId?: string;
  restakeTimestamp?: number;
  restakeHex?: number;
  restakeTx?: string;
  daysAfter?: number; // whole days between the end and the re-stake
}

/** A wallet stake start/end record used to derive the re-stake evidence. */
export interface HistoryRecord {
  stakeId: string;
  timestamp: number; // unix seconds
  principalHex: number;
  tx?: string;
}

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
  /** Per-end evidence behind the rating (most recent first). */
  evidence: RestakeEvent[];
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

export function classifyBias(rate: number | null): WhaleBias {
  if (rate == null) return 'unknown';
  if (rate >= 0.66) return 'restake';
  if (rate <= 0.34) return 'sell';
  return 'mixed';
}

/**
 * Per-end evidence behind the rating: for each past stake-end, the earliest
 * new stake the wallet started within RESTAKE_WINDOW_SEC (if any). Returned most
 * recent first so the UI can show the latest behavior first.
 */
export function restakeEvidence(starts: HistoryRecord[], ends: HistoryRecord[]): RestakeEvent[] {
  const sortedStarts = [...starts].sort((a, b) => a.timestamp - b.timestamp);
  return [...ends]
    .sort((a, b) => b.timestamp - a.timestamp) // most recent end first
    .map((e) => {
      const match = sortedStarts.find(
        (s) => s.timestamp > e.timestamp && s.timestamp <= e.timestamp + RESTAKE_WINDOW_SEC,
      );
      return {
        endStakeId: e.stakeId,
        endTimestamp: e.timestamp,
        endHex: e.principalHex,
        endTx: e.tx,
        restaked: !!match,
        restakeStakeId: match?.stakeId,
        restakeTimestamp: match?.timestamp,
        restakeHex: match?.principalHex,
        restakeTx: match?.tx,
        daysAfter: match ? Math.round((match.timestamp - e.timestamp) / 86_400) : undefined,
      };
    });
}

/** Re-stake rate (+ count) derived from the per-end evidence. */
export function rateFromEvidence(evidence: RestakeEvent[]): { rate: number | null; count: number } {
  if (!evidence.length) return { rate: null, count: 0 };
  const restaked = evidence.filter((e) => e.restaked).length;
  return { rate: restaked / evidence.length, count: evidence.length };
}

/** Build a single whale stake row from raw values + the wallet's behavior. */
export function buildWhaleStake(
  raw: { stakeId: string; stakerAddr: string; principalHex: number; tShares: number; startDay: number; endDay: number },
  currentDay: number,
  history: { rate: number | null; count: number },
  evidence: RestakeEvent[] = [],
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
    evidence,
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
