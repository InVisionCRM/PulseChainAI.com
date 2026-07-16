import { NextRequest, NextResponse } from 'next/server';

// Server-side proxy for wallet balance + address-info from Blockscout.
//
// Why: this is the actual "show every token the wallet holds" path.
// Doing this from the browser CORS-fails in production; doing it via
// eth_getLogs on public PulseChain RPCs times out. Server-to-server is
// the right tool — no CORS, no rate-limit, and Blockscout already does
// the enumeration work for us.
//
// Returns all non-zero balances with the basic metadata the explorer
// already knows (name, symbol, decimals, icon, contract flag). Prices /
// logos still go through DexScreener downstream; this route is strictly
// the chain-side "what does this wallet hold" layer.

type ChainId = 'ethereum' | 'pulsechain' | 'robinhood';

const BLOCKSCOUT_BASE: Record<ChainId, string> = {
  pulsechain: 'https://api.scan.pulsechain.com/api/v2',
  ethereum: 'https://eth.blockscout.com/api/v2',
  robinhood: 'https://robinhoodchain.blockscout.com/api/v2',
};

// Fail fast: if Blockscout is slow/down, give up quickly and fall through to
// the RPC pool below instead of freezing the UI. (Was 12s — that 12s wait was
// the visible freeze whenever the PulseChain explorer had an outage.)
const FETCH_TIMEOUT_MS = 6_000;
const CACHE_TTL_MS = 30_000;

// Fallback RPC pool — used when Blockscout is 502ing or unreachable so
// the portfolio still shows something instead of an empty wallet.
const RPC_URLS: Record<ChainId, string[]> = {
  pulsechain: [
    'https://rpc.pulsechainrpc.com',
    'https://pulsechain-rpc.publicnode.com',
    'https://rpc.gigatheminter.com',
    'https://rpc-pulsechain.g4mm4.io',
  ],
  ethereum: [
    'https://ethereum-rpc.publicnode.com',
    'https://rpc.ankr.com/eth',
  ],
  robinhood: ['https://rpc.mainnet.chain.robinhood.com'],
};
const RPC_TIMEOUT_MS = 8_000;
const BATCH_CHUNK = 80;
const BALANCE_OF_SELECTOR = '0x70a08231';
const DECIMALS_SELECTOR = '0x313ce567';

// Conservative seed list for the fallback path — popular contracts whose
// non-zero balances are worth surfacing even when Blockscout is down.
// Same set we shipped in PR #4. Anything outside this list only appears
// when Blockscout is healthy, but that's strictly better than nothing.
const FALLBACK_TOKENS: Record<ChainId, string[]> = {
  pulsechain: [
    '0xa1077a294dde1b09bb078844df40758a5d0f9a27', // WPLS
    '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', // HEX
    '0x95b303987a60c71504d99aa1b13b4da07b0790ab', // PLSX
    '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d', // INC
    '0x57fde0a71132198bbec939b98976993d8d89d225', // eHEX
    '0x8a7fdca264e87b6da72d000f22186b4403081a2a', // ePLSX
    '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07', // USDC.e
    '0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f', // USDT.e
    '0xefd766ccb38eaf1dfd701853bfce31359239f305', // DAI.e
    '0xb7d4eb5fdfe3d4d3b5c16a44a49948c6ec77c6f1', // Morbius
    '0x6b32022693210cd2cfc466b9ac0085de8fc34ea6', // pSSH
    '0x33779a40987f729a7df6cc08b1dad1a21b58a220', // RICH
    '0x456548a9b56efbbd89ca0309edd17a9e20b04018', // FLOWT
    '0x347a96a5bd06d2e15199b032f46fb724d6c73047', // ASIC
    '0xa685c45fd071df23278069db9137e124564897d0', // LBRTY
    '0xb876257c7550010f14a527d2bf8fda9360f8597b', // Morbius/WPLS LP
    '0xdbed78e14e230158ec01e534749bd5ae5ed0816f', // RICH/Morbius LP
    '0xe56043671df55de5cdf8459710433c10324de0ae', // WPLS/DAI LP
    '0x6753560538eca67617a9ce605178f788be7e524e', // WPLS/USDC LP
    '0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9', // HEX/WPLS LP
    '0x322df7921f28f1146cdf62afdac0d6bc0ab80711', // PLSX/WPLS LP
    '0xf1f4ee610b2babb05c635f726ef8b0c568c8dc65', // INC/WPLS LP
  ],
  ethereum: [
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
    '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
    '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
    '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
    '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', // UNI
    '0x514910771af9ca656af840dff83e8264ecf986ca', // LINK
    '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9', // AAVE
    '0x6982508145454ce325ddbe47a25d4ec3d2311933', // PEPE
    '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', // HEX
  ],
  robinhood: [
    '0x0bd7d308f8e1639fab988df18a8011f41eacad73', // WETH (aeWETH)
    '0x5fc5360d0400a0fd4f2af552add042d716f1d168', // USDG
    '0xaf3d76f1834a1d425780943c99ea8a608f8a93f9', // AAPL
    '0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec', // NVDA
    '0x322f0929c4625ed5bad873c95208d54e1c003b2d', // TSLA
  ],
};

