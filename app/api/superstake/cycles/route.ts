// Live SuperStake cycle history.
//
// Everything the head-to-head needs turns out to be queryable — no separate
// indexer required:
//   • cycles           — HEX subgraph, every stake opened by the SuperStake
//                        staking contract (stakeStarts/stakeEnds by stakerAddr)
//   • payout/share rate — HEX subgraph dailyDataUpdates (payout ÷ shares per day)
//   • prices + volume   — PulseX subgraph tokenDayDatas for pHEX and pSSH
//   • holder payout     — 1% of (pool + yield), verified against the published
//                        record for cycles #1 and #18
//
// The rebuild itself lives in lib/superstake/rebuildCycles.ts, which settles
// the days that can no longer change into Postgres and asks the subgraphs only
// for the tail. This file is the HTTP wrapper around it: a short in-process
// cache for the concurrent-burst case, and the baked snapshot as the floor —
// if the rebuild can't run at all the client keeps using the snapshot rather
// than showing a broken page.

import { NextResponse, type NextRequest } from 'next/server';
import { sql } from '@/lib/db/connection';
import { rebuildCycles, type CyclesPayload } from '@/lib/superstake/rebuildCycles';
import type { SqlClient } from '@/lib/db/superstakeHistory';

// A cold rebuild with an empty store still paginates both subgraphs and takes
// ~15s. Without this the route inherits Vercel's short default, gets cut off,
// and the page silently falls back to the baked snapshot — which is exactly how
// it went stale after cycle 17 closed. 60s leaves real headroom.
export const maxDuration = 60;

/**
 * Short now, not an hour. The database is what stops us hammering the
 * subgraphs; this only coalesces the burst of requests a single page load can
 * produce on one instance, and a long TTL here just delays a new cycle showing
 * up. Postgres is shared across every instance, which the old in-process hour
 * never was.
 */
const CACHE_TTL_MS = 5 * 60_000;

let cache: { value: CyclesPayload; at: number } | null = null;
let inflight: Promise<CyclesPayload | null> | null = null;

const HEADERS = { 'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600' };

export async function GET(request: NextRequest) {
  // `?refresh=full` re-reads every day from the subgraphs and overwrites the
  // store. The routine drift check only covers the last few days, so this is
  // the way to repair a day that went wrong outside that window. It costs the
  // full ~15s sweep, which is why it is opt-in and bypasses the cache.
  const force = new URL(request.url).searchParams.get('refresh') === 'full';

  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.value, { headers: HEADERS });
  }

  // Concurrent callers share one rebuild rather than each starting their own.
  if (force) {
    inflight = rebuildCycles({ db: (sql as SqlClient | null) ?? null, force: true }).finally(() => {
      inflight = null;
    });
  } else if (!inflight) {
    inflight = rebuildCycles({ db: (sql as SqlClient | null) ?? null }).finally(() => {
      inflight = null;
    });
  }

  let payload: CyclesPayload | null = null;
  try {
    payload = await inflight;
  } catch (e) {
    console.error('[superstake/cycles] rebuild failed:', e);
  }

  if (!payload) {
    // Serving a stale rebuild beats serving nothing: the client's alternative
    // is the baked snapshot, which is older still.
    if (cache) return NextResponse.json(cache.value, { headers: HEADERS });
    return NextResponse.json(
      { error: 'HEX subgraph unavailable', source: 'unavailable' },
      { status: 503 },
    );
  }

  cache = { value: payload, at: Date.now() };
  return NextResponse.json(payload, { headers: HEADERS });
}
