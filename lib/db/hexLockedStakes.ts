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
import { DAILY_DDL } from './hexDaily';
import { ENDS_DDL } from './hexStakeEnds';

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
  // The time axis. These ride in on the same stakeStarts records the sync
  // already pages through, and without them the mirror can say who holds what
  // but never how old a stake is, how long its term was, or how much of it has
  // been served. Nullable because rows written before this migration have no
  // values until the next full refill backfills them.
  `ALTER TABLE hex_locked_stakes ADD COLUMN IF NOT EXISTS start_day INTEGER`,
  `ALTER TABLE hex_locked_stakes ADD COLUMN IF NOT EXISTS staked_days INTEGER`,
  `ALTER TABLE hex_locked_stakes ADD COLUMN IF NOT EXISTS started_at BIGINT`,
  `ALTER TABLE hex_locked_stakes ADD COLUMN IF NOT EXISTS is_auto_stake BOOLEAN`,
  `CREATE INDEX IF NOT EXISTS idx_hex_locked_start_day ON hex_locked_stakes (network, start_day)`,
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
  // The per-day macro spine. Same migration path as everything else here:
  // one ensureSchema call creates or updates every table the sync touches.
  ...DAILY_DDL,
  ...ENDS_DDL,
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

/**
 * Send the sync back to the start of the stake list without dropping a row.
 *
 * Two things need this. A schema migration that adds columns leaves every
 * existing row null in them, and the live phase only ever looks at stake ids
 * ABOVE its cursor, so those rows would never be revisited. Separately, if the
 * cron stops firing for a while the mirror drifts — stakes end and are never
 * removed — and a full re-sweep is the only thing that reconciles it.
 *
 * `ready` is deliberately left alone. The existing rows are still true while
 * the sweep runs, so the public views keep serving from them instead of
 * showing an indexing notice for the length of a refill.
 */
