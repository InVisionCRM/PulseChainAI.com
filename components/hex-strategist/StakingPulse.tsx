'use client';

// The Micro tab — HEX staking's vital signs over the last 24 hours, 7 days,
// and 30 days. One fetch carries all three windows (the API sums the same
// event stream into each), so switching windows is instant and every figure
// stays consistent with the others.
//
// The layout runs loudest to quietest: four headline count-ups, three dials,
// the daily in/out chart, then the full stat grid for everything else — the
// penalties, the good-accountings, the records. One filter row scopes it all.

import { useEffect, useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  IconActivity, IconRefresh, IconTrendingUp, IconTrendingDown, IconFlame, IconSnowflake,
} from '@tabler/icons-react';
import type { Network } from '@/lib/hex/strategistData';
import { fmtHex } from '@/lib/hex/hexDay';
import { fmtPrice } from '@/lib/format';
import { HexLogo } from '@/components/hex/HexAmount';
import CountUp from './CountUp';

type WindowKey = '24h' | '7d' | '30d';

interface WindowStats {
  starts: {
    count: number; hex: number; tShares: number; stakers: number;
    avgDays: number; medianDays: number; autoStakes: number; biggestHex: number; biggestDays: number;
  };
  ends: {
    count: number; principalHex: number; tShares: number; stakers: number;
    payoutHex: number; penaltyHex: number; fullTerm: number; early: number; late: number;
  };
  goodAccounted: { count: number; hex: number; payoutHex: number; penaltyHex: number };
  delta: { lockedHex: number | null; tShares: number | null; shareRatePct: number | null; supplyHex: number | null } | null;
  mintedHex: number;
  netHex: number;
  netStakes: number;
}

interface PulseData {
  currentDay: number;
  asOf: number;
  windows: Record<WindowKey, WindowStats>;
  daily: [number, number, number, number, number][];
  now: {
    lockedHex: number; tShares: number; shareRate: number; supplyHex: number;
    latestStakeId: number; stakePenaltyTotalHex: number;
  } | null;
  note: string;
}

const WINDOW_LABEL: Record<WindowKey, string> = { '24h': '24 hours', '7d': '7 days', '30d': '30 days' };
const WINDOW_DAYS: Record<WindowKey, number> = { '24h': 1, '7d': 7, '30d': 30 };

const HEX_ADDR = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';

