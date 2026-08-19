// The locked-HEX-stake mirror: the complete set of stakes currently locked on
// chain, kept current by the hex-stake-sync cron and read by the Strategist's
// macro views.
//
// WHY A SEPARATE TABLE FROM pulsechain_stake_starts
// That table belongs to PulsechainSyncService, and its `is_active` column means
// "not yet past its end day" — a different question from "still locked". A
// matured stake nobody has ended is still locked and still holds its shares,
// while a stake ended or good-accounted early is not, whatever its end day
// says. Measured against the subgraph, 19.4% of the HEX sitting in
// future-dated stakes has already been withdrawn early, so reusing that column
// would silently overstate every macro figure — and redefining it would break
// the dashboard that reads it.
//
// This table holds stakes that still hold HEX. A row is deleted the moment its
// stake is ENDED; a good-accounted stake is kept and flagged, because
// good-accounting returns the shares to the network but leaves the principal
// in the contract until someone ends it. On PulseChain that is 17,276 stakes
// holding 40.3B HEX — 6.5% of locked supply — which belongs in the unlock
// schedule and not in any T-Share ranking. That keeps the table near 360k rows
// rather than the ~950k stakes ever opened.

import { sql } from './connection';

export type Net = 'pulsechain' | 'ethereum';

/** Whether a database is configured at all. Without one the macro views have
 *  nothing to read and say so — they do not have a second data path. */
export const dbAvailable = () => !!sql;

const DDL = [
  `CREATE TABLE IF NOT EXISTS hex_locked_stakes (
     network       VARCHAR(16)   NOT NULL,
     stake_id      BIGINT        NOT NULL,
     staker_addr   VARCHAR(42)   NOT NULL,
     staked_hearts NUMERIC(40,0) NOT NULL,
     stake_shares  NUMERIC(40,0) NOT NULL,
     end_day       INTEGER       NOT NULL,
     -- Shares already returned to the network; the HEX is still due.
     good_accounted BOOLEAN      NOT NULL DEFAULT FALSE,
     PRIMARY KEY (network, stake_id)
   )`,
  `ALTER TABLE hex_locked_stakes ADD COLUMN IF NOT EXISTS good_accounted BOOLEAN NOT NULL DEFAULT FALSE`,
  `CREATE INDEX IF NOT EXISTS idx_hex_locked_end_day ON hex_locked_stakes (network, end_day)`,
  `CREATE INDEX IF NOT EXISTS idx_hex_locked_staker ON hex_locked_stakes (network, staker_addr)`,
  `CREATE INDEX IF NOT EXISTS idx_hex_locked_shares ON hex_locked_stakes (network, stake_shares DESC)`,
  `CREATE TABLE IF NOT EXISTS hex_sync_state (
     network         VARCHAR(16) PRIMARY KEY,
     phase           VARCHAR(16) NOT NULL DEFAULT 'fill',
     last_stake_id   BIGINT      NOT NULL DEFAULT 0,
     -- Highest stakeId that exists on chain, so progress through the initial
     -- fill is a real percentage rather than a spinner.
     latest_stake_id BIGINT      NOT NULL DEFAULT 0,
     last_end_ts     BIGINT      NOT NULL DEFAULT 0,
     last_ga_ts      BIGINT      NOT NULL DEFAULT 0,
     ready           BOOLEAN     NOT NULL DEFAULT FALSE,
     network_tshares NUMERIC(40,6),
     network_hex     NUMERIC(40,8),
     locked_stakes   INTEGER     NOT NULL DEFAULT 0,
     last_run_at     TIMESTAMPTZ,
     completed_at    TIMESTAMPTZ,
     last_error      TEXT
   )`,
  // CREATE TABLE IF NOT EXISTS is a no-op against a table that already exists,
  // so a deploy that adds a column would silently keep the old shape and fail
  // on first write. Every column is therefore also added idempotently.
  `ALTER TABLE hex_sync_state ADD COLUMN IF NOT EXISTS latest_stake_id BIGINT NOT NULL DEFAULT 0`,
  `ALTER TABLE hex_sync_state ADD COLUMN IF NOT EXISTS last_end_ts BIGINT NOT NULL DEFAULT 0`,
  `ALTER TABLE hex_sync_state ADD COLUMN IF NOT EXISTS last_ga_ts BIGINT NOT NULL DEFAULT 0`,
  `ALTER TABLE hex_sync_state ADD COLUMN IF NOT EXISTS network_tshares NUMERIC(40,6)`,
  `ALTER TABLE hex_sync_state ADD COLUMN IF NOT EXISTS network_hex NUMERIC(40,8)`,
  `ALTER TABLE hex_sync_state ADD COLUMN IF NOT EXISTS locked_stakes INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE hex_sync_state ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ`,
  `ALTER TABLE hex_sync_state ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`,
  `ALTER TABLE hex_sync_state ADD COLUMN IF NOT EXISTS last_error TEXT`,
];

