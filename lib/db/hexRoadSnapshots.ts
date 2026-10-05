// The Road to Zero, recorded: one row per hourly run of the road-to-zero cron,
// holding what lib/hex/roadToZero.ts liveRoad() measured at that moment.
//
// History before the cron existed is not here — it is immutable chain history,
// rebuilt once into lib/hex/roadToZeroHistory.json by the same calculator. The
// page charts that file, then these rows from the day after it ends.

import { sql } from './connection';
import type { Net } from './hexLockedStakes';
import type { LiveRoad } from '@/lib/hex/roadToZero';

export const ROAD_DDL = [
  `CREATE TABLE IF NOT EXISTS hex_road_snapshots (
     network        VARCHAR(16)      NOT NULL,
     taken_at       BIGINT           NOT NULL,
     hex_day        INTEGER          NOT NULL,
     remaining      INTEGER          NOT NULL,
     bleeding       INTEGER          NOT NULL,
     drained        INTEGER          NOT NULL,
     principal_hex  DOUBLE PRECISION NOT NULL,
     -- Penalty already taken by the late-end rule, interest included.
     penalty_hex    DOUBLE PRECISION NOT NULL,
     -- The principal range measured, so a change to it is visible in the data.
     min_hex        DOUBLE PRECISION NOT NULL,
     max_hex        DOUBLE PRECISION NOT NULL,
     PRIMARY KEY (network, taken_at)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_hex_road_day ON hex_road_snapshots (network, hex_day DESC)`,
];

export async function insertRoadSnapshot(net: Net, takenAt: number, r: LiveRoad): Promise<void> {
  if (!sql) throw new Error('No database configured');
  await sql`
    INSERT INTO hex_road_snapshots (
      network, taken_at, hex_day, remaining, bleeding, drained, principal_hex, penalty_hex, min_hex, max_hex)
    VALUES (${net}, ${takenAt}, ${r.day}, ${r.remaining}, ${r.bleeding}, ${r.drained},
            ${r.principalHex}, ${r.penaltyHex}, ${r.minHex}, ${r.maxHex})`;
}

export interface RoadSnapshot extends LiveRoad { takenAt: number }

type Num = string | number;
interface RawRoad {
  taken_at: Num; hex_day: Num; remaining: Num; bleeding: Num; drained: Num;
  principal_hex: Num; penalty_hex: Num; min_hex: Num; max_hex: Num;
}

/** The latest snapshot of each HEX day, oldest first. */
export async function readRoadDaily(net: Net): Promise<RoadSnapshot[]> {
  if (!sql) throw new Error('No database configured');
  const rows: RawRoad[] = await sql`
    SELECT DISTINCT ON (hex_day) taken_at, hex_day, remaining, bleeding, drained,
           principal_hex, penalty_hex, min_hex, max_hex
    FROM hex_road_snapshots WHERE network = ${net}
    ORDER BY hex_day ASC, taken_at DESC`;
  return rows.map((r) => ({
    takenAt: Number(r.taken_at),
    day: Number(r.hex_day),
    remaining: Number(r.remaining),
    bleeding: Number(r.bleeding),
    drained: Number(r.drained),
    principalHex: Number(r.principal_hex),
    penaltyHex: Number(r.penalty_hex),
    minHex: Number(r.min_hex),
    maxHex: Number(r.max_hex),
  }));
}
