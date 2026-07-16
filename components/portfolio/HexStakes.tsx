'use client';

// HEX stakes + stake history for a wallet (PulseChain pHEX). Shows a summary
// strip, the wallet's ACTIVE stakes (each with a progress bar + days remaining
// and full stats) and ENDED stakes (payout / penalty / ROI). Powered by the
// working PulseChain HEX subgraph via pulsechainHexStakingService (client calls
// route through /api/pulsechain-graphql-proxy). Built mobile-first — cards, not
// wide tables. Designed to be reusable (drop into a portfolio wallet card too).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconRefresh, IconExternalLink, IconAlertTriangle, IconLock, IconChevronDown } from '@tabler/icons-react';
import { pulsechainHexStakingService } from '@/services/pulsechainHexStakingService';
import type {
  PulseChainStakerHistoryMetrics,
  PulseChainHexStake,
  PulseChainHexStakeEnd,
  PulseChainGoodAccounting,
} from '@/services/pulsechainHexStakingService';
import {
  heartsToHex, sharesToTShares, stakeProgress, currentHexDay,
  fmtDuration, fmtHex, fmtTShares, fmtHexDate, fmtUsdShort,
  latePenaltyStatus, LATE_PENALTY_GRACE_DAYS, LATE_PENALTY_SCALE_DAYS,
  HEX_LAUNCH_TS,
} from '@/lib/hex/hexDay';
import { HexAmount, HexUnit } from '@/components/hex/HexAmount';
import { pulsechainTxUrl, pulsechainAddressUrl } from '@/lib/pulsechainExplorer';

// HEX brand gradient — used ONLY on the locked-stake progress bar now; amounts
// use the portfolio's standard text tokens for a calmer, consistent look.
const HEX_GRADIENT = 'linear-gradient(135deg, #ff9e00 0%, #ff2e7e 52%, #ff00d4 100%)';

/** Whole HEX day for a unix-seconds timestamp (matches the contract's epoch). */
const tsToHexDay = (ts: string | number) => Math.floor((Number(ts) - HEX_LAUNCH_TS) / 86400);

