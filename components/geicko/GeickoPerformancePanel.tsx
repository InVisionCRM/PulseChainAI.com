'use client';

import React, { useEffect, useRef, useState } from 'react';

// "Price Performance" section for the Geicko token view: 7d/30d/1y change,
// all-time high/low, and since-launch — in USD or priced vs WPLS. Sourced from
// /api/geicko/performance (PulseX subgraph daily history for PulseChain,
// GeckoTerminal elsewhere).

interface View {
  coverage: 'full' | 'partial';
  current: number;
  changes: { d7: number | null; d30: number | null; d365: number | null };
  ath: { price: number; date: number; fromPct: number | null };
  atl: { price: number; date: number; fromPct: number | null };
  launch: { price: number; date: number; pct: number | null };
  spark: number[];
  dataDays: number;
}
interface PerfResp {
  chain: string;
  views: { usd: View; wpls: View | null };
}
type Denom = 'usd' | 'wpls';

const fmtPct = (v?: number | null) => (v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);
const fmtPrice = (v: number, denom: Denom) => {
  if (!(v > 0)) return '—';
  const n = v.toLocaleString('en-US', { maximumSignificantDigits: 4 });
  return denom === 'wpls' ? `${n} WPLS` : `$${n}`;
};
const fmtDate = (ts: number) => new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const clsOf = (v?: number | null) => (v == null ? 'text-[var(--text-muted)]' : v >= 0 ? 'text-[var(--up)]' : 'text-red-400');

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

function ExtremeCard({ label, price, date, pct, denom }: { label: string; price: number; date: number; pct: number | null; denom: Denom }) {
  return (
    <div className="rounded-lg bg-gradient-to-br from-white/5 via-purple-500/5 to-white/5 border border-[var(--line)] p-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className={`mt-0.5 text-sm font-bold tabular-nums ${clsOf(pct)}`}>{fmtPct(pct)}</div>
      <div className="mt-0.5 text-[11px] tabular-nums text-[var(--text)]">{fmtPrice(price, denom)}</div>
      <div className="text-[10px] tabular-nums text-[var(--text-faint)]">{fmtDate(date)}</div>
    </div>
  );
}

// Compact variant of ExtremeCard — a single row (label/date left, %/price right)
// so the three extremes stack readably in the narrow right-hand stats rail
// instead of being squeezed into three columns.
function ExtremeRow({ label, price, date, pct, denom }: { label: string; price: number; date: number; pct: number | null; denom: Denom }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-gradient-to-br from-white/5 via-purple-500/5 to-white/5 border border-[var(--line)] px-2 py-1.5">
      <div className="min-w-0">
        <div className="truncate text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
        <div className="text-[10px] tabular-nums text-[var(--text-faint)]">{fmtDate(date)}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className={`text-xs font-bold tabular-nums ${clsOf(pct)}`}>{fmtPct(pct)}</div>
        <div className="text-[10px] tabular-nums text-[var(--text)]">{fmtPrice(price, denom)}</div>
      </div>
    </div>
  );
}

function DenomTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${active ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
    >
      {children}
    </button>
  );
}

