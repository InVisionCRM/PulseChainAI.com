// PulseChain-only fallback: serve Blockscout-shaped data from the RPC pool when
// the explorer is unavailable.
//
// Why a new module rather than extending an existing one: `lib/blockscout.ts` is
// REST-shaped (it fetches and retries URLs) and `lib/portfolio/evmRpc.ts` is raw
// JSON-RPC primitives. This is the adapter between them — it decodes chain data
// into the response shapes Blockscout callers already expect. Neither existing
// file is the right home for that translation.
//
// Scope is deliberately narrow. Per CLAUDE.md only PulseChain needs an explorer
// fallback (Ethereum's and Robinhood's Blockscout are reliable), and only the
// endpoints an RPC can honestly reconstruct are covered:
//
//   /tokens/{addr}            -> eth_call name/symbol/decimals/totalSupply
//   /tokens/{addr}/transfers  -> eth_getLogs on the Transfer topic
//   token balance of a holder -> eth_call balanceOf
//
// TOKEN HOLDERS IS NOT COVERED, and cannot be. There is no log query that
// enumerates holders; reconstructing them means replaying every Transfer since
// the token's deploy block and tallying balances. Callers that need holders must
// surface the explorer outage rather than show a wrong or partial list — for
// financial data an accurate blank beats a misleading number.
//
// Everything here returns a `source` label so the UI can badge a degraded view.

import {
  ethCall,
  ethGetLogs,
  getBlockNumber,
  getBlockTimestamp,
  type RpcLog,
} from '@/lib/portfolio/evmRpc';
import { blockscoutJson } from '@/lib/blockscout';

export type DataSource = 'blockscout' | 'rpc-fallback';

/** keccak256("Transfer(address,address,uint256)") */
export const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// ERC-20 selectors.
const SEL_NAME = '0x06fdde03';
const SEL_SYMBOL = '0x95d89b41';
const SEL_DECIMALS = '0x313ce567';
const SEL_TOTAL_SUPPLY = '0x18160ddd';
const SEL_BALANCE_OF = '0x70a08231';

/**
 * Decode an ABI-encoded string return. Handles both the dynamic `string`
 * encoding (offset, length, data) and the older `bytes32` convention some
 * pre-ERC20-standard tokens still use for name()/symbol().
 */
function decodeAbiString(hex: string | null): string | null {
  if (!hex || hex === '0x') return null;
  const body = hex.slice(2);
  // bytes32: exactly one word, right-padded with zeros.
  if (body.length === 64) {
    const bytes = Buffer.from(body, 'hex');
    const end = bytes.indexOf(0);
    const s = bytes.subarray(0, end === -1 ? bytes.length : end).toString('utf8');
    return s.length ? s : null;
  }
  // Dynamic string: [0]=offset, [1]=length, then data.
  if (body.length < 128) return null;
  const len = Number.parseInt(body.slice(64, 128), 16);
  if (!Number.isFinite(len) || len === 0) return null;
  const s = Buffer.from(body.slice(128, 128 + len * 2), 'hex').toString('utf8');
  return s.length ? s : null;
}

function decodeUint(hex: string | null): bigint | null {
  if (!hex || hex === '0x') return null;
  try {
    return BigInt(hex);
  } catch {
    return null;
  }
}

/** A 32-byte log topic holds an address in its low 20 bytes. */
function addressFromTopic(topic: string | undefined): string | null {
  if (!topic || topic.length < 42) return null;
  return `0x${topic.slice(-40)}`.toLowerCase();
}

export interface RpcTokenMeta {
  address: string;
  name: string | null;
  symbol: string | null;
  decimals: string | null;
  total_supply: string | null;
  type: 'ERC-20';
  /** Not derivable from an RPC — null rather than a fabricated number. */
  holders: null;
  icon_url: null;
  exchange_rate: null;
}

/**
 * Blockscout-shaped `/tokens/{addr}` built from four `eth_call`s. Fields the RPC
 * genuinely cannot supply (holder count, icon, price) are null, never invented.
 * Returns null only if the token doesn't respond to any ERC-20 call at all.
 */
