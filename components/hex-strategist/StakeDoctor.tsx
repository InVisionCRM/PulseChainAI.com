'use client';

// HEX Stake Strategist — Phase 2 "Stake Doctor" (decision engine).
//
// Paste a wallet; for each ACTIVE stake the Doctor answers the one HEX question
// you can't net out in your head: is it worth ending early and re-staking at
// today's rate? It compares the T-Shares you hold now vs what re-staking the
// recovered HEX (after the estimated penalty) into a fresh 3641-day stake would
// mint — a tug-of-war between the bonus jump (helps short stakes) and HEX's
// ever-rising T-Share rate + the penalty (hurts). It also surfaces the exact
// penalty-cliff day. Status (locked/grace/late) is demoted to a small badge.

import { useState } from 'react';
import {
  IconRefresh, IconStethoscope, IconSearch, IconArrowsExchange, IconLock, IconCircleCheck, IconAlertTriangle,
} from '@tabler/icons-react';
import { pulsechainHexStakingService } from '@/services/pulsechainHexStakingService';
import { hexStakingService } from '@/services/hexStakingService';
import { type Network, type Rates, loadRates } from '@/lib/hex/strategistData';
import {
  analyzeRestake, penaltyCliffDay, stakeTiming, LPB_FULL_BONUS_DAYS, type StakeStatus, type RestakeAnalysis,
} from '@/lib/hex/stakeMath';
import {
  heartsToHex, sharesToTShares, currentHexDay, fmtHex, fmtTShares, fmtDuration, fmtHexDate, fmtUsdShort,
} from '@/lib/hex/hexDay';

interface DoctorStake {
  stakeId: string;
  principalHex: number;
  committed: number;
  endDay: number;
  status: StakeStatus;
  servedDays: number;
  daysToEnd: number;
  graceDaysLeft: number;
  daysPastGrace: number;
  progressPct: number;
  restake: RestakeAnalysis;
  // Penalty cliff (only meaningful while still in the penalty window).
  daysToCliff: number;
  cliffDay: number;
}

const num = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

export default function StakeDoctor({ net }: { net: Network }) {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [stakes, setStakes] = useState<DoctorStake[]>([]);
  const [rates, setRates] = useState<Rates | null>(null);

  const analyze = async () => {
    const addr = input.trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(addr)) {
      setError('Enter a valid 0x… wallet address.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const [history, r] = await Promise.all([
        net === 'pulsechain'
          ? pulsechainHexStakingService.getStakerHistory(addr)
          : hexStakingService.getStakerHistory(addr),
        loadRates(net),
      ]);
      setRates(r);
      const h = history as unknown as { stakes?: unknown[]; currentDay?: number };
      const currentDay = h.currentDay && h.currentDay > 0 ? h.currentDay : currentHexDay();
      const payout = r.dailyPayoutPerTShare;

      const active = (h.stakes ?? [])
        .map((raw) => raw as Record<string, unknown>)
        .filter((s) => s.isActive)
        .map<DoctorStake>((s) => {
          const tShares = sharesToTShares(s.stakeShares as string);
          const principalHex = heartsToHex(s.stakedHearts as string);
          const committed = num(s.stakedDays);
          const startDay = num(s.startDay);
          const endDay = num(s.endDay);
          const t = stakeTiming(startDay, endDay, committed, currentDay);
          const restake = analyzeRestake(principalHex, tShares, committed, t.servedDays, r.tShareRateHex, payout, LPB_FULL_BONUS_DAYS);
          const cliffDay = penaltyCliffDay(startDay, committed);
          return {
            stakeId: String(s.stakeId ?? ''),
            principalHex,
            committed,
            endDay,
            status: t.status,
            servedDays: t.servedDays,
            daysToEnd: t.daysToEnd,
            graceDaysLeft: t.graceDaysLeft,
            daysPastGrace: t.daysPastGrace,
            progressPct: t.progressPct,
            restake,
            daysToCliff: Math.max(0, cliffDay - currentDay),
            cliffDay,
          };
        })
        // Surface the best re-stake opportunities first.
        .sort((a, b) => b.restake.deltaT - a.restake.deltaT);

      setStakes(active);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to analyze stakes.');
      setStatus('error');
    }
  };

  const usd = (hex: number) => (rates ? hex * rates.priceUsd : 0);
  const worthRestaking = stakes.filter((s) => s.restake.deltaT > 0).length;

  return (
    <div className="space-y-4">
      {/* Address input */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
          <IconStethoscope className="h-4 w-4 text-cyan-400" /> Diagnose a wallet’s stakes
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          The Doctor checks each active stake for the one hard call: end early &amp; re-stake at today’s rate, or hold?
        </p>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && analyze()}
            placeholder="0x…"
            className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 font-mono text-sm text-[var(--text)] outline-none focus:border-cyan-500/60"
          />
          <button
            onClick={analyze}
            disabled={status === 'loading'}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50"
          >
            {status === 'loading' ? <IconRefresh className="h-4 w-4 animate-spin" /> : <IconSearch className="h-4 w-4" />}
            Diagnose
          </button>
        </div>
      </div>

      {status === 'error' && <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}

      {status === 'ready' && stakes.length === 0 && (
        <div className="py-12 text-center text-sm text-[var(--text-faint)]">No active HEX stakes for this wallet on {net}.</div>
      )}

      {status === 'ready' && stakes.length > 0 && rates && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Summary label="Active stakes" value={String(stakes.length)} />
            <Summary label="Total principal" value={`${fmtHex(stakes.reduce((s, k) => s + k.principalHex, 0))} HEX`} sub={fmtUsdShort(usd(stakes.reduce((s, k) => s + k.principalHex, 0)))} />
            <Summary label="Worth re-staking" value={String(worthRestaking)} good={worthRestaking > 0} />
            <Summary label="Endable penalty-free" value={String(stakes.filter((s) => s.status === 'grace').length)} good />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {stakes.map((s) => <DoctorCard key={s.stakeId} s={s} usd={usd} />)}
          </div>

          <p className="px-1 text-[10px] leading-relaxed text-[var(--text-faint)]">
            <span className="text-[var(--text-muted)]">Exact:</span> T-Shares kept (on-chain) and T-Shares from re-staking
            (today’s real rate × HEX contract bonus math) — direction is reliable because the rate only ever rises.{' '}
            <span className="text-[var(--text-muted)]">Estimated:</span> the penalty &amp; recovered-HEX dollars (assume the
            trailing-30d payout). Re-staking buys earning power but re-locks you for {fmtDuration(LPB_FULL_BONUS_DAYS)} — a
            capital-efficiency call, not free money.
          </p>
        </>
      )}
    </div>
  );
}

