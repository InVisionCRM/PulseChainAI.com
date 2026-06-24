// HEX leaderboards ("Top 100") — pure types + derivations. All data fetching
// lives in the route; here we only shape, derive and sort rows so the logic is
// testable. Boards 1–7 come from the staking subgraph; board 8 (holders)
// merges liquid balances with aggregated staked totals.

export type BoardKey =
  | 'active-amount'
  | 'completed-amount'
  | 'roi'
  | 'days-late'
  | 'recent-penalties'
  | 'recent-starts'
  | 'recent-ends'
  | 'holders';

export const BOARDS: { key: BoardKey; label: string; blurb: string }[] = [
  { key: 'active-amount', label: 'Active by size', blurb: 'Largest stakes currently locked.' },
  { key: 'completed-amount', label: 'Completed by size', blurb: 'Largest stakes that have ended.' },
  { key: 'roi', label: 'Highest ROI', blurb: 'Best realized return on principal (net of penalty).' },
  { key: 'days-late', label: 'Most overdue', blurb: 'Active stakes ≥1M HEX past their end day, largest first (drops stakes already lost to penalties).' },
  { key: 'recent-penalties', label: 'Recent penalties', blurb: 'Latest stakes that paid an end penalty.' },
  { key: 'recent-starts', label: 'Recent starts', blurb: 'Newest stake-starts.' },
  { key: 'recent-ends', label: 'Recent ends', blurb: 'Newest stake-ends.' },
  { key: 'holders', label: 'Top holders', blurb: 'Largest holders by liquid + staked HEX.' },
];

// One flexible row; the table only renders the columns a board fills in.
export interface LeaderRow {
  rank: number;
  address: string;
  stakeId?: string;
  principalHex?: number;
  tShares?: number;
  payoutHex?: number;
  penaltyHex?: number;
  roiPct?: number;
  committedDays?: number;
  servedDays?: number;
  daysLate?: number;
  /** % of the stake already lost to the late-end penalty (overdue board). */
  penaltyPct?: number;
  daysToEnd?: number;
  startDay?: number;
  endDay?: number;
  timestamp?: number; // ms epoch
  liquidHex?: number;
  stakedHex?: number;
  totalHex?: number;
  label?: string | null;
}

const HEARTS = 1e8;
const TSHARE = 1e12;
export const heartsToHex = (h: string | number) => Number(h) / HEARTS;

const rank = (rows: Omit<LeaderRow, 'rank'>[]): LeaderRow[] =>
  rows.map((r, i) => ({ ...r, rank: i + 1 }));

export interface RawStart {
  stakeId: string; stakerAddr: string; stakedHearts: string; stakeShares: string;
  stakedDays: string; startDay: string; endDay: string; timestamp: string;
}
export interface RawEnd {
  stakeId: string; stakerAddr: string; payout: string; stakedHearts: string;
  penalty: string; servedDays: string; timestamp: string;
}

/** Top active stakes by principal (caller already excluded ended + sorted). */
export function activeByAmount(starts: RawStart[], currentDay: number, limit = 100): LeaderRow[] {
  return rank(
    starts.slice(0, limit).map((s) => ({
      address: s.stakerAddr.toLowerCase(),
      stakeId: s.stakeId,
      principalHex: heartsToHex(s.stakedHearts),
      tShares: Number(s.stakeShares) / TSHARE,
      startDay: Number(s.startDay),
      endDay: Number(s.endDay),
      daysToEnd: Math.max(0, Number(s.endDay) - currentDay),
    })),
  );
}

/**
 * Active stakes whose committed end day has already passed but that haven't
 * been ended yet — "overdue". HEX charges a late-end penalty after a 14-day
 * grace period that bleeds the stake at 1%/week (1/700 per day), reaching 100%
 * (nothing left) at 700 days past grace. We therefore drop stakes that are
 * fully penalised, keep only sizeable ones (≥ MIN_OVERDUE_HEX), and sort by the
 * largest stake first. `penaltyPct` is the share of the stake already lost.
 */
export const LATE_GRACE_DAYS = 14;
export const LATE_SCALE_DAYS = 700;
export const MIN_OVERDUE_HEX = 1_000_000;

export function activeOverdue(starts: RawStart[], currentDay: number, limit = 100): LeaderRow[] {
  return rank(
    starts
      .map((s) => {
        const principalHex = heartsToHex(s.stakedHearts);
        const late = currentDay - Number(s.endDay);
        const pastGrace = Math.max(0, late - LATE_GRACE_DAYS);
        const penaltyPct = Math.min(100, (pastGrace / LATE_SCALE_DAYS) * 100);
        return { s, principalHex, late, penaltyPct };
      })
      // Overdue, still worth something (not fully penalised), and sizeable.
      .filter((x) => x.late > 0 && x.penaltyPct < 100 && x.principalHex >= MIN_OVERDUE_HEX)
      // Largest overdue stake first.
      .sort((a, b) => b.principalHex - a.principalHex)
      .slice(0, limit)
      .map(({ s, principalHex, late, penaltyPct }) => ({
        address: s.stakerAddr.toLowerCase(),
        stakeId: s.stakeId,
        principalHex,
        tShares: Number(s.stakeShares) / TSHARE,
        committedDays: Number(s.stakedDays),
        startDay: Number(s.startDay),
        endDay: Number(s.endDay),
        daysLate: late,
        penaltyPct,
      })),
  );
}

