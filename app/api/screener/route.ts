import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, listPairs, chainStats, listDexes, SORT_KEYS, type DbScreenerRow, type SortKey } from '@/lib/screener/db';
import { latestBlock } from '@/lib/screener/logs';
import { getGoldBadges } from '@/lib/db/goldBadges';
import type {
  ScreenerResponse,
  ScreenerRow,
  ScreenerTab,
  ScreenerWindow,
} from '@/lib/screener/types';

export const dynamic = 'force-dynamic';

const TABS: ScreenerTab[] = ['trending', 'top', 'gainers', 'new', 'gold'];
const WINDOWS: ScreenerWindow[] = ['m5', 'h1', 'h6', 'h24'];
const PAGE_SIZE = 50;

function toRow(r: DbScreenerRow, goldSet: Set<string>): ScreenerRow {
  return {
    pairAddress: r.pair_address,
    dexId: r.dex_id,
    label: r.label,
    baseAddress: r.base_address,
    baseSymbol: r.base_symbol,
    baseName: r.base_name,
    quoteSymbol: r.quote_symbol,
    imageUrl: r.image_url,
    priceUsd: r.price_usd,
    marketCap: r.market_cap ?? r.fdv,
    liquidityUsd: r.liquidity_usd,
    pairCreatedAt: r.pair_created_at ? new Date(r.pair_created_at).toISOString() : null,
    txns: { m5: r.txns_m5, h1: r.txns_h1, h6: r.txns_h6, h24: r.txns_h24 },
    vol: { m5: r.vol_m5, h1: r.vol_h1, h6: r.vol_h6, h24: r.vol_h24 },
    chg: { m5: r.chg_m5, h1: r.chg_h1, h6: r.chg_h6, h24: r.chg_h24 },
    gold: r.base_address !== null && goldSet.has(r.base_address),
  };
}

export async function GET(request: NextRequest) {
  try {
    await ensureSchema();
    const sp = request.nextUrl.searchParams;

    const tab = (sp.get('tab') ?? 'trending') as ScreenerTab;
    const window = (sp.get('window') ?? 'h6') as ScreenerWindow;
    if (!TABS.includes(tab)) return NextResponse.json({ error: `Unknown tab: ${tab}` }, { status: 400 });
    if (!WINDOWS.includes(window)) return NextResponse.json({ error: `Unknown window: ${window}` }, { status: 400 });
    const dexId = sp.get('dex') || null;
    const page = Math.max(0, parseInt(sp.get('page') ?? '0', 10) || 0);

    const sortRaw = sp.get('sort');
    const sort = sortRaw && (SORT_KEYS as readonly string[]).includes(sortRaw) ? (sortRaw as SortKey) : null;
    if (sortRaw && !sort) return NextResponse.json({ error: `Unknown sort: ${sortRaw}` }, { status: 400 });
    const dir = sp.get('dir') === 'asc' ? 'asc' : 'desc';

    const numParam = (key: string): number | null => {
      const raw = sp.get(key);
      if (raw === null || raw === '') return null;
      const n = parseFloat(raw);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    const filters = {
      minLiq: numParam('minLiq'),
      minVol24: numParam('minVol'),
      minAgeH: numParam('minAgeH'),
      maxAgeH: numParam('maxAgeH'),
    };

    const gold = await getGoldBadges();
    const goldAddresses = gold.map((g) => g.token_address.toLowerCase());
    const goldSet = new Set(goldAddresses);

    const [rows, stats, dexes, block] = await Promise.all([
      listPairs({ tab, window, dexId, page, pageSize: PAGE_SIZE, goldAddresses, sort, dir, filters }),
      chainStats(),
      listDexes(),
      // Stats decoration only — a flaky public RPC must not take down the table.
      latestBlock().catch(() => null),
    ]);

    const body: ScreenerResponse = {
      rows: rows.map((r) => toRow(r, goldSet)),
      stats: { ...stats, block },
      dexes,
      page,
      pageSize: PAGE_SIZE,
    };
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 's-maxage=15, stale-while-revalidate=30' },
    });
  } catch (err) {
    console.error('GET /api/screener failed:', err);
    return NextResponse.json({ error: 'Screener query failed' }, { status: 500 });
  }
}
