'use client';

// The market the machine runs on: pSSH's price and trade volume, HEX's price,
// and pSSH priced in HEX. All of it is the daily series the page already loads
// from the PulseX subgraph (untracked volume, so the smaller pairs count) —
// none of it was drawn anywhere until now. Four measures, four charts: no two
// scales ever share an axis.

import { useMemo } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  AXIS_TICK, DataTable, Delta, Head, ONE, Tile, TipBox,
  at, dayLong, dayShort, price, span, usd, weekly,
  type Col, type RangeId, type Series,
} from './shared';

interface MarketRow {
  day: number;
  pssh: number | null;
  vol: number | null;
  phex: number | null;
  /** pSSH priced in HEX — how many HEX one pSSH buys. */
  inHex: number | null;
}

const ratio = (n: number | null) => (n == null ? '—' : n.toFixed(n < 1 ? 4 : 3));

export default function MarketPanel({
  series, range, pSshNow, pHexNow,
}: { series: Series; range: RangeId; pSshNow: number | null; pHexNow: number | null }) {
  const all = useMemo<MarketRow[]>(
    () =>
      series.PV.map((_, k) => {
        const day = series.d0 + k;
        const pssh = at(series.PV, series.d0, day);
        const phex = at(series.PH, series.d0, day);
        return {
          day,
          pssh: pssh && pssh > 0 ? pssh : null,
          vol: at(series.VV, series.d0, day),
          phex: phex && phex > 0 ? phex : null,
          inHex: pssh && phex && pssh > 0 && phex > 0 ? pssh / phex : null,
        };
      }),
    [series],
  );

  const last = all[all.length - 1].day;
  const { from, weekly: byWeek } = span(range, all[0].day, last);
  const rows = useMemo(() => all.filter((r) => r.day >= from), [all, from]);
  const volBars = useMemo(
    () => (byWeek ? weekly(rows, ['vol']) : rows.map((r) => ({ ...r, to: r.day }))),
    [rows, byWeek],
  );

  const first = rows.find((r) => r.pssh != null && r.phex != null) ?? rows[0];
  const end = rows[rows.length - 1];
  const psshNow = pSshNow ?? end.pssh;
  const phexNow = pHexNow ?? end.phex;
  const change = (now: number | null, then: number | null) =>
    now != null && then != null && then > 0 ? (now / then - 1) * 100 : null;
  const traded = rows.reduce((s, r) => s + (r.vol ?? 0), 0);
  const inHexNow = psshNow && phexNow ? psshNow / phexNow : null;

  const cols: Col<MarketRow>[] = [
    { key: 'day', label: 'Day (UTC)', text: true, cell: (r) => (r.day === last ? `${dayLong(r.day)} · so far` : dayLong(r.day)) },
    { key: 'pssh', label: 'pSSH', cell: (r) => price(r.pssh) },
    { key: 'vol', label: 'pSSH traded', cell: (r) => usd(r.vol) },
    { key: 'phex', label: 'pHEX', cell: (r) => price(r.phex) },
    { key: 'inHex', label: 'pSSH in HEX', cell: (r) => ratio(r.inHex) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Tile
          label="pSSH"
          value={price(psshNow)}
          sub={<><Delta v={change(psshNow, first.pssh)} /> over the range</>}
        />
        <Tile label="pSSH traded" value={usd(traded)} sub={`${usd(traded / rows.length)} a day on average`} />
        <Tile
          label="pHEX"
          value={price(phexNow)}
          sub={<><Delta v={change(phexNow, first.phex)} /> over the range</>}
        />
        <Tile
          label="1 pSSH buys"
          value={`${ratio(inHexNow)} HEX`}
          sub={<><Delta v={change(inHexNow, first.inHex)} /> over the range</>}
        />
      </div>

      <PriceChart rows={rows} field="pssh" title="pSSH price" sub="USD, daily" fmt={price} />

      <section className="flex flex-col gap-2">
        <Head
          title={byWeek ? 'pSSH traded each week' : 'pSSH traded each day'}
          sub="USD across every pair — this is what funds the 5.5%"
        />
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volBars} margin={{ top: 8, right: 18, bottom: 0, left: 0 }} barCategoryGap="18%" accessibilityLayer>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="day" tickFormatter={dayShort} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} minTickGap={28} />
              <YAxis tickFormatter={(v: number) => usd(v)} tick={AXIS_TICK} tickLine={false} axisLine={false} width={50} />
              <Tooltip
                cursor={{ fill: 'var(--line)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const r = payload[0].payload as MarketRow & { to: number };
                  return (
                    <TipBox
                      title={byWeek ? `${dayShort(r.day)} – ${dayLong(r.to)}` : `${dayLong(r.day)}${r.day === last ? ' · so far' : ''}`}
                      rows={[{ key: 'vol', label: 'pSSH traded', value: usd(r.vol) }]}
                    />
                  );
                }}
              />
              <Bar dataKey="vol" fill={ONE} maxBarSize={24} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <PriceChart rows={rows} field="phex" title="pHEX price" sub="USD, daily" fmt={price} />
      <PriceChart
        rows={rows}
        field="inHex"
        title="pSSH priced in HEX"
        sub="how many HEX one pSSH buys — the price with HEX's own moves taken out"
        fmt={(v) => `${ratio(v)} HEX`}
      />

      <section className="flex flex-col gap-2">
        <Head title="Every day in range" sub="newest first" />
        <DataTable key={range} cols={cols} rows={[...rows].reverse()} rowKey={(r) => r.day} />
      </section>
    </div>
  );
}

function PriceChart({
  rows, field, title, sub, fmt,
}: {
  rows: MarketRow[];
  field: 'pssh' | 'phex' | 'inHex';
  title: string;
  sub: string;
  fmt: (v: number | null) => string;
}) {
  const id = `ssk-mkt-${field}`;
  return (
    <section className="flex flex-col gap-2">
      <Head title={title} sub={sub} />
      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 18, bottom: 0, left: 0 }} accessibilityLayer>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={ONE} stopOpacity={0.14} />
                <stop offset="1" stopColor={ONE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="day" tickFormatter={dayShort} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} minTickGap={28} />
            <YAxis
              tickFormatter={(v: number) => fmt(v).replace(' HEX', '')}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={64}
              domain={['auto', 'auto']}
            />
            <Tooltip
              cursor={{ stroke: 'var(--line-strong)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as MarketRow;
                return <TipBox title={dayLong(r.day)} rows={[{ key: field, label: title, value: fmt(r[field]) }]} />;
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