interface TokenBalance {
  address: string;
  balanceRaw: string;
  decimals: number;
  // Carried through from the explorer when present — saves the prices
  // proxy from filling these for tokens it doesn't know about, and gives
  // the UI something to render even before prices have come back.
  symbol?: string;
  name?: string;
  iconUrl?: string;
  // Lightweight "is this contract verified" hint, plus things the UI
  // uses to flag obvious spam without a network call.
  isVerified?: boolean;
  exchangeRate?: number | null;
  circulatingMarketCap?: number | null;
  holdersCount?: number | null;
  totalSupplyRaw?: string | null;
  type?: string; // ERC-20 / ERC-721 / etc — NFTs filtered upstream
}

interface BalancesResponse {
  chain: ChainId;
  address: string;
  tokens: TokenBalance[];
  nativeBalanceRaw: string | null;
  fetchedAt: number;
  // Which path produced the response. 'blockscout' means full enumeration
  // (every token the wallet holds). 'rpc-fallback' means Blockscout was
  // down and we returned the subset of curated tokens with non-zero
  // balances. UI can use this to badge "limited view".
  source: 'blockscout' | 'rpc-fallback';
}

const cache = new Map<string, BalancesResponse>();
const cacheKey = (chain: ChainId, address: string) =>
  `${chain}:${address.toLowerCase()}`;

function isValidAddress(s: unknown): s is string {
  return typeof s === 'string' && /^0x[a-f0-9]{40}$/i.test(s);
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchJson(url: string): Promise<any | null> {
  const r = await fetchWithTimeout(url);
  if (!r || !r.ok) return null;
  try {
    return await r.json();
  } catch {
    return null;
  }
}

function normaliseBalance(item: any, chain: ChainId): TokenBalance | null {
  const t = item?.token || {};
  // PulseScan uses `address`, eth.blockscout uses `address_hash`.
  const tokenAddress: string | undefined =
    t.address || t.address_hash || item.contractAddress;
  if (!tokenAddress) return null;

  const balance = String(item.value ?? item.balance ?? '0');
  if (balance === '0' || balance === '') return null;

  // We only care about fungibles for the portfolio view; NFTs and
  // ERC-1155 collectibles don't make sense in the "what's it worth"
  // column and the renderer expects a fungible shape.
  const tokenType: string | undefined = t.type;
  if (tokenType && /721|1155/.test(tokenType)) return null;

  const decimalsRaw = t.decimals ?? item.decimals ?? 18;
  const decimals =
    typeof decimalsRaw === 'string' ? parseInt(decimalsRaw, 10) : decimalsRaw;
  const finalDecimals = Number.isFinite(decimals) ? decimals : 18;

  return {
    address: tokenAddress.toLowerCase(),
    balanceRaw: balance,
    decimals: finalDecimals,
    symbol: t.symbol || undefined,
    name: t.name || undefined,
    iconUrl: t.icon_url || undefined,
    isVerified: t.is_smart_contract_verified ?? undefined,
    exchangeRate: t.exchange_rate != null ? Number(t.exchange_rate) : null,
    circulatingMarketCap:
      t.circulating_market_cap != null ? Number(t.circulating_market_cap) : null,
    holdersCount: t.holders_count != null ? Number(t.holders_count) : null,
    totalSupplyRaw: t.total_supply || null,
    type: tokenType,
  };
}

interface RpcRequest {
  method: string;
  params: unknown[];
}

async function rpcSingle(
  url: string,
  method: string,
  params: unknown[],
): Promise<any | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const d: any = await res.json();
    if (d?.error || d?.result === undefined) return null;
    return d.result;
  } catch {
    return null;
  }
}

async function rpcBatch(
  url: string,
  reqs: RpcRequest[],
): Promise<(any | null)[] | null> {
  if (reqs.length === 0) return [];
  try {
    const body = reqs.map((r, i) => ({
      jsonrpc: '2.0',
      method: r.method,
      params: r.params,
      id: i,
    }));
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const arr: any = await res.json();
    if (!Array.isArray(arr)) return null;
    const out: (any | null)[] = new Array(reqs.length).fill(null);
    for (const x of arr) {
      if (typeof x?.id === 'number' && x.id < out.length) {
        out[x.id] = x?.error || x?.result === undefined ? null : x.result;
      }
    }
    return out;
  } catch {
    return null;
  }
}

async function tryRpcs<T>(
  urls: string[],
  fn: (url: string) => Promise<T | null>,
): Promise<{ result: T | null; url: string | null }> {
  for (const url of urls) {
    const r = await fn(url);
    if (r != null) return { result: r, url };
  }
  return { result: null, url: null };
}

