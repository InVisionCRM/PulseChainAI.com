// Minimal server-side DexScreener USD price lookup for the history feed.
//
// The PulseChain (Otterscan) path decodes token flows from receipt logs but
// has no price source — unlike the Ethereum (Blockscout) path, which carries
// `exchange_rate`. This mirrors the best-pair-by-liquidity strategy in
// /api/portfolio/prices but returns just address → current priceUsd, with its
// own short-lived cache (tokens repeat heavily across rows and wallets, so the
// cache keeps the added latency small after warm-up).

const DEX_TOKENS_URL = 'https://api.dexscreener.com/latest/dex/tokens';
const TTL_MS = 60_000;
const TIMEOUT_MS = 8_000;
const CONCURRENCY = 8;
const MIN_PAIR_LIQUIDITY_USD = 100;

// DexScreener serves a Cloudflare HTML challenge to non-browser UAs, so we
// have to look like a browser (same as the prices proxy).
const DEX_HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const cache = new Map<string, { price: number | null; at: number }>();

function bestPriceUsd(pairs: any, target: string, chainId?: string): number | null {
  if (!Array.isArray(pairs)) return null;
  const cand = pairs
    .filter(
      (p) =>
        // Same contract address exists on multiple chains (e.g. WETH's Ethereum
        // address is a near-worthless forked token on PulseChain). Scope to the
        // requested chain so we don't price a PulseChain token off Ethereum's
        // deep liquidity.
        (!chainId || p?.chainId === chainId) &&
        (p?.baseToken?.address?.toLowerCase() === target ||
          p?.quoteToken?.address?.toLowerCase() === target),
    )
    .map((p) => ({ p, liq: Number(p?.liquidity?.usd) || 0 }))
    .filter((x) => x.liq >= MIN_PAIR_LIQUIDITY_USD)
    .sort((a, b) => b.liq - a.liq);
  const pair = cand[0]?.p;
  if (!pair) return null;
  const isBase = pair.baseToken?.address?.toLowerCase() === target;
  if (isBase) {
    const v = Number(pair.priceUsd);
    return Number.isFinite(v) ? v : null;
  }
  // Quote-side hit: derive USD from the base price / native ratio.
  const baseUsd = Number(pair.priceUsd);
  const priceNative = Number(pair.priceNative);
  if (Number.isFinite(baseUsd) && Number.isFinite(priceNative) && priceNative > 0) {
    return baseUsd / priceNative;
  }
  return null;
}

async function fetchOne(addr: string, chainId?: string): Promise<number | null> {
  const lower = addr.toLowerCase();
  // Cache per (address, chain) — the same address prices differently per chain.
  const key = `${lower}:${chainId ?? ''}`;
  const hit = cache.get(key);
  // Re-fetch nulls (could be a transient Cloudflare block) but trust real prices.
  if (hit && Date.now() - hit.at < TTL_MS && hit.price != null) return hit.price;

  let price: number | null = null;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${DEX_TOKENS_URL}/${addr}`, {
      headers: DEX_HEADERS,
      signal: controller.signal,
    });
    if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
      const data = await res.json();
      price = bestPriceUsd(data?.pairs, lower, chainId);
    }
  } catch {
    /* leave null */
  } finally {
    clearTimeout(t);
  }
  cache.set(key, { price, at: Date.now() });
  return price;
}

/**
 * Returns address → priceUsd for the addresses that have a price (others
 * omitted). Pass `chainId` (e.g. 'pulsechain') to scope pricing to that chain —
 * essential for forked tokens whose address is a high-value asset on another
 * chain (WETH, USDC, DAI…).
 */
export async function fetchUsdPrices(
  addresses: string[],
  chainId?: string,
): Promise<Map<string, number>> {
  const uniq = [
    ...new Set(
      addresses.map((a) => a.toLowerCase()).filter((a) => /^0x[a-f0-9]{40}$/.test(a)),
    ),
  ];
  const out = new Map<string, number>();
  for (let i = 0; i < uniq.length; i += CONCURRENCY) {
    const slice = uniq.slice(i, i + CONCURRENCY);
    const prices = await Promise.all(slice.map((a) => fetchOne(a, chainId)));
    slice.forEach((a, j) => {
      const p = prices[j];
      if (p != null) out.set(a, p);
    });
  }
  return out;
}
