'use client';

// HEX Stake Strategist — Phase 2 "Stake Doctor".
//
// Paste a wallet; for each ACTIVE stake it computes exact day-based timing (the
// penalty-free window opens at the committed end day and lasts 14 days) and an
// estimated dollar cost to end early, then gives a plain verdict: hold to term,
// wait for the window, end now (in the window), or end ASAP (late). On-chain
// stake data comes from the same staking services the dashboard uses; live
// rates from /api/hex-proxy.

import { useState } from 'react';
import { IconRefresh, IconStethoscope, IconSearch, IconAlertTriangle, IconCircleCheck, IconLock } from '@tabler/icons-react';
import { pulsechainHexStakingService } from '@/services/pulsechainHexStakingService';
import { hexStakingService } from '@/services/hexStakingService';
import { type Network, type Rates, loadRates } from '@/lib/hex/strategistData';
import { estimatedEarlyPenaltyHex, stakeTiming, type StakeStatus } from '@/lib/hex/stakeMath';
import {
  heartsToHex, sharesToTShares, currentHexDay, fmtHex, fmtTShares, fmtDuration, fmtHexDate, fmtUsdShort,
} from '@/lib/hex/hexDay';

interface DoctorStake {
  stakeId: string;
  principalHex: number;
  tShares: number;
  committed: number;
  startDay: number;
  endDay: number;
  status: StakeStatus;
  servedDays: number;
  daysToEnd: number;
  graceDaysLeft: number;
  daysPastGrace: number;
  progressPct: number;
  penaltyHex: number; // estimated early-end penalty
  netIfEndNowHex: number; // served yield − penalty (negative ⇒ principal loss)
  costVsHoldHex: number; // penalty + forgone remaining yield
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
          const penaltyHex = estimatedEarlyPenaltyHex(tShares, payout, committed);
          const servedYieldHex = tShares * payout * t.servedDays;
          const remainingYieldHex = tShares * payout * t.daysToEnd;
          return {
            stakeId: String(s.stakeId ?? ''),
            principalHex,
            tShares,
            committed,
            startDay,
            endDay,
            status: t.status,
            servedDays: t.servedDays,
            daysToEnd: t.daysToEnd,
            graceDaysLeft: t.graceDaysLeft,
            daysPastGrace: t.daysPastGrace,
            progressPct: t.progressPct,
            penaltyHex,
            netIfEndNowHex: servedYieldHex - penaltyHex,
            costVsHoldHex: penaltyHex + remainingYieldHex,
          };
        })
        .sort((a, b) => a.daysToEnd - b.daysToEnd);

      setStakes(active);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to analyze stakes.');
      setStatus('error');
    }
  };

  const usd = (hex: number) => (rates ? hex * rates.priceUsd : 0);

  return (
    <div className="space-y-4">
      {/* Address input */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
          <IconStethoscope className="h-4 w-4 text-cyan-400" /> Diagnose a wallet’s stakes
        </div>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Paste any address — the Doctor grades each active stake and tells you when to end it.
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
          {/* Summary */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Summary label="Active stakes" value={String(stakes.length)} />
            <Summary label="Total principal" value={`${fmtHex(stakes.reduce((s, k) => s + k.principalHex, 0))} HEX`} sub={fmtUsdShort(usd(stakes.reduce((s, k) => s + k.principalHex, 0)))} />
            <Summary label="Endable penalty-free" value={String(stakes.filter((s) => s.status === 'grace').length)} good />
            <Summary label="Late (act now)" value={String(stakes.filter((s) => s.status === 'late').length)} bad={stakes.some((s) => s.status === 'late')} />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {stakes.map((s) => <DoctorCard key={s.stakeId} s={s} usd={usd} />)}
          </div>

          <p className="px-1 text-[10px] leading-relaxed text-[var(--text-faint)]">
            Timing (penalty-free window, days served/left) is exact from on-chain stake days. Penalty and yield figures are
            estimates at the trailing-30-day payout per T-Share — HEX’s exact early/late penalty depends on realized
            payouts. Use as guidance, not gospel.
          </p>
        </>
      )}
    </div>
  );
}

function DoctorCard({ s, usd }: { s: DoctorStake; usd: (hex: number) => number }) {
  const meta =
    s.status === 'grace'
      ? { color: '#22c55e', icon: <IconCircleCheck className="h-4 w-4" />, badge: 'Penalty-free window open' }
      : s.status === 'late'
        ? { color: '#ef4444', icon: <IconAlertTriangle className="h-4 w-4" />, badge: 'Late — penalty accruing' }
        : { color: '#ff8a00', icon: <IconLock className="h-4 w-4" />, badge: 'Locked' };

  const verdict =
    s.status === 'grace'
      ? `End now — you're in the penalty-free window (${s.graceDaysLeft} day${s.graceDaysLeft === 1 ? '' : 's'} left in it).`
      : s.status === 'late'
        ? `End ASAP — ${s.daysPastGrace} day${s.daysPastGrace === 1 ? '' : 's'} past the penalty-free window and late penalties are accruing.`
        : s.daysToEnd <= 30
          ? `Almost there — wait ${s.daysToEnd} day${s.daysToEnd === 1 ? '' : 's'} for the penalty-free window instead of ending early.`
          : `Hold to term — ending today is ~${fmtUsdShort(usd(s.costVsHoldHex))} worse than waiting (penalty + forgone yield).`;

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--text)]">Stake #{s.stakeId}</span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: meta.color }}>
          {meta.icon}{meta.badge}
        </span>
      </div>

      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">Principal</div>
          <div className="text-base font-bold tabular-nums text-[var(--text)]">{fmtHex(s.principalHex)} HEX</div>
          <div className="text-[11px] text-[var(--text-muted)] tabular-nums">{fmtUsdShort(usd(s.principalHex))} · {fmtTShares(s.tShares)} T</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">End-early penalty (est.)</div>
          <div className="text-base font-bold tabular-nums" style={{ color: meta.color }}>~{fmtUsdShort(usd(s.penaltyHex))}</div>
          {s.netIfEndNowHex < 0 && s.status === 'locked' && (
            <div className="text-[11px] text-red-400 tabular-nums">eats principal</div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-[var(--text-muted)] tabular-nums">Day {s.servedDays.toLocaleString()} of {s.committed.toLocaleString()}</span>
        <span className="font-semibold tabular-nums" style={{ color: meta.color }}>
          {s.status === 'locked' ? `${s.daysToEnd.toLocaleString()} days left` : s.status === 'grace' ? `${s.graceDaysLeft}d window` : `${s.daysPastGrace}d late`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className="h-full rounded-full" style={{ width: `${s.progressPct}%`, background: meta.color }} />
      </div>

      <div className="mt-2 text-[11px] text-[var(--text-muted)]">
        Penalty-free window: <span className="text-[var(--text)]">{fmtHexDate(s.endDay)}</span> → {fmtHexDate(s.endDay + 14)}
        {s.status === 'locked' && <> · opens in {fmtDuration(s.daysToEnd)}</>}
      </div>

      <div className="mt-3 rounded-lg border px-3 py-2 text-xs leading-relaxed" style={{ borderColor: `${meta.color}55`, background: `${meta.color}11`, color: 'var(--text)' }}>
        <span style={{ color: meta.color }} className="font-semibold">Verdict: </span>
        {verdict}
      </div>
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
