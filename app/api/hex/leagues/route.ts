import { NextRequest, NextResponse } from 'next/server';
import { hexSubgraphQuery, type HexNet as Net } from '@/lib/hex/subgraph';
import { currentHexDay } from '@/lib/hex/hexDay';
import { rankStakers, leaguePopulations, type ShareStake, type LeagueRow } from '@/lib/hex/leagues';

export const revalidate = 0;
// Deep-samples the share distribution then sweeps every ranked staker's
// remaining stakes — well past the 10s default, so give it real headroom.
export const maxDuration = 60;

const gql = hexSubgraphQuery;
const FIELDS = 'stakeId stakerAddr stakeShares stakedHearts';

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------
//
// There is no aggregate "shares per staker" entity in the HEX subgraph, so the
// ranking has to be built from individual stakes. Pulling every stake ever
// opened (~950k) is not possible inside a request, so we do it in two passes:
//
//   1. Take the SAMPLE_SIZE largest stakes on the chain by shares. That is
//      enough to surface every address that could plausibly rank — an address
//      is only missed entirely if its whole position is spread across stakes
//      smaller than the sample's cutoff.
//   2. For every address that ranks off pass 1, sweep its REMAINING stakes
//      (the ones below the cutoff) so its displayed total is its real total.
//      This matters a lot: laddered stakers routinely hold most of their shares
//      in dozens of small stakes, and pass 1 alone understated one address by
//      20,000 T-Shares.

const PAGE = 1000;
// graph-node refuses `skip` above 5000, so a batch is 5 pages and the next
// batch continues from the last batch's smallest share value.
const PAGES_PER_BATCH = 5;
const SAMPLE_BATCHES = 3; // 15,000 largest stakes
/** How many ranked addresses get the pass-2 sweep. */
const SWEEP_ADDRESSES = 300;
const SWEEP_GROUP = 100;
const ID_CHUNK = 500;
const CHUNK_CONCURRENCY = 8;

/** Run `work` over `items` with a fixed number in flight. */
async function pooled<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(work))));
  }
  return out;
}

/** The largest stakes on the chain by shares, biggest first. */
async function largestStakes(net: Net): Promise<ShareStake[]> {
  const seen = new Map<string, ShareStake>();
  let cursor: string | null = null;
  for (let b = 0; b < SAMPLE_BATCHES; b++) {
    // `_lte` (not `_lt`) so stakes tied on the boundary value aren't skipped;
    // the map de-duplicates the boundary rows that come back twice.
    const where = cursor ? `, where:{ stakeShares_lte: "${cursor}" }` : '';
    const pages = await Promise.all(
      Array.from({ length: PAGES_PER_BATCH }, (_, i) =>
        gql<{ stakeStarts: ShareStake[] }>(
          net,
          `{ stakeStarts(orderBy: stakeShares, orderDirection: desc, first: ${PAGE}, skip: ${i * PAGE}${where}){ ${FIELDS} } }`,
        ).then((d) => d.stakeStarts ?? []),
      ),
    );
    const flat = pages.flat();
    const fresh = flat.filter((s) => !seen.has(String(s.stakeId)));
    for (const s of flat) seen.set(String(s.stakeId), s);
    // Exhausted the chain, or the batch brought nothing new — stop paging.
    if (flat.length < PAGE * PAGES_PER_BATCH || fresh.length === 0) break;
    cursor = flat.reduce((min, s) => (BigInt(s.stakeShares) < BigInt(min) ? s.stakeShares : min), flat[0].stakeShares);
  }
  return [...seen.values()].sort((a, b) => (BigInt(b.stakeShares) > BigInt(a.stakeShares) ? 1 : -1));
}

/**
 * Every stake below `belowShares` belonging to one of `addresses`. Pass 2 of
 * the sampling — this is what makes a ranked address's total its real total.
 */
