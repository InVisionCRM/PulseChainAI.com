'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

// "Buy / Sell Pressure" section for the Geicko token view: real directional USD
// from PulseX swaps (v1+v2), classified as buys vs sells of the token. Windows
// 1H/6H/24H plus an hourly stacked chart. Sourced from /api/geicko/pressure.

interface Win { buyUsd: number; sellUsd: number; buyCount: number; sellCount: number }
interface Hour { t: number; buy: number; sell: number }
interface PressResp {
  chain: string;
  supported?: boolean;
  empty?: boolean;
  pairCount?: number;
  windows?: { h1: Win; h6: Win; h24: Win };
  hourly?: Hour[];
  error?: string;
}
type WinKey = 'h1' | 'h6' | 'h24';

const fmtUsd = (v: number) => {
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}K`;
  return `${s}$${a.toFixed(0)}`;
};
const fmtHour = (ts: number) => new Date(ts * 1000).toLocaleTimeString(undefined, { hour: 'numeric' });

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${active ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
    >
      {children}
    </button>
  );
}

function HourlyTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as Hour;
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-[11px] shadow-lg">
      <div className="text-[var(--text-muted)]">{new Date(d.t * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric' })}</div>
      <div className="text-[var(--up)]">Buys {fmtUsd(d.buy)}</div>
      <div className="text-red-400">Sells {fmtUsd(d.sell)}</div>
    </div>
  );
}

export default function GeickoPressurePanel({
  network, token,
}: { network?: string | null; token?: string | null }) {
  const [data, setData] = useState<PressResp | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');
  const [win, setWin] = useState<WinKey>('h24');

  useEffect(() => {
    if (!token) { setStatus('idle'); return; }
    let alive = true;
    setStatus('loading');
    const qs = new URLSearchParams();
    if (network) qs.set('network', network);
    qs.set('token', token);
    fetch(`/api/geicko/pressure?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: PressResp) => {
        if (!alive) return;
        if (d.error || d.supported === false) { setStatus('error'); return; }
        if (d.empty || !d.windows) { setStatus('empty'); return; }
        setData(d);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => { alive = false; };
  }, [network, token]);

  const w = data?.windows?.[win];
  const chartData = useMemo(
    () => (data?.hourly ?? []).map((h) => ({ t: h.t, buy: h.buy, sell: -h.sell })),
    [data],
  );

  // Hide entirely when a token has no recent swaps.
  if (status === 'idle' || status === 'empty' || status === 'error') return null;

  const buy = w?.buyUsd ?? 0;
  const sell = w?.sellUsd ?? 0;
  const totalUsd = buy + sell;
  const buyPct = totalUsd > 0 ? (buy / totalUsd) * 100 : 50;
  const net = buy - sell;

  return (
    <div className="mb-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Buy / Sell Pressure</h3>
          {status === 'ready' && (
            <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5">
              <Tab active={win === 'h1'} onClick={() => setWin('h1')}>1H</Tab>
              <Tab active={win === 'h6'} onClick={() => setWin('h6')}>6H</Tab>
              <Tab active={win === 'h24'} onClick={() => setWin('h24')}>24H</Tab>
            </div>
          )}
        </div>
        {status === 'ready' && data?.pairCount ? (
          <span className="text-[10px] tabular-nums text-[var(--text-faint)]">{data.pairCount} pairs</span>
        ) : null}
      </div>

      {status === 'loading' && (
        <div className="py-6 text-center text-xs text-[var(--text-muted)]">Loading trade flow…</div>
      )}

      {status === 'ready' && w && (
        <>
          {/* Pressure bar */}
          <div className="mb-1 flex h-3 w-full overflow-hidden rounded-full border border-[var(--line)]">
            <div className="h-full bg-[var(--up)]" style={{ width: `${buyPct}%` }} />
            <div className="h-full bg-red-400" style={{ width: `${100 - buyPct}%` }} />
          </div>
          <div className="mb-2 flex items-center justify-between text-[11px] tabular-nums">
            <span className="font-semibold text-[var(--up)]">{buyPct.toFixed(0)}% buy</span>
            <span className={`font-semibold ${net >= 0 ? 'text-[var(--up)]' : 'text-red-400'}`}>net {fmtUsd(net)}</span>
            <span className="font-semibold text-red-400">{(100 - buyPct).toFixed(0)}% sell</span>
          </div>

          <div className="mb-2 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-gradient-to-br from-white/5 via-emerald-500/5 to-white/5 border border-[var(--line)] p-2 text-center">
              <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Buys ({w.buyCount})</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-[var(--up)]">{fmtUsd(buy)}</div>
            </div>
            <div className="rounded-lg bg-gradient-to-br from-white/5 via-rose-500/5 to-white/5 border border-[var(--line)] p-2 text-center">
              <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Sells ({w.sellCount})</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-red-400">{fmtUsd(sell)}</div>
            </div>
          </div>

          <div className="h-24 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 2, bottom: 0, left: 2 }} barCategoryGap={1} stackOffset="sign">
                <XAxis dataKey="t" tickFormatter={fmtHour} tick={{ fontSize: 9, fill: 'var(--text-faint)' }}
                  axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis hide domain={['dataMin', 'dataMax']} />
                <ReferenceLine y={0} stroke="var(--line)" strokeWidth={1} />
                <Tooltip content={<HourlyTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="buy" stackId="s" fill="var(--up)" radius={[1, 1, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="sell" stackId="s" fill="#f87171" radius={[0, 0, 1, 1]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-0.5 text-center text-[9px] uppercase tracking-wider text-[var(--text-faint)]">
            Hourly buy (green) vs sell (red) volume · last 24h
          </div>
        </>
      )}
    </div>
  );
}
