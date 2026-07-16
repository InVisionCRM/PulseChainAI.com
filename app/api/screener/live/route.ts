import { NextRequest, NextResponse } from 'next/server';
import { getChain } from '@/lib/chains/registry';
import { isChainKey } from '@/lib/chains/registry';
import { cached } from '@/lib/geicko/serverCache';
import type {
  DexInfo,
  ScreenerResponse,
  ScreenerRow,
  ScreenerStats,
  ScreenerWindow,
} from '@/lib/screener/types';
import type { SortKey } from '@/lib/screener/db';

// Live, multi-chain screener source. The PulseChain screener (/api/screener) is
// backed by a self-indexed Postgres universe; chains without that index (today:
// Robinhood, and any EVM we add next) are served here directly from
// GeckoTerminal, which aggregates every DEX on the chain with the same market
// fields (price / volume / txns / liquidity / price-change per window). Rows are
// mapped into the exact ScreenerResponse shape the table already renders, so the
// UI is identical across chains. Free source; no Moralis, no paid tier.

export const revalidate = 0;
export const maxDuration = 30;

const GT = 'https://api.geckoterminal.com/api/v2';
const PAGE_SIZE = 30;
const MAX_GT_PAGES = 7; // GeckoTerminal free tier caps pool pagination here.

type Tab = 'trending' | 'top' | 'gainers' | 'new' | 'gold';

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : null;
};
const stripNet = (id: string) => (id || '').split('_').pop() ?? '';
// GeckoTerminal dex ids look like "uniswap-v3-robinhood"; drop the chain suffix.
const cleanDex = (id: string) => (id || '').replace(/-robinhood$/, '').replace(/-eth$/, '') || 'unknown';