function padAddress(a: string): string {
  const clean = a.startsWith('0x') ? a.slice(2) : a;
  return clean.toLowerCase().padStart(64, '0');
}

function hexToBigInt(hex: string | null): bigint | null {
  if (!hex) return null;
  try {
    return BigInt(hex.startsWith('0x') ? hex : '0x' + hex);
  } catch {
    return null;
  }
}

async function readNativeBalanceRpc(
  chain: ChainId,
  wallet: string,
): Promise<string | null> {
  const urls = RPC_URLS[chain] || [];
  const { result } = await tryRpcs(urls, (u) =>
    rpcSingle(u, 'eth_getBalance', [wallet, 'latest']),
  );
  const big = hexToBigInt(result as string | null);
  return big == null ? null : big.toString();
}

async function readFallbackTokens(
  chain: ChainId,
  wallet: string,
): Promise<TokenBalance[]> {
  const list = FALLBACK_TOKENS[chain] || [];
  if (list.length === 0) return [];
  const urls = RPC_URLS[chain] || [];
  if (urls.length === 0) return [];

  const padded = padAddress(wallet);
  const reqs: RpcRequest[] = [];
  for (const addr of list) {
    reqs.push({
      method: 'eth_call',
      params: [{ to: addr, data: BALANCE_OF_SELECTOR + padded }, 'latest'],
    });
    reqs.push({
      method: 'eth_call',
      params: [{ to: addr, data: DECIMALS_SELECTOR }, 'latest'],
    });
  }

  const allResults: (any | null)[] = [];
  for (let i = 0; i < reqs.length; i += BATCH_CHUNK) {
    const slice = reqs.slice(i, i + BATCH_CHUNK);
    const { result } = await tryRpcs(urls, (u) => rpcBatch(u, slice));
    if (result) allResults.push(...result);
    else allResults.push(...new Array(slice.length).fill(null));
  }

  const out: TokenBalance[] = [];
  for (let i = 0; i < list.length; i++) {
    const balanceHex = allResults[i * 2];
    const decimalsHex = allResults[i * 2 + 1];
    const big = hexToBigInt(balanceHex as string | null);
    if (big == null || big === 0n) continue;
    const dec = hexToBigInt(decimalsHex as string | null);
    const decimals = dec != null && dec >= 0n && dec < 100n ? Number(dec) : 18;
    out.push({
      address: list[i],
      balanceRaw: big.toString(),
      decimals,
    });
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

  const address = body?.address;
  const chain: ChainId =
    body?.chain === 'ethereum' ? 'ethereum' : body?.chain === 'robinhood' ? 'robinhood' : 'pulsechain';

  if (!isValidAddress(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  const lowered = address.toLowerCase();
  const key = cacheKey(chain, lowered);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cached);
  }

  const base = BLOCKSCOUT_BASE[chain];

  // Primary: Blockscout returns every token the wallet holds + metadata.
  const [balanceData, addressInfo] = await Promise.all([
    fetchJson(`${base}/addresses/${lowered}/token-balances`),
    fetchJson(`${base}/addresses/${lowered}`),
  ]);

  let tokens: TokenBalance[] = [];
  let source: BalancesResponse['source'] = 'blockscout';

  if (Array.isArray(balanceData) || balanceData?.items) {
    const items: any[] = Array.isArray(balanceData)
      ? balanceData
      : balanceData.items || [];
    tokens = items
      .map((item) => normaliseBalance(item, chain))
      .filter((x): x is TokenBalance => x !== null);
  }

  // Fallback: Blockscout returned nothing useful (network failure, 502,
  // throttled). Walk the curated list via batched RPC balanceOf so the
  // wallet view still shows something. The UI badges this as a partial
  // view via the `source` field so users know to retry later.
  if (tokens.length === 0) {
    const rpcTokens = await readFallbackTokens(chain, lowered);
    if (rpcTokens.length > 0) {
      tokens = rpcTokens;
      source = 'rpc-fallback';
    }
  }

  // Native balance: prefer Blockscout's `coin_balance`, otherwise RPC.
  let nativeBalanceRaw: string | null = null;
  if (addressInfo && typeof addressInfo === 'object' && addressInfo.coin_balance) {
    nativeBalanceRaw = String(addressInfo.coin_balance);
  } else {
    nativeBalanceRaw = await readNativeBalanceRpc(chain, lowered);
    if (nativeBalanceRaw != null && source === 'blockscout') {
      source = 'rpc-fallback';
    }
  }

  const payload: BalancesResponse = {
    chain,
    address: lowered,
    tokens,
    nativeBalanceRaw,
    source,
    fetchedAt: Date.now(),
  };

  cache.set(key, payload);
  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'private, max-age=15' },
  });
}
