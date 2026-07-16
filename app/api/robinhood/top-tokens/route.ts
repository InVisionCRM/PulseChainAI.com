import { NextResponse } from 'next/server';
import { getChain } from '@/lib/chains/registry';
import { cached } from '@/lib/geicko/serverCache';

// Live "popular tokens" for Robinhood Chain — the same idea the PulseChain
// screener uses (DexScreener for market data), but with the token *roster*
// coming from Blockscout because DexScreener has no "list every token on a
// chain" endpoint (only lookup-by-address, lookup-by-pair, and a noisy text
// search). So: Blockscout supplies which tokens exist (ranked by market cap /
// holders), DexScreener enriches each with price / volume / liquidity / logo.
// Both are free — no Moralis, no paid tier.

export const revalidate = 0;
export const maxDuration = 30;

const CHAIN = getChain('robinhood');
const BLOCKSCOUT = CHAIN.blockscoutApiBase; // https://robinhoodchain.blockscout.com/api/v2
const DEX_SLUG = CHAIN.dexscreenerSlug ?? 'robinhood';
const DS = 'https://api.dexscreener.com';

export interface RobinhoodToken {
  address: string;
  symbol: string;
  name: string;
  priceUsd: number | null;
  volume24: number;
  liquidityUsd: number;
  priceChange24: number | null;
  logo: string | null;
  holders: number | null;
  pairAddress: string | null;
  dexId: string | null;
}

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

async function getJson(url: string, timeoutMs = 8000): Promise<any | null> {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/json' },
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

interface RosterEntry {
  address: string;
  symbol: string;
  name: string;
  holders: number | null;
  logo: string | null;
}

// Roster of ERC-20 tokens on the chain, as Blockscout ranks them (circulating
// market cap, then holders). This is the reliable "which tokens exist" source.
async function blockscoutRoster(): Promise<RosterEntry[]> {
  const d = await getJson(`${BLOCKSCOUT}/tokens?type=ERC-20`, 8000);
  const items: any[] = Array.isArray(d?.items) ? d.items : [];
  const out: RosterEntry[] = [];
  for (const t of items) {
    const address = String(t?.address ?? t?.address_hash ?? '').toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(address)) continue;
    const holders = Number(t?.holders ?? t?.holders_count);
    out.push({
      address,
      symbol: t?.symbol ?? '?',
      name: t?.name ?? t?.symbol ?? '',
      holders: Number.isFinite(holders) && holders > 0 ? holders : null,
      logo: t?.icon_url ?? null,
    });
  }
  return out;
}

// Enrich a set of token addresses with DexScreener market data. The tokens
// endpoint takes up to 30 comma-separated addresses per call.
async function dexScreenerBest(addresses: string[]): Promise<Map<string, any>> {
  const best = new Map<string, any>(); // baseAddress -> deepest-liquidity pair
  const chunks: string[][] = [];
  for (let i = 0; i < addresses.length; i += 30) chunks.push(addresses.slice(i, i + 30));

  const results = await Promise.all(
    chunks.map((c) => getJson(`${DS}/latest/dex/tokens/${c.join(',')}`, 8000)),
  );

  for (const j of results) {
    for (const p of (j?.pairs ?? []) as any[]) {
      if (!p || p.chainId !== DEX_SLUG) continue;
      const base = String(p.baseToken?.address ?? '').toLowerCase();
      if (!base) continue;
      const liq = num(p.liquidity?.usd);
      const cur = best.get(base);
      if (!cur || liq > num(cur.liquidity?.usd)) best.set(base, p);
    }
  }
  return best;
}

async function build(): Promise<{ tokens: RobinhoodToken[]; source: string }> {
  const roster = await blockscoutRoster();
  if (roster.length === 0) return { tokens: [], source: 'blockscout-empty' };

  const best = await dexScreenerBest(roster.map((r) => r.address));

  const tokens: RobinhoodToken[] = [];
  for (const r of roster) {
    const p = best.get(r.address);
    if (!p) continue; // no live DexScreener market for this token — skip
    tokens.push({
      address: r.address,
      symbol: p.baseToken?.symbol ?? r.symbol,
      name: p.baseToken?.name ?? r.name,
      priceUsd: p.priceUsd != null ? num(p.priceUsd) : null,
      volume24: num(p.volume?.h24),
      liquidityUsd: num(p.liquidity?.usd),
      priceChange24: p.priceChange?.h24 != null ? num(p.priceChange.h24) : null,
      logo: p.info?.imageUrl ?? r.logo ?? null,
      holders: r.holders,
      pairAddress: p.pairAddress ?? null,
      dexId: p.dexId ?? null,
    });
  }

  // Most "popular" = most actively traded. Rank by 24h volume, then liquidity.
  tokens.sort((a, b) => b.volume24 - a.volume24 || b.liquidityUsd - a.liquidityUsd);
  return { tokens, source: 'blockscout+dexscreener' };
}

export async function GET() {
  try {
    const payload = await cached(
      'robinhood:top-tokens',
      120_000, // 2 min — market data moves, but this is a list, not a quote
      build,
      (v) => v.tokens.length > 0,
    );
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=120, s-maxage=120, stale-while-revalidate=600' },
    });
  } catch (err) {
    return NextResponse.json(
      { tokens: [], source: 'error', error: err instanceof Error ? err.message : 'failed' },
      { status: 500 },
    );
  }
}
