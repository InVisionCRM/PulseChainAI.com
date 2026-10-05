// One-time rebuild of the Road to Zero history: for every HEX day from the
// week before the keeper's first rescue up to yesterday, how many matured
// stakes in the keeper's range (10K–25M HEX) were still unresolved, how many
// had bled out, and the penalty sitting on them, interest included.
//
// History is on-chain fact and never changes, so it is computed once and
// committed as lib/hex/roadToZeroHistory.json; the rescue-road cron records
// every day after it. Same calculator for both (lib/hex/roadToZero.ts).
//
//   npm run hex:road-history
//
// Every subgraph read retries and then FAILS rather than skipping: a missing
// end or good-accounting record would count a stake as unresolved forever.

import { writeFileSync } from 'fs';
import path from 'path';
import { currentHexDay } from '@/lib/hex/hexDay';
import { fetchRescues } from '@/lib/hex/rescueFeed';
import {
  fetchPayoutData, roadState, stakeReturnHearts, subgraphStrict, resolutionDays, toRoadStake, hexDayOf, START_FIELDS,
  type RoadStake, type RoadState,
} from '@/lib/hex/roadToZero';
import { MIN_PRINCIPAL_HEX_FALLBACK, MAX_PRINCIPAL_HEX_FALLBACK } from '@/lib/hex/rescue';

const OUT = path.join(process.cwd(), 'lib/hex/roadToZeroHistory.json');
const WORKERS = 8;

interface Scanned extends RoadStake { resolvedDay: number | null }

async function scanRange(fromId: bigint, toId: bigint, endBefore: number, minHearts: string, maxHearts: string, keepFrom: number): Promise<Scanned[]> {
  const kept: Scanned[] = [];
  let cursor = fromId;
  for (;;) {
    const d = await subgraphStrict<{ stakeStarts: Parameters<typeof toRoadStake>[0][] }>(
      `{ stakeStarts(first: 1000, orderBy: stakeId, where:{ stakeId_gt: "${cursor}", stakeId_lte: "${toId}", endDay_lt: ${endBefore}, stakedHearts_gte: "${minHearts}", stakedHearts_lte: "${maxHearts}" }){ ${START_FIELDS} } }`,
    );
    const rows = d.stakeStarts;
    if (!rows.length) return kept;
    const res = await resolutionDays(rows.map((r) => r.stakeId));
    for (const r of rows) {
      const resolvedDay = res.get(r.stakeId) ?? null;
      // Resolved before the window opens: never on the road we chart.
      if (resolvedDay != null && resolvedDay <= keepFrom) continue;
      kept.push({ ...toRoadStake(r), resolvedDay });
    }
    cursor = BigInt(rows[rows.length - 1].stakeId);
  }
}

(async () => {
  const today = currentHexDay();
  const rescues = await fetchRescues('pulsechain');
  const firstRescueDay = hexDayOf(Math.min(...rescues.map((r) => r.timestamp)) / 1000);
  const fromDay = firstRescueDay - 7;
  const toDay = today - 1; // today is still moving; the cron records it
  const minHearts = String(BigInt(MIN_PRINCIPAL_HEX_FALLBACK) * 100_000_000n);
  const maxHearts = String(BigInt(MAX_PRINCIPAL_HEX_FALLBACK) * 100_000_000n);
  // Bleeding on or before toDay: lockedDay + stakedDays + 14 < toDay, and the
  // subgraph's endDay = lockedDay + stakedDays + 1.
  const endBefore = toDay - 13;

  const top = await subgraphStrict<{ stakeStarts: { stakeId: string }[] }>(`{ stakeStarts(first: 1, orderBy: stakeId, orderDirection: desc){ stakeId } }`);
  const maxId = BigInt(top.stakeStarts[0].stakeId);
  const step = maxId / BigInt(WORKERS) + 1n;
  console.log(`days ${fromDay}..${toDay} | stake ids 0..${maxId} in ${WORKERS} ranges`);
  const t0 = Date.now();
  const parts = await Promise.all(
    Array.from({ length: WORKERS }, (_, w) => scanRange(BigInt(w) * step, BigInt(w + 1) * step, endBefore, minHearts, maxHearts, fromDay)),
  );
  const stakes = parts.flat();
  console.log(`kept ${stakes.length} stakes unresolved at some point since day ${fromDay} (${Math.round((Date.now() - t0) / 1000)} s)`);

  const data = await fetchPayoutData();
  const gross = new Map<string, bigint>();
  const grossOf = (s: RoadStake) => {
    let g = gross.get(s.stakeId);
    if (g == null) { g = stakeReturnHearts(s, data); gross.set(s.stakeId, g); }
    return g;
  };

  const days: RoadState[] = [];
  for (let day = fromDay; day <= toDay; day++) {
    // Still unresolved at the end of `day`.
    days.push(roadState(stakes.filter((s) => s.resolvedDay == null || s.resolvedDay > day), day, grossOf));
  }
  writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    minHex: MIN_PRINCIPAL_HEX_FALLBACK,
    maxHex: MAX_PRINCIPAL_HEX_FALLBACK,
    firstRescueDay,
    days,
  }, null, 1) + '\n');
  const last = days[days.length - 1];
  console.log(`wrote ${days.length} days to ${OUT}; day ${last.day}: ${last.remaining} remaining, ${last.drained} drained, ${Math.round(last.penaltyHex)} HEX penalty`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
