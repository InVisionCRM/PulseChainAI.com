import { NextRequest, NextResponse } from 'next/server';
import { bestPairsForToken } from '@/lib/screener/dexscreener';
import { getGoldBadges } from '@/lib/db/goldBadges';
import { getChain, isChainKey } from '@/lib/chains/registry';
import type { ScreenerRow } from '@/lib/screener/types';

export const dynamic = 'force-dynamic';

const ENTRY_RX = /^(pulsechain|ethereum|robinhood):0x[0-9a-fA-F]{40}$/;
const MAX_TOKENS = 25;

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * GeckoTerminal per-token fallback for a (chain, address) DexScreener can't
 * resolve as a *base* token — chiefly the chain's native/quote asset (WETH on
 * Robinhood, which is the quote side of every pair, so `bestPairsForToken`
 * returns nothing for it). GeckoTerminal's token endpoint prices the token
 * directly and reports its total pooled liquidity, so the watchlist card gets a
 * correct price + liquidity regardless of which side of the pool it sits on.
 */
async function geckoTokenRow(chain: string, address: string): Promise<ScreenerRow | null> {
  if (!isChainKey(chain)) return null;
  const slug = getChain(chain).geckoterminalSlug;
  if (!slug) return null;
  try {
    const res = await fetch(
      `https://api.geckoterminal.com/api/v2/networks/${slug}/tokens/${address}`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 30 } },
    );
    if (!res.ok) return null;
    const a = (await res.json())?.data?.attributes;
    if (!a) return null;
    return {
      chainId: chain,
      pairAddress: '',
      dexId: null,
      label: null,
      baseAddress: address.toLowerCase(),
      baseSymbol: a.symbol ?? null,
      baseName: a.name ?? a.symbol ?? null,
      quoteSymbol: null,
      imageUrl: a.image_url && a.image_url !== 'missing.png' ? a.image_url : null,
      priceUsd: num(a.price_usd),
      // Prefer FDV over GT's often-stale market_cap_usd (see geicko MC fix).
      marketCap: num(a.fdv_usd) ?? num(a.market_cap_usd),
      liquidityUsd: num(a.total_reserve_in_usd),
      pairCreatedAt: null,
      txns: { m5: null, h1: null, h6: null, h24: null },
      vol: { m5: null, h1: null, h6: null, h24: num(a.volume_usd?.h24) },
      chg: { m5: null, h1: null, h6: null, h24: null },
      gold: false,
    };
  } catch {
    return null;
  }
}

/**
 * Resolve watchlist tokens to live rows.
 * ?tokens=pulsechain:0xabc…,ethereum:0x2b5… (order preserved in response)
 */
export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get('tokens') ?? '').trim();
  if (!raw) return NextResponse.json({ error: 'tokens parameter required' }, { status: 400 });

  const entries = raw.split(',').map((e) => e.trim()).filter(Boolean);
  if (entries.length > MAX_TOKENS) {
    return NextResponse.json({ error: `At most ${MAX_TOKENS} tokens` }, { status: 400 });
  }
  for (const e of entries) {
    if (!ENTRY_RX.test(e)) {
      return NextResponse.json({ error: `Bad token entry: ${e}` }, { status: 400 });
    }
  }

  try {
    // chains wanted per unique address (HEX appears on both chains).
    const wanted = new Map<string, Set<string>>();
    for (const e of entries) {
      const [chain, address] = e.split(':');
      const key = address.toLowerCase();
      if (!wanted.has(key)) wanted.set(key, new Set());
      wanted.get(key)!.add(chain);
    }

    const gold = new Set((await getGoldBadges()).map((g) => g.token_address.toLowerCase()));

    const resolved = new Map<string, ScreenerRow>();
    await Promise.all(
      Array.from(wanted.entries()).map(async ([address, chains]) => {
        const byChain = await bestPairsForToken(address, chains);
        for (const [chain, row] of byChain) {
          row.gold = chain === 'pulsechain' && gold.has(address);
          resolved.set(`${chain}:${address}`, row);
        }
      }),
    );

    // Fill any (chain, address) DexScreener couldn't resolve as a base token
    // (e.g. WETH on Robinhood — always a quote) from GeckoTerminal, so those
    // watchlist cards still show a correct price + liquidity instead of dropping.
    await Promise.all(
      entries.map(async (e) => {
        const key = e.toLowerCase();
        if (resolved.has(key)) return;
        const [chain, address] = key.split(':');
        const row = await geckoTokenRow(chain, address);
        if (row) {
          row.gold = chain === 'pulsechain' && gold.has(address);
          resolved.set(key, row);
        }
      }),
    );

    const rows: ScreenerRow[] = [];
    for (const e of entries) {
      const row = resolved.get(e.toLowerCase());
      if (row) rows.push(row);
    }
    return NextResponse.json(
      { rows },
      { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=60' } },
    );
  } catch (err) {
    console.error('GET /api/watchlist failed:', err);
    return NextResponse.json({ error: 'Watchlist lookup failed' }, { status: 502 });
  }
}
