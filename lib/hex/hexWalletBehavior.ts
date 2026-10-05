// What a wallet did after each of its stake-ends — the data half of
// lib/hex/whaleBehavior.ts. Used by the Whale Radar (/api/hex/whale-behavior)
// and by the rescue-fates cron, so a rescued staker on the Rescue Wall and a
// whale on the radar are judged by exactly the same rules.
//
// All native, key-free data: the staking subgraph for starts and ends, the
// explorer for the wallet's HEX transfers, and the RPC pool for the receipt of
// every transfer that could count — the receipt is what tells a sale from a
// transfer (see OutflowRecord).

import { hexSubgraphQuery, type HexNet as Net } from '@/lib/hex/subgraph';
import {
  classifyEnds, SELL_WINDOW_SEC, BATCH_GAP_SEC,
  type EndBehavior, type OutflowRecord, type StakeRecord,
} from '@/lib/hex/whaleBehavior';
import { getTransactionReceiptLogs } from '@/lib/portfolio/evmRpc';
import { getChain } from '@/lib/chains/registry';

// How far back to page the wallet's HEX transfers (bounds explorer calls). Ends
// older than the oldest transfer we see are reported "unknown", never guessed.
const MAX_TRANSFER_PAGES = 12;
/** Receipts read at once — each is one call to the RPC pool. */
const RECEIPT_CONCURRENCY = 8;

// HEX is the SAME contract on Ethereum and PulseChain (PulseChain forked it).
const HEX_TOKEN = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
const ZERO = '0x0000000000000000000000000000000000000000';

/** Uniswap V2 (PulseX and its forks) and V3 (9mm V3) `Swap` events. */
const SWAP_TOPICS = new Set([
  '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822', // Swap(address,uint256,uint256,uint256,uint256,address)
  '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67', // Swap(address,address,int256,int256,uint160,uint128,int24)
]);
/** HEX `StakeStart(uint256,address,uint40)` — verified on a live stakeStart receipt. */
const STAKE_START_TOPIC = '0x14872dc760f33532684e68e1b6d5fd3f71ba7b07dee76bdb2b084f28b74233ef';

const num = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};
const lc = (a: unknown) => String(a ?? '').toLowerCase();
const tsOf = (iso: unknown) => {
  const ms = Date.parse(String(iso));
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
};

interface RawHist { stakeId?: string; timestamp?: unknown; stakedHearts?: unknown; transactionHash?: unknown }

function toRecords(rows: RawHist[]): StakeRecord[] {
  return (rows ?? [])
    .map((r) => ({
      stakeId: String(r.stakeId ?? ''),
      timestamp: num(r.timestamp),
      principalHex: num(r.stakedHearts) / 1e8,
      tx: r.transactionHash ? String(r.transactionHash) : undefined,
    }))
    .filter((r) => r.timestamp > 0);
}

/** Wallet's newest 1,000 stake starts + ends (with tx) from the staking
 *  subgraph. Throws when the subgraph cannot answer: no history reads as
 *  "never staked".
 *
 *  Newest first, explicitly: unordered, the page is the subgraph's id order,
 *  and a pooled contract with 1,397 ends (0x1125…6743) came back without the
 *  rescue it had just collected. Every caller wants the recent end anyway. */
async function stakeHistory(net: Net, addr: string): Promise<{ starts: StakeRecord[]; ends: StakeRecord[] }> {
  const page = `first: 1000, orderBy: timestamp, orderDirection: desc`;
  const d = await hexSubgraphQuery<{ stakeStarts: RawHist[]; stakeEnds: RawHist[] }>(
    net,
    `{ stakeStarts(where:{ stakerAddr: "${addr}" }, ${page}){ stakeId timestamp stakedHearts transactionHash } stakeEnds(where:{ stakerAddr: "${addr}" }, ${page}){ stakeId timestamp stakedHearts transactionHash } }`,
  );
  return { starts: toRecords(d.stakeStarts), ends: toRecords(d.stakeEnds) };
}

/** A HEX transfer out of the wallet, before its receipt is read. */
export interface RawOutflow { ts: number; to: string; hex: number; tx: string }

/** Page the wallet's HEX ERC-20 transfers from the explorer, newest first.
 *  Returns OUT transfers only (stake burns excluded) + the oldest transfer
 *  timestamp seen. Stops once a page reaches back past `sinceTs` (unix s). */