export async function ensureSchema(): Promise<void> {
  if (!sql) throw new Error('No database configured');
  // Plain-string statements must go through .query() — @neondatabase/serverless
  // v1 only accepts the tagged-template form when `sql` is called directly.
  // Same pattern as lib/screener/db.ts, which runs its DDL this way in prod.
  for (const stmt of DDL) await sql.query(stmt);
}

// ---------------------------------------------------------------------------
// Sync state
// ---------------------------------------------------------------------------

/**
 * `fill` walks every stake ever opened and stores the ones still locked;
 * `live` is the cheap incremental steady state. `ready` flips true when the
 * fill completes; until then readers report indexing progress rather than
 * serving a partial chain.
 */
export type SyncPhase = 'fill' | 'live';

export interface SyncState {
  network: Net;
  phase: SyncPhase;
  lastStakeId: number;
  latestStakeId: number;
  lastEndTs: number;
  lastGaTs: number;
  ready: boolean;
  networkTShares: number | null;
  networkHex: number | null;
  lockedStakes: number;
  lastRunAt: string | null;
  completedAt: string | null;
  lastError: string | null;
}

const num = (v: unknown, d = 0) => (v == null ? d : Number(v));

/** Postgres 42P01 — the table hasn't been created yet. Only the sync cron runs
 *  the DDL, so before its first run this is the normal state of a fresh
 *  database, not an error: readers treat it as "indexing hasn't started". */
const isMissingTable = (err: unknown) =>
  (err as { code?: string })?.code === '42P01' ||
  /relation .* does not exist/i.test(err instanceof Error ? err.message : '');

export async function getSyncState(net: Net): Promise<SyncState | null> {
  if (!sql) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the driver itself is untyped (`sql: any`)
  let rows: any[];
  try {
    rows = await sql`SELECT * FROM hex_sync_state WHERE network = ${net}`;
  } catch (err) {
    if (isMissingTable(err)) return null;
    throw err;
  }
  const r = rows[0];
  if (!r) return null;
  return {
    network: net,
    phase: (r.phase ?? 'fill') as SyncPhase,
    lastStakeId: num(r.last_stake_id),
    latestStakeId: num(r.latest_stake_id),
    lastEndTs: num(r.last_end_ts),
    lastGaTs: num(r.last_ga_ts),
    ready: !!r.ready,
    networkTShares: r.network_tshares == null ? null : Number(r.network_tshares),
    networkHex: r.network_hex == null ? null : Number(r.network_hex),
    lockedStakes: num(r.locked_stakes),
    lastRunAt: r.last_run_at ?? null,
    completedAt: r.completed_at ?? null,
    lastError: r.last_error ?? null,
  };
}

export async function initSyncState(net: Net): Promise<void> {
  if (!sql) throw new Error('No database configured');
  await sql`INSERT INTO hex_sync_state (network) VALUES (${net}) ON CONFLICT (network) DO NOTHING`;
}

export interface SyncStatePatch {
  phase?: SyncPhase;
  lastStakeId?: number;
  latestStakeId?: number;
  lastEndTs?: number;
  lastGaTs?: number;
  ready?: boolean;
  networkTShares?: number;
  networkHex?: number;
  lockedStakes?: number;
  completed?: boolean;
  error?: string | null;
}

