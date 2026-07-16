// Minimal raw JSON-RPC helpers (no viem) matching the pattern already used in
// app/api/portfolio/lp/route.ts: a per-chain pool of public endpoints tried in
// order until one answers. Server-side only.

import type { ChainId } from '@/services';

// Order curated by the project owner; first match wins. Mirrors the LP route.
export const RPC_URLS: Record<ChainId, string[]> = {
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
  robinhood: [
    // Public, rate-limited sequencer RPC for Robinhood Chain (id 4663).
    'https://rpc.mainnet.chain.robinhood.com',
  ],
};

const RPC_TIMEOUT_MS = 4_000;

async function rpc(
  url: string,
  method: string,
  params: unknown[],
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: string; error?: unknown };
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
