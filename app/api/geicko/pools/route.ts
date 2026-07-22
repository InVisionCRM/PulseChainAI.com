import { NextRequest, NextResponse } from 'next/server';
import { cached } from '@/lib/geicko/serverCache';
import { fetchGeckoTokenPools } from '@/lib/geicko/pools';

// Liquidity pairs for a token, sourced from GeckoTerminal instead of DexScreener
// (DexScreener's pair list is noisy/incomplete for PulseChain liquidity).
// GeckoTerminal aggregates every PulseChain DEX (PulseX v1/v2, 9mm, …) with real
// reserves, and it's free. The mapping lives in `lib/geicko/pools.ts` so the
// token insights card can compute liquidity the exact same way.

export const revalidate = 0;
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chain = (sp.get('network') || 'pulsechain').toLowerCase();
  const token = (sp.get('token') || '').toLowerCase();
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  try {
    // Memoize for 10 minutes (matching Cache-Control): the page fetches this from
    // more than one component, and GeckoTerminal rate-limits aggressively enough
    // that duplicate bursts can come back empty. Empty results aren't cached —
    // they usually mean a rate-limit, not a token without pools. Keyed by chain
    // so /api/portfolio/insights shares the same memoized result.
    const payload = await cached(
      `pools:${chain}:${token}`,
      600_000,
      () => fetchGeckoTokenPools(chain, token),
      (v) => v.pairs.length > 0,
    );
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=7200' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load pools' },
      { status: 500 },
    );
  }
}
