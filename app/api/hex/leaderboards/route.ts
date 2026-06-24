import { NextRequest, NextResponse } from 'next/server';
import { fetchTopHolders } from '@/lib/portfolio/holders';
import { currentHexDay, HEX_ADDRESS } from '@/lib/hex/hexDay';
import {
  type BoardKey, type RawStart, type RawEnd, type LeaderRow,
  activeByAmount, completedByAmount, highestRoi, mostDaysLate, recentPenalties,
  recentStarts, recentEnds, topHolders, aggregateStaked,
} from '@/lib/hex/leaderboards';

export const revalidate = 0;
// The days-late board can page deep, so give it headroom over the 10s default.
export const maxDuration = 60;

type Net = 'ethereum' | 'pulsechain';

const SUBGRAPH: Record<Net, { url: string; headers: Record<string, string> }> = {
  pulsechain: {
    url: 'https://graph.pulsechain.com/subgraphs/name/Codeakk/Hex',
    headers: { 'Content-Type': 'application/json' },
  },
  ethereum: {
    url: 'https://gateway.thegraph.com/api/subgraphs/id/A6JyHRn6CUvvgBZwni9JyrgovKWK6FoSQ8TVt6JJGhcp',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer a08fcab20e333b38bb75daf3d97a0bb5' },
  },
};

const START_FIELDS = 'stakeId stakerAddr stakedHearts stakeShares stakedDays startDay endDay timestamp';
const END_FIELDS = 'stakeId stakerAddr payout stakedHearts penalty servedDays timestamp';

async function gql<T>(net: Net, query: string): Promise<T> {
  const cfg = SUBGRAPH[net];
  const res = await fetch(cfg.url, { method: 'POST', headers: cfg.headers, body: JSON.stringify({ query }) });
  if (!res.ok) throw new Error(`subgraph ${res.status}`);
  const j = await res.json();
  if (j.errors?.length) throw new Error(j.errors[0]?.message || 'subgraph error');
  return j.data as T;
}

const num = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

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

/** Committed days per stakeId, joined from starts (for the days-late board). */
async function committedDaysFor(net: Net, ends: RawEnd[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const ids = ends.map((e) => e.stakeId);
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500).map((id) => `"${id}"`).join(',');
    try {
      const d = await gql<{ stakeStarts: { stakeId: string; stakedDays: string }[] }>(
        net,
        `{ stakeStarts(where:{ stakeId_in: [${chunk}] }, first: 1000){ stakeId stakedDays } }`,
      );
      for (const s of d.stakeStarts ?? []) map.set(String(s.stakeId), num(s.stakedDays));
    } catch {
      /* best-effort */
    }
  }
  return map;
}

/**
 * Exact global top-100 by lateness across all ended stakes. We stream ends
 * ordered by servedDays descending and join their committed days. Because
 * lateness = servedDays − committedDays ≤ servedDays, once the stream's
 * servedDays drops at or below our current 100th-best lateness, no unscanned
 * end can beat it — so we stop early with a provably complete result. A page
 * cap bounds the worst case; if hit, the result is "top-100 among the longest
 * served" rather than provably global.
 */
async function daysLateGlobal(net: Net): Promise<{ rows: LeaderRow[]; scanned: number; exact: boolean }> {
  const PAGE = 1000;
  const MAX_PAGES = 40;
  const ends: RawEnd[] = [];
  const committed = new Map<string, number>();
  const topLate: number[] = []; // sorted desc, capped at 100 — just the threshold
  let cursor: number | null = null; // servedDays_lt for the next page
  let exact = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const where = cursor == null ? '' : `where:{ servedDays_lt: ${cursor} }, `;
    let rows: RawEnd[];
    try {
      const d = await gql<{ stakeEnds: RawEnd[] }>(
        net,
        `{ stakeEnds(${where}orderBy: servedDays, orderDirection: desc, first: ${PAGE}){ ${END_FIELDS} } }`,
      );
      rows = d.stakeEnds ?? [];
    } catch {
      break; // orderBy unsupported / transient — return what we have
    }
    if (rows.length === 0) { exact = true; break; }

    const pageMinServed = Number(rows[rows.length - 1].servedDays);
    const c = await committedDaysFor(net, rows);
    for (const [k, v] of c) committed.set(k, v);

    for (const e of rows) {
      ends.push(e);
      const cd = committed.get(String(e.stakeId));
      if (cd == null) continue;
      const late = Number(e.servedDays) - cd;
      if (late <= 0) continue;
      if (topLate.length < 100) {
        topLate.push(late);
        topLate.sort((a, b) => b - a);
      } else if (late > topLate[99]) {
        topLate[99] = late;
        topLate.sort((a, b) => b - a);
      }
    }

    cursor = pageMinServed;
    // Early stop: the best any remaining end could score is its servedDays,
    // and all remaining have servedDays < pageMinServed ≤ topLate[99].
    if (topLate.length >= 100 && pageMinServed <= topLate[99]) { exact = true; break; }
  }

  return { rows: mostDaysLate(ends, committed, 100), scanned: ends.length, exact };
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
    case 'days-late': {
      const { rows, scanned, exact } = await daysLateGlobal(net);
      return {
        rows,
        sample: scanned,
        note: exact
          ? `Exact global ranking — scanned every ended stake down to the cut-off (${scanned.toLocaleString()} checked).`
          : `Top 100 among the ${scanned.toLocaleString()} longest-served ended stakes (scan cap reached).`,
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
  'active-amount', 'completed-amount', 'roi', 'days-late',
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
