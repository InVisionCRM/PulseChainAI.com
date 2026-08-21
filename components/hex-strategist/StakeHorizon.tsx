'use client';

// The macro view — every locked HEX stake on the chain, plotted by the day it
// comes due. A bar per period for what matures; a slim strip underneath tracks
// how much of the whole schedule has been released by that point.
//
// The two live on separate scales on purpose: the bars are absolute value, the
// strip is 0–100% of the schedule. Overlaying them on one plot means two
// competing y-axes, so instead they share the x-axis and hover (syncId) and
// each keeps a single honest axis.
//
// The schedule is violently uneven — a single day in the 2040s carries a
// quarter of all locked HEX, because 5555-day stakes all land together. That
// spike flattens every other bar on a linear axis, so there's a log toggle,
// and the released strip (which reads the same either way) carries the shape.

import { useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { IconRefresh, IconChartHistogram, IconAlertTriangle, IconFlame } from '@tabler/icons-react';
import { type Network, type Rates, type RatesSourceReporter, loadRates } from '@/lib/hex/strategistData';
import {
  toSeries, biggestDay, dayForFraction, type Grain, type UnlockBucket,
} from '@/lib/hex/unlockSchedule';
import { fmtHex, fmtUsdShort, fmtHexDate, fmtDuration, hexDayToDate } from '@/lib/hex/hexDay';
import { HexLogo } from '@/components/hex/HexAmount';
import { HeroNumber, Speedo } from '@/components/hex/Instruments';
import StrategistShareCards from './StrategistShareCards';

interface ScheduleData {
  currentDay: number;
  /** [day, hex, tShares, stakes] */
  buckets: [number, number, number, number][];
  overdue: UnlockBucket;
  frozen?: { hex: number; stakes: number };
  totals: { hex: number; tShares: number; stakes: number };
  network_totals: { hex: number; tShares: number };
  coverage: { hexPct: number; tSharesPct: number };
  lastDay: number;
  note: string;
}

/** Sent while the stake index is still being built for the first time. */
interface IndexingState {
  progressPct: number;
  stakesIndexed: number;
  reason: string;
}

type Metric = 'hex' | 'tShares';
/**
 * √ is the default: the schedule is so heavy-tailed (one day carries 24% of
 * everything) that linear crushes every ordinary period into invisible slivers,
 * while log makes the giants look ordinary. Square-root keeps the monsters
 * obviously biggest and the small periods readable at the same time.
 */
type Scale = 'lin' | 'sqrt' | 'log';

const HORIZONS: { key: string; label: string; years: number | null; grain: Grain }[] = [
  { key: '1y', label: '1Y', years: 1, grain: 'week' },
  { key: '3y', label: '3Y', years: 3, grain: 'month' },
  { key: '5y', label: '5Y', years: 5, grain: 'month' },
  { key: 'max', label: 'Max', years: null, grain: 'quarter' },
];

const GRAIN_LABEL: Record<Grain, string> = { day: 'day', week: 'week', month: 'month', quarter: 'quarter' };

const tsh = (t: number) => (t >= 1000 ? Math.round(t).toLocaleString() : t.toFixed(1));
const shortDate = (day: number) =>
  hexDayToDate(day).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });

/** Both charts share these so their plot columns align pixel-for-pixel. */
const CHART_MARGIN = { top: 6, right: 10, bottom: 0, left: 4 };
const Y_WIDTH = 58;

