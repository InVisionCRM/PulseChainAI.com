// Counterparty aggregation for the wallet "connections" panel.
//
// Operates purely on the decoded transaction history the app already fetches
// from /api/portfolio/history (Otterscan on PulseChain, Blockscout on Ethereum)
// — no new RPC. For each transaction we attribute its signed token flows to the
// counterparty the wallet interacted with, summing USD in/out and interaction
// counts. This mirrors Gumshoe's trace.ts `aggregateFlows`, fed by our faster
// history pipe instead of raw getLogs.

import type { ChainId, WalletTransaction } from '@/services';
import { getKnownAddress, type AddressCategory } from '@/lib/gumshoe/address-labels';

export interface CounterpartySummary {
  /** Lowercased counterparty address. */
  address: string;
  chain: ChainId;
  /** Best available label: history's own label, then the known-address DB. */
  label: string | null;
  category: AddressCategory | null;
  /** Number of transactions the wallet had with this counterparty. */
  txCount: number;
  /** USD that flowed into the wallet from this counterparty (current prices). */
  inUsd: number;
  /** USD that flowed out of the wallet to this counterparty. */
  outUsd: number;
  /** Most recent interaction (ms epoch). */
  lastTs: number;
}

/**
 * Aggregate a wallet's transaction history into per-counterparty summaries,
 * ranked by interaction count then total USD moved. `walletAddress` is used to
 * defensively drop self-references.
 */
export function aggregateCounterparties(
  txs: WalletTransaction[],
  walletAddress?: string,
): CounterpartySummary[] {
  const self = walletAddress?.toLowerCase();
  const map = new Map<string, CounterpartySummary>();

  for (const t of txs) {
    const cp = t.counterparty?.toLowerCase();
    if (!cp || cp === self) continue;

    const key = `${t.chain}:${cp}`;
    let s = map.get(key);
    if (!s) {
      const known = getKnownAddress(cp);
      s = {
        address: cp,
        chain: t.chain,
        label: t.counterpartyLabel || known?.label || null,
        category: known?.category ?? null,
        txCount: 0,
        inUsd: 0,
        outUsd: 0,
        lastTs: 0,
      };
      map.set(key, s);
    }

    s.txCount += 1;
    if (t.timestamp > s.lastTs) s.lastTs = t.timestamp;
    for (const f of t.flows) {
      const usd = f.valueUsd ?? 0;
      if (f.direction === 'in') s.inUsd += usd;
      else s.outUsd += usd;
    }
  }

  return [...map.values()].sort(
    (a, b) =>
      b.txCount - a.txCount || b.inUsd + b.outUsd - (a.inUsd + a.outUsd),
  );
}
