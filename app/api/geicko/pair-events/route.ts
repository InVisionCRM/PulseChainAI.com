import { NextRequest, NextResponse } from 'next/server';
import { PULSEX_SUBGRAPHS, gql, cleanUsd, num } from '@/lib/geicko/pulsex';
import { cached } from '@/lib/geicko/serverCache';

// Recent liquidity add/remove events for a single pair, from the PulseX subgraph.
// The Liquidity tab used to scan a pair's transactions for `addLiquidity` /
// `removeLiquidity` methods — but those are ROUTER methods; at the pair contract
// the call is `mint` / `burn`, so that scan matched nothing. The subgraph's
// mint/burn entities are the correct source.

export const revalidate = 0;
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const pair = (req.nextUrl.searchParams.get('pair') || '').toLowerCase();
  if (!pair) return NextResponse.json({ error: 'pair required' }, { status: 400 });

  const fields = `{ timestamp amountUSD amount0 amount1 to sender transaction{ id } }`;
  const map = (e: any, type: 'add' | 'remove') => ({
    type,
    ts: num(e.timestamp),
    usd: cleanUsd(e.amountUSD),
    amount0: num(e.amount0),
    amount1: num(e.amount1),
    wallet: e.to || e.sender || '',
    tx: e.transaction?.id ?? '',
  });

  try {
    const events = await cached(`pair-events:${pair}`, 600_000, async () => {
      // A pair is indexed by exactly one PulseX subgraph (v1 or v2), so query both
      // and merge — the version-mismatched one just returns nothing.
      const perGraph = await Promise.all(
        PULSEX_SUBGRAPHS.map(async (url) => {
          const d = await gql(
            url,
            `{ mints(first:15, orderBy:timestamp, orderDirection:desc, where:{pair:"${pair}"}) ${fields}
               burns(first:15, orderBy:timestamp, orderDirection:desc, where:{pair:"${pair}"}) ${fields} }`,
          );
          if (!d) return [] as ReturnType<typeof map>[];
          return [
            ...((d.mints ?? []) as any[]).map((m) => map(m, 'add')),
            ...((d.burns ?? []) as any[]).map((b) => map(b, 'remove')),
          ];
        }),
      );
      return perGraph.flat().sort((a, b) => b.ts - a.ts).slice(0, 20);
    });

    return NextResponse.json(
      { pair, events },
      { headers: { 'Cache-Control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=7200' } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load pair events' },
      { status: 500 },
    );
  }
}
