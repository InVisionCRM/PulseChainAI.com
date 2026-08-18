import { NextRequest, NextResponse } from 'next/server';
import type { HexNet as Net } from '@/lib/hex/subgraph';
import { currentHexDay } from '@/lib/hex/hexDay';
import { fetchLockedStakes, networkTotals } from '@/lib/hex/lockedStakes';
import { buildSchedule, type UnlockBucket } from '@/lib/hex/unlockSchedule';

export const revalidate = 0;
// Pages 25,000 stakes and filters them against the end/good-accounting tables.
export const maxDuration = 60;

/** 5 × 5,000 stakes — ~94% of the chain's live T-Shares (see lockedStakes). */
const SAMPLE_BATCHES = 5;

export interface UnlockScheduleResponse {
  network: Net;
  currentDay: number;
  /** Per-day buckets as [day, hex, tShares, stakes] — compact on the wire,
   *  since a 15-year daily schedule is a few thousand of them. */
  buckets: [number, number, number, number][];
  overdue: UnlockBucket;
  totals: { hex: number; tShares: number; stakes: number };
  /** The chain's real locked totals, for the coverage figure. */
  network_totals: { hex: number; tShares: number };
  coverage: { hexPct: number; tSharesPct: number };
  lastDay: number;
  stakesSampled: number;
  cutoffTShares: number;
  note: string;
}

const round = (n: number, dp = 2) => Number(n.toFixed(dp));

export async function GET(req: NextRequest) {
  const net = (req.nextUrl.searchParams.get('network') === 'ethereum' ? 'ethereum' : 'pulsechain') as Net;
  try {
    const [totals, sample] = await Promise.all([
      networkTotals(net),
      fetchLockedStakes(net, SAMPLE_BATCHES),
    ]);
    const schedule = buildSchedule(sample.live, currentHexDay(), totals);
    const cutoffTShares = Number(sample.cutoffShares) / 1e12;

    const body: UnlockScheduleResponse = {
      network: net,
      currentDay: schedule.currentDay,
      buckets: schedule.buckets.map((b) => [b.day, round(b.hex), round(b.tShares, 3), b.stakes]),
      overdue: schedule.overdue,
      totals: schedule.totals,
      network_totals: { hex: totals.hexLocked, tShares: totals.tShares },
      coverage: schedule.coverage,
      lastDay: schedule.lastDay,
      stakesSampled: sample.sampled,
      cutoffTShares,
      note:
        `Built from the ${sample.sampled.toLocaleString()} largest stakes on ${net} ` +
        `(down to ${cutoffTShares.toLocaleString(undefined, { maximumFractionDigits: 0 })} T-Shares each), ` +
        `covering ${schedule.coverage.tSharesPct.toFixed(1)}% of the chain's live T-Shares and ` +
        `${schedule.coverage.hexPct.toFixed(1)}% of its locked HEX. Ended and good-accounted stakes are ` +
        'excluded — among stakes still dated in the future, roughly a fifth of the HEX has already been ' +
        'withdrawn early. The remainder is a long tail of small stakes no single request can page through.',
    };
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build the unlock schedule' },
      { status: 500 },
    );
  }
}
