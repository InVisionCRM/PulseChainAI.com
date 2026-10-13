'use client';

// The payout ledger: what HEX paid every T-share each day for the past year,
// and where the part above inflation came from — the stakers' half of
// early-end penalties, other people's late penalties, and the keeper's
// rescues.
//
// Drawn as a calendar: the last twelve months, one square per day, brighter
// where penalties added more on top of inflation, with an orange dot on the
// days the keeper rescued. Built for a phone first — three months to a row
// there, four as the card widens. Tapping a square (or arrowing through
// them) opens that day's ledger below, with steppers for moving a day at a
// time, since a fingertip is wider than a square.
//
// Every figure comes from lib/hex/payoutDays.ts, which reconciles each day to
// the heart against the contract before it is stored.
//
// Colors, all checked with the dataviz palette validator on this card's
// ledger-paper surfaces (#fbfaf7 light, #101317 dark):
//   shading  one teal hue, five steps; ordinal checks pass in both themes
//            (light end 2.20:1 on light, 2.35:1 on dark)
//   ledger   --viz-a/b/c, the page's validated data steps

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
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

/** What a day added on top of inflation. */
const extra = (d: LedgerDay) => d.ees + d.late + d.ours;

/**
 * Where the shading steps up, in HEX per T-share above inflation. Half of
 * all days add under 0.02 (the first step); the keeper's biggest days add
 * 0.3–0.9; a handful of huge early ends add 1.5 to 15.9 (the last step).
 */
const STEPS = [0.02, 0.1, 0.3, 1];
const stepOf = (v: number) => {
  const i = STEPS.findIndex((s) => v < s);
  return i === -1 ? STEPS.length : i;
};
const SHADES = [0, 1, 2, 3, 4].map((i) => `var(--cal-${i})`);

const isoOf = (day: number) => hexDayToDate(day).toISOString().slice(0, 10);
const dateOf = (day: number, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) =>
  hexDayToDate(day).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });

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

interface Month {
  key: string;
  label: string;
  /** Blank squares before the 1st, so it sits under its weekday (Sunday first). */
  lead: number;
  /** Index into `days` for each day of the month; null where no day has closed yet. */
  cells: (number | null)[];
}

/** The last twelve calendar months that have data, ending with the latest day's month. */
function monthsOf(days: LedgerDay[], index: Map<string, number>): Month[] {
  const first = hexDayToDate(days[0].day);
  const last = hexDayToDate(days[days.length - 1].day);
  const out: Month[] = [];
  for (let back = 11; back >= 0; back--) {
    const start = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() - back, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    if (end < first) continue;
    const cells: (number | null)[] = [];
    for (let d = 1; d <= end.getUTCDate(); d++) {
      const iso = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), d)).toISOString().slice(0, 10);
      cells.push(index.get(iso) ?? null);
    }
    out.push({
      key: start.toISOString().slice(0, 7),
      label:
        start.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) +
        (out.length === 0 || start.getUTCMonth() === 0 ? ` ${start.getUTCFullYear()}` : ''),
      lead: start.getUTCDay(),
      cells,
    });
  }
  return out;
}

