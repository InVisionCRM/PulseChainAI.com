'use client';

// The HEX side of the machine: what HEX itself pays the stake, how that has
// changed, and where the stake is headed at the next restake. Read entirely
// from the live cycle record and its daily series — never the baked
// snapshot's single payout figure, which is months old by now.

import { useMemo } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { HOLDER_PAYOUT_RATE, currentRates, type SuperStakeCycle } from '@/lib/superstake/model';
import {
  AXIS_TICK, DataTable, Head, ONE, SERIES, Tile, TipBox,
  at, dayLong, dayShort, hex, pct, type Col, type Series,
} from './shared';

interface DayRow {
  day: number;
  /** HEX paid per T-share that day. */
  p: number | null;
  /** HEX per T-share — what a new T-share costs. */
  sr: number | null;
}

interface CycleRow {
  i: number;
  d0: number;
  done: boolean;
  tsh: number;
  /** Share rate on the day the cycle opened. */
  sr: number | null;
  nY: number;
  /** Yield as a share of the principal, percent. */
  yieldPct: number;
  pay: number;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export default function HexPanel({
  cycles, series, globalTShares, waiting, aligned,
}: {
  cycles: SuperStakeCycle[];
  series: Series;
  globalTShares: number | null;
  /** HEX in the contract waiting for the next restake. */
  waiting: number;
  /** Whether `waiting` belongs to the same cycle as `cycles`' last entry. */
  aligned: boolean;
}) {
  const running = cycles[cycles.length - 1];
  const last = series.d0 + series.P.length - 1;

  const days = useMemo<DayRow[]>(
    () =>
      series.P.map((_, k) => {
        const day = series.d0 + k;
        const p = at(series.P, series.d0, day);
        const sr = at(series.SR, series.d0, day);
        return { day, p: p && p > 0 ? p : null, sr: sr && sr > 0 ? sr : null };
      }),
    [series],
  );

  const perCycle = useMemo<CycleRow[]>(
    () =>
      cycles.map((c) => ({
        i: c.i,
        d0: c.d0,
        done: c.done,
        tsh: c.tsh,
        sr: at(series.SR, series.d0, c.d0),
        nY: c.nY,
        yieldPct: c.hex > 0 ? (c.nY / c.hex) * 100 : 0,
        pay: c.pay,
      })),
    [cycles, series],
  );

  // The running cycle's own pace so far: its average payout per T-share,
  // carried across the full term. HEX's daily payout moves day to day, so one
  // day's figure would swing this by a third.
  const cycleDays = running.d1 - running.d0;
  const elapsedP = days
    .filter((d) => d.day >= running.d0 && d.day < running.d1 && d.p != null)
    .map((d) => d.p as number);
  const pace = avg(elapsedP);
  const projYield = running.tsh * pace * cycleDays;
  const nextRestake = (running.hex + projYield) * (1 - HOLDER_PAYOUT_RATE) + waiting;

  // The same reading the rest of the page projects from, so the two can't differ.
  const rates = currentRates(series);
  const recentP = rates.payoutPerTshare;
  const srNow = rates.shareRate > 0 ? rates.shareRate : null;
  const srFirst = perCycle[0]?.sr ?? null;
  const finished = perCycle.filter((c) => c.done);

  const cycleCols: Col<CycleRow>[] = [
    { key: 'i', label: 'Cycle', text: true, cell: (c) => <b>{c.i}{c.done ? '' : ' · running'}</b> },
    { key: 'tsh', label: 'T-shares', cell: (c) => c.tsh.toFixed(2) },
    { key: 'sr', label: 'Share rate at open', cell: (c) => (c.sr == null ? '—' : Math.round(c.sr).toLocaleString()) },
    { key: 'nY', label: 'HEX yield', cell: (c) => (c.done ? hex(c.nY) : `${hex(c.nY)} so far`) },
    { key: 'pct', label: 'Yield / principal', cell: (c) => `${c.yieldPct.toFixed(3)}%` },
    { key: 'pay', label: '1% paid', cell: (c) => (c.done ? hex(c.pay) : 'at close') },
  ];
  const dayCols: Col<DayRow>[] = [
    { key: 'day', label: 'Day (UTC)', text: true, cell: (d) => dayLong(d.day) },
    { key: 'p', label: 'HEX per T-share', cell: (d) => (d.p == null ? '—' : d.p.toFixed(4)) },
    { key: 'sr', label: 'Share rate', cell: (d) => (d.sr == null ? '—' : Math.round(d.sr).toLocaleString()) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Tile
          label={`Cycle ${running.i + 1} opens with`}
          value={aligned ? `≈ ${hex(nextRestake)} HEX` : '—'}
          sub={
            aligned
              ? `from ${dayLong(running.d1)}, if HEX keeps paying this cycle's average so far — before whatever the tax adds by then`
              : 'waiting for the cycle record to catch up with the transfer record'
          }
        />
        <Tile
          label="T-shares in the stake"
          value={running.tsh.toFixed(2)}
          sub={
            globalTShares
              ? `${((running.tsh / globalTShares) * 100).toPrecision(2)}% of every T-share staked`
              : undefined
          }
        />
        <Tile
          label="Share rate"
          value={srNow == null ? '—' : Math.round(srNow).toLocaleString()}
          sub={srFirst && srNow ? `HEX per T-share · ${pct((srNow / srFirst - 1) * 100)} since cycle 1` : 'HEX per T-share'}
        />
        <Tile
          label="Payout per T-share"
          value={`${recentP.toFixed(3)} HEX`}
          sub="a day, averaged over the last 30"
        />
      </div>

      <section className="flex flex-col gap-2">
        <Head title="HEX's own yield, each finished cycle" sub="as a share of the principal · the dashed line is the 1% paid out" />
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={finished} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%" accessibilityLayer>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="i" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} interval={0} />
              <YAxis tickFormatter={(v: number) => `${v}%`} tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
              <ReferenceLine
                y={HOLDER_PAYOUT_RATE * 100}
                stroke="var(--text-faint)"
                strokeDasharray="4 4"
                label={{ value: '1% paid out', position: 'insideTopRight', fill: 'var(--text-faint)', fontSize: 10 }}
              />
              <Tooltip
                cursor={{ fill: 'var(--line)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const c = payload[0].payload as CycleRow;
                  return (
                    <TipBox
                      title={`Cycle ${c.i}`}
                      rows={[
                        { key: 'pct', label: 'of the principal', value: `${c.yieldPct.toFixed(3)}%`, color: SERIES.yield.color },
                        { key: 'nY', label: 'HEX of yield', value: hex(c.nY) },
                        { key: 'pay', label: 'paid to holders', value: hex(c.pay) },
                      ]}
                    />
                  );
                }}
              />
              <Bar dataKey="yieldPct" fill={SERIES.yield.color} maxBarSize={24} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <Head title="T-shares in the stake, every cycle" sub="more HEX restaked each time, at a share rate that never falls" />
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={perCycle} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%" accessibilityLayer>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="i" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} interval={0} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                cursor={{ fill: 'var(--line)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const c = payload[0].payload as CycleRow;
                  return (
                    <TipBox
                      title={`Cycle ${c.i}${c.done ? '' : ' · running'}`}
                      rows={[{ key: 'tsh', label: 'T-shares', value: c.tsh.toFixed(2) }]}
                      foot={c.sr ? `share rate ${Math.round(c.sr).toLocaleString()} when it opened` : undefined}
                    />
                  );
                }}
              />
              <Bar dataKey="tsh" fill={ONE} maxBarSize={24} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <TrendChart days={days} field="sr" title="Share rate" sub="HEX per T-share — it only ever climbs" fmt={(v) => Math.round(v).toLocaleString()} />
      <TrendChart days={days} field="p" title="Payout per T-share" sub="HEX per T-share per day, as HEX pays it" fmt={(v) => v.toFixed(3)} />

      <section className="flex flex-col gap-2">
        <Head title="Every cycle" sub="newest first" />
        <DataTable cols={cycleCols} rows={[...perCycle].reverse()} rowKey={(c) => c.i} first={20} muted={(c) => !c.done} />
      </section>
      <section className="flex flex-col gap-2">
        <Head title="Every day" sub={`newest first · through ${dayLong(last)}`} />
        <DataTable cols={dayCols} rows={[...days].reverse()} rowKey={(d) => d.day} />
      </section>
    </div>
  );
}

