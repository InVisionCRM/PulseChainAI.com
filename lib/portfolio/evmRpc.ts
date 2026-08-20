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

/**
 * What came back — keeping the chain's answer distinguishable from the node's
 * absence.
 *
 *   ok          the node answered and the call succeeded
 *   reverted    the node answered and the EVM rejected the call
 *   unavailable this node could not serve us; ask the next one
 */
type RpcOutcome =
  | { kind: 'ok'; result: unknown }
  | { kind: 'reverted' }
  | { kind: 'unavailable' };

/**
 * Did the EVM run this call and reject it, or did the node fail us?
 *
 * The distinction is the whole point. Probing a token for a `token0()` or an
 * `asset()` it doesn't have is the *normal* case here, not an error case, and a
 * revert is a definitive answer about chain state — every other endpoint reads
 * the same state and would say the same thing.
 *
 * Verified against the live pool with a `token0()` call on WPLS (a plain
 * ERC-20): rpc.pulsechainstats.com and rpc.pulsechainrpc.com answer
 * `code: 3`, while pulsechain-rpc.publicnode.com, rpc-pulsechain.g4mm4.io and
 * rpc.degenprotocol.io answer `code: -32000` — all five with the message
 * "execution reverted". So the message is matched as well as the code, because
 * -32000 is a catch-all these nodes also use for their own problems. Anything
 * that isn't recognisably an execution failure — rate limits, the archive-token
 * gating on publicnode, "method not found" — stays a node problem and still
 * fails over.
 */
function isExecutionError(err: unknown): boolean {
  const e = (err ?? {}) as { code?: unknown; message?: unknown };
  const msg = String(e.message ?? '').toLowerCase();
  if (e.code === 3) return true;
  return (
    msg.includes('execution reverted') ||
    msg.includes('invalid opcode') ||
    msg.includes('out of gas')
  );
}

async function rpcRaw(
  url: string,
  method: string,
  params: unknown[],
  timeoutMs: number = RPC_TIMEOUT_MS,
): Promise<RpcOutcome> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { kind: 'unavailable' };
    const json = (await res.json()) as { result?: unknown; error?: unknown };
    if (json.error) {
      return isExecutionError(json.error) ? { kind: 'reverted' } : { kind: 'unavailable' };
    }
    if (json.result == null) return { kind: 'unavailable' };
    return { kind: 'ok', result: json.result };
  } catch {
    return { kind: 'unavailable' };
  }
}

// Returns the raw `result` (any JSON type — `eth_getLogs` returns an array,
// `eth_call` a hex string), or null on transport error / JSON-RPC error.
async function rpc(
  url: string,
  method: string,
  params: unknown[],
  timeoutMs: number = RPC_TIMEOUT_MS,
): Promise<any | null> {
  const o = await rpcRaw(url, method, params, timeoutMs);
  return o.kind === 'ok' ? o.result : null;
}

/**
 * `eth_call` with failover. Returns the hex result, or null if every endpoint
 * failed or the call reverted / returned empty (`0x`).
 *
 * A revert stops the walk. It used to be indistinguishable from a dead node, so
 * every negative probe asked all six endpoints and got told "no" six times.
 * That is not a rare path: `detectHeldPosition` asks each held token six
 * questions in sequence (V2 pair? Balancer pool? ERC-4626? cToken? aToken?),
 * and for an ordinary ERC-20 all six revert. Measured on one wallet — 80 tokens
 * × 6 questions — that was ~2,880 round trips where 480 would do, and it was 30
 * of the 35 seconds the portfolio's LP tab spent loading.
 */
