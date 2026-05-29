import { NextRequest, NextResponse } from 'next/server';

// Wallet balance reads via RPC only — no Blockscout, no Moralis.
//
// Approach: instead of trying to enumerate "every token the wallet has
// ever touched" via eth_getLogs (which is too slow against public
// PulseChain RPCs over wide ranges), we maintain a curated list of
// popular ERC-20 / PRC-20 contracts per chain and batch-read
// balanceOf(wallet) against all of them in one JSON-RPC call. Anything
// with a non-zero balance ends up in the response.
//
// Pros: deterministic, fast, no rate-limit issues, works on a
// brand-new wallet that hasn't received funds yet (returns []).
// Cons: tokens not in the curated list don't appear automatically.
// The watchlist already gives users a way to track arbitrary contracts,
// and we can grow this list as new tokens become relevant.
//
// Names / symbols / logos / prices all come downstream from the
// DexScreener prices proxy. This route is strictly the chain-side
// "how much of each contract does this wallet hold" layer.

type ChainId = 'ethereum' | 'pulsechain';

// User-curated PulseChain RPC pool + a few public Ethereum endpoints.
const RPC_URLS: Record<ChainId, string[]> = {
  pulsechain: [
    'https://rpc.pulsechainrpc.com',
    'https://pulsechain-rpc.publicnode.com',
    'https://rpc.gigatheminter.com',
    'https://rpc-pulsechain.g4mm4.io',
  ],
  ethereum: [
    'https://eth.llamarpc.com',
    'https://ethereum-rpc.publicnode.com',
    'https://rpc.ankr.com/eth',
  ],
};

const BALANCE_OF_SELECTOR = '0x70a08231';
const DECIMALS_SELECTOR = '0x313ce567';

const RPC_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 30_000;
const BATCH_CHUNK = 80;

// Curated PulseChain ERC-20 / PRC-20 universe. Lowercased. Mix of native
// stack (HEX, PLSX, INC, WPLS, eHEX, ePLSX, eINC), bridged stables
// (USDC.e, USDT.e, DAI from Ethereum), and the meme / community tokens
// we've seen in real wallets. PulseX V2 LP token contracts are added
// here too so the portfolio LP-decomposition path can find them.
const PULSECHAIN_TOKENS: string[] = [
  // Core
  '0xa1077a294dde1b09bb078844df40758a5d0f9a27', // WPLS
  '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', // HEX
  '0x95b303987a60c71504d99aa1b13b4da07b0790ab', // PLSX
  '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d', // INC
  '0x57fde0a71132198bbec939b98976993d8d89d225', // eHEX
  '0x8a7fdca264e87b6da72d000f22186b4403081a2a', // ePLSX
  // Bridged stables
  '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07', // USDC from Ethereum
  '0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f', // USDT from Ethereum
  '0xefd766ccb38eaf1dfd701853bfce31359239f305', // DAI from Ethereum
  // Popular memes / community
  '0xb7d4eb5fdfe3d4d3b5c16a44a49948c6ec77c6f1', // Morbius
  '0x6b32022693210cd2cfc466b9ac0085de8fc34ea6', // pSSH (SuperStake pHEX)
  '0x33779a40987f729a7df6cc08b1dad1a21b58a220', // RICH (BIG RICH)
  '0x456548a9b56efbbd89ca0309edd17a9e20b04018', // FLOWT
  '0x347a96a5bd06d2e15199b032f46fb724d6c73047', // ASIC
  '0xa685c45fd071df23278069db9137e124564897d0', // LBRTY
  '0x7901a3569679aec3501dbec59399f327854a70fe', // OXY
  '0xc52f739f544d20725ba7ad47bb42299034f06f4f', // PLN
  '0x7b39712ef45f7dced2bbdf11f3d5046ba61da719', // CST
  '0xe35a842ebde0addde72ed6b5a7f8ba9fa15d7da3', // CHEEZ
  '0x4d3aea379b7689e0cb722826c909fab39e54123d', // PHIAT
  '0x518076cce5abdc8b21ecd5a82a01dca42aee76ad', // pTGC
  '0x9c39c00b3c8f1e35e6c0e3cc06f3585c4bd5e4d8', // WICK
  '0x0e6c2deba4e34b6022b62fe73f78d3a1c4c1bcae', // pTKN
  '0xb55ee890426341fe45ee6dc788d2d93d25b59063', // FLEX
  '0x07895912f3ab0e33ab3a4cefbdf7a3e121eb9942', // pXEN
  '0x69b9748a7e98b9cd0e8f9a8d8d5da3fd34abf28a', // PUMP
  '0x3bbb838f43fc1a4b614e63bd05fb74143a91c1a7', // CULT
  '0x5cb6e64b9e0ca64d1a7c01b9c34c5acc8f4f7d4f', // ATROPA
  '0xeb2ceed77147893ba8b250c796c2d4ef02a72b68', // 2PHUX
  '0x3a85b87186c5e8b8b6e3d83e23b8f70a5c8e8b48', // BBC
  '0x6386704cd6f7a584ea9d23ccca66af7eba5a727e', // SPARK
  '0x4243568fa2bbad327ee36e06c16824cad8b37819', // TSFi
  '0xae9d4ad7e3eb9ef4d80c5d3c8c8f7b5b0c5e8b48', // ICSA
  '0x6efafcb715f385c71d8af763e8478feea6faddca', // pWBTC
  '0x02dccfb6f4ade3f3d56b6a9e094c5d75f9a8fbcd', // pWETH
  // PulseX V2 LP tokens we've seen in real wallets (the pair address
  // doubles as the LP-token contract on Uniswap-V2-style DEXes). New
  // ones can be added here or supplied via the client's `extra` param.
  '0xb876257c7550010f14a527d2bf8fda9360f8597b', // Morbius/WPLS LP
  '0xdbed78e14e230158ec01e534749bd5ae5ed0816f', // RICH/Morbius LP
  '0xe56043671df55de5cdf8459710433c10324de0ae', // WPLS/DAI LP
  '0x6753560538eca67617a9ce605178f788be7e524e', // WPLS/USDC LP
  '0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9', // HEX/WPLS LP
  '0x322df7921f28f1146cdf62afdac0d6bc0ab80711', // PLSX/WPLS LP
  '0xf1f4ee610b2babb05c635f726ef8b0c568c8dc65', // INC/WPLS LP
];

