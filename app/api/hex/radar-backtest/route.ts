import { NextRequest, NextResponse } from 'next/server';
import { backtestRadar, type TimedEvent } from '@/lib/hex/radarBacktest';
import { hexSubgraphQuery, type HexNet as Net } from '@/lib/hex/subgraph';

export const revalidate = 0;
// Pulls 1000 starts + 1000 ends from the (slower) decentralized gateway on
// Ethereum — past the 10s default.
export const maxDuration = 60;

// We pull more starts than ends so the re-stake window after recent ends is
// well covered (re-stakes happen *after* the end we're scoring).
const ENDS = 1000;
const STARTS = 1000;

async function gql<T>(net: Net, query: string): Promise<T> {
  return hexSubgraphQuery<T>(net, query);
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
