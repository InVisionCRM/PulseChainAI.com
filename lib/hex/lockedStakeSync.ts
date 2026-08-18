// Keeps the hex_locked_stakes mirror current from the staking subgraph.
//
// Why a mirror exists at all: the subgraph has no per-day or per-staker
// aggregate, so answering "when is everything due" or "who holds the most
// T-Shares" means summing individual stakes — and there are hundreds of
// thousands of locked ones. Reading them live caps out at a size-ranked sample
// (~91% of locked HEX) and costs ~20s a request. Mirrored into Postgres, both
// questions become one GROUP BY over the complete set.
//
// Every run is TIME-BOXED and resumable. The initial fill is far more work than
// a single serverless invocation allows, so each run does what it can inside
// its budget, saves its cursors, and the next run picks up exactly there.

import { inactiveStakeIds, networkTotals, query, type LockedStake, STAKE_FIELDS } from './lockedStakes';
import type { HexNet as Net } from './subgraph';
import {
  countLocked, ensureSchema, getSyncState, initSyncState, removeStakes, saveSyncState,
  upsertStakes, type SyncPhase, type SyncState,
} from '@/lib/db/hexLockedStakes';

const PAGE = 1000;
/** graph-node refuses `skip` above 5000, so a batch is five pages. */
const PARALLEL = 5;
const BATCH = PAGE * PARALLEL;
/** Rows per INSERT statement — keeps a single query's payload sane. */
const WRITE_CHUNK = 2000;

export interface SyncReport {
  network: Net;
  /** Phase the sync was in when this run finished. */
  phase: SyncPhase;
  ready: boolean;
  stakesIngested: number;
  /** Stakes skipped at insert time or deleted because they had unlocked. */
  stakesSkipped: number;
  stakesRemoved: number;
  lockedStakes: number;
  /** True when this run finished the initial fill. */
  completed: boolean;
  batches: number;
  elapsedMs: number;
}

const chunk = <T,>(xs: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
};

/** One skip-parallel batch of an id-ordered scan. */
async function scanById<T>(net: Net, entity: string, fields: string, afterId: number): Promise<T[]> {
  const pages = await Promise.all(
    Array.from({ length: PARALLEL }, (_, i) =>
      query<Record<string, T[]>>(
        net,
        `{ ${entity}(where:{ stakeId_gt: ${afterId} }, orderBy: stakeId, orderDirection: asc, first: ${PAGE}, skip: ${i * PAGE}){ ${fields} } }`,
      ).then((d) => d[entity] ?? []),
    ),
  );
  return pages.flat();
}

const maxId = (rows: { stakeId: string }[]) => rows.reduce((m, r) => Math.max(m, Number(r.stakeId)), 0);

/** Newest event timestamp in an unlock table — the seed for incremental catch-up. */
async function newestTimestamp(net: Net, entity: string): Promise<number> {
  const d = await query<Record<string, { timestamp: string }[]>>(
    net,
    `{ ${entity}(orderBy: timestamp, orderDirection: desc, first: 1){ timestamp } }`,
  );
  return Number(d[entity]?.[0]?.timestamp ?? 0);
}

/**
 * Advance the mirror by as much as fits in `budgetMs`.
 *
 * Two phases:
 *   fill — walk every stake ever opened by ascending stakeId, and store only
 *          the ones still locked.
 *   live — incremental catch-up; the steady state.
 *
 * The unlocked check happens at INSERT time rather than as a second pass that
 * deletes afterwards. Storing all ~950k stakes and then deleting the ~750k dead
 * ones would work, but it would peak at several hundred megabytes of table and
 * index for a result that settles near 200k rows — too much to ask of a
 * free-tier database, and Postgres does not hand the space back after a DELETE.
 * Filtering first costs more subgraph queries and keeps the table at its true
 * size throughout.
 *
 * A stake that unlocks *during* the fill is caught by the live phase, whose
 * cursors are seeded with the newest unlock timestamps as the fill begins.
 */
