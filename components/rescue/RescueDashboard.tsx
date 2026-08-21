'use client';

// The Rescue Wall's instrument cluster: speedometer gauges, big animated
// figures, and the month-by-month record of HEX saved.
//
// Every animation here runs ONCE, on arrival, and settles. The previous
// diagram re-rendered at 60fps on an infinite nine-second loop, which read as
// the page glitching; a dial that sweeps to its reading and stays put says
// "measured", a bar that resets forever says "broken". Reduced-motion gets the
// settled state immediately.
//
// Colors: the decorative HEX gradient (orange→pink) is for chrome only. Data
// marks use --viz-a / --viz-b, set per theme on the page wrapper — both pairs
// run through the dataviz palette validator against this app's actual light
// and dark surfaces (lightness band, CVD separation, contrast all pass).

import { useEffect, useRef, useState } from 'react';
import CountUp from '@/components/hex-strategist/CountUp';
import { fmtHex } from '@/lib/hex/hexDay';

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

function useSettled(): { on: boolean; instant: boolean } {
  // `on` flips one frame after mount and the CSS transitions do the rest;
  // reduced-motion flips it with the transitions switched off entirely, so the
  // settled state simply appears.
  const [on, setOn] = useState(false);
  const [instant, setInstant] = useState(false);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInstant(true);
      setOn(true);
      return;
    }
    const raf = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return { on, instant };
}

/* ────────────────────────────── speedometer ────────────────────────────── */

/**
 * A half-circle speedometer that sweeps once to its reading.
 * `frac` is 0–1; the figure in the middle is whatever the caller formats.
 */
export function Speedo({
  frac,
  figure,
  label,
  sub,
  tone = 'a',
}: {
  frac: number;
  figure: string;
  label: string;
  sub?: string;
  tone?: 'a' | 'b';
}) {
  const { on, instant } = useSettled();
  const f = Math.max(0, Math.min(1, frac));
  const shown = on ? f : 0;

  // Arc geometry: half circle, r=80, centred at (100, 100) in a 200×112 box.
  const R = 80;
  const LEN = Math.PI * R;
  const color = tone === 'a' ? 'var(--viz-a)' : 'var(--viz-b)';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="font-poppins text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
        {label}
      </div>
      <div className="mx-auto mt-2 w-full max-w-[240px]">
        <svg viewBox="0 0 200 108" className="w-full">
          {/* ticks, so the dial reads as an instrument rather than a ring */}
          {Array.from({ length: 11 }, (_, i) => {
            const a = Math.PI - (i / 10) * Math.PI;
            const x1 = 100 + Math.cos(a) * (R + 10);
            const y1 = 100 - Math.sin(a) * (R + 10);
            const x2 = 100 + Math.cos(a) * (R + 15);
            const y2 = 100 - Math.sin(a) * (R + 15);
            return (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--text-faint)" strokeWidth={i % 5 === 0 ? 2 : 1} opacity={0.55} />
            );
          })}
          <path
            d={`M 20 100 A ${R} ${R} 0 0 1 180 100`}
            fill="none"
            stroke="var(--surface-3)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <path
            d={`M 20 100 A ${R} ${R} 0 0 1 180 100`}
            fill="none"
            stroke={color}
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray={LEN}
            strokeDashoffset={LEN * (1 - shown)}
            style={{ transition: instant ? 'none' : `stroke-dashoffset 1.3s ${EASE}` }}
          />
          {/* needle — sweeps with the arc, stops short of the figure */}
          <g
            style={{
              transform: `rotate(${shown * 180 - 90}deg)`,
              transformOrigin: '100px 100px',
              transition: instant ? 'none' : `transform 1.3s ${EASE}`,
            }}
          >
            <line x1="100" y1="92" x2="100" y2="40" stroke="var(--text)" strokeWidth="3" strokeLinecap="round" />
          </g>
          <circle cx="100" cy="100" r="7" fill="var(--text)" />
          <circle cx="100" cy="100" r="3" fill={color} />
        </svg>
        <div className="-mt-1 text-center">
          <span className="font-jost text-[30px] font-bold leading-none tracking-tight text-[var(--text)] tabular-nums">
            {figure}
          </span>
        </div>
      </div>
      {sub && (
        <div className="font-poppins mt-2.5 text-center text-[11px] text-[var(--text-muted)]">{sub}</div>
      )}
    </div>
  );
}

