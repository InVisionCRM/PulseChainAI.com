import { NextRequest, NextResponse } from 'next/server';

// Server proxy for TopTickerBar.
//
// Previously TopTickerBar fan-out fetched
// https://api.dexscreener.com/latest/dex/search?q=<addr> from the BROWSER
// for every gold-badge address. Without a real browser User-Agent
// DexScreener returns a Cloudflare HTML challenge, the JSON parse fails,
// and every token resolves to null — the ticker bar then renders
// nothing because `tokens.length === 0` returns early.
//
// This route lifts the call server-side, sends the same Cloudflare-safe
// UA every other DexScreener-hitting route in the repo uses, and
// preserves the exact pair-filter logic the browser was doing (PulseChain
// pairs whose other side is WPLS) so TickerCardWithPopover gets the same
// data shape it was already consuming.

const DEX_SEARCH_URL = 'https://api.dexscreener.com/latest/dex/search';
const WPLS_ADDRESS = '0xa1077a294dde1b09bb078844df40758a5d0f9a27';

const DEX_HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const CONCURRENCY = 5;
const FETCH_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 60_000;

interface TokenData {
  address: string;
  symbol: string;
  name: string;
  priceUsd: number;
  priceChange24h: number;
  priceChange6h?: number;
  priceChange1h?: number;
  volume24h: number;
  volume6h?: number;
  liquidity: number;
  fdv?: number;
  marketCap?: number;
  txCount24h?: number;
  buys24h?: number;
  sells24h?: number;
  dexId: string;
}

interface CacheEntry {
  tokens: TokenData[];
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const cacheKey = (addresses: string[]) => addresses.slice().sort().join('|');

function isValidAddress(s: unknown): s is string {
  return typeof s === 'string' && /^0x[a-f0-9]{40}$/i.test(s);
}

function parseAddresses(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of input) {
    if (!isValidAddress(v)) continue;
    const lc = v.toLowerCase();
    if (seen.has(lc)) continue;
    seen.add(lc);
    out.push(v); // preserve original (mixed-case) so the response keeps the caller's intent
  }
  return out;
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { headers: DEX_HEADERS, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchOne(contractAddress: string): Promise<TokenData | null> {
  const res = await fetchWithTimeout(
    `${DEX_SEARCH_URL}?q=${encodeURIComponent(contractAddress)}`,
  );
  if (!res || !res.ok) return null;
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return null;

  let data: any;
  try {
    data = await res.json();
  } catch {
    return null;
  }

  // Same filter the browser version did: PulseChain pairs that include
  // WPLS and the target token.
  const pairs: any[] = Array.isArray(data?.pairs) ? data.pairs : [];
  const target = contractAddress.toLowerCase();
  const match = pairs.find((p) => {
    if (p?.chainId !== 'pulsechain') return false;
    const t0 = p?.baseToken?.address?.toLowerCase();
    const t1 = p?.quoteToken?.address?.toLowerCase();
    const hasWpls = t0 === WPLS_ADDRESS || t1 === WPLS_ADDRESS;
    if (!hasWpls) return false;
    return t0 === target || t1 === target;
  });

  if (!match) return null;

  const isBaseToken = match.baseToken?.address?.toLowerCase() === target;
  const tokenSide = isBaseToken ? match.baseToken : match.quoteToken;

  return {
    address: tokenSide?.address || contractAddress,
    symbol: tokenSide?.symbol || '???',
    name: tokenSide?.name || 'Unknown',
    priceUsd: parseFloat(match.priceUsd || '0') || 0,
    priceChange24h: parseFloat(match.priceChange?.h24 || '0') || 0,
    priceChange6h: match.priceChange?.h6 != null ? parseFloat(match.priceChange.h6) : undefined,
    priceChange1h: match.priceChange?.h1 != null ? parseFloat(match.priceChange.h1) : undefined,
    volume24h: parseFloat(match.volume?.h24 || '0') || 0,
    volume6h: match.volume?.h6 != null ? parseFloat(match.volume.h6) : undefined,
    liquidity: parseFloat(match.liquidity?.usd || '0') || 0,
    fdv: match.fdv ? parseFloat(match.fdv) : undefined,
    marketCap: match.marketCap ? parseFloat(match.marketCap) : undefined,
    txCount24h: match.txns?.h24 ? parseInt(String(match.txns.h24)) : undefined,
    buys24h: match.txns?.h24buys ? parseInt(String(match.txns.h24buys)) : undefined,
    sells24h: match.txns?.h24sells ? parseInt(String(match.txns.h24sells)) : undefined,
    dexId: match.dexId || 'unknown',
  };
}

async function runBatched(items: string[], size: number): Promise<(TokenData | null)[]> {
  const out: (TokenData | null)[] = [];
  for (let i = 0; i < items.length; i += size) {
    const slice = items.slice(i, i + size);
    const results = await Promise.all(slice.map(fetchOne));
    out.push(...results);
  }
  return out;
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const addresses = parseAddresses(body?.addresses);
  if (addresses.length === 0) {
    return NextResponse.json({ tokens: [] });
  }

  const key = cacheKey(addresses);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ tokens: cached.tokens, fetchedAt: cached.fetchedAt });
  }

  const results = await runBatched(addresses, CONCURRENCY);
  const tokens = results.filter((t): t is TokenData => t !== null);

  const entry: CacheEntry = { tokens, fetchedAt: Date.now() };
  cache.set(key, entry);

  return NextResponse.json({ tokens, fetchedAt: entry.fetchedAt }, {
    headers: { 'Cache-Control': 'private, max-age=30' },
  });
}
