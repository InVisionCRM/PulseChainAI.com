// Hourly: for every rescued stake its owner has collected, work out what they
// did with the HEX — re-staked, sold, moved or kept — and store it for the
// Rescue Wall. See lib/db/hexRescueFates.ts for why this is stored rather than
// computed on the page, and lib/hex/rescueFates.ts for how it is judged.
//
// Bounded by a time budget, not a count: a wallet costs its transfer history
// plus a receipt per transfer, which varies by orders of magnitude. Never-seen
// stakes go first, then the stalest unfinished ones; whatever does not fit is
// picked up next hour.

import { NextRequest, NextResponse } from 'next/server';
import { fetchRescues } from '@/lib/hex/rescueFeed';
import { computeFates } from '@/lib/hex/rescueFates';
import { dbAvailable, ensureSchema } from '@/lib/db/hexLockedStakes';
import { readFates, upsertFates } from '@/lib/db/hexRescueFates';

export const revalidate = 0;
export const maxDuration = 300;

/** Stop starting wallets past this. Measured: a slow wallet can run ~90 s past
 *  the check, and maxDuration is 300 s — each wallet is saved as it finishes,
 *  so a run cut short still keeps its work. */
const TIME_BUDGET_MS = 200_000;

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
    const [rescues, known] = await Promise.all([fetchRescues('pulsechain'), readFates('pulsechain')]);
    const todo = rescues
      .filter((r) => r.claimed === true && r.claimedAt != null && !known.get(r.stakeId)?.final)
      .sort((a, b) => (known.get(a.stakeId)?.checkedAt ?? 0) - (known.get(b.stakeId)?.checkedAt ?? 0));

    const run = await computeFates(todo, started + TIME_BUDGET_MS, (rows) => upsertFates('pulsechain', rows));
    const saved = run.saved;

    return NextResponse.json({
      success: run.problems.length === 0,
      collected: rescues.filter((r) => r.claimed === true).length,
      alreadyFinal: [...known.values()].filter((f) => f.final).length,
      todo: todo.length,
      saved,
      // Wallets whose history is too long to reach the collection are left
      // unstored (outcome unknown) rather than guessed — counted here.
      unresolved: todo.length - saved - run.problems.length,
      deferredWallets: run.deferred,
      problems: run.problems,
      elapsedMs: Date.now() - started,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'rescue fates failed', elapsedMs: Date.now() - started },
      { status: 500 },
    );
  }
}
