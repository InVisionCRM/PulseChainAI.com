import { NextRequest, NextResponse } from 'next/server';
import type { HexNet as Net } from '@/lib/hex/subgraph';
import { currentHexDay } from '@/lib/hex/hexDay';
import {
  fetchLockedStakes, inactiveStakeIds, networkTotals, remainingStakesFor,
} from '@/lib/hex/lockedStakes';
import { rankStakers, leaguePopulations, type LeagueRow } from '@/lib/hex/leagues';

export const revalidate = 0;
// Deep-samples the share distribution then sweeps every ranked staker's
// remaining stakes — well past the 10s default, so give it real headroom.
export const maxDuration = 60;

// The ranking is built in two passes, because there is no per-staker share
// aggregate in the subgraph:
//
//   1. Take the largest stakes on the chain (see lockedStakes). That surfaces
//      every address that could plausibly rank — one is only missed entirely if
//      its whole position sits in stakes below the sample's floor.
//   2. Sweep those ranked addresses' REMAINING stakes so a displayed total is
//      the real total. This matters: pass 1 alone understated one laddered
//      address by 20,000 T-Shares and put it 30 ranks too low.

/** 3 × 5,000 stakes. */
const SAMPLE_BATCHES = 3;
/** How many ranked addresses get the pass-2 sweep. */
const SWEEP_ADDRESSES = 300;

export interface LeaguesResponse {
  network: Net;
  currentDay: number;
  /** Live T-Shares across the whole chain — the denominator every league uses. */
  networkTShares: number;
  /** T-Shares held by the stakers we ranked. */
  rankedTShares: number;
  /** rankedTShares as a % of networkTShares — how complete the ranking is. */
  coveragePct: number;
  /** Smallest single stake in the sample, in T-Shares. */
  cutoffTShares: number;
  stakesSampled: number;
  stakersFound: number;
  rows: LeagueRow[];
  /** Stakers seen per league — LOWER BOUNDS (see `leaguePopulations`). */
  populations: Record<string, number>;
  note: string;
}

async function buildLeagues(net: Net): Promise<LeaguesResponse> {
  const [totals, sample] = await Promise.all([networkTotals(net), fetchLockedStakes(net, SAMPLE_BATCHES)]);
  const total = totals.tShares;

  // Pass 2 — sweep the small stakes of everyone who ranks off pass 1.
  const provisional = rankStakers(sample.live, total, SWEEP_ADDRESSES);
  const extra = await remainingStakesFor(net, provisional.map((r) => r.address), sample.cutoffShares);
  const extraDead = extra.length ? await inactiveStakeIds(net, extra.map((s) => String(s.stakeId))) : new Set<string>();
  const extraLive = extra.filter((s) => !extraDead.has(String(s.stakeId)));

  const all = [...sample.live, ...extraLive];
  const ranked = rankStakers(all, total, Number.MAX_SAFE_INTEGER);
  const rows = ranked.slice(0, 250);
  const rankedTShares = ranked.reduce((s, r) => s + r.tShares, 0);
  const cutoffTShares = Number(sample.cutoffShares) / 1e12;

  return {
    network: net,
    currentDay: currentHexDay(),
    networkTShares: total,
    rankedTShares,
    coveragePct: total > 0 ? (rankedTShares / total) * 100 : 0,
    cutoffTShares,
    stakesSampled: sample.sampled + extra.length,
    stakersFound: new Set(all.map((s) => s.stakerAddr.toLowerCase())).size,
    rows,
    populations: leaguePopulations(ranked.map((r) => r.tShares), total),
    note:
      `Ranked from the ${sample.sampled.toLocaleString()} largest stakes on ${net} ` +
      `(down to ${cutoffTShares.toLocaleString(undefined, { maximumFractionDigits: 0 })} T-Shares each), ` +
      'plus a full sweep of every ranked staker’s remaining stakes. Ended and good-accounted ' +
      'stakes are excluded — HEX removes their shares from the network total. A staker whose ' +
      'entire position sits in stakes below the cutoff may not appear; check any address directly above.',
  };
}

export async function GET(req: NextRequest) {
  const net = (req.nextUrl.searchParams.get('network') === 'ethereum' ? 'ethereum' : 'pulsechain') as Net;
  try {
    const data = await buildLeagues(net);
    return NextResponse.json(data, {
      // Expensive to build and only moves as stakes open and close, so serve it
      // from cache and refresh in the background rather than making anyone wait.
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build staker leagues' },
      { status: 500 },
    );
  }
}
