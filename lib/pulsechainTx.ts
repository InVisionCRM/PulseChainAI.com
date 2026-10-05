// One PulseChain transaction, read for the in-app transaction page (/tx/[hash]).
//
// Everything the page states as fact comes from the RPC pool: status, from/to,
// value, fee, block, time and the token transfers (decoded here from the
// receipt's standard Transfer logs, with each token's symbol/decimals read by
// eth_call). The explorer is asked for one thing an RPC cannot know — the names:
// which function was called, its arguments, and the contract's name — and the
// page renders without them if the explorer is down.
//
// Not lib/pulsechainRpcFallback.ts: that module rebuilds Blockscout-shaped
// responses for when the explorer fails. Here the RPC is the primary source.

import { getBlockTimestamp, getTransactionWithReceipt } from '@/lib/portfolio/evmRpc';
import { rpcTokenMeta, TRANSFER_TOPIC } from '@/lib/pulsechainRpcFallback';
import { blockscoutJson } from '@/lib/blockscout';

export interface TxTransfer {
  token: string;
  symbol: string | null;
  /** Null when the token didn't answer decimals() — the amount is then raw units. */
  decimals: number | null;
  from: string;
  to: string;
  /** ERC-20: the amount in raw units. NFT (ERC-721): null, see tokenId. */
  amount: string | null;
  tokenId: string | null;
}

export interface TxView {
  hash: string;
  status: 'success' | 'failed' | 'pending';
  blockNumber: number | null;
  /** Unix seconds; null while pending. */
  timestamp: number | null;
  from: string;
  to: string | null;
  /** Set when the transaction deployed a contract. */
  createdContract: string | null;
  nonce: number;
  valueWei: string;
  /** gasUsed × effectiveGasPrice; null while pending. */
  feeWei: string | null;
  gasUsed: number | null;
  /** First 4 bytes of the input; null for a plain PLS send or a deployment. */
  selector: string | null;
  transfers: TxTransfer[];
  /** Every log in the receipt, transfers included. */
  eventCount: number;
}

const hexToBig = (h: string) => BigInt(h).toString();
const topicAddr = (t: string) => `0x${t.slice(-40)}`.toLowerCase();

/** The transaction from the RPC pool, or null if no node knows the hash. */
export async function loadTx(hash: string): Promise<TxView | null> {
  const found = await getTransactionWithReceipt('pulsechain', hash.toLowerCase());
  if (!found) return null;
  const { tx, receipt } = found;
  const blockNumber = tx.blockNumber == null ? null : Number.parseInt(tx.blockNumber, 16);

  const transferLogs = (receipt?.logs ?? []).filter(
    (l) => l.topics[0]?.toLowerCase() === TRANSFER_TOPIC && (l.topics.length === 3 || l.topics.length === 4),
  );
  const tokens = [...new Set(transferLogs.map((l) => l.address.toLowerCase()))];
  const [timestamp, metas] = await Promise.all([
    blockNumber == null ? null : getBlockTimestamp('pulsechain', blockNumber),
    Promise.all(tokens.map((t) => rpcTokenMeta(t))),
  ]);
  const metaOf = new Map(tokens.map((t, i) => [t, metas[i]]));

  const transfers: TxTransfer[] = transferLogs.map((l) => {
    const token = l.address.toLowerCase();
    const meta = metaOf.get(token);
    // ERC-20 Transfer indexes from/to (3 topics, amount in data); ERC-721
    // also indexes the token id (4 topics, empty data).
    const nft = l.topics.length === 4;
    return {
      token,
      symbol: meta?.symbol ?? null,
      decimals: meta?.decimals == null ? null : Number(meta.decimals),
      from: topicAddr(l.topics[1]),
      to: topicAddr(l.topics[2]),
      amount: nft ? null : hexToBig(l.data),
      tokenId: nft ? hexToBig(l.topics[3]) : null,
    };
  });

  return {
    hash: tx.hash.toLowerCase(),
    status: receipt == null ? 'pending' : receipt.status === '0x1' ? 'success' : 'failed',
    blockNumber,
    timestamp,
    from: tx.from.toLowerCase(),
    to: tx.to?.toLowerCase() ?? null,
    createdContract: receipt?.contractAddress?.toLowerCase() ?? null,
    nonce: Number.parseInt(tx.nonce, 16),
    valueWei: hexToBig(tx.value),
    feeWei: receipt ? (BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice)).toString() : null,
    gasUsed: receipt ? Number.parseInt(receipt.gasUsed, 16) : null,
    // A deployment's input is the contract's bytecode, not a function call.
    selector: tx.to && tx.input.length >= 10 ? tx.input.slice(0, 10).toLowerCase() : null,
    transfers,
    eventCount: receipt?.logs.length ?? 0,
  };
}

export interface TxNames {
  /** e.g. "stakeGoodAccounting(address stakerAddr, uint256 stakeIndex, uint40 stakeIdParam)" */
  methodCall: string | null;
  params: { name: string; type: string; value: string }[];
  toName: string | null;
}

/** Explorer budget per attempt; bsFetchJson retries 4× before giving up. */
const NAMES_TIMEOUT_MS = 4_000;

/** The explorer's names for this transaction, or null if it didn't answer. */
export async function loadTxNames(hash: string): Promise<TxNames | null> {
  const d = await blockscoutJson(`/transactions/${hash.toLowerCase()}`, { timeoutMs: NAMES_TIMEOUT_MS });
  if (!d) return null;
  const input = d.decoded_input as
    | { method_call?: string; parameters?: { name: string; type: string; value: unknown }[] }
    | null
    | undefined;
  return {
    methodCall: input?.method_call ?? null,
    params: (input?.parameters ?? []).map((p) => ({
      name: p.name,
      type: p.type,
      value: typeof p.value === 'string' ? p.value : JSON.stringify(p.value),
    })),
    toName: typeof d.to?.name === 'string' && d.to.name ? d.to.name : null,
  };
}