const count = (n: number) => Math.round(n).toLocaleString();
const tsh = (t: number) => (t >= 1000 ? Math.round(t).toLocaleString() : t.toFixed(1));
const signedHex = (n: number) => `${n >= 0 ? '+' : '−'}${fmtHex(Math.abs(n))}`;
const dayLabel = (ts: number) =>
  new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function StakingPulse({ net }: { net: Network }) {
  const [data, setData] = useState<PulseData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [win, setWin] = useState<WindowKey>('24h');
  /** Daily closes, oldest first — price change per window. Best-effort. */
  const [closes, setCloses] = useState<number[] | null>(null);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    fetch(`/api/hex/pulse?network=${net}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        return j as PulseData;
      })
      .then((d) => { if (alive) { setData(d); setStatus('ready'); } })
      .catch((e) => { if (alive) { setErrMsg(e instanceof Error ? e.message : null); setStatus('error'); } });
    return () => { alive = false; };
  }, [net, reload]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/portfolio/ohlcv?chain=${net}&address=${HEX_ADDR}&timeframe=1d&limit=32`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j) return;
        const candles: { close?: number; c?: number }[] = j.candles ?? j.data ?? [];
        const c = candles.map((k) => Number(k.close ?? k.c)).filter((v) => Number.isFinite(v) && v > 0);
        if (c.length >= 2) setCloses(c);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [net]);

  const w = data?.windows[win];

  const priceNow = closes ? closes[closes.length - 1] : null;
  const priceChangePct = useMemo(() => {
    if (!closes || closes.length < 2) return null;
    const back = Math.min(WINDOW_DAYS[win], closes.length - 1);
    const then = closes[closes.length - 1 - back];
    return then > 0 ? ((closes[closes.length - 1] - then) / then) * 100 : null;
  }, [closes, win]);

  const series = useMemo(
    () =>
      (data?.daily ?? []).map(([ts, sc, sh, ec, eh]) => ({
        ts, staked: sh, unstaked: -eh, startsCount: sc, endsCount: ec,
      })),
    [data],
  );

  if (status === 'loading') {
    return (
      <div className="grid place-items-center py-20 text-center text-sm text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-2">
          <IconRefresh className="h-4 w-4 animate-spin" /> Reading the last 30 days of staking…
        </span>
      </div>
    );
  }
  if (status === 'error' || !data || !w) {
    return (
      <div className="py-20 text-center text-sm text-red-300">
        Couldn’t read the staking pulse.
        <button onClick={() => setReload((n) => n + 1)} className="ml-2 underline">retry</button>
        {errMsg && <div className="mt-2 text-xs text-[var(--text-faint)]">{errMsg}</div>}
      </div>
    );
  }

  const inflow = w.netHex >= 0;
  const flowFrac = w.starts.hex + w.ends.principalHex > 0
    ? w.starts.hex / (w.starts.hex + w.ends.principalHex)
    : 0.5;
  const loyaltyFrac = w.ends.count > 0 ? w.ends.fullTerm / w.ends.count : 0;
  const stakedFrac = data.now && data.now.lockedHex + data.now.supplyHex > 0
    ? data.now.lockedHex / (data.now.lockedHex + data.now.supplyHex)
    : 0;

  return (
    <div className="space-y-3">
      {/* The one filter row — scopes every figure below it. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text)]">
          <IconActivity className="h-4 w-4 text-[var(--chart-accent)]" /> The pulse
          <span className="text-[10px] font-normal uppercase tracking-wider text-[var(--text-faint)]">
            last {WINDOW_LABEL[win]}
          </span>
        </span>
        <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5">
          {(['24h', '7d', '30d'] as WindowKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setWin(k)}
              className={`rounded-md px-3 py-1 text-xs font-semibold uppercase transition-colors ${
                win === k ? 'bg-[var(--surface-3)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* Headlines */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Headline
          key={`s-${win}`} label="Stakes started" value={w.starts.count} format={count}
          sub={`${w.starts.stakers.toLocaleString()} stakers · ${tsh(w.starts.tShares)} T minted`} delay={0}
        />
        <Headline
          key={`e-${win}`} label="Stakes ended" value={w.ends.count} format={count}
          sub={`${w.ends.stakers.toLocaleString()} stakers · ${tsh(w.ends.tShares)} T released`} delay={60}
        />
        <Headline
          key={`sh-${win}`} label="HEX staked" value={w.starts.hex} format={fmtHex} hex
          sub={`biggest single stake ${fmtHex(w.starts.biggestHex)}`} delay={120}
        />
        <Headline
          key={`uh-${win}`} label="HEX unstaked" value={w.ends.principalHex} format={fmtHex} hex
          sub={`plus ${fmtHex(w.ends.payoutHex)} minted as yield`} delay={180}
        />
      </div>

      {/* The dials */}
      <div className="grid gap-2 sm:grid-cols-3">
        <Dial
          key={`flow-${win}`}
          frac={flowFrac}
          center={signedHex(w.netHex)}
          centerColor={inflow ? 'var(--up)' : '#f87171'}
          label="Net flow"
          sub={inflow ? 'more HEX locked than freed' : 'more HEX freed than locked'}
          icon={inflow ? <IconTrendingUp className="h-3.5 w-3.5" /> : <IconTrendingDown className="h-3.5 w-3.5" />}
        />
        <Dial
          key={`loyal-${win}`}
          frac={loyaltyFrac}
          center={`${Math.round(loyaltyFrac * 100)}%`}
          label="Held to term"
          sub={`${w.ends.early.toLocaleString()} ended early · ${w.ends.late.toLocaleString()} claimed late`}
          icon={<IconSnowflake className="h-3.5 w-3.5" />}
        />
        <Dial
          key="staked-share"
          frac={stakedFrac}
          center={`${(stakedFrac * 100).toFixed(1)}%`}
          label="Of all HEX is staked"
          sub={data.now ? `${fmtHex(data.now.lockedHex)} locked vs ${fmtHex(data.now.supplyHex)} liquid` : '—'}
          icon={<IconFlame className="h-3.5 w-3.5" />}
        />
      </div>

      {/* In vs out, per day — always the full 30-day strip for context. */}
      <div className="anim-rise rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 px-1">
          <span className="text-xs font-semibold text-[var(--text)]">Staked in, unstaked out — daily, last 30 days</span>
          <span className="flex items-center gap-3 text-[10px] text-[var(--text-faint)]">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-[3px] bg-[var(--chart-accent)]" />staked</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-[3px] bg-[var(--chart-flow)]" />unstaked</span>
          </span>
        </div>
        <div className="h-[190px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 6, right: 10, bottom: 0, left: 4 }} stackOffset="sign">
              <CartesianGrid stroke="var(--line-soft)" vertical={false} />
              <XAxis
                dataKey="ts" tickFormatter={dayLabel} tick={{ fontSize: 10, fill: 'var(--text-faint)' }}
                axisLine={{ stroke: 'var(--line-soft)' }} tickLine={false} minTickGap={40}
              />
              <YAxis
                tickFormatter={(v: number) => fmtHex(Math.abs(v))} tick={{ fontSize: 10, fill: 'var(--text-faint)' }}
                axisLine={false} tickLine={false} width={58}
              />
              <Tooltip cursor={{ fill: 'var(--surface-3)' }} content={<DailyTooltip />} />
              <Bar dataKey="staked" stackId="flow" fill="var(--chart-accent)" radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={700} />
              <Bar dataKey="unstaked" stackId="flow" fill="var(--chart-flow)" radius={[0, 0, 4, 4]} maxBarSize={18} animationDuration={700} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* The chain moved */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Delta label="Locked HEX" value={w.delta?.lockedHex ?? null} format={signedHex} goodWhenUp delay={0} />
        <Delta label="Live T-Shares" value={w.delta?.tShares ?? null} format={(n) => `${n >= 0 ? '+' : '−'}${tsh(Math.abs(n))} T`} goodWhenUp delay={40} />
        <Delta
          label="T-Share cost" value={w.delta?.shareRatePct ?? null}
          format={(n) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}%`} goodWhenUp={false} delay={80}
          sub="the share rate only ratchets up"
        />
        <Delta
          label={`HEX price (${win})`} value={priceChangePct}
          format={(n) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}%`} goodWhenUp delay={120}
          sub={priceNow != null ? `now ${fmtPrice(priceNow)}` : 'price feed unavailable'}
        />
      </div>

      {/* Everything else — the small print, as tiles instead of prose. */}
      <div className="anim-rise grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" style={{ animationDelay: '150ms' }}>
        <Small label="Yield minted" value={fmtHex(w.mintedHex)} sub="inflation to all stakers" hex />
        <Small label="Penalties paid" value={fmtHex(w.ends.penaltyHex + w.goodAccounted.penaltyHex)} sub="early + late ends" hex />
        <Small label="Good-accounted" value={count(w.goodAccounted.count)} sub={`${fmtHex(w.goodAccounted.hex)} frozen`} />
        <Small label="Avg new stake" value={`${count(w.starts.avgDays)}d`} sub={`median ${count(w.starts.medianDays)}d`} />
        <Small label="Biggest stake" value={fmtHex(w.starts.biggestHex)} sub={`${count(w.starts.biggestDays)}-day lock`} hex />
        <Small label="Auto-stakes" value={count(w.starts.autoStakes)} sub={`of ${count(w.starts.count)} starts`} />
        <Small label="Circulating Δ" value={w.delta?.supplyHex != null ? signedHex(w.delta.supplyHex) : '—'} sub="liquid HEX supply" />
        <Small label="Net stakes" value={`${w.netStakes >= 0 ? '+' : '−'}${count(Math.abs(w.netStakes))}`} sub="started minus ended" />
        <Small label="Yield claimed" value={fmtHex(w.ends.payoutHex)} sub="paid out on ends" hex />
        <Small label="Ended early" value={count(w.ends.early)} sub={`${count(w.ends.fullTerm)} served in full`} />
        <Small label="Claimed late" value={count(w.ends.late)} sub="matured, ended after" />
        <Small label="Share rate" value={data.now ? `${count(data.now.shareRate)}` : '—'} sub="HEX per T-Share" />
      </div>

      <p className="px-1 text-[10px] leading-relaxed text-[var(--text-faint)]">{data.note}</p>
    </div>
  );
}