async function getJson(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(9000),
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

function mapPool(
  chainKey: string,
  p: any,
  tokens: Map<string, { address: string; symbol: string; name: string; image: string | null }>,
): ScreenerRow | null {
  const a = p?.attributes ?? {};
  const rel = p?.relationships ?? {};
  const addr = String(a.address ?? '').toLowerCase();
  if (!addr) return null;
  const baseId = rel.base_token?.data?.id ?? '';
  const quoteId = rel.quote_token?.data?.id ?? '';
  const base = tokens.get(baseId);
  const quote = tokens.get(quoteId);
  const dexId = cleanDex(stripNet(rel.dex?.data?.id ?? ''));
  // v2 / v3 label from the pool name suffix (e.g. "… 0.3%") isn't reliable; take
  // it from the dex id where present.
  const label = /v(\d)/i.exec(dexId)?.[0]?.toLowerCase() ?? null;

  const win = (obj: any) => ({
    m5: numOrNull(obj?.m5),
    h1: numOrNull(obj?.h1),
    h6: numOrNull(obj?.h6),
    h24: numOrNull(obj?.h24),
  });
  const txnWin = (obj: any) => ({
    m5: (num(obj?.m5?.buys) + num(obj?.m5?.sells)) || null,
    h1: (num(obj?.h1?.buys) + num(obj?.h1?.sells)) || null,
    h6: (num(obj?.h6?.buys) + num(obj?.h6?.sells)) || null,
    h24: (num(obj?.h24?.buys) + num(obj?.h24?.sells)) || null,
  });

  return {
    chainId: chainKey as ScreenerRow['chainId'],
    pairAddress: addr,
    dexId,
    label,
    baseAddress: base ? base.address : stripNet(baseId),
    baseSymbol: base?.symbol ?? null,
    baseName: base?.name ?? null,
    quoteSymbol: quote?.symbol ?? null,
    imageUrl: base?.image ?? null,
    priceUsd: numOrNull(a.base_token_price_usd),
    marketCap: numOrNull(a.market_cap_usd) ?? numOrNull(a.fdv_usd),
    liquidityUsd: numOrNull(a.reserve_in_usd),
    pairCreatedAt: a.pool_created_at ?? null,
    txns: txnWin(a.transactions),
    vol: win(a.volume_usd),
    chg: win(a.price_change_percentage),
    gold: false,
  };
}

// Fetch + map the chain's pool universe for a tab. Cached briefly so sorting,
// filtering and pagination are served from memory without re-hitting GT.
async function loadUniverse(chainKey: string, net: string, tab: Tab): Promise<ScreenerRow[]> {
  return cached(
    `screener-live:${net}:${tab}`,
    60_000,
    async () => {
      // Trending / new have dedicated endpoints (one page each). The rest sort
      // the full pool list by 24h volume and page through it.
      const endpoints: string[] =
        tab === 'trending'
          ? [`${GT}/networks/${net}/trending_pools?include=base_token,quote_token,dex&page=1`]
          : tab === 'new'
            ? [`${GT}/networks/${net}/new_pools?include=base_token,quote_token,dex&page=1`]
            : Array.from(
                { length: MAX_GT_PAGES },
                (_, i) =>
                  `${GT}/networks/${net}/pools?include=base_token,quote_token,dex&sort=h24_volume_usd_desc&page=${i + 1}`,
              );

      const pages = await Promise.all(endpoints.map(getJson));
      const tokens = new Map<string, { address: string; symbol: string; name: string; image: string | null }>();
      const rawPools: any[] = [];
      for (const j of pages) {
        if (!j) continue;
        for (const inc of (j.included ?? []) as any[]) {
          if (inc.type === 'token') {
            tokens.set(inc.id, {
              address: String(inc.attributes?.address ?? stripNet(inc.id)).toLowerCase(),
              symbol: inc.attributes?.symbol ?? '?',
              name: inc.attributes?.name ?? inc.attributes?.symbol ?? '',
              image:
                inc.attributes?.image_url && inc.attributes.image_url !== 'missing.png'
                  ? inc.attributes.image_url
                  : null,
            });
          }
        }
        rawPools.push(...((j.data ?? []) as any[]));
      }

      const seen = new Set<string>();
      const rows: ScreenerRow[] = [];
      for (const p of rawPools) {
        const row = mapPool(chainKey, p, tokens);
        if (!row || seen.has(row.pairAddress)) continue;
        seen.add(row.pairAddress);
        rows.push(row);
      }
      return rows;
    },
    (rows) => rows.length > 0,
  );
}

function sortValue(row: ScreenerRow, key: SortKey, w: ScreenerWindow): number {
  switch (key) {
    case 'mcap': return row.marketCap ?? -Infinity;
    case 'price': return row.priceUsd ?? -Infinity;
    case 'age': return row.pairCreatedAt ? new Date(row.pairCreatedAt).getTime() : -Infinity;
    case 'txns': return row.txns[w] ?? -Infinity;
    case 'volume': return row.vol[w] ?? -Infinity;
    case 'm5': return row.chg.m5 ?? -Infinity;
    case 'h1': return row.chg.h1 ?? -Infinity;
    case 'h6': return row.chg.h6 ?? -Infinity;
    case 'h24': return row.chg.h24 ?? -Infinity;
    case 'liq': return row.liquidityUsd ?? -Infinity;
    default: return -Infinity;
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chainKey = (sp.get('chain') || '').toLowerCase();
  if (!isChainKey(chainKey)) {
    return NextResponse.json({ error: 'unknown chain' }, { status: 400 });
  }
  const net = getChain(chainKey).geckoterminalSlug;
  if (!net) {
    return NextResponse.json({ error: 'chain not indexed by GeckoTerminal' }, { status: 400 });
  }

  const tab = (sp.get('tab') || 'trending') as Tab;
  const window_ = (sp.get('window') || 'h6') as ScreenerWindow;
  const sort = sp.get('sort') as SortKey | null;
  const dir = sp.get('dir') === 'asc' ? 'asc' : 'desc';
  const dexFilter = sp.get('dex');
  const page = Math.max(0, parseInt(sp.get('page') || '0', 10) || 0);
  const minLiq = numOrNull(sp.get('minLiq'));
  const minVol = numOrNull(sp.get('minVol'));
  const minAgeH = numOrNull(sp.get('minAgeH'));
  const maxAgeH = numOrNull(sp.get('maxAgeH'));

  try {
    const universe = await loadUniverse(chainKey, net, tab);

    // Dex facets are computed over the whole (pre-dex-filter) universe.
    const dexCounts = new Map<string, number>();
    for (const r of universe) {
      if (!r.dexId) continue;
      dexCounts.set(r.dexId, (dexCounts.get(r.dexId) ?? 0) + 1);
    }
    const dexes: DexInfo[] = Array.from(dexCounts, ([dexId, pairs]) => ({ dexId, pairs })).sort(
      (a, b) => b.pairs - a.pairs,
    );

    const now = Date.now();
    let filtered = universe.filter((r) => {
      if (dexFilter && r.dexId !== dexFilter) return false;
      if (minLiq !== null && (r.liquidityUsd ?? 0) < minLiq) return false;
      if (minVol !== null && (r.vol.h24 ?? 0) < minVol) return false;
      if (minAgeH !== null || maxAgeH !== null) {
        const ageH = r.pairCreatedAt ? (now - new Date(r.pairCreatedAt).getTime()) / 3_600_000 : Infinity;
        if (minAgeH !== null && ageH < minAgeH) return false;
        if (maxAgeH !== null && ageH > maxAgeH) return false;
      }
      return true;
    });

    // Default ordering per tab, overridden by an explicit column sort.
    if (sort) {
      filtered = [...filtered].sort(
        (a, b) => (sortValue(a, sort, window_) - sortValue(b, sort, window_)) * (dir === 'asc' ? 1 : -1),
      );
    } else if (tab === 'gainers') {
      filtered = [...filtered].sort((a, b) => (b.chg.h24 ?? -Infinity) - (a.chg.h24 ?? -Infinity));
    } else if (tab === 'top') {
      filtered = [...filtered].sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0));
    }
    // trending / new keep GeckoTerminal's own ordering.

    const stats: ScreenerStats = {
      vol24: filtered.reduce((s, r) => s + (r.vol.h24 ?? 0), 0),
      txns24: filtered.reduce((s, r) => s + (r.txns.h24 ?? 0), 0),
      pairs: filtered.length,
      block: null,
    };

    const start = page * PAGE_SIZE;
    const rows = filtered.slice(start, start + PAGE_SIZE);

    const payload: ScreenerResponse = { rows, stats, dexes, page, pageSize: PAGE_SIZE };
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=120' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'failed' },
      { status: 500 },
    );
  }
}
