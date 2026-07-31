// The frozen half of the SuperStake record, kept so we stop re-deriving three
// years of settled history from the subgraphs on every cold start.
//
// A cold rebuild of /api/superstake/cycles took 15.1s and swept four paginated
// subgraph queries to produce 1,051 days of series — of which 1,039 (98.9%)
// were already settled and could not change again. The route's `let cache`
// only ever helped one lambda instance, so on Vercel that sweep ran again on
// every cold start, in every region, forever.
//
// Two rules this schema is built around:
//
// 1. **Store observations, never derivations.** These tables hold what the
//    subgraphs said — a day's payout, share rate, prices, volume — and nothing
//    computed from them. Carry-forward, T-shares, cycle payouts and yields are
//    all derived at read time, exactly as before. If a formula is ever
//    corrected, the record behind it doesn't need a migration, because the
//    record never contained the formula's output.
//
// 2. **A day is not settled the moment we first see it.** `tokenDayDatas` for
//    today is still accumulating volume, HEX emits day N's payout at the start
//    of day N+1, and subgraphs reindex. So nothing within `FREEZE_LAG_DAYS` of
//    the current day is ever written, and the most recent stored days are
//    re-read on every refresh and compared — see `DRIFT_RECHECK_DAYS` in the
//    route. A wrong day stored during a subgraph lag would otherwise be wrong
//    forever, silently, under every projection built on top of it.
//
// Every metric column is nullable on purpose. A day with no observation stores
// NULL rather than a carried-forward neighbour's value, so a later backfill
// fills a hole instead of overwriting a fabricated reading.

/**
 * The shape of a Neon tagged-template client. Taking it as an argument rather
 * than importing the module-level `sql` directly is what lets these queries be
 * run against a real Postgres in a test — the SQL is the part most likely to
 * be wrong, and it should not be the part that goes unverified.
 */
export type SqlClient = <T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<T[]>;

/** One HEX day's readings. Nulls mean "not observed", never "zero". */
export interface DayRow {
  day: number;
  payoutPerTshare: number | null;
  shareRate: number | null;
  pHex: number | null;
  pSsh: number | null;
  volSsh: number | null;
  globalTshares: number | null;
}

