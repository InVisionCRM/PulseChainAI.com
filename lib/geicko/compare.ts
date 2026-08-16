// Two tokens, side by side.
//
// Both sides are loaded the same way — /api/search, which is DexScreener's pair
// search behind our own origin — and aggregated with the same arithmetic. That
// symmetry is the point: taking one side's liquidity from the page's pools call
// and the other's from a search would compare two different measurements and
// call the difference a result.

/** How many tokens a comparison can hold, the one on screen included. */
export const MAX_SIDES = 4;

/** The windows the chart cards offer. */
export const WINDOWS = [7, 30, 90] as const;
export type WindowDays = (typeof WINDOWS)[number];

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
  /** Daily prices over the requested window, same window for every side. */
  series?: number[] | null;
  /** Days of history actually inside that window — a young token has fewer. */
  covers?: number | null;
  /** 7d / 30d changes, when the performance route answers for the chain. */
  d7?: number | null;
  d30?: number | null;
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

/**
 * The price history every side is plotted on. Asking the performance route for
 * an explicit window is what makes two tokens' curves comparable — each one's
 * default series covers its own whole life, which is a different span per token.
 */
async function loadSeries(address: string, chain: string, days: number, attempt = 0): Promise<{
  series: number[] | null; covers: number | null; d7: number | null; d30: number | null;
} | null> {
  try {
    const r = await fetch(
      `/api/geicko/performance?token=${address}&network=${chain}&days=${days}`,
    );
    // Several sides load at once and the series is the slow half; one retry
    // turns a momentary miss into a line rather than a permanent "no history".
    if (!r.ok) {
      if (attempt === 0) {
        await new Promise((res) => setTimeout(res, 700));
        return loadSeries(address, chain, days, 1);
      }
      return null;
    }
    const j = await r.json();
    const usd = j?.views?.usd;
    if (!usd) {
      if (attempt === 0) {
        await new Promise((res) => setTimeout(res, 700));
        return loadSeries(address, chain, days, 1);
      }
      return null;
    }
    return {
      series: (usd.window?.points as number[] | undefined) ?? null,
      covers: (usd.window?.covers as number | undefined) ?? null,
      d7: usd.changes?.d7 ?? null,
      d30: usd.changes?.d30 ?? null,
    };
  } catch {
    if (attempt === 0) {
      await new Promise((res) => setTimeout(res, 700));
      return loadSeries(address, chain, days, 1);
    }
    return null;
  }
}

/** Search once and fold — used for every side of a comparison. */
export async function loadSide(address: string, windowDays = 30): Promise<CompareSide | null> {
  try {
    const r = await fetch(`/api/search?q=${encodeURIComponent(address)}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { pairs?: SearchHit[] };
    const side = foldPairs(j.pairs ?? [], address);
    if (!side) return null;
    // History is a second call and not every chain has it; the side is useful
    // without it, so a miss leaves the chart cards empty rather than the row.
    const hist = await loadSeries(address, side.chain, windowDays);
    return hist ? { ...side, ...hist } : side;
  } catch {
    return null;
  }
}

/**
 * One row per token, most relevant first.
 *
 * Ranking by liquidity alone picks the wrong token: searching "INC" returns a
 * dead Ethereum listing holding $7.7M of parked liquidity on $0.01 of daily
 * volume ahead of the PulseChain INC that actually trades. So the chain being
 * looked at wins first, then real activity, and only then depth.
 */
export async function searchTokens(q: string, preferChain?: string): Promise<SearchHit[]> {
  try {
    const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    if (!r.ok) return [];
    const j = (await r.json()) as { pairs?: SearchHit[] };
    const best = new Map<string, SearchHit>();
    for (const p of j.pairs ?? []) {
      const k = p.baseAddress?.toLowerCase();
      if (!k) continue;
      const cur = best.get(k);
      if (!cur || (p.liquidityUsd ?? 0) > (cur.liquidityUsd ?? 0)) best.set(k, p);
    }
    const rank = (h: SearchHit) => [
      preferChain && h.chain === preferChain ? 1 : 0,
      h.vol24 ?? 0,
      h.liquidityUsd ?? 0,
    ];
    return [...best.values()]
      .sort((a, b) => {
        const ra = rank(a);
        const rb = rank(b);
        for (let i = 0; i < ra.length; i++) if (rb[i] !== ra[i]) return rb[i] - ra[i];
        return 0;
      })
      .slice(0, 12);
  } catch {
    return [];
  }
}