function DoctorCard({ s, usd }: { s: DoctorStake; usd: (hex: number) => number }) {
  const status =
    s.status === 'grace'
      ? { color: '#22c55e', icon: <IconCircleCheck className="h-3.5 w-3.5" />, label: 'window open' }
      : s.status === 'late'
        ? { color: '#ef4444', icon: <IconAlertTriangle className="h-3.5 w-3.5" />, label: `${s.daysPastGrace}d late` }
        : { color: '#8b98a5', icon: <IconLock className="h-3.5 w-3.5" />, label: `${s.daysToEnd.toLocaleString()}d left` };

  const r = s.restake;
  const good = r.deltaT > 0;
  const callColor = good ? '#22c55e' : '#ef4444';

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      {/* Top line: id + principal + small status badge */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text)]">Stake #{s.stakeId}</span>
            <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ color: status.color, borderColor: `${status.color}55` }}>
              {status.icon}{status.label}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--text-muted)] tabular-nums">
            {fmtHex(s.principalHex)} HEX · {fmtUsdShort(usd(s.principalHex))} · day {s.servedDays.toLocaleString()}/{s.committed.toLocaleString()}
          </div>
        </div>
      </div>

      {/* THE CALL: end-early-and-re-stake arbitrage */}
      <div className="rounded-lg border p-3" style={{ borderColor: `${callColor}55`, background: `${callColor}0d` }}>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: callColor }}>
            <IconArrowsExchange className="h-4 w-4" />
            {good ? 'Re-stake wins' : 'Keep — don’t churn'}
          </span>
          <span className="text-sm font-bold tabular-nums" style={{ color: callColor }}>
            {good ? '+' : ''}{r.deltaT.toFixed(1)} T-Shares
          </span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <Mini label="Keep" value={fmtTShares(r.tSharesKeep)} />
          <Mini label={`Re-stake ${LPB_FULL_BONUS_DAYS.toLocaleString()}d`} value={fmtTShares(r.tSharesRestake)} accent={callColor} />
          <Mini label="Penalty (est.)" value={`~${fmtUsdShort(usd(r.penaltyHex))}`} />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
          {good ? (
            <>End early (≈{fmtUsdShort(usd(r.penaltyHex))} penalty) and re-stake the {fmtHex(r.recoveredHex)} HEX you’d
              recover → <span className="font-semibold" style={{ color: callColor }}>+{r.deltaT.toFixed(1)} T-Shares</span> of
              earning power. Trade-off: re-locked for {fmtDuration(r.restakeDays)} (you have {fmtDuration(s.daysToEnd)} left now).</>
          ) : (
            <>Re-staking would <span className="font-semibold" style={{ color: callColor }}>lose {Math.abs(r.deltaT).toFixed(1)} T-Shares</span>{' '}
              and cost ≈{fmtUsdShort(usd(r.penaltyHex))} — the rate has risen since you minted. Let it ride.</>
          )}
        </p>
      </div>

      {/* Progress + penalty cliff */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className="h-full rounded-full" style={{ width: `${s.progressPct}%`, background: status.color }} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
        <span>Penalty-free window: <span className="text-[var(--text)]">{fmtHexDate(s.endDay)}</span> → {fmtHexDate(s.endDay + 14)}</span>
        {s.status === 'locked' && s.daysToCliff > 0 ? (
          <span className="text-amber-300">⛳ Penalty stops eating principal in {fmtDuration(s.daysToCliff)} ({fmtHexDate(s.cliffDay)})</span>
        ) : s.status === 'locked' ? (
          <span className="text-[var(--up)]">✓ Past the penalty cliff — early-end no longer touches principal</span>
        ) : null}
      </div>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-md bg-[var(--surface-2)] px-1.5 py-1">
      <div className="truncate text-[9px] uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div className="text-xs font-bold tabular-nums" style={{ color: accent ?? 'var(--text)' }}>{value}</div>
    </div>
  );
}

function Summary({ label, value, sub, good, bad }: { label: string; value: string; sub?: string; good?: boolean; bad?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="truncate text-[10px] uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div className={`mt-0.5 text-base font-bold tabular-nums ${good ? 'text-[var(--up)]' : bad ? 'text-red-400' : 'text-[var(--text)]'}`}>{value}</div>
      {sub && <div className="text-[10px] text-[var(--text-muted)] tabular-nums">{sub}</div>}
    </div>
  );
}
