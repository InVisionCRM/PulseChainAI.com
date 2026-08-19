import { NextRequest, NextResponse } from 'next/server';
import { runStakeSync } from '@/lib/hex/lockedStakeSync';
import { dbAvailable, getSyncState } from '@/lib/db/hexLockedStakes';

export const revalidate = 0;
export const maxDuration = 60;

/**
 * Advances the locked-stake mirror by one time-boxed slice.
 *
 * The initial fill is roughly 950k stake starts plus the whole end and
 * good-accounting history — far more than one invocation can do, so this runs
 * often and resumes from its saved cursors. Once the mirror is `ready` each run
 * is a handful of queries and finishes in a second or two.
 *
 * The budget sits under `maxDuration` so the run always gets to save its
 * cursors rather than being killed mid-batch and repeating the work.
 */
const BUDGET_MS = 45_000;

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Deliberately NOT refused when no secret is configured. Vercel only sends
  // the bearer header when CRON_SECRET is set, so demanding it unconditionally
  // would leave the mirror silently un-synced forever on a project that hasn't
  // set one — a far worse failure than an open endpoint doing idempotent,
  // time-boxed work. The response says so, so it is visible rather than quiet.
  const unprotected = !secret;
  if (!dbAvailable()) {
    return NextResponse.json(
      { skipped: true, reason: 'No DATABASE_URL configured — the macro views stay on the live subgraph sample.' },
      { status: 200 },
    );
  }

  try {
    const report = await runStakeSync('pulsechain', BUDGET_MS);
    return NextResponse.json({
      success: true,
      ...report,
      ...(unprotected
        ? { warning: 'CRON_SECRET is not set, so this endpoint is callable by anyone. Set it to lock the sync down.' }
        : {}),
    });
  } catch (err) {
    const state = await getSyncState('pulsechain').catch(() => null);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Stake sync failed',
        // Cursors survive a failure, so report where it will resume.
        phase: state?.phase ?? null,
        lastStakeId: state?.lastStakeId ?? null,
        ready: state?.ready ?? false,
      },
      { status: 500 },
    );
  }
}
