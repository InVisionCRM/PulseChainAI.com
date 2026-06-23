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
} from '@/services/pulsechainHexStakingService';
import {
  heartsToHex, sharesToTShares, stakeProgress, currentHexDay,
  fmtDuration, fmtHex, fmtTShares, fmtHexDate, fmtUsdShort,
} from '@/lib/hex/hexDay';

const PLS_EXPLORER_TX = 'https://midgard.wtf/tx/';

// Brand accent gradient (orange → red → magenta) used across the stakes UI.
const HEX_GRADIENT = 'linear-gradient(135deg, #ff9e00 0%, #ff2e7e 52%, #ff00d4 100%)';
// Reusable "gradient text" style: paints the gradient and clips it to glyphs.
const gradText = {
  backgroundImage: HEX_GRADIENT,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
} as const;

const PLS_EXPLORER_ADDR = 'https://midgard.wtf/address/';

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
}

type Tab = 'active' | 'ended';

export function HexStakes({ address, hexUsd }: Props) {
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
      currentDay, usd, active, ended,
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
        <Metric label="Staked" value={`${fmtHex(view.activePrincipal)}`} sub={view.usd(view.activePrincipal) != null ? fmtUsdShort(view.usd(view.activePrincipal)) : 'HEX'} grad />
        <Metric label="T-Shares" value={fmtTShares(view.activeTShares)} sub={`${view.active.length} active`} grad />
        <Metric label="Avg length" value={fmtDuration(view.avgLenDays)} sub="locked" />
        <Metric label="Realized" value={`+${fmtHex(view.realizedYield)}`} sub={view.usd(view.realizedYield) != null ? fmtUsdShort(view.usd(view.realizedYield)) : 'HEX'} good />
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
            {view.active.map((s) => <ActiveStakeCard key={s.id} stake={s} currentDay={view.currentDay} hexUsd={hexUsd} />)}
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

function Metric({ label, value, sub, good, bad, grad }: { label: string; value: string; sub?: string; good?: boolean; bad?: boolean; grad?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="truncate text-[10px] font-medium uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div
        className={`mt-0.5 text-sm font-semibold tabular-nums ${grad ? '' : good ? 'text-[var(--up)]' : bad ? 'text-red-400' : 'text-[var(--text)]'}`}
        style={grad ? gradText : undefined}
      >{value}</div>
      {sub ? <div className="text-[10px] text-[var(--text-faint)] tabular-nums">{sub}</div> : null}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'text-white shadow-sm shadow-[#ff2e7e]/20' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
      style={active ? { backgroundImage: HEX_GRADIENT } : undefined}
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

function ActiveStakeCard({ stake, currentDay, hexUsd }: { stake: PulseChainHexStake; currentDay: number; hexUsd?: number | null }) {
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

  // Status: locked (pre-end), ready (in the 0..+14d grace), or late (penalties accrue past +14d).
  const past = currentDay - endDay;
  const status = currentDay < endDay
    ? { label: 'Locked', cls: 'text-[var(--text-faint)]', icon: <IconLock className="h-3 w-3" /> }
    : past <= 14
      ? { label: 'Ready to end', cls: 'text-[var(--up)]', icon: null }
      : { label: 'Late — penalty accruing', cls: 'text-amber-300', icon: <IconAlertTriangle className="h-3 w-3" /> };

  // Locked stakes get the brand gradient; ready/late keep their semantic colors.
  const locked = currentDay < endDay;
  const barColor = locked ? '#ff2e7e' : past <= 14 ? '#22c55e' : '#f59e0b';

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[var(--text)]">Stake #{stake.stakeId}</span>
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${status.cls}`}>{status.icon}{status.label}{stake.isAutoStake ? ' · auto' : ''}</span>
      </div>

      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">Principal</div>
          <div className="text-lg font-semibold tabular-nums" style={gradText}>{fmtHex(principal)} HEX</div>
          {usd != null && <div className="text-xs text-[var(--text-muted)] tabular-nums">{fmtUsdShort(usd)}</div>}
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">T-Shares</div>
          <div className="text-lg font-semibold tabular-nums" style={gradText}>{fmtTShares(tShares)}</div>
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

      <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--text-muted)] tabular-nums">
        <span>{fmtHexDate(startDay)} → {fmtHexDate(endDay)}</span>
        <ExplorerLink href={`${PLS_EXPLORER_TX}${stake.transactionHash}`}>tx</ExplorerLink>
      </div>

      <DetailsToggle open={open} onClick={() => setOpen((o) => !o)} />

      {open && (
        <dl className="mt-3 space-y-1.5 border-t border-[var(--line)] pt-3">
          <DetailRow label="Stake ID" value={stake.stakeId} />
          <DetailRow label="Principal" value={`${fmtHex(principal)} HEX${usd != null ? ` · ${fmtUsdShort(usd)}` : ''}`} />
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
          <DetailRow label="Auto-stake" value={stake.isAutoStake ? 'Yes' : 'No'} />
          <DetailRow label="Staker" value={<ExplorerLink href={`${PLS_EXPLORER_ADDR}${stake.stakerAddr}`}>{shortHash(stake.stakerAddr)}</ExplorerLink>} mono />
          <DetailRow label="Tx hash" value={<ExplorerLink href={`${PLS_EXPLORER_TX}${stake.transactionHash}`}>{shortHash(stake.transactionHash)}</ExplorerLink>} mono />
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
          <div className="text-[11px] text-[var(--text-muted)] tabular-nums">+{fmtHex(payout)} HEX{usd != null ? ` · ${fmtUsdShort(usd)}` : ''}</div>
          {penalty > 0 && <div className="text-[11px] text-amber-300 tabular-nums">−{fmtHex(penalty)} penalty</div>}
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
          <DetailRow label="Principal" value={`${fmtHex(principal)} HEX`} />
          <DetailRow label="Principal (hearts)" value={end.stakedHearts} mono />
          <DetailRow label="Payout" value={`${fmtHex(payout)} HEX${usd != null ? ` · ${fmtUsdShort(usd)}` : ''}`} />
          <DetailRow label="Payout (hearts)" value={end.payout} mono />
          <DetailRow label="Penalty" value={`${fmtHex(penalty)} HEX`} />
          <DetailRow label="Penalty (hearts)" value={end.penalty} mono />
          <DetailRow label="Net yield" value={`${net >= 0 ? '+' : ''}${fmtHex(net)} HEX`} />
          <DetailRow label="ROI" value={`${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`} />
          <DetailRow label="Days served" value={served.toLocaleString()} />
          <DetailRow label="Committed term" value={committed != null ? `${committed.toLocaleString()} days` : '—'} />
          <DetailRow label="Completion" value={fullTerm === true ? 'Full term' : fullTerm === false ? 'Early end' : 'Unknown'} />
          <DetailRow label="Start HEX day" value={startDay != null ? startDay.toLocaleString() : '—'} />
          <DetailRow label="Start date" value={startDay != null ? fmtHexDate(startDay) : '—'} />
          <DetailRow label="Ended on" value={fmtDateTime(end.timestamp)} />
          <DetailRow label="Staker" value={<ExplorerLink href={`${PLS_EXPLORER_ADDR}${end.stakerAddr}`}>{shortHash(end.stakerAddr)}</ExplorerLink>} mono />
          <DetailRow label="Tx hash" value={<ExplorerLink href={`${PLS_EXPLORER_TX}${end.transactionHash}`}>{shortHash(end.transactionHash)}</ExplorerLink>} mono />
          <DetailRow label="Block" value={end.blockNumber} />
          <DetailRow label="Network" value={end.network} />
        </dl>
      )}
    </div>
  );
}

export default HexStakes;
