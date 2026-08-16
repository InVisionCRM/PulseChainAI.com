import { NextRequest, NextResponse } from 'next/server';

// Server-side DexScreener price proxy. The portfolio aggregator calls this
// instead of hitting DexScreener directly from the browser — the rate
// of parallel client-side fetches we'd otherwise need (~2 per token, for
// dozens of tokens in a wallet) trips intermittent network failures and
// shows as missing prices in the UI. We batch + dedupe + cache here so a
// portfolio with 50 tokens fans out into 50 controlled server requests.

const DEX_TOKENS_URL = 'https://api.dexscreener.com/latest/dex/tokens';
const CONCURRENCY = 10;
const FETCH_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 60_000;

// Liquidity floor for "real" pairs. Pairs with vanishingly small TVL
// generate volatile, misleading prices that we'd rather treat as missing.
const MIN_PAIR_LIQUIDITY_USD = 100;

interface PriceEntry {
  priceUsd: number | null;
  priceChange24h: number | null;
  name: string | null;
  symbol: string | null;
  logoURI: string | null;
  pairAddress: string | null;
  liquidityUsd: number | null;
  fetchedAt: number;
}

// In-memory cache, scoped per server runtime instance. This is intentionally
// not Redis or Vercel KV — DexScreener data is cheap to refetch and the cache
// is just a smoothing layer between rapid portfolio refreshes.
const priceCache = new Map<string, PriceEntry>();

// Keyed by chain as well as address, because the same address is a different
// token on each chain — see pickBestPair.
const cacheKey = (address: string, chain?: string) => `${address.toLowerCase()}:${chain ?? ''}`;

// DexScreener returns a Cloudflare HTML challenge for fetches without a real
// User-Agent (status 200 + content-type text/html instead of json), so the
// proxy has to look like a browser.
const DEX_HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: DEX_HEADERS,
      next: { revalidate: 60 },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Pick the pair to price a token from — on the right chain.
 *
 * The chain filter is the whole point. PulseChain forked Ethereum's state, so
 * the same address exists on both, and picking by liquidity alone always lands
 * on Ethereum because Ethereum is deeper. That priced the forked PulseChain
 * tokens as their Ethereum namesakes:
 *
 *   pDAI  0x6b17…1d0f — actually trades at $0.002142 on PulseChain
 *                       ($100k of liquidity), was shown as $1.
 *   pLUSD 0x5f98…8ba0 — has NO PulseChain pairs at all, so every pair on
 *                       offer was Ethereum's, and it too was shown as $1.
 *
 * Both are "stablecoins" in name only here, and a wallet holding them was told
 * it had dollars. With no chain given the old behaviour stands, so a caller
 * that genuinely wants the best pair anywhere still gets it.
 */
function pickBestPair(pairs: any[], address: string, chain?: string): any | null {
  if (!Array.isArray(pairs) || pairs.length === 0) return null;
  const target = address.toLowerCase();

  // Prefer pairs where the requested address is baseToken (we get its direct
  // priceUsd that way), and among those prefer the highest USD liquidity.
  const candidates = pairs.filter((p) => {
    if (chain && p?.chainId !== chain) return false;
    const base = p?.baseToken?.address?.toLowerCase();
    const quote = p?.quoteToken?.address?.toLowerCase();
    return base === target || quote === target;
  });

  const withLiquidity = candidates
    .map((p) => ({ pair: p, liq: Number(p?.liquidity?.usd) || 0 }))
    .filter((x) => x.liq >= MIN_PAIR_LIQUIDITY_USD)
    .sort((a, b) => b.liq - a.liq);

  return withLiquidity[0]?.pair ?? candidates[0] ?? null;
}