/** One stake the SuperStake contract has opened. */
export interface StakeRow {
  stakeId: number;
  startDay: number;
  stakedDays: number;
  stakedHex: number;
  tShares: number;
  startedTs: number;
  ended: boolean;
  endPayoutHex: number | null;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Idempotent, and cheap enough to call on every request — Postgres short-
 * circuits `IF NOT EXISTS`. Doing it here rather than in a migration script
 * means a fresh database heals itself instead of serving errors until someone
 * remembers to run `db:init`.
 */
export async function ensureSuperstakeSchema(db: SqlClient): Promise<void> {
  await db`
    CREATE TABLE IF NOT EXISTS superstake_day (
      day                 INTEGER PRIMARY KEY,
      payout_per_tshare   DOUBLE PRECISION,
      share_rate          DOUBLE PRECISION,
      p_hex               DOUBLE PRECISION,
      p_pssh              DOUBLE PRECISION,
      vol_pssh            DOUBLE PRECISION,
      global_tshares      DOUBLE PRECISION,
      stored_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS superstake_stake (
      stake_id        BIGINT PRIMARY KEY,
      start_day       INTEGER NOT NULL,
      staked_days     INTEGER NOT NULL,
      staked_hex      DOUBLE PRECISION NOT NULL,
      t_shares        DOUBLE PRECISION NOT NULL,
      started_ts      BIGINT NOT NULL,
      ended           BOOLEAN NOT NULL DEFAULT FALSE,
      end_payout_hex  DOUBLE PRECISION,
      stored_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // Single row. The high-water mark is kept separately from `MAX(day)` because
  // a swept day with no observations stores nothing — without this, a quiet
  // day at the tail would make us re-sweep the same range forever.
  await db`
    CREATE TABLE IF NOT EXISTS superstake_sync (
      id            INTEGER PRIMARY KEY,
      swept_to_day  INTEGER NOT NULL,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT superstake_sync_singleton CHECK (id = 1)
    )
  `;
}

/** Days we have already swept the subgraphs for. Null when nothing is stored. */
export async function readSweptToDay(db: SqlClient): Promise<number | null> {
  const rows = await db<{ swept_to_day: number }>`
    SELECT swept_to_day FROM superstake_sync WHERE id = 1
  `;
  return rows.length ? num(rows[0].swept_to_day) : null;
}

export async function writeSweptToDay(db: SqlClient, day: number): Promise<void> {
  await db`
    INSERT INTO superstake_sync (id, swept_to_day, updated_at)
    VALUES (1, ${day}, now())
    ON CONFLICT (id) DO UPDATE
      SET swept_to_day = GREATEST(superstake_sync.swept_to_day, EXCLUDED.swept_to_day),
          updated_at = now()
  `;
}

export async function readDays(db: SqlClient, fromDay = 0): Promise<DayRow[]> {
  const rows = await db<Record<string, unknown>>`
    SELECT day, payout_per_tshare, share_rate, p_hex, p_pssh, vol_pssh, global_tshares
      FROM superstake_day
     WHERE day >= ${fromDay}
     ORDER BY day ASC
  `;
  return rows.map((r) => ({
    day: Number(r.day),
    payoutPerTshare: num(r.payout_per_tshare),
    shareRate: num(r.share_rate),
    pHex: num(r.p_hex),
    pSsh: num(r.p_pssh),
    volSsh: num(r.vol_pssh),
    globalTshares: num(r.global_tshares),
  }));
}

/**
 * Upsert in one round trip via `unnest`. The initial backfill is ~1,040 rows,
 * and Neon's HTTP client is one round trip per statement — a row-at-a-time
 * loop would turn a single write into a thousand of them.
 *
 * `COALESCE(EXCLUDED.x, existing.x)` means a fresh sweep that observed nothing
 * for a column leaves what we already had, so re-sweeping a range can only
 * ever add information.
 */
export async function writeDays(db: SqlClient, rows: DayRow[]): Promise<number> {
  if (!rows.length) return 0;
  const days = rows.map((r) => r.day);
  const payout = rows.map((r) => r.payoutPerTshare);
  const share = rows.map((r) => r.shareRate);
  const pHex = rows.map((r) => r.pHex);
  const pSsh = rows.map((r) => r.pSsh);
  const vol = rows.map((r) => r.volSsh);
  const gts = rows.map((r) => r.globalTshares);
  await db`
    INSERT INTO superstake_day
      (day, payout_per_tshare, share_rate, p_hex, p_pssh, vol_pssh, global_tshares)
    SELECT * FROM unnest(
      ${days}::int[], ${payout}::float8[], ${share}::float8[], ${pHex}::float8[],
      ${pSsh}::float8[], ${vol}::float8[], ${gts}::float8[]
    )
    ON CONFLICT (day) DO UPDATE SET
      payout_per_tshare = COALESCE(EXCLUDED.payout_per_tshare, superstake_day.payout_per_tshare),
      share_rate        = COALESCE(EXCLUDED.share_rate,        superstake_day.share_rate),
      p_hex             = COALESCE(EXCLUDED.p_hex,             superstake_day.p_hex),
      p_pssh            = COALESCE(EXCLUDED.p_pssh,            superstake_day.p_pssh),
      vol_pssh          = COALESCE(EXCLUDED.vol_pssh,          superstake_day.vol_pssh),
      global_tshares    = COALESCE(EXCLUDED.global_tshares,    superstake_day.global_tshares),
      stored_at         = now()
  `;
  return rows.length;
}

export async function readStakes(db: SqlClient): Promise<StakeRow[]> {
  const rows = await db<Record<string, unknown>>`
    SELECT stake_id, start_day, staked_days, staked_hex, t_shares, started_ts, ended, end_payout_hex
      FROM superstake_stake
     ORDER BY start_day ASC
  `;
  return rows.map((r) => ({
    stakeId: Number(r.stake_id),
    startDay: Number(r.start_day),
    stakedDays: Number(r.staked_days),
    stakedHex: Number(r.staked_hex),
    tShares: Number(r.t_shares),
    startedTs: Number(r.started_ts),
    ended: r.ended === true || r.ended === 't',
    endPayoutHex: num(r.end_payout_hex),
  }));
}

export async function writeStakes(db: SqlClient, rows: StakeRow[]): Promise<number> {
  if (!rows.length) return 0;
  await db`
    INSERT INTO superstake_stake
      (stake_id, start_day, staked_days, staked_hex, t_shares, started_ts, ended, end_payout_hex)
    SELECT * FROM unnest(
      ${rows.map((r) => r.stakeId)}::bigint[],
      ${rows.map((r) => r.startDay)}::int[],
      ${rows.map((r) => r.stakedDays)}::int[],
      ${rows.map((r) => r.stakedHex)}::float8[],
      ${rows.map((r) => r.tShares)}::float8[],
      ${rows.map((r) => r.startedTs)}::bigint[],
      ${rows.map((r) => r.ended)}::bool[],
      ${rows.map((r) => r.endPayoutHex)}::float8[]
    )
    ON CONFLICT (stake_id) DO UPDATE SET
      ended          = EXCLUDED.ended OR superstake_stake.ended,
      end_payout_hex = COALESCE(EXCLUDED.end_payout_hex, superstake_stake.end_payout_hex),
      stored_at      = now()
  `;
  return rows.length;
}

/** A stored day that no longer matches what the subgraph now reports. */
export interface Drift {
  day: number;
  field: keyof DayRow;
  stored: number | null;
  fresh: number | null;
}

/**
 * Compare freshly-observed days against what we stored. Anything over the
 * tolerance is real disagreement rather than float noise, and the caller
 * surfaces it — a stored day silently diverging from its source is the one
 * failure mode this whole cache could introduce.
 */
export function findDrift(stored: DayRow[], fresh: DayRow[], tolerance = 1e-9): Drift[] {
  const byDay = new Map(stored.map((d) => [d.day, d]));
  const fields: (keyof DayRow)[] = [
    'payoutPerTshare', 'shareRate', 'pHex', 'pSsh', 'volSsh',
  ];
  const out: Drift[] = [];
  for (const f of fresh) {
    const s = byDay.get(f.day);
    if (!s) continue;
    for (const field of fields) {
      const a = s[field] as number | null;
      const b = f[field] as number | null;
      // Only an observation that *was* there and changed counts. A fresh sweep
      // returning nothing for a column is a quiet upstream, not a correction.
      if (a == null || b == null) continue;
      const scale = Math.max(Math.abs(a), Math.abs(b), 1e-12);
      if (Math.abs(a - b) / scale > tolerance) out.push({ day: f.day, field, stored: a, fresh: b });
    }
  }
  return out;
}
