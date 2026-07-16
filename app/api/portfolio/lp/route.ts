import { NextRequest, NextResponse } from 'next/server';

// Server-side LP info proxy. Given a list of V2-style LP token addresses,
// resolves each one's pair details (token0/1, reserves, prices) from
// DexScreener and the LP's own totalSupply from the chain's explorer. The
// portfolio aggregator combines this with the user's LP balance to compute
// the user's share of each underlying side.

const DEX_PAIRS_URL = 'https://api.dexscreener.com/latest/dex/pairs';

// Multiple RPC endpoints per chain. We try each in order and use the
// first one that responds — rpc.pulsechain.com has been timing out for
// stretches, and the public PulseChain RPC pool in general is uneven.
// Order curated by the project owner; first match wins.
const RPC_URLS: Record<string, string[]> = {
  pulsechain: [
    'https://rpc.pulsechainstats.com',
    'https://rpc.pulsechainrpc.com',
    'https://pulsechain-rpc.publicnode.com',
    'https://rpc.gigatheminter.com',
    'https://rpc-pulsechain.g4mm4.io',
    'https://rpc.degenprotocol.io',
  ],
  ethereum: [
    'https://ethereum-rpc.publicnode.com',
    'https://rpc.ankr.com/eth',
  ],
  robinhood: ['https://rpc.mainnet.chain.robinhood.com'],
};

// Blockscout token endpoint — fallback when every RPC is down.
const BLOCKSCOUT_TOKEN_URL: Record<string, string> = {
  pulsechain: 'https://api.scan.pulsechain.com/api/v2/tokens',
  ethereum: 'https://eth.blockscout.com/api/v2/tokens',
  robinhood: 'https://robinhoodchain.blockscout.com/api/v2/tokens',
};

// keccak256 selectors for V2 pair / ERC-20 reads we care about
const TOTAL_SUPPLY_SELECTOR = '0x18160ddd';
const GET_RESERVES_SELECTOR = '0x0902f1ac';
const TOKEN0_SELECTOR = '0x0dfe1681';
const TOKEN1_SELECTOR = '0xd21220a7';
const DECIMALS_SELECTOR = '0x313ce567';

const FETCH_TIMEOUT_MS = 8_000;
const RPC_TIMEOUT_MS = 4_000;
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
  robinhood: 'robinhood',
};

type ChainId = 'ethereum' | 'pulsechain' | 'robinhood';

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

async function callRpcRaw(
  url: string,
  to: string,
  data: string,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
        id: 1,
      }),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: string; error?: any };
    if (!json.result || json.error) return null;
    return json.result;
  } catch {
    return null;
  }
}

async function callContract(
  chainId: ChainId,
  to: string,
  data: string,
): Promise<string | null> {
  const urls = RPC_URLS[chainId] || [];
  for (const url of urls) {
    const result = await callRpcRaw(url, to, data);
    if (result) return result;
  }
  return null;
}

// Back-compat: totalSupply via the multi-RPC pool.
async function callRpc(url: string, address: string): Promise<string | null> {
  return callRpcRaw(url, address, TOTAL_SUPPLY_SELECTOR);
}

function decodeAddress(hex: string | null): string | null {
  if (!hex) return null;
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length < 40) return null;
  return ('0x' + clean.slice(-40)).toLowerCase();
}

function decodeUint(hex: string | null): bigint | null {
  if (!hex) return null;
  const norm = hex.startsWith('0x') ? hex : `0x${hex}`;
  if (norm === '0x' || norm === '0x0') return 0n;
  try {
    return BigInt(norm);
  } catch {
    return null;
  }
}

function decodeReserves(hex: string | null): { r0: bigint; r1: bigint } | null {
  if (!hex) return null;
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length < 128) return null;
  try {
    const r0 = BigInt('0x' + clean.slice(0, 64));
    const r1 = BigInt('0x' + clean.slice(64, 128));
    return { r0, r1 };
  } catch {
    return null;
  }
}

function bigIntToFloat(value: bigint, decimals: number): number {
  if (decimals <= 0) return Number(value);
  const divisor = 10n ** BigInt(decimals);
  const whole = Number(value / divisor);
  const fraction = Number(value % divisor) / Number(divisor);
  return whole + fraction;
}