// Curated Ethereum ERC-20 universe.
const ETHEREUM_TOKENS: string[] = [
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
  '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
  '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', // UNI
  '0x514910771af9ca656af840dff83e8264ecf986ca', // LINK
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9', // AAVE
  '0x6982508145454ce325ddbe47a25d4ec3d2311933', // PEPE
  '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce', // SHIB
  '0x4e15361fd6b4bb609fa63c81a2be19d873717870', // FTM
  '0x4d224452801aced8b2f0aebe155379bb5d594381', // APE
  '0xb50721bcf8d664c30412cfbc6cf7a15145234ad1', // ARB
  '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', // HEX
  '0x96f6ef951840721adbf46ac996b59e0235cb985c', // USDY
  '0x9d39a5de30e57443bff2a8307a4256c8797a3497', // sUSDe
  '0x4c9edd5852cd905f086c759e8383e09bff1e68b3', // USDe
  '0xf57e7e7c23978c3caec3c3548e3d615c346e79ff', // IMX
  '0xa693b19d2931d498c5b318df961919bb4aee87a5', // UST
  '0xae78736cd615f374d3085123a210448e74fc6393', // rETH
];

interface TokenBalance {
  address: string;
  balanceRaw: string;
  decimals: number;
}

interface BalancesResponse {
  chain: ChainId;
  address: string;
  tokens: TokenBalance[];
  nativeBalanceRaw: string | null;
  rpcUsed: string | null;
  fetchedAt: number;
  scanned: number;
}

const cache = new Map<string, BalancesResponse>();
const cacheKey = (chain: ChainId, address: string) =>
  `${chain}:${address.toLowerCase()}`;

function padAddress(a: string): string {
  const clean = a.startsWith('0x') ? a.slice(2) : a;
  return clean.toLowerCase().padStart(64, '0');
}

function isValidAddress(s: unknown): s is string {
  return typeof s === 'string' && /^0x[a-f0-9]{40}$/i.test(s);
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
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
    if (!r.ok) return null;
    const d: any = await r.json();
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
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
    if (!r.ok) return null;
    const arr: any = await r.json();
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
    const result = await fn(url);
    if (result != null) return { result, url };
  }
  return { result: null, url: null };
}

