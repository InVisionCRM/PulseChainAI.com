'use client';

// "Volume Since Launch" tab for the Geicko token view (PulseChain only —
// sourced from the PulseX subgraph via /api/geicko/volume). This is the
// up-close look at a token's trading volume across its whole life: a headline
// number with a sparkline, a cumulative curve, a GitHub-style day heatmap,
// price-coloured daily bars, a set of derived stat tiles, and a per-pair
// breakdown. Everything here is computed from the same daily series so the
// numbers always agree with each other.

import React, { useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

interface Day {
  date: number; // unix seconds, UTC midnight
  volumeUsd: number;
  txns: number;
  liquidityUsd: number;
  priceUsd: number;
}
interface PairVol { label: string; volumeUsd: number }
interface VolResp {
  supported?: boolean;
  daily?: Day[];
  byPair?: PairVol[];
  allTime?: {
    volumeUsd: number;
    txns: number;
    days: number;
    firstDate: number | null;
    currentLiquidity: number;
    bestDay: { date: number; volumeUsd: number } | null;
  };
  error?: string;
}

const fmtUsd = (v: number) => {
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}K`;
  if (a >= 1) return `${s}$${a.toFixed(0)}`;
  return `${s}$${a.toFixed(2)}`;
};
const fmtNum = (v: number) => {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return `${Math.round(v)}`;
};
const fmtDay = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtFullDay = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const DAY = 86400;

// ── charts ──────────────────────────────────────────────────────────────────

function AreaTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as { date: number; cum: number };
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-[11px] shadow-lg">
      <div className="text-[var(--text-muted)]">{fmtFullDay(d.date)}</div>
      <div className="font-semibold text-[#FA4616]">{fmtUsd(d.cum)} cumulative</div>
    </div>
  );
}

function BarsTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as Day;
  return (
    <div className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-[11px] shadow-lg">
      <div className="text-[var(--text-muted)]">{fmtFullDay(d.date)}</div>
      <div className="font-semibold text-[var(--text)]">{fmtUsd(d.volumeUsd)}</div>
      <div className="text-[var(--text-faint)]">{d.txns.toLocaleString()} txns</div>
    </div>
  );
}

// GitHub-style calendar heatmap of daily volume, weeks as columns.
function VolumeHeatmap({ daily }: { daily: Day[] }) {
  const { weeks, max, monthLabels } = useMemo(() => {
    const byDate = new Map<number, number>();
    for (const d of daily) byDate.set(d.date, d.volumeUsd);
    const first = daily[0].date;
    const last = daily[daily.length - 1].date;
    // Snap start back to the Sunday of its week so columns line up.
    const firstDow = new Date(first * 1000).getUTCDay();
    const start = first - firstDow * DAY;
    const cells: { date: number; vol: number | null }[] = [];
    for (let t = start; t <= last; t += DAY) {
      cells.push({ date: t, vol: t >= first ? byDate.get(t) ?? 0 : null });
    }
    const weeks: { date: number; vol: number | null }[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    const max = daily.reduce((m, d) => Math.max(m, d.volumeUsd), 0);
    // One label per month, placed at the first week of each month. Skip a label
    // if it would sit right on top of the previous one (keeps the row readable
    // when the first partial week spills into the prior month).
    const monthLabels: { col: number; label: string }[] = [];
    let lastMonth = -1;
    let lastLabelCol = -99;
    weeks.forEach((w, col) => {
      const top = w[0];
      if (!top) return;
      const mo = new Date(top.date * 1000).getUTCMonth();
      if (mo !== lastMonth) {
        lastMonth = mo;
        if (col - lastLabelCol < 3) return; // too close to the previous label
        lastLabelCol = col;
        monthLabels.push({ col, label: new Date(top.date * 1000).toLocaleDateString(undefined, { month: 'short' }) });
      }
    });
    return { weeks, max, monthLabels };
  }, [daily]);

  // Log scale so a handful of huge days don't wash out everything else.
  const shade = (vol: number | null): string => {
    if (vol === null) return 'transparent';
    if (vol <= 0) return 'var(--surface-2)';
    const t = Math.log10(vol + 1) / Math.log10(max + 1); // 0..1
    if (t < 0.25) return 'rgba(250,70,22,0.22)';
    if (t < 0.5) return 'rgba(250,70,22,0.45)';
    if (t < 0.75) return 'rgba(250,70,22,0.7)';
    return 'rgba(250,70,22,1)';
  };

  const CELL = 11; // px per cell incl. gap
  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="relative mb-1 ml-0 h-3" style={{ width: weeks.length * CELL }}>
          {monthLabels.map((m) => (
            <span
              key={`${m.col}-${m.label}`}
              className="absolute text-[9px] text-[var(--text-faint)]"
              style={{ left: m.col * CELL }}
            >
              {m.label}
            </span>
          ))}
        </div>
        <div className="flex gap-[2px]">
          {weeks.map((w, wi) => (
            <div key={wi} className="flex flex-col gap-[2px]">
              {Array.from({ length: 7 }).map((_, di) => {
                const cell = w[di];
                return (
                  <div
                    key={di}
                    className="h-[9px] w-[9px] rounded-[2px]"
                    style={{ backgroundColor: cell ? shade(cell.vol) : 'transparent' }}
                    title={cell && cell.vol !== null ? `${fmtFullDay(cell.date)} · ${fmtUsd(cell.vol)}` : ''}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex items-center gap-1 text-[9px] text-[var(--text-faint)]">
          <span>Less</span>
          {['var(--surface-2)', 'rgba(250,70,22,0.22)', 'rgba(250,70,22,0.45)', 'rgba(250,70,22,0.7)', 'rgba(250,70,22,1)'].map((c) => (
            <span key={c} className="h-[9px] w-[9px] rounded-[2px]" style={{ backgroundColor: c }} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

// ── tiles ─────────────────────────────────────────────────────────────────────

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'up' | 'down' }) {
  const valCls = tone === 'up' ? 'text-[var(--up)]' : tone === 'down' ? 'text-red-400' : 'text-[var(--text)]';
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className={`mt-1 text-base font-bold tabular-nums ${valCls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-[var(--text-faint)]">{sub}</div>}
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function GeickoVolumePanel({
  token, network,
}: { token?: string | null; network?: string | null }) {
  const [data, setData] = useState<VolResp | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');

  useEffect(() => {
    if (!token) { setStatus('idle'); return; }
    let alive = true;
    setStatus('loading');
    const qs = new URLSearchParams();
    if (network) qs.set('network', network);
    qs.set('token', token);
    fetch(`/api/geicko/volume?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: VolResp) => {
        if (!alive) return;
        if (d.error || d.supported === false) { setStatus('error'); return; }
        if (!d.daily?.length) { setData(d); setStatus('empty'); return; }
        setData(d);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => { alive = false; };
  }, [token, network]);

  const derived = useMemo(() => {
    const daily = data?.daily ?? [];
    const at = data?.allTime;
    if (!daily.length || !at) return null;

    const cumulative: { date: number; cum: number }[] = [];
    let run = 0;
    for (const d of daily) { run += d.volumeUsd; cumulative.push({ date: d.date, cum: run }); }

    const total = at.volumeUsd;
    const activeDays = daily.filter((d) => d.volumeUsd > 0).length || daily.length;
    const avgDaily = total / activeDays;
    const avgTrade = at.txns > 0 ? total / at.txns : 0;

    // Turnover: how many times the current liquidity has traded over its life.
    const turnover = at.currentLiquidity > 0 ? total / at.currentLiquidity : 0;

    // Quietest active day (lowest non-zero volume).
    const activeSorted = daily.filter((d) => d.volumeUsd > 0).sort((a, b) => a.volumeUsd - b.volumeUsd);
    const quietest = activeSorted[0] ?? null;

    // Last 7 vs prior 7 days by volume.
    const last7 = daily.slice(-7).reduce((s, d) => s + d.volumeUsd, 0);
    const prev7 = daily.slice(-14, -7).reduce((s, d) => s + d.volumeUsd, 0);
    const weekChange = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : null;

    // Momentum: recent 7d daily avg vs 30d daily avg.
    const avg7 = daily.slice(-7).reduce((s, d) => s + d.volumeUsd, 0) / Math.min(7, daily.length);
    const avg30 = daily.slice(-30).reduce((s, d) => s + d.volumeUsd, 0) / Math.min(30, daily.length);
    const momentum = avg30 > 0 ? (avg7 / avg30) : null; // >1 heating up, <1 cooling

    // Yesterday's volume as a percentile of every day's volume.
    const lastVol = daily[daily.length - 1].volumeUsd;
    const below = daily.filter((d) => d.volumeUsd <= lastVol).length;
    const percentile = Math.round((below / daily.length) * 100);
    const pctOfPeak = at.bestDay && at.bestDay.volumeUsd > 0 ? (lastVol / at.bestDay.volumeUsd) * 100 : 0;

    // Longest run of consecutive days that each had trading volume.
    let streak = 0, longest = 0;
    for (const d of daily) {
      if (d.volumeUsd > 0) { streak += 1; longest = Math.max(longest, streak); }
      else streak = 0;
    }

    // Sparkline: the daily series itself, trimmed for the header.
    const spark = daily.map((d) => ({ date: d.date, v: d.volumeUsd }));

    return {
      cumulative, spark, total, avgDaily, avgTrade, turnover, quietest,
      weekChange, momentum, percentile, pctOfPeak, longest, lastVol,
      firstDate: at.firstDate, days: at.days, txns: at.txns,
      bestDay: at.bestDay, currentLiquidity: at.currentLiquidity,
    };
  }, [data]);

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="py-10 text-center text-sm text-[var(--text-muted)]">
        {status === 'loading' ? 'Loading volume history…' : ''}
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 text-center text-sm text-[var(--text-muted)]">
        Volume history isn&apos;t available for this token.
        <div className="mt-1 text-xs text-[var(--text-faint)]">All-time volume is sourced from the PulseX subgraph (PulseChain tokens only).</div>
      </div>
    );
  }
  if (status === 'empty' || !derived) {
    return (
      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-6 text-center text-sm text-[var(--text-muted)]">
        No trading volume recorded yet for this token.
      </div>
    );
  }

  const d = derived;
  const byPair = data?.byPair ?? [];
  const pairMax = byPair.reduce((m, p) => Math.max(m, p.volumeUsd), 0);

  return (
    <div className="space-y-3 p-2 md:p-3">
      {/* Hero — volume since launch + sparkline */}
      <div className="rounded-xl border border-[var(--line)] bg-gradient-to-br from-[#FA4616]/10 via-[var(--panel)] to-[var(--panel)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Total Volume Since Launch
            </div>
            <div className="mt-1 text-3xl font-black tabular-nums text-[var(--text)] md:text-4xl">
              {fmtUsd(d.total)}
            </div>
            <div className="mt-1 text-xs text-[var(--text-faint)]">
              {d.txns.toLocaleString()} trades over {d.days.toLocaleString()} days
              {d.firstDate ? ` · since ${fmtFullDay(d.firstDate)}` : ''}
            </div>
          </div>
          <div className="h-16 w-full sm:w-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.spark} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="volSpark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FA4616" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#FA4616" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke="#FA4616" strokeWidth={1.5} fill="url(#volSpark)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <Tile label="Avg daily volume" value={fmtUsd(d.avgDaily)} sub="active trading days" />
        <Tile label="Avg trade size" value={fmtUsd(d.avgTrade)} sub={`${fmtNum(d.txns)} trades`} />
        <Tile label="Best day" value={d.bestDay ? fmtUsd(d.bestDay.volumeUsd) : '—'} sub={d.bestDay ? fmtFullDay(d.bestDay.date) : undefined} />
        <Tile label="Quietest day" value={d.quietest ? fmtUsd(d.quietest.volumeUsd) : '—'} sub={d.quietest ? fmtFullDay(d.quietest.date) : undefined} />
        <Tile
          label="7-day change"
          value={d.weekChange === null ? '—' : `${d.weekChange >= 0 ? '+' : ''}${d.weekChange.toFixed(0)}%`}
          sub="vs prior 7 days"
          tone={d.weekChange === null ? undefined : d.weekChange >= 0 ? 'up' : 'down'}
        />
        <Tile
          label="Momentum"
          value={d.momentum === null ? '—' : `${d.momentum.toFixed(2)}×`}
          sub="7d avg vs 30d avg"
          tone={d.momentum === null ? undefined : d.momentum >= 1 ? 'up' : 'down'}
        />
        <Tile label="Turnover" value={`${d.turnover.toFixed(1)}×`} sub="all-time vol ÷ liquidity" />
        <Tile label="Longest active streak" value={`${d.longest}d`} sub="consecutive trading days" />
      </div>

      {/* Cumulative volume — life of the token */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Cumulative volume</h3>
          <span className="text-[10px] tabular-nums text-[var(--text-faint)]">life of the token</span>
        </div>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={d.cumulative} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="volCum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FA4616" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#FA4616" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 9, fill: 'var(--text-faint)' }}
                axisLine={false} tickLine={false} minTickGap={50} />
              <YAxis hide domain={[0, 'dataMax']} />
              <Tooltip content={<AreaTooltip />} cursor={{ stroke: 'var(--line)' }} />
              <Area type="monotone" dataKey="cum" stroke="#FA4616" strokeWidth={2} fill="url(#volCum)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily bars, price-coloured */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Daily volume</h3>
          <div className="flex items-center gap-3 text-[9px] uppercase tracking-wider text-[var(--text-faint)]">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[var(--up)]" />price up</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-400" />price down</span>
          </div>
        </div>
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.spark.map((s, i) => data!.daily![i])} margin={{ top: 4, right: 2, bottom: 0, left: 2 }} barCategoryGap={0.5}>
              <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fontSize: 9, fill: 'var(--text-faint)' }}
                axisLine={false} tickLine={false} minTickGap={50} />
              <YAxis hide domain={[0, 'dataMax']} />
              <Tooltip content={<BarsTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="volumeUsd" radius={[1, 1, 0, 0]} isAnimationActive={false}>
                {(data!.daily!).map((day, i) => {
                  const prev = i > 0 ? data!.daily![i - 1].priceUsd : day.priceUsd;
                  const up = day.priceUsd >= prev;
                  return <Cell key={day.date} fill={up ? 'var(--up)' : '#f87171'} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 flex items-center justify-center gap-4 text-[9px] uppercase tracking-wider text-[var(--text-faint)]">
          <span>Yesterday {fmtUsd(d.lastVol)}</span>
          <span>·</span>
          <span>{d.percentile}th percentile day</span>
          <span>·</span>
          <span>{d.pctOfPeak.toFixed(0)}% of peak</span>
        </div>
      </div>

      {/* Volume heatmap */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Volume calendar</h3>
          <span className="text-[10px] tabular-nums text-[var(--text-faint)]">daily intensity</span>
        </div>
        <VolumeHeatmap daily={data!.daily!} />
      </div>

      {/* By pair */}
      {byPair.length > 0 && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Volume by pair</h3>
            <span className="text-[10px] tabular-nums text-[var(--text-faint)]">top {byPair.length}</span>
          </div>
          <div className="space-y-1.5">
            {byPair.map((p) => (
              <div key={p.label} className="flex items-center gap-2">
                <span className="w-32 shrink-0 truncate text-[11px] font-medium text-[var(--text-muted)]" title={p.label}>{p.label}</span>
                <div className="relative h-4 flex-1 overflow-hidden rounded bg-[var(--surface-2)]">
                  <div
                    className="absolute inset-y-0 left-0 rounded bg-[#FA4616]/70"
                    style={{ width: `${pairMax > 0 ? Math.max(2, (p.volumeUsd / pairMax) * 100) : 0}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-[11px] font-semibold tabular-nums text-[var(--text)]">{fmtUsd(p.volumeUsd)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-0.5 text-center text-[10px] text-[var(--text-faint)]">
        All-time volume from the PulseX subgraph (v1 + v2).
      </div>
    </div>
  );
}