/** Value first, both directions, counts included. */
function DailyTooltip({ active, payload }: {
  active?: boolean;
  payload?: { payload: { ts: number; staked: number; unstaked: number; startsCount: number; endsCount: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 shadow-xl">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">{dayLabel(p.ts)}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--chart-accent)]" />
        <span className="text-sm font-bold tabular-nums text-[var(--text)]">{fmtHex(p.staked)}</span>
        <span className="text-[11px] text-[var(--text-muted)]">staked · {p.startsCount} stakes</span>
      </div>
      <div className="mt-0.5 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--chart-flow)]" />
        <span className="text-sm font-bold tabular-nums text-[var(--text)]">{fmtHex(-p.unstaked)}</span>
        <span className="text-[11px] text-[var(--text-muted)]">unstaked · {p.endsCount} stakes</span>
      </div>
    </div>
  );
}

function Headline({ label, value, format, sub, hex, delay }: {
  label: string; value: number; format: (n: number) => string; sub?: string; hex?: boolean; delay: number;
}) {
  return (
    <div className="anim-rise rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5" style={{ animationDelay: `${delay}ms` }}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div className="flex items-center gap-1.5 truncate text-xl font-extrabold text-[var(--text)]">
        {hex && <HexLogo className="h-4 w-4 shrink-0" />}
        <CountUp value={value} format={format} />
      </div>
      {sub && <div className="truncate text-[10px] tabular-nums text-[var(--text-muted)]">{sub}</div>}
    </div>
  );
}