export async function resetForRefill(net: Net): Promise<void> {
  await saveSyncState(net, { phase: 'fill', lastStakeId: 0 });
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
  /** The time axis — optional so a caller without it cannot be blocked, and
   *  COALESCE in the upsert keeps a null from erasing a filled column. */
  startDay?: string;
  stakedDays?: string;
  /** Unix seconds the stake was opened. */
  timestamp?: string;
  isAutoStake?: boolean;
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
  // A stake's own facts never change after it opens, but a row written before
  // the time columns existed has nulls, so these are written on conflict too —
  // that is what backfills the mirror as the sync sweeps back over it.
  const startDays = rows.map((r) => (r.startDay == null ? null : Number(r.startDay)));
  const stakedDays = rows.map((r) => (r.stakedDays == null ? null : Number(r.stakedDays)));
  const startedAt = rows.map((r) => (r.timestamp == null ? null : Number(r.timestamp)));
  const auto = rows.map((r) => (r.isAutoStake == null ? null : !!r.isAutoStake));
  await sql`
    INSERT INTO hex_locked_stakes (
      network, stake_id, staker_addr, staked_hearts, stake_shares, end_day, good_accounted,
      start_day, staked_days, started_at, is_auto_stake)
    SELECT ${net}, * FROM UNNEST(
      ${ids}::bigint[], ${addrs}::text[], ${hearts}::numeric[], ${shares}::numeric[], ${days}::int[], ${ga}::boolean[],
      ${startDays}::int[], ${stakedDays}::int[], ${startedAt}::bigint[], ${auto}::boolean[]
    )
    ON CONFLICT (network, stake_id) DO UPDATE SET
      staker_addr    = EXCLUDED.staker_addr,
      staked_hearts  = EXCLUDED.staked_hearts,
      stake_shares   = EXCLUDED.stake_shares,
      end_day        = EXCLUDED.end_day,
      -- COALESCE so a payload without the time fields cannot blank a row that
      -- already has them.
      start_day      = COALESCE(EXCLUDED.start_day, hex_locked_stakes.start_day),
      staked_days    = COALESCE(EXCLUDED.staked_days, hex_locked_stakes.staked_days),
      started_at     = COALESCE(EXCLUDED.started_at, hex_locked_stakes.started_at),
      is_auto_stake  = COALESCE(EXCLUDED.is_auto_stake, hex_locked_stakes.is_auto_stake),
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

export interface RescueRow {
  stakeId: string;
  stakerAddr: string;
  stakedHearts: string;
  endDay: number;
}

/**
 * Matured, unended, not-yet-good-accounted stakes above a principal floor —
 * biggest first. Returns null when there is no database or the mirror is still
 * filling, so a caller can fall back rather than act on a partial table.
 *
 * This is the query the subgraph cannot answer. A stakeStart carries no "has
 * this ended" flag, so finding open stakes there means fetching everything and
 * subtracting the ends locally, which no bounded page window can do honestly:
 * ordered by end day it drops the oldest and largest stakes, and ordered by
 * size it fills up with whales who ended their own stakes and surfaces nothing.
 * This table only ever holds LOCKED stakes — `removeStakes` deletes them the
 * moment they end — so "biggest first" is finally the right ordering rather
 * than a trap, and the answer is complete instead of a sample.
 */
export async function readRescueCandidates(
  net: Net,
  opts: { maturedBefore: number; minHearts: string; limit: number },
): Promise<RescueRow[] | null> {
  if (!sql) return null;
  const state = await getSyncState(net);
  // A half-filled mirror would look like a short list of candidates rather than
  // an error, which is exactly the kind of quietly-wrong answer to refuse.
  if (!state?.ready) return null;

  const rows = await sql`
    SELECT stake_id::text      AS stake_id,
           staker_addr,
           staked_hearts::text AS staked_hearts,
           end_day
    FROM hex_locked_stakes
    WHERE network = ${net}
      AND NOT good_accounted
      AND end_day < ${opts.maturedBefore}
      AND staked_hearts >= ${opts.minHearts}::numeric
    ORDER BY staked_hearts DESC
    LIMIT ${opts.limit}`;

  return rows.map((r: any) => ({
    stakeId: String(r.stake_id),
    stakerAddr: String(r.staker_addr).toLowerCase(),
    stakedHearts: String(r.staked_hearts),
    endDay: Number(r.end_day),
  }));
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

export interface RankNeighbor { address: string; tShares: number }

export interface StakerRank {
  /** 1-based position among all ranked stakers. */
  rank: number;
  /** How many stakers are ranked at all. */
  of: number;
  /** The stakers directly above, nearest first (rank-1, rank-2, …). */
  above: RankNeighbor[];
  /** The stakers directly below, nearest first. */
  below: RankNeighbor[];
}

/**
 * Where a given T-Share total lands on the full staker ranking, with the
 * stakers immediately around it. The address itself is excluded from the
 * comparison: its T-Shares come in live from the contract, and its mirrored
 * row (which can lag by a sync cycle) must not compete with that.
 */
export async function readRankAround(net: Net, address: string, tShares: number, span = 3): Promise<StakerRank | null> {
  if (!sql) return null;
  // Compared in T (float8), not raw shares: a whale's share count overflows a
  // JS safe integer, and rank gaps are whole T-Shares anyway.
  const rows = await sql`
    WITH ranked AS (
      SELECT staker_addr, (SUM(stake_shares) / 1e12)::float8 AS t
      FROM hex_locked_stakes
      WHERE network = ${net} AND NOT good_accounted AND staker_addr != ${address}
      GROUP BY staker_addr
    )
    SELECT
      (SELECT count(*)::int FROM ranked WHERE t > ${tShares}::float8) AS above_count,
      (SELECT count(*)::int FROM ranked)                              AS others,
      (SELECT json_agg(x) FROM (
         SELECT staker_addr AS address, t AS tshares
         FROM ranked WHERE t > ${tShares}::float8 ORDER BY t ASC LIMIT ${span}
       ) x) AS above,
      (SELECT json_agg(x) FROM (
         SELECT staker_addr AS address, t AS tshares
         FROM ranked WHERE t <= ${tShares}::float8 ORDER BY t DESC LIMIT ${span}
       ) x) AS below`;
  const r = rows[0];
  if (!r) return null;
  const toNeighbors = (v: unknown): RankNeighbor[] =>
    (Array.isArray(v) ? v : []).map((n: { address: string; tshares: number }) => ({
      address: String(n.address),
      tShares: num(n.tshares),
    }));
  return {
    rank: num(r.above_count) + 1,
    // The queried address holds a place of its own once it has any T-Shares.
    of: num(r.others) + (tShares > 0 ? 1 : 0),
    above: toNeighbors(r.above),
    below: toNeighbors(r.below),
  };
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
