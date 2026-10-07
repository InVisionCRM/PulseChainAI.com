// Hourly: record every HEX day closed since the last one stored — what it paid
// stakers and where the penalty part came from — for the Rescue Wall's payout
// ledger. Days before this cron are in lib/hex/payoutHistory.json (same
// calculator, lib/hex/payoutDays.ts). A day closes at the first staking
// transaction after 00:00 UTC and is read once that block is finalized, so
// each day lands within the hour after it closes; most runs find nothing new.

import { NextRequest, NextResponse } from 'next/server';
import { readPayoutDays } from '@/lib/hex/payoutDays';
import payoutHistory from '@/lib/hex/payoutHistory.json';
import { getFinalizedBlockNumber } from '@/lib/portfolio/evmRpc';
import { dbAvailable, ensureSchema } from '@/lib/db/hexLockedStakes';
import { insertPayoutDays, readStoredPayoutDays } from '@/lib/db/hexPayoutDays';

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
    const stored = await readStoredPayoutDays('pulsechain');
    const history = payoutHistory.days;
    // The newest day known, from the table or else the history file; the walk
    // starts at the block whose DailyDataUpdate closed it.
    const last = stored[stored.length - 1] ?? history[history.length - 1];
    const days = await readPayoutDays(last.day, last.closeBlock, await getFinalizedBlockNumber('pulsechain'));
    await insertPayoutDays('pulsechain', days);
    return NextResponse.json({ success: true, after: last.day, recorded: days.map((d) => d.day), elapsedMs: Date.now() - started });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'payout-days failed', elapsedMs: Date.now() - started },
      { status: 500 },
    );
  }
}