export default function StakeHorizon({ net, onSource }: { net: Network; onSource?: RatesSourceReporter }) {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [indexing, setIndexing] = useState<IndexingState | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'indexing' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [rates, setRates] = useState<Rates | null>(null);
  const [reload, setReload] = useState(0);
  const [horizon, setHorizon] = useState('3y');
  const [metric, setMetric] = useState<Metric>('hex');
  const [scale, setScale] = useState<Scale>('sqrt');

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    setErrMsg(null);
    fetch(`/api/hex/unlock-schedule?network=${net}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        // 503 with `indexing` is the first-run state, not a failure.
        if (r.status === 503 && j?.indexing) {
          return { indexing: j as IndexingState, data: null };
        }
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        return { indexing: null, data: j as ScheduleData };
      })
      .then((res) => {
        if (!alive) return;
        if (res.indexing) {
          setIndexing(res.indexing);
          setStatus('indexing');
        } else {
          setData(res.data);
          setStatus('ready');
        }
      })
      .catch((e) => {
        if (!alive) return;
        setErrMsg(e instanceof Error ? e.message : null);
        setStatus('error');
      });
    return () => { alive = false; };
  }, [net, reload]);

  useEffect(() => {
    let alive = true;
    // This is the landing tab, so it is the one that reports the two HEX feeds
    // the entry loader counts — nothing else is guaranteed to mount.
    loadRates(net, onSource).then((r) => alive && setRates(r)).catch(() => {});
    return () => { alive = false; };
  }, [net, onSource]);

  const buckets = useMemo<UnlockBucket[]>(
    () => (data?.buckets ?? []).map(([day, hex, tShares, stakes]) => ({ day, hex, tShares, stakes })),
    [data],
  );

  const view = HORIZONS.find((h) => h.key === horizon)!;
  const series = useMemo(() => {
    if (!data) return [];
    const days = view.years ? view.years * 365 : Math.max(1, data.lastDay - data.currentDay + 1);
    const total = metric === 'hex' ? data.totals.hex : data.totals.tShares;
    return toSeries(buckets, data.currentDay, days, view.grain).map((p) => ({
      ...p,
      released: total > 0 ? ((metric === 'hex' ? p.cumHex : p.cumTShares) / total) * 100 : 0,
    }));
  }, [data, buckets, view, metric]);

  const peak = useMemo(() => biggestDay(buckets), [buckets]);
  const halfDay = useMemo(() => dayForFraction(buckets, 0.5), [buckets]);

  if (status === 'loading') {
    return (
      <div className="grid place-items-center py-20 text-center text-sm text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-2">
          <IconRefresh className="h-4 w-4 animate-spin" /> Reading the stake index…
        </span>
      </div>
    );
  }
  if (status === 'indexing' && indexing) {
    return <Indexing state={indexing} onRetry={() => setReload((n) => n + 1)} />;
  }
  if (status === 'error' || !data) {
    return (
      <div className="py-20 text-center text-sm text-red-300">
        Couldn’t build the unlock schedule.
        <button onClick={() => setReload((n) => n + 1)} className="ml-2 underline">retry</button>
        {errMsg && <div className="mt-2 text-xs text-[var(--text-faint)]">{errMsg}</div>}
      </div>
    );
  }

  const usd = (hex: number) => (rates?.priceUsd ? hex * rates.priceUsd : null);
  const fmtValue = (v: number) => (metric === 'hex' ? fmtHex(v) : `${tsh(v)} T`);
  const peakPct = peak && data.totals.hex > 0 ? (peak.hex / data.totals.hex) * 100 : 0;

  // Two dials the schedule can answer on its own: how concentrated the whole
  // thing is in its single worst day, and how much of what is mapped is
  // already past due. Both are shares of the same total, so both read 0–100.
  const overduePct = data.totals.hex > 0 ? (data.overdue.hex / data.totals.hex) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* ── Hero: always-dark molten panel, the same one the Rescue Wall wears ── */}
      <div
        className="anim-rise relative overflow-hidden rounded-3xl border border-white/10 bg-[#06182e] p-5 md:p-7"
        style={{
          ['--text' as string]: '#ffffff',
          ['--text-muted' as string]: 'rgba(255,255,255,0.70)',
          ['--text-faint' as string]: 'rgba(255,255,255,0.45)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(120% 140% at 92% -20%, rgba(255,158,0,0.30) 0%, rgba(255,46,126,0.13) 45%, transparent 75%)' }}
        />
        <img
          src="/hex-logo.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -right-14 -top-14 h-60 w-60 rotate-12 select-none object-contain opacity-[0.20] md:h-72 md:w-72"
        />
        <div className="relative">
          <div className="font-poppins text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
            Every locked stake on {net}
          </div>
          <div className="mt-5 grid gap-6 sm:grid-cols-3 md:gap-8">
            <HeroNumber
              label="HEX locked"
              value={data.network_totals.hex}
              fmt="hex"
              sub={usd(data.network_totals.hex) != null ? fmtUsdShort(usd(data.network_totals.hex)!) : `${data.totals.stakes.toLocaleString()} stakes`}
              gradient
            />
            <HeroNumber label="T-Shares locked" value={data.network_totals.tShares} fmt="int" sub="live, earning" />
            <HeroNumber
              label="Biggest single day"
              value={peak?.hex ?? 0}
              fmt="hex"
              sub={peak ? `${fmtHexDate(peak.day)} · ${peakPct.toFixed(0)}% of everything` : 'no schedule mapped'}
            />
          </div>
        </div>
      </div>

      {/* ── The two dials, beside the date that matters most ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Speedo
          frac={peakPct / 100}
          figure={`${peakPct.toFixed(1)}%`}
          label="Concentrated in one day"
          sub={peak ? `${fmtHexDate(peak.day)} carries ${fmtHex(peak.hex)} HEX` : '—'}
          tone="a"
        />
        <Speedo
          frac={overduePct / 100}
          figure={`${overduePct.toFixed(1)}%`}
          label="Already past due"
          sub={`${fmtHex(data.overdue.hex)} HEX matured and unclaimed`}
          tone="b"
        />
        <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="font-poppins text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Half is free by
          </div>
          <div className="font-jost mt-1.5 text-[34px] font-bold leading-none tracking-tight text-[var(--text)] md:text-[40px]">
            {halfDay != null ? fmtHexDate(halfDay) : '—'}
          </div>
          <div className="font-poppins mt-1.5 text-[11px] text-[var(--text-muted)]">
            {halfDay != null ? `${fmtDuration(halfDay - data.currentDay)} from today` : 'no schedule mapped'}
          </div>
          <div className="mt-3 border-t border-[var(--line)] pt-2.5">
            <div className="font-poppins text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
              Last stake matures
            </div>
            <div className="font-jost mt-0.5 text-[20px] font-bold leading-none text-[var(--text)]">
              {fmtHexDate(data.lastDay)}
            </div>
          </div>
        </div>
      </div>

      <Overdue overdue={data.overdue} frozen={data.frozen} />

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-jost inline-flex items-center gap-1.5 text-[15px] font-bold text-[var(--text)]">
            <IconChartHistogram className="h-4 w-4 text-[var(--chart-accent)]" /> Unlock schedule
          </span>
          <span className="font-poppins text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
            per {GRAIN_LABEL[view.grain]} · all {data.totals.stakes.toLocaleString()} stakes
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Segmented
            options={[{ key: 'hex', label: 'HEX' }, { key: 'tShares', label: 'T-Shares' }]}
            value={metric}
            onChange={(v) => setMetric(v as Metric)}
          />
          <Segmented options={HORIZONS.map((h) => ({ key: h.key, label: h.label }))} value={horizon} onChange={setHorizon} />
          <span title="How bar heights scale. √ keeps the monster days from crushing the small ones; Lin is true proportions; Log flattens everything.">
            <Segmented
              options={[{ key: 'lin', label: 'Lin' }, { key: 'sqrt', label: '√' }, { key: 'log', label: 'Log' }]}
              value={scale}
              onChange={(v) => setScale(v as Scale)}
            />
          </span>
          <StrategistShareCards net={net} schedule={data} rates={rates} />
        </div>
      </div>

      {/* The chart: bars up top, the released strip beneath, one x-axis for both. */}
      <div className="anim-rise rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 pb-2" style={{ animationDelay: '120ms' }}>
        <div className="h-[190px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={CHART_MARGIN} syncId="horizon">
              <CartesianGrid stroke="var(--line-soft)" vertical={false} />
              <XAxis dataKey="day" hide />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--text-faint)' }}
                tickFormatter={(v: number) => (metric === 'hex' ? fmtHex(v) : tsh(v))}
                axisLine={false}
                tickLine={false}
                // A log axis cannot start at 0, and every empty period is 0 —
                // so the domain floors at 1 and zero bars simply don't draw.
                scale={scale === 'lin' ? 'auto' : scale}
                domain={scale === 'log' ? [1, 'auto'] : [0, 'auto']}
                allowDataOverflow={scale === 'log'}
                width={Y_WIDTH}
              />
              <Tooltip
                cursor={{ fill: 'var(--surface-3)' }}
                content={<HorizonTooltip metric={metric} grain={view.grain} usd={usd} fmtValue={fmtValue} />}
              />
              <Bar
                dataKey={metric}
                fill="var(--chart-accent)"
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                animationDuration={700}
                animationEasing="ease-out"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="h-[64px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ ...CHART_MARGIN, top: 4, bottom: 0 }} syncId="horizon">
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: 'var(--text-faint)' }}
                tickFormatter={shortDate}
                axisLine={{ stroke: 'var(--line-soft)' }}
                tickLine={false}
                minTickGap={44}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 100]}
                tick={{ fontSize: 9, fill: 'var(--text-faint)' }}
                tickFormatter={(v: number) => `${v}%`}
                axisLine={false}
                tickLine={false}
                width={Y_WIDTH}
              />
              <Tooltip content={() => null} cursor={{ stroke: 'var(--line)' }} />
              <Area
                type="monotone"
                dataKey="released"
                stroke="var(--chart-flow)"
                strokeWidth={2}
                fill="var(--chart-flow)"
                fillOpacity={0.1}
                dot={false}
                animationDuration={1100}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[10px] text-[var(--text-faint)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-[3px] bg-[var(--chart-accent)]" />
            {metric === 'hex' ? 'HEX' : 'T-Shares'} coming due per {GRAIN_LABEL[view.grain]}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded-full bg-[var(--chart-flow)]" />
            Share of the schedule released by then
          </span>
        </div>
      </div>

      <BiggestDays buckets={buckets} total={data.totals.hex} currentDay={data.currentDay} usd={usd} />

      <p className="px-1 text-[10px] leading-relaxed text-[var(--text-faint)]">
        Every locked stake on {net}, from the synced index. Ended stakes are out; good-accounted ones
        count until someone claims the HEX.
      </p>
    </div>
  );
}

/** Value first, context second — one readout for both charts at the hovered X. */
function HorizonTooltip({ active, payload, label, metric, grain, usd, fmtValue }: {
  active?: boolean;
  payload?: { payload: UnlockBucket & { released: number } }[];
  label?: number;
  metric: Metric;
  grain: Grain;
  usd: (hex: number) => number | null;
  fmtValue: (v: number) => string;
}) {
  if (!active || !payload?.length || label == null) return null;
  const p = payload[0].payload;
  const v = metric === 'hex' ? p.hex : p.tShares;
  const $ = metric === 'hex' ? usd(p.hex) : null;
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 shadow-xl">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
        {grain === 'day' ? '' : `${GRAIN_LABEL[grain]} of `}{fmtHexDate(Number(label))}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--chart-accent)]" />
        <span className="text-sm font-bold tabular-nums text-[var(--text)]">{fmtValue(v)}</span>
        <span className="text-[11px] text-[var(--text-muted)]">
          due{$ != null && ` · ${fmtUsdShort($)}`}{p.stakes > 0 && ` · ${p.stakes.toLocaleString()} stakes`}
        </span>
      </div>
      <div className="mt-0.5 flex items-center gap-2">
        <span className="h-0.5 w-2.5 rounded-full bg-[var(--chart-flow)]" />
        <span className="text-sm font-bold tabular-nums text-[var(--text)]">{p.released.toFixed(1)}%</span>
        <span className="text-[11px] text-[var(--text-muted)]">released by then</span>
      </div>
    </div>
  );
}

/**
 * What is already past due, as a meter instead of a paragraph: the frozen
 * (good-accounted) slice and the still-bleeding slice of one overdue total.
 */
function Overdue({ overdue, frozen }: { overdue: UnlockBucket; frozen?: { hex: number; stakes: number } }) {
  if (overdue.stakes <= 0) return null;
  const frozenHex = frozen?.hex ?? 0;
  const bleedHex = Math.max(0, overdue.hex - frozenHex);
  const frozenPct = overdue.hex > 0 ? (frozenHex / overdue.hex) * 100 : 0;
  return (
    <div className="anim-rise rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5" style={{ animationDelay: '80ms' }}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-500 dark:text-amber-300">
          <IconAlertTriangle className="h-3.5 w-3.5" /> Past due, unclaimed
        </span>
        <span className="text-sm font-bold tabular-nums text-[var(--text)]">{fmtHex(overdue.hex)} HEX</span>
        <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
          {overdue.stakes.toLocaleString()} stakes
        </span>
      </div>
      {/* 2px surface gap between the two segments, per the mark spec. */}
      <div className="mt-2 flex h-1.5 gap-[2px] overflow-hidden rounded-full">
        <div className="anim-grow rounded-l-full bg-[var(--text-faint)]" style={{ width: `${Math.max(2, frozenPct)}%`, animationDelay: '250ms' }} />
        <div className="min-w-[2%] flex-1 rounded-r-full bg-amber-500" />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]">
        <span className="text-[var(--text-muted)]">
          <b className="tabular-nums text-[var(--text)]">{fmtHex(frozenHex)}</b> frozen by good-accounting
          — penalty locked in
        </span>
        <span className="text-[var(--text-muted)]">
          <b className="tabular-nums text-[var(--text)]">{fmtHex(bleedHex)}</b>{' '}
          <span className="text-amber-500 dark:text-amber-300">bleeding the late-end penalty</span>
        </span>
      </div>
    </div>
  );
}

/**
 * The first run has to walk every stake the chain has ever opened, which takes
 * about 45 minutes. Showing real progress beats a spinner that looks stuck —
 * and there is no second data path to fall back to, by design: a live sample
 * would quietly disagree with the index it is standing in for.
 */
function Indexing({ state, onRetry }: { state: IndexingState; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
        <IconRefresh className="h-4 w-4 animate-spin text-[var(--chart-accent)]" /> Building the stake index
      </div>
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full bg-[var(--chart-accent)] transition-[width] duration-700"
          style={{ width: `${Math.max(2, state.progressPct)}%` }}
        />
      </div>
      <div className="mb-3 flex items-center justify-between text-[11px] tabular-nums text-[var(--text-muted)]">
        <span>{state.progressPct.toFixed(0)}%</span>
        <span>{state.stakesIndexed.toLocaleString()} locked stakes so far</span>
      </div>
      <p className="text-xs leading-relaxed text-[var(--text-muted)]">{state.reason}</p>
      <button onClick={onRetry} className="mt-3 text-xs text-[var(--text-faint)] underline hover:text-[var(--text)]">
        check again
      </button>
    </div>
  );
}

function Segmented({ options, value, onChange }: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors ${
            value === o.key
              ? 'bg-[var(--surface-3)] text-[var(--text)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The individual days worth knowing about — where the cliffs actually are. */
function BiggestDays({ buckets, total, currentDay, usd }: {
  buckets: UnlockBucket[];
  total: number;
  currentDay: number;
  usd: (hex: number) => number | null;
}) {
  const top = useMemo(() => [...buckets].sort((a, b) => b.hex - a.hex).slice(0, 8), [buckets]);
  if (!top.length) return null;
  const max = top[0].hex;
  const peakPct = total > 0 ? (top[0].hex / total) * 100 : 0;

  return (
    <div className="anim-rise rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4" style={{ animationDelay: '180ms' }}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="font-jost inline-flex items-center gap-1.5 text-[15px] font-bold text-[var(--text)]">
          <IconFlame className="h-4 w-4 text-rose-400" /> The cliffs
        </span>
        <span className="text-[11px] text-[var(--text-muted)]">
          The heaviest single days — <b className="text-[var(--text)]">{fmtHexDate(top[0].day)}</b> alone is{' '}
          <b className="tabular-nums text-[var(--text)]">{peakPct.toFixed(0)}%</b> of everything mapped.
        </span>
      </div>
      <div className="space-y-1.5">
        {top.map((b, i) => {
          const $ = usd(b.hex);
          return (
            <div key={b.day} className="group flex items-center gap-3">
              <div className="w-4 shrink-0 text-right text-[10px] tabular-nums text-[var(--text-faint)]">{i + 1}</div>
              <div className="w-24 shrink-0 text-xs font-semibold text-[var(--text)]">{fmtHexDate(b.day)}</div>
              <div className="h-4 min-w-0 flex-1 overflow-hidden rounded-[4px] bg-[var(--surface-2)]">
                <div
                  className="anim-grow h-full rounded-[4px] bg-[var(--chart-accent)] transition-opacity group-hover:opacity-80"
                  style={{
                    width: `${Math.max(2, (b.hex / max) * 100)}%`,
                    opacity: i === 0 ? 1 : 0.75,
                    animationDelay: `${200 + i * 70}ms`,
                  }}
                />
              </div>
              <div className="w-32 shrink-0 text-right text-xs">
                <span className="inline-flex items-center gap-1 font-bold tabular-nums text-[var(--text)]">
                  <HexLogo className="h-3 w-3" />{fmtHex(b.hex)}
                </span>
                <div className="tabular-nums text-[10px] text-[var(--text-faint)]">
                  {total > 0 ? `${((b.hex / total) * 100).toFixed(1)}%` : '—'}
                  {$ != null && ` · ${fmtUsdShort($)}`}
                </div>
              </div>
              <div className="hidden w-24 shrink-0 text-right text-[10px] text-[var(--text-faint)] sm:block">
                {b.stakes.toLocaleString()} {b.stakes === 1 ? 'stake' : 'stakes'}
                <div>{fmtDuration(b.day - currentDay)} out</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
