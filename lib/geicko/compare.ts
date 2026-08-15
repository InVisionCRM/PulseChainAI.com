// Two tokens, side by side.
//
// Both sides are loaded the same way — /api/search, which is DexScreener's pair
// search behind our own origin — and aggregated with the same arithmetic. That
// symmetry is the point: taking one side's liquidity from the page's pools call
// and the other's from a search would compare two different measurements and
// call the difference a result.

export interface CompareSide {
  address: string;
  chain: string;
  symbol: string;
  name: string | null;
  logo: string | null;
  priceUsd: number | null;
  chg24: number | null;
  /** Summed across every pool the search returned for the token. */
  liquidityUsd: number | null;
  vol24: number | null;
  /** From the deepest pool, since market cap is a per-token figure. */
  marketCap: number | null;
  pools: number;
  ageDays: number | null;
}

export interface SearchHit {
  chain: string;
  baseAddress: string;
  baseSymbol: string;
  baseName: string | null;
  quoteSymbol: string | null;
  imageUrl: string | null;
  priceUsd: number | null;
  marketCap: number | null;
  liquidityUsd: number | null;
  vol24: number | null;
  chg24: number | null;
  pairCreatedAt: string | null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : null;
};

/** Fold every pool of one token into a single row. */
export function foldPairs(pairs: SearchHit[], address: string): CompareSide | null {
  const a = address.toLowerCase();
  const mine = pairs.filter((p) => p.baseAddress?.toLowerCase() === a);
  if (!mine.length) return null;

  // The deepest pool carries the price and the cap; totals are summed.
  const deepest = mine.reduce((best, p) => ((p.liquidityUsd ?? 0) > (best.liquidityUsd ?? 0) ? p : best), mine[0]);
  const sum = (pick: (p: SearchHit) => number | null) => {
    let total = 0;
    let seen = false;
    for (const p of mine) {
      const v = pick(p);
      if (v == null) continue;
      seen = true;
      total += v;
    }
    return seen ? total : null;
  };
  const oldest = mine
    .map((p) => (p.pairCreatedAt ? Date.parse(p.pairCreatedAt) : NaN))
    .filter((t) => Number.isFinite(t))
    .sort((x, y) => x - y)[0];

  return {
    address: a,
    chain: deepest.chain,
    symbol: deepest.baseSymbol,
    name: deepest.baseName,
    logo: deepest.imageUrl,
    priceUsd: num(deepest.priceUsd),
    chg24: num(deepest.chg24),
    liquidityUsd: sum((p) => p.liquidityUsd),
    vol24: sum((p) => p.vol24),
    marketCap: num(deepest.marketCap),
    pools: mine.length,
    ageDays: oldest ? Math.max(0, Math.floor((Date.now() - oldest) / 86_400_000)) : null,
  };
}

/** Search once and fold — used for both the token on screen and its rival. */
export async function loadSide(address: string): Promise<CompareSide | null> {
  try {
    const r = await fetch(`/api/search?q=${encodeURIComponent(address)}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { pairs?: SearchHit[] };
    return foldPairs(j.pairs ?? [], address);
  } catch {
    return null;
  }
}

export async function searchTokens(q: string): Promise<SearchHit[]> {
  try {
    const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    if (!r.ok) return [];
    const j = (await r.json()) as { pairs?: SearchHit[] };
    // One row per token, deepest pool first.
    const best = new Map<string, SearchHit>();
    for (const p of j.pairs ?? []) {
      const k = p.baseAddress?.toLowerCase();
      if (!k) continue;
      const cur = best.get(k);
      if (!cur || (p.liquidityUsd ?? 0) > (cur.liquidityUsd ?? 0)) best.set(k, p);
    }
    return [...best.values()].sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0)).slice(0, 12);
  } catch {
    return [];
  }
}

/** How many of A's holders also hold B, from the overlap endpoint. */
export interface OverlapResult {
  hasData: boolean;
  holdersChecked: number;
  overlapCount: number;
  overlapPercent: number | null;
  contractsExcluded: number;
}

export async function loadOverlap(
  tokenA: string, tokenB: string, network: string,
): Promise<OverlapResult | null> {
  try {
    const r = await fetch(
      `/api/geicko/holder-overlap?tokenA=${tokenA}&tokenB=${tokenB}&network=${network}`,
    );
    if (!r.ok) return null;
    const j = await r.json();
    if (!j?.supported || !j?.hasData) return null;
    return {
      hasData: true,
      holdersChecked: j.holdersChecked ?? 0,
      overlapCount: j.overlapCount ?? 0,
      overlapPercent: j.overlapPercent ?? null,
      contractsExcluded: j.contractsExcluded ?? 0,
    };
  } catch {
    return null;
  }
}
