// The stakes that are over — the half of HEX history the mirror threw away.
//
// hex_locked_stakes deletes a row the moment its stake ends, which keeps that
// table honest about what is CURRENTLY locked but leaves the site unable to
// answer anything about behaviour: how many stakes served their term, what
// penalties were actually paid, what a staker really earned, whether the HEX
// freed by an unlock gets re-staked or sold.
//
// stakeEnd events carry all of it — payout, penalty, servedDays, daysLate,
// daysEarly — and one flag that nothing else exposes:
//
//   prevUnlocked — the stake was GOOD-ACCOUNTED before it was ended. That is
//     the rescue signal. Joined against the good-accounting timestamp it
//     answers how long a rescued staker took to come and collect, and proves
//     the frozen payout was what they actually received.
//
// Rows here are immutable: an end happens once and is never revised. So the
// upsert overwrites rather than merges, and re-ingesting a page is harmless.

import { sql } from './connection';
import type { Net } from './hexLockedStakes';

export const ENDS_DDL = [
  `CREATE TABLE IF NOT EXISTS hex_stake_ends (
     network        VARCHAR(16)   NOT NULL,
     stake_id       BIGINT        NOT NULL,
     staker_addr    VARCHAR(42)   NOT NULL,
     -- Principal returned, and the shares it had held.
     staked_hearts  NUMERIC(40,0) NOT NULL,
     staked_shares  NUMERIC(40,0) NOT NULL,
     -- Interest actually paid, and what the contract took back.
     payout         NUMERIC(40,0) NOT NULL,
     penalty        NUMERIC(40,0) NOT NULL,
     served_days    INTEGER       NOT NULL,
     days_late      INTEGER       NOT NULL,
     days_early     INTEGER       NOT NULL,
     -- Good-accounted before it was ended: a rescued stake being collected.
     prev_unlocked  BOOLEAN       NOT NULL,
     ended_at       BIGINT        NOT NULL,
     PRIMARY KEY (network, stake_id)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_hex_ends_time ON hex_stake_ends (network, ended_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_hex_ends_staker ON hex_stake_ends (network, staker_addr)`,
  `CREATE INDEX IF NOT EXISTS idx_hex_ends_rescued ON hex_stake_ends (network, prev_unlocked) WHERE prev_unlocked`,
  `CREATE TABLE IF NOT EXISTS hex_ends_state (
     network      VARCHAR(16) PRIMARY KEY,
     -- Oldest-first backfill cursor; ends are ingested ascending by time.
     last_end_ts  BIGINT      NOT NULL DEFAULT 0,
     backfilled   BOOLEAN     NOT NULL DEFAULT FALSE,
     total_rows   INTEGER     NOT NULL DEFAULT 0,
     last_run_at  TIMESTAMPTZ,
     last_error   TEXT
   )`,
];

export interface EndRow {
  stakeId: string;
  stakerAddr: string;
  stakedHearts: string;
  stakedShares: string;
  payout: string;
  penalty: string;
  servedDays: number;
  daysLate: number;
  daysEarly: number;
  prevUnlocked: boolean;
  endedAt: number;
}

const n = (v: unknown) => (v == null ? 0 : Number(v));

export async function initEndsState(net: Net): Promise<void> {
  if (!sql) throw new Error('No database configured');
  await sql`INSERT INTO hex_ends_state (network) VALUES (${net}) ON CONFLICT (network) DO NOTHING`;
}

export async function getEndsState(
  net: Net,
): Promise<{ lastEndTs: number; backfilled: boolean; totalRows: number } | null> {
  if (!sql) return null;
  try {
    const rows = await sql`
      SELECT last_end_ts, backfilled, total_rows FROM hex_ends_state WHERE network = ${net}`;
    if (!rows.length) return null;
    return {
      lastEndTs: n(rows[0].last_end_ts),
      backfilled: !!rows[0].backfilled,
      totalRows: n(rows[0].total_rows),
    };
  } catch (err) {
    if (String((err as { code?: string })?.code) === '42P01') return null;
    throw err;
  }
}

export async function saveEndsState(
  net: Net,
  p: { lastEndTs?: number; backfilled?: boolean; totalRows?: number; error?: string | null },
): Promise<void> {
  if (!sql) throw new Error('No database configured');
  await sql`
    UPDATE hex_ends_state SET
      last_end_ts = COALESCE(${p.lastEndTs ?? null}, last_end_ts),
      backfilled  = COALESCE(${p.backfilled ?? null}, backfilled),
      total_rows  = COALESCE(${p.totalRows ?? null}, total_rows),
      last_run_at = now(),
      last_error  = ${p.error === undefined ? null : p.error}
    WHERE network = ${net}`;
}