/* ────────────────────────────── big figures ────────────────────────────── */

export type StatFmt = 'int' | 'hex' | 'waitHours';

/** Named formats, because a server page cannot pass a function across the
 *  client boundary. */
const FMT: Record<StatFmt, (n: number) => string> = {
  int: (n) => Math.round(n).toLocaleString(),
  hex: (n) => fmtHex(n),
  waitHours: (n) => (n >= 48 ? `${Math.round(n / 24)}d` : `${Math.round(n)}h`),
};

export function BigStat({
  label,
  value,
  fmt,
  sub,
  color = 'var(--text)',
}: {
  label: string;
  value: number;
  fmt: StatFmt;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="font-poppins text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
        {label}
      </div>
      <div
        className="font-jost mt-1.5 text-[34px] font-bold leading-none tracking-tight tabular-nums md:text-[40px]"
        style={{ color }}
      >
        <CountUp value={value} format={FMT[fmt]} />
      </div>
      {sub && <div className="font-poppins mt-1.5 text-[11px] text-[var(--text-muted)]">{sub}</div>}
    </div>
  );
}

/** A hero figure with no card chrome — the always-dark hero panel is its frame. */
export function HeroNumber({
  label,
  value,
  fmt,
  sub,
  gradient = false,
}: {
  label: string;
  value: number;
  fmt: StatFmt;
  sub?: string;
  gradient?: boolean;
}) {
  return (
    <div>
      <div className="font-poppins text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
        {label}
      </div>
      <div
        className={`font-jost mt-1 text-[40px] font-bold leading-none tracking-tight tabular-nums md:text-[56px] ${
          gradient ? 'bg-clip-text text-transparent' : 'text-white'
        }`}
        style={gradient ? { backgroundImage: 'linear-gradient(115deg, #ff9e00, #ff2e7e)' } : undefined}
      >
        <CountUp value={value} format={FMT[fmt]} />
      </div>
      {sub && <div className="font-poppins mt-1.5 text-[12px] text-white/55">{sub}</div>}
    </div>
  );
}

/* ─────────────────────────── the monthly record ─────────────────────────── */

export interface RescueBucket {
  /** "Jun", "Jul" … — already formatted by the server. */
  label: string;
  /** HEX saved (claimable at rescue time) in this bucket. */
  hex: number;
  /** Rescues in this bucket. */
  count: number;
}

/**
 * HEX saved, bucket by bucket. Single series, so the title is the legend;
 * bars grow once from the baseline; each bar carries its own hover readout
 * and the tallest is direct-labeled so the chart reads without a pointer.
 */
