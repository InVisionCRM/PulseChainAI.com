'use client';

// The payout ledger: what HEX paid every T-share each day for the past year,
// split by where it came from — inflation, and the stakers' half of early-end
// penalties, other people's late penalties, and the keeper's rescues.
//
// Read as an account: the ledger at the top is the legend, the readout and the
// key at once. It shows the day under the pointer (or the latest day) beside
// the year's totals; the bars below are the same four lines stacked per day.
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

const PLOT_H = 190;
/** Room above the plot for the values of bars drawn broken. */
const TOP_PAD = 18;
const AXIS_W = 30;
/** Surface gap between stacked segments, px. */
const SEG_GAP = 1;

const total = (d: LedgerDay) => d.inflation + d.ees + d.late + d.ours;
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
 * The plot's top: twice the median day, rounded up to the next half. A normal
 * day is ~1.6, so everything up to a doubled payout is drawn to scale; the
 * handful of days above it (one huge early end can pay 17 HEX per T-share) are
 * drawn broken with their value printed above.
 */
function capOf(days: LedgerDay[]): number {
  const v = days.map(total).sort((a, b) => a - b);
  return Math.ceil(v[Math.floor(v.length / 2)] * 2 * 2) / 2;
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
  // A sub-pixel gap only once a bar is wide enough to keep its body.
  const barW = slot >= 2 ? slot * 0.72 : slot;
  const y = (v: number) => TOP_PAD + PLOT_H - (Math.min(v, cap) / cap) * PLOT_H;

  // The bars are the heavy part (four rects × 365 days) and do not depend on
  // the pointer, so they are drawn once per size, not once per hover.
  const bars = useMemo(() => {
    if (!plotW) return null;
    return days.map((d, i) => {
      const x = i * slot + (slot - barW) / 2;
      let base = 0;
      const segs = SERIES.map((s) => {
        const v = d[s.key];
        const y0 = y(base);
        base += v;
        const y1 = y(base);
        // The gap comes off the top of every segment that has another above
        // it, and only when the segment is tall enough to keep a body.
        const h = y0 - y1;
        const gap = s.key !== 'ours' && h > SEG_GAP * 2 ? SEG_GAP : 0;
        return h > 0 ? <rect key={s.key} x={x} y={y1 + gap} width={barW} height={h - gap} fill={s.color} /> : null;
      });
      return <g key={d.day}>{segs}</g>;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, plotW, slot, barW, cap]);

  if (!n) return null;

  const broken = days.map((d, i) => ({ i, v: total(d) })).filter((b) => b.v > cap);
  // Their values, printed above. Neighbours whose labels would overlap share
  // one ("17.46 · 8.36"), kept inside the card at either edge.
  // A merged label is wider and can reach the one before it, so merging
  // repeats until no two overlap.
  type Run = { from: number; to: number; text: string; x: number };
  const place = (r: Omit<Run, 'x'>): Run => {
    const w = r.text.length * CHAR_PX;
    const center = AXIS_W + ((r.from + r.to) / 2 + 0.5) * slot;
    return { ...r, x: Math.min(width - w, Math.max(AXIS_W, center - w / 2)) };
  };
  let brokenLabels: Run[] = broken.map((b) => place({ from: b.i, to: b.i, text: b.v.toFixed(2) }));
  for (let merged = true; merged; ) {
    merged = false;
    const next: Run[] = [];
    for (const r of brokenLabels) {
      const prev = next[next.length - 1];
      if (prev && r.x < prev.x + prev.text.length * CHAR_PX + 6) {
        next[next.length - 1] = place({ from: prev.from, to: r.to, text: `${prev.text} · ${r.text}` });
        merged = true;
      } else next.push(r);
    }
    brokenLabels = next;
  }
  const ticks = Array.from({ length: Math.floor(cap) + 1 }, (_, i) => i);

  // A month name at each month's first day, thinned on narrow screens.
  const months = days
    .map((d, i) => ({ i, date: hexDayToDate(d.day) }))
    .filter(({ date }) => date.getUTCDate() === 1);
  const monthLabels: { i: number; x: number; text: string }[] = [];
  for (const { i, date } of months) {
    const text = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) + (date.getUTCMonth() === 0 ? ` ${date.getUTCFullYear()}` : '');
    const x = AXIS_W + i * slot;
    const prev = monthLabels[monthLabels.length - 1];
    if (x + text.length * CHAR_PX > width) continue;
    if (prev && x < prev.x + prev.text.length * CHAR_PX + 8) continue;
    monthLabels.push({ i, x, text });
  }

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

      {/* ── The bars ── */}
      <div
        ref={box}
        tabIndex={0}
        role="group"
        aria-label={`Payout per T-share by day for the past ${n} days. Use the arrow keys to move between days; the ledger above reads the selected day.`}
        onKeyDown={onKey}
        onPointerDown={(e) => pickAt(e.clientX)}
        onPointerMove={(e) => e.pointerType === 'mouse' && pickAt(e.clientX)}
        className="relative mt-4 touch-pan-y select-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--viz-a)]"
        style={{ height: TOP_PAD + PLOT_H + 22 }}
      >
        {width > 0 && (
          <svg width={width} height={TOP_PAD + PLOT_H + 22} className="block overflow-visible" aria-hidden>
            {/* grid + y ticks: hairline, recessive */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={AXIS_W} x2={width} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} shapeRendering="crispEdges" />
                <text x={AXIS_W - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--text-faint)">
                  {t}
                </text>
              </g>
            ))}

            {/* the selected day */}
            <rect x={AXIS_W + sel * slot - Math.max(0, (6 - slot) / 2)} y={TOP_PAD - 4} width={Math.max(slot, 6)} height={PLOT_H + 4} fill="var(--line)" />

            <g
              style={{
                transformOrigin: `0 ${TOP_PAD + PLOT_H}px`,
                transform: `translate(${AXIS_W}px, 0) scaleY(${on ? 1 : 0})`,
                transition: instant ? 'none' : `transform 900ms ${EASE} 150ms`,
              }}
            >
              {bars}
              {/* A broken bar: a surface-colored cut just under the top */}
              {broken.map((b) => (
                <rect key={b.i} x={b.i * slot - 1} y={TOP_PAD + 5} width={slot + 2} height={2.5} fill="var(--ledger-paper)" />
              ))}
            </g>

            {/* values of the broken bars, printed above them */}
            {brokenLabels.map((l) => (
              <text key={l.x} x={l.x} y={TOP_PAD - 6} fontSize={10} fontWeight={500} fill="var(--text-muted)">
                {l.text}
              </text>
            ))}

            {/* the keeper's first rescue */}
            {firstRescue > 0 && (
              <g>
                <line
                  x1={AXIS_W + firstRescue * slot}
                  x2={AXIS_W + firstRescue * slot}
                  y1={TOP_PAD + 14}
                  y2={TOP_PAD + PLOT_H}
                  stroke="var(--text-faint)"
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                {/* A paper-colored halo keeps it legible where it crosses a bar. */}
                <text
                  x={AXIS_W + firstRescue * slot - 4}
                  y={TOP_PAD + 22}
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

            {/* month names */}
            {monthLabels.map((m) => (
              <text key={m.i} x={m.x} y={TOP_PAD + PLOT_H + 15} fontSize={10} fill="var(--text-faint)">
                {m.text}
              </text>
            ))}
          </svg>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-poppins text-[10px] text-[var(--text-faint)]">
          Bars over {cap} HEX are cut, with their value above. Days are HEX days, closed by the contract after 00:00 UTC.
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
