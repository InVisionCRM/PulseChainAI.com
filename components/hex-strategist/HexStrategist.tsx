'use client';

// HEX Stake Strategist — the "Designer" tab.
//
// An opinionated tool (not another read-out): you enter an amount of HEX and it
// computes the projected T-Shares, yield, ROI and APY across every stake length
// using the real HEX LPB/BPB bonus math, then recommends a length. Data comes
// from the existing /api/hex-proxy (hexdailystats.com) — live rates + a trailing
// payout average — so nothing new is plumbed.
//
// Styled to the same standard as the Macro and Micro tabs and the Rescue Wall:
// a molten hero that holds the two controls and their headline results, the
// shared Speedo dials, the ROI curve, then the verdict. Jost for figures,
// Poppins for labels.
//
// One rule this tab has that the others don't: every headline number here moves
// while the visitor drags the slider, so none of them count up. CountUp restarts
// from zero whenever its value changes — lovely on arrival, unreadable on a
// control the visitor is holding. Those figures pass `text` instead, and the
// dials run in `live` mode so the needle tracks in 0.35s rather than 1.3s.

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { IconRefresh, IconBolt, IconTrendingUp, IconTrendingDown, IconCheck } from '@tabler/icons-react';
import {
  BPB_MAX_HEX,
  HEX_MAX_STAKE_DAYS,
  LPB_FULL_BONUS_DAYS,
  bonusMultiplier,
  defaultLengths,
  projectStake,
  projectionCurve,
} from '@/lib/hex/stakeMath';
import { fmtHex, fmtTShares, fmtDuration, fmtHexDate, currentHexDay } from '@/lib/hex/hexDay';
import { fmtUsd } from '@/lib/format';
import { HeroNumber, Speedo } from '@/components/hex/Instruments';
import { HexLogo } from '@/components/hex/HexAmount';
import { type Network, type Rates, type RatesSourceReporter, num, loadRates } from '@/lib/hex/strategistData';

/** The most bonus any stake can earn: +200% LPB and +10% BPB. */
const MAX_BONUS = 2.1;
/** LPB is capped at 3,640 bonus-days, which a 3,641-day stake reaches. */
const LPB_MAX_BONUS_DAYS = LPB_FULL_BONUS_DAYS - 1;

const pct1 = (n: number) => `${n.toFixed(1)}%`;

/** What the math reads: digits and at most one decimal point. */
function cleanAmount(v: string): string {
  const [head, ...tail] = v.replace(/[^\d.]/g, '').split('.');
  return tail.length ? `${head}.${tail.join('')}` : head;
}

/** What the visitor reads: the same number, grouped. Grouped by regex rather
 *  than Number().toLocaleString() so a pasted 20-digit amount keeps its digits
 *  instead of being rounded through a float. */
function grouped(v: string): string {
  if (!v) return '';
  const [head, tail] = v.split('.');
  const g = head.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return tail !== undefined ? `${g}.${tail}` : g;
}

