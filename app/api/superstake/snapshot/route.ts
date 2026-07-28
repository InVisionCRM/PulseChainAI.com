// Serves the baked SuperStake history (per-cycle records + the daily series the
// head-to-head replays over). It's ~46 KB, so it lives behind an endpoint rather
// than in the client bundle — the vs-HEX page fetches it once.
import { NextResponse } from 'next/server';
import snapshot from '@/lib/superstake/snapshot.json';
import type { SuperStakeSnapshot } from '@/lib/superstake/model';

export const dynamic = 'force-static';

export async function GET() {
  return NextResponse.json(snapshot as unknown as SuperStakeSnapshot, {
    // Immutable content — it only changes when the file is redeployed.
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
  });
}
