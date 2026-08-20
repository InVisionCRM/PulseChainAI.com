// Filling the per-day macro spine from the subgraph.
//
// Two cursors, because the two sources behave differently:
//
//   dailyDataUpdates advances by DAY. One record per day since day 1, so the
//     cursor is the highest day already stored and catch-up is a handful of
//     pages even from empty.
//
//   globalInfos advances by TIMESTAMP. Many records a day, and only the last
//     of each day is kept, so the cursor is the newest timestamp already
//     folded in. The current day is re-read on every run because its closing
//     snapshot is not written until the day ends.
//
// Both are time-boxed and resumable: a run does what it can and saves where it
// got to, exactly like the stake mirror, because the same serverless wall
// clock applies.

import { ensureSchema } from '@/lib/db/hexLockedStakes';
import {
  getDailyState, initDailyState, saveDailyState, upsertDailyData, upsertDailyInfo,
  type DailyDataRow, type DailyInfoRow,
} from '@/lib/db/hexDaily';
import { query } from './lockedStakes';
import type { HexNet as Net } from './subgraph';

const PAGE = 1000;

export interface DailySyncReport {
  network: Net;
  daysWritten: number;
  infoDaysWritten: number;
  lastDataDay: number;
  lastInfoTs: number;
  /** True when both sources are level with the chain. */
  caughtUp: boolean;
  batches: number;
  elapsedMs: number;
}

interface RawDaily { beginDay: number; payout: string; shares: string; payoutPerTShare: string }
interface RawInfo {
  hexDay: string; timestamp: string; lockedHeartsTotal: string;
  totalSupply: string; stakePenaltyTotal: string; shareRate: string; stakeSharesTotal: string;
}

export async function runDailySync(net: Net, budgetMs = 20_000): Promise<DailySyncReport> {
  const started = Date.now();
  const left = () => budgetMs - (Date.now() - started);

  await ensureSchema();
  await initDailyState(net);
  const state = (await getDailyState(net)) ?? { lastDataDay: 0, lastInfoTs: 0 };
  let { lastDataDay, lastInfoTs } = state;
  let daysWritten = 0;
  let infoDaysWritten = 0;
  let batches = 0;
  let dataDone = false;
  let infoDone = false;

  try {
    // -- dailyDataUpdates, by day ------------------------------------------
    while (left() > 4_000) {
      const d = await query<{ dailyDataUpdates: RawDaily[] }>(
        net,
        `{ dailyDataUpdates(first: ${PAGE}, orderBy: beginDay, orderDirection: asc,
            where: { beginDay_gt: ${lastDataDay} })
           { beginDay payout shares payoutPerTShare } }`,
      );
      batches++;
      const rows = d.dailyDataUpdates ?? [];
      if (rows.length) {
        const mapped: DailyDataRow[] = rows.map((r) => ({
          hexDay: Number(r.beginDay),
          payoutHearts: r.payout,
          shares: r.shares,
          payoutPerTShare: r.payoutPerTShare,
        }));
        daysWritten += await upsertDailyData(net, mapped);
        lastDataDay = Math.max(lastDataDay, ...mapped.map((m) => m.hexDay));
        await saveDailyState(net, { lastDataDay });
      }
      if (rows.length < PAGE) { dataDone = true; break; }
    }

    // -- globalInfos, by timestamp, last-of-day wins -------------------------
    while (left() > 4_000) {
      const d = await query<{ globalInfos: RawInfo[] }>(
        net,
        `{ globalInfos(first: ${PAGE}, orderBy: timestamp, orderDirection: asc,
            where: { timestamp_gt: ${lastInfoTs} })
           { hexDay timestamp lockedHeartsTotal totalSupply stakePenaltyTotal shareRate stakeSharesTotal } }`,
      );
      batches++;
      const rows = d.globalInfos ?? [];
      if (rows.length) {
        // Keep only the newest snapshot per day. Rows arrive ascending, so the
        // later one always replaces the earlier.
        const byDay = new Map<number, DailyInfoRow>();
        for (const r of rows) {
          byDay.set(Number(r.hexDay), {
            hexDay: Number(r.hexDay),
            lockedHearts: r.lockedHeartsTotal,
            totalSupply: r.totalSupply,
            penaltyTotal: r.stakePenaltyTotal,
            shareRate: r.shareRate,
            sharesTotal: r.stakeSharesTotal,
            snapshotTs: Number(r.timestamp),
          });
        }
        infoDaysWritten += await upsertDailyInfo(net, [...byDay.values()]);
        lastInfoTs = Math.max(lastInfoTs, ...rows.map((r) => Number(r.timestamp) || 0));
        await saveDailyState(net, { lastInfoTs });
      }
      if (rows.length < PAGE) { infoDone = true; break; }
    }

    await saveDailyState(net, { error: null });
  } catch (err) {
    await saveDailyState(net, { error: err instanceof Error ? err.message : String(err) }).catch(() => {});
    throw err;
  }

  return {
    network: net,
    daysWritten,
    infoDaysWritten,
    lastDataDay,
    lastInfoTs,
    caughtUp: dataDone && infoDone,
    batches,
    elapsedMs: Date.now() - started,
  };
}
