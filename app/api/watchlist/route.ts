import { NextRequest, NextResponse } from 'next/server';
import { bestPairsForToken } from '@/lib/screener/dexscreener';
import { getGoldBadges } from '@/lib/db/goldBadges';
import type { ScreenerRow } from '@/lib/screener/types';

export const dynamic = 'force-dynamic';

const ENTRY_RX = /^(pulsechain|ethereum):0x[0-9a-fA-F]{40}$/;
const MAX_TOKENS = 25;

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
