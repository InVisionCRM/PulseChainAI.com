// GeckoTerminal-sourced liquidity pools for a token, mapped into the
// DexScreenerData pair shape the Liquidity tab / total-liquidity stat render.
//
// Shared by /api/geicko/pools (the geicko page) and /api/portfolio/insights
// (the token insights card) so both compute liquidity the SAME way — from
// GeckoTerminal's aggregated reserves across every DEX, not DexScreener's
// partial/noisy pair list. GeckoTerminal is free and covers PulseChain
// (PulseX v1/v2, 9mm, …) and Robinhood (Uniswap v2/v3/v4, …).

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

export interface GeckoPoolsResult {
  pairs: any[];
  totalPairs: number;
  wplsPairs: number;
  source: 'geckoterminal';
}

/**
 * Fetch a token's liquidity pools from GeckoTerminal, mapped into the
 * DexScreenerData pair shape. `chain` is our chain key (pulsechain / robinhood /
 * ethereum / …); it's mapped to GeckoTerminal's network slug. Pools come back
 * sorted by USD reserve (deepest first).
 */
export async function fetchGeckoTokenPools(chain: string, token: string): Promise<GeckoPoolsResult> {
  const c = chain.toLowerCase();
  const net = c === 'pulsechain' ? 'pulsechain' : (GT_NET[c] || c);
  const tok = token.toLowerCase();

  // GeckoTerminal returns the top ~20 pools per page (by liquidity). Pull two
  // pages so mid-liquidity pairs still show, and resolve token symbols/addresses
  // from the `included` payload rather than parsing the pool name.
  const included = new Map<string, { address: string; symbol: string; name: string }>();
  const rawPools: any[] = [];
  for (let page = 1; page <= 2; page++) {
    const j = await getJson(`${GT}/networks/${net}/tokens/${tok}/pools?page=${page}&include=base_token,quote_token,dex`);
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
        chainId: c,
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
