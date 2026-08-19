import { NextRequest, NextResponse } from 'next/server';
import type { HexNet as Net } from '@/lib/hex/subgraph';
import { currentHexDay } from '@/lib/hex/hexDay';
import { scheduleFromBuckets, type UnlockBucket } from '@/lib/hex/unlockSchedule';
import { dbAvailable, getSyncState, readFrozen, readSchedule } from '@/lib/db/hexLockedStakes';

export const revalidate = 0;
export const maxDuration = 30;

// Served entirely from the synced stake mirror — one data path, one set of
// numbers. There is deliberately no live-subgraph fallback: the subgraph cannot
// answer "how much matures on each day" without summing hundreds of thousands
// of individual stakes, so any live path is a size-ranked sample that quietly
// disagrees with the mirror. Two sets of figures for the same chart is worse
// than one honest "still indexing" message.

export interface UnlockScheduleResponse {
  network: Net;
  currentDay: number;
  /** Per-day buckets as [day, hex, tShares, stakes] — compact on the wire,
   *  since a 15-year daily schedule is a few thousand of them. */
  buckets: [number, number, number, number][];
  overdue: UnlockBucket;
  /** The good-accounted slice of `overdue` — frozen, not bleeding. */
  frozen: { hex: number; stakes: number };
  totals: { hex: number; tShares: number; stakes: number };
  /** The chain's own locked totals, for the reconciliation figure. */
  network_totals: { hex: number; tShares: number };
  coverage: { hexPct: number; tSharesPct: number };
  lastDay: number;
  note: string;
}

/** Returned while the mirror is still building, so the UI can show progress. */
export interface IndexingResponse {
  indexing: true;
  /** 0–100 through the initial fill. */
  progressPct: number;
  stakesIndexed: number;
  reason: string;
}

const round = (n: number, dp = 2) => Number(n.toFixed(dp));

export async function GET(req: NextRequest) {
  const net = (req.nextUrl.searchParams.get('network') === 'ethereum' ? 'ethereum' : 'pulsechain') as Net;

  if (!dbAvailable()) {
    return NextResponse.json<IndexingResponse>(
      {
        indexing: true,
        progressPct: 0,
        stakesIndexed: 0,
        reason: 'The stake index is not configured yet (no DATABASE_URL).',
      },
      { status: 503 },
    );
  }

  try {
    const state = await getSyncState(net);
    if (!state?.ready) {
      const pct = state && state.latestStakeId > 0
        ? Math.min(99, (state.lastStakeId / state.latestStakeId) * 100)
        : 0;
      return NextResponse.json<IndexingResponse>(
        {
          indexing: true,
          progressPct: round(pct, 1),
          stakesIndexed: state?.lockedStakes ?? 0,
          reason: 'Indexing every stake on the chain. This runs once and takes about 45 minutes.',
        },
        { status: 503 },
      );
    }

    const [buckets, frozen] = await Promise.all([readSchedule(net), readFrozen(net)]);
    const totals = { tShares: state.networkTShares ?? 0, hexLocked: state.networkHex ?? 0 };
    const schedule = scheduleFromBuckets(buckets, currentHexDay(), totals, frozen);

    const body: UnlockScheduleResponse = {
      network: net,
      currentDay: schedule.currentDay,
      buckets: schedule.buckets.map((b) => [b.day, round(b.hex), round(b.tShares, 3), b.stakes]),
      overdue: schedule.overdue,
      frozen: schedule.frozen,
      totals: schedule.totals,
      network_totals: { hex: totals.hexLocked, tShares: totals.tShares },
      coverage: schedule.coverage,
      lastDay: schedule.lastDay,
      note:
        `Every locked stake on ${net} — ${schedule.totals.stakes.toLocaleString()} of them — from the ` +
        'synced stake index, refreshed every couple of minutes. Ended stakes are excluded; ' +
        'good-accounted ones are included, because good-accounting returns the shares to the ' +
        'network but leaves the HEX in the contract until someone ends the stake.',
    };
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to read the unlock schedule' },
      { status: 500 },
    );
  }
}
