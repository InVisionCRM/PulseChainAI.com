'use client';

import React, { useEffect, useState } from 'react';

// "Price Performance" section for the Geicko token view: 7d/30d/1y change,
// all-time high/low, and since-launch — sourced from /api/geicko/performance
// (PulseX subgraph daily history for PulseChain, GeckoTerminal elsewhere).

interface PerfData {
  chain: string;
  coverage: 'full' | 'partial';
  current: number;
  changes: { d7: number | null; d30: number | null; d365: number | null };
  ath: { price: number; date: number; fromPct: number | null };
  atl: { price: number; date: number; fromPct: number | null };
  launch: { price: number; date: number; pct: number | null };
  spark: number[];
  dataDays: number;
}

const fmtPct = (v?: number | null) => (v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);
const fmtPrice = (v: number) => (v > 0 ? `$${v.toLocaleString('en-US', { maximumSignificantDigits: 4 })}` : '—');
const fmtDate = (ts: number) => new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const clsOf = (v?: number | null) => (v == null ? 'text-[var(--text-muted)]' : v >= 0 ? 'text-[var(--up)]' : 'text-red-400');

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  if (!data || data.length < 2) return null;
  const w = 100, h = 30;
  const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / rng) * h}`).join(' ');
  const color = up ? 'var(--up)' : '#f87171';
  const gid = `pg-${up ? 'u' : 'd'}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-9" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function ChangeChip({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 border border-[var(--line)] p-2 text-center">
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className={`mt-0.5 text-sm font-bold tabular-nums ${clsOf(value)}`}>
        {value != null && value >= 0 ? '▲ ' : value != null ? '▼ ' : ''}{fmtPct(value)}
      </div>
    </div>
  );
}

function ExtremeCard({ label, price, date, pct }: { label: string; price: number; date: number; pct: number | null }) {
  return (
    <div className="rounded-lg bg-gradient-to-br from-white/5 via-purple-500/5 to-white/5 border border-[var(--line)] p-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className={`mt-0.5 text-sm font-bold tabular-nums ${clsOf(pct)}`}>{fmtPct(pct)}</div>
      <div className="mt-0.5 text-[11px] tabular-nums text-[var(--text)]">{fmtPrice(price)}</div>
      <div className="text-[10px] tabular-nums text-[var(--text-faint)]">{fmtDate(date)}</div>
    </div>
  );
}

export default function GeickoPerformancePanel({
  network, token, pool, price,
}: { network?: string | null; token?: string | null; pool?: string | null; price?: number }) {
  const [data, setData] = useState<PerfData | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    if (!token && !pool) { setStatus('idle'); return; }
    let alive = true;
    setStatus('loading');
    const qs = new URLSearchParams();
    if (network) qs.set('network', network);
    if (token) qs.set('token', token);
    if (pool) qs.set('pool', pool);
    if (price && price > 0) qs.set('price', String(price));
    fetch(`/api/geicko/performance?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: PerfData & { error?: string }) => {
        if (!alive) return;
        if (d.error) { setStatus('error'); return; }
        setData(d);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => { alive = false; };
  }, [network, token, pool, price]);

  if (status === 'idle') return null;

  const full = data?.coverage === 'full';
  const up = data ? (data.launch.pct ?? 0) >= 0 : true;

  return (
    <div className="mb-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Price Performance</h3>
        {status === 'ready' && data && (
          <span className="text-[10px] tabular-nums text-[var(--text-faint)]">
            {full ? `on-chain history since ${fmtDate(data.launch.date)}` : 'last ~6 months'}
          </span>
        )}
      </div>

      {status === 'loading' && (
        <div className="py-6 text-center text-xs text-[var(--text-muted)]">Loading price history…</div>
      )}
      {status === 'error' && (
        <div className="py-6 text-center text-xs text-[var(--text-muted)]">Price history isn’t available for this token yet.</div>
      )}

      {status === 'ready' && data && (
        <>
          <div className="mb-2 grid grid-cols-3 gap-2">
            <ChangeChip label="7D" value={data.changes.d7} />
            <ChangeChip label="30D" value={data.changes.d30} />
            <ChangeChip label="1Y" value={data.changes.d365} />
          </div>

          <Sparkline data={data.spark} up={up} />

          <div className="mt-2 grid grid-cols-3 gap-2">
            <ExtremeCard label={full ? 'All-time high' : '6-mo high'} price={data.ath.price} date={data.ath.date} pct={data.ath.fromPct} />
            <ExtremeCard label={full ? 'All-time low' : '6-mo low'} price={data.atl.price} date={data.atl.date} pct={data.atl.fromPct} />
            <ExtremeCard label={full ? 'Since launch' : `Since ${fmtDate(data.launch.date)}`} price={data.launch.price} date={data.launch.date} pct={data.launch.pct} />
          </div>
        </>
      )}
    </div>
  );
}
