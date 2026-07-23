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

// EVM chains we index on GeckoTerminal. Used for the cross-chain fallback below.
const SUPPORTED_CHAINS = ['pulsechain', 'robinhood', 'ethereum'];

const poolsFor = (chain: string, token: string) =>
  cached(
    // Keyed by chain so /api/portfolio/insights shares the same memoized result.
    `pools:${chain}:${token}`,
    600_000,
    () => fetchGeckoTokenPools(chain, token),
    (v) => v.pairs.length > 0, // never cache an empty (usually a rate-limit) result
  );

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chain = (sp.get('network') || 'pulsechain').toLowerCase();
  const token = (sp.get('token') || '').toLowerCase();
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  try {
    // Memoize for 10 minutes (matching Cache-Control): the page fetches this from
    // more than one component, and GeckoTerminal rate-limits aggressively enough
    // that duplicate bursts can come back empty.
    let payload = await poolsFor(chain, token);

    // Cross-chain fallback. The geicko page opens on its default network
    // (pulsechain) before it knows the token's chain, and chain auto-detection
    // leans on a client-side DexScreener call that can lag or fail. So when the
    // requested chain has no pools, probe the other supported chains — a
    // Robinhood/Ethereum-only token (e.g. CASHCAT on Robinhood) then still
    // returns its liquidity, and each pair carries `chainId`, which the page
    // uses to switch the active network. Normal (found-on-first-chain) tokens
    // never trigger this.
    if (payload.pairs.length === 0) {
      for (const alt of SUPPORTED_CHAINS) {
        if (alt === chain) continue;
        const p = await poolsFor(alt, token);
        if (p.pairs.length > 0) {
          payload = p;
          break;
        }
      }
    }

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
