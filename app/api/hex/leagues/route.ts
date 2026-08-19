import { NextRequest, NextResponse } from 'next/server';
import type { HexNet as Net } from '@/lib/hex/subgraph';
import { currentHexDay } from '@/lib/hex/hexDay';
import { LEAGUES, leagueFloor, leagueFor, type LeagueRow } from '@/lib/hex/leagues';
import {
  dbAvailable, getSyncState, readFloorCounts, readStakerSummary, readTopStakers,
} from '@/lib/db/hexLockedStakes';

export const revalidate = 0;
export const maxDuration = 30;

// Served entirely from the synced stake mirror, same as the unlock schedule.
// Ranking stakers live would mean summing every locked stake per address on
// every request; the mirror turns it into one GROUP BY.

const BOARD_SIZE = 250;

export interface LeaguesResponse {
  network: Net;
  currentDay: number;
  /** Live T-Shares across the whole chain — the denominator every league uses. */
  networkTShares: number;
  /** T-Shares held by the ranked stakers. Matches the chain total. */
  rankedTShares: number;
  coveragePct: number;
  lockedStakes: number;
  stakersFound: number;
  rows: LeagueRow[];
  /** Exact staker counts per league. */
  populations: Record<string, number>;
  note: string;
}

export interface IndexingResponse {
  indexing: true;
  progressPct: number;
  stakesIndexed: number;
  reason: string;
}

const round = (n: number, dp = 1) => Number(n.toFixed(dp));

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
          progressPct: round(pct),
          stakesIndexed: state?.lockedStakes ?? 0,
          reason: 'Indexing every stake on the chain. This runs once and takes about 45 minutes.',
        },
        { status: 503 },
      );
    }

    const total = state.networkTShares ?? 0;
    const [top, summary] = await Promise.all([readTopStakers(net, BOARD_SIZE), readStakerSummary(net)]);

    // Cumulative counts per floor come back from the database; the per-tier
    // population is the difference between neighbouring rungs.
    const cumulative = await readFloorCounts(net, LEAGUES.map((l) => leagueFloor(l, total)));
    const populations: Record<string, number> = {};
    LEAGUES.forEach((l, i) => {
      populations[l.key] = cumulative[i] - (i > 0 ? cumulative[i - 1] : 0);
    });

    const body: LeaguesResponse = {
      network: net,
      currentDay: currentHexDay(),
      networkTShares: total,
      rankedTShares: summary.tShares,
      coveragePct: total > 0 ? (summary.tShares / total) * 100 : 0,
      lockedStakes: state.lockedStakes,
      stakersFound: summary.stakers,
      rows: top.map((r, i) => ({
        rank: i + 1,
        address: r.address,
        tShares: r.tShares,
        sharePct: total > 0 ? (r.tShares / total) * 100 : 0,
        principalHex: r.hex,
        stakes: r.stakes,
        leagueKey: leagueFor(r.tShares, total).key,
      })),
      populations,
      note:
        `Ranked over every locked stake on ${net} — ${state.lockedStakes.toLocaleString()} of them across ` +
        `${summary.stakers.toLocaleString()} stakers — from the synced stake index. Ended and ` +
        'good-accounted stakes both sit out: HEX removes their shares from the network total.',
    };
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to read the staker leagues' },
      { status: 500 },
    );
  }
}