/**
 * A speedometer. The needle and arc ease to their position on mount and glide
 * when the window changes — CSS transitions carry the motion, and they stand
 * down automatically under prefers-reduced-motion (transitions of transform
 * are cheap and won't run when the browser suppresses animation durations).
 */
function Dial({ frac, center, centerColor, label, sub, icon }: {
  frac: number; center: string; centerColor?: string; label: string; sub: string; icon: React.ReactNode;
}) {
  const f = Math.max(0, Math.min(1, frac));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(f));
    return () => cancelAnimationFrame(id);
  }, [f]);
  // Semi-circle r=64 → arc length ≈ 201; the dash pattern draws `shown` of it.
  const R = 64;
  const ARC = Math.PI * R;
  const angle = -90 + shown * 180;
  return (
    <div className="anim-rise rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 pb-2 pt-3 text-center">
      <div className="mx-auto h-[78px] w-[160px]">
        <svg viewBox="0 0 160 92" className="h-full w-full">
          <path d="M 16 84 A 64 64 0 0 1 144 84" fill="none" stroke="var(--line)" strokeWidth="10" strokeLinecap="round" />
          <path
            d="M 16 84 A 64 64 0 0 1 144 84"
            fill="none"
            stroke="var(--chart-accent)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={ARC}
            strokeDashoffset={ARC * (1 - shown)}
            style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
          {/* Needle stops short of the arc so it never crosses the figure. */}
          <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '80px 84px', transition: 'transform 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}>
            <line x1="80" y1="80" x2="80" y2="44" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" />
          </g>
          <circle cx="80" cy="84" r="5" fill="var(--text)" />
        </svg>
      </div>
      <div className="text-lg font-extrabold tabular-nums" style={{ color: centerColor ?? 'var(--text)' }}>
        {center}
      </div>
      <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text)]">
        {icon} {label}
      </div>
      <div className="text-[10px] text-[var(--text-muted)]">{sub}</div>
    </div>
  );
}

function Delta({ label, value, format, goodWhenUp, sub, delay }: {
  label: string; value: number | null; format: (n: number) => string;
  goodWhenUp: boolean; sub?: string; delay: number;
}) {
  const color = value == null ? 'var(--text-faint)' : (value >= 0) === goodWhenUp ? 'var(--up)' : '#f87171';
  return (
    <div className="anim-rise rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2" style={{ animationDelay: `${delay}ms` }}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div className="truncate text-base font-bold tabular-nums" style={{ color }}>
        {value != null ? format(value) : '—'}
      </div>
      {sub && <div className="truncate text-[10px] text-[var(--text-muted)]">{sub}</div>}
    </div>
  );
}

function Small({ label, value, sub, hex }: { label: string; value: string; sub?: string; hex?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2">
      <div className="truncate text-[9px] uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div className="flex items-center gap-1 truncate text-sm font-bold tabular-nums text-[var(--text)]">
        {hex && <HexLogo className="h-3 w-3 shrink-0" />}
        <span className="truncate">{value}</span>
      </div>
      {sub && <div className="truncate text-[9px] text-[var(--text-muted)]">{sub}</div>}
    </div>
  );
}
