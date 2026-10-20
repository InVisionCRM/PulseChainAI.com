'use client';

// The pieces every panel of the SuperStake stats deck is built from: the series
// palette, number formatting, the stat tile, the range control, the chart
// chrome and the paged table. Kept in one place so the four panels can't drift
// apart on how a HEX amount is written or which colour means what.

import { useState, type ReactNode } from 'react';
import { dayToISO, type SuperStakeCycle, type SuperStakeSnapshot } from '@/lib/superstake/model';
import type { InflowsPayload } from '@/app/api/superstake/inflows/route';
import { SHARE_GRAD } from '@/components/share/ShareCardModal';

export const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';
export const GRAD = SHARE_GRAD;

/**
 * Every series keeps one colour across all four panels. Set as variables on the
 * deck's root so dark mode gets its own steps rather than an automatic flip.
 * Validated with the dataviz palette checker in this order (payout, yield,
 * tax, direct, reflections): light on #ffffff and dark on #0C2340 both pass
 * the lightness band, chroma floor, CVD separation (worst adjacent ΔE 11.1 /
 * 10.5) and 3:1 contrast. Tax and direct are the brand's own red and plum;
 * dark mode lifts both because the light steps sit below its lightness band.
 */
export const VIZ_VARS =
  '[--viz-pay:#B98900] [--viz-yield:#0E9384] [--viz-tax:#D83639] [--viz-direct:#7E089D] [--viz-refl:#E96635] ' +
  'dark:[--viz-tax:#E5484D] dark:[--viz-direct:#B44BD6]';

export const SERIES = {
  tax: { label: 'Bought by the 2% tax', short: 'Tax', color: 'var(--viz-tax)' },
  direct: { label: 'Sent in directly', short: 'Sent in', color: 'var(--viz-direct)' },
  refl: { label: 'Reflections on its own pSSH', short: 'Reflections', color: 'var(--viz-refl)' },
  yield: { label: "HEX's own yield", short: 'Yield', color: 'var(--viz-yield)' },
  pay: { label: 'Paid to holders (1%)', short: 'Paid out', color: 'var(--viz-pay)' },
} as const;
export type SeriesKey = keyof typeof SERIES;

/** A chart with only one series draws in the brand red. */
export const ONE = 'var(--viz-tax)';

/** The deck's view of the cycle record — the page's own snapshot, rebuilt live. */
export type Series = SuperStakeSnapshot['series'];

/**
 * Whether the transfer record and the cycle record describe the same restakes.
 * They are fetched separately: right after a rollover one can be a cycle
 * ahead, and when the rebuild fails the page is on the baked snapshot. Pairing
 * them then would put one cycle's inflows beside another cycle's principal.
 */
export function sameRestakes(cycles: SuperStakeCycle[], inflows: InflowsPayload) {
  return (
    inflows.cycles.length - 1 === cycles.length &&
    inflows.cycles.slice(1).every((c, k) => c.opened != null && Math.abs(c.opened - cycles[k].hex) < 1e-6)
  );
}

/* ───────────────────────────── formatting ───────────────────────────── */

/** HEX at reading scale: whole numbers once they're big enough not to need cents. */
export const hex = (n: number) =>
  !Number.isFinite(n)
    ? '—'
    : Math.abs(n) >= 100
      ? Math.round(n).toLocaleString()
      : n.toLocaleString(undefined, { maximumFractionDigits: 2 });

/** HEX for an axis or a tight spot: 1.53M, 12.3K, 840. */
export const hexShort = (n: number) => {
  const a = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${s}${(a / 1e3).toFixed(1)}K`;
  if (a >= 1e3) return `${s}${(a / 1e3).toFixed(2)}K`;
  return `${s}${Math.round(a)}`;
};

export const usd = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}K`;
  if (a >= 100) return `${s}$${Math.round(a)}`;
  return `${s}$${a.toFixed(2)}`;
};

/** A token price, with enough places to see it move. */
export const price = (n: number | null | undefined) =>
  n == null || !(n > 0) ? '—' : `$${n < 0.01 ? n.toFixed(6) : n.toFixed(4)}`;

