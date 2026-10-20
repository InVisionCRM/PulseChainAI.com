'use client';

// HEX added to the stake contract, day by day — what arrived, where from, and
// the table behind every bar. Reads /api/superstake/inflows, which is checked
// against the contract's on-chain balance before it is served.

import { useMemo } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { IconExternalLink } from '@tabler/icons-react';
import { pulsechainTxUrl } from '@/lib/pulsechainExplorer';
import type { InflowsPayload } from '@/app/api/superstake/inflows/route';
import {
  AXIS_TICK, DataTable, Head, Legend, MONO, ONE, SERIES, Tile, TipBox,
  ago, at, dayLong, dayShort, hex, hexShort, span, stackShape, usd, weekly,
  type RangeId, type Series, type Col,
} from './shared';

interface DayRow {
  day: number;
  tax: number;
  direct: number;
  refl: number;
  total: number;
  /** Separate transfers that added HEX. */
  n: number;
  /** The largest single transfer. */
  max: number;
  /** What the day's HEX was worth at that day's pHEX — null before the price record starts. */
  usd: number | null;
  /** pSSH traded that day, USD. */
  vol: number | null;
  /** Running total since the record began. */
  cum: number;
}

/** Bottom to top. */
const STACK = ['tax', 'direct', 'refl'] as const;

