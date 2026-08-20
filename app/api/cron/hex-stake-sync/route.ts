import { NextRequest, NextResponse } from 'next/server';
import { runStakeSync } from '@/lib/hex/lockedStakeSync';
import { runDailySync } from '@/lib/hex/dailySync';
import { runEndsSync } from '@/lib/hex/endsSync';
import { resetDailyForRefill } from '@/lib/db/hexDaily';
import { dbAvailable, getSyncState, resetForRefill } from '@/lib/db/hexLockedStakes';

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
/**
 * One wall clock shared by all three jobs, sitting under `maxDuration` so the
 * run always gets to save its cursors instead of being killed mid-batch.
 *
 * The split between them is worked out as the run goes rather than fixed up
 * front. This fires once a day, so a second of budget handed to a job that has
 * nothing to do is a second the one-time backfills do not get, and those are
 * measured in runs — at a fixed 18s slice the ended-stake history would take a
 * week of daily runs to fill. In the steady state the stake mirror finishes in
 * a second or two and the spine is a no-op, so nearly the whole minute falls
 * through to whatever is still catching up.
 */
const RUN_BUDGET_MS = 52_000;
/** Held back from the stake slice for the two jobs that follow it. */
const RESERVE_AFTER_STAKES_MS = 20_000;
/** Held back from the spine for the ended-stake history behind it. */
const RESERVE_AFTER_DAILY_MS = 14_000;
/** No job is worth starting with less than this; it would only burn a query. */
const MIN_SLICE_MS = 4_000;

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
    // ?refill=1 rewinds the cursor to the start of the stake list before this
    // slice runs. Needed after a migration adds columns (existing rows are null
    // in them and the live phase never looks back), and to reconcile drift if
    // the sync has been down. Guarded by the same secret as the sync itself,
    // and refused when there is no secret — an open endpoint doing idempotent
    // catch-up work is fine, one that can restart a full sweep is not.
    if (req.nextUrl.searchParams.get('refill') === '1') {
      if (unprotected) {
        return NextResponse.json(
          { error: 'refill requires CRON_SECRET to be set' },
          { status: 403 },
        );
      }
      await resetForRefill('pulsechain');
      await resetDailyForRefill('pulsechain');
    }

    const startedAt = Date.now();
    const remaining = () => RUN_BUDGET_MS - (Date.now() - startedAt);
    /** What this job may use, leaving `reserve` for the jobs behind it. */
    const slice = (reserve: number) => Math.max(MIN_SLICE_MS, remaining() - reserve);

    const report = await runStakeSync('pulsechain', slice(RESERVE_AFTER_STAKES_MS));

    // The per-day spine rides along on the same invocation. It is small and
    // usually a no-op, and folding it in here means one thing to schedule
    // rather than two — which matters when the platform only grants one
    // reliable firing a day. Its failure is reported but never fails the
    // stake sync, which is the one the public views depend on.
    let daily: Awaited<ReturnType<typeof runDailySync>> | null = null;
    let dailyError: string | null = null;
    try {
      daily = await runDailySync('pulsechain', slice(RESERVE_AFTER_DAILY_MS));
    } catch (err) {
      dailyError = err instanceof Error ? err.message : 'daily sync failed';
    }

    let ends: Awaited<ReturnType<typeof runEndsSync>> | null = null;
    let endsError: string | null = null;
    try {
      ends = await runEndsSync('pulsechain', slice(0));
    } catch (err) {
      endsError = err instanceof Error ? err.message : 'ends sync failed';
    }

    return NextResponse.json({
      success: true,
      ...report,
      daily,
      ...(dailyError ? { dailyError } : {}),
      ends,
      ...(endsError ? { endsError } : {}),
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
