// One row per HEX day — the macro spine.
//
// WHY THIS EXISTS
// Every macro figure the Strategist shows was a single live number with no
// yesterday to compare against, so "total penalties" and "24h / 7d / 30d
// change" were unanswerable without re-sweeping the subgraph on every request.
// The chain publishes both halves of the answer already:
//
//   dailyDataUpdates — one record per day since day 1, carrying the day's
//     minted payout, the share total it was paid across, and the resulting
//     payout per T-Share. Complete history in three paged queries.
//
//   globalInfos — a snapshot written many times a day (~33 on a recent day),
//     carrying locked hearts, total supply, the share rate and the penalty
//     pool. Only the LAST one of each day is kept here; the intraday ones say
//     nothing a daily series needs.
//
// The two sources fill different columns of the same row, and each advances on
// its own cursor, so a day can exist with one half populated while the other
// is still catching up. Columns are therefore nullable and readers must treat
// null as "not indexed yet" rather than zero — for money figures those are
// very different claims.

import { sql } from './connection';
import type { Net } from './hexLockedStakes';

export const DAILY_DDL = [
  `CREATE TABLE IF NOT EXISTS hex_daily (
     network            VARCHAR(16) NOT NULL,
     hex_day            INTEGER     NOT NULL,
     -- From dailyDataUpdates: what the contract minted to stakers that day.
     payout_hearts      NUMERIC(40,0),
     -- T-Shares the payout was divided across, as of that day.
     shares             NUMERIC(40,0),
     -- Unconstrained scale on purpose: the subgraph returns this with 30+
     -- decimal places and rounding it would quietly change a yield chart.
     payout_per_tshare  NUMERIC,
     -- From the last globalInfo of the day.
     locked_hearts      NUMERIC(40,0),
     total_supply       NUMERIC(40,0),
     penalty_total      NUMERIC(40,0),
     -- stakeSharesTotal from the same snapshot. dailyDataUpdates carries the
     -- share total too, but it lags a day or two, so without this the current
     -- day has no T-Share figure and every delta against it reads n/a.
     shares_total       NUMERIC(40,0),
     share_rate         NUMERIC(20,6),
     snapshot_ts        BIGINT,
     PRIMARY KEY (network, hex_day)
   )`,
  `ALTER TABLE hex_daily ADD COLUMN IF NOT EXISTS shares_total NUMERIC(40,0)`,
  `CREATE INDEX IF NOT EXISTS idx_hex_daily_day ON hex_daily (network, hex_day DESC)`,
  `CREATE TABLE IF NOT EXISTS hex_daily_state (
     network       VARCHAR(16) PRIMARY KEY,
     -- Highest day already taken from dailyDataUpdates.
     last_data_day INTEGER     NOT NULL DEFAULT 0,
     -- Newest globalInfo timestamp already folded in.
     last_info_ts  BIGINT      NOT NULL DEFAULT 0,
     last_run_at   TIMESTAMPTZ,
     last_error    TEXT
   )`,
];

export interface DailyDataRow {
  hexDay: number;
  payoutHearts: string;
  shares: string;
  payoutPerTShare: string;
}

export interface DailyInfoRow {
  hexDay: number;
  lockedHearts: string;
  totalSupply: string;
  penaltyTotal: string;
  shareRate: string;
  sharesTotal: string;
  snapshotTs: number;
}

export interface DailyState {
  lastDataDay: number;
  lastInfoTs: number;
}

const n = (v: unknown) => (v == null ? 0 : Number(v));

export async function initDailyState(net: Net): Promise<void> {
  if (!sql) throw new Error('No database configured');
  await sql`INSERT INTO hex_daily_state (network) VALUES (${net}) ON CONFLICT (network) DO NOTHING`;
}

export async function getDailyState(net: Net): Promise<DailyState | null> {
  if (!sql) return null;
  try {
    const rows = await sql`SELECT last_data_day, last_info_ts FROM hex_daily_state WHERE network = ${net}`;
    if (!rows.length) return null;
    return { lastDataDay: n(rows[0].last_data_day), lastInfoTs: n(rows[0].last_info_ts) };
  } catch (err) {
    // The table not existing yet is a normal pre-migration state, not a fault.
    if (String((err as { code?: string })?.code) === '42P01') return null;
    throw err;
  }
}

export async function saveDailyState(
  net: Net, p: { lastDataDay?: number; lastInfoTs?: number; error?: string | null },
): Promise<void> {
  if (!sql) throw new Error('No database configured');
  await sql`
    UPDATE hex_daily_state SET
      last_data_day = COALESCE(${p.lastDataDay ?? null}, last_data_day),
      last_info_ts  = COALESCE(${p.lastInfoTs ?? null}, last_info_ts),
      last_run_at   = now(),
      last_error    = ${p.error === undefined ? null : p.error}
    WHERE network = ${net}`;
}