export default function HexStrategist({
  net,
  onSource,
}: {
  net: Network;
  /**
   * Reports each of the two HEX feeds as it settles, so the entry loader over
   * this page can show real progress rather than a timer. Optional — the
   * Designer works identically without it.
   */
  onSource?: RatesSourceReporter;
}) {
  const [rates, setRates] = useState<Rates | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [amount, setAmount] = useState('1000000');
  const [days, setDays] = useState(LPB_FULL_BONUS_DAYS);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    setErrMsg(null);
    loadRates(net, onSource)
      .then((r) => {
        if (!alive) return;
        if (!r.tShareRateHex) {
          setErrMsg('No T-Share rate in the live feed');
          setStatus('error');
          return;
        }
        setRates(r);
        setStatus('ready');
      })
      .catch((e) => {
        if (!alive) return;
        setErrMsg(e instanceof Error ? e.message : null);
        setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, [net, reload, onSource]);

  const principal = Math.max(0, num(amount));

  const curve = useMemo(() => {
    if (!rates) return [];
    return projectionCurve(principal, rates.tShareRateHex, rates.dailyPayoutPerTShare, defaultLengths());
  }, [rates, principal]);

  const target = useMemo(() => {
    if (!rates) return null;
    return projectStake(principal, days, rates.tShareRateHex, rates.dailyPayoutPerTShare);
  }, [rates, principal, days]);

  /** The length this tab recommends, projected — for the verdict's comparison. */
  const best = useMemo(() => {
    if (!rates) return null;
    return projectStake(principal, LPB_FULL_BONUS_DAYS, rates.tShareRateHex, rates.dailyPayoutPerTShare);
  }, [rates, principal]);

  /** Highest APY on the curve, so the APY dial has an honest full-scale. */
  const peakApy = useMemo(
    () => curve.reduce((m, p) => (p.apyPct > m ? p.apyPct : m), 0),
    [curve],
  );

  if (status === 'loading') {
    return (
      <div className="grid place-items-center py-20">
        <span className="font-poppins inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <IconRefresh className="h-4 w-4 animate-spin" /> Loading HEX rates…
        </span>
      </div>
    );
  }
  if (status === 'error' || !rates || !target || !best) {
    return (
      <div className="py-20 text-center">
        <div className="font-jost text-[22px] font-bold text-[var(--text)]">Couldn’t load HEX rates</div>
        <button
          onClick={() => setReload((n) => n + 1)}
          className="font-poppins mt-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--text)] hover:border-[var(--viz-a)]"
        >
          Try again
        </button>
        {errMsg && <div className="font-poppins mt-3 text-xs text-[var(--text-faint)]">{errMsg}</div>}
      </div>
    );
  }

  const usd = (hex: number) => hex * rates.priceUsd;

  // "Circulating" supply excludes staked HEX, so % staked is of the total
  // (staked + circulating) — not staked/circulating (which can exceed 100%).
  const totalHex = rates.stakedHex + rates.circulatingHex;
  const pctStaked = totalHex > 0 ? (rates.stakedHex / totalHex) * 100 : null;
  const endDate = fmtHexDate(currentHexDay() + days);

  // The two bonuses, split out — the dial shows the total, the caption the parts.
  const lpbFrac = Math.min(Math.max(days - 1, 0), LPB_MAX_BONUS_DAYS) / LPB_MAX_BONUS_DAYS;
  const bpbFrac = Math.min(principal, BPB_MAX_HEX) / BPB_MAX_HEX;
  const bonus = bonusMultiplier(principal, days);

  const onBest = days === LPB_FULL_BONUS_DAYS;
  const tShareGain = target.tShares > 0 ? (best.tShares / target.tShares - 1) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* ── Hero: the two controls, and what they produce ── */}
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
          <span className="font-poppins text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
            Design a stake · every figure below is this stake
          </span>

          {/* The controls. They live in the hero because they are the tab —
              everything else on the page is downstream of these two numbers. */}
          <div className="mt-4 grid gap-5 md:grid-cols-2 md:gap-8">
            <label className="block">
              <span className="font-poppins mb-1.5 block text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                Amount to stake
              </span>
              <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 focus-within:border-[var(--viz-a)]">
                <HexLogo className="h-6 w-6 shrink-0" />
                <input
                  value={grouped(amount)}
                  onChange={(e) => setAmount(cleanAmount(e.target.value))}
                  inputMode="decimal"
                  aria-label="Amount of HEX to stake"
                  className="font-jost w-full min-w-0 bg-transparent text-[30px] font-bold leading-none tracking-tight tabular-nums text-white outline-none"
                />
                <span className="font-poppins shrink-0 text-[11px] font-bold uppercase tracking-wider text-white/40">HEX</span>
              </div>
              <span className="font-poppins mt-1.5 block text-[12px] text-white/55">
                {fmtUsd(usd(principal))} today
                {principal >= BPB_MAX_HEX && ' · bigger-pays-better is maxed'}
              </span>
            </label>

            <label className="block">
              <span className="font-poppins mb-1.5 flex items-baseline justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
                <span>Stake length</span>
                <span className="font-jost text-[22px] font-bold normal-case tracking-tight text-white">
                  {days.toLocaleString()}<span className="text-[13px] text-white/50">d</span>
                </span>
              </span>
              <input
                type="range"
                min={1}
                max={HEX_MAX_STAKE_DAYS}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                aria-label="Stake length in days"
                className="mt-1 w-full accent-[var(--viz-a)]"
              />
              <span className="font-poppins mt-1.5 flex flex-wrap justify-between gap-x-3 text-[12px] text-white/55">
                <span>{fmtDuration(days)}</span>
                <span>ends ~{endDate}</span>
              </span>
            </label>
          </div>

          <div className="mt-6 grid gap-6 border-t border-white/10 pt-5 sm:grid-cols-3 md:gap-8">
            <HeroNumber
              label="T-Shares minted"
              text={fmtTShares(target.tShares)}
              sub={`${fmtHex(rates.tShareRateHex)} HEX buys one today`}
              gradient
            />
            <HeroNumber
              label="Projected yield"
              text={fmtHex(target.projectedYieldHex)}
              sub={`${fmtUsd(usd(target.projectedYieldHex))} at today’s price`}
            />
            <HeroNumber
              label="Principal + yield"
              text={fmtHex(principal + target.projectedYieldHex)}
              sub={`${pct1(target.roiPct)} over the term · ${pct1(target.apyPct)} a year`}
            />
          </div>
        </div>
      </div>

      {/* ── The dials. Live, so they track the slider instead of lagging it. ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Speedo
          live
          frac={lpbFrac}
          figure={`${Math.round(lpbFrac * 100)}%`}
          label="Longer pays better"
          sub={
            lpbFrac >= 1
              ? 'the full +200% length bonus'
              : `${(LPB_FULL_BONUS_DAYS - days).toLocaleString()} more days to max it`
          }
          tone="a"
        />
        <Speedo
          live
          frac={bonus / MAX_BONUS}
          figure={`+${Math.round(bonus * 100)}%`}
          label="Total share bonus"
          sub={`length +${Math.round(lpbFrac * 200)}% · size +${(bpbFrac * 10).toFixed(1)}%`}
          tone="b"
        />
        <Speedo
          live
          frac={peakApy > 0 ? target.apyPct / peakApy : 0}
          figure={pct1(target.apyPct)}
          label="APY at this length"
          sub={`best on the curve is ${pct1(peakApy)}`}
          tone="a"
        />
      </div>

      {/* ── The call ── */}
      <div
        className={`anim-rise rounded-2xl border p-4 md:p-5 ${
          onBest
            ? 'border-[var(--viz-gain)]/40 bg-[var(--viz-gain)]/[0.07]'
            : 'border-[var(--line)] bg-[var(--surface)]'
        }`}
      >
        <div className="font-poppins mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          {onBest ? (
            <IconCheck className="h-4 w-4 text-[var(--viz-gain)]" />
          ) : (
            <IconBolt className="h-4 w-4 text-[var(--viz-a)]" />
          )}
          The strategist’s call
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div
              className="font-jost text-[42px] font-bold leading-none tracking-tight tabular-nums md:text-[52px]"
              style={{ color: onBest ? 'var(--viz-gain)' : 'var(--viz-a)' }}
            >
              {LPB_FULL_BONUS_DAYS.toLocaleString()}<span className="text-[22px] text-[var(--text-faint)]">d</span>
            </div>
            <div className="font-poppins mt-1.5 text-[12.5px] text-[var(--text-muted)]">
              {fmtDuration(LPB_FULL_BONUS_DAYS)} — the shortest stake that captures the whole +200% length bonus.
              Longer earns no extra T-Shares.
            </div>
          </div>
          {onBest ? (
            <div className="font-poppins rounded-lg border border-[var(--viz-gain)]/40 px-3 py-2 text-[12px] font-semibold text-[var(--viz-gain)]">
              You’re on it
            </div>
          ) : (
            <button
              onClick={() => setDays(LPB_FULL_BONUS_DAYS)}
              className="font-poppins rounded-lg bg-[var(--viz-a)] px-4 py-2.5 text-[12px] font-bold text-white transition-transform hover:scale-105"
            >
              Use {LPB_FULL_BONUS_DAYS.toLocaleString()} days
            </button>
          )}
        </div>
        {!onBest && (
          <div className="mt-4 grid gap-3 border-t border-[var(--line)] pt-3 sm:grid-cols-3 sm:gap-2">
            <Swap label="T-Shares" from={fmtTShares(target.tShares)} to={fmtTShares(best.tShares)} note={
              days < LPB_FULL_BONUS_DAYS ? `+${pct1(tShareGain)} for the same HEX` : 'identical — the bonus is capped'
            } />
            <Swap label="Yield" from={fmtHex(target.projectedYieldHex)} to={fmtHex(best.projectedYieldHex)} note="over the term" />
            <Swap label="Locked for" from={fmtDuration(days)} to={fmtDuration(LPB_FULL_BONUS_DAYS)} note={
              days > LPB_FULL_BONUS_DAYS ? `${fmtDuration(days - LPB_FULL_BONUS_DAYS)} of it earns nothing extra` : 'the full-bonus term'
            } />
          </div>
        )}
      </div>

      {/* ── ROI across every length, with your pick marked ── */}
      <div className="anim-rise rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 md:p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 px-1">
          <span className="font-jost text-[15px] font-bold text-[var(--text)]">
            Return over the term, by stake length
          </span>
          <span className="font-poppins text-[11px] text-[var(--text-faint)]">
            {fmtHex(principal)} HEX · {net === 'ethereum' ? 'Ethereum' : 'PulseChain'}
          </span>
        </div>
        <div className="h-[230px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={curve} margin={{ top: 22, right: 12, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="roiFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--viz-a)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--viz-b)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--line-soft)" vertical={false} />
              {/* A numeric axis, not the default categorical one: the "your
                  pick" marker has to land on 1,234 days even though the curve
                  is only sampled every 90 days. On a category axis any x that
                  isn't a sampled length simply doesn't draw. */}
              <XAxis
                dataKey="days"
                type="number"
                domain={[0, HEX_MAX_STAKE_DAYS]}
                ticks={[365, 1095, 1825, 2555, LPB_FULL_BONUS_DAYS, HEX_MAX_STAKE_DAYS]}
                tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
                tickFormatter={(d) => (d >= 365 ? `${(d / 365).toFixed(0)}y` : `${d}d`)}
                stroke="var(--line)"
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
                tickFormatter={(v) => `${v}%`}
                width={46}
                stroke="var(--line)"
                domain={[0, (dataMax: number) => Math.ceil((dataMax * 1.12) / 10) * 10]}
              />
              <Tooltip content={<CurveTooltip />} cursor={{ stroke: 'var(--text-faint)', strokeDasharray: '3 3' }} />
              <ReferenceLine
                x={LPB_FULL_BONUS_DAYS}
                stroke="var(--viz-gain)"
                strokeDasharray="4 4"
                label={{ value: 'full bonus', fontSize: 10, fill: 'var(--viz-gain)', position: 'top' }}
              />
              <ReferenceLine
                x={days}
                stroke="var(--viz-a)"
                strokeWidth={2}
                /* No label when the pick sits on top of the full-bonus line —
                   the two would print over each other. */
                label={
                  Math.abs(days - LPB_FULL_BONUS_DAYS) > 250
                    ? { value: 'your pick', fontSize: 10, fill: 'var(--viz-a)', position: 'top' }
                    : undefined
                }
              />
              <Area type="monotone" dataKey="roiPct" stroke="var(--viz-a)" strokeWidth={2.5} fill="url(#roiFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── What the market is paying right now ── */}
      <div className="anim-rise">
        <div className="font-poppins mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          What the market is paying right now
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Context label="T-Share price" value={fmtUsd(rates.tSharePriceUsd)} trend={rates.tSharePriceTrend} goodWhenDown />
          <Context label="Payout / T-Share" value={`${rates.dailyPayoutPerTShare.toFixed(4)}`} hex sub="a day, 30d average" trend={rates.payoutTrend} />
          <Context label="HEX / T-Share" value={fmtHex(rates.tShareRateHex)} hex sub="rises every day, never falls" />
          <Context label="Supply staked" value={pctStaked != null ? `${pctStaked.toFixed(1)}%` : '—'} sub={`${fmtHex(rates.stakedHex)} HEX locked`} />
        </div>
      </div>

      <p className="font-poppins px-1 text-[10px] leading-relaxed text-[var(--text-faint)]">
        T-Shares and the LPB/BPB bonus are exact HEX contract math. Yield, ROI and APY assume the trailing 30-day average
        payout per T-Share holds for the whole term — it won’t exactly, so read them as a scenario, not a promise.
      </p>
    </div>
  );
}

