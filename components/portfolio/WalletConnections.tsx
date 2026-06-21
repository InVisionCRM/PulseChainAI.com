'use client';

// Wallet "connections" — the top counterparties a wallet has interacted with,
// aggregated from its decoded history (/api/portfolio/history). Labels + flags
// come from the shared known-address DB; each counterparty can be saved to a
// portfolio group. Lazy-loaded: only fetches when the Connections tab is shown.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IconUsers,
  IconExternalLink,
  IconRefresh,
  IconArrowDownLeft,
  IconArrowUpRight,
} from '@tabler/icons-react';
import type { ChainId, WalletHistoryResponse, WalletTransaction } from '@/services';
import { AddToGroupButton } from '@/components/portfolio/AddToGroupButton';
import { CounterpartyBadge } from '@/components/portfolio/counterpartyBadge';
import {
  aggregateCounterparties,
  type CounterpartySummary,
} from '@/lib/walletGraph/aggregate';
import { fmtUsd } from '@/lib/format';

// Bounded sample: a handful of pages per chain is enough to surface the most
// frequent counterparties without scanning a wallet's entire lifetime.
const MAX_PAGES_PER_CHAIN = 3;
const TOP_N = 15;

const EXPLORER_ADDRESS: Record<ChainId, string> = {
  ethereum: 'https://etherscan.io/address/',
  pulsechain: 'https://scan.pulsechain.com/address/',
};
const CHAIN_LOGO: Record<ChainId, string> = {
  ethereum: '/ethlogo.svg',
  pulsechain: '/LogoVector.svg',
};
const CHAIN_NAME: Record<ChainId, string> = {
  ethereum: 'Ethereum',
  pulsechain: 'PulseChain',
};

const truncate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

interface Props {
  walletAddress: string;
  chains: ChainId[];
}

export function WalletConnections({ walletAddress, chains }: Props) {
  const [rows, setRows] = useState<CounterpartySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all: WalletTransaction[] = [];
      for (const chain of chains) {
        let cursor: WalletHistoryResponse['nextCursor'] | undefined;
        for (let page = 0; page < MAX_PAGES_PER_CHAIN; page++) {
          const res = await fetch('/api/portfolio/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: walletAddress, chain, cursor }),
          });
          if (!res.ok) break;
          const data = (await res.json()) as WalletHistoryResponse;
          all.push(...data.items);
          if (!data.nextCursor) break;
          cursor = data.nextCursor;
        }
      }
      setRows(aggregateCounterparties(all, walletAddress));
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, [walletAddress, chains]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => (showAll ? rows : rows.slice(0, TOP_N)),
    [rows, showAll],
  );

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          <IconUsers className="h-4 w-4 text-sky-300/80" />
          Connections
          {loaded && rows.length > 0 && (
            <span className="font-normal text-[var(--text-faint)]">· {rows.length}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-40"
          title="Re-scan recent activity"
        >
          <IconRefresh className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <p className="mb-3 text-[11px] leading-snug text-[var(--text-faint)]">
        Top addresses this wallet has transacted with, from its recent history.
        Save any of them to a group.
      </p>

      {error ? (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--surface)]" />
          ))}
        </div>
      ) : loaded && rows.length === 0 ? (
        <div className="py-6 text-center text-sm text-[var(--text-faint)]">
          No counterparties found in recent history.
        </div>
      ) : (
        <>
          <ul className="space-y-1">
            {visible.map((r) => (
              <ConnectionRow key={`${r.chain}:${r.address}`} row={r} />
            ))}
          </ul>
          {rows.length > TOP_N && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 w-full rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
            >
              {showAll ? 'Show less' : `Show all ${rows.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ConnectionRow({ row: r }: { row: CounterpartySummary }) {
  const explorer = `${EXPLORER_ADDRESS[r.chain]}${r.address}`;
  return (
    <li className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--surface)]">
      <span
        title={CHAIN_NAME[r.chain]}
        className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full"
        style={{ background: r.chain === 'ethereum' ? '#fff' : '#0b1f3a' }}
      >
        <img
          src={CHAIN_LOGO[r.chain]}
          alt={CHAIN_NAME[r.chain]}
          className="h-full w-full object-contain p-[1px]"
        />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-[var(--text)]">
            {r.label ?? truncate(r.address)}
          </span>
          <CounterpartyBadge category={r.category} label={r.label} />
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[var(--text-faint)]">
          <a
            href={explorer}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 font-mono hover:text-[var(--text-muted)]"
          >
            {truncate(r.address)}
            <IconExternalLink className="h-2.5 w-2.5" />
          </a>
          <span>· {r.txCount} {r.txCount === 1 ? 'tx' : 'txs'}</span>
        </div>
      </div>

      <div className="shrink-0 text-right text-[11px] tabular-nums">
        {r.inUsd > 0 && (
          <div className="flex items-center justify-end gap-0.5 text-[var(--up)]">
            <IconArrowDownLeft className="h-3 w-3" />
            {fmtUsd(r.inUsd)}
          </div>
        )}
        {r.outUsd > 0 && (
          <div className="flex items-center justify-end gap-0.5 text-rose-300/90">
            <IconArrowUpRight className="h-3 w-3" />
            {fmtUsd(r.outUsd)}
          </div>
        )}
        {r.inUsd === 0 && r.outUsd === 0 && (
          <span className="text-[var(--text-muted)]">—</span>
        )}
      </div>

      <AddToGroupButton
        address={r.address}
        source="tx"
        chain={r.chain}
        context={{ direction: 'counterparty' }}
        className="shrink-0 text-[var(--text-faint)] opacity-0 transition-opacity hover:text-orange-300 group-hover:opacity-100"
      />
    </li>
  );
}
