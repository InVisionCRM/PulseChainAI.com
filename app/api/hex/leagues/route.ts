import { NextRequest, NextResponse } from 'next/server';
import type { HexNet as Net } from '@/lib/hex/subgraph';
import { currentHexDay } from '@/lib/hex/hexDay';
import {
  fetchLockedStakes, inactiveStakeIds, networkTotals, remainingStakesFor,
} from '@/lib/hex/lockedStakes';
import {
  rankStakers, leaguePopulations, leagueFloor, LEAGUES, leagueFor, type LeagueRow,
} from '@/lib/hex/leagues';
import { getSyncState, readFloorCounts, readStakerSummary, readTopStakers } from '@/lib/db/hexLockedStakes';

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

/**
 * 'mirror' — every locked stake on the chain, out of the synced Postgres
 *            mirror. Complete, and fast.
 * 'sample' — the largest stakes read live from the subgraph, plus a sweep of
 *            each ranked staker's remainder. Used until the mirror has
 *            finished its first fill, or if there is no database.
 */
export type LeaguesSource = 'mirror' | 'sample';

export interface LeaguesResponse {
  network: Net;
  source: LeaguesSource;
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

/**
 * The complete board, straight out of the mirror. Returns null whenever the
 * mirror can't answer, so the caller falls back to sampling rather than serving
 * a board built on a half-filled table.
 */
async function fromMirror(net: Net): Promise<LeaguesResponse | null> {
  const state = await getSyncState(net).catch(() => null);
  if (!state?.ready) return null;
  const total = state.networkTShares ?? 0;
  if (!(total > 0)) return null;

  const [top, summary] = await Promise.all([readTopStakers(net, 250), readStakerSummary(net)]);
  if (!top.length) return null;

  // Cumulative counts per floor come back from the database; the per-tier
  // population is the difference between neighbouring rungs.
  const floors = LEAGUES.map((l) => leagueFloor(l, total));
  const cumulative = await readFloorCounts(net, floors);
  const populations: Record<string, number> = {};
  LEAGUES.forEach((l, i) => {
    populations[l.key] = cumulative[i] - (i > 0 ? cumulative[i - 1] : 0);
  });

  return {
    network: net,
    source: 'mirror',
    currentDay: currentHexDay(),
    networkTShares: total,
    rankedTShares: summary.tShares,
    coveragePct: total > 0 ? (summary.tShares / total) * 100 : 0,
    cutoffTShares: 0,
    stakesSampled: state.lockedStakes,
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
      `${summary.stakers.toLocaleString()} stakers — from the synced stake mirror. Ended and ` +
      'good-accounted stakes are excluded; HEX removes their shares from the network total.',
  };
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
    source: 'sample',
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
    const mirrored = await fromMirror(net);
    if (mirrored) {
      return NextResponse.json(mirrored, {
        // Cheap to rebuild from the mirror, so it can refresh far more often
        // than the sampled path could afford to.
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
      });
    }
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
