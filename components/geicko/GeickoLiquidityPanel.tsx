'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// "Liquidity Flow" section for the Geicko token view: liquidity adds (mints) vs
// removes (burns) across a token's PulseX pairs — a daily net-flow chart plus a
// recent-events feed. Sourced from /api/geicko/liquidity (PulseX subgraph).
// Removals leading adds is a leading indicator you won't see on a price chart.

interface Daily { t: number; added: number; removed: number; net: number }
interface Evt { type: 'add' | 'remove'; ts: number; usd: number; pair: string; wallet: string; tx: string }
interface LiqResp {
  chain: string;
  supported?: boolean;
  empty?: boolean;
  pairCount?: number;
  window?: { fromTs: number; toTs: number; days: number };
  totals?: { added: number; removed: number; net: number; addCount: number; removeCount: number };
  daily?: Daily[];
  events?: Evt[];
  error?: string;
}

const CHART_DAYS = 120; // most-recent days shown in the bar chart

const fmtUsd = (v: number) => {
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}K`;
  return `${s}$${a.toFixed(0)}`;
};
const fmtDay = (ts: number) => new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const shortAddr = (a: string) => (a && a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || '—');
const ago = (ts: number) => {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

function SummaryChip({ label, value, tone }: { label: string; value: string; tone: 'up' | 'down' | 'net'; }) {
  const cls = tone === 'up' ? 'text-[var(--up)]' : tone === 'down' ? 'text-red-400' : 'text-[var(--text)]';
  return (
    <div className="rounded-lg bg-gradient-to-br from-white/5 via-emerald-500/5 to-white/5 border border-[var(--line)] p-2 text-center">
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className={`mt-0.5 text-sm font-bold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

function FlowTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as Daily;
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-[11px] shadow-lg">
      <div className="text-[var(--text-muted)]">{fmtDay(d.t)}</div>
      <div className="text-[var(--up)]">Added {fmtUsd(d.added)}</div>
      <div className="text-red-400">Removed {fmtUsd(-d.removed)}</div>
      <div className={`font-semibold ${d.net >= 0 ? 'text-[var(--up)]' : 'text-red-400'}`}>Net {fmtUsd(d.net)}</div>
    </div>
  );
}

export default function GeickoLiquidityPanel({
  network, token,
}: { network?: string | null; token?: string | null }) {
  const [data, setData] = useState<LiqResp | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');

  useEffect(() => {
    if (!token) { setStatus('idle'); return; }
    let alive = true;
    setStatus('loading');
    const qs = new URLSearchParams();
    if (network) qs.set('network', network);
    qs.set('token', token);
    fetch(`/api/geicko/liquidity?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: LiqResp) => {
        if (!alive) return;
        if (d.error || d.supported === false) { setStatus('error'); return; }
        if (d.empty || !d.daily?.length) { setData(d); setStatus('empty'); return; }
        setData(d);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => { alive = false; };
  }, [network, token]);

  const chartData = useMemo(() => (data?.daily ? data.daily.slice(-CHART_DAYS) : []), [data]);

  // Keep the panel out of the layout entirely when there's nothing to show —
  // many tokens have no meaningful liquidity events, and an empty box is noise.
  if (status === 'idle' || status === 'empty' || status === 'error') return null;

  return (
    <div className="mb-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Liquidity Flow</h3>
        {status === 'ready' && data?.window && (
          <span className="text-[10px] tabular-nums text-[var(--text-faint)]">
            {data.window.days > 0 ? `last ${data.window.days}d` : 'recent'}
            {data.pairCount ? ` · ${data.pairCount} pair${data.pairCount === 1 ? '' : 's'}` : ''}
          </span>
        )}
      </div>

      {status === 'loading' && (
        <div className="py-6 text-center text-xs text-[var(--text-muted)]">Loading liquidity activity…</div>
      )}

      {status === 'ready' && data?.totals && (
        <>
          <div className="mb-2 grid grid-cols-3 gap-2">
            <SummaryChip label={`Added (${data.totals.addCount})`} value={fmtUsd(data.totals.added)} tone="up" />
            <SummaryChip label={`Removed (${data.totals.removeCount})`} value={fmtUsd(-data.totals.removed)} tone="down" />
            <SummaryChip label="Net" value={fmtUsd(data.totals.net)} tone="net" />
          </div>

          <div className="h-28 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 2, bottom: 0, left: 2 }} barCategoryGap={1}>
                <XAxis dataKey="t" tickFormatter={fmtDay} tick={{ fontSize: 9, fill: 'var(--text-faint)' }}
                  axisLine={false} tickLine={false} minTickGap={40} />
                <YAxis hide domain={['dataMin', 'dataMax']} />
                <ReferenceLine y={0} stroke="var(--line)" strokeWidth={1} />
                <Tooltip content={<FlowTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="net" radius={[1, 1, 0, 0]} isAnimationActive={false}>
                  {chartData.map((d) => (
                    <Cell key={d.t} fill={d.net >= 0 ? 'var(--up)' : '#f87171'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-0.5 text-center text-[9px] uppercase tracking-wider text-[var(--text-faint)]">
            Daily net liquidity (added − removed){data.daily && data.daily.length > CHART_DAYS ? ` · last ${CHART_DAYS} days` : ''}
          </div>

          {!!data.events?.length && (
            <div className="mt-2 border-t border-[var(--line)] pt-2">
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Recent events</div>
              <div className="max-h-44 space-y-0.5 overflow-y-auto pr-1">
                {data.events.map((e, i) => (
                  <a
                    key={`${e.tx}-${i}`}
                    href={`https://scan.pulsechain.com/tx/${e.tx}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded px-1 py-0.5 text-[11px] hover:bg-white/5"
                  >
                    <span className={`w-4 shrink-0 text-center font-bold ${e.type === 'add' ? 'text-[var(--up)]' : 'text-red-400'}`}>
                      {e.type === 'add' ? '＋' : '－'}
                    </span>
                    <span className={`w-16 shrink-0 tabular-nums font-semibold ${e.type === 'add' ? 'text-[var(--up)]' : 'text-red-400'}`}>
                      {fmtUsd(e.type === 'add' ? e.usd : -e.usd)}
                    </span>
                    <span className="shrink-0 truncate text-[var(--text-muted)]" style={{ maxWidth: '7rem' }}>{e.pair}</span>
                    <span className="hidden shrink-0 font-mono text-[var(--text-faint)] sm:inline">{shortAddr(e.wallet)}</span>
                    <span className="ml-auto shrink-0 tabular-nums text-[var(--text-faint)]">{ago(e.ts)}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
