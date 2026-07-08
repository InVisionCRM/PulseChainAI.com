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

// Deterministic per-token coin colour, so each token reads as a distinct coin
// without maintaining a brand-colour map.
const coinHue = (s: string) => {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
};
const coinStyle = (sym: string): React.CSSProperties => {
  const h = coinHue(sym || '?');
  return { background: `linear-gradient(150deg, hsl(${h} 58% 42%), hsl(${h} 62% 56%))` };
};
const disc = (sym: string) => (sym ? sym.slice(0, 4).toUpperCase() : '?');

/**
 * Shared presentational view for bridge inflow/outflow, used by both the
 * token-level (geicko) and wallet-level (portfolio) bridge features: a summary
 * card (In / Out split + proportion meter + Net pill), a segmented filter, and
 * an aligned transaction list with per-token coins and direction badges.
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
  const inPct = inW + outW > 0 ? (inW / (inW + outW)) * 100 : 0;
  const netPositive = totals.netUsd >= 0;

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="rounded-2xl border border-[var(--line)] bg-gradient-to-b from-white/[0.025] to-transparent p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Inflow
            </span>
            <span className="text-[22px] font-bold leading-none tabular-nums text-emerald-400">
              {usd(inW)}
            </span>
            <span className="text-[11px] text-[var(--text-faint)] tabular-nums">
              {totals.inflowCount} {totals.inflowCount === 1 ? 'transaction' : 'transactions'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> Outflow
            </span>
            <span className="text-[22px] font-bold leading-none tabular-nums text-rose-400">
              {usd(outW)}
            </span>
            <span className="text-[11px] text-[var(--text-faint)] tabular-nums">
              {totals.outflowCount} {totals.outflowCount === 1 ? 'transaction' : 'transactions'}
            </span>
          </div>
        </div>

        {/* Proportion meter */}
        <div className="mt-3.5 flex h-2 overflow-hidden rounded-full border border-[var(--line)] bg-[var(--panel)]">
          <i className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${inPct}%` }} />
          <i className="h-full bg-gradient-to-r from-rose-400 to-rose-500" style={{ width: `${100 - inPct}%` }} />
        </div>

        {/* Net */}
        <div className="mt-3.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            Net flow
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold tabular-nums ${
              netPositive
                ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-400'
                : 'border-rose-400/35 bg-rose-500/10 text-rose-400'
            }`}
          >
            {netPositive ? (
              <IconArrowDownLeft className="h-3.5 w-3.5" />
            ) : (
              <IconArrowUpRight className="h-3.5 w-3.5" />
            )}
            {netPositive ? '+' : '−'}
            {usd(Math.abs(totals.netUsd))} · Net {netPositive ? 'inflow' : 'outflow'}
          </span>
        </div>
      </div>

      {/* Segmented filter */}
      <div className="inline-flex gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1">
        {([
          ['all', 'All', totals.inflowCount + totals.outflowCount],
          ['in', 'In', totals.inflowCount],
          ['out', 'Out', totals.outflowCount],
        ] as const).map(([k, label, count]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filter === k
                ? 'bg-cyan-500/15 text-[var(--text)] shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {label} <span className="text-[var(--text-faint)]">{count}</span>
          </button>
        ))}
      </div>

      {/* Transaction list */}
      <ul>
        {rows.map((f, i) => {
          const inbound = f.direction === 'in';
          return (
            <li
              key={`${f.txHash ?? ''}-${i}`}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border-t border-[var(--line)] px-2 py-2.5 transition-colors first:border-t-0 hover:bg-[var(--surface)]"
            >
              <div className="relative h-9 w-9">
                <span
                  className="grid h-9 w-9 place-items-center rounded-full text-[10px] font-bold text-white ring-1 ring-white/15"
                  style={coinStyle(f.token)}
                >
                  {disc(f.token)}
                </span>
                <span
                  className={`absolute -bottom-1 -right-1 grid h-[17px] w-[17px] place-items-center rounded-full border-2 border-[var(--panel)] ${
                    inbound ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {inbound ? (
                    <IconArrowDownLeft className="h-2.5 w-2.5" />
                  ) : (
                    <IconArrowUpRight className="h-2.5 w-2.5" />
                  )}
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-[var(--text)]">{f.token || '—'}</span>
                  <span className="truncate text-xs text-[var(--text-faint)]">{f.bridge}</span>
                </div>
                <div className="mt-0.5 text-xs text-[var(--text-muted)] tabular-nums">{amt(f.amount)}</div>
              </div>

              <div className="text-right">
                <div
                  className={`text-sm font-semibold tabular-nums ${inbound ? 'text-emerald-400' : 'text-rose-400'}`}
                >
                  {inbound ? '+' : '−'}
                  {usd(f.usd)}
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--text-faint)] tabular-nums">
                  {fmtDate(f.date)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
