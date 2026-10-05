// Hourly: measure the Road to Zero — matured stakes in the keeper's range still
// bleeding or bled out, and the penalty sitting on them, interest included —
// and record it for the Rescue Wall's chart. See lib/hex/roadToZero.ts.

import { NextRequest, NextResponse } from 'next/server';
import { liveRoad } from '@/lib/hex/roadToZero';
import { dbAvailable, ensureSchema } from '@/lib/db/hexLockedStakes';
import { insertRoadSnapshot } from '@/lib/db/hexRoadSnapshots';

export const revalidate = 0;
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!dbAvailable()) {
    return NextResponse.json({ error: 'No DATABASE_URL configured' }, { status: 503 });
  }
  const started = Date.now();
  try {
    await ensureSchema();
    const road = await liveRoad();
    await insertRoadSnapshot('pulsechain', started, road);
    return NextResponse.json({ success: true, ...road, elapsedMs: Date.now() - started });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'road-to-zero failed', elapsedMs: Date.now() - started },
      { status: 500 },
    );
  }
}