export function PayoutLedger({ days }: { days: LedgerDay[] }) {
  const { on, instant } = useSettled();
  const [picked, setPicked] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const grid = useRef<HTMLDivElement>(null);

  const n = days.length;
  const last = n - 1;
  const sel = picked ?? last;
  const index = useMemo(() => new Map(days.map((d, i) => [isoOf(d.day), i])), [days]);
  const months = useMemo(() => (n ? monthsOf(days, index) : []), [days, index, n]);
  const year = useMemo(() => {
    const sum = { inflation: 0, ees: 0, late: 0, ours: 0, eesCount: 0, lateCount: 0, oursCount: 0 };
    for (const d of days) for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += d[k];
    return sum;
  }, [days]);

  if (!n) return null;

  /** Select a day and move keyboard focus to its square. */
  const go = (i: number) => {
    const next = Math.max(0, Math.min(last, i));
    setPicked(next === last ? null : next);
    grid.current?.querySelector<HTMLButtonElement>(`[data-i="${next}"]`)?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step) go(sel + step);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(last);
    else return;
    e.preventDefault();
  };

  const d = days[sel];
  const fade = (i: number) => ({
    opacity: on ? 1 : 0,
    transform: on ? 'none' : 'translateY(6px)',
    transition: instant ? 'none' : `opacity 450ms ${EASE} ${80 + i * 45}ms, transform 450ms ${EASE} ${80 + i * 45}ms`,
  });
  const stepper =
    'font-poppins flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] text-[16px] text-[var(--text-muted)] transition-colors hover:text-[var(--text)] disabled:opacity-30';

  return (
    <section
      aria-labelledby="payout-ledger-title"
      className={`${plex.className} relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--ledger-paper)] p-4 [--cal-0:#58bbad] [--cal-1:#2f9f91] [--cal-2:#188577] [--cal-3:#0f685c] [--cal-4:#094a41] [--cal-none:rgba(15,23,42,0.05)] [--ledger-base:#c3c8d1] [--ledger-paper:#fbfaf7] [--ledger-well:rgba(15,23,42,0.04)] dark:[--cal-0:#1f5a54] dark:[--cal-1:#177a70] dark:[--cal-2:#119a8b] dark:[--cal-3:#2cc4b2] dark:[--cal-4:#8eeee0] dark:[--cal-none:rgba(255,255,255,0.04)] dark:[--ledger-base:#3a3f48] dark:[--ledger-paper:#101317] dark:[--ledger-well:rgba(255,255,255,0.05)] md:p-6`}
    >
      <div className="font-poppins text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
        The payout ledger · past year
      </div>
      <h2 id="payout-ledger-title" className="font-jost mt-1 text-[21px] font-bold leading-tight tracking-tight text-[var(--text)] md:text-[26px]">
        What penalties added to every T-share, day by day
      </h2>
      <p className="font-poppins mt-1 max-w-2xl text-[12px] leading-relaxed text-[var(--text-muted)]">
        HEX pays stakers each day’s inflation plus half of every penalty collected. Each square is a day, shaded by
        how much penalties added on top of inflation; an orange dot marks a day the keeper rescued. Tap a day to read it.
      </p>

      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-8">
        <div>
          {/* ── The calendar ── */}
          <div
            ref={grid}
            role="group"
            aria-label="Payout calendar, one square per day. Arrow keys move a day or a week; the ledger reads the selected day."
            onKeyDown={onKey}
            className="grid grid-cols-3 gap-x-[6%] gap-y-4 sm:grid-cols-4"
          >
            {months.map((m, mi) => (
              <div key={m.key} style={fade(mi)}>
                <div className="font-poppins mb-1.5 text-[10.5px] font-semibold leading-none text-[var(--text-muted)]">{m.label}</div>
                <div className="grid grid-cols-7 gap-[2px]">
                  {Array.from({ length: m.lead }, (_, k) => (
                    <span key={`lead${k}`} aria-hidden />
                  ))}
                  {m.cells.map((i, k) => {
                    if (i == null) return <span key={k} aria-hidden className="aspect-square rounded-[3px] bg-[var(--cal-none)]" />;
                    const day = days[i];
                    const v = extra(day);
                    const isSel = i === sel;
                    return (
                      <button
                        key={k}
                        type="button"
                        data-i={i}
                        tabIndex={isSel ? 0 : -1}
                        aria-pressed={isSel}
                        aria-label={`${dateOf(day.day)}: ${v.toFixed(4)} HEX per T-share above inflation${
                          day.oursCount ? `, keeper rescued ${day.oursCount.toLocaleString()} stakes` : ''
                        }`}
                        onClick={() => setPicked(i === last ? null : i)}
                        className={`relative flex aspect-square items-center justify-center rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--viz-a)] ${
                          isSel ? 'outline outline-2 outline-offset-1 outline-[var(--text)]' : ''
                        }`}
                        style={{ background: SHADES[stepOf(v)] }}
                      >
                        {day.oursCount > 0 && (
                          <span
                            aria-hidden
                            className="block h-[42%] w-[42%] rounded-full bg-[var(--viz-a)]"
                            style={{ boxShadow: '0 0 0 1.5px var(--ledger-paper)' }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* ── The key ── */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] leading-none text-[var(--text-faint)]">
            <span className="flex items-center gap-1.5">
              less
              {SHADES.map((c) => (
                <span key={c} aria-hidden className="h-3 w-3 rounded-[3px]" style={{ background: c }} />
              ))}
              more
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--viz-a)]" />
              keeper rescued
            </span>
          </div>
          <p className="mt-1.5 text-[9.5px] leading-snug text-[var(--text-faint)]">
            steps: under {STEPS.join(' · ')} · {STEPS[STEPS.length - 1]}+ HEX per T-share above inflation
          </p>
        </div>

        {/* ── The selected day's ledger ── */}
        <div className="mt-5 rounded-xl bg-[var(--ledger-well)] p-3 lg:mt-0">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => go(sel - 1)} disabled={sel === 0} aria-label="Previous day" className={stepper}>
              ‹
            </button>
            <div className="min-w-0 flex-1 text-center">
              <div className="font-poppins text-[13px] font-semibold leading-snug text-[var(--text)]" aria-live="polite">
                {dateOf(d.day, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
              <div className="font-poppins text-[10px] leading-snug text-[var(--text-faint)]">
                {picked == null ? 'latest day · ' : ''}HEX day {d.day.toLocaleString()}
              </div>
            </div>
            <button type="button" onClick={() => go(sel + 1)} disabled={sel === last} aria-label="Next day" className={stepper}>
              ›
            </button>
          </div>
          <table className="mt-3 w-full border-collapse text-[12.5px] tabular-nums">
            <tbody>
              {SERIES.map((s, i) => (
                <tr key={s.key}>
                  <td className="w-4 py-[3px] pr-1 align-middle text-[var(--text-faint)]">{i === 0 ? '' : '+'}</td>
                  <td className="py-[3px] pr-3 text-right font-medium text-[var(--text)]">{fmtPer(d[s.key], 4)}</td>
                  <td className="py-[3px]">
                    <span className="font-poppins inline-flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
                      <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: s.color }} />
                      {s.label}
                    </span>
                  </td>
                  <td className="py-[3px] pl-2 text-right text-[11px] text-[var(--text-faint)]">
                    {s.count && d[s.count] > 0 ? d[s.count].toLocaleString() : ''}
                  </td>
                </tr>
              ))}
              <tr>
                <td />
                <td className="border-t-[3px] border-double border-[var(--text-faint)] pr-3 pt-1 text-right text-[15px] font-semibold text-[var(--text)]">
                  {footed(d, 4)}
                </td>
                <td colSpan={2} className="font-poppins pt-1 text-[12px] font-semibold text-[var(--text)]">
                  HEX per T-share
                </td>
              </tr>
            </tbody>
          </table>
          <p className="font-poppins mt-2 text-[10px] leading-snug text-[var(--text-faint)]">Counts are the stakes each penalty came from.</p>
        </div>
      </div>

      {/* ── The year, added up: every closed day the ledger holds, not just
          the twelve calendar months drawn, so its range is printed. ── */}
      <div className="mt-5 border-t border-[var(--line)] pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="font-poppins text-[10px] font-semibold uppercase leading-none tracking-[0.16em] text-[var(--text-faint)]">
            Past {n} days · per T-share
          </span>
          <span className="font-poppins text-[10px] leading-none text-[var(--text-faint)]">
            {dateOf(days[0].day)} – {dateOf(days[last].day)}
          </span>
        </div>
        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2">
          <span className="font-jost text-[30px] font-bold leading-none text-[var(--text)]">{footed(year, 2)}</span>
          <span className="font-poppins text-[12px] leading-snug text-[var(--text-muted)]">HEX paid to every T-share</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {SERIES.map((s) => (
            <div key={s.key}>
              <div className="font-poppins flex items-center gap-1.5 text-[11px] leading-tight text-[var(--text-muted)]">
                <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: s.color }} />
                {s.label}
              </div>
              <div className="mt-1 text-[15px] font-semibold leading-tight tabular-nums text-[var(--text)]">{year[s.key].toFixed(2)}</div>
              <div className="text-[10px] leading-tight tabular-nums text-[var(--text-faint)]">
                {s.count ? `${year[s.count].toLocaleString()} stakes` : 'paid every day'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-poppins max-w-2xl text-[10px] leading-snug text-[var(--text-faint)]">
          Days are HEX days, closed by the contract after 00:00 UTC. Every day is read from the contract and checked
          against it to the last heart.
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