/**
 * Rewind both cursors so the next run re-reads all of history.
 *
 * Adding a column sourced from globalInfos leaves every existing row null in
 * it, and the cursor means those snapshots are never read again. The whole
 * sweep is only a few thousand records, so unlike the stake mirror this is
 * cheap enough to simply redo — a couple of runs and about thirty seconds.
 */
export async function resetDailyForRefill(net: Net): Promise<void> {
  if (!sql) throw new Error('No database configured');
  await sql`UPDATE hex_daily_state SET last_data_day = 0, last_info_ts = 0 WHERE network = ${net}`;
}

/** The dailyDataUpdates half of a day. Never touches the globalInfo columns. */
export async function upsertDailyData(net: Net, rows: DailyDataRow[]): Promise<number> {
  if (!sql || !rows.length) return 0;
  await sql`
    INSERT INTO hex_daily (network, hex_day, payout_hearts, shares, payout_per_tshare)
    SELECT ${net}, * FROM UNNEST(
      ${rows.map((r) => r.hexDay)}::int[], ${rows.map((r) => r.payoutHearts)}::numeric[],
      ${rows.map((r) => r.shares)}::numeric[], ${rows.map((r) => r.payoutPerTShare)}::numeric[]
    )
    ON CONFLICT (network, hex_day) DO UPDATE SET
      payout_hearts     = EXCLUDED.payout_hearts,
      shares            = EXCLUDED.shares,
      payout_per_tshare = EXCLUDED.payout_per_tshare`;
  return rows.length;
}

/**
 * The globalInfo half of a day.
 *
 * Guarded by snapshot_ts so a later run cannot overwrite a day's closing
 * snapshot with an earlier one — pages arrive oldest-first, and a retry after a
 * partial failure can replay a timestamp already folded in.
 */