// V2 pair on-chain reads: getReserves() + token0()/token1(). Used when
// DexScreener doesn't index the pair and returns reserves of 0 — without
// this, the breakdown sub-rows show 0 amounts even though the underlying
// pool genuinely holds tokens.
async function fetchOnChainPairState(
  chainId: ChainId,
  pairAddress: string,
): Promise<{
  token0Address: string | null;
  token1Address: string | null;
  reserve0Raw: bigint | null;
  reserve1Raw: bigint | null;
} | null> {
  const [reservesHex, token0Hex, token1Hex] = await Promise.all([
    callContract(chainId, pairAddress, GET_RESERVES_SELECTOR),
    callContract(chainId, pairAddress, TOKEN0_SELECTOR),
    callContract(chainId, pairAddress, TOKEN1_SELECTOR),
  ]);
  const reserves = decodeReserves(reservesHex);
  const token0Address = decodeAddress(token0Hex);
  const token1Address = decodeAddress(token1Hex);
  if (!reserves || !token0Address || !token1Address) return null;
  return {
    token0Address,
    token1Address,
    reserve0Raw: reserves.r0,
    reserve1Raw: reserves.r1,
  };
}

async function fetchTokenDecimals(
  chainId: ChainId,
  address: string,
): Promise<number> {
  const hex = await callContract(chainId, address, DECIMALS_SELECTOR);
  const value = decodeUint(hex);
  if (value == null) return 18;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n < 100 ? n : 18;
}

