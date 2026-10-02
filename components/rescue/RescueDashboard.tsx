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

import { useEffect, useRef, useState } from 'react';
import { EASE, useSettled } from '@/components/hex/Instruments';

// The generic instruments moved to components/hex/Instruments so the
// Strategist's tabs could use them too; re-exported here so every existing
// rescue import keeps working.
export { Speedo, BigStat, HeroNumber, type StatFmt } from '@/components/hex/Instruments';

/* ─────────────────────────── the record over time ─────────────────────────── */

export interface RescueBucket {
  /** Axis label: "Sep 19" or "Sep" — already formatted by the server. */
  label: string;
  /** Tooltip heading: "Fri, Sep 19", "Week of Sep 15", "September 2026". */
  title: string;
  /** HEX saved (claimable at rescue time) in this bucket. */
  hex: number;
  /** Rescues in this bucket. */
  count: number;
}

type Metric = 'count' | 'hex';

const compact = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : `${Math.round(n)}`;

/** Smallest clean step at or above n whose half is clean too, since the axis
 *  ticks at top and top/2 — a top of 25 put "12.5 stakes" on the midline. */
function niceCeil(n: number, whole: boolean): number {
  if (n <= 0) return 2;
  const p = 10 ** Math.floor(Math.log10(n));
  const top = ([1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10].find((m) => m * p >= n) ?? 10) * p;
  // Whole-number measures (stake counts) need an even top below 10.
  return whole && top % 2 ? top + 1 : top;
}

/**
 * Where the y-axis tops out. Linear and from zero, but CAPPED when a few
 * buckets dwarf the rest: the launch backlog put 602 rescues on one day
 * against ~8 on an ordinary one, and an honest-looking axis to 602 flattens
 * every normal day into the baseline. Bars past the cap are drawn full height
 * with a break mark and carry their real value as text, so nothing is hidden.
 */
function axisTop(values: number[], whole: boolean): { top: number; capped: boolean } {
  const max = Math.max(...values, 0);
  const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
  const p85 = sorted[Math.floor(sorted.length * 0.85)] ?? max;
  if (sorted.length >= 8 && max > p85 * 4) return { top: niceCeil(p85 * 1.6, whole), capped: true };
  return { top: niceCeil(max, whole), capped: false };
}

/**
 * The record, bucket by bucket: stakes rescued or HEX saved — one measure at a
 * time on one axis, switched, never two scales at once.
 *
 * Built from HTML rather than a scaled SVG on purpose: a viewBox shrinks its
 * text with the chart, which on a phone drew the 45 day labels at ~5px on top
 * of each other. Here bars are flex columns with a true 2px gap, and the axis
 * shows only as many dates as fit the measured width, anchored on the latest.
 */
