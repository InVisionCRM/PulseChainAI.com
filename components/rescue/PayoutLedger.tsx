'use client';

// The payout ledger: what HEX paid every T-share each day for the past year,
// split by where it came from — inflation, and the stakers' half of early-end
// penalties, other people's late penalties, and the keeper's rescues.
//
// Read as an account: the ledger at the top is the legend, the readout and the
// key at once. It shows the day under the pointer (or the latest day) beside
// the year's totals. The bars below draw only what each day added on top of
// inflation — the three penalty lines, stacked from zero. Inflation is ~1.6
// HEX per T-share every day and moves by fractions of a percent, so drawn it
// was a flat block filling most of the plot; it is the ledger's first line.
//
// Every figure comes from lib/hex/payoutDays.ts, which reconciles each day to
// the heart against the contract before it is stored.
//
// Colors: --viz-a/b/c are the page's validated data steps; re-validated on
// this card's ledger-paper surfaces (#fbfaf7 light, #101317 dark) with the
// dataviz palette checker in stacking order (early ends, late, ours) — all
// checks pass. Orange↔pink sits in the tritan 6–8 floor band in light mode, so
// the stack keeps a surface gap between segments and every series is named in
// the ledger beside its swatch.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { IBM_Plex_Mono } from 'next/font/google';
import { hexDayToDate } from '@/lib/hex/hexDay';
import { EASE, useSettled } from '@/components/hex/Instruments';

const plex = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], display: 'swap' });

/** One closed day, in HEX per T-share. */
export interface LedgerDay {
  day: number;
  inflation: number;
  ees: number;
  late: number;
  ours: number;
  eesCount: number;
  lateCount: number;
  oursCount: number;
}

type Key = 'inflation' | 'ees' | 'late' | 'ours';
const SERIES: { key: Key; label: string; color: string; count?: 'eesCount' | 'lateCount' | 'oursCount' }[] = [
  { key: 'inflation', label: 'Inflation', color: 'var(--ledger-base)' },
  { key: 'ees', label: 'Early-end penalties', color: 'var(--viz-c)', count: 'eesCount' },
  { key: 'late', label: 'Late penalties, others', color: 'var(--viz-b)', count: 'lateCount' },
  { key: 'ours', label: 'Our rescues', color: 'var(--viz-a)', count: 'oursCount' },
];
const COLOR = Object.fromEntries(SERIES.map((s) => [s.key, s.color])) as Record<Key, string>;

const PLOT_H = 190;
const AXIS_W = 30;
/** Surface gap between stacked segments, px. */
const SEG_GAP = 1;
/** One row of cut-bar values above the plot, px. */
const LABEL_ROW = 13;
/** Room under the plot for month names and, below them, the year. */
const AXIS_BAND = 34;

