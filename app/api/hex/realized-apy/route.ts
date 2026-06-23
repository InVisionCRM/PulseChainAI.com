import { NextRequest, NextResponse } from 'next/server';
import { realizedApyBuckets, type EndedReturnRow } from '@/lib/hex/realizedApy';

export const revalidate = 0;

type Net = 'ethereum' | 'pulsechain';

// Same subgraphs the staking services use. We read ended stakes straight from
// the subgraph (server-side) so realized returns work even when the DB-backed
// staking cache isn't synced — that was the original blocker for this feature.
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

// How many recent ended stakes to sample for the histogram.
const SAMPLE = 1000;

async function gql<T>(net: Net, query: string): Promise<T> {
  const cfg = SUBGRAPH[net];
  const res = await fetch(cfg.url, { method: 'POST', headers: cfg.headers, body: JSON.stringify({ query }) });
  if (!res.ok) throw new Error(`subgraph ${res.status}`);
  const j = await res.json();
  if (j.errors?.length) throw new Error(j.errors[0]?.message || 'subgraph error');
  return j.data as T;
}

interface RawEnd {
  stakeId: string;
  stakedHearts: string;
  payout: string;
  penalty: string;
  servedDays: string;
}

/** Recent ended stakes, joined to their starts for the committed term. */
async function endedReturnsFromGraph(net: Net): Promise<EndedReturnRow[]> {
  // 1) Most recent ends carry payout/penalty/servedDays/stakedHearts but not the
  //    committed length, so we join back to stakeStarts by stakeId.
  const endsData = await gql<{ stakeEnds: RawEnd[] }>(
    net,
    `{ stakeEnds(orderBy: timestamp, orderDirection: desc, first: ${SAMPLE}){ stakeId stakedHearts payout penalty servedDays } }`,
  );
  const ends = (endsData.stakeEnds ?? []).filter((e) => Number(e.stakedHearts) > 0);
  if (!ends.length) return [];

  // 2) Fetch the committed days for those stakeIds (chunked to keep queries small).
  const committedById = new Map<string, number>();
  const ids = ends.map((e) => e.stakeId);
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500).map((id) => `"${id}"`).join(',');
    try {
      const d = await gql<{ stakeStarts: { stakeId: string; stakedDays: string }[] }>(
        net,
        `{ stakeStarts(where:{ stakeId_in: [${chunk}] }, first: 1000){ stakeId stakedDays } }`,
      );
      for (const s of d.stakeStarts ?? []) committedById.set(String(s.stakeId), Number(s.stakedDays));
    } catch {
      /* best-effort: rows without a matched start are dropped below */
    }
  }

  const rows: EndedReturnRow[] = [];
  for (const e of ends) {
    const committed = committedById.get(String(e.stakeId));
    if (!committed || committed <= 0) continue;
    rows.push({
      committed_days: committed,
      served_days: Number(e.servedDays),
      payout: e.payout,
      penalty: e.penalty,
      staked_hearts: e.stakedHearts,
    });
  }
  return rows;
}

export async function GET(req: NextRequest) {
  const network = (req.nextUrl.searchParams.get('network') === 'ethereum' ? 'ethereum' : 'pulsechain') as Net;
  try {
    const rows = await endedReturnsFromGraph(network);
    const buckets = realizedApyBuckets(rows);
    return NextResponse.json(
      { network, sample: rows.length, buckets },
      { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load realized returns' },
      { status: 500 },
    );
  }
}
