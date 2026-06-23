// Realized HEX staking returns — what stakers ACTUALLY earned, bucketed by the
// length they committed to. Built from real ended stakes (payout − penalty over
// principal, annualized by days actually served), so it reflects early-ends,
// penalties and late-ends — the gap between textbook APY and reality. Pure.

import { heartsToHex } from './hexDay';

export interface EndedReturnRow {
  committed_days: number;
  served_days: number;
  payout: string; // hearts
  penalty: string; // hearts
  staked_hearts: string; // hearts
}

export interface ApyBucket {
  label: string;
  minDays: number;
  count: number;
  /** Median realized APY (robust to outliers) — the headline figure. */
  medianApyPct: number;
  /** Mean realized APY. */
  avgApyPct: number;
  /** Share of stakes in this bucket that ended early (served < committed). */
  earlyRate: number;
}

const BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '<1y', min: 1, max: 365 },
  { label: '1–2y', min: 365, max: 730 },
  { label: '2–3y', min: 730, max: 1095 },
  { label: '3–5y', min: 1095, max: 1825 },
  { label: '5–7y', min: 1825, max: 2555 },
  { label: '7–10y', min: 2555, max: 3641 },
  { label: '10y+', min: 3641, max: Number.MAX_SAFE_INTEGER },
];

const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Aggregate ended-stake rows into realized-APY buckets by committed length. */
export function realizedApyBuckets(rows: EndedReturnRow[]): ApyBucket[] {
  return BUCKETS.map((b) => {
    const apys: number[] = [];
    let early = 0;
    let total = 0;
    for (const r of rows) {
      const committed = Number(r.committed_days);
      if (!(committed >= b.min && committed < b.max)) continue;
      const principal = heartsToHex(r.staked_hearts);
      if (principal <= 0) continue;
      total += 1;
      const net = heartsToHex(r.payout) - heartsToHex(r.penalty);
      const served = Math.max(1, Number(r.served_days));
      // Annualized realized return on principal.
      apys.push(((net / principal) * 100 * 365) / served);
      if (Number(r.served_days) < committed) early += 1;
    }
    return {
      label: b.label,
      minDays: b.min,
      count: apys.length,
      medianApyPct: median(apys),
      avgApyPct: apys.length ? apys.reduce((s, v) => s + v, 0) / apys.length : 0,
      earlyRate: total ? early / total : 0,
    };
  }).filter((b) => b.count > 0);
}