export async function upsertEnds(net: Net, rows: EndRow[]): Promise<number> {
  if (!sql || !rows.length) return 0;
  await sql`
    INSERT INTO hex_stake_ends (
      network, stake_id, staker_addr, staked_hearts, staked_shares, payout, penalty,
      served_days, days_late, days_early, prev_unlocked, ended_at)
    SELECT ${net}, * FROM UNNEST(
      ${rows.map((r) => r.stakeId)}::bigint[], ${rows.map((r) => r.stakerAddr.toLowerCase())}::text[],
      ${rows.map((r) => r.stakedHearts)}::numeric[], ${rows.map((r) => r.stakedShares)}::numeric[],
      ${rows.map((r) => r.payout)}::numeric[], ${rows.map((r) => r.penalty)}::numeric[],
      ${rows.map((r) => r.servedDays)}::int[], ${rows.map((r) => r.daysLate)}::int[],
      ${rows.map((r) => r.daysEarly)}::int[], ${rows.map((r) => r.prevUnlocked)}::boolean[],
      ${rows.map((r) => r.endedAt)}::bigint[]
    )
    -- An end is a one-time, immutable fact, so a replay simply rewrites the
    -- same values rather than needing merge rules.
    ON CONFLICT (network, stake_id) DO UPDATE SET
      staker_addr = EXCLUDED.staker_addr, staked_hearts = EXCLUDED.staked_hearts,
      staked_shares = EXCLUDED.staked_shares, payout = EXCLUDED.payout,
      penalty = EXCLUDED.penalty, served_days = EXCLUDED.served_days,
      days_late = EXCLUDED.days_late, days_early = EXCLUDED.days_early,
      prev_unlocked = EXCLUDED.prev_unlocked, ended_at = EXCLUDED.ended_at`;
  return rows.length;
}

export async function countEnds(net: Net): Promise<number> {
  if (!sql) return 0;
  const rows = await sql`SELECT count(*)::int AS c FROM hex_stake_ends WHERE network = ${net}`;
  return n(rows[0]?.c);
}

// ---------------------------------------------------------------------------
// Reads — the behaviour the mirror could never answer before
// ---------------------------------------------------------------------------

const HEARTS = 1e8;

export interface EndsSummary {
  count: number;
  principalHex: number;
  payoutHex: number;
  penaltyHex: number;
  /** Ends that ran the full committed term: neither early nor late. */
  fullTerm: number;
  early: number;
  late: number;
  /** Ends of stakes that had been good-accounted first — rescued, then claimed. */
  afterGoodAccounting: number;
  /** Realized return on principal across the window, as a percent. */
  realizedYieldPct: number | null;
}

/**
 * Aggregate the ends in a time window.
 *
 * Summed in SQL rather than by pulling rows: this table grows without bound and
 * a 30-day window on a busy month is thousands of ends.
 */
export async function readEndsSummary(net: Net, sinceTs: number): Promise<EndsSummary> {
  const empty: EndsSummary = {
    count: 0, principalHex: 0, payoutHex: 0, penaltyHex: 0,
    fullTerm: 0, early: 0, late: 0, afterGoodAccounting: 0, realizedYieldPct: null,
  };
  if (!sql) return empty;
  const rows = await sql`
    SELECT count(*)::int AS count,
           COALESCE(sum(staked_hearts), 0) AS principal,
           COALESCE(sum(payout), 0)        AS payout,
           COALESCE(sum(penalty), 0)       AS penalty,
           count(*) FILTER (WHERE days_early = 0 AND days_late = 0)::int AS full_term,
           count(*) FILTER (WHERE days_early > 0)::int                   AS early,
           count(*) FILTER (WHERE days_late  > 0)::int                   AS late,
           count(*) FILTER (WHERE prev_unlocked)::int                    AS after_ga
    FROM hex_stake_ends
    WHERE network = ${net} AND ended_at >= ${sinceTs}`;
  const r = rows[0];
  if (!r) return empty;
  const principalHex = Number(r.principal) / HEARTS;
  const payoutHex = Number(r.payout) / HEARTS;
  const penaltyHex = Number(r.penalty) / HEARTS;
  return {
    count: Number(r.count),
    principalHex,
    payoutHex,
    penaltyHex,
    fullTerm: Number(r.full_term),
    early: Number(r.early),
    late: Number(r.late),
    afterGoodAccounting: Number(r.after_ga),
    // Net of the penalty, because that is what the staker actually kept.
    realizedYieldPct: principalHex > 0 ? ((payoutHex - penaltyHex) / principalHex) * 100 : null,
  };
}

export interface RescueOutcome {
  stakeId: string;
  stakerAddr: string;
  principalHex: number;
  payoutHex: number;
  penaltyHex: number;
  endedAt: number;
  daysLate: number;
}

/**
 * Stakes that were good-accounted and have since been ended by their owner.
 *
 * This is only the ENDED side. How long each one took after its rescue needs
 * the good-accounting timestamp, which lives with the rescue record — this
 * returns the end so the two can be joined without pulling the whole table.
 */
export async function readEndedAfterGoodAccounting(
  net: Net, stakeIds: string[],
): Promise<Map<string, RescueOutcome>> {
  const out = new Map<string, RescueOutcome>();
  if (!sql || !stakeIds.length) return out;
  const rows = await sql`
    SELECT stake_id, staker_addr, staked_hearts, payout, penalty, ended_at, days_late
    FROM hex_stake_ends
    WHERE network = ${net} AND stake_id = ANY(${stakeIds}::bigint[])`;
  for (const r of rows) {
    out.set(String(r.stake_id), {
      stakeId: String(r.stake_id),
      stakerAddr: String(r.staker_addr),
      principalHex: Number(r.staked_hearts) / HEARTS,
      payoutHex: Number(r.payout) / HEARTS,
      penaltyHex: Number(r.penalty) / HEARTS,
      endedAt: Number(r.ended_at),
      daysLate: Number(r.days_late),
    });
  }
  return out;
}