/** Patch the sync cursors. COALESCE keeps every field the caller didn't pass. */
export async function saveSyncState(net: Net, p: SyncStatePatch): Promise<void> {
  if (!sql) throw new Error('No database configured');
  await sql`
    UPDATE hex_sync_state SET
      phase           = COALESCE(${p.phase ?? null}, phase),
      last_stake_id   = COALESCE(${p.lastStakeId ?? null}, last_stake_id),
      latest_stake_id = COALESCE(${p.latestStakeId ?? null}, latest_stake_id),
      last_end_ts     = COALESCE(${p.lastEndTs ?? null}, last_end_ts),
      last_ga_ts      = COALESCE(${p.lastGaTs ?? null}, last_ga_ts),
      ready           = COALESCE(${p.ready ?? null}, ready),
      network_tshares = COALESCE(${p.networkTShares ?? null}, network_tshares),
      network_hex     = COALESCE(${p.networkHex ?? null}, network_hex),
      locked_stakes   = COALESCE(${p.lockedStakes ?? null}, locked_stakes),
      last_run_at     = now(),
      completed_at    = CASE WHEN ${p.completed ?? false} THEN now() ELSE completed_at END,
      last_error      = ${p.error === undefined ? null : p.error}
    WHERE network = ${net}`;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface StakeRow {
  stakeId: string;
  stakerAddr: string;
  stakedHearts: string;
  stakeShares: string;
  endDay: string;
  goodAccounted?: boolean;
}

/**
 * Bulk upsert. One statement per batch via UNNEST rather than a row per
 * round trip — the hearts/shares columns stay strings the whole way so the
 * 20-digit contract values are never squeezed through a JS number.
 */
export async function upsertStakes(net: Net, rows: StakeRow[]): Promise<number> {
  if (!sql || !rows.length) return 0;
  const ids = rows.map((r) => r.stakeId);
  const addrs = rows.map((r) => r.stakerAddr.toLowerCase());
  const hearts = rows.map((r) => r.stakedHearts);
  const shares = rows.map((r) => r.stakeShares);
  const days = rows.map((r) => Number(r.endDay));
  const ga = rows.map((r) => !!r.goodAccounted);
  await sql`
    INSERT INTO hex_locked_stakes (network, stake_id, staker_addr, staked_hearts, stake_shares, end_day, good_accounted)
    SELECT ${net}, * FROM UNNEST(
      ${ids}::bigint[], ${addrs}::text[], ${hearts}::numeric[], ${shares}::numeric[], ${days}::int[], ${ga}::boolean[]
    )
    ON CONFLICT (network, stake_id) DO UPDATE SET
      staker_addr    = EXCLUDED.staker_addr,
      staked_hearts  = EXCLUDED.staked_hearts,
      stake_shares   = EXCLUDED.stake_shares,
      end_day        = EXCLUDED.end_day,
      -- Never un-flag: good-accounting is one-way until the stake ends.
      good_accounted = hex_locked_stakes.good_accounted OR EXCLUDED.good_accounted`;
  return rows.length;
}

/** Drop stakes that have been ENDED — principal withdrawn. Idempotent. */
export async function removeStakes(net: Net, stakeIds: string[]): Promise<number> {
  if (!sql || !stakeIds.length) return 0;
  const rows = await sql`
    DELETE FROM hex_locked_stakes
    WHERE network = ${net} AND stake_id = ANY(${stakeIds}::bigint[])
    RETURNING stake_id`;
  return rows.length;
}

/** Flag stakes whose shares have gone back to the network. Idempotent. */
export async function markGoodAccounted(net: Net, stakeIds: string[]): Promise<number> {
  if (!sql || !stakeIds.length) return 0;
  const rows = await sql`
    UPDATE hex_locked_stakes SET good_accounted = TRUE
    WHERE network = ${net} AND stake_id = ANY(${stakeIds}::bigint[]) AND NOT good_accounted
    RETURNING stake_id`;
  return rows.length;
}

export async function countLocked(net: Net): Promise<number> {
  if (!sql) return 0;
  const rows = await sql`SELECT count(*)::int AS n FROM hex_locked_stakes WHERE network = ${net}`;
  return num(rows[0]?.n);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface DbBucket { day: number; hex: number; tShares: number; stakes: number }

/** Locked stakes whose shares are gone but whose HEX is still due. */
export async function readFrozen(net: Net): Promise<{ hex: number; stakes: number }> {
  if (!sql) return { hex: 0, stakes: 0 };
  const rows = await sql`
    SELECT COALESCE(SUM(staked_hearts) / 1e8, 0)::float8 AS hex, count(*)::int AS stakes
    FROM hex_locked_stakes WHERE network = ${net} AND good_accounted`;
  return { hex: num(rows[0]?.hex), stakes: num(rows[0]?.stakes) };
}

/** Every locked stake grouped by the day it matures. */
export async function readSchedule(net: Net): Promise<DbBucket[]> {
  if (!sql) return [];
  const rows = await sql`
    SELECT end_day,
           (SUM(staked_hearts) / 1e8)::float8  AS hex,
           (SUM(stake_shares) FILTER (WHERE NOT good_accounted) / 1e12)::float8 AS tshares,
           count(*)::int                       AS stakes
    FROM hex_locked_stakes
    WHERE network = ${net}
    GROUP BY end_day
    ORDER BY end_day`;
  return rows.map((r: Record<string, unknown>) => ({
    day: num(r.end_day),
    hex: num(r.hex),
    tShares: num(r.tshares),
    stakes: num(r.stakes),
  }));
}

export interface DbStakerTotal { address: string; tShares: number; hex: number; stakes: number }

/** The biggest locked positions, by T-Shares. */
export async function readTopStakers(net: Net, limit: number): Promise<DbStakerTotal[]> {
  if (!sql) return [];
  const rows = await sql`
    SELECT staker_addr,
           (SUM(stake_shares)  / 1e12)::float8 AS tshares,
           (SUM(staked_hearts) / 1e8)::float8  AS hex,
           count(*)::int                       AS stakes
    FROM hex_locked_stakes
    WHERE network = ${net} AND NOT good_accounted
    GROUP BY staker_addr
    ORDER BY SUM(stake_shares) DESC
    LIMIT ${limit}`;
  return rows.map((r: Record<string, unknown>) => ({
    address: String(r.staker_addr),
    tShares: num(r.tshares),
    hex: num(r.hex),
    stakes: num(r.stakes),
  }));
}

export interface StakerSummary { stakers: number; tShares: number }

export async function readStakerSummary(net: Net): Promise<StakerSummary> {
  if (!sql) return { stakers: 0, tShares: 0 };
  const rows = await sql`
    SELECT count(DISTINCT staker_addr)::int      AS stakers,
           (SUM(stake_shares) / 1e12)::float8    AS tshares
    FROM hex_locked_stakes WHERE network = ${net} AND NOT good_accounted`;
  return { stakers: num(rows[0]?.stakers), tShares: num(rows[0]?.tshares) };
}

/**
 * How many stakers sit at or above each T-Share floor. Counted in the database
 * rather than by pulling every staker across the wire — there are far more
 * stakers than the board ever shows, and only the counts are needed.
 * Returns one cumulative count per floor, in the order the floors were given.
 */
export async function readFloorCounts(net: Net, floors: number[]): Promise<number[]> {
  if (!sql || !floors.length) return floors.map(() => 0);
  const rows = await sql`
    SELECT f.idx, count(t.total)::int AS n
    FROM UNNEST(${floors}::float8[]) WITH ORDINALITY AS f(floor, idx)
    LEFT JOIN (
      SELECT (SUM(stake_shares) / 1e12)::float8 AS total
      FROM hex_locked_stakes WHERE network = ${net} AND NOT good_accounted
      GROUP BY staker_addr
    ) t ON t.total >= f.floor
    GROUP BY f.idx
    ORDER BY f.idx`;
  const out = floors.map(() => 0);
  for (const r of rows) out[num(r.idx) - 1] = num(r.n);
  return out;
}