/* ─────────────────────────────── pieces ─────────────────────────────── */

/** One before → after pair in the verdict's comparison strip. */
function Swap({ label, from, to, note }: { label: string; from: string; to: string; note: string }) {
  return (
    <div>
      <div className="font-poppins truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
        {label}
      </div>
      <div className="font-jost flex items-baseline gap-1.5 text-[19px] font-bold leading-tight tabular-nums text-[var(--text)]">
        <span className="min-w-0 truncate text-[var(--text-faint)]">{from}</span>
        <span className="shrink-0 text-[var(--text-faint)]">→</span>
        <span className="shrink-0">{to}</span>
      </div>
      <div className="font-poppins mt-0.5 text-[11px] leading-snug text-[var(--text-muted)]">{note}</div>
    </div>
  );
}

/** A live market rate, with its 30-day drift when the feed carries one. */
function Context({
  label,
  value,
  sub,
  hex,
  trend,
  goodWhenDown,
}: {
  label: string;
  value: string;
  sub?: string;
  hex?: boolean;
  trend?: number | null;
  goodWhenDown?: boolean;
}) {
  const up = trend != null && trend > 0;
  const good = trend == null ? false : goodWhenDown ? !up : up;
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3">
      <div className="font-poppins truncate text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
        {label}
      </div>
      <div className="font-jost flex items-center gap-1.5 truncate text-[26px] font-bold leading-none tabular-nums text-[var(--text)]">
        {hex && <HexLogo className="h-4 w-4 shrink-0" />}
        <span className="truncate">{value}</span>
      </div>
      {trend != null ? (
        <div
          className="font-poppins mt-1 inline-flex items-center gap-0.5 text-[11px] tabular-nums"
          style={{ color: good ? 'var(--viz-gain)' : 'var(--viz-loss)' }}
        >
          {up ? <IconTrendingUp className="h-3.5 w-3.5" /> : <IconTrendingDown className="h-3.5 w-3.5" />}
          {(trend * 100).toFixed(1)}% · 30d
        </div>
      ) : (
        sub && <div className="font-poppins mt-1 truncate text-[11px] text-[var(--text-muted)]">{sub}</div>
      )}
    </div>
  );
}

/** Value first, in the house tooltip. */
function CurveTooltip({ active, payload }: {
  active?: boolean;
  payload?: { payload: { days: number; roiPct: number; apyPct: number; tShares: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 shadow-xl">
      <div className="font-jost text-[22px] font-bold leading-none tabular-nums" style={{ color: 'var(--viz-a)' }}>
        {pct1(p.roiPct)}
      </div>
      <div className="font-poppins mt-1 text-[11px] text-[var(--text-muted)]">
        over {fmtDuration(p.days)} · {pct1(p.apyPct)} a year
      </div>
      <div className="font-poppins mt-0.5 text-[11px] text-[var(--text-faint)]">
        {fmtTShares(p.tShares)} T-Shares
      </div>
    </div>
  );
}
