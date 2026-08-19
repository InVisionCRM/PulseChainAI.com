'use client';

// The macro view — every locked HEX stake on the chain, plotted by the day it
// comes due. This is the "when does everyone get out" picture: a bar per period
// for what matures, and a cumulative line for how much of the whole schedule
// has been released by that point.
//
// The schedule is violently uneven — a single day in the 2040s currently
// carries a quarter of all locked HEX, because 5555-day stakes all land
// together. That one spike would flatten every other bar to nothing on a linear
// axis, so the chart offers a log scale and the cumulative line (which reads
// the same either way) carries the shape.

import { useEffect, useMemo, useState } from 'react';
import {
  Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { IconRefresh, IconChartHistogram, IconAlertTriangle, IconFlame } from '@tabler/icons-react';
import { type Network, type Rates, type RatesSourceReporter, loadRates } from '@/lib/hex/strategistData';
import {
  toSeries, biggestDay, dayForFraction, type Grain, type UnlockBucket,
} from '@/lib/hex/unlockSchedule';
import { fmtHex, fmtUsdShort, fmtHexDate, fmtDuration, hexDayToDate } from '@/lib/hex/hexDay';
import { HexLogo } from '@/components/hex/HexAmount';

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

export default function StakeHorizon({ net, onSource }: { net: Network; onSource?: RatesSourceReporter }) {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [indexing, setIndexing] = useState<IndexingState | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'indexing' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [rates, setRates] = useState<Rates | null>(null);
  const [reload, setReload] = useState(0);
  const [horizon, setHorizon] = useState('3y');
  const [metric, setMetric] = useState<Metric>('hex');
  const [log, setLog] = useState(false);

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
    return toSeries(buckets, data.currentDay, days, view.grain);
  }, [data, buckets, view]);

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

  return (
    <div className="space-y-4">
      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="HEX locked in stakes"
          value={fmtHex(data.network_totals.hex)}
          sub={usd(data.network_totals.hex) != null ? fmtUsdShort(usd(data.network_totals.hex)!) : undefined}
          hex
        />
        <Stat label="T-Shares locked" value={tsh(data.network_totals.tShares)} />
        <Stat
          label="Half of it is free by"
          value={halfDay != null ? fmtHexDate(halfDay) : '—'}
          sub={halfDay != null ? `${fmtDuration(halfDay - data.currentDay)} out` : undefined}
          accent="#38bdf8"
        />
        <Stat
          label="Biggest single day"
          value={peak ? fmtHex(peak.hex) : '—'}
          sub={peak ? `${fmtHexDate(peak.day)} · ${peakPct.toFixed(0)}% of the schedule` : undefined}
          accent="#f43f5e"
          hex
        />
      </div>

      {/* Overdue — already due, nobody has claimed it. Two different states:
          good-accounted stakes are frozen, the rest are still bleeding. */}
      {data.overdue.stakes > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <IconAlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <b className="tabular-nums">{fmtHex(data.overdue.hex)}</b> HEX across{' '}
            <b className="tabular-nums">{data.overdue.stakes.toLocaleString()}</b>{' '}
            {data.overdue.stakes === 1 ? 'stake is' : 'stakes are'} already past their end day and still
            unclaimed.{' '}
            {data.frozen && data.frozen.stakes > 0 ? (
              <>
                <b className="tabular-nums">{fmtHex(data.frozen.hex)}</b> of it is frozen by
                good-accounting — shares already returned, penalty locked in — and the rest is still
                bleeding the late-end penalty until someone ends it.
              </>
            ) : (
              <>It is bleeding the late-end penalty until someone ends it.</>
            )}
          </span>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--text)]">
          <IconChartHistogram className="h-4 w-4 text-orange-400" />
          Unlock schedule
          <span className="font-normal text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
            per {GRAIN_LABEL[view.grain]}
          </span>
          <span
            className="rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ borderColor: 'rgba(52,211,153,0.4)', background: 'rgba(52,211,153,0.12)', color: '#6ee7b7' }}
            title="Every locked stake on the chain, from the synced index."
          >
            all {data.totals.stakes.toLocaleString()} stakes
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Segmented
            options={[{ key: 'hex', label: 'HEX' }, { key: 'tShares', label: 'T-Shares' }]}
            value={metric}
            onChange={(v) => setMetric(v as Metric)}
          />
          <Segmented options={HORIZONS.map((h) => ({ key: h.key, label: h.label }))} value={horizon} onChange={setHorizon} />
          <button
            type="button"
            onClick={() => setLog((l) => !l)}
            title="Log scale flattens the one enormous day so the rest of the schedule is readable"
            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
              log
                ? 'border-orange-500/50 bg-orange-500/15 text-orange-200'
                : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            Log
          </button>
        </div>
      </div>

      {/* The chart */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="unlockBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff9e00" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#ff2e7e" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickFormatter={shortDate}
                minTickGap={44}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickFormatter={(v: number) => (metric === 'hex' ? fmtHex(v) : tsh(v))}
                // A log axis cannot start at 0, and every empty period is 0 —
                // so the domain floors at 1 and zero bars simply don't draw.
                scale={log ? 'log' : 'auto'}
                domain={log ? [1, 'auto'] : [0, 'auto']}
                allowDataOverflow={log}
                width={62}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: 'var(--text-faint)' }}
                tickFormatter={(v: number) => `${v}%`}
                width={34}
              />
              <Tooltip
                contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12 }}
                labelFormatter={(d) => fmtHexDate(Number(d))}
                formatter={(v: number, name) => {
                  if (name === 'released') return [`${v.toFixed(1)}%`, 'Released by then'];
                  const $ = metric === 'hex' ? usd(v) : null;
                  return [`${fmtValue(v)}${$ != null ? ` (${fmtUsdShort($)})` : ''}`, 'Comes due'];
                }}
              />
              <ReferenceLine yAxisId="left" x={data.currentDay} stroke="var(--text-faint)" strokeDasharray="2 2" />
              <Bar yAxisId="left" dataKey={metric} fill="url(#unlockBar)" isAnimationActive={false} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey={(p: { cumHex: number; cumTShares: number }) => {
                  const total = metric === 'hex' ? data.totals.hex : data.totals.tShares;
                  const cum = metric === 'hex' ? p.cumHex : p.cumTShares;
                  return total > 0 ? (cum / total) * 100 : 0;
                }}
                name="released"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[10px] text-[var(--text-faint)]">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: 'linear-gradient(180deg,#ff9e00,#ff2e7e)' }} />
            {metric === 'hex' ? 'HEX' : 'T-Shares'} coming due per {GRAIN_LABEL[view.grain]}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 rounded-sm bg-[#38bdf8]" />
            Share of the schedule released by then
          </span>
        </div>
      </div>

      {/* The one fact the chart is really about */}
      {peak && peakPct >= 5 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
          <IconFlame className="h-4 w-4 shrink-0 text-rose-300" />
          <span>
            The schedule is not smooth. <b>{fmtHexDate(peak.day)}</b> alone releases{' '}
            <b className="tabular-nums">{fmtHex(peak.hex)}</b> HEX across{' '}
            <b className="tabular-nums">{peak.stakes.toLocaleString()}</b> stakes —{' '}
            <b>{peakPct.toFixed(0)}%</b> of everything mapped here, on one day, {fmtDuration(peak.day - data.currentDay)} from now.
          </span>
        </div>
      )}

      <BiggestDays buckets={buckets} total={data.totals.hex} currentDay={data.currentDay} usd={usd} />

      <p className="px-1 text-[10px] leading-relaxed text-[var(--text-faint)]">{data.note}</p>
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
        <IconRefresh className="h-4 w-4 animate-spin text-orange-400" /> Building the stake index
      </div>
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{
            width: `${Math.max(2, state.progressPct)}%`,
            background: 'linear-gradient(90deg,#ff9e00,#ff2e7e)',
          }}
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