export default function DailyPanel({
  inflows, series, range, pHexNow, now,
}: {
  inflows: InflowsPayload;
  series: Series;
  range: RangeId;
  pHexNow: number | null;
  now: number;
}) {
  const all = useMemo<DayRow[]>(() => {
    const { d0, tax, direct, refl, n, max } = inflows.days;
    let cum = 0;
    return tax.map((_, k) => {
      const day = d0 + k;
      const total = tax[k] + direct[k] + refl[k];
      cum += total;
      const ph = at(series.PH, series.d0, day);
      return {
        day,
        tax: tax[k],
        direct: direct[k],
        refl: refl[k],
        total,
        n: n[k],
        max: max[k],
        usd: ph && ph > 0 ? total * ph : null,
        vol: at(series.VV, series.d0, day),
        cum,
      };
    });
  }, [inflows, series]);

  const last = all[all.length - 1].day;
  const { from, weekly: byWeek } = span(range, all[0].day, last);
  const rows = useMemo(() => all.filter((r) => r.day >= from), [all, from]);
  const bars = useMemo(
    () => (byWeek ? weekly(rows, ['tax', 'direct', 'refl', 'total', 'n', 'usd']) : rows.map((r) => ({ ...r, to: r.day }))),
    [rows, byWeek],
  );

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.total, 0);
    const active = rows.filter((r) => r.n > 0).length;
    const best = rows.reduce((b, r) => (r.total > b.total ? r : b), rows[0]);
    const biggest = rows.reduce((b, r) => (r.max > b.max ? r : b), rows[0]);
    return { total, active, best, biggest, days: rows.length };
  }, [rows]);

  const cols: Col<DayRow>[] = [
    {
      key: 'day',
      label: 'Day (UTC)',
      text: true,
      cell: (r) => (r.day === last ? `${dayLong(r.day)} · so far` : dayLong(r.day)),
    },
    { key: 'total', label: 'HEX added', cell: (r) => <b>{hex(r.total)}</b> },
    { key: 'tax', label: 'From the tax', cell: (r) => hex(r.tax) },
    { key: 'direct', label: 'Sent in', cell: (r) => hex(r.direct) },
    { key: 'refl', label: 'Reflections', cell: (r) => hex(r.refl) },
    { key: 'n', label: 'Adds', cell: (r) => r.n.toLocaleString() },
    { key: 'usd', label: '≈ USD that day', cell: (r) => usd(r.usd) },
    { key: 'vol', label: 'pSSH traded', cell: (r) => usd(r.vol) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Tile
          label="Added in range"
          value={`${hex(stats.total)} HEX`}
          sub={pHexNow ? `≈ ${usd(stats.total * pHexNow)} at today's price` : undefined}
        />
        <Tile
          label="Per day"
          value={`${hex(stats.total / stats.days)} HEX`}
          sub={`${stats.active} of ${stats.days} days had an add`}
        />
        <Tile label="Biggest day" value={`${hex(stats.best.total)} HEX`} sub={dayLong(stats.best.day)} />
        <Tile
          label="Largest single add"
          value={`${hex(stats.biggest.max)} HEX`}
          sub={dayLong(stats.biggest.day)}
        />
      </div>

      <section className="flex flex-col gap-2">
        <Head
          title={byWeek ? 'HEX added each week' : 'HEX added each day'}
          sub={byWeek ? 'weekly totals, so each bar stays readable' : 'UTC days'}
        />
        <Legend keys={[...STACK]} />
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bars} margin={{ top: 8, right: 18, bottom: 0, left: 0 }} barCategoryGap="18%" accessibilityLayer>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis
                dataKey="day"
                tickFormatter={dayShort}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={{ stroke: 'var(--line-strong)' }}
                minTickGap={28}
              />
              <YAxis tickFormatter={hexShort} tick={AXIS_TICK} tickLine={false} axisLine={false} width={46} />
              <Tooltip
                cursor={{ fill: 'var(--line)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const r = payload[0].payload as DayRow & { to: number };
                  return (
                    <TipBox
                      title={
                        byWeek
                          ? `${dayShort(r.day)} – ${dayLong(r.to)}`
                          : `${dayLong(r.day)}${r.day === last ? ' · so far' : ''}`
                      }
                      rows={[
                        { key: 'total', label: 'HEX added', value: hex(r.total) },
                        ...STACK.map((k) => ({ key: k, label: SERIES[k].label, value: hex(r[k]), color: SERIES[k].color })),
                      ]}
                      foot={`${r.n.toLocaleString()} ${r.n === 1 ? 'add' : 'adds'} · ≈ ${usd(r.usd)} at ${byWeek ? 'each day’s' : 'that day’s'} price`}
                    />
                  );
                }}
              />
              {STACK.map((k) => (
                <Bar
                  key={k}
                  dataKey={k}
                  stackId="in"
                  fill={SERIES[k].color}
                  maxBarSize={24}
                  shape={stackShape([...STACK], k)}
                  name={SERIES[k].label}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] leading-relaxed text-[var(--text-faint)]">
          The tax doesn&apos;t arrive trade by trade. The pSSH contract collects it and swaps it to HEX in
          batches, so a bar shows when HEX landed in the stake contract, not when the trades that paid
          for it happened — which is why plenty of days show nothing.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <Head title="HEX added, running total" sub="every source, from the first HEX that arrived" />
        <div className="h-[170px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 8, right: 18, bottom: 0, left: 0 }} accessibilityLayer>
              <defs>
                <linearGradient id="ssk-cum-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={ONE} stopOpacity={0.14} />
                  <stop offset="1" stopColor={ONE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis
                dataKey="day"
                tickFormatter={dayShort}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={{ stroke: 'var(--line-strong)' }}
                minTickGap={28}
              />
              <YAxis
                tickFormatter={hexShort}
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                width={46}
                domain={['auto', 'auto']}
              />
              <Tooltip
                cursor={{ stroke: 'var(--line-strong)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const r = payload[0].payload as DayRow;
                  return (
                    <TipBox
                      title={dayLong(r.day)}
                      rows={[
                        { key: 'cum', label: 'added in total', value: hex(r.cum) },
                        { key: 'day', label: 'that day', value: hex(r.total) },
                      ]}
                    />
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="cum"
                stroke={ONE}
                strokeWidth={2}
                fill="url(#ssk-cum-fill)"
                activeDot={{ r: 4, stroke: 'var(--panel)', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <Head title="Latest HEX into the stake" sub="each transfer, newest first" />
        <ul className="overflow-hidden rounded-xl border border-[var(--line)]">
          {inflows.latest.map((a, k) => (
            <li
              key={`${a.tx}-${k}`}
              className="flex items-center gap-3 border-b border-[var(--line)] px-3 py-2 text-[12px] last:border-b-0"
            >
              <span className="w-[68px] shrink-0 text-[var(--text-faint)]" style={{ fontFamily: MONO }}>
                {ago(a.ts, now)}
              </span>
              <span className="w-[96px] shrink-0 text-right font-bold tabular-nums text-[var(--text)]">
                {hex(a.hex)} HEX
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[var(--text-muted)]">
                <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: SERIES[a.source].color }} />
                <span className="truncate sm:hidden">{SERIES[a.source].short}</span>
                <span className="hidden truncate sm:inline">{SERIES[a.source].label}</span>
              </span>
              <a
                href={pulsechainTxUrl(a.tx)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-[11px] text-[var(--text-faint)] hover:text-[var(--text)]"
                style={{ fontFamily: MONO }}
              >
                {a.tx.slice(0, 8)}…
                <IconExternalLink className="h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <Head title="Every day in range" sub="newest first · the numbers behind the bars" />
        <DataTable
          key={range}
          cols={cols}
          rows={[...rows].reverse()}
          rowKey={(r) => r.day}
          muted={(r) => r.total === 0}
        />
      </section>
    </div>
  );
}