export function SavedChart({ buckets, price, unit }: { buckets: RescueBucket[]; price: number | null; unit: string }) {
  const { on, instant } = useSettled();
  const [metric, setMetric] = useState<Metric>('count');
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(640);
  const plot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = plot.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (buckets.length === 0) return null;

  const n = buckets.length;
  const values = buckets.map((b) => (metric === 'count' ? b.count : b.hex));
  const { top, capped } = axisTop(values, metric === 'count');
  // Neighbouring bars past the cap share one label ("58 · 592 · 280"): three
  // labels over three 6px bars printed on top of each other.
  const runs: { from: number; to: number }[] = [];
  values.forEach((v, i) => {
    if (v <= top) return;
    const last = runs[runs.length - 1];
    if (last && last.to === i - 1) last.to = i;
    else runs.push({ from: i, to: i });
  });
  const peak = values.reduce((m, v, i) => (v > values[m] ? i : m), 0);
  const ticks = [top, top / 2, 0];
  const fmtV = (v: number) => (metric === 'count' ? Math.round(v).toLocaleString() : compact(v));
  const pct = (i: number) => ((i + 0.5) / n) * 100;
  // Runs close together on a narrow screen still collide, so each label takes
  // the lowest row it fits on — estimated at 7px a character of 12px Jost.
  const labels = (capped ? runs : values[peak] > 0 ? [{ from: peak, to: peak }] : []).map(({ from, to }) => ({
    at: (pct(from) + pct(to)) / 2,
    text: values.slice(from, to + 1).map(fmtV).join(' · '),
    row: 0,
  }));
  const rowEnds: number[] = [];
  for (const l of labels) {
    const w = l.text.length * 7;
    const c = (l.at / 100) * width;
    const left = l.at < 12 ? c : l.at > 88 ? c - w : c - w / 2;
    let row = rowEnds.findIndex((end) => end + 8 <= left);
    if (row === -1) row = rowEnds.length;
    rowEnds[row] = left + w;
    l.row = row;
  }
  const rows = capped ? rowEnds.length : 0;

  // One date per ~58px, counted back from the newest so today is always named.
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(width / 58))));
  const showLabel = (i: number) => (n - 1 - i) % every === 0;
  // Stagger capped at ~0.7s in total — 45 bars × 60ms read as a slow wipe.
  const step = Math.min(60, 700 / n);
  const usd = (hex: number) => (price == null ? null : fmtUsd(hex * price));

  const total = metric === 'count'
    ? `${buckets.reduce((a, b) => a + b.count, 0).toLocaleString()} rescues`
    : `${compact(buckets.reduce((a, b) => a + b.hex, 0))} HEX`;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-poppins text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          {metric === 'count' ? 'Stakes rescued' : 'HEX saved'}, {unit}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-poppins text-[10px] tabular-nums text-[var(--text-faint)]">{total}</span>
          <div role="group" aria-label="Measure" className="flex rounded-full border border-[var(--line)] p-0.5">
            {([['count', 'Stakes'], ['hex', 'HEX']] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setMetric(k)}
                aria-pressed={metric === k}
                className={`font-poppins rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  metric === k ? 'bg-[var(--surface-3)] text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2" style={{ marginTop: 16 + Math.max(0, rows - 1) * 15 }}>
        {/* y ticks: clean numbers, recessive ink */}
        <div className="font-poppins relative h-40 w-9 shrink-0 text-right text-[10px] tabular-nums text-[var(--text-faint)]">
          {ticks.map((v, i) => (
            <span key={i} className="absolute right-0 -translate-y-1/2" style={{ top: `${(i / 2) * 100}%` }}>
              {fmtV(v)}{i === 0 && capped ? '+' : ''}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div
            ref={plot}
            className="relative h-40"
            onPointerLeave={() => setHover(null)}
          >
            {ticks.map((_, i) => (
              <div
                key={i}
                aria-hidden
                className="absolute inset-x-0 border-t"
                style={{ top: `${(i / 2) * 100}%`, borderColor: 'var(--line)', borderStyle: i === 2 ? 'solid' : 'dashed', opacity: i === 2 ? 1 : 0.6 }}
              />
            ))}

            <div className="absolute inset-0 flex items-end gap-[2px]">
              {buckets.map((b, i) => {
                const v = values[i];
                const over = v > top;
                const h = v === 0 ? 0 : Math.max(2, (Math.min(v, top) / top) * 100);
                return (
                  <div
                    key={b.title}
                    className="relative flex h-full min-w-0 flex-1 items-end"
                    onPointerEnter={() => setHover(i)}
                    onPointerDown={() => setHover(i)}
                  >
                    <div
                      className="w-full rounded-t-[4px]"
                      style={{
                        height: on ? `${h}%` : '0%',
                        // A bar past the cap gets a real transparent gap cut
                        // near its top — the break. (--surface is translucent,
                        // so painting it over the bar showed nothing.)
                        background: over
                          ? 'linear-gradient(to bottom, var(--viz-a) 0 6px, transparent 6px 10px, var(--viz-a) 10px)'
                          : 'var(--viz-a)',
                        opacity: hover == null || hover === i ? 1 : 0.45,
                        transition: instant
                          ? 'opacity 0.15s ease'
                          : `height 0.9s ${EASE} ${Math.round(i * step)}ms, opacity 0.15s ease`,
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* direct labels: each run of bars past the cap, or the tallest when none is */}
            {hover == null &&
              labels.map((l) => (
                <span
                  key={l.at}
                  className="font-jost pointer-events-none absolute whitespace-nowrap text-[12px] font-bold leading-none text-[var(--text)] tabular-nums"
                  style={{
                    left: `${l.at}%`,
                    top: capped ? `${-4 - l.row * 15}px` : `calc(${100 - (values[peak] / top) * 100}% - 4px)`,
                    transform: `translate(${l.at < 12 ? '0' : l.at > 88 ? '-100%' : '-50%'}, -100%)`,
                  }}
                >
                  {l.text}
                </span>
              ))}

            {hover != null && (
              <div
                className="pointer-events-none absolute top-0 z-10 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1.5 shadow-lg"
                style={{
                  left: `${pct(hover)}%`,
                  // Pin to the side it is on, so the edge bars' readout stays inside the card.
                  transform: pct(hover) < 25 ? 'translateX(0)' : pct(hover) > 75 ? 'translateX(-100%)' : 'translateX(-50%)',
                }}
              >
                <div className="font-poppins whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
                  {buckets[hover].title}
                </div>
                <div className="font-jost whitespace-nowrap text-[15px] font-bold leading-tight text-[var(--text)] tabular-nums">
                  {buckets[hover].count.toLocaleString()} {buckets[hover].count === 1 ? 'stake' : 'stakes'}
                </div>
                <div className="font-poppins whitespace-nowrap text-[11px] text-[var(--text-muted)] tabular-nums">
                  {compact(buckets[hover].hex)} HEX saved
                  {usd(buckets[hover].hex) ? ` · ${usd(buckets[hover].hex)}` : ''}
                </div>
              </div>
            )}
          </div>

          {/* x labels: HTML, so they stay 10px on every screen */}
          <div className="font-poppins relative mt-1.5 h-4 text-[10px] text-[var(--text-faint)]">
            {buckets.map((b, i) =>
              showLabel(i) ? (
                <span
                  key={b.title}
                  className="absolute top-0 whitespace-nowrap tabular-nums"
                  style={{
                    left: `${pct(i)}%`,
                    transform: pct(i) < 6 ? 'translateX(0)' : pct(i) > 94 ? 'translateX(-100%)' : 'translateX(-50%)',
                  }}
                >
                  {b.label}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>

      {capped && (
        <p className="font-poppins mt-2 text-[10px] text-[var(--text-faint)]">
          Axis capped at {fmtV(top)} so ordinary {unit.split(' ')[0]}s stay readable — broken bars run past it, their real values printed above.
        </p>
      )}

      <table className="sr-only">
        <caption>{metric === 'count' ? 'Stakes rescued' : 'HEX saved'}, {unit}</caption>
        <thead><tr><th>Period</th><th>Stakes</th><th>HEX saved</th></tr></thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.title}><td>{b.title}</td><td>{b.count}</td><td>{Math.round(b.hex)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const fmtUsd = (n: number) =>
  `$${n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

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
