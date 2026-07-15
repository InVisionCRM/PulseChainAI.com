'use client';

// Related wallets — finds wallets likely controlled by the same entity as this
// one, by clustering on shared (personal) funding sources from history. Heavy
// and probabilistic, so it runs only on explicit click. See lib/walletGraph/related.

import { useCallback, useState } from 'react';
import {
  IconAffiliate,
  IconExternalLink,
  IconSearch,
  IconRefresh,
} from '@tabler/icons-react';
import type { ChainId, WalletHistoryResponse, WalletTransaction } from '@/services';
import { AddToGroupButton } from '@/components/portfolio/AddToGroupButton';
import { CounterpartyBadge } from '@/components/portfolio/counterpartyBadge';
import {
  deriveFunders,
  scoreRelated,
  type RelatedCandidate,
} from '@/lib/walletGraph/related';

const TARGET_PAGES = 3;
const FUNDER_PAGES = 2;
const MAX_FUNDERS = 6;

const EXPLORER_ADDRESS: Record<ChainId, string> = {
  ethereum: 'https://etherscan.io/address/',
  pulsechain: 'https://scan.pulsechain.com/address/',
  robinhood: 'https://robinhoodchain.blockscout.com/address/',
};
const CHAIN_LOGO: Record<ChainId, string> = {
  ethereum: '/ethlogo.svg',
  pulsechain: '/LogoVector.svg',
  robinhood: '/robinhood-logo.svg',
};
const CHAIN_NAME: Record<ChainId, string> = {
  ethereum: 'Ethereum',
  pulsechain: 'PulseChain',
  robinhood: 'Robinhood',
};

const truncate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

async function fetchHistory(
  address: string,
  chain: ChainId,
  maxPages: number,
): Promise<WalletTransaction[]> {
  const all: WalletTransaction[] = [];
  let cursor: WalletHistoryResponse['nextCursor'] | undefined;
  for (let p = 0; p < maxPages; p++) {
    const res = await fetch('/api/portfolio/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, chain, cursor }),
    });
    if (!res.ok) break;
    const data = (await res.json()) as WalletHistoryResponse;
    all.push(...data.items);
    if (!data.nextCursor) break;
    cursor = data.nextCursor;
  }
  return all;
}

interface Row extends RelatedCandidate {
  chain: ChainId;
}

interface Props {
  walletAddress: string;
  chains: ChainId[];
}

export function WalletRelated({ walletAddress, chains }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const merged: Row[] = [];
      for (const chain of chains) {
        const targetHist = await fetchHistory(walletAddress, chain, TARGET_PAGES);
        const funders = deriveFunders(targetHist, walletAddress, MAX_FUNDERS);
        const funderEntries = await Promise.all(
          funders.map((f) =>
            fetchHistory(f, chain, FUNDER_PAGES)
              .then((h) => [f, h] as const)
              .catch(() => [f, [] as WalletTransaction[]] as const),
          ),
        );
        const cands = scoreRelated(
          walletAddress,
          targetHist,
          new Map(funderEntries),
        );
        for (const c of cands) merged.push({ ...c, chain });
      }
      merged.sort((a, b) => b.confidence - a.confidence);
      setRows(merged.slice(0, 15));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to find related wallets');
    } finally {
      setLoading(false);
    }
  }, [walletAddress, chains]);

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          <IconAffiliate className="h-4 w-4 text-violet-300/80" />
          Related wallets
          {rows && rows.length > 0 && (
            <span className="font-normal text-[var(--text-faint)]">· {rows.length}</span>
          )}
        </div>
        {rows !== null && (
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading}
            className="text-[var(--text-faint)] hover:text-[var(--text)] disabled:opacity-40"
            title="Re-run clustering"
          >
            <IconRefresh className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      <p className="mb-3 text-[11px] leading-snug text-[var(--text-faint)]">
        Wallets this one is connected to — who it transfers with, two-way
        relationships, and shared funding sources. A heuristic — verify before
        acting on it.
      </p>

      {error && (
        <div className="mb-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      {rows === null ? (
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-200 transition-colors hover:bg-violet-500/15 disabled:opacity-60"
        >
          {loading ? (
            <>
              <IconRefresh className="h-4 w-4 animate-spin" />
              Scanning funding history…
            </>
          ) : (
            <>
              <IconSearch className="h-4 w-4" />
              Find related wallets
            </>
          )}
        </button>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-[var(--surface)]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="py-4 text-center text-sm text-[var(--text-faint)]">
          No connected wallets found in recent history. This wallet may only
          interact with contracts (swaps, approvals) rather than other wallets.
        </div>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <RelatedRow key={`${r.chain}:${r.address}`} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function confidenceColor(c: number): string {
  if (c >= 60) return '#a78bfa';
  if (c >= 40) return '#c4b5fd';
  return '#ddd6fe';
}

function RelatedRow({ row: r }: { row: Row }) {
  const explorer = `${EXPLORER_ADDRESS[r.chain]}${r.address}`;
  return (
    <li className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--surface)]">
      <span
        title={CHAIN_NAME[r.chain]}
        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full"
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
          <span
            className="shrink-0 rounded px-1 py-px text-[9px] font-bold tabular-nums"
            style={{
              color: confidenceColor(r.confidence),
              background: `${confidenceColor(r.confidence)}22`,
            }}
            title="Heuristic confidence"
          >
            {r.confidence}%
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {r.signals.map((s) => (
            <span
              key={s}
              className="rounded bg-[var(--surface)] px-1.5 py-px text-[9px] text-[var(--text-faint)]"
            >
              {s}
            </span>
          ))}
          <a
            href={explorer}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 font-mono text-[9px] text-[var(--text-muted)] hover:text-[var(--text-muted)]"
          >
            {truncate(r.address)}
            <IconExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>

      <AddToGroupButton
        address={r.address}
        source="tx"
        chain={r.chain}
        context={{ direction: 'counterparty' }}
        title="Save related wallet to a group"
        className="mt-0.5 shrink-0 text-[var(--text-faint)] opacity-0 transition-opacity hover:text-orange-300 group-hover:opacity-100"
      />
    </li>
  );
}
