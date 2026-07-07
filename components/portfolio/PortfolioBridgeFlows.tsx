'use client';

import React, { useEffect, useMemo, useState } from 'react';

export interface PortfolioBridgeFlowsProps {
  /** Wallet addresses to aggregate bridge flows across. */
  wallets: string[];
  /** When true, render bare (no outer card/title) for use inside a wallet tab. */
  embedded?: boolean;
}

interface Flow {
  bridge: string;
  token: string;
  tokenAddress: string;
  amount: number;
  usd: number;
  date: string;
  direction: 'in' | 'out';
  txHash: string | null;
  wallet?: string;
}
interface WalletBridge {
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
const fmtAmount = (v: number) =>
  v.toLocaleString(undefined, { maximumFractionDigits: v >= 1 ? 2 : 6 });
const fmtDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

export function PortfolioBridgeFlows({ wallets, embedded }: PortfolioBridgeFlowsProps) {
  const [data, setData] = useState<WalletBridge | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');

  const key = useMemo(
    () => wallets.map((w) => w.toLowerCase()).sort().join(','),
    [wallets],
  );

  useEffect(() => {
    if (!key) {
      setData(null);
      return;
    }
    let alive = true;
    setLoading(true);
    const addrs = key.split(',');
    Promise.all(
      addrs.map((w) =>
        fetch(`/api/portfolio/bridge?wallet=${w}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d: WalletBridge | null) =>
            d ? d.flows.map((f) => ({ ...f, wallet: w })) : [],
          )
          .catch(() => [] as Flow[]),
      ),
    )
      .then((lists) => {
        if (!alive) return;
        const flows = lists.flat().sort((a, b) => (a.date < b.date ? 1 : -1));
        const inflow = flows.filter((f) => f.direction === 'in');
        const outflow = flows.filter((f) => f.direction === 'out');
        const sum = (arr: Flow[]) => arr.reduce((s, f) => s + f.usd, 0);
        setData({
          totals: {
            inflowUsd: sum(inflow),
            outflowUsd: sum(outflow),
            netUsd: sum(inflow) - sum(outflow),
            inflowCount: inflow.length,
            outflowCount: outflow.length,
          },
          flows,
        });
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [key]);

  const rows = useMemo(() => {
    const flows = data?.flows ?? [];
    return filter === 'all' ? flows : flows.filter((f) => f.direction === filter);
  }, [data, filter]);

  if (wallets.length === 0) return null;

  const t = data?.totals;
  const empty = !t || (t.inflowCount === 0 && t.outflowCount === 0);

  return (
    <div
      className={
        embedded
          ? 'space-y-4'
          : 'rounded-2xl border border-[var(--line)] bg-[var(--surface)] backdrop-blur-xl p-5 space-y-4'
      }
    >
      {!embedded && (
        <h2 className="text-lg font-semibold text-[var(--text)]">Bridge Inflows &amp; Outflows</h2>
      )}

      {loading && !data ? (
        <div className="grid h-32 place-items-center text-sm text-[var(--text-faint)]">Loading…</div>
      ) : empty ? (
        <div className="grid h-28 place-items-center text-center text-sm text-[var(--text-faint)]">
          No bridge activity found for this wallet.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-[var(--line)] bg-white/[0.02] p-4">
              <div className="text-sm text-[var(--text-muted)]">Total Inflows</div>
              <div className="text-2xl font-bold text-emerald-400">{usd(t!.inflowUsd)}</div>
              <div className="text-xs text-[var(--text-faint)]">{t!.inflowCount} transactions</div>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-white/[0.02] p-4">
              <div className="text-sm text-[var(--text-muted)]">Total Outflows</div>
              <div className="text-2xl font-bold text-red-400">{usd(t!.outflowUsd)}</div>
              <div className="text-xs text-[var(--text-faint)]">{t!.outflowCount} transactions</div>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-white/[0.02] p-4">
              <div className="text-sm text-[var(--text-muted)]">Net Flow</div>
              <div className={`text-2xl font-bold ${t!.netUsd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {t!.netUsd < 0 ? '-' : ''}$
                {Math.abs(t!.netUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-[var(--text-faint)]">
                {t!.netUsd >= 0 ? 'Net Inflow' : 'Net Outflow'}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {([
              ['all', `All (${t!.inflowCount + t!.outflowCount})`],
              ['in', `Inflows (${t!.inflowCount})`],
              ['out', `Outflows (${t!.outflowCount})`],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  filter === k
                    ? 'border-[var(--line)] bg-white/[0.06] text-[var(--text)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

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
                    <td className="px-2 py-2 text-right font-mono text-[var(--text-muted)]">
                      {fmtAmount(f.amount)}
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