async function remainingStakes(net: Net, addresses: string[], belowShares: string): Promise<ShareStake[]> {
  const groups: string[][] = [];
  for (let i = 0; i < addresses.length; i += SWEEP_GROUP) groups.push(addresses.slice(i, i + SWEEP_GROUP));
  const sweep = async (group: string[]): Promise<ShareStake[]> => {
    const list = group.map((a) => `"${a}"`).join(',');
    const out: ShareStake[] = [];
    let cursor = belowShares;
    // Cursor-paged rather than skip-paged: a large group can hold well over
    // 5000 small stakes, which is exactly where `skip` gives out.
    for (let page = 0; page < 6; page++) {
      const d = await gql<{ stakeStarts: ShareStake[] }>(
        net,
        `{ stakeStarts(where:{ stakerAddr_in: [${list}], stakeShares_lt: "${cursor}" }, orderBy: stakeShares, orderDirection: desc, first: ${PAGE}){ ${FIELDS} } }`,
      );
      const rows = d.stakeStarts ?? [];
      out.push(...rows);
      if (rows.length < PAGE) break;
      cursor = rows[rows.length - 1].stakeShares;
    }
    return out;
  };
  return (await pooled(groups, 3, sweep)).flat();
}

/**
 * stakeIds whose shares no longer count toward the network total — ended OR
 * good-accounted. HEX removes a stake's shares from `stakeSharesTotal` in both
 * cases, so a league ranking that counted either would overstate holders.
 *
 * Both lookups ride the same request per chunk. A chunk that fails is retried
 * once and then throws: silently treating a dead stake as live would inflate
 * someone's rank, and a wrong leaderboard is worse than a failed one.
 */
async function inactiveStakeIds(net: Net, ids: string[]): Promise<Set<string>> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) chunks.push(ids.slice(i, i + ID_CHUNK));
  const lookup = async (chunk: string[]) => {
    const list = chunk.map((id) => `"${id}"`).join(',');
    const q = `{
      ends: stakeEnds(where:{ stakeId_in: [${list}] }, first: ${PAGE}){ stakeId }
      accounted: stakeGoodAccountings(where:{ stakeId_in: [${list}] }, first: ${PAGE}){ stakeId }
    }`;
    type Res = { ends: { stakeId: string }[]; accounted: { stakeId: string }[] };
    try {
      return await gql<Res>(net, q);
    } catch {
      return gql<Res>(net, q);
    }
  };
  const results = await pooled(chunks, CHUNK_CONCURRENCY, lookup);
  const out = new Set<string>();
  for (const r of results) {
    for (const e of r.ends ?? []) out.add(String(e.stakeId));
    for (const g of r.accounted ?? []) out.add(String(g.stakeId));
  }
  return out;
}

/** The network's live T-Share total, straight from the subgraph's globalInfo. */
async function networkTShares(net: Net): Promise<number> {
  const d = await gql<{ globalInfos: { stakeSharesTotal: string }[] }>(
    net,
    '{ globalInfos(first: 1, orderBy: timestamp, orderDirection: desc){ stakeSharesTotal } }',
  );
  return Number(d.globalInfos?.[0]?.stakeSharesTotal ?? 0) / 1e12;
}

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
  const [total, sample] = await Promise.all([networkTShares(net), largestStakes(net)]);
  if (!sample.length) throw new Error('No stakes returned by the HEX subgraph');

  const dead = await inactiveStakeIds(net, sample.map((s) => String(s.stakeId)));
  const live = sample.filter((s) => !dead.has(String(s.stakeId)));

  // Pass 2 — sweep the small stakes of everyone who ranks off pass 1.
  const cutoffShares = sample[sample.length - 1].stakeShares;
  const provisional = rankStakers(live, total, SWEEP_ADDRESSES);
  const extra = await remainingStakes(net, provisional.map((r) => r.address), cutoffShares);
  const extraDead = extra.length ? await inactiveStakeIds(net, extra.map((s) => String(s.stakeId))) : new Set<string>();
  const extraLive = extra.filter((s) => !extraDead.has(String(s.stakeId)));

  const all = [...live, ...extraLive];
  const ranked = rankStakers(all, total, Number.MAX_SAFE_INTEGER);
  const rows = ranked.slice(0, 250);
  const rankedTShares = ranked.reduce((s, r) => s + r.tShares, 0);
  const cutoffTShares = Number(cutoffShares) / 1e12;

  return {
    network: net,
    currentDay: currentHexDay(),
    networkTShares: total,
    rankedTShares,
    coveragePct: total > 0 ? (rankedTShares / total) * 100 : 0,
    cutoffTShares,
    stakesSampled: sample.length + extra.length,
    stakersFound: new Set(all.map((s) => s.stakerAddr.toLowerCase())).size,
    rows,
    populations: leaguePopulations(ranked.map((r) => r.tShares), total),
    note:
      `Ranked from the ${sample.length.toLocaleString()} largest stakes on ${net} ` +
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