/** Completed stakes sorted by principal, descending. */
export function completedByAmount(ends: RawEnd[], limit = 100): LeaderRow[] {
  return rank(
    [...ends]
      .sort((a, b) => Number(b.stakedHearts) - Number(a.stakedHearts))
      .slice(0, limit)
      .map((e) => endRow(e)),
  );
}

/** ROI = net payout (payout − penalty) / principal, descending. */
export function highestRoi(ends: RawEnd[], limit = 100): LeaderRow[] {
  const withRoi = ends
    .map((e) => {
      const principal = heartsToHex(e.stakedHearts);
      const net = heartsToHex(e.payout) - heartsToHex(e.penalty);
      return { e, principal, roiPct: principal > 0 ? (net / principal) * 100 : 0 };
    })
    .filter((x) => x.principal > 0 && Number.isFinite(x.roiPct))
    .sort((a, b) => b.roiPct - a.roiPct)
    .slice(0, limit);
  return rank(withRoi.map(({ e, roiPct }) => ({ ...endRow(e), roiPct })));
}

/**
 * Stakes that ended latest relative to their committed term. Needs the
 * committed `stakedDays` from the matching start (keyed by stakeId).
 */
export function mostDaysLate(ends: RawEnd[], committedById: Map<string, number>, limit = 100): LeaderRow[] {
  const rows = ends
    .map((e) => {
      const committed = committedById.get(String(e.stakeId));
      if (committed == null) return null;
      const served = Number(e.servedDays);
      return { e, committed, served, daysLate: served - committed };
    })
    .filter((x): x is { e: RawEnd; committed: number; served: number; daysLate: number } => !!x && x.daysLate > 0)
    .sort((a, b) => b.daysLate - a.daysLate)
    .slice(0, limit);
  return rank(rows.map(({ e, committed, daysLate }) => ({ ...endRow(e), committedDays: committed, daysLate })));
}

/** Most recent ends that paid a penalty (caller passes timestamp-desc ends). */
export function recentPenalties(ends: RawEnd[], limit = 100): LeaderRow[] {
  return rank(
    ends
      .filter((e) => Number(e.penalty) > 0)
      .slice(0, limit)
      .map((e) => endRow(e)),
  );
}

/** Most recent stake-starts (caller passes timestamp-desc starts). */
export function recentStarts(starts: RawStart[], limit = 100): LeaderRow[] {
  return rank(
    starts.slice(0, limit).map((s) => ({
      address: s.stakerAddr.toLowerCase(),
      stakeId: s.stakeId,
      principalHex: heartsToHex(s.stakedHearts),
      tShares: Number(s.stakeShares) / TSHARE,
      committedDays: Number(s.stakedDays),
      startDay: Number(s.startDay),
      endDay: Number(s.endDay),
      timestamp: Number(s.timestamp) * 1000,
    })),
  );
}

/** Most recent stake-ends (caller passes timestamp-desc ends). */
export function recentEnds(ends: RawEnd[], limit = 100): LeaderRow[] {
  return rank(ends.slice(0, limit).map((e) => endRow(e)));
}

/** Merge liquid balances with aggregated staked totals; rank by the sum. */
export function topHolders(
  liquid: { address: string; balanceHex: number; label: string | null }[],
  staked: { address: string; stakedHex: number }[],
  limit = 100,
): LeaderRow[] {
  const m = new Map<string, { liquid: number; staked: number; label: string | null }>();
  for (const h of liquid) {
    const a = h.address.toLowerCase();
    const e = m.get(a) ?? { liquid: 0, staked: 0, label: null };
    e.liquid += h.balanceHex;
    e.label = e.label ?? h.label;
    m.set(a, e);
  }
  for (const s of staked) {
    const a = s.address.toLowerCase();
    const e = m.get(a) ?? { liquid: 0, staked: 0, label: null };
    e.staked += s.stakedHex;
    m.set(a, e);
  }
  return rank(
    [...m.entries()]
      .map(([address, v]) => ({
        address,
        liquidHex: v.liquid,
        stakedHex: v.staked,
        totalHex: v.liquid + v.staked,
        label: v.label,
      }))
      .sort((a, b) => b.totalHex - a.totalHex)
      .slice(0, limit),
  );
}

/** Sum active staked hearts by staker (for the holders board). */
export function aggregateStaked(starts: RawStart[]): { address: string; stakedHex: number }[] {
  const m = new Map<string, number>();
  for (const s of starts) {
    const a = s.stakerAddr.toLowerCase();
    m.set(a, (m.get(a) ?? 0) + heartsToHex(s.stakedHearts));
  }
  return [...m.entries()].map(([address, stakedHex]) => ({ address, stakedHex }));
}

function endRow(e: RawEnd): Omit<LeaderRow, 'rank'> {
  return {
    address: e.stakerAddr.toLowerCase(),
    stakeId: e.stakeId,
    principalHex: heartsToHex(e.stakedHearts),
    payoutHex: heartsToHex(e.payout),
    penaltyHex: heartsToHex(e.penalty),
    servedDays: Number(e.servedDays),
    timestamp: Number(e.timestamp) * 1000,
  };
}