export async function runStakeSync(net: Net, budgetMs = 45_000): Promise<SyncReport> {
  const started = Date.now();
  const spent = () => Date.now() - started;
  const left = () => budgetMs - spent();

  await ensureSchema();
  await initSyncState(net);
  const state = (await getSyncState(net)) as SyncState;

  let { phase, lastStakeId, lastEndTs, lastGaTs, ready } = state;
  let ingested = 0;
  let skipped = 0;
  let removed = 0;
  let batches = 0;
  let completed = false;

  try {
    // Seed the incremental cursors before ingesting anything, so an unlock that
    // lands mid-fill is still picked up later.
    if (phase === 'fill' && lastStakeId === 0) {
      [lastEndTs, lastGaTs] = await Promise.all([
        newestTimestamp(net, 'stakeEnds'),
        newestTimestamp(net, 'stakeGoodAccountings'),
      ]);
      batches += 2;
    }

    // -- Phase: fill --------------------------------------------------------
    while (phase === 'fill' && left() > 10_000) {
      const rows = await scanById<LockedStake>(net, 'stakeStarts', STAKE_FIELDS, lastStakeId);
      batches++;
      if (rows.length) {
        const dead = await inactiveStakeIds(net, rows.map((r) => String(r.stakeId)));
        const live = rows.filter((r) => !dead.has(String(r.stakeId)));
        skipped += rows.length - live.length;
        for (const c of chunk(live, WRITE_CHUNK)) ingested += await upsertStakes(net, c);
        lastStakeId = Math.max(lastStakeId, maxId(rows));
      }
      if (rows.length < BATCH) {
        phase = 'live';
        ready = true;
        completed = true;
        break;
      }
    }

    // -- Phase: live --------------------------------------------------------
    // New stakes come by id; unlocks come by timestamp, because an unlock can
    // land on a stake of any age.
    if (phase === 'live' && left() > 5_000) {
      const fresh = await scanById<LockedStake>(net, 'stakeStarts', STAKE_FIELDS, lastStakeId);
      batches++;
      if (fresh.length) {
        for (const c of chunk(fresh, WRITE_CHUNK)) ingested += await upsertStakes(net, c);
        lastStakeId = Math.max(lastStakeId, maxId(fresh));
      }

      for (const [entity, from] of [['stakeEnds', lastEndTs], ['stakeGoodAccountings', lastGaTs]] as const) {
        let cursor = from;
        // Offset within a single second. Timestamps are not unique, so a full
        // page that shares one second would otherwise re-read the same rows
        // forever; skipping past what we just read guarantees progress without
        // stepping over anything.
        let within = 0;
        while (left() > 3_000) {
          const d = await query<Record<string, { stakeId: string; timestamp: string }[]>>(
            net,
            `{ ${entity}(where:{ timestamp_gte: ${cursor} }, orderBy: timestamp, orderDirection: asc, first: ${PAGE}, skip: ${within}){ stakeId timestamp } }`,
          );
          const rows = d[entity] ?? [];
          batches++;
          if (!rows.length) break;
          for (const c of chunk(rows.map((r) => String(r.stakeId)), WRITE_CHUNK)) {
            removed += await removeStakes(net, c);
          }
          const newest = Math.max(...rows.map((r) => Number(r.timestamp) || 0));
          if (rows.length < PAGE) {
            cursor = newest;
            break;
          }
          if (newest > cursor) {
            cursor = newest;
            within = 0;
          } else {
            within += PAGE; // a whole page inside one second — step over it
          }
        }
        if (entity === 'stakeEnds') lastEndTs = Math.max(lastEndTs, cursor);
        else lastGaTs = Math.max(lastGaTs, cursor);
      }
    }

    const totals = await networkTotals(net).catch(() => null);
    const lockedStakes = await countLocked(net);

    await saveSyncState(net, {
      phase, lastStakeId, lastEndTs, lastGaTs, ready, lockedStakes, completed, error: null,
      ...(totals ? { networkTShares: totals.tShares, networkHex: totals.hexLocked } : {}),
    });

    return {
      network: net, phase, ready,
      stakesIngested: ingested, stakesSkipped: skipped, stakesRemoved: removed, lockedStakes,
      completed, batches, elapsedMs: spent(),
    };
  } catch (err) {
    // Save whatever progress was made — a failed run should cost one batch, not
    // the whole fill.
    const message = err instanceof Error ? err.message : 'stake sync failed';
    await saveSyncState(net, { phase, lastStakeId, lastEndTs, lastGaTs, ready, error: message }).catch(() => {});
    throw err;
  }
}
