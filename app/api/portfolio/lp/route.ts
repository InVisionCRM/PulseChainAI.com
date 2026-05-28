import { NextRequest, NextResponse } from 'next/server';

// Server-side LP info proxy. Given a list of V2-style LP token addresses,
// resolves each one's pair details (token0/1, reserves, prices) from
// DexScreener and the LP's own totalSupply from the chain's explorer. The
// portfolio aggregator combines this with the user's LP balance to compute
// the user's share of each underlying side.

const DEX_PAIRS_URL = 'https://api.dexscreener.com/latest/dex/pairs';
const RPC_URL: Record<string, string> = {
  pulsechain: 'https://rpc.pulsechain.com',
  ethereum: 'https://eth.llamarpc.com',
};
// totalSupply() — first 4 bytes of keccak256("totalSupply()")
const TOTAL_SUPPLY_SELECTOR = '0x18160ddd';
const FETCH_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 60_000;

// DexScreener returns a Cloudflare HTML challenge for fetches without a
// real User-Agent (same as the prices route).
const DEX_HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const DEX_CHAIN: Record<string, string> = {
  ethereum: 'ethereum',
  pulsechain: 'pulsechain',
};

type ChainId = 'ethereum' | 'pulsechain';

interface LpSide {
  address: string;
  symbol: string;
  name: string;
  reserveFormatted: number;
  priceUsd: number | null;
}

interface LpInfo {
  pairAddress: string;
  dexId: string | null;
  chainId: ChainId;
  token0: LpSide;
  token1: LpSide;
  totalSupplyRaw: string | null;
  totalSupplyFormatted: number | null;
  decimals: number;
  totalLiquidityUsd: number | null;
  fetchedAt: number;
}

const lpCache = new Map<string, LpInfo | null>();

async function fetchWithTimeout(url: string, headers?: Record<string, string>) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers,
      next: { revalidate: 60 },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseAddresses(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of input) {
    if (typeof a !== 'string') continue;
    const addr = a.trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(addr)) continue;
    if (seen.has(addr)) continue;
    seen.add(addr);
    out.push(addr);
  }
  return out;
}

function toNumberSafe(raw: unknown, decimals: number): number {
  if (raw == null) return 0;
  try {
    const big = BigInt(String(raw));
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = Number(big / divisor);
    const fraction = Number(big % divisor) / Number(divisor);
    return whole + fraction;
  } catch {
    const n = parseFloat(String(raw));
    return Number.isFinite(n) ? n / 10 ** decimals : 0;
  }
}

async function fetchPairBatch(
  chainId: ChainId,
  addresses: string[],
): Promise<Record<string, any>> {
  if (addresses.length === 0) return {};
  const url = `${DEX_PAIRS_URL}/${DEX_CHAIN[chainId]}/${addresses.join(',')}`;
  try {
    const res = await fetchWithTimeout(url, DEX_HEADERS);
    if (!res.ok) return {};
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return {};
    const data = (await res.json()) as { pairs?: any[] };
    const map: Record<string, any> = {};
    for (const pair of data.pairs || []) {
      const addr = String(pair.pairAddress || '').toLowerCase();
      if (addr) map[addr] = pair;
    }
    return map;
  } catch {
    return {};
  }
}

async function fetchTotalSupply(
  chainId: ChainId,
  address: string,
): Promise<{ raw: string | null; decimals: number }> {
  // PulseScan and Etherscan-style token endpoints are explorer APIs that
  // often 502 under load. Going directly to the chain's JSON-RPC is both
  // faster and more reliable — `totalSupply()` is a standard ERC-20 read.
  const rpcUrl = RPC_URL[chainId];
  if (!rpcUrl) return { raw: null, decimals: 18 };

  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: address, data: TOTAL_SUPPLY_SELECTOR }, 'latest'],
        id: 1,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return { raw: null, decimals: 18 };
    const data = (await res.json()) as { result?: string; error?: any };
    if (!data.result || data.error) return { raw: null, decimals: 18 };
    // result is 32-byte hex; parse as BigInt then back to decimal string
    const hex = data.result.startsWith('0x') ? data.result : `0x${data.result}`;
    if (hex === '0x' || hex === '0x0') return { raw: '0', decimals: 18 };
    const big = BigInt(hex);
    // V2 LP tokens are always 18 decimals (hardcoded in Uniswap V2 Pair).
    return { raw: big.toString(), decimals: 18 };
  } catch {
    return { raw: null, decimals: 18 };
  }
}

