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
// marks use --viz-* set per theme on the page wrapper — every pair runs through
// the dataviz palette validator against this app's actual light and dark
// surfaces (lightness band, CVD separation, contrast all pass).
//
// The generic pieces (Speedo, BigStat, HeroNumber, useSettled) now live in
// components/hex/Instruments.tsx; what stays here is rescue-shaped.

import { useRef, useState } from 'react';
import { EASE, useSettled } from '@/components/hex/Instruments';

// The generic instruments moved to components/hex/Instruments so the
// Strategist's tabs could use them too; re-exported here so every existing
// rescue import keeps working.
export { Speedo, BigStat, HeroNumber, type StatFmt } from '@/components/hex/Instruments';

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

/* ───────────────────── what the stake has been worth ───────────────────── */

export interface ValueMark {
  key: 'start' | 'high' | 'low' | 'now';
  label: string;
  /** USD value of the stake's HEX at this moment; null when unavailable. */
  usd: number | null;
  /** pHEX price at this moment. */
  price: number | null;
  /** "Sep 27, 2025" — already formatted by the server. */
  when: string | null;
}

/**
 * A stake's worth over its life: a price line with the four moments marked,
 * over four tiles reading start / peak / low / now.
 *
 * ONE fixed pile of HEX priced at four different moments — never a changing
 * amount at a changing price, which would make the four figures
 * incomparable. The caller states the amount in the heading so the basis is
 * never in doubt.
 *
 * A marker that has no data (a stake older than the price history) draws as
 * an em dash rather than being clamped to the oldest price we hold, which
 * would put a number on screen that was never real.
 */
export function ValueJourney({
  points,
  marks,
  basisHex,
  note,
}: {
  /** Daily closes, oldest first, as [unixMs, usd]. */
  points: [number, number][];
  marks: ValueMark[];
  basisHex: string;
  note?: string;
}) {
  const { on, instant } = useSettled();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;

  const W = 640;
  const H = 120;
  const PAD = 4;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const t0 = Math.min(...xs);
  const t1 = Math.max(...xs);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const px = (t: number) => PAD + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD * 2);
  // Log scale: pHEX ran 16x between its low and high over a year, and a
  // linear axis flattens everything below the spike into the baseline.
  const ly = (v: number) => Math.log(Math.max(v, 1e-12));
  const py = (v: number) =>
    H - PAD - ((ly(v) - ly(lo)) / Math.max(1e-9, ly(hi) - ly(lo))) * (H - PAD * 2);

  const d = points.map((p, i) => `${i ? 'L' : 'M'}${px(p[0]).toFixed(1)} ${py(p[1]).toFixed(1)}`).join(' ');
  const area = `${d} L${px(t1).toFixed(1)} ${H} L${px(t0).toFixed(1)} ${H} Z`;

  const dotFor = (m: ValueMark) => {
    if (m.price == null || m.when == null) return null;
    const hit = points.reduce((best, p) =>
      Math.abs(p[1] - m.price!) < Math.abs(best[1] - m.price!) ? p : best, points[0]);
    return { x: px(hit[0]), y: py(m.price) };
  };

  const usd = (n: number | null) =>
    n == null ? '—'
      : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M`
      : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K`
      : `$${n.toFixed(2)}`;

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="font-poppins text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          What this {basisHex} HEX has been worth
        </div>
        {note && <div className="font-poppins text-[10px] text-[var(--text-faint)]">{note}</div>}
      </div>

      <div className="relative mt-3" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="pHEX price over this stake's life">
          <defs>
            <linearGradient id="vj-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--viz-a)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--viz-a)" stopOpacity="0" />
            </linearGradient>
            <clipPath id="vj-clip">
              <rect x="0" y="0" width={on ? W : 0} height={H}
                style={{ transition: instant ? 'none' : `width 1.1s ${EASE}` }} />
            </clipPath>
          </defs>
          <g clipPath="url(#vj-clip)">
            <path d={area} fill="url(#vj-fill)" />
            <path d={d} fill="none" stroke="var(--viz-a)" strokeWidth="2" strokeLinejoin="round" />
          </g>
          {marks.map((m) => {
            const pt = dotFor(m);
            if (!pt) return null;
            const tone = m.key === 'high' ? 'var(--viz-gain)' : m.key === 'low' ? 'var(--viz-loss)' : 'var(--text)';
            return (
              <circle key={m.key} cx={pt.x} cy={pt.y} r={hover === null ? 4.5 : 4.5}
                fill={tone} stroke="var(--surface)" strokeWidth="2" />
            );
          })}
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {marks.map((m) => (
          <div key={m.key} className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-2">
            <div className="font-poppins truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
              {m.label}
            </div>
            <div
              className="font-jost mt-0.5 text-[20px] font-bold leading-none tabular-nums"
              style={{
                color:
                  m.usd == null ? 'var(--text-faint)'
                    : m.key === 'high' ? 'var(--viz-gain)'
                    : m.key === 'low' ? 'var(--viz-loss)'
                    : 'var(--text)',
              }}
            >
              {usd(m.usd)}
            </div>
            <div className="font-poppins mt-0.5 truncate text-[10px] tabular-nums text-[var(--text-faint)]">
              {m.when ?? 'before our price data'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