function TrendChart({
  days, field, title, sub, fmt,
}: {
  days: DayRow[];
  field: 'sr' | 'p';
  title: string;
  sub: string;
  fmt: (v: number) => string;
}) {
  const id = `ssk-hex-${field}`;
  return (
    <section className="flex flex-col gap-2">
      <Head title={title} sub={sub} />
      <div className="h-[170px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={days} margin={{ top: 8, right: 18, bottom: 0, left: 0 }} accessibilityLayer>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={ONE} stopOpacity={0.14} />
                <stop offset="1" stopColor={ONE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="day" tickFormatter={dayShort} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} minTickGap={28} />
            <YAxis tickFormatter={fmt} tick={AXIS_TICK} tickLine={false} axisLine={false} width={52} domain={['auto', 'auto']} />
            <Tooltip
              cursor={{ stroke: 'var(--line-strong)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as DayRow;
                const v = d[field];
                return <TipBox title={dayLong(d.day)} rows={[{ key: field, label: title, value: v == null ? '—' : fmt(v) }]} />;
              }}
            />
            <Area
              type="monotone"
              dataKey={field}
              stroke={ONE}
              strokeWidth={2}
              fill={`url(#${id})`}
              connectNulls
              activeDot={{ r: 4, stroke: 'var(--panel)', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