export default function GeickoPerformancePanel({
  network, token, pool, price, compact = false,
}: { network?: string | null; token?: string | null; pool?: string | null; price?: number; compact?: boolean }) {
  const [data, setData] = useState<PerfResp | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [denom, setDenom] = useState<Denom>('usd');

  // The live price only anchors the latest point server-side — it must not be a
  // fetch dependency, or every small price tick (and the DexScreener→Gecko pair
  // source switch, whose prices differ slightly) refires this heavy request.
  const priceRef = useRef(price);
  priceRef.current = price;

  // `network`/`pool` start undefined and resolve once pair data loads; keep the
  // fetch key stable so prop resolution alone doesn't refetch.
  const net = (network || 'pulsechain').toLowerCase();
  const poolKey = (pool || '').toLowerCase();

  useEffect(() => {
    if (!token && !poolKey) { setStatus('idle'); return; }
    let alive = true;
    setStatus('loading');
    const qs = new URLSearchParams();
    qs.set('network', net);
    if (token) qs.set('token', token);
    if (poolKey) qs.set('pool', poolKey);
    // 4 significant digits — matches display precision and keeps the URL stable
    // across ticks so shared (browser/CDN) caches actually get hits.
    const p = priceRef.current;
    if (p && p > 0) qs.set('price', p.toPrecision(4));
    fetch(`/api/geicko/performance?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: PerfResp & { error?: string }) => {
        if (!alive) return;
        if (d.error || !d.views?.usd) { setStatus('error'); return; }
        setData(d);
        if (!d.views.wpls) setDenom('usd');
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => { alive = false; };
  }, [net, token, poolKey]);

  if (status === 'idle') return null;

  const view = data ? (denom === 'wpls' ? data.views.wpls : data.views.usd) : null;
  const full = view?.coverage === 'full';

  return (
    <div className={`rounded-lg border border-[var(--line)] bg-[var(--panel)] ${compact ? 'mb-2 p-2.5' : 'mb-2 p-3'}`}>
      <div className={`flex items-center justify-between gap-2 ${compact ? 'mb-1.5' : 'mb-2'}`}>
        <div className={`flex items-center gap-2 ${compact ? 'min-w-0 flex-wrap' : ''}`}>
          <h3 className={`font-semibold uppercase tracking-wider text-[var(--text-muted)] ${compact ? 'text-[11px]' : 'text-xs'}`}>Price Performance</h3>
          {status === 'ready' && data && (
            <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5">
              <DenomTab active={denom === 'usd'} onClick={() => setDenom('usd')}>USD</DenomTab>
              {data.views.wpls && <DenomTab active={denom === 'wpls'} onClick={() => setDenom('wpls')}>vs WPLS</DenomTab>}
            </div>
          )}
        </div>
      </div>

      {status === 'loading' && (
        <div className={`text-center text-xs text-[var(--text-muted)] ${compact ? 'py-4' : 'py-6'}`}>Loading price history…</div>
      )}
      {status === 'error' && (
        <div className={`text-center text-xs text-[var(--text-muted)] ${compact ? 'py-4' : 'py-6'}`}>Price history isn’t available for this token yet.</div>
      )}

      {status === 'ready' && view && (
        <>
          <div className={`grid grid-cols-3 ${compact ? 'mb-1.5 gap-1' : 'mb-2 gap-2'}`}>
            <ChangeChip label="7D" value={view.changes.d7} />
            <ChangeChip label="30D" value={view.changes.d30} />
            <ChangeChip label="1Y" value={view.changes.d365} />
          </div>

          {/* Wide layout: three side-by-side cards. Compact (right rail):
              stacked rows, which stay legible at ~1/3 the width. */}
          {compact ? (
            <div className="space-y-1">
              <ExtremeRow denom={denom} label={full ? 'All-time high' : '6-mo high'} price={view.ath.price} date={view.ath.date} pct={view.ath.fromPct} />
              <ExtremeRow denom={denom} label={full ? 'All-time low' : '6-mo low'} price={view.atl.price} date={view.atl.date} pct={view.atl.fromPct} />
              <ExtremeRow denom={denom} label={full ? 'Since launch' : `Since ${fmtDate(view.launch.date)}`} price={view.launch.price} date={view.launch.date} pct={view.launch.pct} />
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-3 gap-2">
              <ExtremeCard denom={denom} label={full ? 'All-time high' : '6-mo high'} price={view.ath.price} date={view.ath.date} pct={view.ath.fromPct} />
              <ExtremeCard denom={denom} label={full ? 'All-time low' : '6-mo low'} price={view.atl.price} date={view.atl.date} pct={view.atl.fromPct} />
              <ExtremeCard denom={denom} label={full ? 'Since launch' : `Since ${fmtDate(view.launch.date)}`} price={view.launch.price} date={view.launch.date} pct={view.launch.pct} />
            </div>
          )}

          {denom === 'wpls' && !compact && (
            <div className="mt-2 text-[10px] text-[var(--text-faint)]">Priced in WPLS — strips out PLS’s own move, so this is the token’s performance relative to PulseChain itself.</div>
          )}
        </>
      )}
    </div>
  );
}
