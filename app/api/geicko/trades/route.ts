import { NextRequest, NextResponse } from 'next/server';
import { PULSEX_SUBGRAPHS, gql, getTokenPairIds, pageSwaps, cleanUsd, num, type SwapRow } from '@/lib/geicko/pulsex';
import { cached } from '@/lib/geicko/serverCache';
import { getChain, isChainKey } from '@/lib/chains/registry';

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

async function build(chain: string, token: string) {
  const nowTs = Math.floor(Date.now() / 1000);
  const cutoff = nowTs - 24 * HOUR;

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
  if (!pairSet.size) return { chain, supported: true, empty: true };

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

  return { chain, supported: true, pairCount: pairSet.size, windowHours: 24, recent, topTraders };
}

// ── Non-PulseChain chains: recent trades from GeckoTerminal ─────────────────
// PulseChain uses the PulseX subgraph; other chains have no such subgraph, so
// their trades come from GeckoTerminal's per-pool trades endpoint (the last
// ~300 trades per pool). Free; recent-window only (no lifetime aggregation).
const GT = 'https://api.geckoterminal.com/api/v2';

async function gtJson(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(9000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

async function buildFromGeckoTerminal(net: string, token: string) {
  // Deepest pools for the token, then merge each pool's recent trades.
  const poolsJson = await gtJson(`${GT}/networks/${net}/tokens/${token}/pools?page=1`);
  const pools = ((poolsJson?.data ?? []) as any[])
    .map((p) => String(p?.attributes?.address ?? '').toLowerCase())
    .filter(Boolean)
    .slice(0, 4); // cap fan-out
  if (pools.length === 0) return { chain: net, supported: true, empty: true };

  const perPool = await Promise.all(
    pools.map((pool) => gtJson(`${GT}/networks/${net}/pools/${pool}/trades`)),
  );

  const traders = new Map<string, { boughtUsd: number; soldUsd: number; buys: number; sells: number }>();
  const recentRaw: Array<{ type: string; ts: number; usd: number; tokenAmount: number; price: number; wallet: string; tx: string }> = [];

  for (const j of perPool) {
    for (const t of (j?.data ?? []) as any[]) {
      const a = t?.attributes ?? {};
      const from = String(a.from_token_address ?? '').toLowerCase();
      const to = String(a.to_token_address ?? '').toLowerCase();
      const isBuy = to === token; // token received → buy of token
      const isSell = from === token;
      if (!isBuy && !isSell) continue;
      const usd = num(a.volume_in_usd);
      if (usd <= 0) continue;
      const tokenAmount = isBuy ? num(a.to_token_amount) : num(a.from_token_amount);
      const wallet = String(a.tx_from_address ?? '').toLowerCase();
      const ts = a.block_timestamp ? Math.floor(Date.parse(a.block_timestamp) / 1000) : 0;
      recentRaw.push({
        type: isBuy ? 'buy' : 'sell',
        ts,
        usd,
        tokenAmount,
        price: tokenAmount > 0 ? usd / tokenAmount : 0,
        wallet,
        tx: String(a.tx_hash ?? ''),
      });
      if (wallet) {
        const agg = traders.get(wallet) ?? { boughtUsd: 0, soldUsd: 0, buys: 0, sells: 0 };
        if (isBuy) { agg.boughtUsd += usd; agg.buys++; } else { agg.soldUsd += usd; agg.sells++; }
        traders.set(wallet, agg);
      }
    }
  }

  const recent = recentRaw.sort((a, b) => b.ts - a.ts).slice(0, RECENT);
  const topTraders = [...traders.entries()]
    .map(([wallet, t]) => ({
      wallet,
      boughtUsd: t.boughtUsd, soldUsd: t.soldUsd,
      volumeUsd: t.boughtUsd + t.soldUsd, netUsd: t.boughtUsd - t.soldUsd,
      buys: t.buys, sells: t.sells,
    }))
    .sort((a, b) => b.volumeUsd - a.volumeUsd)
    .slice(0, TOP_N);

  // windowHours omitted: GT gives a recent-trades window, not a fixed 24h.
  return { chain: net, supported: true, pairCount: pools.length, recent, topTraders, source: 'geckoterminal' };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chain = (sp.get('network') || 'pulsechain').toLowerCase();
  const token = (sp.get('token') || '').toLowerCase();
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  // Non-PulseChain chains route through GeckoTerminal (if they're indexed there).
  if (chain !== 'pulsechain') {
    const gtSlug = isChainKey(chain) ? getChain(chain).geckoterminalSlug : null;
    if (!gtSlug) return NextResponse.json({ chain, supported: false });
    try {
      const payload = await cached(`trades:${chain}:${token}`, 120_000, () => buildFromGeckoTerminal(gtSlug, token));
      return NextResponse.json(payload, {
        headers: { 'Cache-Control': 'public, max-age=120, s-maxage=120, stale-while-revalidate=1800' },
      });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load trades' }, { status: 500 });
    }
  }

  try {
    // Freshest of the geicko caches — this is the "live" trades feed — but a few
    // minutes of staleness still beats re-scanning 24h of swaps per visitor.
    const payload = await cached(`trades:${token}`, 180_000, () => build(chain, token));
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=180, s-maxage=180, stale-while-revalidate=3600' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load trades' },
      { status: 500 },
    );
  }
}
