// Reconstruct a token's holder set directly from on-chain `Transfer` logs when
// the PulseScan (Blockscout) indexer is unavailable.
//
// A holder balance isn't stored anywhere as a list — it's the running sum of
// every Transfer the address was ever part of. So we walk the token's full
// Transfer history via `eth_getLogs`, net (`to` credits − `from` debits) per
// address, and keep the positive balances. This is exact (verified against
// live `balanceOf`), but it means we MUST cover the whole history: a partial
// window gives net *flow*, not a balance, so it would undercount. When the walk
// can't finish inside the budget (mega-tokens, pre-fork tokens with millions of
// events) we say so rather than return wrong numbers.
//
// Only archive RPCs that serve historical logs are usable here. g4mm4 is the
// primary (a full archive node, user-selected); the other two are failover.
// publicnode is deliberately excluded — it archive-gates `eth_getLogs` behind a
// paid token (HTTP 403).

const LOG_RPCS = [
  'https://rpc-pulsechain.g4mm4.io',
  'https://rpc.pulsechainrpc.com',
  'https://rpc.gigatheminter.com',
];

// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

// Adaptive-walk tuning. Chunks start wide and halve whenever a call errors or a
// node caps the range; g4mm4 handles ~50k-log responses but times out around
// 100k blocks on dense tokens, so we shrink on failure rather than guess.
const INITIAL_CHUNK = 50_000; // blocks per eth_getLogs
const MIN_CHUNK = 1_000;
const CALL_TIMEOUT_MS = 30_000;

export interface RpcHolder {
  address: string;
  /** Raw on-chain balance (wei), as a decimal string. */
  value: string;
}

export interface RpcHolderSet {
  holders: RpcHolder[]; // positive balances, sorted desc
  holdersCount: number;
  /** True when the walk reached the latest block within budget. */
  complete: boolean;
  /** First block walked (deployment block, or the budget-limited floor). */
  fromBlock: number;
  toBlock: number;
  /** eth_getLogs calls actually made — for observability. */
  calls: number;
}

interface WalkBudget {
  maxCalls: number;
  maxMs: number;
  /** Injected clock so callers/tests control time (no Date.now in libs). */
  now: () => number;
}

async function rpcRaw(
  url: string,
  method: string,
  params: unknown[],
): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'rpc error');
  return json.result;
}

/** Call `method` across the RPC pool, first success wins. Throws if all fail. */
async function rpcFailover(method: string, params: unknown[]): Promise<any> {
  let lastErr: unknown;
  for (const url of LOG_RPCS) {
    try {
      return await rpcRaw(url, method, params);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('all RPCs failed');
}

const toHexBlock = (n: number) => '0x' + n.toString(16);
const addrFromTopic = (topic: string) => '0x' + topic.slice(-40).toLowerCase();

export async function getLatestBlock(): Promise<number> {
  return Number(await rpcFailover('eth_blockNumber', []));
}

/**
 * Binary-search the token's deployment block via `eth_getCode` (archive). Walk
 * start; starting a few blocks early only wastes cheap empty chunks, so we bias
 * low. Returns 0 if code is present even at block 0 (a pre-fork token whose full
 * history is effectively unbounded — the caller's budget will catch that).
 */
export async function findDeploymentBlock(
  token: string,
  latest: number,
): Promise<number> {
  const hasCode = async (block: number): Promise<boolean> => {
    const code = await rpcFailover('eth_getCode', [token, toHexBlock(block)]);
    return typeof code === 'string' && code !== '0x';
  };
  if (!(await hasCode(latest))) return latest; // self-destructed / not a contract
  let lo = 0;
  let hi = latest;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (await hasCode(mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/**
 * Walk `Transfer` logs from `fromBlock` to the chain head, netting balances.
 * Stops early (complete:false) if the call or time budget is exhausted — the
 * caller then reports the data as unavailable rather than partial/wrong.
 */
export async function reconstructHolders(
  token: string,
  opts: {
    fromBlock: number;
    latest: number;
    budget?: Partial<WalkBudget>;
  },
): Promise<RpcHolderSet> {
  const tok = token.toLowerCase();
  const budget: WalkBudget = {
    maxCalls: opts.budget?.maxCalls ?? 150,
    maxMs: opts.budget?.maxMs ?? 25_000,
    now: opts.budget?.now ?? (() => performance.now()),
  };
  const start = budget.now();
  const balances = new Map<string, bigint>();

  let cursor = opts.fromBlock;
  let chunk = INITIAL_CHUNK;
  let calls = 0;
  let complete = true;

  while (cursor <= opts.latest) {
    if (calls >= budget.maxCalls || budget.now() - start >= budget.maxMs) {
      complete = false;
      break;
    }
    const to = Math.min(cursor + chunk - 1, opts.latest);
    calls++;
    let logs: any[];
    try {
      logs = await rpcFailover('eth_getLogs', [
        {
          address: tok,
          fromBlock: toHexBlock(cursor),
          toBlock: toHexBlock(to),
          topics: [TRANSFER_TOPIC],
        },
      ]);
    } catch {
      // Range too wide / node hiccup: halve and retry the same start.
      if (chunk > MIN_CHUNK) {
        chunk = Math.max(MIN_CHUNK, Math.floor(chunk / 2));
        continue;
      }
      // Even the smallest chunk failed — can't cover this block range.
      complete = false;
      break;
    }

    for (const log of logs) {
      const from = addrFromTopic(log.topics[1]);
      const dest = addrFromTopic(log.topics[2]);
      const value = BigInt(log.data);
      if (from !== ZERO_ADDR) balances.set(from, (balances.get(from) ?? BigInt(0)) - value);
      if (dest !== ZERO_ADDR) balances.set(dest, (balances.get(dest) ?? BigInt(0)) + value);
    }

    // Grow the window back toward INITIAL_CHUNK when a chunk came back light,
    // so sparse block ranges don't cost one call per MIN_CHUNK.
    if (logs.length < 20_000 && chunk < INITIAL_CHUNK) {
      chunk = Math.min(INITIAL_CHUNK, chunk * 2);
    }
    cursor = to + 1;
  }

  const holders: RpcHolder[] = [];
  for (const [address, bal] of balances) {
    if (bal > BigInt(0)) holders.push({ address, value: bal.toString() });
  }
  holders.sort((a, b) => (BigInt(a.value) < BigInt(b.value) ? 1 : -1));

  return {
    holders,
    holdersCount: holders.length,
    complete,
    fromBlock: opts.fromBlock,
    toBlock: opts.latest,
    calls,
  };
}
