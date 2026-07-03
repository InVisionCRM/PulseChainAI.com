import { NextRequest, NextResponse } from 'next/server';
import { PULSEX_SUBGRAPHS, getTokenPairIds, pageSwaps, cleanUsd, num, type SwapRow } from '@/lib/geicko/pulsex';
import { cached } from '@/lib/geicko/serverCache';

// True buy/sell pressure for a token, from PulseX swaps (v1 + v2). Each swap is
// classified as a BUY or SELL *of the viewed token* by direction: if the token
// left the pair (amountOut) the trader bought it; if it entered (amountIn) they
// sold it. We fetch the last 24h once and derive 1h/6h/24h USD splits plus 24
// hourly buckets — so this is real directional USD, not DexScreener's counts.
// PulseChain only, free.

export const revalidate = 0;
export const maxDuration = 60;

const HOUR = 3_600;

async function build(chain: string, token: string) {
  const nowTs = Math.floor(Date.now() / 1000);
  const cutoff = nowTs - 24 * HOUR;

  const perGraph = await Promise.all(
    PULSEX_SUBGRAPHS.map(async (url) => {
      const pairIds = await getTokenPairIds(url, token);
      if (!pairIds || !pairIds.length) return { pairCount: 0, swaps: [] as SwapRow[] };
      const swaps = await pageSwaps(url, pairIds, cutoff);
      return { pairCount: pairIds.length, swaps };
    }),
  );

  const pairCount = perGraph.reduce((s, g) => s + g.pairCount, 0);
  if (!pairCount) return { chain, supported: true, empty: true };

  // Windows to report, each a lookback in seconds from now.
  const winDefs = { h1: HOUR, h6: 6 * HOUR, h24: 24 * HOUR };
  const blank = () => ({ buyUsd: 0, sellUsd: 0, buyCount: 0, sellCount: 0 });
  const windows = { h1: blank(), h6: blank(), h24: blank() };
  // 24 hourly buckets (oldest→newest) for the chart.
  const hourly = Array.from({ length: 24 }, (_, i) => ({
    t: (Math.floor(nowTs / HOUR) - 23 + i) * HOUR,
    buy: 0,
    sell: 0,
  }));

  for (const { swaps } of perGraph) {
    for (const s of swaps) {
      const ts = num(s.timestamp);
      const usd = cleanUsd(s.amountUSD);
      if (usd <= 0) continue;
      const isTok0 = s.pair.token0.id.toLowerCase() === token;
      const out = isTok0 ? num(s.amount0Out) : num(s.amount1Out);
      const inn = isTok0 ? num(s.amount0In) : num(s.amount1In);
      const isBuy = out >= inn; // token left the pool → trader bought the token
      const age = nowTs - ts;

      for (const [k, span] of Object.entries(winDefs) as [keyof typeof windows, number][]) {
        if (age <= span) {
          const w = windows[k];
          if (isBuy) { w.buyUsd += usd; w.buyCount++; } else { w.sellUsd += usd; w.sellCount++; }
        }
      }
      const bucket = Math.floor((ts - hourly[0].t) / HOUR);
      if (bucket >= 0 && bucket < 24) {
        if (isBuy) hourly[bucket].buy += usd; else hourly[bucket].sell += usd;
      }
    }
  }

  return { chain, supported: true, pairCount, windows, hourly };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chain = (sp.get('network') || 'pulsechain').toLowerCase();
  const token = (sp.get('token') || '').toLowerCase();

  if (chain !== 'pulsechain') return NextResponse.json({ chain, supported: false });
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  try {
    // The v1+v2 swap scan takes many seconds, and a single page load can request
    // it several times concurrently. Memoize the whole payload for 2 minutes
    // (matching the Cache-Control below) so only the first caller pays.
    const payload = await cached(`pressure:${token}`, 120_000, () => build(chain, token));
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=120, s-maxage=120, stale-while-revalidate=600' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load pressure' },
      { status: 500 },
    );
  }
}