export function SavedChart({ buckets, price, unit }: { buckets: RescueBucket[]; price: number | null; unit: string }) {
  const { on, instant } = useSettled();
  const [hover, setHover] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  if (buckets.length === 0) return null;

  const W = 640;
  const H = 190;
  const PAD_X = 6;
  const BASE = H - 26;
  const max = Math.max(...buckets.map((b) => b.hex), 1);
  const peak = buckets.reduce((m, b, i) => (b.hex > buckets[m].hex ? i : m), 0);
  const bw = (W - PAD_X * 2) / buckets.length;

  const fmt = (n: number) =>
    n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : `${Math.round(n)}`;
  const usd = (n: number) =>
    price == null ? null : `$${(n * price) >= 1e6 ? `${((n * price) / 1e6).toFixed(2)}M` : (n * price).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-poppins text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          HEX saved, {unit}
        </div>
        <div className="font-poppins text-[10px] text-[var(--text-faint)] tabular-nums">
          {buckets.reduce((s, b) => s + b.count, 0).toLocaleString()} rescues
        </div>
      </div>
      <div ref={wrap} className="relative mt-3" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`HEX saved, ${unit}`}>
          <line x1={PAD_X} y1={BASE} x2={W - PAD_X} y2={BASE} stroke="var(--line)" strokeWidth="1.5" />
          {buckets.map((b, i) => {
            const h = Math.max(3, (b.hex / max) * (BASE - 34));
            // 2px surface gap between bars, and a width cap so a young record
            // with two buckets draws two bars rather than two slabs.
            const w = Math.min(96, Math.max(2, bw - 2));
            const x = PAD_X + i * bw + (bw - w) / 2;
            return (
              <g key={b.label + i}>
                {/* the mark, growing once from the baseline */}
                <rect
                  x={x}
                  y={BASE - (on ? h : 3)}
                  width={w}
                  height={on ? h : 3}
                  rx={Math.min(4, w / 2)}
                  fill="var(--viz-a)"
                  opacity={hover == null || hover === i ? 1 : 0.45}
                  style={{
                    transition: instant
                      ? 'opacity 0.15s ease'
                      : `height 0.9s ${EASE} ${i * 60}ms, y 0.9s ${EASE} ${i * 60}ms, opacity 0.15s ease`,
                  }}
                />
                {/* hit target wider than the mark */}
                <rect
                  x={PAD_X + i * bw}
                  y={0}
                  width={bw}
                  height={H}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                />
                <text
                  x={x + w / 2}
                  y={H - 8}
                  textAnchor="middle"
                  className="font-poppins"
                  fontSize="11"
                  fill="var(--text-faint)"
                >
                  {b.label}
                </text>
                {/* the tallest bar carries its figure; the rest answer on hover */}
                {i === peak && hover == null && (
                  <text
                    x={x + w / 2}
                    y={BASE - h - 8}
                    textAnchor="middle"
                    className="font-jost"
                    fontSize="14"
                    fontWeight="700"
                    fill="var(--text)"
                  >
                    {fmt(b.hex)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hover != null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1.5 text-center shadow-lg backdrop-blur"
            style={{ left: `${((PAD_X + hover * bw + bw / 2) / W) * 100}%` }}
          >
            <div className="font-jost text-[15px] font-bold leading-tight text-[var(--text)] tabular-nums">
              {fmt(buckets[hover].hex)} HEX
            </div>
            <div className="font-poppins whitespace-nowrap text-[10px] text-[var(--text-muted)] tabular-nums">
              {buckets[hover].count.toLocaleString()} rescues
              {usd(buckets[hover].hex) ? ` · ${usd(buckets[hover].hex)}` : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────── per-stake visuals ───────────────────── */

/**
 * A compact donut: how much of a stake's gross return survived to the freeze.
 *
 * Sweeps once on arrival like everything else here. The figure sits inside the
 * ring, and the caller always prints the same number in words nearby — the
 * ring is a second reading of a fact, never the only one.
 */
export function SavedRing({ frac, size = 66 }: { frac: number; size?: number }) {
  const { on, instant } = useSettled();
  const f = Math.max(0, Math.min(1, frac));
  const shown = on ? f : 0;
  const R = 26;
  const LEN = 2 * Math.PI * R;

  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className="shrink-0" role="img"
      aria-label={`${Math.round(f * 100)}% of this stake survived to the freeze`}>
      <circle cx="32" cy="32" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="7" />
      <circle
        cx="32" cy="32" r={R} fill="none"
        stroke="var(--viz-gain)" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={LEN}
        strokeDashoffset={LEN * (1 - shown)}
        transform="rotate(-90 32 32)"
        style={{ transition: instant ? 'none' : `stroke-dashoffset 1.1s ${EASE}` }}
      />
      <text x="32" y="36" textAnchor="middle" className="font-jost" fontSize="16" fontWeight="700" fill="var(--text)">
        {Math.round(f * 100)}%
      </text>
    </svg>
  );
}

export interface WaterfallStep {
  label: string;
  /** Signed: positive adds, negative takes away. */
  delta: number;
  kind: 'base' | 'gain' | 'loss' | 'total';
}

/**
 * The arithmetic of one rescue, drawn: principal, plus what it earned, minus
 * what the penalty took, equals what the owner can still collect.
 *
 * A waterfall rather than a pie because the story is a running balance, and
 * the penalty is the only bar that points down — which is the whole point.
 * Every bar is direct-labeled, so the gain/loss color is a second encoding
 * rather than the only one.
 */
export function Waterfall({ steps, unit = 'HEX' }: { steps: WaterfallStep[]; unit?: string }) {
  const { on, instant } = useSettled();

  // Running balance, so each bar starts where the last one finished.
  let run = 0;
  const bars = steps.map((s) => {
    const from = s.kind === 'total' ? 0 : run;
    const to = s.kind === 'total' ? s.delta : run + s.delta;
    if (s.kind !== 'total') run = to;
    return { ...s, from, to, lo: Math.min(from, to), hi: Math.max(from, to) };
  });
  const peak = Math.max(...bars.map((b) => b.hi), 1);

  const fmt = (n: number) => {
    const a = Math.abs(n);
    return a >= 1e9 ? `${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(2)}M`
      : a >= 1e3 ? `${(a / 1e3).toFixed(1)}K` : `${Math.round(a)}`;
  };
  const colorOf = (k: WaterfallStep['kind']) =>
    k === 'gain' ? 'var(--viz-gain)' : k === 'loss' ? 'var(--viz-loss)' : 'var(--viz-a)';

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="font-poppins text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
        Where the {unit} went
      </div>
      <div className="mt-3 flex items-end gap-2" style={{ height: 168 }}>
        {bars.map((b, i) => {
          const h = ((b.hi - b.lo) / peak) * 118;
          const bottom = (b.lo / peak) * 118;
          return (
            <div key={b.label} className="flex min-w-0 flex-1 flex-col items-center justify-end" style={{ height: '100%' }}>
              {/* Bar and figure share one track, so a floating segment carries
                  its number directly above itself rather than in a top row
                  that reads as belonging to nothing. */}
              <div className="relative w-full" style={{ height: 146 }}>
                <div
                  className="absolute inset-x-1 rounded-[4px]"
                  style={{
                    bottom,
                    height: on ? Math.max(4, h) : 4,
                    background: colorOf(b.kind),
                    transition: instant ? 'none' : `height 0.8s ${EASE} ${i * 90}ms`,
                  }}
                />
                <div
                  className="font-jost absolute inset-x-0 text-center text-[13px] font-bold leading-none tabular-nums"
                  style={{
                    bottom: bottom + (on ? Math.max(4, h) : 4) + 6,
                    color: b.kind === 'loss' ? 'var(--viz-loss)' : 'var(--text)',
                    transition: instant ? 'none' : `bottom 0.8s ${EASE} ${i * 90}ms`,
                  }}
                >
                  {b.kind === 'loss' ? '−' : b.kind === 'gain' ? '+' : ''}{fmt(b.delta)}
                </div>
              </div>
              <div className="font-poppins mt-1.5 w-full truncate text-center text-[10px] text-[var(--text-faint)]">
                {b.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface TimelineStep {
  label: string;
  when: string | null;
  state: 'done' | 'now' | 'todo';
}

/** The stake's story as three or four beats, left to right. */
export function RescueTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="font-poppins text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
        What happened
      </div>
      <div className="mt-3 flex items-start">
        {steps.map((s, i) => (
          <div key={s.label} className="flex min-w-0 flex-1 items-start">
            <div className="flex min-w-0 flex-col items-center text-center">
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold"
                style={{
                  background:
                    s.state === 'done' ? 'var(--viz-gain)' : s.state === 'now' ? 'var(--viz-a)' : 'var(--surface-3)',
                  color: s.state === 'todo' ? 'var(--text-faint)' : '#fff',
                }}
              >
                {s.state === 'done' ? '✓' : i + 1}
              </span>
              <span className="font-poppins mt-1.5 text-[11px] font-semibold leading-tight text-[var(--text)]">
                {s.label}
              </span>
              {s.when && (
                <span className="font-poppins text-[10px] leading-tight text-[var(--text-faint)]">{s.when}</span>
              )}
            </div>
            {i < steps.length - 1 && (
              <span
                className="mt-3.5 h-0.5 min-w-2 flex-1"
                style={{ background: steps[i + 1].state === 'todo' ? 'var(--surface-3)' : 'var(--viz-gain)' }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