export const pct = (n: number | null | undefined, dp = 1) =>
  n == null || !Number.isFinite(n) ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(dp)}%`;

const utc = (day: number) => new Date(`${dayToISO(day)}T00:00:00Z`);
/** "Oct 19" — HEX days are UTC midnights, so they're formatted in UTC too. */
export const dayShort = (day: number) =>
  utc(day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
export const dayLong = (day: number) =>
  utc(day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export function ago(ts: number, now: number) {
  const s = Math.max(0, Math.round(now / 1000 - ts));
  if (s < 90) return 'just now';
  const m = Math.round(s / 60);
  if (m < 90) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** The value of a day-indexed series on a HEX day, or null outside it. */
export function at(arr: number[], d0: number, day: number): number | null {
  const v = arr[day - d0];
  return v == null || !Number.isFinite(v) ? null : v;
}

/* ───────────────────────────── ranges ───────────────────────────── */

export const RANGES = [
  { id: '30', label: '30D', days: 30 },
  { id: '90', label: '90D', days: 90 },
  { id: '365', label: '1Y', days: 365 },
  { id: 'all', label: 'All', days: Infinity },
] as const;
export type RangeId = (typeof RANGES)[number]['id'];

/** Past this many days a daily bar is under a pixel wide, so bars become weekly. */
const WEEKLY_AFTER = 180;

export function span(range: RangeId, first: number, last: number) {
  const days = RANGES.find((r) => r.id === range)!.days;
  const from = Math.max(first, Number.isFinite(days) ? last - days + 1 : first);
  return { from, to: last, weekly: last - from + 1 > WEEKLY_AFTER };
}

/**
 * Daily rows folded into 7-day buckets counted back from the last day, so the
 * newest bucket always ends today and only the oldest can be short. The
 * `sum` fields are summed — and a week with any unknown (null) day stays
 * unknown rather than quietly counting it as zero. `day` becomes the bucket's
 * first day and `to` its last.
 */
export function weekly<T extends { day: number }>(rows: T[], sum: (keyof T)[]): (T & { to: number })[] {
  const out: (T & { to: number })[] = [];
  for (let end = rows.length; end > 0; end -= 7) {
    const chunk = rows.slice(Math.max(0, end - 7), end);
    const row = { ...chunk[0], to: chunk[chunk.length - 1].day } as T & { to: number };
    for (const k of sum) {
      const vals = chunk.map((r) => r[k]);
      (row as Record<keyof T, unknown>)[k] = vals.some((v) => v == null)
        ? null
        : vals.reduce((s, v) => s + Number(v), 0);
    }
    out.unshift(row);
  }
  return out;
}

export function RangeTabs({ value, onChange }: { value: RangeId; onChange: (r: RangeId) => void }) {
  return (
    <div className="inline-flex gap-1 rounded-lg border border-[var(--line)] bg-[var(--app-bg)] p-1" role="group" aria-label="Time range">
      {RANGES.map((r) => {
        const on = r.id === value;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onChange(r.id)}
            aria-pressed={on}
            className={`rounded-md px-3 py-1 text-[11.5px] font-bold transition-colors ${
              on ? 'text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
            style={on ? { background: GRAD } : undefined}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────────────────── tiles and headings ───────────────────────────── */

/** Same anatomy as the page's own figure cards, so the deck reads as part of it. */
export function Tile({ label, value, sub }: { label: string; value: string; sub?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--app-bg)] p-3">
      <div className="text-[9.5px] uppercase tracking-[0.13em] text-[var(--text-faint)]" style={{ fontFamily: MONO }}>
        {label}
      </div>
      {/* Wraps rather than truncates: a clipped figure reads as a different number. */}
      <div className="mt-1.5 break-words text-[18px] font-bold leading-tight tracking-[-0.03em] text-[var(--text)] sm:text-[20px]">
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] leading-snug text-[var(--text-faint)]">{sub}</div>}
    </div>
  );
}

/**
 * A signed change, coloured by direction. The figure beside it stays neutral —
 * the delta carries the direction. Light steps are one darker than the page's
 * --up so 11px text clears 4.5:1 on the tile (5.9 and 5.4 against 4.2 and 4.0).
 */
