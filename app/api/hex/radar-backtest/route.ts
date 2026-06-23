import { NextRequest, NextResponse } from 'next/server';
import { backtestRadar, type TimedEvent } from '@/lib/hex/radarBacktest';

export const revalidate = 0;

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

// We pull more starts than ends so the re-stake window after recent ends is
// well covered (re-stakes happen *after* the end we're scoring).
const ENDS = 1000;
const STARTS = 1000;

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

export async function GET(req: NextRequest) {
  const net = (req.nextUrl.searchParams.get('network') === 'ethereum' ? 'ethereum' : 'pulsechain') as Net;
  try {
    const data = await gql<{
      stakeEnds: { stakerAddr: string; timestamp: string }[];
      stakeStarts: { stakerAddr: string; timestamp: string }[];
    }>(
      net,
      `{
        stakeEnds(orderBy: timestamp, orderDirection: desc, first: ${ENDS}){ stakerAddr timestamp }
        stakeStarts(orderBy: timestamp, orderDirection: desc, first: ${STARTS}){ stakerAddr timestamp }
      }`,
    );

    const toEvents = (rows: { stakerAddr: string; timestamp: string }[]): TimedEvent[] =>
      rows
        .map((r) => ({ addr: String(r.stakerAddr).toLowerCase(), ts: num(r.timestamp) }))
        .filter((e) => e.addr && e.ts > 0);

    const result = backtestRadar(toEvents(data.stakeEnds ?? []), toEvents(data.stakeStarts ?? []));
    return NextResponse.json(
      { network: net, ...result },
      { headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to backtest radar' },
      { status: 500 },
    );
  }
}
