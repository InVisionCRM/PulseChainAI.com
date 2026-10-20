'use client';

// Every cycle as a ledger: what the stake opened with, what came in (HEX's own
// yield, the tax, anything sent in), the 1% that went out, and what it closed
// into. For a finished cycle those add up exactly — the restake is everything
// the contract holds after paying holders, verified to the heart for all 18.

import { useMemo } from 'react';
import {
  Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { dayToISO, type SuperStakeCycle } from '@/lib/superstake/model';
import type { InflowsPayload } from '@/app/api/superstake/inflows/route';
import {
  AXIS_TICK, DataTable, Head, Legend, SERIES, Tile, TipBox,
  dayShort, hex, hexShort, pct, sameRestakes, stackShape, type Col, type SeriesKey,
} from './shared';

interface CycleRow {
  i: number;
  d0: number;
  d1: number;
  done: boolean;
  opened: number;
  yield: number;
  tax: number;
  direct: number;
  refl: number;
  /** Positive HEX; null while the cycle is still running. */
  paid: number | null;
  /** The next cycle's principal; null for the one still running. */
  closedInto: number | null;
}

/** Bottom to top above the axis; the payout hangs below it. */
const IN = ['yield', 'tax', 'direct', 'refl'] as const;
const ORDER: SeriesKey[] = ['pay', ...IN];

export default function CyclePanel({
  cycles, inflows,
}: { cycles: SuperStakeCycle[]; inflows: InflowsPayload }) {
  const aligned = sameRestakes(cycles, inflows);

  const rows = useMemo<CycleRow[]>(
    () =>
      cycles.map((c, k) => {
        const inn = inflows.cycles[k + 1];
        const next = cycles[k + 1];
        return {
          i: c.i,
          d0: c.d0,
          d1: c.d1,
          done: c.done && !!next,
          opened: c.hex,
          yield: c.nY,
          tax: inn?.tax ?? 0,
          direct: inn?.direct ?? 0,
          refl: inn?.refl ?? 0,
          paid: c.done && next ? c.pay : null,
          closedInto: next ? next.hex : null,
        };
      }),
    [cycles, inflows],
  );

  if (!aligned) {
    return (
      <p className="rounded-xl border border-[var(--line)] bg-[var(--app-bg)] p-4 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
        The cycle record and the transfer record don&apos;t describe the same restakes right now —
        usually because a cycle has just rolled over and one of them hasn&apos;t caught up. Rather
        than pair one cycle&apos;s principal with another&apos;s inflows, this view waits. Reopen it
        in a few minutes.
      </p>
    );
  }

  const finished = rows.filter((r) => r.done);
  const seed = inflows.cycles[0];
  const life = {
    yield: finished.reduce((s, r) => s + r.yield, 0),
    paid: finished.reduce((s, r) => s + (r.paid ?? 0), 0),
  };
  const chart = rows.map((r) => ({ ...r, pay: r.paid == null ? 0 : -r.paid }));
  /** The first finished cycle whose own yield didn't cover its payout. */
  const firstShort = finished.find((r) => r.paid != null && r.yield < r.paid) ?? null;
  /** Whether yield plus the tax — without anything sent in — covered every payout from there on. */
  const taxCarried =
    !!firstShort && finished.filter((r) => r.i >= firstShort.i).every((r) => r.yield + r.tax >= (r.paid ?? 0));

  const cols: Col<CycleRow>[] = [
    { key: 'i', label: 'Cycle', text: true, cell: (r) => <b>{r.i}{r.done ? '' : ' · running'}</b> },
    { key: 'ran', label: 'Ran', text: true, cell: (r) => `${dayShort(r.d0)} – ${dayShort(r.d1)} ${dayToISO(r.d1).slice(0, 4)}` },
    { key: 'opened', label: 'Opened with', cell: (r) => hex(r.opened) },
    { key: 'yield', label: '+ HEX yield', cell: (r) => (r.done ? hex(r.yield) : `${hex(r.yield)} so far`) },
    { key: 'tax', label: '+ Tax', cell: (r) => hex(r.tax) },
    { key: 'direct', label: '+ Sent in', cell: (r) => hex(r.direct) },
    { key: 'refl', label: '+ Reflections', cell: (r) => hex(r.refl) },
    { key: 'paid', label: '− Paid out', cell: (r) => (r.paid == null ? 'at close' : hex(r.paid)) },
    { key: 'closed', label: 'Closed into', cell: (r) => (r.closedInto == null ? '—' : <b>{hex(r.closedInto)}</b>) },
    {
      key: 'growth',
      label: 'Growth',
      cell: (r) => (r.closedInto == null ? '—' : pct((r.closedInto / r.opened - 1) * 100, 2)),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Tile label="Bought by the 2% tax" value={`${hex(inflows.totals.tax)} HEX`} sub="every cycle, plus what's waiting" />
        <Tile
          label="Sent in directly"
          value={`${hex(inflows.totals.direct)} HEX`}
          sub={seed.direct > 0 ? `${hex(seed.direct)} of it before cycle 1` : undefined}
        />
        <Tile label="HEX's own yield" value={`${hex(life.yield)} HEX`} sub={`realised over ${finished.length} finished cycles`} />
        <Tile label="Paid to holders" value={`${hex(life.paid)} HEX`} sub={`the 1% at each of ${finished.length} end-stakes`} />
      </div>

      <section className="flex flex-col gap-2">
        <Head title="What came in, and the 1% that went out" sub="HEX per cycle · the running cycle so far" />
        <Legend keys={[...IN, 'pay']} />
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} stackOffset="sign" margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%" accessibilityLayer>
              <CartesianGrid vertical={false} stroke="var(--line)" />
              <XAxis dataKey="i" tick={AXIS_TICK} tickLine={false} axisLine={false} interval={0} />
              <YAxis tickFormatter={hexShort} tick={AXIS_TICK} tickLine={false} axisLine={false} width={50} />
              <ReferenceLine y={0} stroke="var(--line-strong)" />
              <Tooltip
                cursor={{ fill: 'var(--line)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const r = payload[0].payload as CycleRow;
                  return (
                    <TipBox
                      title={`Cycle ${r.i} · ${dayShort(r.d0)} – ${dayShort(r.d1)}${r.done ? '' : ' · running'}`}
                      rows={[
                        { key: 'opened', label: 'opened with', value: hex(r.opened) },
                        ...IN.map((k) => ({ key: k, label: SERIES[k].label, value: `+${hex(r[k])}`, color: SERIES[k].color })),
                        {
                          key: 'pay',
                          label: SERIES.pay.label,
                          value: r.paid == null ? 'at close' : `−${hex(r.paid)}`,
                          color: SERIES.pay.color,
                        },
                      ]}
                      foot={
                        r.closedInto == null
                          ? 'Still running — yield is accrued so far, the payout comes at the end-stake.'
                          : `Closed into ${hex(r.closedInto)} HEX · ${pct((r.closedInto / r.opened - 1) * 100, 2)}`
                      }
                    />
                  );
                }}
              />
              {ORDER.map((k) => (
                <Bar
                  key={k}
                  dataKey={k}
                  stackId="flow"
                  fill={SERIES[k].color}
                  maxBarSize={24}
                  shape={stackShape(ORDER, k)}
                  name={SERIES[k].label}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {firstShort && (
          <p className="text-[11px] leading-relaxed text-[var(--text-faint)]">
            Up to cycle {firstShort.i - 1}, HEX&apos;s own yield alone was more than the 1% paid out. From cycle{' '}
            {firstShort.i} it hasn&apos;t been — {hex(firstShort.yield)} HEX of yield against{' '}
            {hex(firstShort.paid ?? 0)} paid
            {taxCarried ? ' — and the tax alone has made up the difference in every cycle since.' : '.'}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <Head title="The ledger" sub="opened with + everything in − the 1% = closed into" />
        <DataTable cols={cols} rows={[...rows].reverse()} rowKey={(r) => r.i} first={20} muted={(r) => !r.done} />
        {seed && (
          <p className="text-[11px] leading-relaxed text-[var(--text-faint)]">
            Before cycle 1: {hex(seed.direct)} HEX sent in and {hex(seed.tax)} HEX from the tax opened the first
            stake with {hex(seed.direct + seed.tax + seed.refl)} HEX.
          </p>
        )}
      </section>
    </div>
  );
}