/** The penalty lines, bottom to top, as the bars stack them. */
const PENALTIES = ['ees', 'late', 'ours'] as const;
/** What a day added on top of inflation: the height of its bar. */
const extra = (d: Pick<LedgerDay, Key>) => d.ees + d.late + d.ours;
const dateOf = (day: number, withYear = true) =>
  hexDayToDate(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' });

/** IBM Plex Mono advances 0.6em, so a 10px label is 6px a character. */
const CHAR_PX = 6;

/**
 * A total that foots: the sum of the lines as they are printed, not of the
 * unrounded values, so the column always adds up to what it says.
 */
const footed = (row: Pick<LedgerDay, Key>, digits: number) =>
  SERIES.reduce((sum, s) => sum + Number(row[s.key].toFixed(digits)), 0).toFixed(digits);

/** Per-T-share amounts: "—" for nothing, "<0.0001" rather than a false zero. */
function fmtPer(v: number, digits: number): string {
  if (v === 0) return '—';
  const floor = 10 ** -digits;
  return v < floor ? `<${floor.toFixed(digits)}` : v.toFixed(digits);
}

/**
 * The plot's top: the 99th-percentile day, rounded up to the next half, never
 * below 0.5. Half of all days add under 0.02 HEX per T-share, while one huge
 * early end added 15.9, so a scale that fits the tallest flattens everything
 * else. On the year to day 2499 this is 2.0: three days are drawn cut (3.37,
 * 6.77, 15.87, all early ends) with their value printed above, and the keeper's
 * biggest day (0.89, Oct 5) stands at 44% of the plot.
 */
function capOf(days: LedgerDay[]): number {
  const v = days.map(extra).sort((a, b) => a - b);
  const p99 = v[Math.min(v.length - 1, Math.floor(v.length * 0.99))];
  return Math.max(0.5, Math.ceil(p99 * 2) / 2);
}

export function PayoutLedger({ days }: { days: LedgerDay[] }) {
  const { on, instant } = useSettled();
  const [picked, setPicked] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const [table, setTable] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = days.length;
  const last = n - 1;
  const sel = picked ?? last;
  const cap = useMemo(() => capOf(days), [days]);
  const year = useMemo(() => {
    const sum = { inflation: 0, ees: 0, late: 0, ours: 0, eesCount: 0, lateCount: 0, oursCount: 0 };
    for (const d of days) for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += d[k];
    return sum;
  }, [days]);
  const firstRescue = days.findIndex((d) => d.oursCount > 0);

  const plotW = Math.max(0, width - AXIS_W);
  const slot = n ? plotW / n : 0;
  // Bars snap to whole pixels, each at least 1px wide, so they render solid
  // instead of as sub-pixel stripes, and no day vanishes on a narrow screen.
  const barX = (i: number) => Math.round(i * slot);
  const barW = (i: number) => Math.max(1, Math.round((i + 1) * slot) - barX(i));

  // Days whose bar runs past the top. Each gets an up-mark over its bar; the
  // values are labelled over their own bars, consecutive days sharing one
  // label over the pair ("15.87 · 6.77", Jun 4–5), each label on the lowest
  // row where it does not touch another.
  const { marks, broken } = useMemo(() => {
    const cx = (i: number) => AXIS_W + barX(i) + barW(i) / 2;
    const marks = days.flatMap((d, i) => (extra(d) > cap ? [{ i, cx: cx(i), v: extra(d) }] : []));
    const runs: { from: number; to: number; text: string }[] = [];
    for (const m of marks) {
      const prev = runs[runs.length - 1];
      if (prev && prev.to === m.i - 1) {
        prev.to = m.i;
        prev.text += ` · ${m.v.toFixed(2)}`;
      } else runs.push({ from: m.i, to: m.i, text: m.v.toFixed(2) });
    }
    const rowEnds: number[] = [];
    const broken = runs.map((r) => {
      const w = r.text.length * CHAR_PX;
      const x = Math.min(width - w, Math.max(AXIS_W, (cx(r.from) + cx(r.to)) / 2 - w / 2));
      let row = rowEnds.findIndex((end) => end + 6 <= x);
      if (row === -1) row = rowEnds.length;
      rowEnds[row] = x + w;
      return { key: r.from, x, text: r.text, row };
    });
    return { marks, broken };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, cap, width, slot]);
  const rows = broken.reduce((m, b) => Math.max(m, b.row + 1), 0);
  /** Top of the plot: room for the cut-bar values and their marks. */
  const top = rows ? rows * LABEL_ROW + 8 : 6;
  const y = (v: number) => top + PLOT_H - (Math.min(v, cap) / cap) * PLOT_H;
  const svgH = top + PLOT_H + AXIS_BAND;

  // The bars are the heavy part (three rects × 365 days) and do not depend on
  // the pointer, so they are drawn once per size, not once per hover.
  const bars = useMemo(() => {
    if (!plotW) return null;
    return days.map((d, i) => {
      let base = 0;
      const segs = PENALTIES.map((k, j) => {
        const y0 = y(base);
        base += d[k];
        const y1 = y(base);
        // The gap comes off the top of every segment that has another above
        // it, and only when the segment is tall enough to keep a body.
        const h = y0 - y1;
        const gap = j < PENALTIES.length - 1 && h > SEG_GAP * 2 ? SEG_GAP : 0;
        return h > 0 ? <rect key={k} x={barX(i)} y={y1 + gap} width={barW(i)} height={h - gap} fill={COLOR[k]} /> : null;
      });
      return <g key={d.day}>{segs}</g>;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, plotW, slot, cap, top]);

  if (!n) return null;

  const step = cap <= 2 ? 0.5 : 1;
  const ticks = Array.from({ length: Math.floor(cap / step) + 1 }, (_, i) => i * step);

  // Every month's name at its first day; the year under the first one shown
  // and under each January. Skipped only if it would touch the one before.
  const monthLabels: { i: number; x: number; text: string; year: string | null }[] = [];
  days.forEach((d, i) => {
    const date = hexDayToDate(d.day);
    if (date.getUTCDate() !== 1) return;
    const text = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    // Kept inside the card at the right edge rather than dropped.
    const x = Math.min(AXIS_W + barX(i), width - text.length * CHAR_PX);
    const prev = monthLabels[monthLabels.length - 1];
    if (prev && x < prev.x + prev.text.length * CHAR_PX + 4) return;
    const yearLine = !prev || date.getUTCMonth() === 0 ? String(date.getUTCFullYear()) : null;
    monthLabels.push({ i, x, text, year: yearLine });
  });

  const pickAt = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || !slot) return;
    const i = Math.floor((clientX - r.left - AXIS_W) / slot);
    if (i >= 0 && i < n) setPicked(i);
  };
  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, PageUp: -30, PageDown: 30 }[e.key];
    if (step) setPicked(Math.max(0, Math.min(last, sel + step)));
    else if (e.key === 'Home') setPicked(0);
    else if (e.key === 'End') setPicked(null);
    else return;
    e.preventDefault();
  };

  const d = days[sel];
  const reveal = (i: number) => ({
    opacity: on ? 1 : 0,
    transform: on ? 'none' : 'translateY(6px)',
    transition: instant ? 'none' : `opacity 500ms ${EASE} ${120 + i * 70}ms, transform 500ms ${EASE} ${120 + i * 70}ms`,
  });

  return (
    <section
      aria-labelledby="payout-ledger-title"
      className={`${plex.className} relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--ledger-paper)] p-4 [--ledger-base:#c3c8d1] [--ledger-paper:#fbfaf7] dark:[--ledger-base:#3a3f48] dark:[--ledger-paper:#101317] md:p-6`}
    >
      <div className="font-poppins text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
        The payout ledger · past {n} days
      </div>
      <h2 id="payout-ledger-title" className="font-jost mt-1 text-[22px] font-bold leading-tight tracking-tight text-[var(--text)] md:text-[26px]">
        What every T-share was paid, and where it came from
      </h2>
      <p className="font-poppins mt-1 max-w-2xl text-[12px] text-[var(--text-muted)]">
        HEX pays stakers each day’s inflation plus half of every penalty collected — the other half goes to the
        Origin Address. Every day below is read from the contract and checked against it to the last heart.
      </p>

      {/* ── The ledger: the selected day beside the year ── */}
      <div className="mt-5 grid gap-x-10 gap-y-5 sm:grid-cols-2">
        {[
          {
            head: picked == null ? `Latest day · ${dateOf(d.day)}` : dateOf(d.day),
            sub: `HEX day ${d.day.toLocaleString()}`,
            row: d,
            digits: 4,
            totalLabel: 'HEX per T-share',
            live: true,
          },
          {
            head: `Past ${n} days`,
            sub: `${dateOf(days[0].day)} – ${dateOf(days[last].day)}`,
            row: year,
            digits: 2,
            totalLabel: 'HEX per T-share, in total',
            live: false,
          },
        ].map((col) => (
          <div key={col.head + col.live}>
            <div className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] pb-1.5">
              <span className="font-poppins text-[12px] font-semibold text-[var(--text)]" aria-live={col.live ? 'polite' : undefined}>
                {col.head}
              </span>
              <span className="font-poppins text-[10px] text-[var(--text-faint)]">{col.sub}</span>
            </div>
            <table className="mt-1.5 w-full border-collapse text-[12.5px] tabular-nums">
              <tbody>
                {SERIES.map((s, i) => (
                  <tr key={s.key} style={reveal(i)}>
                    <td className="w-4 py-[3px] pr-1 align-middle text-[var(--text-faint)]">{i === 0 ? '' : '+'}</td>
                    <td className="py-[3px] pr-3 text-right font-medium text-[var(--text)]">{fmtPer(col.row[s.key], col.digits)}</td>
                    <td className="py-[3px]">
                      <span className="font-poppins inline-flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
                        <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: s.color }} />
                        {s.label}
                      </span>
                    </td>
                    <td className="py-[3px] pl-2 text-right text-[11px] text-[var(--text-faint)]">
                      {s.count && col.row[s.count] > 0 ? col.row[s.count].toLocaleString() : ''}
                    </td>
                  </tr>
                ))}
                <tr style={reveal(SERIES.length)}>
                  <td />
                  <td className="border-t-[3px] border-double border-[var(--text-faint)] pr-3 pt-1 text-right text-[15px] font-semibold text-[var(--text)]">
                    {footed(col.row, col.digits)}
                  </td>
                  <td colSpan={2} className="pt-1 font-poppins text-[12px] font-semibold text-[var(--text)]">
                    {col.totalLabel}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <p className="font-poppins mt-2 text-[10px] text-[var(--text-faint)]">
        Counts are the stakes each penalty came from. Point at, tap or arrow through the bars to read any day
        {picked != null && (
          <>
            {' · '}
            <button type="button" onClick={() => setPicked(null)} className="underline decoration-dotted underline-offset-2 hover:text-[var(--text)]">
              back to the latest day
            </button>
          </>
        )}
        .
      </p>

      {/* ── The bars: what each day added on top of inflation ── */}
      <div className="font-poppins mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
        Added on top of inflation · HEX per T-share, by day
      </div>
      <div
        ref={box}
        tabIndex={0}
        role="group"
        aria-label={`What penalties added to each T-share's payout, by day, for the past ${n} days. Use the arrow keys to move between days; the ledger above reads the selected day.`}
        onKeyDown={onKey}
        onPointerDown={(e) => pickAt(e.clientX)}
        onPointerMove={(e) => e.pointerType === 'mouse' && pickAt(e.clientX)}
        className="relative mt-2 touch-pan-y select-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--viz-a)]"
        style={{ height: svgH }}
      >
        {width > 0 && (
          <svg width={width} height={svgH} className="block overflow-visible" aria-hidden>
            {/* grid + y ticks: hairline, recessive */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={AXIS_W} x2={width} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} shapeRendering="crispEdges" />
                <text x={AXIS_W - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--text-faint)">
                  {t}
                </text>
              </g>
            ))}

            <g
              shapeRendering="crispEdges"
              style={{
                transformOrigin: `0 ${top + PLOT_H}px`,
                transform: `translate(${AXIS_W}px, 0) scaleY(${on ? 1 : 0})`,
                transition: instant ? 'none' : `transform 900ms ${EASE} 150ms`,
              }}
            >
              {bars}
            </g>

            {/* Cut bars: a small up-mark where each leaves the plot, and the
                values above. */}
            {marks.map((m) => (
              <path key={m.i} d={`M${m.cx - 3.5} ${top - 1} L${m.cx} ${top - 6} L${m.cx + 3.5} ${top - 1} Z`} fill="var(--text-muted)" />
            ))}
            {broken.map((b) => (
              <text key={b.key} x={b.x} y={top - 10 - b.row * LABEL_ROW} fontSize={10} fontWeight={500} fill="var(--text-muted)">
                {b.text}
              </text>
            ))}

            {/* the picked day: a hairline, only while one is picked */}
            {picked != null && (
              <line
                x1={AXIS_W + barX(picked) + Math.floor(barW(picked) / 2) + 0.5}
                x2={AXIS_W + barX(picked) + Math.floor(barW(picked) / 2) + 0.5}
                y1={top}
                y2={top + PLOT_H}
                stroke="var(--text)"
                strokeOpacity={0.55}
                strokeWidth={1}
              />
            )}

            {/* the keeper's first rescue */}
            {firstRescue > 0 && (
              <g>
                <line
                  x1={AXIS_W + barX(firstRescue)}
                  x2={AXIS_W + barX(firstRescue)}
                  y1={top + 4}
                  y2={top + PLOT_H}
                  stroke="var(--text-faint)"
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                {/* A paper-colored halo keeps it legible where it crosses a bar. */}
                <text
                  x={AXIS_W + barX(firstRescue) - 4}
                  y={top + 12}
                  textAnchor="end"
                  fontSize={10}
                  fill="var(--text-muted)"
                  stroke="var(--ledger-paper)"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {width < 640 ? 'first rescue' : 'keeper’s first rescue'}
                </text>
              </g>
            )}

            {/* month names, the year beneath where it changes */}
            {monthLabels.map((m) => (
              <g key={m.i}>
                <text x={m.x} y={top + PLOT_H + 15} fontSize={10} fill="var(--text-faint)">
                  {m.text}
                </text>
                {m.year && (
                  <text x={m.x} y={top + PLOT_H + 28} fontSize={9} fill="var(--text-faint)">
                    {m.year}
                  </text>
                )}
              </g>
            ))}
          </svg>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-poppins max-w-2xl text-[10px] text-[var(--text-faint)]">
          Inflation — about {days[last].inflation.toFixed(2)} HEX per T-share every day — is the ledger’s first line and
          isn’t drawn. Bars over {cap} are cut, with their value above. Days are HEX days, closed by the contract after
          00:00 UTC.
        </p>
        <button
          type="button"
          onClick={() => setTable((t) => !t)}
          aria-expanded={table}
          className="font-poppins text-[11px] font-medium text-[var(--text-muted)] underline decoration-dotted underline-offset-2 hover:text-[var(--text)]"
        >
          {table ? 'Hide the table' : 'Show as a table'}
        </button>
      </div>

      {table && (
        <div className="mt-3 max-h-80 overflow-auto rounded-lg border border-[var(--line)]">
          <table className="w-full border-collapse text-[11.5px] tabular-nums">
            <thead className="sticky top-0 bg-[var(--ledger-paper)]">
              <tr className="font-poppins text-left text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
                <th className="px-3 py-2 font-semibold">Day</th>
                {SERIES.map((s) => (
                  <th key={s.key} className="px-3 py-2 text-right font-semibold">{s.label}</th>
                ))}
                <th className="px-3 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((r) => (
                <tr key={r.day} className="border-t border-[var(--line)] text-[var(--text)]">
                  <td className="px-3 py-1.5 text-[var(--text-muted)]">{dateOf(r.day)}</td>
                  {SERIES.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 text-right">{fmtPer(r[s.key], 4)}</td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-semibold">{footed(r, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
