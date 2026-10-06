// Every keeper rescue, stored once.
//
// A rescue is immutable once its block is final: who it was for, which stake,
// when, the note, the gas, and the principal / interest / penalty HEX froze in
// its StakeGoodAccounting event. lib/hex/rescueSync.ts fills this from the
// chain; the Rescue Wall reads it instead of re-reading the keeper's whole
// history on every render (194 explorer pages, ~146 s, on 2026-10-06 — past
// both the 60 s build limit and the page's 120 s refresh limit).
//
// HEX amounts are hearts (1e-8 HEX) and gas is wei, stored exactly as NUMERIC;
// the penalty is stored as emitted, uncapped — the cap is HEX's rule, applied
// where the figures are read (lib/hex/rescueFeed.ts).

import { sql } from './connection';
import type { Net } from './hexLockedStakes';

export const RESCUES_DDL = [
  `CREATE TABLE IF NOT EXISTS hex_rescues (
     network          VARCHAR(16)    NOT NULL,
     tx_hash          VARCHAR(66)    NOT NULL,
     log_index        INTEGER        NOT NULL,
     block_number     BIGINT         NOT NULL,
     mined_at         BIGINT         NOT NULL,
     stake_id         BIGINT         NOT NULL,
     staker_addr      VARCHAR(42)    NOT NULL,
     principal_hearts NUMERIC(30,0)  NOT NULL,
     payout_hearts    NUMERIC(30,0)  NOT NULL,
     penalty_hearts   NUMERIC(30,0)  NOT NULL,
     message          TEXT,
     fee_wei          NUMERIC(40,0)  NOT NULL,
     PRIMARY KEY (network, tx_hash, log_index)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_hex_rescues_stake ON hex_rescues (network, stake_id)`,
  `CREATE INDEX IF NOT EXISTS idx_hex_rescues_mined ON hex_rescues (network, mined_at)`,
  // The last block every rescue up to and including is stored.
  `CREATE TABLE IF NOT EXISTS hex_rescue_sync (
     network         VARCHAR(16) PRIMARY KEY,
     synced_to_block BIGINT      NOT NULL
   )`,
];

export interface RescueRow {
  txHash: string;
  logIndex: number;
  blockNumber: number;
  /** Unix ms. */
  minedAt: number;
  stakeId: string;
  stakerAddr: string;
  principalHearts: bigint;
  payoutHearts: bigint;
  /** As emitted by the event: NOT capped at principal + payout. */
  penaltyHearts: bigint;
  message: string | null;
  feeWei: bigint;
}

export async function insertRescues(net: Net, rows: RescueRow[]): Promise<void> {
  if (!sql) throw new Error('No database configured');
  if (!rows.length) return;
  await sql`
    INSERT INTO hex_rescues (
      network, tx_hash, log_index, block_number, mined_at, stake_id, staker_addr,
      principal_hearts, payout_hearts, penalty_hearts, message, fee_wei)
    SELECT ${net}, * FROM UNNEST(
      ${rows.map((r) => r.txHash)}::text[], ${rows.map((r) => r.logIndex)}::int[],
      ${rows.map((r) => r.blockNumber)}::bigint[], ${rows.map((r) => r.minedAt)}::bigint[],
      ${rows.map((r) => r.stakeId)}::bigint[], ${rows.map((r) => r.stakerAddr)}::text[],
      ${rows.map((r) => r.principalHearts.toString())}::numeric[], ${rows.map((r) => r.payoutHearts.toString())}::numeric[],
      ${rows.map((r) => r.penaltyHearts.toString())}::numeric[], ${rows.map((r) => r.message)}::text[],
      ${rows.map((r) => r.feeWei.toString())}::numeric[]
    )
    -- A block range read twice (two renders syncing at once) is the same facts.
    ON CONFLICT (network, tx_hash, log_index) DO NOTHING`;
}

/** The last block fully stored, or null before the first sync. */
export async function readSyncedTo(net: Net): Promise<number | null> {
  if (!sql) throw new Error('No database configured');
  const rows: { synced_to_block: string | number }[] =
    await sql`SELECT synced_to_block FROM hex_rescue_sync WHERE network = ${net}`;
  return rows.length ? Number(rows[0].synced_to_block) : null;
}

/** Record progress. Never moves backwards, so a slower concurrent sync
 *  finishing late cannot rewind a faster one. */
export async function saveSyncedTo(net: Net, block: number): Promise<void> {
  if (!sql) throw new Error('No database configured');
  await sql`
    INSERT INTO hex_rescue_sync (network, synced_to_block) VALUES (${net}, ${block})
    ON CONFLICT (network) DO UPDATE SET synced_to_block = GREATEST(hex_rescue_sync.synced_to_block, EXCLUDED.synced_to_block)`;
}

type Num = string | number;
interface RawRescue {
  tx_hash: string; log_index: Num; block_number: Num; mined_at: Num; stake_id: Num; staker_addr: string;
  principal_hearts: Num; payout_hearts: Num; penalty_hearts: Num; message: string | null; fee_wei: Num;
}

const toRow = (r: RawRescue): RescueRow => ({
  txHash: r.tx_hash,
  logIndex: Number(r.log_index),
  blockNumber: Number(r.block_number),
  minedAt: Number(r.mined_at),
  stakeId: String(r.stake_id),
  stakerAddr: r.staker_addr,
  principalHearts: BigInt(r.principal_hearts),
  payoutHearts: BigInt(r.payout_hearts),
  penaltyHearts: BigInt(r.penalty_hearts),
  message: r.message,
  feeWei: BigInt(r.fee_wei),
});

/** Every stored rescue, newest first. */
export async function readRescueRows(net: Net): Promise<RescueRow[]> {
  if (!sql) throw new Error('No database configured');
  const rows: RawRescue[] = await sql`
    SELECT tx_hash, log_index, block_number, mined_at, stake_id, staker_addr,
           principal_hearts, payout_hearts, penalty_hearts, message, fee_wei
    FROM hex_rescues WHERE network = ${net}
    ORDER BY block_number DESC, log_index DESC`;
  return rows.map(toRow);
}

/** The rescue of one stake, or null if the keeper never rescued it. */
export async function readRescueRow(net: Net, stakeId: string): Promise<RescueRow | null> {
  if (!sql) throw new Error('No database configured');
  const rows: RawRescue[] = await sql`
    SELECT tx_hash, log_index, block_number, mined_at, stake_id, staker_addr,
           principal_hearts, payout_hearts, penalty_hearts, message, fee_wei
    FROM hex_rescues WHERE network = ${net} AND stake_id = ${stakeId}
    ORDER BY block_number DESC LIMIT 1`;
  return rows.length ? toRow(rows[0]) : null;
}
