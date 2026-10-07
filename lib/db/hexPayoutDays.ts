// The payout ledger, recorded: one row per closed HEX day, as
// lib/hex/payoutDays.ts readPayoutDays() reconciled it against the contract.
//
// Days before the cron existed are not here — they are immutable chain
// history, rebuilt once into lib/hex/payoutHistory.json by the same
// calculator. The page charts that file, then these rows from the day after.
//
// Not hex_daily: that table is filled from the subgraph on its own cursors,
// and the subgraph rounds some large integers — its share totals come back to
// ~16 significant digits (day 2499: 42095656264326100000 vs the contract's
// 42095656264326108748), though its daily payouts matched exactly on the ten
// days checked 2026-10-07. Every amount here is the contract's own, exact, and
// split by where the penalty part came from.

import { sql } from './connection';
import type { Net } from './hexLockedStakes';
import type { PayoutDay } from '@/lib/hex/payoutDays';

export const PAYOUT_DDL = [
  `CREATE TABLE IF NOT EXISTS hex_payout_days (
     network         VARCHAR(16)    NOT NULL,
     hex_day         INTEGER        NOT NULL,
     close_block     BIGINT         NOT NULL,
     shares          NUMERIC(40,0)  NOT NULL,
     payout_hearts   NUMERIC(40,0)  NOT NULL,
     inflation_hearts NUMERIC(40,0) NOT NULL,
     -- Stakers' halves of the penalties, by source.
     ees_hearts      NUMERIC(40,0)  NOT NULL,
     late_hearts     NUMERIC(40,0)  NOT NULL,
     ours_hearts     NUMERIC(40,0)  NOT NULL,
     ees_count       INTEGER        NOT NULL,
     late_count      INTEGER        NOT NULL,
     ours_count      INTEGER        NOT NULL,
     PRIMARY KEY (network, hex_day)
   )`,
];

export async function insertPayoutDays(net: Net, days: PayoutDay[]): Promise<void> {
  if (!sql) throw new Error('No database configured');
  if (!days.length) return;
  await sql`
    INSERT INTO hex_payout_days (
      network, hex_day, close_block, shares, payout_hearts, inflation_hearts,
      ees_hearts, late_hearts, ours_hearts, ees_count, late_count, ours_count)
    SELECT ${net}, * FROM UNNEST(
      ${days.map((d) => d.day)}::int[], ${days.map((d) => d.closeBlock)}::bigint[],
      ${days.map((d) => d.shares)}::numeric[], ${days.map((d) => d.payout)}::numeric[],
      ${days.map((d) => d.inflation)}::numeric[], ${days.map((d) => d.ees)}::numeric[],
      ${days.map((d) => d.late)}::numeric[], ${days.map((d) => d.ours)}::numeric[],
      ${days.map((d) => d.eesCount)}::int[], ${days.map((d) => d.lateCount)}::int[],
      ${days.map((d) => d.oursCount)}::int[])
    ON CONFLICT (network, hex_day) DO NOTHING`;
}

type Num = string | number;
interface RawDay {
  hex_day: Num; close_block: Num; shares: string; payout_hearts: string; inflation_hearts: string;
  ees_hearts: string; late_hearts: string; ours_hearts: string; ees_count: Num; late_count: Num; ours_count: Num;
}

/** Every stored day, oldest first. NUMERIC comes back as text, so the
 *  amounts stay exact. */
export async function readStoredPayoutDays(net: Net): Promise<PayoutDay[]> {
  if (!sql) throw new Error('No database configured');
  const rows: RawDay[] = await sql`
    SELECT hex_day, close_block, shares::text, payout_hearts::text, inflation_hearts::text,
           ees_hearts::text, late_hearts::text, ours_hearts::text, ees_count, late_count, ours_count
    FROM hex_payout_days WHERE network = ${net} ORDER BY hex_day ASC`;
  return rows.map((r) => ({
    day: Number(r.hex_day),
    closeBlock: Number(r.close_block),
    shares: r.shares,
    payout: r.payout_hearts,
    inflation: r.inflation_hearts,
    ees: r.ees_hearts,
    late: r.late_hearts,
    ours: r.ours_hearts,
    eesCount: Number(r.ees_count),
    lateCount: Number(r.late_count),
    oursCount: Number(r.ours_count),
  }));
}