export async function rpcTokenMeta(token: string): Promise<RpcTokenMeta | null> {
  const addr = token.toLowerCase();
  const [nameHex, symbolHex, decimalsHex, supplyHex] = await Promise.all([
    ethCall('pulsechain', addr, SEL_NAME),
    ethCall('pulsechain', addr, SEL_SYMBOL),
    ethCall('pulsechain', addr, SEL_DECIMALS),
    ethCall('pulsechain', addr, SEL_TOTAL_SUPPLY),
  ]);

  const name = decodeAbiString(nameHex);
  const symbol = decodeAbiString(symbolHex);
  const decimals = decodeUint(decimalsHex);
  const totalSupply = decodeUint(supplyHex);

  // Nothing answered — not an ERC-20, or every endpoint is down. Either way we
  // have no data, so say so instead of returning a hollow object.
  if (name == null && symbol == null && decimals == null && totalSupply == null) {
    return null;
  }

  return {
    address: addr,
    name,
    symbol,
    decimals: decimals != null ? String(decimals) : null,
    total_supply: totalSupply != null ? String(totalSupply) : null,
    type: 'ERC-20',
    holders: null,
    icon_url: null,
    exchange_rate: null,
  };
}

/** Raw-units balance of `holder` for `token`, or null if the call failed. */
export async function rpcTokenBalance(
  token: string,
  holder: string,
): Promise<string | null> {
  const data = SEL_BALANCE_OF + holder.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const v = decodeUint(await ethCall('pulsechain', token.toLowerCase(), data));
  return v != null ? String(v) : null;
}

export interface RpcTransferItem {
  block_hash: string;
  block_number: number;
  from: { hash: string; is_contract: null; name: null };
  to: { hash: string; is_contract: null; name: null };
  log_index: string;
  /** ISO-8601, matching Blockscout. Null when the block lookup was skipped. */
  timestamp: string | null;
  token: RpcTokenMeta | null;
  total: { decimals: string | null; value: string };
  tx_hash: string;
  type: 'token_transfer';
  /** Blockscout reports the calling method; an RPC log cannot. */
  method: null;
}

// Scan tuning. Chunks stay small enough that a single window never returns an
// unbounded payload, and the total look-back is capped so a quiet token can't
// walk the chain forever.
const CHUNK_BLOCKS = 10_000;
const MAX_CHUNKS = 12;

/**
 * Blockscout-shaped `/tokens/{addr}/transfers`, newest first, reconstructed from
 * `eth_getLogs`.
 *
 * Walks backwards from head in `CHUNK_BLOCKS` windows until `cap` transfers are
 * collected or `MAX_CHUNKS` windows have been scanned — so this returns the most
 * recent activity, NOT the full history. `scannedFromBlock` tells the caller how
 * far back the window actually reached so a partial view can be labelled.
 *
 * Block timestamps cost one `eth_getBlockByNumber` per distinct block, so they
 * are resolved only for the blocks actually returned, and skipped entirely when
 * `withTimestamps` is false.
 */
