'use client';

// Every finished cycle, scored on the same $100 question as the projection
// above it. Each row expands into what the machine did that cycle and what
// each side of the bet actually bought — the figures that explain the result
// rather than just stating it.

import { useState } from 'react';
import { IconChevronDown } from '@tabler/icons-react';
import { dayToISO, type CycleResult, type SuperStakeCycle } from '@/lib/superstake/model';
import { pulsechainAddressUrl } from '@/lib/pulsechainExplorer';

/** The contract that holds the stake — the same address the cycles route reads. */
const STAKER = '0xdc48205df8af83c97de572241bb92db45402aa0e';
const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';
const GRAD = 'linear-gradient(135deg,#7E089D,#AE176A 30%,#D83639 58%,#E96635 80%,#FB9438)';

export interface CycleRow {
  cycle: SuperStakeCycle;
  result: CycleResult;
}

/** What a cycle brought in against the 1% it paid out. */
export interface Cover {
  ratio: number;
  gained: number;
  bought: number;
}

const gradText = {
  backgroundImage: GRAD,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
} as const;

const pctOf = (v: number, max: number) => (max > 0 ? (v / max) * 100 : 0);
const n0 = (v: number) => Math.round(v).toLocaleString();
const usd = (v: number, dp = 5) => (v > 0 ? `$${v.toFixed(dp)}` : '—');
const usdShort = (v: number) =>
  !Number.isFinite(v)
    ? '—'
    : v >= 1e6
      ? `$${(v / 1e6).toFixed(2)}M`
      : v >= 1e3
        ? `$${(v / 1e3).toFixed(1)}k`
        : `$${v.toFixed(2)}`;