export async function upsertDailyInfo(net: Net, rows: DailyInfoRow[]): Promise<number> {
  if (!sql || !rows.length) return 0;
  await sql`
    INSERT INTO hex_daily (
      network, hex_day, locked_hearts, total_supply, penalty_total, share_rate, shares_total, snapshot_ts)
    SELECT ${net}, * FROM UNNEST(
      ${rows.map((r) => r.hexDay)}::int[], ${rows.map((r) => r.lockedHearts)}::numeric[],
      ${rows.map((r) => r.totalSupply)}::numeric[], ${rows.map((r) => r.penaltyTotal)}::numeric[],
      ${rows.map((r) => r.shareRate)}::numeric[], ${rows.map((r) => r.sharesTotal)}::numeric[],
      ${rows.map((r) => r.snapshotTs)}::bigint[]
    )
    ON CONFLICT (network, hex_day) DO UPDATE SET
      locked_hearts = EXCLUDED.locked_hearts,
      total_supply  = EXCLUDED.total_supply,
      penalty_total = EXCLUDED.penalty_total,
      share_rate    = EXCLUDED.share_rate,
      shares_total  = EXCLUDED.shares_total,
      snapshot_ts   = EXCLUDED.snapshot_ts
    WHERE EXCLUDED.snapshot_ts >= COALESCE(hex_daily.snapshot_ts, 0)`;
  return rows.length;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface DailyPoint {
  day: number;
  /** HEX minted to stakers that day. Null until the day is indexed. */
  payoutHex: number | null;
  tShares: number | null;
  payoutPerTShare: number | null;
  lockedHex: number | null;
  supplyHex: number | null;
  penaltyPoolHex: number | null;
  shareRate: number | null;
}

const HEARTS = 1e8;
const hx = (v: unknown) => (v == null ? null : Number(v) / HEARTS);
const fl = (v: unknown) => (v == null ? null : Number(v));

/** The series, oldest first. `days` counts back from the newest indexed day. */
export async function readDailySeries(net: Net, days = 30): Promise<DailyPoint[]> {
  if (!sql) return [];
  const rows = await sql`
    SELECT hex_day, payout_hearts, shares, shares_total, payout_per_tshare,
           locked_hearts, total_supply, penalty_total, share_rate
    FROM hex_daily WHERE network = ${net}
    ORDER BY hex_day DESC LIMIT ${days}`;
  return rows
    .map((r: Record<string, unknown>) => ({
      day: Number(r.hex_day),
      payoutHex: hx(r.payout_hearts),
      // Prefer the day's closing globalInfo snapshot; fall back to the daily
      // update's share total for historical days indexed before that column
      // existed. Both are raw shares, so both divide by 1e12 to reach T-Shares.
      tShares: r.shares_total != null ? Number(r.shares_total) / 1e12
        : r.shares != null ? Number(r.shares) / 1e12 : null,
      payoutPerTShare: fl(r.payout_per_tshare),
      lockedHex: hx(r.locked_hearts),
      supplyHex: hx(r.total_supply),
      penaltyPoolHex: hx(r.penalty_total),
      shareRate: fl(r.share_rate),
    }))
    .reverse();
}

export interface Change {
  now: number | null;
  then: number | null;
  /** Absolute move. Null when either end is unindexed. */
  delta: number | null;
  /** Percent move, null when `then` is zero or missing. */
  pct: number | null;
}

const change = (now: number | null, then: number | null): Change => ({
  now,
  then,
  delta: now == null || then == null ? null : now - then,
  // A percentage against a zero base is not 0% or infinity, it is undefined —
  // and this is money, so it is reported as unknown rather than invented.
  pct: now == null || then == null || then === 0 ? null : ((now - then) / then) * 100,
});

export type DailyMetric =
  | 'lockedHex' | 'supplyHex' | 'penaltyPoolHex' | 'tShares' | 'payoutPerTShare' | 'shareRate';

export interface WindowChanges {
  latestDay: number | null;
  windows: Record<'24h' | '7d' | '30d', Partial<Record<DailyMetric, Change>>>;
  /** Sum of HEX minted to stakers over each window. */
  mintedHex: Record<'24h' | '7d' | '30d', number | null>;
  /**
   * Newest day that has a daily update, which the minted sums are anchored to.
   * The contract writes a day's update when the day CLOSES, so this trails
   * `latestDay` by a day or two and the UI should say "through day N" rather
   * than implying the flow figures run to this minute.
   */
  mintedThroughDay: number | null;
}

/**
 * Metrics split by source, because the two sources sit at different days.
 *
 * Snapshot metrics come from the day's closing globalInfo and are current.
 * Daily metrics come from dailyDataUpdates, which the contract writes when a
 * day CLOSES, so the newest one or two days have none — comparing those
 * against `latest` would report n/a forever. They are anchored to the newest
 * day that actually has an update instead.
 */
const SNAPSHOT_METRICS: DailyMetric[] = [
  'lockedHex', 'supplyHex', 'penaltyPoolHex', 'tShares', 'shareRate',
];
const DAILY_METRICS: DailyMetric[] = ['payoutPerTShare'];

/**
 * Every macro figure with its 24h / 7d / 30d move, from one 31-row read.
 *
 * A HEX day is exactly 24 hours, so the windows are day offsets rather than
 * wall-clock arithmetic: 1, 7 and 30 days back from the newest indexed day.
 * When the series does not reach that far back the comparison is null rather
 * than silently anchored to the oldest row available, which would report a
 * two-year move as a 30-day one.
 */
export async function readWindowChanges(net: Net): Promise<WindowChanges> {
  // 34 rather than 31: the minted anchor can sit a couple of days back, and a
  // 30-day window ending there still needs its oldest day inside the read.
  const series = await readDailySeries(net, 34);
  if (!series.length) {
    return {
      latestDay: null,
      windows: { '24h': {}, '7d': {}, '30d': {} },
      mintedHex: { '24h': null, '7d': null, '30d': null },
      mintedThroughDay: null,
    };
  }
  const latest = series[series.length - 1];
  const byDay = new Map(series.map((p) => [p.day, p]));
  const back = (n: number) => byDay.get(latest.day - n) ?? null;

  // Newest day carrying a daily update — the flow figures hang off this.
  const withPayout = series.filter((p) => p.payoutHex != null);
  const mintedAnchor = withPayout.length ? withPayout[withPayout.length - 1].day : null;

  const windows = { '24h': {}, '7d': {}, '30d': {} } as WindowChanges['windows'];
  const minted = { '24h': null, '7d': null, '30d': null } as WindowChanges['mintedHex'];

  for (const [key, n] of [['24h', 1], ['7d', 7], ['30d', 30]] as const) {
    const prev = back(n);
    for (const m of SNAPSHOT_METRICS) windows[key][m] = change(latest[m], prev ? prev[m] : null);

    // Daily-sourced metrics measured from the anchor day back, not from today.
    const anchorPoint = mintedAnchor == null ? null : byDay.get(mintedAnchor) ?? null;
    const anchorPrev = mintedAnchor == null ? null : byDay.get(mintedAnchor - n) ?? null;
    for (const m of DAILY_METRICS) {
      windows[key][m] = change(anchorPoint ? anchorPoint[m] : null, anchorPrev ? anchorPrev[m] : null);
    }
    // Minted is a flow, not a level: sum the days in the window rather than
    // differencing two snapshots. Anchored to the newest day that HAS a daily
    // update, because the current day never does — anchoring to `latest` would
    // make every window permanently null.
    if (mintedAnchor != null) {
      const span = series.filter(
        (p) => p.day > mintedAnchor - n && p.day <= mintedAnchor && p.payoutHex != null,
      );
      // Report a sum only when the window is genuinely whole. HEX has real
      // gaps — days 1255 and 1256 have no daily update at all — and a short
      // sum presented as a 30-day total understates it without saying so.
      minted[key] = span.length === n ? span.reduce((s, p) => s + (p.payoutHex ?? 0), 0) : null;
    }
  }
  return { latestDay: latest.day, windows, mintedHex: minted, mintedThroughDay: mintedAnchor };
}
