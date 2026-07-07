import React, { useEffect, useMemo, useState } from 'react';
import { formatAbbrev } from './utils';

export interface GeickoBridgeFlowsTabProps {
  token: string;
  /** Spot price in USD, used to value each transfer. */
  priceUsd: string | number | null | undefined;
}

interface Flow {
  bridge: string;
  token: string;
  amount: number;
  usd: number;
  date: string;
  direction: 'in' | 'out';
  txHash: string | null;
}
interface BridgeData {
  totals: {
    inflowUsd: number;
    outflowUsd: number;
    netUsd: number;
    inflowCount: number;
    outflowCount: number;
  };
  flows: Flow[];
}

const usd = (v: number) =>
  `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

export default function GeickoBridgeFlowsTab({ token, priceUsd }: GeickoBridgeFlowsTabProps) {
  const [data, setData] = useState<BridgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setLoading(true);
    const qs = new URLSearchParams({ token });
    const p = Number(priceUsd ?? 0);
    if (p > 0) qs.set('price', p.toPrecision(8));
    fetch(`/api/geicko/bridge?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [token, priceUsd]);

  const rows = useMemo(() => {
    const flows = data?.flows ?? [];
    if (filter === 'all') return flows;
    return flows.filter((f) => f.direction === filter);
  }, [data, filter]);

  const t = data?.totals;

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-4">
      <h3 className="text-base font-semibold text-[var(--text)]">Bridge Inflows &amp; Outflows</h3>

      {loading ? (
        <div className="grid h-40 place-items-center text-sm text-[var(--text-faint)]">Loading…</div>
      ) : !t || (t.inflowCount === 0 && t.outflowCount === 0) ? (
        <div className="grid h-40 place-items-center text-sm text-[var(--text-faint)]">
          No bridge activity found for this token.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="space-y-3">
            <div className="rounded-lg border border-[var(--line)] bg-white/[0.02] p-4">
              <div className="text-sm text-[var(--text-muted)]">Total Inflows</div>
              <div className="text-2xl font-bold text-emerald-400">{usd(t.inflowUsd)}</div>
              <div className="text-xs text-[var(--text-faint)]">{t.inflowCount} transactions</div>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-white/[0.02] p-4">
              <div className="text-sm text-[var(--text-muted)]">Total Outflows</div>
              <div className="text-2xl font-bold text-red-400">{usd(t.outflowUsd)}</div>
              <div className="text-xs text-[var(--text-faint)]">{t.outflowCount} transactions</div>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-white/[0.02] p-4">
              <div className="text-sm text-[var(--text-muted)]">Net Flow</div>
              <div className={`text-2xl font-bold ${t.netUsd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {t.netUsd < 0 ? '-' : ''}${Math.abs(t.netUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-[var(--text-faint)]">
                {t.netUsd >= 0 ? 'Net Inflow' : 'Net Outflow'}
              </div>
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex gap-2">
            {([
              ['all', `All (${t.inflowCount + t.outflowCount})`],
              ['in', `Inflows (${t.inflowCount})`],
              ['out', `Outflows (${t.outflowCount})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  filter === key
                    ? 'border-[var(--line)] bg-white/[0.06] text-[var(--text)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Detail table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--text-faint)] border-b border-[var(--line)]">
                  <th className="px-2 py-2 font-semibold">Bridge</th>
                  <th className="px-2 py-2 font-semibold">Token</th>
                  <th className="px-2 py-2 font-semibold text-right">Amount</th>
                  <th className="px-2 py-2 font-semibold text-right">USD Value</th>
                  <th className="px-2 py-2 font-semibold text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f, i) => (
                  <tr key={`${f.txHash ?? ''}-${i}`} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-2 py-2 text-[var(--text-muted)]">{f.bridge}</td>
                    <td className="px-2 py-2 text-[var(--text)]">{f.token || '—'}</td>
                    <td className="px-2 py-2 text-right text-[var(--text-muted)] font-mono">
                      {formatAbbrev(f.amount)}
                    </td>
                    <td className={`px-2 py-2 text-right font-semibold ${f.direction === 'in' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {usd(f.usd)}
                    </td>
                    <td className="px-2 py-2 text-right text-[var(--text-faint)] whitespace-nowrap">
                      {fmtDate(f.date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