export async function ethCall(
  chain: ChainId,
  to: string,
  data: string,
): Promise<string | null> {
  for (const url of RPC_URLS[chain] ?? []) {
    const o = await rpcRaw(url, 'eth_call', [{ to, data }, 'latest']);
    if (o.kind === 'reverted') return null;
    // An empty (`0x`) result still fails over: unlike a revert it can mean the
    // node simply hasn't seen the contract yet.
    if (o.kind === 'ok' && typeof o.result === 'string' && o.result !== '0x') return o.result;
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

// ---------------------------------------------------------------------------
// Write-path helpers.
//
// Everything above only reads. These four exist so a keeper can build, price
// and broadcast a transaction through the same curated pool and failover as the
// rest of the app, instead of standing up a second RPC layer beside it.
// ---------------------------------------------------------------------------

/**
 * `eth_estimateGas`. Returns null if the call would revert or no endpoint
 * answered — for a keeper those are the same instruction: do not send this.
 */
export async function estimateGas(
  chain: ChainId,
  tx: { from: string; to: string; data: string; value?: string },
): Promise<bigint | null> {
  for (const url of RPC_URLS[chain] ?? []) {
    const o = await rpcRaw(url, 'eth_estimateGas', [tx]);
    // A revert here is a definitive answer about this call and not worth
    // asking five more nodes about — same reasoning as ethCall.
    if (o.kind === 'reverted') return null;
    if (o.kind === 'ok' && typeof o.result === 'string') {
      try { return BigInt(o.result); } catch { return null; }
    }
  }
  return null;
}

/** Next nonce for an address, counting transactions still in the mempool. */
export async function getTransactionCount(
  chain: ChainId,
  address: string,
  block: 'pending' | 'latest' = 'pending',
): Promise<number | null> {
  for (const url of RPC_URLS[chain] ?? []) {
    const r = await rpc(url, 'eth_getTransactionCount', [address, block]);
    if (typeof r === 'string') {
      const n = Number.parseInt(r, 16);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** Current gas price in wei, or null if every endpoint failed. */
export async function getGasPrice(chain: ChainId): Promise<bigint | null> {
  for (const url of RPC_URLS[chain] ?? []) {
    const r = await rpc(url, 'eth_gasPrice', []);
    if (typeof r === 'string') {
      try { return BigInt(r); } catch { /* next endpoint */ }
    }
  }
  return null;
}

/**
 * The pending block's base fee, or null if the chain doesn't run EIP-1559 (no
 * `baseFeePerGas` on its blocks) or every endpoint failed.
 *
 * Read directly off a block rather than trusted from `eth_gasPrice`, because
 * `eth_gasPrice` bakes in each node's own guess at a suggested total price —
 * useful for a legacy transaction, but this exists so a caller can compute its
 * OWN margin on top of the real base fee for a type-2 transaction instead.
 */
export async function getBaseFee(chain: ChainId): Promise<bigint | null> {
  for (const url of RPC_URLS[chain] ?? []) {
    const r = await rpc(url, 'eth_getBlockByNumber', ['pending', false]);
    const fee = r && typeof r === 'object' ? (r as { baseFeePerGas?: string }).baseFeePerGas : undefined;
    if (typeof fee === 'string') {
      try { return BigInt(fee); } catch { /* next endpoint */ }
    }
  }
  return null;
}

/**
 * The network's suggested tip, or a small flat fallback if the endpoint
 * doesn't support `eth_maxPriorityFeePerGas` (verified live: PulseChain's pool
 * does — it answered 0.1 gwei, which matches a chain with essentially no
 * priority-fee competition; base fee is the whole story here).
 */
export async function getPriorityFee(chain: ChainId): Promise<bigint> {
  const FALLBACK = 1_000_000_000n; // 1 gwei
  for (const url of RPC_URLS[chain] ?? []) {
    const r = await rpc(url, 'eth_maxPriorityFeePerGas', []);
    if (typeof r === 'string') {
      try { return BigInt(r); } catch { /* next endpoint */ }
    }
  }
  return FALLBACK;
}

/** What a transaction already sitting in the mempool is bidding. */
export interface PendingBid {
  nonce: number;
  /** maxFeePerGas, or gasPrice for a legacy transaction. */
  cap: bigint;
  /** maxPriorityFeePerGas, or gasPrice for a legacy transaction. */
  tip: bigint;
  /** 0 = legacy, 2 = EIP-1559. */
  type: 0 | 2;
  gasLimit: bigint;
}

/**
 * What `address` is currently bidding at each pending nonce.
 *
 * A replacement has to beat the transaction already at its nonce on both fee
 * fields, and this is how to find out by how much instead of guessing. The
 * usual answer is that you cannot — `txpool_content` is disabled on public
 * endpoints — but `eth_getBlockByNumber('pending', true)` returns the pool's
 * candidate block with full transaction objects, and the sender's own pending
 * transactions are in it. Verified against the live keeper: it returned 20
 * transactions from one address with their exact caps, tips and gas limits.
 *
 * Blind escalation is what this replaces, and blind escalation ratchets: each
 * run doubles against a predecessor that a previous run already doubled, so
 * the bid runs away from the real price of gas while the queue stays stuck.
 */
export async function getPendingBids(chain: ChainId, address: string): Promise<Map<number, PendingBid>> {
  const want = address.toLowerCase();
  for (const url of RPC_URLS[chain] ?? []) {
    const r = await rpc(url, 'eth_getBlockByNumber', ['pending', true]);
    const txs = (r as { transactions?: unknown[] } | null)?.transactions;
    if (!Array.isArray(txs)) continue;
    const out = new Map<number, PendingBid>();
    for (const raw of txs) {
      const t = raw as Record<string, string | undefined>;
      if (String(t.from ?? '').toLowerCase() !== want) continue;
      try {
        const legacy = t.maxFeePerGas == null;
        const cap = BigInt((legacy ? t.gasPrice : t.maxFeePerGas) ?? '0x0');
        const tip = BigInt((legacy ? t.gasPrice : t.maxPriorityFeePerGas) ?? '0x0');
        if (cap === 0n) continue;
        out.set(Number(BigInt(t.nonce ?? '0x0')), {
          nonce: Number(BigInt(t.nonce ?? '0x0')),
          cap,
          tip,
          type: legacy ? 0 : 2,
          gasLimit: BigInt(t.gas ?? '0x0'),
        });
      } catch {
        /* a row we cannot parse is one we cannot bid against — skip it */
      }
    }
    // An empty pool is a real answer, but only from a node that gave us a
    // transaction list at all; an endpoint that omits them must not be read as
    // "nothing pending".
    if (txs.length > 0) return out;
  }
  return new Map();
}

/**
 * Broadcast a signed transaction to EVERY endpoint, not just the first that
 * accepts it.
 *
 * This used to stop at the first acceptance, the same first-that-answers-wins
 * shape the read helpers use, and that is wrong for a write. A read only needs
 * one node to know the answer; a transaction needs the NETWORK to know it, and
 * the node you happen to hand it to is not obliged to gossip it onward — geth
 * caps how many transactions it will carry and relay per account (16 by
 * default), so a burst from one sender is accepted locally and quietly not
 * announced.
 *
 * That is not theoretical. The HEX keeper had 81 transactions "stuck": priced
 * at 34x the base fee, unmined for hours. They existed on exactly one node,
 * rpc.pulsechainstats.com, the first in this list. A second node had never
 * heard of any of them — eth_getTransactionByHash returned null for every one,
 * while returning mined transactions normally. No validator could include what
 * no validator had seen, which is why raising the price did nothing.
 *
 * Fanning out is safe: the payload is already signed, so every endpoint sees a
 * byte-identical transaction at the identical nonce. Duplicates are rejected as
 * "already known", which is a success rather than a failure — the transaction
 * is out there either way, and retrying it would only double-spend the gas.
 *
 * This makes its own request rather than going through `rpcRaw`, because here
 * the error TEXT is the useful part ("insufficient funds", "already known") and
 * `rpcRaw` deliberately collapses every error into a category.
 */
export async function sendRawTransaction(
  chain: ChainId,
  signed: string,
): Promise<
  | { hash: string; accepted: number; tried: number }
  | { settled: true; reason: string }
  | { error: string }
> {
  const urls = RPC_URLS[chain] ?? [];
  if (urls.length === 0) return { error: 'no endpoint configured' };

  const attempts = await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_sendRawTransaction', params: [signed], id: 1 }),
          signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
        });
        if (!res.ok) return { kind: 'transport' as const, message: `http ${res.status}` };
        const json = (await res.json()) as { result?: unknown; error?: { message?: string } };
        if (typeof json.result === 'string') return { kind: 'accepted' as const, hash: json.result };
        const message = String(json.error?.message ?? 'unknown error');
        if (/already known|known transaction|nonce too low|already imported/i.test(message)) {
          return { kind: 'known' as const, message };
        }
        return { kind: 'rejected' as const, message };
      } catch (e) {
        return { kind: 'transport' as const, message: e instanceof Error ? e.message : 'transport error' };
      }
    }),
  );

  const accepted = attempts.filter((a) => a.kind === 'accepted') as { kind: 'accepted'; hash: string }[];
  if (accepted.length > 0) {
    return { hash: accepted[0].hash, accepted: accepted.length, tried: urls.length };
  }
  const known = attempts.find((a) => a.kind === 'known');
  if (known) return { settled: true, reason: known.message };
  const rejected = attempts.find((a) => a.kind === 'rejected');
  if (rejected) return { error: rejected.message };
  return { error: attempts[0]?.message ?? 'no endpoint answered' };
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
