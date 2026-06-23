'use client';

// HEX Stake Strategist — Phase 1 "Stake Designer".
//
// An opinionated tool (not another read-out): you enter an amount of HEX and it
// computes the projected T-Shares, yield, ROI and APY across every stake length
// using the real HEX LPB/BPB bonus math, then recommends a length. Data comes
// from the existing /api/hex-proxy (hexdailystats.com) — live rates + a trailing
// payout average — so nothing new is plumbed. Lives at its own route; the legacy
// hex-dashboard is untouched.

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
import { IconRefresh, IconBolt, IconTrendingUp, IconTrendingDown } from '@tabler/icons-react';
import {
  HEX_MAX_STAKE_DAYS,
  LPB_FULL_BONUS_DAYS,
  defaultLengths,
  projectStake,
  projectionCurve,
} from '@/lib/hex/stakeMath';
import { fmtHex, fmtTShares, fmtDuration } from '@/lib/hex/hexDay';
import { fmtUsd } from '@/lib/format';
import { type Network, type Rates, num, loadRates } from '@/lib/hex/strategistData';

export default function HexStrategist({ net }: { net: Network }) {
  const [rates, setRates] = useState<Rates | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [amount, setAmount] = useState('1000000');
  const [days, setDays] = useState(LPB_FULL_BONUS_DAYS);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    loadRates(net)
      .then((r) => {
        if (!alive) return;
        if (!r.tShareRateHex) {
          setStatus('error');
          return;
        }
        setRates(r);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
    };
  }, [net, reload]);

  const principal = Math.max(0, num(amount));

  const curve = useMemo(() => {
    if (!rates) return [];
    return projectionCurve(principal, rates.tShareRateHex, rates.dailyPayoutPerTShare, defaultLengths());
  }, [rates, principal]);

  const target = useMemo(() => {
    if (!rates) return null;
    return projectStake(principal, days, rates.tShareRateHex, rates.dailyPayoutPerTShare);
  }, [rates, principal, days]);

  const usd = (hex: number) => (rates ? hex * rates.priceUsd : 0);

  if (status === 'loading') {
    return (
      <div className="grid place-items-center py-20 text-sm text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-2">
          <IconRefresh className="h-4 w-4 animate-spin" /> Loading HEX rates…
        </span>
      </div>
    );
  }
  if (status === 'error' || !rates || !target) {
    return (
      <div className="py-20 text-center text-sm text-red-300">
        Couldn’t load HEX rates right now.
        <button onClick={() => setReload((n) => n + 1)} className="ml-2 underline">retry</button>
      </div>
    );
  }

  const pctStaked = rates.circulatingHex > 0 ? (rates.stakedHex / rates.circulatingHex) * 100 : null;

  return (
    <div className="space-y-4">
      {/* Decision context strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Context label="T-Share price" value={fmtUsd(rates.tSharePriceUsd)} trend={rates.tSharePriceTrend} goodWhenDown />
        <Context label="Payout / T-Share (30d avg)" value={`${rates.dailyPayoutPerTShare.toFixed(4)} HEX`} trend={rates.payoutTrend} />
        <Context label="HEX / T-Share" value={fmtHex(rates.tShareRateHex)} />
        <Context label="Supply staked" value={pctStaked != null ? `${pctStaked.toFixed(1)}%` : '—'} />
      </div>

      {/* Inputs */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Amount to stake (HEX)</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm tabular-nums text-[var(--text)] outline-none focus:border-orange-500/60"
            />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
              <span>Stake length</span>
              <span className="text-orange-300">{fmtDuration(days)} · {days.toLocaleString()}d</span>
            </span>
            <input
              type="range"
              min={1}
              max={HEX_MAX_STAKE_DAYS}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="mt-2 w-full accent-orange-500"
            />
          </label>
        </div>
      </div>

      {/* Projection for the chosen length */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="T-Shares" value={fmtTShares(target.tShares)} accent />
        <Stat label="Projected yield" value={`${fmtHex(target.projectedYieldHex)} HEX`} sub={fmtUsd(usd(target.projectedYieldHex))} />
        <Stat label="ROI (term)" value={`${target.roiPct.toFixed(1)}%`} good={target.roiPct >= 0} />
        <Stat label="APY" value={`${target.apyPct.toFixed(1)}%`} good={target.apyPct >= 0} />
      </div>

      {/* ROI-vs-length curve */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--text)]">ROI by stake length</span>
          <span className="text-[11px] text-[var(--text-muted)]">tap-free preview · {net}</span>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={curve} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id="roiFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff8a00" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#ff2e7e" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
              <XAxis
                dataKey="days"
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickFormatter={(d) => (d >= 365 ? `${(d / 365).toFixed(0)}y` : `${d}d`)}
              />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v) => `${v}%`} width={44} />
              <Tooltip
                contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12 }}
                labelFormatter={(d) => `${Number(d).toLocaleString()} days (${fmtDuration(Number(d))})`}
                formatter={(v: number, name) => [name === 'roiPct' ? `${v.toFixed(1)}%` : v, 'ROI']}
              />
              <ReferenceLine x={LPB_FULL_BONUS_DAYS} stroke="#22c55e" strokeDasharray="4 4" label={{ value: 'LPB max', fontSize: 10, fill: '#22c55e', position: 'top' }} />
              <ReferenceLine x={days} stroke="#ff8a00" strokeWidth={1} />
              <Area type="monotone" dataKey="roiPct" stroke="#ff8a00" strokeWidth={2} fill="url(#roiFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* The opinion */}
      <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
          <IconBolt className="h-4 w-4 text-green-400" /> The strategist’s call
        </div>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          A <span className="font-semibold text-green-300">{LPB_FULL_BONUS_DAYS.toLocaleString()}-day</span> stake
          (~{fmtDuration(LPB_FULL_BONUS_DAYS)}) captures <span className="font-semibold text-[var(--text)]">100% of the Longer-Pays-Better bonus</span>.
          Staking longer than that adds <span className="italic">zero</span> extra T-Shares per HEX — you’d only be
          locking up for more time at the same efficiency.{' '}
          {days < LPB_FULL_BONUS_DAYS && (
            <>At your current <span className="text-orange-300">{days.toLocaleString()}-day</span> pick you’re leaving
              T-Share bonus on the table.{' '}</>
          )}
          {days > LPB_FULL_BONUS_DAYS && (
            <>Your <span className="text-orange-300">{days.toLocaleString()}-day</span> pick locks you up{' '}
              {fmtDuration(days - LPB_FULL_BONUS_DAYS)} longer for no extra bonus.{' '}</>
          )}
        </p>
        <button
          onClick={() => setDays(LPB_FULL_BONUS_DAYS)}
          className="mt-3 rounded-lg bg-green-500/20 px-3 py-1.5 text-xs font-semibold text-green-200 hover:bg-green-500/30"
        >
          Use {LPB_FULL_BONUS_DAYS.toLocaleString()} days
        </button>
      </div>

      <p className="px-1 text-[10px] leading-relaxed text-[var(--text-faint)]">
        Projections assume the trailing 30-day average payout per T-Share stays constant. Future payouts are unknown and
        depend on total network T-Shares and Big Pay Day — treat ROI/APY as a scenario, not a guarantee. T-Share count
        and the LPB/BPB bonus are exact (HEX contract math).
      </p>
    </div>
  );
}

function Context({
  label,
  value,
  trend,
  goodWhenDown,
}: {
  label: string;
  value: string;
  trend?: number | null;
  goodWhenDown?: boolean;
}) {
  const up = trend != null && trend > 0;
  const good = trend == null ? false : goodWhenDown ? !up : up;
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="truncate text-[10px] uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--text)]">{value}</div>
      {trend != null && (
        <div className={`mt-0.5 inline-flex items-center gap-0.5 text-[10px] tabular-nums ${good ? 'text-[var(--up)]' : 'text-red-400'}`}>
          {up ? <IconTrendingUp className="h-3 w-3" /> : <IconTrendingDown className="h-3 w-3" />}
          {(trend * 100).toFixed(1)}% · 30d
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent, good }: { label: string; value: string; sub?: string; accent?: boolean; good?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="truncate text-[10px] uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div
        className={`mt-0.5 text-base font-bold tabular-nums ${
          accent ? 'text-orange-300' : good === false ? 'text-red-400' : 'text-[var(--text)]'
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-[var(--text-muted)] tabular-nums">{sub}</div>}
    </div>
  );
}