export async function hexTransfersOut(net: Net, addr: string, sinceTs = 0): Promise<{ out: RawOutflow[]; oldestActivityTs: number | null }> {
  const out: RawOutflow[] = [];
  let oldest: number | null = null;
  const base = `${getChain(net).blockscoutApiBase}/addresses/${addr}/token-transfers?type=ERC-20&token=${HEX_TOKEN}`;
  let url: string | null = base;

  for (let page = 0; page < MAX_TRANSFER_PAGES && url; page++) {
    let items: Record<string, unknown>[] = [];
    let next: Record<string, string> | null = null;
    try {
      // Bounded like every other explorer call here: an unanswered request
      // would otherwise hold a cron worker until the platform kills the run.
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { accept: 'application/json' } });
      if (!res.ok) break;
      const j = await res.json();
      items = (j.items ?? []) as Record<string, unknown>[];
      next = (j.next_page_params ?? null) as Record<string, string> | null;
    } catch {
      break;
    }
    for (const it of items) {
      const ts = tsOf(it.timestamp);
      if (ts > 0) oldest = oldest == null ? ts : Math.min(oldest, ts);
      const from = lc((it.from as Record<string, unknown>)?.hash);
      const to = lc((it.to as Record<string, unknown> | undefined)?.hash);
      // Only outflows from this wallet, excluding stake mints/burns (to 0x0 or the
      // HEX contract) which are staking activity, not sells or transfers.
      if (from !== addr || to === ZERO || to === HEX_TOKEN || !to) continue;
      const total = it.total as Record<string, unknown> | undefined;
      const dec = num(total?.decimals) || 8;
      const hex = num(total?.value) / Math.pow(10, dec);
      // PulseChain's Blockscout names the hash `tx_hash`, Ethereum's newer
      // release `transaction_hash` (both verified 2026-10-04). Reading only the
      // second left every PulseChain sell/move link on the radar blank.
      const tx = String(it.tx_hash ?? it.transaction_hash ?? '');
      if (hex > 0) out.push({ ts, to, hex, tx });
    }
    const reachedSince = oldest != null && oldest < sinceTs;
    url = !reachedSince && next && Object.keys(next).length ? `${base}&${new URLSearchParams(next).toString()}` : null;
  }
  return { out, oldestActivityTs: oldest };
}

/** Sell, restake or move — read from the transaction's own logs. Throws when
 *  no node can return the receipt, so a transfer is never guessed at. */
async function kindOf(net: Net, tx: string): Promise<OutflowRecord['kind']> {
  const logs = await getTransactionReceiptLogs(net, tx);
  if (!logs) throw new Error(`no receipt for ${tx}`);
  if (logs.some((l) => lc(l.address) === HEX_TOKEN && l.topics[0] === STAKE_START_TOPIC)) return 'restake';
  if (logs.some((l) => SWAP_TOPICS.has(l.topics[0]))) return 'sell';
  return 'move';
}

/** Classify outflows by receipt, reading only those inside some end's window —
 *  nothing else can affect a result. Classified once per transaction. */
export async function classifyOutflows(net: Net, out: RawOutflow[], endTimestamps: number[]): Promise<OutflowRecord[]> {
  const inWindow = out.filter((o) => endTimestamps.some((t) => o.ts > t && o.ts <= t + SELL_WINDOW_SEC));
  const txs = [...new Set(inWindow.map((o) => o.tx))];
  const kinds = new Map<string, OutflowRecord['kind']>();
  const queue = [...txs];
  await Promise.all(
    Array.from({ length: RECEIPT_CONCURRENCY }, async () => {
      while (queue.length) {
        const tx = queue.shift()!;
        kinds.set(tx, await kindOf(net, tx));
      }
    }),
  );
  return inWindow.map((o) => ({ timestamp: o.ts, hex: o.hex, usd: 0, tx: o.tx, kind: kinds.get(o.tx)! }));
}

/**
 * Every stake-end of `addr`, classified, most recent first. `extraEnds` adds
 * ends the subgraph files under someone else — a stake held through an HSI
 * contract ends in the contract's name and pays this wallet, so its end is
 * passed in by the caller that knows about it.
 *
 * `sinceTs` (unix s) limits the work to ends from then on, for a caller that
 * only needs recent ones: transfers are paged back just past it, and only
 * those ends' windows are classified. Ends up to a batch gap earlier are kept,
 * since one of them can share a batch with the first end that matters.
 */
export async function walletEndBehavior(
  net: Net,
  addr: string,
  extraEnds: StakeRecord[] = [],
  sinceTs = 0,
): Promise<{ behavior: EndBehavior[]; oldestActivityTs: number | null }> {
  const [{ starts, ends }, { out, oldestActivityTs }] = await Promise.all([
    stakeHistory(net, addr),
    hexTransfersOut(net, addr, sinceTs - BATCH_GAP_SEC),
  ]);
  const allEnds = [...ends, ...extraEnds].filter((e) => e.timestamp >= sinceTs - BATCH_GAP_SEC);
  const outflows = await classifyOutflows(net, out, allEnds.map((e) => e.timestamp));
  return { behavior: classifyEnds(allEnds, starts, outflows, oldestActivityTs), oldestActivityTs };
}
