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
  IconRefresh,
} from '@tabler/icons-react';
import type { Network } from '@/lib/hex/strategistData';
import { fmtHex } from '@/lib/hex/hexDay';
import { HeroNumber, Speedo } from '@/components/hex/Instruments';
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
      {/* ── Hero: the window's headline figures on the molten panel ── */}
      <div
        className="anim-rise relative overflow-hidden rounded-3xl border border-white/10 bg-[#06182e] p-5 md:p-7"
        style={{
          ['--text' as string]: '#ffffff',
          ['--text-muted' as string]: 'rgba(255,255,255,0.70)',
          ['--text-faint' as string]: 'rgba(255,255,255,0.45)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(120% 140% at 92% -20%, rgba(255,158,0,0.30) 0%, rgba(255,46,126,0.13) 45%, transparent 75%)' }}
        />
        <img
          src="/hex-logo.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -right-14 -top-14 h-60 w-60 rotate-12 select-none object-contain opacity-[0.20] md:h-72 md:w-72"
        />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-poppins text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
              Everything HEX staking did · last {WINDOW_LABEL[win]}
            </span>
            {/* The one filter — it scopes every figure on the tab. */}
            <div className="inline-flex rounded-lg border border-white/15 bg-white/[0.06] p-0.5">
              {(['24h', '7d', '30d'] as WindowKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setWin(k)}
                  aria-pressed={win === k}
                  className={`font-poppins rounded-md px-3 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    win === k ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-6 sm:grid-cols-3 md:gap-8">
            <HeroNumber
              key={`h-net-${win}`}
              label="Net HEX flow"
              value={Math.abs(w.netHex)}
              fmt="hex"
              sub={inflow ? 'more locked than freed' : 'more freed than locked'}
              gradient
            />
            <HeroNumber
              key={`h-in-${win}`}
              label="HEX staked in"
              value={w.starts.hex}
              fmt="hex"
              sub={`${count(w.starts.count)} stakes · ${count(w.starts.stakers)} stakers`}
            />
            <HeroNumber
              key={`h-out-${win}`}
              label="HEX unstaked out"
              value={w.ends.principalHex}
              fmt="hex"
              sub={`${count(w.ends.count)} stakes · ${fmtHex(w.ends.payoutHex)} yield paid`}
            />
          </div>
        </div>
      </div>

      {/* The dials — the shared instrument the Rescue Wall uses, so a gauge
          means the same thing everywhere on the site. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Speedo
          key={`flow-${win}`}
          frac={flowFrac}
          figure={signedHex(w.netHex)}
          label="Net flow"
          sub={inflow ? 'more HEX locked than freed' : 'more HEX freed than locked'}
          tone="a"
        />
        <Speedo
          key={`loyal-${win}`}
          frac={loyaltyFrac}
          figure={`${Math.round(loyaltyFrac * 100)}%`}
          label="Held to term"
          sub={`${count(w.ends.early)} ended early · ${count(w.ends.late)} claimed late`}
          tone="b"
        />
        <Speedo
          key="staked-share"
          frac={stakedFrac}
          figure={`${(stakedFrac * 100).toFixed(1)}%`}
          label="Of all HEX is staked"
          sub={data.now ? `${fmtHex(data.now.lockedHex)} locked vs ${fmtHex(data.now.supplyHex)} liquid` : '—'}
          tone="a"
        />
      </div>

      {/* In vs out, per day — always the full 30-day strip for context. */}
      <div className="anim-rise rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 px-1">
          <span className="font-jost text-[13px] font-bold text-[var(--text)]">Staked in, unstaked out — daily, last 30 days</span>
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

      {/* ── The chain moved ── */}
      <Group title="The chain moved">
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
      </Group>

      {/* The rest, grouped by the question it answers rather than laid out as
          one undifferentiated wall of twelve tiles. */}
      <Group title="HEX minted and taken back">
        <Small label="Yield minted" value={fmtHex(w.mintedHex)} sub="inflation to all stakers" hex />
        <Small label="Yield claimed" value={fmtHex(w.ends.payoutHex)} sub="paid out on ends" hex />
        <Small label="Penalties paid" value={fmtHex(w.ends.penaltyHex + w.goodAccounted.penaltyHex)} sub="early + late ends" hex />
        <Small label="Circulating Δ" value={w.delta?.supplyHex != null ? signedHex(w.delta.supplyHex) : '—'} sub="liquid HEX supply" />
      </Group>

      <Group title="How stakes ended">
        <Small label="Ended early" value={count(w.ends.early)} sub="broke the term" />
        <Small label="Served in full" value={count(w.ends.fullTerm)} sub="held to the day" />
        <Small label="Claimed late" value={count(w.ends.late)} sub="matured, ended after" />
        <Small label="Good-accounted" value={count(w.goodAccounted.count)} sub={`${fmtHex(w.goodAccounted.hex)} frozen`} />
      </Group>

      <Group title="What people opened">
        <Small label="Avg new stake" value={`${count(w.starts.avgDays)}d`} sub={`median ${count(w.starts.medianDays)}d`} />
        <Small label="Biggest stake" value={fmtHex(w.starts.biggestHex)} sub={`${count(w.starts.biggestDays)}-day lock`} hex />
        <Small label="Auto-stakes" value={count(w.starts.autoStakes)} sub={`of ${count(w.starts.count)} starts`} />
        <Small label="Net stakes" value={`${w.netStakes >= 0 ? '+' : '−'}${count(Math.abs(w.netStakes))}`} sub="started minus ended" />
      </Group>

      <p className="px-1 text-[10px] leading-relaxed text-[var(--text-faint)]">{data.note}</p>
    </div>
  );
}

/** A titled row of tiles. The Micro tab carries a lot of numbers, and four
 *  under a heading are read where twelve in a grid are skipped. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="anim-rise">
      <div className="font-poppins mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{children}</div>
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

function Delta({ label, value, format, goodWhenUp, sub, delay }: {
  label: string; value: number | null; format: (n: number) => string;
  goodWhenUp: boolean; sub?: string; delay: number;
}) {
  const color = value == null ? 'var(--text-faint)' : (value >= 0) === goodWhenUp ? 'var(--up)' : '#f87171';
  return (
    <div className="anim-rise rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3" style={{ animationDelay: `${delay}ms` }}>
      <div className="font-poppins truncate text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div className="font-jost truncate text-[26px] font-bold leading-none tabular-nums" style={{ color }}>
        {value != null ? format(value) : '—'}
      </div>
      {sub && <div className="font-poppins mt-1 truncate text-[11px] text-[var(--text-muted)]">{sub}</div>}
    </div>
  );
}

function Small({ label, value, sub, hex }: { label: string; value: string; sub?: string; hex?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3">
      <div className="font-poppins truncate text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div className="font-jost flex items-center gap-1.5 truncate text-[26px] font-bold leading-none tabular-nums text-[var(--text)]">
        {hex && <HexLogo className="h-4 w-4 shrink-0" />}
        <span className="truncate">{value}</span>
      </div>
      {sub && <div className="font-poppins mt-1 truncate text-[11px] text-[var(--text-muted)]">{sub}</div>}
    </div>
  );
}