export function Delta({ v }: { v: number | null }) {
  if (v == null || !Number.isFinite(v)) return <span>—</span>;
  return (
    <span className={`font-semibold ${v >= 0 ? 'text-green-800 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
      {pct(v)}
    </span>
  );
}

export function Head({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
      <h3 className="text-[15px] font-bold tracking-[-0.02em] text-[var(--text)]">{title}</h3>
      {sub && <span className="text-[12px] text-[var(--text-faint)]">{sub}</span>}
    </div>
  );
}

/** Legend for two or more series — the identity channel that doesn't rely on colour-matching alone. */
export function Legend({ keys, line }: { keys: SeriesKey[]; line?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {keys.map((k) => (
        <li key={k} className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          <span
            className={line ? 'h-[2px] w-3 rounded-full' : 'h-2.5 w-2.5 rounded-[3px]'}
            style={{ background: SERIES[k].color }}
          />
          {SERIES[k].label}
        </li>
      ))}
    </ul>
  );
}

/* ───────────────────────────── chart chrome ───────────────────────────── */

export const AXIS_TICK = { fill: 'var(--text-faint)', fontSize: 10, fontFamily: MONO };

/** Recharts' tooltip, styled like the page. Values lead, series names follow. */
export function TipBox({
  title, rows, foot,
}: {
  title: string;
  rows: { key: string; label: string; value: string; color?: string }[];
  foot?: string;
}) {
  return (
    <div className="min-w-[180px] rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 shadow-xl">
      <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]" style={{ fontFamily: MONO }}>
        {title}
      </div>
      <ul className="mt-1 space-y-0.5">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2 text-[12px]">
            {r.color && <span className="h-[2px] w-3 shrink-0 rounded-full" style={{ background: r.color }} />}
            <span className="font-bold tabular-nums text-[var(--text)]">{r.value}</span>
            <span className="truncate text-[var(--text-muted)]">{r.label}</span>
          </li>
        ))}
      </ul>
      {foot && <div className="mt-1 text-[10.5px] text-[var(--text-faint)]">{foot}</div>}
    </div>
  );
}

/**
 * A stacked bar segment: a 2px surface gap above it when another segment sits
 * on top, and the 4px rounded end only on whichever segment is the bar's data
 * end — square at the baseline. Negative values (money leaving) hang below the
 * axis with their rounded end at the bottom.
 */
export function stackShape(order: string[], key: string) {
  return function Shape(props: unknown) {
    const p = props as { x: number; y: number; width: number; height: number; fill: string; payload: Record<string, number> };
    let { y, height } = p;
    const { x, width, fill, payload } = p;
    if (!(width > 0) || !height) return <g />;
    const below = (payload[key] ?? 0) < 0;
    if (height < 0) {
      y += height;
      height = -height;
    }
    // The data end is the outermost non-zero segment on this side of the axis.
    const side = order.filter((k) => ((payload[k] ?? 0) < 0) === below && (payload[k] ?? 0) !== 0);
    const isEnd = side[side.length - 1] === key;
    const gap = isEnd ? 0 : Math.min(2, height / 2);
    if (below) height -= gap;
    else {
      y += gap;
      height -= gap;
    }
    if (height <= 0) return <g />;
    const r = isEnd ? Math.min(4, width / 2, height) : 0;
    const d = below
      ? `M${x},${y} H${x + width} V${y + height - r} Q${x + width},${y + height} ${x + width - r},${y + height} H${x + r} Q${x},${y + height} ${x},${y + height - r} Z`
      : `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`;
    return <path d={d} fill={fill} />;
  };
}

/* ───────────────────────────── table ───────────────────────────── */

export interface Col<T> {
  key: string;
  label: string;
  cell: (row: T) => ReactNode;
  /** Left-aligned (text) rather than right-aligned (figures). */
  text?: boolean;
}

/**
 * Every chart's table twin — the place each value can be read without hovering.
 * Long histories open a page at a time rather than all at once.
 */
export function DataTable<T>({
  cols, rows, rowKey, first = 14, step = 30, muted,
}: {
  cols: Col<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  first?: number;
  step?: number;
  /** Rows to draw quieter — a day nothing arrived, a cycle still running. */
  muted?: (row: T) => boolean;
}) {
  const [shown, setShown] = useState(first);
  const visible = rows.slice(0, shown);
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-[var(--line)] bg-[var(--app-bg)]">
              {cols.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`whitespace-nowrap px-2.5 py-2 text-[9.5px] font-medium uppercase tracking-[0.12em] text-[var(--text-faint)] ${
                    c.text ? 'text-left' : 'text-right'
                  }`}
                  style={{ fontFamily: MONO }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={rowKey(r)}
                className={`border-b border-[var(--line)] last:border-b-0 ${muted?.(r) ? 'text-[var(--text-faint)]' : 'text-[var(--text)]'}`}
              >
                {cols.map((c) => (
                  <td
                    key={c.key}
                    className={`whitespace-nowrap px-2.5 py-1.5 ${c.text ? 'text-left' : 'text-right tabular-nums'}`}
                  >
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > shown && (
        <button
          type="button"
          onClick={() => setShown((s) => s + step)}
          className="w-full border-t border-[var(--line)] bg-[var(--app-bg)] px-3 py-2 text-[11.5px] font-bold text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          Show {Math.min(step, rows.length - shown)} more · {rows.length - shown} left
        </button>
      )}
    </div>
  );
}
