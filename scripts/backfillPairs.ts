#!/usr/bin/env tsx
/**
 * One-time full backfill of the screener pair universe.
 *
 * Phase 1 — scan every block for v2 PairCreated / v3 PoolCreated events
 *           (starts at block 0 to include pre-fork Uniswap pairs that exist
 *           in PulseChain's forked Ethereum history).
 * Phase 2 — enrich pairs through DexScreener in batches of 30 at ~285 req/min.
 *           Pairs DexScreener doesn't know are marked listed=false.
 *
 * Usage:
 *   npm run screener:backfill                 # full scan from block 0 + enrich
 *   npm run screener:backfill -- --resume     # resume an interrupted scan
 *   npm run screener:backfill -- --from 17233000
 *   npm run screener:backfill -- --enrich-only
 *   npm run screener:backfill -- --no-enrich
 *
 * Requires DATABASE_URL. Run with: npx tsx scripts/backfillPairs.ts
 */

import { latestBlock, scanPairCreations } from '../lib/screener/logs';
import { fetchPairsBatch, BATCH_SIZE } from '../lib/screener/dexscreener';
import {
  ensureSchema,
  getMeta,
  setMeta,
  insertDiscovered,
  applyMarket,
  markUnlisted,
  countUnenriched,
} from '../lib/screener/db';
import { neon } from '@neondatabase/serverless';

const CURSOR_KEY = 'backfill_cursor';
const LAST_SCANNED_KEY = 'last_scanned_block';
const SCAN_CHUNK = 25000;
const REQUEST_GAP_MS = 210; // ~285 req/min, under DexScreener's 300/min cap

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? '') : null;
}
const has = (name: string) => process.argv.includes(name);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function scanPhase(): Promise<void> {
  const head = await latestBlock();
  let from = 0;
  if (has('--resume')) {
    const cursor = await getMeta(CURSOR_KEY);
    if (cursor) from = parseInt(cursor, 10) + 1;
  } else if (arg('--from')) {
    from = parseInt(arg('--from')!, 10);
  }
  const to = arg('--to') ? parseInt(arg('--to')!, 10) : head;

  console.log(`Scanning blocks ${from.toLocaleString()} → ${to.toLocaleString()}`);
  let discovered = 0;
  let chunks = 0;
  const totalChunks = Math.ceil((to - from + 1) / SCAN_CHUNK);
  const t0 = Date.now();

  await scanPairCreations(from, to, SCAN_CHUNK, async (pairs, upTo) => {
    discovered += await insertDiscovered(pairs);
    await setMeta(CURSOR_KEY, String(upTo));
    chunks += 1;
    if (chunks % 10 === 0 || upTo >= to) {
      const pct = ((chunks / totalChunks) * 100).toFixed(1);
      const mins = ((Date.now() - t0) / 60000).toFixed(1);
      console.log(`  ${pct}% — block ${upTo.toLocaleString()}, ${discovered.toLocaleString()} new pairs, ${mins}min`);
    }
  });

  await setMeta(LAST_SCANNED_KEY, String(to));
  console.log(`Scan done: ${discovered.toLocaleString()} pairs discovered.\n`);
}

async function enrichPhase(): Promise<void> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const sql = neon(url);

  let remaining = await countUnenriched();
  console.log(`Enriching ${remaining.toLocaleString()} pairs via DexScreener (~${Math.ceil(remaining / BATCH_SIZE / 285)}min minimum)...`);
  let listed = 0;
  let unlisted = 0;
  let batches = 0;
  const t0 = Date.now();

  while (remaining > 0) {
    const progressBefore = listed + unlisted;
    const rows = (await sql.query(
      `SELECT pair_address FROM screener_pairs WHERE listed IS NULL
       ORDER BY created_block DESC LIMIT 3000`,
    )) as { pair_address: string }[];
    if (rows.length === 0) break;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE).map((r) => r.pair_address);
      try {
        const found = await fetchPairsBatch(batch);
        const missing = batch.filter((a) => !found.has(a));
        await applyMarket(Array.from(found.values()));
        await markUnlisted(missing);
        listed += found.size;
        unlisted += missing.length;
      } catch (err) {
        console.error(`  batch failed (will retry on next run): ${(err as Error).message}`);
      }
      batches += 1;
      if (batches % 50 === 0) {
        const mins = ((Date.now() - t0) / 60000).toFixed(1);
        console.log(`  ${(listed + unlisted).toLocaleString()} processed — ${listed.toLocaleString()} listed, ${unlisted.toLocaleString()} unlisted, ${mins}min`);
      }
      await sleep(REQUEST_GAP_MS);
    }
    if (listed + unlisted === progressBefore) {
      throw new Error('No progress in a full enrichment pass — aborting (is DexScreener rate-limiting?). Re-run with --enrich-only to continue.');
    }
    remaining = await countUnenriched();
  }
  console.log(`Enrichment done: ${listed.toLocaleString()} listed, ${unlisted.toLocaleString()} unlisted.`);
}

async function main(): Promise<void> {
  await ensureSchema();
  if (!has('--enrich-only')) await scanPhase();
  if (!has('--no-enrich')) await enrichPhase();
  console.log('\nBackfill complete. The per-minute cron keeps everything fresh from here.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
