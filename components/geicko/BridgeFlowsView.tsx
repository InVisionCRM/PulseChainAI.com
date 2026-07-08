'use client';

import React, { useMemo, useState } from 'react';
import { IconArrowDownLeft, IconArrowUpRight, IconArrowsExchange } from '@tabler/icons-react';

export interface BridgeFlow {
  bridge: string;
  token: string;
  tokenAddress?: string;
  amount: number;
  usd: number;
  date: string;
  direction: 'in' | 'out';
  txHash: string | null;
}
export interface BridgeTotals {
  inflowUsd: number;
  outflowUsd: number;
  netUsd: number;
  inflowCount: number;
  outflowCount: number;
}

const usd = (v: number) =>
  `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const amt = (v: number) =>
  v.toLocaleString(undefined, { maximumFractionDigits: v >= 1 ? 2 : 6 });
const fmtDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Shared presentational view for bridge inflow/outflow, used by both the
 * token-level (geicko) and wallet-level (portfolio) bridge features. Its own
 * look: a single flow-balance panel with a proportion meter, directional
 * pills, and a card list — deliberately distinct from the reference tool.
 */
export function BridgeFlowsView({
  loading,
  totals,
  flows,
  emptyText = 'No bridge activity found.',
}: {
  loading: boolean;
  totals?: BridgeTotals;
  flows: BridgeFlow[];
  emptyText?: string;
}) {
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');

  const rows = useMemo(
    () => (filter === 'all' ? flows : flows.filter((f) => f.direction === filter)),
    [flows, filter],
  );

  if (loading && !totals) {
    return (
      <div className="grid h-40 place-items-center text-sm text-[var(--text-faint)]">
        <span className="inline-flex items-center gap-2">
          <IconArrowsExchange className="h-4 w-4 animate-pulse text-cyan-400" />
          Scanning bridge transfers…
        </span>
      </div>
    );
  }

  if (!totals || (totals.inflowCount === 0 && totals.outflowCount === 0)) {
    return (
      <div className="grid h-32 place-items-center rounded-2xl border border-dashed border-[var(--line)] text-center text-sm text-[var(--text-faint)]">
        {emptyText}
      </div>
    );
  }

  const inW = totals.inflowUsd;
  const outW = totals.outflowUsd;
  const denom = inW + outW || 1;
  const inPct = (inW / denom) * 100;
  const netPositive = totals.netUsd >= 0;

  return (
    <div className="space-y-4">
      {/* Flow-balance panel */}
      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-gradient-to-br from-emerald-500/[0.06] via-[var(--surface)] to-red-500/[0.06]">
        <div className="grid grid-cols-3 divide-x divide-[var(--line)]">
          <div className="p-4">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
              <IconArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" /> In
            </div>
            <div className="mt-1 text-lg font-bold text-emerald-400">{usd(inW)}</div>
            <div className="text-[11px] text-[var(--text-faint)]">{totals.inflowCount} txns</div>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
              <IconArrowUpRight className="h-3.5 w-3.5 text-red-400" /> Out
            </div>
            <div className="mt-1 text-lg font-bold text-red-400">{usd(outW)}</div>
            <div className="text-[11px] text-[var(--text-faint)]">{totals.outflowCount} txns</div>
          </div>
          <div className="p-4">
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">Net</div>
            <div className={`mt-1 text-lg font-bold ${netPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {netPositive ? '' : '−'}
              {usd(Math.abs(totals.netUsd))}
            </div>
            <div className="text-[11px] text-[var(--text-faint)]">
              {netPositive ? 'Net inflow' : 'Net outflow'}
            </div>
          </div>
        </div>
        {/* Proportion meter */}
        <div className="flex h-1.5 w-full">
          <div className="bg-emerald-500/70" style={{ width: `${inPct}%` }} />
          <div className="bg-red-500/70" style={{ width: `${100 - inPct}%` }} />
        </div>
      </div>

      {/* Segmented filter */}
      <div className="inline-flex rounded-full border border-[var(--line)] bg-[var(--surface)] p-0.5 text-xs">
        {([
          ['all', `All ${totals.inflowCount + totals.outflowCount}`],
          ['in', `In ${totals.inflowCount}`],
          ['out', `Out ${totals.outflowCount}`],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1 font-semibold transition-colors ${
              filter === k
                ? 'bg-cyan-500/15 text-cyan-300'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Card list */}
      <ul className="space-y-1.5">
        {rows.map((f, i) => {
          const inbound = f.direction === 'in';
          return (
            <li
              key={`${f.txHash ?? ''}-${i}`}
              className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5"
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                  inbound ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                }`}
              >
                {inbound ? <IconArrowDownLeft className="h-4 w-4" /> : <IconArrowUpRight className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-xs font-semibold text-[var(--text)]">
                    {f.token || '—'}
                  </span>
                  <span className="truncate text-xs text-[var(--text-faint)]">{f.bridge}</span>
                </div>
                <div className="mt-0.5 font-mono text-xs text-[var(--text-muted)]">{amt(f.amount)}</div>
              </div>
              <div className="text-right">
                <div className={`text-sm font-semibold ${inbound ? 'text-emerald-400' : 'text-red-400'}`}>
                  {inbound ? '+' : '−'}
                  {usd(f.usd)}
                </div>
                <div className="text-[11px] text-[var(--text-faint)]">{fmtDate(f.date)}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