const shortHash = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—');
const fmtDateTime = (ts: string | number) => {
  const n = Number(ts);
  return n > 0
    ? new Date(n * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : '—';
};

interface Props {
  /** Wallet address whose HEX stakes to show. */
  address: string;
  /** Current HEX (pHEX) USD price, for USD figures. Optional. */
  hexUsd?: number | null;
  /** Current daily payout per T-Share (HEX) — enables an estimated-yield
   *  figure on active stakes. Optional. */
  payoutPerTShare?: number | null;
}

type Tab = 'active' | 'ended';

export function HexStakes({ address, hexUsd, payoutPerTShare }: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PulseChainStakerHistoryMetrics | null>(null);
  const [tab, setTab] = useState<Tab>('active');
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setStatus('loading');
    setError(null);
    try {
      const res = await pulsechainHexStakingService.getStakerHistory(address.toLowerCase());
      if (id !== reqId.current) return;
      setData(res);
      setStatus('ready');
    } catch (e) {
      if (id !== reqId.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load HEX stakes');
      setStatus('error');
    }
  }, [address]);

  useEffect(() => { void load(); }, [load]);

  const view = useMemo(() => {
    if (!data) return null;
    // The subgraph's globalInfo.hexDay comes back 0/undefined here, so derive
    // today's HEX day locally (deterministic from time) — fall back to the
    // subgraph value only if it ever provides a valid one.
    const currentDay = data.currentDay && data.currentDay > 0 ? data.currentDay : currentHexDay();
    const usd = (hex: number) => (hexUsd != null ? hex * hexUsd : null);

    const active = data.stakes
      .filter((s) => s.isActive)
      .sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));

    // Good-accounting events keyed by stakeId — the authoritative "this matured
    // stake was frozen" signal, so we don't mislabel it as still bleeding.
    const gaById = new Map<string, PulseChainGoodAccounting>(
      (data.goodAccountings ?? []).map((g) => [g.stakeId, g]),
    );

    // Join ends to their starts (for committed length + start date).
    const startById = new Map(data.stakes.map((s) => [s.stakeId, s]));
    const ended = data.stakeEnds.map((e) => ({ end: e, start: startById.get(e.stakeId) ?? null }))
      .sort((a, b) => Number(b.end.timestamp) - Number(a.end.timestamp));

    const activePrincipal = active.reduce((s, k) => s + heartsToHex(k.stakedHearts), 0);
    const activeTShares = active.reduce((s, k) => s + sharesToTShares(k.stakeShares), 0);
    const realizedYield = ended.reduce((s, k) => s + heartsToHex(k.end.payout), 0);
    const totalPenalty = ended.reduce((s, k) => s + heartsToHex(k.end.penalty), 0);
    const endedPrincipal = ended.reduce((s, k) => s + heartsToHex(k.end.stakedHearts), 0);
    const realizedRoi = endedPrincipal > 0 ? ((realizedYield - totalPenalty) / endedPrincipal) * 100 : 0;
    const avgLenDays = active.length
      ? active.reduce((s, k) => s + Number(k.stakedDays), 0) / active.length
      : 0;

    return {
      currentDay, usd, active, ended, gaById,
      activePrincipal, activeTShares, realizedYield, totalPenalty, realizedRoi, avgLenDays,
    };
  }, [data, hexUsd]);

  if (status === 'loading') {
    return (
      <div className="grid place-items-center py-12 text-sm text-[var(--text-faint)]">
        <span className="inline-flex items-center gap-2"><IconRefresh className="h-4 w-4 animate-spin" /> Loading HEX stakes…</span>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="px-3 py-6 text-center text-sm text-red-300">
        {error}
        <button onClick={() => void load()} className="ml-2 underline hover:text-red-200">retry</button>
      </div>
    );
  }
  if (!view || (view.active.length === 0 && view.ended.length === 0)) {
    return <div className="py-12 text-center text-sm text-[var(--text-faint)]">No HEX stakes found for this wallet.</div>;
  }

  return (
    <div className="space-y-3">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Metric label="Staked" value={fmtHex(view.activePrincipal)} sub={view.usd(view.activePrincipal) != null ? fmtUsdShort(view.usd(view.activePrincipal)) : <HexUnit className="text-[var(--text-faint)]" />} />
        <Metric label="T-Shares" value={fmtTShares(view.activeTShares)} sub={`${view.active.length} active`} />
        <Metric label="Avg length" value={fmtDuration(view.avgLenDays)} sub="locked" />
        <Metric label="Realized" value={`+${fmtHex(view.realizedYield)}`} sub={view.usd(view.realizedYield) != null ? fmtUsdShort(view.usd(view.realizedYield)) : <HexUnit className="text-[var(--text-faint)]" />} good />
        <Metric label="Net ROI" value={`${view.realizedRoi >= 0 ? '+' : ''}${view.realizedRoi.toFixed(1)}%`} sub={`${view.ended.length} ended`} good={view.realizedRoi >= 0} bad={view.realizedRoi < 0} />
        <Metric label="HEX day" value={String(view.currentDay)} sub="now" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <TabBtn active={tab === 'active'} onClick={() => setTab('active')}>Active · {view.active.length}</TabBtn>
        <TabBtn active={tab === 'ended'} onClick={() => setTab('ended')}>Ended · {view.ended.length}</TabBtn>
        <button onClick={() => void load()} className="ml-auto text-[var(--text-faint)] hover:text-[var(--text)]" title="Refresh">
          <IconRefresh className="h-4 w-4" />
        </button>
      </div>

      {tab === 'active' ? (
        view.active.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--text-faint)]">No active stakes.</div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
            {view.active.map((s) => <ActiveStakeCard key={s.id} stake={s} currentDay={view.currentDay} hexUsd={hexUsd} payoutPerTShare={payoutPerTShare} ga={view.gaById.get(s.stakeId) ?? null} />)}
          </div>
        )
      ) : view.ended.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--text-faint)]">No ended stakes.</div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-2">
          {view.ended.map(({ end, start }) => <EndedStakeRow key={end.id} end={end} start={start} hexUsd={hexUsd} />)}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, sub, good, bad }: { label: string; value: string; sub?: React.ReactNode; good?: boolean; bad?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="truncate text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${good ? 'text-[var(--up)]' : bad ? 'text-red-400' : 'text-[var(--text)]'}`}>{value}</div>
      {sub != null ? <div className="text-[10px] text-[var(--text-faint)] tabular-nums">{sub}</div> : null}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--line)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
    >
      {children}
    </button>
  );
}

function ExplorerLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-[var(--text)]">
      {children}
      <IconExternalLink className="h-2.5 w-2.5" />
    </a>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--text-faint)]">{label}</dt>
      <dd className={`min-w-0 break-all text-right text-[11px] text-[var(--text-muted)] ${mono ? 'font-mono' : 'tabular-nums'}`}>{value}</dd>
    </div>
  );
}

/** Collapsible "All details" toggle used at the bottom of each stake card. */
function DetailsToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-[var(--line)] py-1.5 text-[11px] font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
    >
      {open ? 'Hide details' : 'All details'}
      <IconChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
  );
}

function ActiveStakeCard({ stake, currentDay, hexUsd, payoutPerTShare, ga }: { stake: PulseChainHexStake; currentDay: number; hexUsd?: number | null; payoutPerTShare?: number | null; ga?: PulseChainGoodAccounting | null }) {
  const [open, setOpen] = useState(false);
  const principal = heartsToHex(stake.stakedHearts);
  const tShares = sharesToTShares(stake.stakeShares);
  const startDay = Number(stake.startDay);
  const endDay = Number(stake.endDay);
  const stakedDays = Number(stake.stakedDays);
  const served = Math.max(0, currentDay - startDay);
  const left = Math.max(0, endDay - currentDay);
  const pct = stakeProgress(startDay, stakedDays, currentDay) * 100;
  const usd = hexUsd != null ? principal * hexUsd : null;

  // Estimated yield at the current daily payout per T-Share — what it's earned
  // so far, and projected to its full term. Estimate (assumes constant payout).
  const estEarnedHex = payoutPerTShare != null ? tShares * payoutPerTShare * served : null;
  const estTermHex = payoutPerTShare != null ? tShares * payoutPerTShare * stakedDays : null;

  const past = currentDay - endDay;
  const locked = currentDay < endDay;

  // GOOD-ACCOUNTING (authoritative): once a matured, unended stake is
  // good-accounted, its penalty + payout are FROZEN on that day — it stops
  // bleeding. We surface the real frozen figures (and how long after maturity it
  // was good-accounted) instead of the time-based "bleeding" estimate below.
  const gaDay = ga ? tsToHexDay(ga.timestamp) : null;
  const gaInfo = ga
    ? (() => {
        const penaltyHex = heartsToHex(ga.penalty);
        const payoutHex = heartsToHex(ga.payout);
        const gross = principal + payoutHex;
        return {
          daysAfterMaturity: Math.max(0, (gaDay ?? endDay) - endDay),
          penaltyHex,
          payoutHex,
          fraction: gross > 0 ? Math.min(1, penaltyHex / gross) : 0,
          claimableHex: Math.max(0, principal + payoutHex - penaltyHex),
        };
      })()
    : null;

  // Status pill: locked → ready (grace) → good-accounted (frozen) → late (bleeding).
  const status = locked
    ? { label: 'Locked', cls: 'text-[var(--text-faint)]', icon: <IconLock className="h-3 w-3" /> }
    : gaInfo
      ? { label: 'Good-accounted', cls: 'text-cyan-300', icon: null }
      : past <= LATE_PENALTY_GRACE_DAYS
        ? { label: 'Ready to end', cls: 'text-[var(--up)]', icon: null }
        : { label: 'Late — penalty accruing', cls: 'text-amber-300', icon: <IconAlertTriangle className="h-3 w-3" /> };

  // Locked stakes get the brand gradient; ready/late keep their semantic colors.
  const barColor = locked ? '#ff2e7e' : past <= LATE_PENALTY_GRACE_DAYS ? '#22c55e' : '#f59e0b';

  // Time-based late-end penalty ESTIMATE — only meaningful when the stake was
  // NOT good-accounted (a GA freezes it, so we suppress the estimate then).
  const stakeReturn = principal + (estTermHex ?? 0);
  const penalty = latePenaltyStatus(endDay, currentDay, stakeReturn);
  const penaltyUsd = hexUsd != null ? penalty.penaltyHex * hexUsd : null;
  const showBleeding = penalty.isBleeding && !gaInfo;

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--text)]">Stake #{stake.stakeId}</span>
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${status.cls}`}>{status.icon}{status.label}{stake.isAutoStake ? ' · auto' : ''}</span>
      </div>

      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">Principal</div>
          <HexAmount hex={principal} className="text-lg font-semibold text-[var(--text)]" />
          {usd != null && <div className="text-xs text-[var(--text-muted)] tabular-nums">{fmtUsdShort(usd)}</div>}
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">T-Shares</div>
          <div className="text-lg font-semibold tabular-nums text-[var(--text)]">{fmtTShares(tShares)}</div>
          <div className="text-xs text-[var(--text-muted)] tabular-nums">{fmtDuration(stakedDays)} term</div>
        </div>
      </div>

      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-[var(--text-muted)] tabular-nums">Day {served.toLocaleString()} of {stakedDays.toLocaleString()}</span>
        <span className="font-semibold tabular-nums" style={{ color: barColor }}>{left.toLocaleString()} days left</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: locked ? HEX_GRADIENT : barColor }} />
      </div>

      {gaInfo && (
        <div className="mt-3 rounded-lg border border-cyan-500/30 bg-cyan-500/[0.06] px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300">
              Good-accounted · penalty frozen
            </span>
            <span className="text-[11px] font-semibold tabular-nums text-[var(--text-muted)]">
              {gaInfo.daysAfterMaturity.toLocaleString()}d after maturity
            </span>
          </div>

          {/* Frozen penalty fraction — does NOT grow (the stake stopped bleeding). */}
          <div className="mb-1 mt-2.5 flex items-center justify-between text-[10px] tabular-nums">
            <span className="text-cyan-300">{(gaInfo.fraction * 100).toFixed(1)}% penalty locked in</span>
            <span className="text-[var(--text-faint)]">frozen {gaDay != null ? fmtHexDate(gaDay) : fmtDateTime(ga!.timestamp)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div className="h-full rounded-full" style={{ width: `${gaInfo.fraction * 100}%`, background: '#06b6d4' }} />
          </div>

          <div className="mt-2.5 flex items-end justify-between gap-3">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">Still claimable</span>
            <span className="text-right">
              <HexAmount hex={gaInfo.claimableHex} className="text-sm font-semibold text-[var(--text)]" />
              <span className="block text-[10px] text-[var(--text-faint)] tabular-nums">
                penalty <HexAmount hex={gaInfo.penaltyHex} prefix="−" className="text-red-400" />
              </span>
            </span>
          </div>
        </div>
      )}

      {showBleeding && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400">
              <IconAlertTriangle className="h-3.5 w-3.5" />
              {penalty.fullyDepleted ? 'Fully bled out' : 'Bleeding out'}
            </span>
            <span className="text-[11px] font-semibold tabular-nums text-amber-300">
              {penalty.daysPastMaturity.toLocaleString()}d past maturity
              <span className="text-[var(--text-faint)]"> · {penalty.daysPastGrace.toLocaleString()}d past grace</span>
            </span>
          </div>

          {/* Bleed-out bar: fraction of the total return already lost to penalty. */}
          <div className="mb-1 mt-2.5 flex items-center justify-between text-[10px] tabular-nums">
            <span className="text-red-300">{(penalty.fraction * 100).toFixed(1)}% depleted</span>
            <span className="text-[var(--text-faint)]">
              {penalty.fullyDepleted
                ? 'depleted'
                : `${penalty.daysUntilDepleted.toLocaleString()} days until $0`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div
              className="h-full rounded-full transition-[width]"
              style={{ width: `${penalty.fraction * 100}%`, background: 'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)' }}
            />
          </div>

          {/* Penalty accrued so far, in HEX and USD. */}
          <div className="mt-2.5 flex items-end justify-between gap-3">
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">Penalty so far (est.)</span>
            <span className="text-right">
              <HexAmount hex={penalty.penaltyHex} prefix="−" className="text-sm font-semibold text-red-400" />
              {penaltyUsd != null && (
                <span className="block text-[10px] text-[var(--text-faint)] tabular-nums">−{fmtUsdShort(penaltyUsd)}</span>
              )}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-[var(--text-faint)]">
            Time-based estimate (not yet good-accounted){estTermHex == null ? ' · from principal only' : ''}.
          </div>
          {estTermHex == null && (
            <div className="mt-1 text-[10px] text-[var(--text-faint)]">Connect payout data for full return.</div>
          )}
        </div>
      )}

      {estEarnedHex != null && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs">
          <span className="text-[var(--text-muted)]">Est. yield so far</span>
          <span className="text-right">
            <HexAmount hex={estEarnedHex} prefix="+" className="font-semibold text-[var(--up)]" />
            {hexUsd != null && <span className="text-[var(--text-muted)]"> · {fmtUsdShort(estEarnedHex * hexUsd)}</span>}
            {estTermHex != null && (
              <span className="block text-[10px] text-[var(--text-faint)] tabular-nums">~<HexAmount hex={estTermHex} /> projected at maturity</span>
            )}
          </span>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--text-muted)] tabular-nums">
        <span>{fmtHexDate(startDay)} → {fmtHexDate(endDay)}</span>
        <ExplorerLink href={pulsechainTxUrl(stake.transactionHash)}>tx</ExplorerLink>
      </div>

      <DetailsToggle open={open} onClick={() => setOpen((o) => !o)} />

      {open && (
        <dl className="mt-3 space-y-1.5 border-t border-[var(--line)] pt-3">
          <DetailRow label="Stake ID" value={stake.stakeId} />
          <DetailRow label="Principal" value={<><HexAmount hex={principal} />{usd != null ? ` · ${fmtUsdShort(usd)}` : ''}</>} />
          <DetailRow label="Principal (hearts)" value={stake.stakedHearts} mono />
          <DetailRow label="T-Shares" value={fmtTShares(tShares)} />
          <DetailRow label="Shares (raw)" value={stake.stakeShares} mono />
          <DetailRow label="Committed term" value={`${stakedDays.toLocaleString()} days`} />
          <DetailRow label="Start HEX day" value={startDay.toLocaleString()} />
          <DetailRow label="End HEX day" value={endDay.toLocaleString()} />
          <DetailRow label="Start date" value={fmtHexDate(startDay)} />
          <DetailRow label="End date" value={fmtHexDate(endDay)} />
          <DetailRow label="Staked on" value={fmtDateTime(stake.timestamp)} />
          <DetailRow label="Days served" value={served.toLocaleString()} />
          <DetailRow label="Days left" value={left.toLocaleString()} />
          <DetailRow label="Progress" value={`${pct.toFixed(1)}%`} />
          {gaInfo && (
            <>
              <DetailRow label="Good-accounted" value={gaDay != null ? `${fmtHexDate(gaDay)} · day ${gaDay.toLocaleString()}` : fmtDateTime(ga!.timestamp)} />
              <DetailRow label="Days after maturity" value={gaInfo.daysAfterMaturity.toLocaleString()} />
              <DetailRow label="Penalty (frozen)" value={<><HexAmount hex={gaInfo.penaltyHex} prefix="−" /> · {(gaInfo.fraction * 100).toFixed(1)}%</>} />
              <DetailRow label="Still claimable" value={<HexAmount hex={gaInfo.claimableHex} />} />
            </>
          )}
          {showBleeding && (
            <>
              <DetailRow label="Days past maturity" value={penalty.daysPastMaturity.toLocaleString()} />
              <DetailRow label="Days past grace" value={`${penalty.daysPastGrace.toLocaleString()} (of ${LATE_PENALTY_SCALE_DAYS.toLocaleString()})`} />
              <DetailRow label="Penalty so far (est.)" value={<><HexAmount hex={penalty.penaltyHex} prefix="−" />{penaltyUsd != null ? ` · −${fmtUsdShort(penaltyUsd)}` : ''}</>} />
              <DetailRow label="Depleted (est.)" value={`${(penalty.fraction * 100).toFixed(1)}%`} />
              <DetailRow label="Days until fully bled out" value={penalty.fullyDepleted ? 'Fully depleted' : penalty.daysUntilDepleted.toLocaleString()} />
            </>
          )}
          <DetailRow label="Auto-stake" value={stake.isAutoStake ? 'Yes' : 'No'} />
          <DetailRow label="Staker" value={<ExplorerLink href={pulsechainAddressUrl(stake.stakerAddr)}>{shortHash(stake.stakerAddr)}</ExplorerLink>} mono />
          <DetailRow label="Tx hash" value={<ExplorerLink href={pulsechainTxUrl(stake.transactionHash)}>{shortHash(stake.transactionHash)}</ExplorerLink>} mono />
          <DetailRow label="Block" value={stake.blockNumber} />
          <DetailRow label="Network" value={stake.network} />
        </dl>
      )}
    </div>
  );
}

function EndedStakeRow({ end, start, hexUsd }: { end: PulseChainHexStakeEnd; start: PulseChainHexStake | null; hexUsd?: number | null }) {
  const [open, setOpen] = useState(false);
  const principal = heartsToHex(end.stakedHearts);
  const payout = heartsToHex(end.payout);
  const penalty = heartsToHex(end.penalty);
  const net = payout - penalty;
  const roi = principal > 0 ? (net / principal) * 100 : 0;
  const served = Number(end.servedDays);
  const committed = start ? Number(start.stakedDays) : null;
  const fullTerm = committed != null ? served >= committed : null;
  const usd = hexUsd != null ? payout * hexUsd : null;
  const startDay = start ? Number(start.startDay) : null;

  // Completion status for the history progress bar:
  //  • early  — ended before the committed term (emergency end) → red, "Nd early"
  //  • late   — served past term with a late penalty             → red, "Nd late"
  //  • ontime — full term within the penalty-free grace          → green, "On time"
  let endStatus: 'ontime' | 'early' | 'late' | 'unknown' = 'unknown';
  let deltaDays = 0;
  if (committed != null) {
    if (served < committed) {
      endStatus = 'early';
      deltaDays = committed - served;
    } else if (penalty > 0) {
      endStatus = 'late';
      deltaDays = served - committed;
    } else {
      endStatus = 'ontime';
    }
  }
  const barPct = committed && committed > 0 ? Math.min(100, (served / committed) * 100) : 100;
  const barColor =
    endStatus === 'ontime' ? '#22c55e' : endStatus === 'unknown' ? '#6b7280' : '#ef4444';
  const statusLabel =
    endStatus === 'early'
      ? `${deltaDays.toLocaleString()}d early`
      : endStatus === 'late'
        ? `${deltaDays.toLocaleString()}d late`
        : endStatus === 'ontime'
          ? 'On time'
          : 'Ended';

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text)]">
            Stake #{end.stakeId}
            <span className="text-[10px] font-normal text-[var(--text-faint)]">· ended</span>
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--text-muted)] tabular-nums">
            Served {served.toLocaleString()}{committed != null ? ` / ${committed.toLocaleString()}` : ''} days
            {fullTerm === true ? ' · full term' : fullTerm === false ? ' · early' : ''}
            {' · '}{fmtHexDate(Number(start?.startDay ?? 0))} → {new Date(Number(end.timestamp) * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-sm font-semibold tabular-nums ${roi >= 0 ? 'text-[var(--up)]' : 'text-red-400'}`}>{roi >= 0 ? '+' : ''}{roi.toFixed(1)}%</div>
          <div className="flex items-center justify-end gap-1 text-[11px] text-[var(--text-muted)] tabular-nums"><HexAmount hex={payout} prefix="+" />{usd != null ? ` · ${fmtUsdShort(usd)}` : ''}</div>
          {penalty > 0 && <div className="flex items-center justify-end gap-1 text-[11px] text-amber-300 tabular-nums"><HexAmount hex={penalty} prefix="−" /> penalty</div>}
        </div>
      </div>

      {/* Completion progress bar — green if ended on time, red if early/late. */}
      <div className="mb-1.5 mt-3 flex items-center justify-between text-xs">
        <span className="text-[var(--text-muted)] tabular-nums">
          Day {served.toLocaleString()}{committed != null ? ` of ${committed.toLocaleString()}` : ''}
        </span>
        <span className="font-semibold tabular-nums" style={{ color: barColor }}>{statusLabel}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: barColor }} />
      </div>

      <DetailsToggle open={open} onClick={() => setOpen((o) => !o)} />

      {open && (
        <dl className="mt-3 space-y-1.5 border-t border-[var(--line)] pt-3">
          <DetailRow label="Stake ID" value={end.stakeId} />
          <DetailRow label="Principal" value={<HexAmount hex={principal} />} />
          <DetailRow label="Principal (hearts)" value={end.stakedHearts} mono />
          <DetailRow label="Payout" value={<><HexAmount hex={payout} prefix="+" />{usd != null ? ` · ${fmtUsdShort(usd)}` : ''}</>} />
          <DetailRow label="Payout (hearts)" value={end.payout} mono />
          <DetailRow label="Penalty" value={<HexAmount hex={penalty} prefix={penalty > 0 ? '−' : ''} />} />
          <DetailRow label="Penalty (hearts)" value={end.penalty} mono />
          <DetailRow label="Net yield" value={<HexAmount hex={Math.abs(net)} prefix={net >= 0 ? '+' : '−'} />} />
          <DetailRow label="ROI" value={`${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`} />
          <DetailRow label="Days served" value={served.toLocaleString()} />
          <DetailRow label="Committed term" value={committed != null ? `${committed.toLocaleString()} days` : '—'} />
          <DetailRow label="Completion" value={fullTerm === true ? 'Full term' : fullTerm === false ? 'Early end' : 'Unknown'} />
          <DetailRow label="Start HEX day" value={startDay != null ? startDay.toLocaleString() : '—'} />
          <DetailRow label="Start date" value={startDay != null ? fmtHexDate(startDay) : '—'} />
          <DetailRow label="Ended on" value={fmtDateTime(end.timestamp)} />
          <DetailRow label="Staker" value={<ExplorerLink href={pulsechainAddressUrl(end.stakerAddr)}>{shortHash(end.stakerAddr)}</ExplorerLink>} mono />
          <DetailRow label="Tx hash" value={<ExplorerLink href={pulsechainTxUrl(end.transactionHash)}>{shortHash(end.transactionHash)}</ExplorerLink>} mono />
          <DetailRow label="Block" value={end.blockNumber} />
          <DetailRow label="Network" value={end.network} />
        </dl>
      )}
    </div>
  );
}

export default HexStakes;
