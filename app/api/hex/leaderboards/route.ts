import { NextRequest, NextResponse } from 'next/server';
import { fetchTopHolders } from '@/lib/portfolio/holders';
import { currentHexDay, HEX_ADDRESS } from '@/lib/hex/hexDay';
import {
  type BoardKey, type RawStart, type RawEnd, type LeaderRow,
  activeByAmount, completedByAmount, highestRoi, activePenalties, depletedStakes, recentPenalties,
  recentStarts, recentEnds, topHolders, aggregateStaked,
} from '@/lib/hex/leaderboards';
import { hexSubgraphQuery, type HexNet as Net } from '@/lib/hex/subgraph';
import { fetchGoodAccountings } from '@/lib/hex/goodAccounting';

export const revalidate = 0;
// The overdue boards (active-penalties / depleted) page deep + fetch good-
// accounting, so give them headroom over the 10s default.
export const maxDuration = 60;

const START_FIELDS = 'stakeId stakerAddr stakedHearts stakeShares stakedDays startDay endDay timestamp';
const END_FIELDS = 'stakeId stakerAddr payout stakedHearts penalty servedDays timestamp';

const gql = hexSubgraphQuery;

/** stakeIds that already have an end event, for excluding still-active stakes. */
async function endedIds(net: Net, starts: RawStart[]): Promise<Set<string>> {
  if (!starts.length) return new Set();
  const ended = new Set<string>();
  const ids = starts.map((s) => s.stakeId);
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500).map((id) => `"${id}"`).join(',');
    try {
      const d = await gql<{ stakeEnds: { stakeId: string }[] }>(
        net,
        `{ stakeEnds(where:{ stakeId_in: [${chunk}] }, first: 1000){ stakeId } }`,
      );
      for (const e of d.stakeEnds ?? []) ended.add(String(e.stakeId));
    } catch {
      /* best-effort */
    }
  }
  return ended;
}

const startsBySize = (net: Net, first: number) =>
  gql<{ stakeStarts: RawStart[] }>(net, `{ stakeStarts(orderBy: stakedHearts, orderDirection: desc, first: ${first}){ ${START_FIELDS} } }`)
    .then((d) => d.stakeStarts ?? []);

const recentStartRows = (net: Net, first: number) =>
  gql<{ stakeStarts: RawStart[] }>(net, `{ stakeStarts(orderBy: timestamp, orderDirection: desc, first: ${first}){ ${START_FIELDS} } }`)
    .then((d) => d.stakeStarts ?? []);

const recentEndRows = (net: Net, first: number) =>
  gql<{ stakeEnds: RawEnd[] }>(net, `{ stakeEnds(orderBy: timestamp, orderDirection: desc, first: ${first}){ ${END_FIELDS} } }`)
    .then((d) => d.stakeEnds ?? []);

const endsBySize = (net: Net, first: number) =>
  gql<{ stakeEnds: RawEnd[] }>(net, `{ stakeEnds(orderBy: stakedHearts, orderDirection: desc, first: ${first}){ ${END_FIELDS} } }`)
    .then((d) => d.stakeEnds ?? []);

const endsByServed = (net: Net, first: number) =>
  gql<{ stakeEnds: RawEnd[] }>(net, `{ stakeEnds(orderBy: servedDays, orderDirection: desc, first: ${first}){ ${END_FIELDS} } }`)
    .then((d) => d.stakeEnds ?? []);

// 1,000,000 HEX in hearts (1 HEX = 1e8 hearts) — the overdue board's floor.
const MIN_OVERDUE_HEARTS = '100000000000000';

/**
 * Candidate overdue stakes: ≥1M HEX and past their end day, biggest first.
 * We pull the largest such stakes straight from the subgraph (so the board is
 * ordered by size) and drop any that have actually ended; the pure
 * `activePenalties` / `depletedStakes` then split them by penalty status and
 * drop good-accounted ones.
 */
async function overdueBigStakes(net: Net, currentDay: number): Promise<RawStart[]> {
  let rows: RawStart[] = [];
  try {
    const d = await gql<{ stakeStarts: RawStart[] }>(
      net,
      `{ stakeStarts(where:{ stakedHearts_gte: "${MIN_OVERDUE_HEARTS}", endDay_lt: ${currentDay} }, orderBy: stakedHearts, orderDirection: desc, first: 1000){ ${START_FIELDS} } }`,
    );
    rows = d.stakeStarts ?? [];
  } catch {
    return [];
  }
  const ended = await endedIds(net, rows);
  return rows.filter((r) => !ended.has(String(r.stakeId)));
}

// Past the full 14-day grace + 700-day bleed = a stake is fully depleted.
const FULLY_BLED_DAYS = 714;

/**
 * Candidate fully-depleted stakes: end day ≥714 days in the past, largest first,
 * NO size floor (fully-bled stakes are rarer, so we surface the biggest that
 * exist). Ended ones are dropped; the pure `depletedStakes` then drops
 * good-accounted ones (which were frozen and never actually bled out).
 */