async function fetchTotalSupplyFromBlockscout(
  chainId: ChainId,
  address: string,
): Promise<string | null> {
  const url = BLOCKSCOUT_TOKEN_URL[chainId];
  if (!url) return null;
  try {
    const res = await fetch(`${url}/${address}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { total_supply?: string };
    return data?.total_supply || null;
  } catch {
    return null;
  }
}

async function fetchTotalSupply(
  chainId: ChainId,
  address: string,
): Promise<{ raw: string | null; decimals: number }> {
  // Try each configured RPC in order; first non-empty wins. V2 LP tokens
  // are always 18 decimals (hardcoded in the Uniswap V2 Pair contract).
  const urls = RPC_URLS[chainId] || [];
  for (const url of urls) {
    const result = await callRpc(url, address);
    if (!result) continue;
    const hex = result.startsWith('0x') ? result : `0x${result}`;
    if (hex === '0x' || hex === '0x0') return { raw: '0', decimals: 18 };
    try {
      const big = BigInt(hex);
      return { raw: big.toString(), decimals: 18 };
    } catch {
      // try next RPC
    }
  }

  // Every RPC failed — fall back to the explorer's token endpoint.
  const blockscoutSupply = await fetchTotalSupplyFromBlockscout(chainId, address);
  if (blockscoutSupply) return { raw: blockscoutSupply, decimals: 18 };

  return { raw: null, decimals: 18 };
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

// When DexScreener doesn't index a pair, pair.liquidity.{base,quote} are
// 0 — which would render LP sub-rows as "0 amount × $price = $0". Try
// to fill the gap from chain: getReserves() + token0()/token1() +
// decimals() per side. Returns the original LpInfo unmodified if either
// side already has a non-zero reserve (DexScreener data wins).
async function enrichWithOnChainReserves(info: LpInfo): Promise<LpInfo> {
  if (info.token0.reserveFormatted > 0 || info.token1.reserveFormatted > 0) {
    return info;
  }

  const state = await fetchOnChainPairState(info.chainId, info.pairAddress);
  if (!state || state.reserve0Raw == null || state.reserve1Raw == null) {
    return info;
  }

  const [d0, d1] = await Promise.all([
    fetchTokenDecimals(info.chainId, state.token0Address!),
    fetchTokenDecimals(info.chainId, state.token1Address!),
  ]);

  const reserve0 = bigIntToFloat(state.reserve0Raw, d0);
  const reserve1 = bigIntToFloat(state.reserve1Raw, d1);

  // On-chain token0/token1 ordering is canonical; if DexScreener's
  // base/quote came in swapped, map the on-chain reserves to whichever
  // side has the matching address. Otherwise apply by position.
  const t0Addr = state.token0Address!.toLowerCase();
  const t1Addr = state.token1Address!.toLowerCase();

  let nextToken0 = { ...info.token0 };
  let nextToken1 = { ...info.token1 };

  if (info.token0.address === t0Addr && info.token1.address === t1Addr) {
    nextToken0.reserveFormatted = reserve0;
    nextToken1.reserveFormatted = reserve1;
  } else if (info.token0.address === t1Addr && info.token1.address === t0Addr) {
    nextToken0.reserveFormatted = reserve1;
    nextToken1.reserveFormatted = reserve0;
  } else {
    // DexScreener pair didn't include real token addresses (or pair
    // entry missing entirely). Materialise sides from on-chain data so
    // the breakdown is still meaningful. Symbol/name will be filled by
    // the prices-proxy enrichment downstream.
    nextToken0 = {
      address: t0Addr,
      symbol: info.token0.symbol === '???' ? 'token0' : info.token0.symbol,
      name: info.token0.name === 'Unknown' ? '' : info.token0.name,
      reserveFormatted: reserve0,
      priceUsd: info.token0.priceUsd,
    };
    nextToken1 = {
      address: t1Addr,
      symbol: info.token1.symbol === '???' ? 'token1' : info.token1.symbol,
      name: info.token1.name === 'Unknown' ? '' : info.token1.name,
      reserveFormatted: reserve1,
      priceUsd: info.token1.priceUsd,
    };
  }

  // Recompute TVL from the now-populated reserves where we have prices.
  let totalLiquidityUsd = info.totalLiquidityUsd;
  if (totalLiquidityUsd == null) {
    const v0 = nextToken0.priceUsd != null ? nextToken0.reserveFormatted * nextToken0.priceUsd : null;
    const v1 = nextToken1.priceUsd != null ? nextToken1.reserveFormatted * nextToken1.priceUsd : null;
    if (v0 != null && v1 != null) totalLiquidityUsd = v0 + v1;
    else if (v0 != null) totalLiquidityUsd = v0 * 2; // V2 constant-product: sides are equal in value
    else if (v1 != null) totalLiquidityUsd = v1 * 2;
  }

  return {
    ...info,
    token0: nextToken0,
    token1: nextToken1,
    totalLiquidityUsd,
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
  const info = await enrichWithOnChainReserves(
    buildLpInfo(chainId, address, pair, totalSupply),
  );
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

  const chainId: ChainId = body?.chain === 'ethereum' ? 'ethereum' : body?.chain === 'robinhood' ? 'robinhood' : 'pulsechain';
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
  // Fill in on-chain reserves for any LP DexScreener doesn't track.
  // Done after the batch pair lookup so we can fan these out in parallel
  // — each enrichWithOnChainReserves issues up to 5 eth_calls.
  const enriched = await Promise.all(
    addresses.map(async (addr, i) => {
      const pair = allPairs[addr];
      if (!pair) {
        // No DexScreener entry at all — try a pure on-chain path so the
        // breakdown still surfaces. We synthesize an empty pair shell so
        // buildLpInfo + enrichWithOnChainReserves can populate it.
        const shell = {
          baseToken: { address: '', symbol: '???', name: 'Unknown' },
          quoteToken: { address: '', symbol: '???', name: 'Unknown' },
          liquidity: { base: 0, quote: 0, usd: null },
          priceUsd: null,
          priceNative: null,
          dexId: null,
        };
        const built = buildLpInfo(chainId, addr, shell, supplies[i]);
        const info = await enrichWithOnChainReserves(built);
        return { addr, info };
      }
      const info = await enrichWithOnChainReserves(
        buildLpInfo(chainId, addr, pair, supplies[i]),
      );
      return { addr, info };
    }),
  );

  for (const { addr, info } of enriched) {
    lps[addr] = info;
    lpCache.set(`${chainId}:${addr}`, info);
  }

  return NextResponse.json(
    { lps },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  );
}