function hexToBigInt(hex: string | null): bigint | null {
  if (!hex) return null;
  try {
    return BigInt(hex.startsWith('0x') ? hex : '0x' + hex);
  } catch {
    return null;
  }
}

function decodeDecimals(hex: string | null): number {
  const big = hexToBigInt(hex);
  if (big == null) return 18;
  const n = Number(big);
  return Number.isFinite(n) && n >= 0 && n < 100 ? n : 18;
}

async function readBalances(
  chain: ChainId,
  walletAddress: string,
  tokenAddresses: string[],
): Promise<{ balances: TokenBalance[]; rpcUsed: string | null }> {
  if (tokenAddresses.length === 0) {
    return { balances: [], rpcUsed: null };
  }
  const urls = RPC_URLS[chain] || [];
  if (urls.length === 0) return { balances: [], rpcUsed: null };

  const padded = padAddress(walletAddress);
  const reqs: RpcRequest[] = [];
  for (const addr of tokenAddresses) {
    reqs.push({
      method: 'eth_call',
      params: [{ to: addr, data: BALANCE_OF_SELECTOR + padded }, 'latest'],
    });
    reqs.push({
      method: 'eth_call',
      params: [{ to: addr, data: DECIMALS_SELECTOR }, 'latest'],
    });
  }

  let rpcUsed: string | null = null;
  const allResults: (any | null)[] = [];
  for (let i = 0; i < reqs.length; i += BATCH_CHUNK) {
    const slice = reqs.slice(i, i + BATCH_CHUNK);
    const { result, url } = await tryRpcs(urls, (u) => rpcBatch(u, slice));
    if (url) rpcUsed = url;
    if (result) allResults.push(...result);
    else allResults.push(...new Array(slice.length).fill(null));
  }

  const out: TokenBalance[] = [];
  for (let i = 0; i < tokenAddresses.length; i++) {
    const balanceHex = allResults[i * 2];
    const decimalsHex = allResults[i * 2 + 1];
    const balance = hexToBigInt(balanceHex as string | null);
    if (balance == null || balance === 0n) continue;
    out.push({
      address: tokenAddresses[i],
      balanceRaw: balance.toString(),
      decimals: decodeDecimals(decimalsHex as string | null),
    });
  }
  return { balances: out, rpcUsed };
}

async function readNativeBalance(
  chain: ChainId,
  walletAddress: string,
): Promise<string | null> {
  const urls = RPC_URLS[chain] || [];
  const { result } = await tryRpcs(urls, (url) =>
    rpcSingle(url, 'eth_getBalance', [walletAddress.toLowerCase(), 'latest']),
  );
  const big = hexToBigInt(result as string | null);
  return big == null ? null : big.toString();
}

function tokensForChain(chain: ChainId, extra: string[] = []): string[] {
  const base = chain === 'pulsechain' ? PULSECHAIN_TOKENS : ETHEREUM_TOKENS;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of [...base, ...extra]) {
    const lc = a.toLowerCase();
    if (/^0x[a-f0-9]{40}$/.test(lc) && !seen.has(lc)) {
      seen.add(lc);
      out.push(lc);
    }
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
    body?.chain === 'ethereum' ? 'ethereum' : 'pulsechain';

  // Optional extra contracts to also include in the scan — lets the
  // client widen the universe per request (e.g. tokens the user added
  // to their watchlist that aren't in our curated list).
  const extra: string[] = Array.isArray(body?.extra) ? body.extra : [];

  if (!isValidAddress(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  const key = cacheKey(chain, address);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cached);
  }

  const lowered = address.toLowerCase();
  const tokenList = tokensForChain(chain, extra);

  const [nativeBalanceRaw, balanceResult] = await Promise.all([
    readNativeBalance(chain, lowered),
    readBalances(chain, lowered, tokenList),
  ]);

  const payload: BalancesResponse = {
    chain,
    address: lowered,
    tokens: balanceResult.balances,
    nativeBalanceRaw,
    rpcUsed: balanceResult.rpcUsed,
    scanned: tokenList.length,
    fetchedAt: Date.now(),
  };

  cache.set(key, payload);
  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'private, max-age=15' },
  });
}