function Stat({ label, value, sub, accent, hex }: {
  label: string; value: string; sub?: string; accent?: string; hex?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div
        className="flex items-center gap-1 truncate text-base font-bold tabular-nums"
        style={{ color: accent ?? 'var(--text)' }}
      >
        {hex && <HexLogo className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate">{value}</span>
      </div>
      {sub && <div className="truncate text-[10px] text-[var(--text-muted)]">{sub}</div>}
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
            value === o.key ? 'bg-[var(--surface-2)] text-orange-300' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
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

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="mb-1 text-sm font-semibold text-[var(--text)]">The cliffs</div>
      <p className="mb-3 text-xs text-[var(--text-muted)]">
        The eight single days with the most HEX coming due. Every one of these is a date where a lot of
        supply becomes sellable at once.
      </p>
      <div className="space-y-1.5">
        {top.map((b) => {
          const $ = usd(b.hex);
          return (
            <div key={b.day} className="flex items-center gap-3">
              <div className="w-24 shrink-0 text-xs font-semibold text-[var(--text)]">{fmtHexDate(b.day)}</div>
              <div className="h-5 min-w-0 flex-1 overflow-hidden rounded bg-[var(--surface-2)]">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${Math.max(2, (b.hex / max) * 100)}%`,
                    background: 'linear-gradient(90deg,#ff9e00,#ff2e7e)',
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
