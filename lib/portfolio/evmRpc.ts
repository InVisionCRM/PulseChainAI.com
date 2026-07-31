// Minimal raw JSON-RPC helpers (no viem) matching the pattern already used in
// app/api/portfolio/lp/route.ts: a per-chain pool of public endpoints tried in
// order until one answers. Server-side only.

import type { ChainId } from '@/services';

// Order curated by the project owner; first match wins. Mirrors the LP route.
export const RPC_URLS: Record<ChainId, string[]> = {
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
  robinhood: [
    // Public, rate-limited sequencer RPC for Robinhood Chain (id 4663).
    'https://rpc.mainnet.chain.robinhood.com',
  ],
};

const RPC_TIMEOUT_MS = 4_000;

// Returns the raw `result` (any JSON type — `eth_getLogs` returns an array,
// `eth_call` a hex string), or null on transport error / JSON-RPC error.
async function rpc(
  url: string,
  method: string,
  params: unknown[],
  timeoutMs: number = RPC_TIMEOUT_MS,
): Promise<any | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: unknown; error?: unknown };
    if (json.error || json.result == null) return null;
    return json.result;
  } catch {
    return null;
  }
}

/**
 * `eth_call` with failover. Returns the hex result, or null if every endpoint
 * failed or the call reverted / returned empty (`0x`).
 */
export async function ethCall(
  chain: ChainId,
  to: string,
  data: string,
): Promise<string | null> {
  for (const url of RPC_URLS[chain] ?? []) {
    const r = await rpc(url, 'eth_call', [{ to, data }, 'latest']);
    if (r && r !== '0x') return r;
  }
  return null;
}

/**
 * `eth_getCode` with failover. `0x` means an EOA (no contract code); any longer
 * hex means a contract. Returns null only when every endpoint failed.
 */
export async function getCode(
  chain: ChainId,
  address: string,
): Promise<string | null> {
  for (const url of RPC_URLS[chain] ?? []) {
    const r = await rpc(url, 'eth_getCode', [address, 'latest']);
    if (r != null) return r;
  }
  return null;
}

// Log scans return far more data than a balance read, so they get a longer
// budget than RPC_TIMEOUT_MS (measured: ~2-5s for a 10k-block address-filtered
// scan on the healthy PulseChain nodes).
const RPC_LOGS_TIMEOUT_MS = 20_000;

export interface RpcLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
  logIndex: string;
}

/**
 * `eth_getLogs` with failover.
 *
 * Not every pool member can serve this: `pulsechain-rpc.publicnode.com` gates
 * historical ranges behind a paid Allnodes token and returns a JSON-RPC error
 * ("Archive requests require a personal token") for any `fromBlock` below head.
 * That surfaces as a null from `rpc()`, so the loop simply moves to the next
 * endpoint — no special-casing needed, but it does mean the pool is effectively
 * shorter for log scans than for `eth_call`.
 *
 * ALWAYS pass an `address`. An unfiltered Transfer-topic scan on PulseChain
 * returns ~176 MB for a 1,000-block window (measured), which will hang a route.
 */
export async function ethGetLogs(
  chain: ChainId,
  filter: {
    address?: string;
    fromBlock: number;
    toBlock: number;
    topics?: (string | null)[];
  },
): Promise<RpcLog[] | null> {
  const params = [
    {
      ...(filter.address ? { address: filter.address } : {}),
      fromBlock: `0x${filter.fromBlock.toString(16)}`,
      toBlock: `0x${filter.toBlock.toString(16)}`,
      ...(filter.topics ? { topics: filter.topics } : {}),
    },
  ];
  for (const url of RPC_URLS[chain] ?? []) {
    const r = await rpc(url, 'eth_getLogs', params, RPC_LOGS_TIMEOUT_MS);
    if (Array.isArray(r)) return r as RpcLog[];
  }
  return null;
}

/** Current head block number, or null if every endpoint failed. */
export async function getBlockNumber(chain: ChainId): Promise<number | null> {
  for (const url of RPC_URLS[chain] ?? []) {
    const r = await rpc(url, 'eth_blockNumber', []);
    if (typeof r === 'string') {
      const n = Number.parseInt(r, 16);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** Unix timestamp (seconds) of a block, or null if every endpoint failed. */
export async function getBlockTimestamp(
  chain: ChainId,
  blockNumber: number,
): Promise<number | null> {
  const hex = `0x${blockNumber.toString(16)}`;
  for (const url of RPC_URLS[chain] ?? []) {
    const r = await rpc(url, 'eth_getBlockByNumber', [hex, false]);
    if (r && typeof r === 'object' && typeof (r as any).timestamp === 'string') {
      const t = Number.parseInt((r as any).timestamp, 16);
      if (Number.isFinite(t)) return t;
    }
  }
  return null;
}
