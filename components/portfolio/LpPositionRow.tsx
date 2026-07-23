'use client';

// Per-position LP analytics row, shown under the "Pool TVL · Your share" line in
// the portfolio LP section. Fees earned (isolated from impermanent loss) + net
// P&L since the wallet first provided, plus supporting detail. PulseChain only —
// data comes from /api/portfolio/lp-position (PulseX subgraph). Renders nothing
// until it has a real position history, so non-PulseChain or transfer-only LPs
// simply don't add a row.

import React, { useEffect, useState } from 'react';

interface LpPosition {
  supported: boolean;
  hasHistory?: boolean;
  partialHistory?: boolean;
  feesUsd?: number;
  netPnlUsd?: number;
  depositedUsd?: number;
  withdrawnUsd?: number;
  currentValueUsd?: number;
  addCount?: number;
  removeCount?: number;
  firstProvided?: number;
  daysProviding?: number;
  feeApr?: number | null;
}

const fmtUsd = (v: number | undefined): string => {
  if (v == null || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}K`;
  if (a >= 1) return `${s}$${a.toFixed(2)}`;
  return `${s}$${a.toFixed(4)}`;
};
const fmtDur = (days: number | undefined): string => {
  if (days == null || !Number.isFinite(days)) return '—';
  if (days < 1) return '<1d';
  if (days < 60) return `${Math.round(days)}d`;
  if (days < 730) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
};
const fmtDate = (ts: number | undefined): string =>
  ts ? new Date(ts * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  const cls = tone === 'up' ? 'text-[var(--up)]' : tone === 'down' ? 'text-red-400' : 'text-[var(--text)]';
  return (
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-wider text-cyan-200/50">{label}</div>
      <div className={`text-[11px] font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

export default function LpPositionRow({
  pair, wallet, chain, balance,
}: { pair: string; wallet: string; chain: string; balance: number }) {
  const [data, setData] = useState<LpPosition | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'empty'>('idle');

  useEffect(() => {
    if (chain !== 'pulsechain' || !pair || !wallet) { setStatus('empty'); return; }
    let alive = true;
    setStatus('loading');
    const qs = new URLSearchParams({ chain, pair, wallet, balance: String(balance) });
    fetch(`/api/portfolio/lp-position?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: LpPosition) => {
        if (!alive) return;
        if (!d.supported || !d.hasHistory) { setStatus('empty'); return; }
        setData(d);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('empty'));
    return () => { alive = false; };
  }, [pair, wallet, chain, balance]);

  // Nothing to add for non-PulseChain LPs, transfer-only positions, or failures.
  if (status === 'idle' || status === 'empty') return null;

  return (
    <tr className="border-b border-[var(--line-soft)] bg-cyan-500/5">
      <td />
      <td colSpan={5} className="px-2 pb-2 pt-0.5">
        {status === 'loading' ? (
          <div className="py-1 text-[10px] text-cyan-200/50">Calculating fees & P&amp;L…</div>
        ) : data ? (
          <div className="rounded-md border border-cyan-500/20 bg-cyan-500/[0.04] px-2.5 py-2">
            {/* Headline: fees earned + net P&L */}
            <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-cyan-200/60">Fees earned <span className="opacity-60">(est.)</span></div>
                <div className="text-sm font-bold tabular-nums text-[var(--up)]">{fmtUsd(data.feesUsd)}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-cyan-200/60">Net P&amp;L</div>
                <div className={`text-sm font-bold tabular-nums ${(data.netPnlUsd ?? 0) >= 0 ? 'text-[var(--up)]' : 'text-red-400'}`}>
                  {(data.netPnlUsd ?? 0) >= 0 ? '+' : ''}{fmtUsd(data.netPnlUsd)}
                </div>
              </div>
              {data.feeApr != null && (
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-cyan-200/60">Fee APR</div>
                  <div className="text-sm font-bold tabular-nums text-[var(--text)]">{data.feeApr.toFixed(2)}%</div>
                </div>
              )}
            </div>

            {/* Supporting detail */}
            <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1.5 border-t border-cyan-500/15 pt-2 sm:grid-cols-6">
              <Stat label="Deposited" value={fmtUsd(data.depositedUsd)} />
              <Stat label="Withdrawn" value={fmtUsd(data.withdrawnUsd)} />
              <Stat label="Current" value={fmtUsd(data.currentValueUsd)} />
              <Stat label="Providing for" value={fmtDur(data.daysProviding)} />
              <Stat label="Since" value={fmtDate(data.firstProvided)} />
              <Stat label="Adds / Removes" value={`${data.addCount ?? 0} / ${data.removeCount ?? 0}`} />
            </div>

            <div className="mt-1.5 text-[9px] leading-snug text-cyan-200/40">
              Fees isolated from price movement via pool-reserve growth; net P&amp;L includes impermanent loss. Estimated from PulseX subgraph history.
              {data.partialHistory && (
                <span className="text-amber-300/70"> · Partial history — some LP tokens were transferred in/out, so figures may be understated.</span>
              )}
            </div>
          </div>
        ) : null}
      </td>
    </tr>
  );
}