function entryFromDexResponse(address: string, data: any, chain?: string): PriceEntry {
  const pair = pickBestPair(data?.pairs || [], address, chain);
  if (!pair) {
    return {
      priceUsd: null,
      priceChange24h: null,
      name: null,
      symbol: null,
      logoURI: null,
      pairAddress: null,
      liquidityUsd: null,
      fetchedAt: Date.now(),
    };
  }

  const target = address.toLowerCase();
  const isBase = pair?.baseToken?.address?.toLowerCase() === target;
  const tokenSide = isBase ? pair.baseToken : pair.quoteToken;
  const priceUsdRaw = isBase ? pair?.priceUsd : null;
  // For quote-side hits, derive USD from the inverse using base price.
  let priceUsd: number | null = null;
  if (priceUsdRaw != null) priceUsd = Number(priceUsdRaw);
  if (priceUsd == null && !isBase && pair?.priceUsd && pair?.priceNative) {
    const basePriceUsd = Number(pair.priceUsd);
    const priceNative = Number(pair.priceNative);
    if (Number.isFinite(basePriceUsd) && Number.isFinite(priceNative) && priceNative > 0) {
      priceUsd = basePriceUsd / priceNative;
    }
  }

  const change24h = Number(pair?.priceChange?.h24);

  return {
    priceUsd: Number.isFinite(priceUsd ?? NaN) ? (priceUsd as number) : null,
    priceChange24h: Number.isFinite(change24h) ? change24h : null,
    name: tokenSide?.name ?? null,
    symbol: tokenSide?.symbol ?? null,
    logoURI: pair?.info?.imageUrl ?? tokenSide?.logoURI ?? null,
    pairAddress: pair?.pairAddress ?? null,
    liquidityUsd: Number(pair?.liquidity?.usd) || null,
    fetchedAt: Date.now(),
  };
}

async function fetchPrice({ address, chain }: PriceRequest): Promise<PriceEntry> {
  const key = cacheKey(address, chain);
  const cached = priceCache.get(key);
  // Don't trust cached entries whose lookup produced nothing — DexScreener
  // returns the same shape for "no pairs yet" and "blocked by Cloudflare",
  // and we'd rather pay the second roundtrip than show "—" forever.
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS && cached.priceUsd != null) {
    return cached;
  }

  try {
    const res = await fetchWithTimeout(`${DEX_TOKENS_URL}/${address}`);
    if (!res.ok) {
      const empty = entryFromDexResponse(address, { pairs: [] }, chain);
      priceCache.set(key, empty);
      return empty;
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      // Cloudflare challenge page or some other non-JSON response.
      const empty = entryFromDexResponse(address, { pairs: [] }, chain);
      priceCache.set(key, empty);
      return empty;
    }
    const data = await res.json();
    const entry = entryFromDexResponse(address, data, chain);
    priceCache.set(key, entry);
    return entry;
  } catch {
    const empty = entryFromDexResponse(address, { pairs: [] }, chain);
    priceCache.set(key, empty);
    return empty;
  }
}

async function runBatched<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const slice = items.slice(i, i + size);
    const results = await Promise.all(slice.map(fn));
    out.push(...results);
  }
  return out;
}

interface PriceRequest {
  address: string;
  /** DexScreener chain slug, e.g. 'pulsechain'. Omitted = search every chain. */
  chain?: string;
}

/**
 * Accepts `["0x…"]` or `[{address, chain}]`.
 *
 * The bare-string form is kept because other callers (the watchlist store) use
 * it and are chain-agnostic by design; they simply keep the old behaviour.
 * Results are keyed `address:chain` so a wallet holding the same address on two
 * chains gets two prices instead of one of them overwriting the other.
 */
function parseRequests(input: unknown): PriceRequest[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: PriceRequest[] = [];
  for (const raw of input) {
    const addr = (typeof raw === 'string' ? raw : raw?.address);
    if (typeof addr !== 'string') continue;
    const address = addr.trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(address)) continue;
    const chain =
      typeof raw === 'object' && raw && typeof raw.chain === 'string' && raw.chain.trim()
        ? raw.chain.trim()
        : undefined;
    const key = `${address}:${chain ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ address, chain });
  }
  return out;
}

/** Response key. Chainless requests keep the plain address they asked with. */
const responseKey = (r: PriceRequest) => (r.chain ? `${r.address}:${r.chain}` : r.address);

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const requests = parseRequests(body?.addresses);
  if (requests.length === 0) {
    return NextResponse.json({ prices: {} });
  }

  const entries = await runBatched(requests, CONCURRENCY, fetchPrice);
  const map: Record<string, PriceEntry> = {};
  requests.forEach((r, i) => {
    map[responseKey(r)] = entries[i];
  });

  return NextResponse.json({ prices: map }, {
    headers: { 'Cache-Control': 'private, max-age=30' },
  });
}
