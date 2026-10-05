// What rescued stakers did with their HEX once they came back and collected it:
// re-staked, sold, moved it to another wallet, or kept it.
//
// Worked out by the rescue-fates cron with the same classifier the Whale Radar
// uses (lib/hex/hexWalletBehavior.ts) and stored, because each answer costs a
// wallet's transfer history plus a receipt per transfer — far too slow for a
// page that renders every minute.
//
// A row is FINAL once its 30-day window had closed when it was computed; the
// cron never revisits those. Until then it is recomputed, since a staker who
// collected yesterday may still re-stake or sell tomorrow. "Unknown" is never
// stored: no row means "not worked out yet", and the page says so.

import { sql } from './connection';
import type { Net } from './hexLockedStakes';

export const FATES_DDL = [
  `CREATE TABLE IF NOT EXISTS hex_rescue_fates (
     network        VARCHAR(16)      NOT NULL,
     stake_id       BIGINT           NOT NULL,
     -- The wallet judged: the staker, or the owner an HSI contract paid out to.
     owner_addr     VARCHAR(42)      NOT NULL,
     collected_at   BIGINT           NOT NULL,
     collected_hex  DOUBLE PRECISION NOT NULL,
     -- restaked | sold | moved | held
     outcome        VARCHAR(10)      NOT NULL,
     restaked_hex   DOUBLE PRECISION,
     sold_hex       DOUBLE PRECISION NOT NULL,
     moved_hex      DOUBLE PRECISION NOT NULL,
     -- The transaction that decided the outcome, and how long after collecting.
     action_tx      VARCHAR(66),
     days_to_action INTEGER,
     final          BOOLEAN          NOT NULL,
     checked_at     BIGINT           NOT NULL,
     PRIMARY KEY (network, stake_id)
   )`,
];

export type FateOutcome = 'restaked' | 'sold' | 'moved' | 'held';

export interface FateRow {
  stakeId: string;
  ownerAddr: string;
  /** Unix ms the stake was ended and collected. */
  collectedAt: number;
  collectedHex: number;
  outcome: FateOutcome;
  restakedHex: number | null;
  soldHex: number;
  movedHex: number;
  actionTx: string | null;
  daysToAction: number | null;
  final: boolean;
  /** Unix ms this row was worked out. */
  checkedAt: number;
}

export async function upsertFates(net: Net, rows: FateRow[]): Promise<number> {
  if (!sql) throw new Error('No database configured');
  if (!rows.length) return 0;
  await sql`
    INSERT INTO hex_rescue_fates (
      network, stake_id, owner_addr, collected_at, collected_hex, outcome,
      restaked_hex, sold_hex, moved_hex, action_tx, days_to_action, final, checked_at)
    SELECT ${net}, * FROM UNNEST(
      ${rows.map((r) => r.stakeId)}::bigint[], ${rows.map((r) => r.ownerAddr.toLowerCase())}::text[],
      ${rows.map((r) => r.collectedAt)}::bigint[], ${rows.map((r) => r.collectedHex)}::float8[],
      ${rows.map((r) => r.outcome)}::text[], ${rows.map((r) => r.restakedHex)}::float8[],
      ${rows.map((r) => r.soldHex)}::float8[], ${rows.map((r) => r.movedHex)}::float8[],
      ${rows.map((r) => r.actionTx)}::text[], ${rows.map((r) => r.daysToAction)}::int[],
      ${rows.map((r) => r.final)}::boolean[], ${rows.map((r) => r.checkedAt)}::bigint[]
    )
    -- Until final, the newest reading replaces the last one wholesale.
    ON CONFLICT (network, stake_id) DO UPDATE SET
      owner_addr = EXCLUDED.owner_addr, collected_at = EXCLUDED.collected_at,
      collected_hex = EXCLUDED.collected_hex, outcome = EXCLUDED.outcome,
      restaked_hex = EXCLUDED.restaked_hex, sold_hex = EXCLUDED.sold_hex,
      moved_hex = EXCLUDED.moved_hex, action_tx = EXCLUDED.action_tx,
      days_to_action = EXCLUDED.days_to_action, final = EXCLUDED.final,
      checked_at = EXCLUDED.checked_at`;
  return rows.length;
}

/** A row as the driver returns it. BIGINT arrives as a string and float8 /
 *  int as numbers (the pg type parsers), so every figure goes through Number(). */
type Num = string | number;
interface RawFate {
  stake_id: string; owner_addr: string; collected_at: Num; collected_hex: Num;
  outcome: string; restaked_hex: Num | null; sold_hex: Num; moved_hex: Num;
  action_tx: string | null; days_to_action: Num | null; final: boolean; checked_at: Num;
}

/** Every stored fate, by stake id. Throws without a database — callers that
 *  can render without fates check `dbAvailable()` first. */
export async function readFates(net: Net): Promise<Map<string, FateRow>> {
  if (!sql) throw new Error('No database configured');
  const rows: RawFate[] = await sql`
    SELECT stake_id::text AS stake_id, owner_addr, collected_at, collected_hex, outcome,
           restaked_hex, sold_hex, moved_hex, action_tx, days_to_action, final, checked_at
    FROM hex_rescue_fates WHERE network = ${net}`;
  return new Map(
    rows.map((r) => [
      String(r.stake_id),
      {
        stakeId: String(r.stake_id),
        ownerAddr: String(r.owner_addr),
        collectedAt: Number(r.collected_at),
        collectedHex: Number(r.collected_hex),
        outcome: r.outcome as FateOutcome,
        restakedHex: r.restaked_hex == null ? null : Number(r.restaked_hex),
        soldHex: Number(r.sold_hex),
        movedHex: Number(r.moved_hex),
        actionTx: r.action_tx ?? null,
        daysToAction: r.days_to_action == null ? null : Number(r.days_to_action),
        final: !!r.final,
        checkedAt: Number(r.checked_at),
      },
    ]),
  );
}
