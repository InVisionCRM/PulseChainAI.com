import { NextRequest, NextResponse } from 'next/server';
import { cached } from '@/lib/geicko/serverCache';

// Liquidity pairs for a token, sourced from GeckoTerminal instead of DexScreener
// (DexScreener's pair list is noisy/incomplete for PulseChain liquidity).
// GeckoTerminal aggregates every PulseChain DEX (PulseX v1/v2, 9mm, …) with real
// reserves, and it's free. We map its pools into the DexScreenerData shape the
// Liquidity tab already renders, so this is a drop-in source swap.

export const revalidate = 0;
export const maxDuration = 30;

const GT = 'https://api.geckoterminal.com/api/v2';
const GT_NET: Record<string, string> = {
  ethereum: 'eth', bsc: 'bsc', base: 'base', arbitrum: 'arbitrum',
  polygon: 'polygon_pos', avalanche: 'avax', optimism: 'optimism', solana: 'solana',
};
const WPLS = '0xa1077a294dde1b09bb078844df40758a5d0f9a27';

const num = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};
const stripNet = (id: string) => (id || '').split('_').pop() ?? '';

async function getJson(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chain = (sp.get('network') || 'pulsechain').toLowerCase();
  const token = (sp.get('token') || '').toLowerCase();
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const net = chain === 'pulsechain' ? 'pulsechain' : (GT_NET[chain] || chain);

  try {
    // Memoize for 2 minutes (matching Cache-Control): the page fetches this from
    // more than one component, and GeckoTerminal rate-limits aggressively enough
    // that duplicate bursts can come back empty. Empty results aren't cached —
    // they usually mean a rate-limit, not a token without pools.
    const payload = await cached(
      `pools:${net}:${token}`,
      120_000,
      () => build(chain, net, token),
      (v) => v.pairs.length > 0,
    );
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=120, s-maxage=120, stale-while-revalidate=600' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load pools' },
      { status: 500 },
    );
  }
}

async function build(chain: string, net: string, token: string) {
  // GeckoTerminal returns the top ~20 pools per page (by liquidity). Pull two
  // pages so mid-liquidity pairs still show, and resolve token symbols/addresses
  // from the `included` payload rather than parsing the pool name.
  const included = new Map<string, { address: string; symbol: string; name: string }>();
  const rawPools: any[] = [];
  for (let page = 1; page <= 2; page++) {
    const j = await getJson(`${GT}/networks/${net}/tokens/${token}/pools?page=${page}&include=base_token,quote_token,dex`);
    if (!j) break;
    for (const inc of (j.included ?? []) as any[]) {
      if (inc.type === 'token') {
        included.set(inc.id, {
          address: (inc.attributes?.address ?? stripNet(inc.id)).toLowerCase(),
          symbol: inc.attributes?.symbol ?? '?',
          name: inc.attributes?.name ?? inc.attributes?.symbol ?? '',
        });
      }
    }
    const data = (j.data ?? []) as any[];
    rawPools.push(...data);
    if (data.length < 20) break;
  }

  const seen = new Set<string>();
  const pairs = rawPools
    .filter((p) => {
      const addr = (p.attributes?.address ?? '').toLowerCase();
      if (!addr || seen.has(addr)) return false;
      seen.add(addr);
      return true;
    })
    .map((p) => {
      const a = p.attributes ?? {};
      const rel = p.relationships ?? {};
      const baseId = rel.base_token?.data?.id ?? '';
      const quoteId = rel.quote_token?.data?.id ?? '';
      const base = included.get(baseId) ?? { address: stripNet(baseId), symbol: '?', name: '' };
      const quote = included.get(quoteId) ?? { address: stripNet(quoteId), symbol: '?', name: '' };

      const reserveUsd = num(a.reserve_in_usd);
      const basePrice = num(a.base_token_price_usd);
      const quotePrice = num(a.quote_token_price_usd);
      // GeckoTerminal doesn't expose reserve token amounts, so approximate from
      // the ~50/50 USD split of a v2 pool (good enough for the tab's display).
      const baseAmt = basePrice > 0 ? reserveUsd / 2 / basePrice : 0;
      const quoteAmt = quotePrice > 0 ? reserveUsd / 2 / quotePrice : 0;

      const txn = (k: string) => ({ buys: num(a.transactions?.[k]?.buys), sells: num(a.transactions?.[k]?.sells) });

      return {
        chainId: chain,
        dexId: stripNet(rel.dex?.data?.id ?? '') || 'unknown',
        url: `https://www.geckoterminal.com/${net}/pools/${a.address}`,
        pairAddress: a.address,
        baseToken: { address: base.address, name: base.name, symbol: base.symbol },
        quoteToken: { address: quote.address, name: quote.name, symbol: quote.symbol },
        priceNative: String(a.base_token_price_native_currency ?? ''),
        priceUsd: String(a.base_token_price_usd ?? ''),
        txns: { m5: txn('m5'), h1: txn('h1'), h6: txn('h6'), h24: txn('h24') },
        volume: {
          m5: num(a.volume_usd?.m5), h1: num(a.volume_usd?.h1),
          h6: num(a.volume_usd?.h6), h24: num(a.volume_usd?.h24),
        },
        priceChange: {
          m5: num(a.price_change_percentage?.m5), h1: num(a.price_change_percentage?.h1),
          h6: num(a.price_change_percentage?.h6), h24: num(a.price_change_percentage?.h24),
        },
        liquidity: { usd: reserveUsd, base: baseAmt, quote: quoteAmt },
        fdv: num(a.fdv_usd),
        marketCap: num(a.market_cap_usd),
        pairCreatedAt: a.pool_created_at ? Date.parse(a.pool_created_at) : 0,
      };
    })
    .sort((x, y) => y.liquidity.usd - x.liquidity.usd);

  const wplsPairs = pairs.filter(
    (p) => p.baseToken.address === WPLS || p.quoteToken.address === WPLS,
  ).length;

  return { pairs, totalPairs: pairs.length, wplsPairs, source: 'geckoterminal' };
}