export async function rpcTokenTransfers(
  token: string,
  opts?: { cap?: number; withTimestamps?: boolean },
): Promise<{
  items: RpcTransferItem[];
  scannedFromBlock: number;
  headBlock: number;
  /** True when the scan window closed before `cap` was reached. */
  partial: boolean;
} | null> {
  const cap = opts?.cap ?? 50;
  const withTimestamps = opts?.withTimestamps ?? true;
  const addr = token.toLowerCase();

  const head = await getBlockNumber('pulsechain');
  if (head == null) return null;

  const meta = await rpcTokenMeta(addr);

  const logs: RpcLog[] = [];
  let to = head;
  let chunks = 0;
  while (logs.length < cap && chunks < MAX_CHUNKS && to > 0) {
    const from = Math.max(0, to - CHUNK_BLOCKS);
    const chunk = await ethGetLogs('pulsechain', {
      address: addr,
      fromBlock: from,
      toBlock: to,
      topics: [TRANSFER_TOPIC],
    });
    // A null chunk means every endpoint failed for this window. Bail rather
    // than silently returning a gap-riddled list.
    if (chunk == null) return null;
    logs.push(...chunk);
    to = from - 1;
    chunks++;
  }

  // Newest first, matching Blockscout's ordering.
  logs.sort((a, b) => {
    const bn = Number.parseInt(b.blockNumber, 16) - Number.parseInt(a.blockNumber, 16);
    if (bn !== 0) return bn;
    return Number.parseInt(b.logIndex, 16) - Number.parseInt(a.logIndex, 16);
  });
  const kept = logs.slice(0, cap);

  // Resolve timestamps once per distinct block.
  const stamps = new Map<number, number | null>();
  if (withTimestamps) {
    const blocks = [...new Set(kept.map((l) => Number.parseInt(l.blockNumber, 16)))];
    const resolved = await Promise.all(
      blocks.map((b) => getBlockTimestamp('pulsechain', b)),
    );
    blocks.forEach((b, i) => stamps.set(b, resolved[i]));
  }

  const items: RpcTransferItem[] = kept.map((l) => {
    const blockNumber = Number.parseInt(l.blockNumber, 16);
    const ts = stamps.get(blockNumber);
    return {
      block_hash: l.blockHash,
      block_number: blockNumber,
      from: { hash: addressFromTopic(l.topics[1]) ?? '', is_contract: null, name: null },
      to: { hash: addressFromTopic(l.topics[2]) ?? '', is_contract: null, name: null },
      log_index: String(Number.parseInt(l.logIndex, 16)),
      timestamp: ts != null ? new Date(ts * 1000).toISOString() : null,
      token: meta,
      total: {
        decimals: meta?.decimals ?? null,
        value: String(decodeUint(l.data) ?? 0n),
      },
      tx_hash: l.transactionHash,
      type: 'token_transfer',
      method: null,
    };
  });

  const scannedFromBlock = Math.max(0, to + 1);
  return {
    items,
    scannedFromBlock,
    headBlock: head,
    partial: items.length < cap,
  };
}

// ---------------------------------------------------------------------------
// Resilient wrappers: Blockscout first, RPC only when it has nothing to give.
// ---------------------------------------------------------------------------
//
// Blockscout stays the primary because it supplies things an RPC cannot (holder
// counts, icons, verified-contract flags, decoded methods). `blockscoutJson`
// already retries the flaky primary four times; these only reach for the RPC
// once that has genuinely been exhausted.

/** `/tokens/{addr}` with an RPC fallback. `data` is null only if both failed. */
export async function fetchTokenMetaResilient(token: string): Promise<{
  data: any | null;
  source: DataSource | null;
}> {
  const bs = await blockscoutJson(`/tokens/${token.toLowerCase()}`);
  if (bs != null) return { data: bs, source: 'blockscout' };

  const rpc = await rpcTokenMeta(token);
  if (rpc != null) return { data: rpc, source: 'rpc-fallback' };

  return { data: null, source: null };
}

/**
 * `/tokens/{addr}/transfers` with an RPC fallback.
 *
 * On the fallback path the list covers only the recent window `rpcTokenTransfers`
 * scanned, so `partial` is set and callers should badge the view as limited
 * rather than presenting it as the token's full transfer history.
 */
export async function fetchTokenTransfersResilient(
  token: string,
  opts?: { cap?: number },
): Promise<{
  items: any[];
  source: DataSource | null;
  partial: boolean;
  /** Fallback path only: oldest block the scan actually reached. */
  scannedFromBlock?: number;
}> {
  const bs = await blockscoutJson(`/tokens/${token.toLowerCase()}/transfers`);
  if (bs != null && Array.isArray(bs.items)) {
    return { items: bs.items, source: 'blockscout', partial: false };
  }

  const rpc = await rpcTokenTransfers(token, opts);
  if (rpc != null) {
    return {
      items: rpc.items,
      source: 'rpc-fallback',
      partial: true,
      scannedFromBlock: rpc.scannedFromBlock,
    };
  }

  return { items: [], source: null, partial: false };
}
