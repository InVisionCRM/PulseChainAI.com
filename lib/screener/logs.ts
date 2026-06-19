/**
 * PulseChain RPC log scanner — discovers every AMM pair on chain.
 * Listens for the two canonical factory events (no per-DEX factory list needed;
 * the emitting contract IS the factory, and DexScreener enrichment supplies dexId):
 *   - UniswapV2-style  PairCreated(token0, token1, pair, allPairsLength)
 *   - UniswapV3-style  PoolCreated(token0, token1, fee, tickSpacing, pool)
 */

const RPC_URL = process.env.PULSECHAIN_RPC_URL || 'https://rpc.pulsechain.com';

export const TOPIC_V2_PAIR_CREATED =
  '0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9';
export const TOPIC_V3_POOL_CREATED =
  '0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118';

export interface DiscoveredPair {
  pairAddress: string;
  factory: string;
  amm: 'v2' | 'v3';
  createdBlock: number;
}

interface RpcLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
}

let rpcId = 0;

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status} for ${method}`);
  const json = await res.json();
  if (json.error) throw new Error(`RPC ${method}: ${JSON.stringify(json.error)}`);
  return json.result as T;
}

export async function latestBlock(): Promise<number> {
  return parseInt(await rpc<string>('eth_blockNumber', []), 16);
}

function wordToAddress(word: string): string {
  return ('0x' + word.slice(-40)).toLowerCase();
}

function decode(log: RpcLog): DiscoveredPair {
  const isV3 = log.topics[0] === TOPIC_V3_POOL_CREATED;
  const data = log.data.slice(2);
  // v2 data: [pair][allPairsLength] — v3 data: [tickSpacing][pool]
  const pairWord = isV3 ? data.slice(64, 128) : data.slice(0, 64);
  return {
    pairAddress: wordToAddress(pairWord),
    factory: log.address.toLowerCase(),
    amm: isV3 ? 'v3' : 'v2',
    createdBlock: parseInt(log.blockNumber, 16),
  };
}

async function getLogsChunk(fromBlock: number, toBlock: number): Promise<DiscoveredPair[]> {
  const logs = await rpc<RpcLog[]>('eth_getLogs', [
    {
      fromBlock: '0x' + fromBlock.toString(16),
      toBlock: '0x' + toBlock.toString(16),
      topics: [[TOPIC_V2_PAIR_CREATED, TOPIC_V3_POOL_CREATED]],
    },
  ]);
  return logs.map(decode);
}

/**
 * Scan [fromBlock, toBlock] for pair creations. Splits the range into chunks
 * and recursively halves a chunk when the node rejects it (too many results /
 * timeout). `onChunk` is awaited per chunk so callers can persist incrementally.
 */
export async function scanPairCreations(
  fromBlock: number,
  toBlock: number,
  chunkSize: number,
  onChunk: (pairs: DiscoveredPair[], scannedTo: number) => Promise<void>,
): Promise<number> {
  let total = 0;
  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, toBlock);
    const pairs = await scanWithHalving(start, end, chunkSize);
    total += pairs.length;
    await onChunk(pairs, end);
  }
  return total;
}

async function scanWithHalving(from: number, to: number, size: number): Promise<DiscoveredPair[]> {
  try {
    return await getLogsChunk(from, to);
  } catch (err) {
    if (size <= 1000) throw err;
    const half = Math.floor(size / 2);
    const mid = Math.min(from + half - 1, to);
    const left = await scanWithHalving(from, mid, half);
    const right = mid < to ? await scanWithHalving(mid + 1, to, half) : [];
    return left.concat(right);
  }
}
