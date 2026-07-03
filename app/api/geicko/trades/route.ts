import { NextRequest, NextResponse } from 'next/server';
import { PULSEX_SUBGRAPHS, gql, getTokenPairIds, pageSwaps, cleanUsd, num, type SwapRow } from '@/lib/geicko/pulsex';

// Recent buys/sells + top traders for a token, from PulseX swaps (v1 + v2) —
// the DexScreener-style transactions view, computed from the subgraph so it's
// free. Each swap is classified as a buy/sell of the token by direction; the
// trader is the swap recipient (`to`), which is the closest on-graph proxy for
// the wallet (the `sender` is almost always a router).
//
// Top traders aggregates the last 24h by wallet (bought / sold / net USD). This
// is realized flow over the window, not lifetime PnL — we have no cost basis.
// PulseChain only, free.

export const revalidate = 0;
export const maxDuration = 60;

const HOUR = 3_600;
const RECENT = 60;      // rows in the live trades feed
const TOP_N = 25;       // wallets in the top-traders table

// Known routers/aggregators that show up as `to` on multi-hop routes — excluded
// from "top traders" so the table shows wallets, not infrastructure.
const ROUTERS = new Set<string>([
  '0x165c3410fc91ef562c50559f7d2289febed552d9', // PulseX router v2
  '0x98bf93ebf5c380c0e6ae8e192a7e2ae08edacc02', // PulseX router v1
]);
const ZERO = '0x0000000000000000000000000000000000000000';

const RECENT_FIELDS =
  `{ timestamp amountUSD amount0In amount1In amount0Out amount1Out to transaction{ id } pair{ token0{ id } } }`;

function classify(s: { amount0In: string; amount1In: string; amount0Out: string; amount1Out: string; pair: { token0: { id: string } } }, token: string) {
  const isTok0 = s.pair.token0.id.toLowerCase() === token;
  const out = isTok0 ? num(s.amount0Out) : num(s.amount1Out);
  const inn = isTok0 ? num(s.amount0In) : num(s.amount1In);
  return { isBuy: out >= inn, tokenAmount: out >= inn ? out : inn };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chain = (sp.get('network') || 'pulsechain').toLowerCase();
  const token = (sp.get('token') || '').toLowerCase();
  if (chain !== 'pulsechain') return NextResponse.json({ chain, supported: false });
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const nowTs = Math.floor(Date.now() / 1000);
  const cutoff = nowTs - 24 * HOUR;

  try {
    const perGraph = await Promise.all(
      PULSEX_SUBGRAPHS.map(async (url) => {
        const pairIds = await getTokenPairIds(url, token);
        if (!pairIds || !pairIds.length) return { pairIds: [] as string[], swaps: [] as SwapRow[], recent: [] as any[] };
        const inList = pairIds.map((id) => `"${id}"`).join(',');
        const [swaps, recentData] = await Promise.all([
          pageSwaps(url, pairIds, cutoff), // 24h window for top-traders aggregation
          gql(url, `{ swaps(first:${RECENT}, orderBy:timestamp, orderDirection:desc, where:{pair_in:[${inList}], timestamp_lt:${nowTs + HOUR}}) ${RECENT_FIELDS} }`),
        ]);
        return { pairIds, swaps, recent: (recentData?.swaps ?? []) as any[] };
      }),
    );

    const pairSet = new Set<string>();
    for (const g of perGraph) for (const id of g.pairIds) pairSet.add(id);
    if (!pairSet.size) return NextResponse.json({ chain, supported: true, empty: true });

    const isInfra = (addr: string) => !addr || addr === ZERO || ROUTERS.has(addr) || pairSet.has(addr);

    // Top traders (24h) — aggregate realized flow per wallet.
    const traders = new Map<string, { boughtUsd: number; soldUsd: number; buys: number; sells: number }>();
    for (const g of perGraph) {
      for (const s of g.swaps) {
        const usd = cleanUsd(s.amountUSD);
        if (usd <= 0) continue;
        const wallet = (s.to || '').toLowerCase();
        if (isInfra(wallet)) continue;
        const { isBuy } = classify(s, token);
        const t = traders.get(wallet) ?? { boughtUsd: 0, soldUsd: 0, buys: 0, sells: 0 };
        if (isBuy) { t.boughtUsd += usd; t.buys++; } else { t.soldUsd += usd; t.sells++; }
        traders.set(wallet, t);
      }
    }
    const topTraders = [...traders.entries()]
      .map(([wallet, t]) => ({
        wallet,
        boughtUsd: t.boughtUsd, soldUsd: t.soldUsd,
        volumeUsd: t.boughtUsd + t.soldUsd, netUsd: t.boughtUsd - t.soldUsd,
        buys: t.buys, sells: t.sells,
      }))
      .sort((a, b) => b.volumeUsd - a.volumeUsd)
      .slice(0, TOP_N);

    // Recent trades feed (merged, newest first).
    const recent = perGraph
      .flatMap((g) => g.recent)
      .map((s) => {
        const usd = cleanUsd(s.amountUSD);
        const { isBuy, tokenAmount } = classify(s, token);
        return {
          type: isBuy ? 'buy' : 'sell',
          ts: num(s.timestamp),
          usd,
          tokenAmount,
          price: tokenAmount > 0 ? usd / tokenAmount : 0,
          wallet: (s.to || '').toLowerCase(),
          tx: s.transaction?.id ?? '',
        };
      })
      .filter((t) => t.usd > 0)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, RECENT);

    return NextResponse.json(
      { chain, supported: true, pairCount: pairSet.size, windowHours: 24, recent, topTraders },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load trades' },
      { status: 500 },
    );
  }
}
