// Backfilling and then tailing the stakeEnd stream.
//
// Ends are ingested OLDEST FIRST and the cursor is the newest timestamp already
// stored. That ordering matters: a crash mid-backfill leaves a contiguous
// history with a known edge, so the next run resumes at exactly one point. The
// same cursor then serves the steady state, where each run picks up the handful
// of ends that happened since.
//
// Several ends can share a timestamp (one block, many transactions), so the
// cursor uses timestamp_gte and pages with `skip` within a timestamp. Using
// _gt would silently drop every end that shared its second with the last one
// ingested.

import { ensureSchema } from '@/lib/db/hexLockedStakes';
import {
  countEnds, getEndsState, initEndsState, saveEndsState, upsertEnds, type EndRow,
} from '@/lib/db/hexStakeEnds';
import { query } from './lockedStakes';
import type { HexNet as Net } from './subgraph';

const PAGE = 1000;

export interface EndsSyncReport {
  network: Net;
  ingested: number;
  lastEndTs: number;
  backfilled: boolean;
  totalRows: number;
  batches: number;
  elapsedMs: number;
}

interface RawEnd {
  stakeId: string; stakerAddr: string; stakedHearts: string; stakedShares: string;
  payout: string; penalty: string; servedDays: string; daysLate: string;
  daysEarly: string; prevUnlocked: boolean; timestamp: string;
}

const FIELDS =
  'stakeId stakerAddr stakedHearts stakedShares payout penalty servedDays daysLate daysEarly prevUnlocked timestamp';

export async function runEndsSync(net: Net, budgetMs = 20_000): Promise<EndsSyncReport> {
  const started = Date.now();
  const left = () => budgetMs - (Date.now() - started);

  await ensureSchema();
  await initEndsState(net);
  const state = (await getEndsState(net)) ?? { lastEndTs: 0, backfilled: false, totalRows: 0 };
  let { lastEndTs, backfilled } = state;
  let ingested = 0;
  let batches = 0;
  // Rows already seen AT the cursor timestamp, so a shared second is paged
  // through rather than re-fetched forever.
  let within = 0;

  try {
    while (left() > 4_000) {
      const d = await query<{ stakeEnds: RawEnd[] }>(
        net,
        `{ stakeEnds(first: ${PAGE}, skip: ${within}, orderBy: timestamp, orderDirection: asc,
            where: { timestamp_gte: ${lastEndTs} }) { ${FIELDS} } }`,
      );
      batches++;
      const rows = d.stakeEnds ?? [];
      if (!rows.length) { backfilled = true; break; }

      const mapped: EndRow[] = rows.map((r) => ({
        stakeId: String(r.stakeId),
        stakerAddr: r.stakerAddr,
        stakedHearts: r.stakedHearts,
        stakedShares: r.stakedShares,
        payout: r.payout,
        penalty: r.penalty,
        servedDays: Number(r.servedDays) || 0,
        daysLate: Number(r.daysLate) || 0,
        daysEarly: Number(r.daysEarly) || 0,
        prevUnlocked: !!r.prevUnlocked,
        endedAt: Number(r.timestamp) || 0,
      }));
      ingested += await upsertEnds(net, mapped);

      const newest = Math.max(...mapped.map((m) => m.endedAt));
      // Advancing the cursor resets the within-timestamp offset; staying on the
      // same second means this page was all one timestamp, so step past it.
      if (newest > lastEndTs) {
        lastEndTs = newest;
        within = mapped.filter((m) => m.endedAt === newest).length;
      } else {
        within += rows.length;
      }
      await saveEndsState(net, { lastEndTs });

      if (rows.length < PAGE) { backfilled = true; break; }
    }

    const totalRows = await countEnds(net);
    await saveEndsState(net, { backfilled, totalRows, error: null });
    return {
      network: net, ingested, lastEndTs, backfilled, totalRows, batches,
      elapsedMs: Date.now() - started,
    };
  } catch (err) {
    await saveEndsState(net, { error: err instanceof Error ? err.message : String(err) }).catch(() => {});
    throw err;
  }
}