async function depletedCandidates(net: Net, currentDay: number): Promise<RawStart[]> {
  const cutoff = currentDay - FULLY_BLED_DAYS;
  let rows: RawStart[] = [];
  try {
    const d = await gql<{ stakeStarts: RawStart[] }>(
      net,
      `{ stakeStarts(where:{ endDay_lt: ${cutoff} }, orderBy: stakedHearts, orderDirection: desc, first: 1000){ ${START_FIELDS} } }`,
    );
    rows = d.stakeStarts ?? [];
  } catch {
    return [];
  }
  const ended = await endedIds(net, rows);
  return rows.filter((r) => !ended.has(String(r.stakeId)));
}

async function buildBoard(net: Net, board: BoardKey): Promise<{ rows: LeaderRow[]; sample: number; note?: string }> {
  const currentDay = currentHexDay();
  switch (board) {
    case 'active-amount': {
      const starts = await startsBySize(net, 1000);
      const ended = await endedIds(net, starts);
      const active = starts.filter((s) => !ended.has(String(s.stakeId)));
      return { rows: activeByAmount(active, currentDay), sample: starts.length };
    }
    case 'completed-amount': {
      const ends = await endsBySize(net, 200);
      return { rows: completedByAmount(ends), sample: ends.length };
    }
    case 'roi': {
      // Longest-served ends are the strongest ROI candidates; sample then rank.
      const ends = await endsByServed(net, 1000);
      return { rows: highestRoi(ends), sample: ends.length, note: 'Ranked over the 1,000 longest-served ended stakes.' };
    }
    case 'active-penalties': {
      const overdue = await overdueBigStakes(net, currentDay);
      const gaIds = new Set((await fetchGoodAccountings(net, overdue.map((s) => s.stakeId))).keys());
      return {
        rows: activePenalties(overdue, currentDay, gaIds),
        sample: overdue.length,
        note: 'Active stakes ≥1M HEX past their end day, actively bleeding the late-end penalty, largest first. Good-accounted (frozen) stakes are excluded — they’ve stopped bleeding. “Lost” = share of the stake gone to the penalty so far.',
      };
    }
    case 'depleted': {
      const candidates = await depletedCandidates(net, currentDay);
      const gaIds = new Set((await fetchGoodAccountings(net, candidates.map((s) => s.stakeId))).keys());
      return {
        rows: depletedStakes(candidates, currentDay, gaIds),
        sample: candidates.length,
        note: 'Stakes that never got good-accounted and bled the full 700-day penalty period past the 14-day grace — the entire return is gone. Largest first; good-accounted (frozen) stakes are excluded.',
      };
    }
    case 'recent-penalties': {
      const ends = await recentEndRows(net, 1000);
      return { rows: recentPenalties(ends), sample: ends.length };
    }
    case 'recent-starts': {
      const starts = await recentStartRows(net, 100);
      return { rows: recentStarts(starts), sample: starts.length };
    }
    case 'recent-ends': {
      const ends = await recentEndRows(net, 100);
      return { rows: recentEnds(ends), sample: ends.length };
    }
    case 'holders': {
      // HEX has no native staking subgraph for ethereum HEX holders count here;
      // liquid holders come from Blockscout, staked from the biggest active stakes.
      const [set, starts] = await Promise.all([
        fetchTopHolders(net, HEX_ADDRESS, 250).catch(() => null),
        startsBySize(net, 1000),
      ]);
      const ended = await endedIds(net, starts);
      const active = starts.filter((s) => !ended.has(String(s.stakeId)));
      const decimals = set?.decimals ?? 8;
      const liquid = (set?.nodes ?? []).map((n) => ({
        address: n.address,
        balanceHex: Number(n.balanceRaw) / 10 ** decimals,
        label: n.label,
      }));
      const staked = aggregateStaked(active);
      return {
        rows: topHolders(liquid, staked),
        sample: liquid.length + staked.length,
        note: 'Liquid from the top 250 holders; staked aggregated from the largest active stakes.',
      };
    }
    default:
      return { rows: [], sample: 0 };
  }
}

const BOARD_KEYS: BoardKey[] = [
  'active-amount', 'completed-amount', 'roi', 'active-penalties', 'depleted',
  'recent-penalties', 'recent-starts', 'recent-ends', 'holders',
];

export async function GET(req: NextRequest) {
  const net = (req.nextUrl.searchParams.get('network') === 'ethereum' ? 'ethereum' : 'pulsechain') as Net;
  const board = req.nextUrl.searchParams.get('board') as BoardKey | null;
  if (!board || !BOARD_KEYS.includes(board)) {
    return NextResponse.json({ error: 'unknown board' }, { status: 400 });
  }
  try {
    const { rows, sample, note } = await buildBoard(net, board);
    return NextResponse.json(
      { network: net, board, sample, note, rows },
      { headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=1800' } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load leaderboard' },
      { status: 500 },
    );
  }
}