function deriveSidePrice(
  pair: any,
  side: 'base' | 'quote',
): number | null {
  const basePriceRaw = pair?.priceUsd;
  const priceNativeRaw = pair?.priceNative;
  const basePriceUsd = basePriceRaw != null ? Number(basePriceRaw) : NaN;
  const priceNative = priceNativeRaw != null ? Number(priceNativeRaw) : NaN;

  if (side === 'base') {
    return Number.isFinite(basePriceUsd) ? basePriceUsd : null;
  }
  // Quote price = base USD price divided by base-per-quote ratio (priceNative).
  if (Number.isFinite(basePriceUsd) && Number.isFinite(priceNative) && priceNative > 0) {
    return basePriceUsd / priceNative;
  }
  return null;
}

function buildLpInfo(
  chainId: ChainId,
  address: string,
  pair: any,
  totalSupply: { raw: string | null; decimals: number },
): LpInfo {
  const liqBase = Number(pair?.liquidity?.base) || 0;
  const liqQuote = Number(pair?.liquidity?.quote) || 0;
  const totalLiquidityUsd = Number(pair?.liquidity?.usd);

  const token0: LpSide = {
    address: String(pair?.baseToken?.address || '').toLowerCase(),
    symbol: pair?.baseToken?.symbol || '???',
    name: pair?.baseToken?.name || 'Unknown',
    reserveFormatted: liqBase,
    priceUsd: deriveSidePrice(pair, 'base'),
  };
  const token1: LpSide = {
    address: String(pair?.quoteToken?.address || '').toLowerCase(),
    symbol: pair?.quoteToken?.symbol || '???',
    name: pair?.quoteToken?.name || 'Unknown',
    reserveFormatted: liqQuote,
    priceUsd: deriveSidePrice(pair, 'quote'),
  };

  const totalSupplyFormatted = totalSupply.raw
    ? toNumberSafe(totalSupply.raw, totalSupply.decimals)
    : null;

  return {
    pairAddress: address,
    dexId: pair?.dexId || null,
    chainId,
    token0,
    token1,
    totalSupplyRaw: totalSupply.raw,
    totalSupplyFormatted,
    decimals: totalSupply.decimals,
    totalLiquidityUsd: Number.isFinite(totalLiquidityUsd) ? totalLiquidityUsd : null,
    fetchedAt: Date.now(),
  };
}

async function resolveOne(chainId: ChainId, address: string): Promise<LpInfo | null> {
  const key = `${chainId}:${address}`;
  const cached = lpCache.get(key);
  if (cached !== undefined && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }

  const pairs = await fetchPairBatch(chainId, [address]);
  const pair = pairs[address];
  if (!pair) {
    lpCache.set(key, null);
    return null;
  }
  const totalSupply = await fetchTotalSupply(chainId, address);
  const info = buildLpInfo(chainId, address, pair, totalSupply);
  lpCache.set(key, info);
  return info;
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const chainId: ChainId = body?.chain === 'ethereum' ? 'ethereum' : 'pulsechain';
  const addresses = parseAddresses(body?.addresses);
  if (addresses.length === 0) {
    return NextResponse.json({ lps: {} });
  }

  // We do the pair lookup as a single batch (up to 30 per DexScreener call)
  // and the totalSupply lookups in parallel — both are cheap reads.
  const pairChunks: string[][] = [];
  for (let i = 0; i < addresses.length; i += 30) {
    pairChunks.push(addresses.slice(i, i + 30));
  }
  const pairMaps = await Promise.all(
    pairChunks.map((chunk) => fetchPairBatch(chainId, chunk)),
  );
  const allPairs: Record<string, any> = Object.assign({}, ...pairMaps);

  const supplies = await Promise.all(
    addresses.map((addr) => fetchTotalSupply(chainId, addr)),
  );

  const lps: Record<string, LpInfo | null> = {};
  for (let i = 0; i < addresses.length; i++) {
    const addr = addresses[i];
    const pair = allPairs[addr];
    if (!pair) {
      lps[addr] = null;
      lpCache.set(`${chainId}:${addr}`, null);
      continue;
    }
    const info = buildLpInfo(chainId, addr, pair, supplies[i]);
    lps[addr] = info;
    lpCache.set(`${chainId}:${addr}`, info);
  }

  return NextResponse.json(
    { lps },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  );
}