export default function CycleTable({
  rows, coverage, amount, psshWins, series, running, daysLeft,
}: {
  rows: CycleRow[];
  /** Cycle number -> what that cycle brought in against the 1% it paid out. */
  coverage: Map<number, Cover>;
  amount: number;
  psshWins: number;
  /** Daily series, for the per-cycle volume chart. */
  series?: { d0: number; VV: number[] } | null;
  /** The cycle currently open, if any — listed but not scored. */
  running?: SuperStakeCycle | null;
  daysLeft?: number;
}) {
  const [open, setOpen] = useState<number | null>(null);
  // HEX's payout per T-share per day, cycle by cycle — the rate that decides
  // what any stake earns, and the clearest picture of HEX's yield over time.
  const ppt = rows.map(({ cycle }) => {
    const days = cycle.d1 - cycle.d0;
    return days > 0 && cycle.tsh > 0 ? cycle.nY / (cycle.tsh * days) : 0;
  });

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <h3 className="text-sm font-bold tracking-tight text-[var(--text)]">
          Every finished cycle, same ${amount}, same question
        </h3>
        <span className="text-xs text-[var(--text-faint)]">
          pSSH ahead in{' '}
          <b className="bg-clip-text text-transparent" style={{ backgroundImage: GRAD }}>
            {psshWins}
          </b>{' '}
          of {rows.length} · tap a row for the detail
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[730px] text-sm">
          <thead>
            <tr
              className="text-[9.5px] uppercase tracking-[0.12em] text-[var(--text-faint)]"
              style={{ fontFamily: MONO }}
            >
              <th className="px-4 py-2 text-left font-medium">Cycle</th>
              <th className="px-3 py-2 text-left font-medium">Opened</th>
              <th className="px-3 py-2 text-right font-medium">pHEX</th>
              <th className="px-3 py-2 text-right font-medium">Volume</th>
              <th className="px-3 py-2 text-right font-medium">Stake</th>
              {/* The stake-funded slice of the pSSH column beside it — the 1%
                  payout on its own, with reflections left out. Named "payout"
                  rather than "stake" so it can't be read as the native-stake
                  column two along. */}
              <th className="px-3 py-2 text-right font-medium">Payout</th>
              <th className="px-3 py-2 text-right font-medium">pSSH</th>
              <th className="px-3 py-2 text-right font-medium">Winner</th>
              <th className="w-8 px-2 py-2" aria-label="expand" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ cycle, result }, idx) => {
              const won = result.winner === 'pssh';
              const isOpen = open === cycle.i;
              const toggle = () => setOpen(isOpen ? null : cycle.i);
              return (
                <CycleRowPair
                  key={cycle.i}
                  cycle={cycle}
                  result={result}
                  won={won}
                  isOpen={isOpen}
                  toggle={toggle}
                  cover={coverage.get(cycle.i) ?? null}
                  amount={amount}
                  series={series}
                  prev={idx > 0 ? rows[idx - 1].cycle : null}
                  ppt={ppt}
                  pptIndex={idx}
                />
              );
            })}

            {/* The open cycle, listed so it never looks like a row is missing.
                It can't be scored — it hasn't paid out yet. */}
            {running && !running.done && (
              <tr className="border-t border-[var(--line)] bg-[var(--app-bg)]/40">
                <td className="px-4 py-2 tabular-nums text-[var(--text-muted)]">#{running.i}</td>
                <td className="px-3 py-2 tabular-nums text-[var(--text-muted)]">
                  {dayToISO(running.d0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-[var(--text-faint)]">
                  {usd(running.pH0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-[var(--text-faint)]">
                  {usdShort(running.vol)}
                </td>
                <td className="px-3 py-2 text-right text-[var(--text-faint)]">—</td>
                <td className="px-3 py-2 text-right text-[var(--text-faint)]">—</td>
                <td className="px-3 py-2 text-right text-[var(--text-faint)]">—</td>
                <td
                  className="px-3 py-2 text-right text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]"
                  style={{ fontFamily: MONO }}
                  colSpan={2}
                >
                  running{typeof daysLeft === 'number' ? ` · ${daysLeft}d left` : ''}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CycleRowPair({
  cycle, result, won, isOpen, toggle, cover, amount, series, prev, ppt, pptIndex,
}: {
  cycle: SuperStakeCycle;
  result: CycleResult;
  won: boolean;
  isOpen: boolean;
  toggle: () => void;
  cover: Cover | null;
  amount: number;
  series?: { d0: number; VV: number[] } | null;
  prev: SuperStakeCycle | null;
  ppt: number[];
  pptIndex: number;
}) {
  return (
    <>
      <tr
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        className={`cursor-pointer border-t border-[var(--line)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-500/60 ${
          isOpen ? 'bg-[var(--surface)]' : 'hover:bg-[var(--surface)]'
        }`}
      >
        <td className="px-4 py-2 tabular-nums text-[var(--text-muted)]">#{cycle.i}</td>
        <td className="px-3 py-2 tabular-nums text-[var(--text-muted)]">{dayToISO(cycle.d0)}</td>
        <td className="px-3 py-2 text-right tabular-nums text-[var(--text-faint)]">
          {usd(cycle.pH0)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-[var(--text-faint)]">
          {usdShort(cycle.vol)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
          {n0(result.stakeYield)}
        </td>
        {/* One decimal: these run from ~3 to ~45 HEX, so rounding whole would
            flatten the early cycles into each other. */}
        <td className="px-3 py-2 text-right tabular-nums text-[var(--text-muted)]">
          {result.payouts >= 100 ? n0(result.payouts) : result.payouts.toFixed(1)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">
          {n0(result.psshYield)}
        </td>
        <td className="px-3 py-2 text-right">
          <span
            className={`text-xs font-bold ${won ? '' : 'text-[var(--text-muted)]'}`}
            style={
              won
                ? { backgroundImage: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
                : undefined
            }
          >
            {won ? 'pSSH' : 'stake'} {result.ratio.toFixed(2)}×
          </span>
        </td>
        <td className="px-2 py-2 text-right">
          <IconChevronDown
            className={`inline h-3.5 w-3.5 text-[var(--text-faint)] transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </td>
      </tr>

      {isOpen && (
        <tr className="border-t border-[var(--line)] bg-[var(--app-bg)]">
          {/* The table is 660px wide and scrolls on narrow screens. Left alone,
              the detail's right-aligned figures — the whole point of it — sit
              off-screen on a phone. Pinning it to the viewport keeps it visible
              no matter how far the table is scrolled. */}
          <td colSpan={9} className="p-0">
            <div className="sticky left-0 w-[calc(100vw-2.5rem)] px-4 py-4 md:w-auto">
            {/* the facts that don't chart, kept to one quiet line */}
            <div
              className="flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] uppercase tracking-[0.1em] text-[var(--text-faint)]"
              style={{ fontFamily: MONO }}
            >
              <span>
                RAN {dayToISO(cycle.d0)} → {dayToISO(cycle.d1)} · {cycle.d1 - cycle.d0}D
              </span>
              <span>pHEX {usd(cycle.pH0, 6)}</span>
              <span>pSSH {usd(cycle.pS0, 6)}</span>
              <span>{cycle.tsh.toFixed(2)} T-SHARES</span>
              <span>{n0(cycle.hex)} HEX STAKED</span>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Panel title={`$${amount} in, side by side`}>
                <VBars
                  a={{ label: 'Stake', value: result.stakeYield, win: !won }}
                  b={{ label: 'pSSH', value: result.psshYield, win: won, accent: true }}
                />
                <Note>
                  <b style={won ? gradText : { color: 'var(--text)' }}>
                    {won ? 'pSSH' : 'The stake'}
                  </b>{' '}
                  ahead {result.ratio.toFixed(2)}×
                </Note>
              </Panel>

              <Panel title="Did it pay for itself">
                {cover ? (
                  <>
                    <Gauge ratio={cover.ratio} />
                    <Note>
                      {n0(cover.gained)} in vs {n0(cycle.pay)} out
                      {cover.bought > 0 && <> · buy-tax added {n0(cover.bought)}</>}
                    </Note>
                  </>
                ) : (
                  <Note>Not settled — no following cycle yet.</Note>
                )}
              </Panel>

              <Panel title="What paid the pSSH side">
                <Donut
                  a={{ label: 'End-stake', value: result.payouts, color: '#AE176A' }}
                  b={{ label: 'Reflections', value: result.reflections, color: '#FB9438' }}
                  total={result.psshYield}
                />
              </Panel>

              <Panel title="Trading through the cycle">
                <Velocity series={series} from={cycle.d0} to={cycle.d1} />
                <Note>{usdShort(cycle.vol)} traded over {cycle.d1 - cycle.d0} days</Note>
              </Panel>

              <Panel title="HEX payout per T-share, every cycle">
                <PptTrend values={ppt} current={pptIndex} />
              </Panel>

              <div className="sm:col-span-2 xl:col-span-3">
                <Panel title={prev ? `Conditions vs cycle ${prev.i}` : 'Conditions this cycle'}>
                  <Deltas cycle={cycle} prev={prev} ppt={ppt[pptIndex]} prevPpt={pptIndex > 0 ? ppt[pptIndex - 1] : null} />
                </Panel>
              </div>
            </div>

            <a
              href={pulsechainAddressUrl(STAKER)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-3 inline-block text-[10.5px] text-[var(--text-faint)] underline-offset-2 transition-colors hover:text-[var(--text-muted)] hover:underline"
              style={{ fontFamily: MONO }}
            >
                HEX STAKE #{cycle.id} · VIEW THE STAKING CONTRACT
              </a>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
      <div
        className="text-[9.5px] uppercase tracking-[0.13em] text-[var(--text-faint)]"
        style={{ fontFamily: MONO }}
      >
        {title}
      </div>
      <div className="mt-2 flex flex-1 flex-col justify-center">{children}</div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-center text-[10.5px] leading-snug text-[var(--text-faint)]">{children}</p>;
}

/** Two columns, height relative to the taller — the shape reads before the number. */
function VBars({
  a, b,
}: {
  a: { label: string; value: number; win: boolean; accent?: boolean };
  b: { label: string; value: number; win: boolean; accent?: boolean };
}) {
  const max = Math.max(a.value, b.value, 1);
  return (
    <div className="flex h-[110px] items-end justify-center gap-5">
      {[a, b].map((x) => (
        <div key={x.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span
            className={`text-[13px] font-bold tabular-nums ${x.win ? '' : 'text-[var(--text-muted)]'}`}
            style={x.win && x.accent ? gradText : x.win ? { color: 'var(--text)' } : undefined}
          >
            {n0(x.value)}
          </span>
          <div
            className="w-full max-w-[46px] rounded-t-md transition-[height] duration-500"
            style={{
              height: `${Math.max(4, (x.value / max) * 100)}%`,
              background: x.accent ? GRAD : 'var(--line-strong)',
            }}
          />
          <span className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]" style={{ fontFamily: MONO }}>
            {x.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Coverage as a speedometer. Break-even (1x) sits a quarter along so "covered"
 * is visibly past a marked line rather than buried at the far left; beyond that
 * the scale is logarithmic, because coverage across cycles spans 1.7x to 227x
 * and a linear dial would pin almost every needle to the stop.
 */
function Gauge({ ratio }: { ratio: number }) {
  const R = 58;
  const CX = 80;
  const CY = 72;
  const LEN = Math.PI * R;
  const frac =
    ratio <= 0
      ? 0
      : ratio < 1
        ? 0.25 * ratio
        : 0.25 + 0.75 * Math.min(1, Math.log10(ratio) / Math.log10(30));
  const ok = ratio >= 1;
  // Needle stops short of the arc and well above the readout, which sits below
  // the pivot — an overlapping needle made the number unreadable.
  const ang = Math.PI * (1 - frac);
  const nx = CX + Math.cos(ang) * (R - 16);
  const ny = CY - Math.sin(ang) * (R - 16);
  const tAng = Math.PI * (1 - 0.25);
  return (
    <svg viewBox="0 0 160 108" className="block h-auto w-full" role="img"
         aria-label={`This cycle brought in ${ratio.toFixed(2)} times what it paid out.`}>
      <defs>
        <linearGradient id="ss-gauge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7E089D" />
          <stop offset="0.55" stopColor="#D83639" />
          <stop offset="1" stopColor="#FB9438" />
        </linearGradient>
      </defs>
      <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none"
            stroke="var(--line)" strokeWidth="10" strokeLinecap="round" />
      <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none"
            stroke="url(#ss-gauge)" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={LEN} strokeDashoffset={LEN * (1 - frac)}
            style={{ transition: 'stroke-dashoffset .6s ease' }} />
      {/* break-even tick */}
      <line
        x1={CX + Math.cos(tAng) * (R - 7)} y1={CY - Math.sin(tAng) * (R - 7)}
        x2={CX + Math.cos(tAng) * (R + 7)} y2={CY - Math.sin(tAng) * (R + 7)}
        stroke="var(--text-faint)" strokeWidth="1.5" strokeDasharray="2 2"
      />
      <line x1={CX} y1={CY} x2={nx} y2={ny} stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={CX} cy={CY} r="3.5" fill="var(--text)" />
      <text x={CX} y={94} textAnchor="middle" fontSize="19" fontWeight="700"
            fill={ok ? 'var(--up)' : 'var(--text)'} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {ratio.toFixed(2)}×
      </text>
      <text x={CX} y={105} textAnchor="middle" fontSize="7.5" letterSpacing="1.1"
            fill="var(--text-faint)" style={{ fontFamily: MONO }}>
        1× = BREAK-EVEN
      </text>
    </svg>
  );
}

/** Where the pSSH side's HEX came from, as a ring with the total in the middle. */
function Donut({
  a, b, total,
}: {
  a: { label: string; value: number; color: string };
  b: { label: string; value: number; color: string };
  total: number;
}) {
  const R = 40;
  const C = 2 * Math.PI * R;
  const sum = a.value + b.value;
  const pa = sum > 0 ? a.value / sum : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0">
        <svg viewBox="0 0 100 100" className="block h-[92px] w-[92px] -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r={R} fill="none" stroke={b.color} strokeWidth="14" />
          <circle
            cx="50" cy="50" r={R} fill="none" stroke={a.color} strokeWidth="14"
            strokeDasharray={C} strokeDashoffset={C * (1 - pa)}
            style={{ transition: 'stroke-dashoffset .6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[14px] font-bold leading-none tabular-nums text-[var(--text)]">
            {n0(total)}
          </span>
          <span className="text-[8.5px] uppercase tracking-[0.12em] text-[var(--text-faint)]" style={{ fontFamily: MONO }}>
            HEX
          </span>
        </div>
      </div>
      <dl className="min-w-0 flex-1 grid gap-1.5">
        {[{ ...a, pct: pa * 100 }, { ...b, pct: (1 - pa) * 100 }].map((x) => (
          <div key={x.label}>
            <dt className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: x.color }} />
              <span className="truncate">{x.label}</span>
            </dt>
            <dd className="ml-3.5 text-[12px] tabular-nums text-[var(--text)]">
              <b>{n0(x.value)}</b>
              <span className="ml-1 text-[var(--text-faint)]">{x.pct.toFixed(0)}%</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Daily pSSH volume across the cycle — where the trading actually happened. */
function Velocity({
  series, from, to,
}: { series?: { d0: number; VV: number[] } | null; from: number; to: number }) {
  if (!series?.VV?.length) {
    return <div className="h-[92px] rounded bg-[var(--line)]/40" aria-hidden="true" />;
  }
  const days: number[] = [];
  for (let d = from; d < to; d++) days.push(series.VV[d - series.d0] ?? 0);
  const max = Math.max(...days, 1);
  const W = 160;
  const H = 74;
  const step = days.length > 1 ? W / (days.length - 1) : W;
  const pts = days.map((v, i) => [i * step, H - (v / max) * (H - 6)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const peak = days.indexOf(max);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-[74px] w-full" role="img"
           aria-label={`Daily pSSH volume across the cycle, peaking at ${usdShort(max)}.`}>
        <defs>
          <linearGradient id="ss-vel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#7E089D" /><stop offset="1" stopColor="#FB9438" />
          </linearGradient>
          <linearGradient id="ss-velf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#D83639" stopOpacity="0.35" />
            <stop offset="1" stopColor="#D83639" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L${W} ${H} L0 ${H} Z`} fill="url(#ss-velf)" />
        <path d={line} fill="none" stroke="url(#ss-vel)" strokeWidth="1.8" strokeLinejoin="round" />
        {peak >= 0 && (
          <circle cx={(peak * step).toFixed(1)} cy={(H - (max / max) * (H - 6)).toFixed(1)} r="2.5" fill="#FB9438" />
        )}
      </svg>
      <div
        className="flex justify-between text-[9px] uppercase tracking-[0.1em] text-[var(--text-faint)]"
        style={{ fontFamily: MONO }}
      >
        <span>day 1</span>
        <span>peak {usdShort(max)}</span>
        <span>day {days.length}</span>
      </div>
    </div>
  );
}

/**
 * HEX's payout per T-share per day across every cycle, with this one lit up.
 * It is the rate that decides what any HEX stake earns, and it has fallen hard
 * — seeing the whole run is the point, so the current cycle is highlighted
 * rather than shown alone.
 */
function PptTrend({ values, current }: { values: number[]; current: number }) {
  const max = Math.max(...values, 1e-9);
  return (
    <div>
      <div className="flex h-[74px] items-end gap-[2px]">
        {values.map((v, i) => (
          <span
            key={i}
            title={`Cycle ${i + 1} — ${v.toFixed(4)} HEX per T-share per day`}
            className="flex-1 rounded-t-sm"
            style={{
              height: `${Math.max(3, (v / max) * 100)}%`,
              background: i === current ? GRAD : 'var(--line-strong)',
            }}
          />
        ))}
      </div>
      <div
        className="mt-1.5 flex justify-between text-[9px] uppercase tracking-[0.1em] text-[var(--text-faint)]"
        style={{ fontFamily: MONO }}
      >
        <span>cycle 1</span>
        <span className="text-[var(--text)]">this one {values[current]?.toFixed(4)}</span>
        <span>cycle {values.length}</span>
      </div>
    </div>
  );
}

/**
 * Conditions this cycle against the one before it.
 *
 * `good` is only set where a direction genuinely means better. More payout per
 * T-share, more yield, more volume, a bigger stake — those are unambiguous. A
 * higher share rate is worse for anyone opening a new stake and irrelevant to
 * an existing one, and a higher price helps a holder while hurting a buyer, so
 * those are shown as plain movement with no verdict attached.
 */
function Deltas({
  cycle, prev, ppt, prevPpt,
}: {
  cycle: SuperStakeCycle;
  prev: SuperStakeCycle | null;
  ppt: number;
  prevPpt: number | null;
}) {
  const days = cycle.d1 - cycle.d0;
  const prevDays = prev ? prev.d1 - prev.d0 : 0;
  const rows: { k: string; v: string; now: number; was: number | null; goodUp?: boolean }[] = [
    { k: 'Payout per T-share / day', v: ppt.toFixed(4), now: ppt, was: prevPpt, goodUp: true },
    {
      k: 'HEX yield earned',
      v: `${n0(cycle.nY)} HEX`,
      now: cycle.nY,
      was: prev?.nY ?? null,
      goodUp: true,
    },
    {
      k: 'HEX in the stake',
      v: n0(cycle.hex),
      now: cycle.hex,
      was: prev?.hex ?? null,
      goodUp: true,
    },
    {
      k: 'pSSH volume',
      v: usdShort(cycle.vol),
      now: cycle.vol,
      was: prev?.vol ?? null,
      goodUp: true,
    },
    { k: 'T-shares held', v: cycle.tsh.toFixed(2), now: cycle.tsh, was: prev?.tsh ?? null },
    { k: 'pHEX at open', v: usd(cycle.pH0, 6), now: cycle.pH0, was: prev?.pH0 ?? null },
    { k: 'pSSH at open', v: usd(cycle.pS0, 6), now: cycle.pS0, was: prev?.pS0 ?? null },
    {
      k: 'Cycle length',
      v: `${days} days`,
      now: days,
      was: prevDays || null,
    },
  ];

  return (
    <>
      <dl className="grid gap-x-5 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((r) => (
          <div
            key={r.k}
            className="flex items-baseline justify-between gap-2 border-b border-[var(--line)] pb-1.5"
          >
            <dt className="text-[11px] leading-tight text-[var(--text-muted)]">{r.k}</dt>
            <dd className="flex shrink-0 items-baseline gap-1.5">
              <span className="text-[12.5px] font-bold tabular-nums text-[var(--text)]">{r.v}</span>
              <Delta now={r.now} was={r.was} goodUp={r.goodUp} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-faint)]">
        Green and red only where a direction actually means better or worse. A higher share rate
        buys fewer T-shares and a higher price cuts both ways, so those move without a verdict.
      </p>
    </>
  );
}

function Delta({ now, was, goodUp }: { now: number; was: number | null; goodUp?: boolean }) {
  if (was == null || !(was > 0) || !Number.isFinite(now)) {
    return <span className="text-[10px] text-[var(--text-faint)]">—</span>;
  }
  const pct = ((now - was) / was) * 100;
  if (Math.abs(pct) < 0.05) {
    return <span className="text-[10px] text-[var(--text-faint)]">flat</span>;
  }
  const up = pct > 0;
  const colour =
    goodUp === undefined
      ? 'var(--text-faint)'
      : up === goodUp
        ? 'var(--up)'
        : '#f87171';
  return (
    <span className="text-[10px] font-semibold tabular-nums" style={{ color: colour }}>
      {up ? '▲' : '▼'}
      {Math.abs(pct) >= 100 ? Math.abs(pct).toFixed(0) : Math.abs(pct).toFixed(1)}%
    </span>
  );
}
