/**
 * PulseChain RPC log scanner — discovers every AMM pair on chain.
 * Listens for the two canonical factory events (no per-DEX factory list needed;
 * the emitting contract IS the factory, and DexScreener enrichment supplies dexId):
 *   - UniswapV2-style  PairCreated(token0, token1, pair, allPairsLength)
 *   - UniswapV3-style  PoolCreated(token0, token1, fee, tickSpacing, pool)
 */

import { RPC_URLS } from '@/lib/portfolio/evmRpc';

/**
 * Endpoints tried in order, first answer wins.
 *
 * This used to be a single hardcoded URL with no failover, which made the whole
 * screener refresh hostage to one node: `latestBlock()` is the first await in
 * `runRefresh`, so when that endpoint went down the refresh threw before it
 * reached the enrichment half — no discovery, no market refresh, and no
 * re-check of previously delisted pairs. g4mm4's node going dark took the
 * PulseChain screener with it exactly that way.
 *
 * The pool is the same curated list the portfolio routes already use
 * (`lib/portfolio/evmRpc.ts`), so there is one place to keep endpoints current.
 * An explicit `PULSECHAIN_RPC_URL` still wins — it is simply tried first rather
 * than being the only option, so pinning an endpoint can no longer take the
 * refresh down on its own.
 */
function allEndpoints(): string[] {
  const pool = RPC_URLS.pulsechain ?? [];
  const override = process.env.PULSECHAIN_RPC_URL;
  return override ? [override, ...pool.filter((u) => u !== override)] : [...pool];
}

/**
 * Endpoints that failed to answer at all during this process.
 *
 * Failover alone is not enough: a dead endpoint costs a full timeout on *every*
 * call, and `runRefresh` works to a 45s budget. Measured against g4mm4 while it
 * was down, one dead endpoint at the head of the list turned a 0.5s
 * `latestBlock()` into 20s — enough to spend the entire budget before any pair
 * was refreshed. Remembering it for the rest of the run pays that cost once.
 *
 * Cleared if every endpoint ends up in here, so a total-outage run can't
 * poison a later one in the same warm instance.
 */
const unreachable = new Set<string>();

function endpoints(): string[] {
  const all = allEndpoints();
  const live = all.filter((u) => !unreachable.has(u));
  if (live.length > 0) return live;
  unreachable.clear();
  return all;
}

/** `eth_getLogs` is the slow one; everything else should answer promptly. */
const LOGS_TIMEOUT_MS = 25_000;
const CALL_TIMEOUT_MS = 5_000;

/**
 * Every endpoint failed to answer at all (timeout, DNS, connection reset, HTTP
 * error) — as opposed to answering and rejecting the request. The distinction
 * matters to `scanWithHalving`: splitting the block range is the fix for "this
 * range is too big for you", and pointless when nothing is reachable.
 */
export class NoEndpointAnswered extends Error {}

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

async function rpc<T>(method: string, params: unknown[], timeoutMs: number): Promise<T> {
  // A JSON-RPC error is the node telling us something about the *request*
  // (range too large, too many results). Every endpoint reads the same chain,
  // so we still try the rest — but if that is all we ever got, the caller
  // should hear the node's complaint rather than "nothing answered".
  let rejected: Error | null = null;

  for (const url of endpoints()) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        unreachable.add(url); // rate limited / gateway error — this node's problem
        continue;
      }
      const json = await res.json();
      if (json.error) {
        // The node is fine; it objected to the request. Keep it in rotation.
        rejected = new Error(`RPC ${method}: ${JSON.stringify(json.error)}`);
        continue;
      }
      return json.result as T;
    } catch {
      // timeout, DNS failure, connection reset — don't pay for it again
      unreachable.add(url);
    }
  }

  if (rejected) throw rejected;
  throw new NoEndpointAnswered(`no PulseChain RPC answered ${method}`);
}

export async function latestBlock(): Promise<number> {
  return parseInt(await rpc<string>('eth_blockNumber', [], CALL_TIMEOUT_MS), 16);
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
  ], LOGS_TIMEOUT_MS);
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
    // Nothing reachable: halving would re-try every endpoint at every level of
    // the recursion, turning one outage into an exponential pile of hanging
    // requests. Splitting only helps when a node answered and said the range
    // was too big.
    if (err instanceof NoEndpointAnswered) throw err;
    if (size <= 1000) throw err;
    const half = Math.floor(size / 2);
    const mid = Math.min(from + half - 1, to);
    const left = await scanWithHalving(from, mid, half);
    const right = mid < to ? await scanWithHalving(mid + 1, to, half) : [];
    return left.concat(right);
  }
}
