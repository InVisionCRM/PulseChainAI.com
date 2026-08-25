/**
 * Incremental screener sync — runs every cron tick.
 * 1. Scans new blocks for pair creations (all DEX factories at once).
 * 2. Refreshes market data for the highest-priority pairs within a time budget.
 */

import { latestBlock, scanPairCreations } from './logs';
import { fetchPairsBatch, BATCH_SIZE } from './dexscreener';
import {
  ensureSchema,
  getMeta,
  setMeta,
  insertDiscovered,
  applyMarket,
  recordMisses,
  refreshTargets,
} from './db';

const LAST_SCANNED_KEY = 'last_scanned_block';
/** First scan without a cursor only looks back this far; history is the backfill script's job. */
const COLD_START_LOOKBACK = 5000;
/** Hard cap per run so a long outage can't produce an unbounded scan. */
const MAX_SCAN_BLOCKS = 50000;
const SCAN_CHUNK = 10000;
const MAX_REFRESH_PAIRS = 900;

export interface RefreshSummary {
  scannedFrom: number | null;
  scannedTo: number | null;
  discovered: number;
  refreshed: number;
  /** Pairs DexScreener had nothing for this run. Most are simply on the clock. */
  missed: number;
  /** Of those, how many had been missing long enough to actually be delisted. */
  delisted: number;
  batchErrors: number;
  elapsedMs: number;
}

export async function runRefresh(timeBudgetMs: number): Promise<RefreshSummary> {
  const started = Date.now();
  await ensureSchema();

  const head = await latestBlock();
  const cursor = await getMeta(LAST_SCANNED_KEY);
  let from = cursor ? parseInt(cursor, 10) + 1 : head - COLD_START_LOOKBACK;
  from = Math.max(from, head - MAX_SCAN_BLOCKS);

  let discovered = 0;
  let scannedFrom: number | null = null;
  let scannedTo: number | null = null;
  if (from <= head) {
    scannedFrom = from;
    scannedTo = head;
    await scanPairCreations(from, head, SCAN_CHUNK, async (pairs, upTo) => {
      discovered += await insertDiscovered(pairs);
      await setMeta(LAST_SCANNED_KEY, String(upTo));
    });
  }

  const targets = await refreshTargets(MAX_REFRESH_PAIRS);
  let refreshed = 0;
  let missed = 0;
  let delisted = 0;
  let batchErrors = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    if (Date.now() - started > timeBudgetMs) break;
    const batch = targets.slice(i, i + BATCH_SIZE);
    try {
      const found = await fetchPairsBatch(batch);
      const missing = batch.filter((a) => !found.has(a));
      await applyMarket(Array.from(found.values()));
      delisted += await recordMisses(missing);
      refreshed += found.size;
      missed += missing.length;
    } catch (err) {
      batchErrors += 1;
      console.error('screener refresh batch failed:', err);
    }
  }

  return {
    scannedFrom,
    scannedTo,
    discovered,
    refreshed,
    missed,
    delisted,
    batchErrors,
    elapsedMs: Date.now() - started,
  };
}
