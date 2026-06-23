'use client';

// HEX Whale Unlock Radar — big stakes (≥WHALE_MIN_HEX) ending in the next 30 days,
// with a behavior-based sell-vs-restake read per whale, an aggregate
// sell-pressure forecast, and an unlock calendar. Per-whale drill-down reuses
// the existing HexStakes (history) and ActivityFeed (HEX activity) components.

import { useEffect, useState } from 'react';
import { IconRadar2, IconRefresh, IconChevronDown, IconArrowsExchange, IconCashBanknote, IconQuestionMark, IconShieldCheck } from '@tabler/icons-react';
import { type Network, type Rates, loadRates } from '@/lib/hex/strategistData';
import type { WhaleRadarData, WhaleStake, WhaleBias } from '@/lib/hex/whaleRadar';
import { WHALE_MIN_HEX } from '@/lib/hex/whaleRadar';
import { fmtHex, fmtTShares, fmtUsdShort, fmtDuration, HEX_ADDRESS } from '@/lib/hex/hexDay';
import { HexStakes } from '@/components/portfolio/HexStakes';
import { ActivityFeed } from '@/components/portfolio/ActivityFeed';

const BIAS: Record<WhaleBias, { color: string; label: string; icon: React.ReactNode }> = {
  restake: { color: '#22c55e', label: 'Likely re-stake', icon: <IconArrowsExchange className="h-3.5 w-3.5" /> },
  sell: { color: '#ef4444', label: 'Likely sell', icon: <IconCashBanknote className="h-3.5 w-3.5" /> },
  mixed: { color: '#f59e0b', label: 'Mixed history', icon: <IconArrowsExchange className="h-3.5 w-3.5" /> },
  unknown: { color: '#8b98a5', label: 'No history', icon: <IconQuestionMark className="h-3.5 w-3.5" /> },
};

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function WhaleRadar({ net }: { net: Network }) {
  const [data, setData] = useState<WhaleRadarData | null>(null);
  const [rates, setRates] = useState<Rates | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    Promise.all([
      fetch(`/api/hex/whale-unlocks?network=${net}`).then((r) => (r.ok ? r.json() : Promise.reject())),
      loadRates(net).catch(() => null),
    ])
      .then(([d, r]) => {
        if (!alive) return;
        setData(d);
        setRates(r);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
    };
  }, [net, reload]);

  const usd = (hex: number) => (rates?.priceUsd ? hex * rates.priceUsd : 0);
  const hasPrice = !!rates?.priceUsd;

  if (status === 'loading') {
    return (
      <div className="grid place-items-center py-20 text-sm text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-2"><IconRefresh className="h-4 w-4 animate-spin" /> Scanning for whale unlocks…</span>
      </div>
    );
  }
  if (status === 'error' || !data) {
    return (
      <div className="py-20 text-center text-sm text-red-300">
        Couldn’t load the radar.
        <button onClick={() => setReload((n) => n + 1)} className="ml-2 underline">retry</button>
      </div>
    );
  }
  if (data.stakes.length === 0) {
    return <div className="py-16 text-center text-sm text-[var(--text-faint)]">No ≥{(WHALE_MIN_HEX / 1e6).toFixed(0)}M HEX stakes ending in the next 30 days on {net}.</div>;
  }

  const sellPct = data.totalEndingHex > 0 ? (data.estSellHex / data.totalEndingHex) * 100 : 0;
  const maxDayHex = Math.max(...data.calendar.map((c) => c.hex), 1);

  return (
    <div className="space-y-4">
      {/* Aggregate forecast */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Whales ending (30d)" value={String(data.stakes.length)} />
        <Stat label="HEX unlocking" value={`${fmtHex(data.totalEndingHex)}`} sub={hasPrice ? fmtUsdShort(usd(data.totalEndingHex)) : undefined} />
        <Stat label="Est. sell pressure" value={hasPrice ? fmtUsdShort(usd(data.estSellHex)) : `${fmtHex(data.estSellHex)} HEX`} accent="#ef4444" />
        <Stat label="Behavior-weighted sell" value={`${sellPct.toFixed(0)}%`} accent={sellPct >= 50 ? '#ef4444' : '#22c55e'} />
      </div>

      {/* Trust panel — how well the sell/re-stake signal backtests */}
      <RadarTrust net={net} />

      {/* Unlock calendar */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
          <IconRadar2 className="h-4 w-4 text-cyan-400" /> Unlock calendar — next 30 days
        </div>
        <div className="flex items-end gap-1 overflow-x-auto pb-1">
          {data.calendar.map((c) => (
            <div key={c.day} className="flex min-w-[34px] flex-1 flex-col items-center gap-1" title={`${fmtHex(c.hex)} HEX · ${c.count} stake(s)`}>
              <div className="text-[9px] text-[var(--text-faint)] tabular-nums">{fmtHex(c.hex)}</div>
              <div className="flex h-24 w-full items-end">
                <div className="w-full rounded-t bg-gradient-to-t from-cyan-600/40 to-cyan-400" style={{ height: `${Math.max(4, (c.hex / maxDayHex) * 100)}%` }} />
              </div>
              <div className="text-[9px] text-[var(--text-muted)] tabular-nums">{fmtDate(c.dateMs)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Whale list */}
      <div className="space-y-2">
        {data.stakes.map((s) => <WhaleRow key={s.stakeId} s={s} net={net} usd={usd} hasPrice={hasPrice} hexUsd={rates?.priceUsd ?? null} payoutPerTShare={rates?.dailyPayoutPerTShare ?? null} />)}
      </div>

      <p className="px-1 text-[10px] leading-relaxed text-[var(--text-faint)]">
        Sell-vs-re-stake is a <span className="text-[var(--text-muted)]">behavioral probability</span> from each wallet’s own
        history — how often it started a new stake within ~14 days of a past stake-end. “No history” wallets are weighted at
        50% in the aggregate. A whale can always surprise you.
      </p>
    </div>
  );
}

function WhaleRow({ s, net, usd, hasPrice, hexUsd, payoutPerTShare }: { s: WhaleStake; net: Network; usd: (h: number) => number; hasPrice: boolean; hexUsd: number | null; payoutPerTShare: number | null }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'stakes' | 'activity'>('stakes');
  const b = BIAS[s.bias];

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-3 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-[var(--text)]">{shortAddr(s.stakerAddr)}</span>
            <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: b.color, borderColor: `${b.color}55` }}>
              {b.icon}{b.label}{s.priorEnds > 0 ? ` · ${(s.restakeRate! * 100).toFixed(0)}% re-stake` : ''}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--text-muted)] tabular-nums">
            {fmtHex(s.principalHex)} HEX{hasPrice ? ` · ${fmtUsdShort(usd(s.principalHex))}` : ''} · {fmtTShares(s.tShares)} T · ends in {fmtDuration(s.daysToEnd)}
          </div>
        </div>
        <IconChevronDown className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-[var(--line)] p-3">
          <div className="mb-3 inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-0.5">
            <button onClick={() => setTab('stakes')} className={`rounded-md px-3 py-1 text-xs font-semibold ${tab === 'stakes' ? 'bg-[var(--surface)] text-orange-300' : 'text-[var(--text-muted)]'}`}>Stake history</button>
            <button onClick={() => setTab('activity')} className={`rounded-md px-3 py-1 text-xs font-semibold ${tab === 'activity' ? 'bg-[var(--surface)] text-orange-300' : 'text-[var(--text-muted)]'}`}>HEX activity</button>
          </div>
          {tab === 'stakes'
            ? <HexStakes address={s.stakerAddr} hexUsd={hexUsd} payoutPerTShare={payoutPerTShare} />
            : <ActivityFeed walletAddress={s.stakerAddr} chains={[net]} tokenAddress={HEX_ADDRESS} />}
        </div>
      )}
    </div>
  );
}

interface Backtest {
  scored: number;
  unknown: number;
  censored: number;
  baseRestakeRate: number;
  accuracy: number;
  lift: number;
  restakeCalls: number;
  restakePrecision: number;
  sellCalls: number;
  sellPrecision: number;
}

// Replays the sell/re-stake signal over historical ends so the user can judge
// whether to trust it — accuracy vs. the naive base rate, plus per-call precision.
function RadarTrust({ net }: { net: Network }) {
  const [bt, setBt] = useState<Backtest | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    fetch(`/api/hex/radar-backtest?network=${net}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Backtest) => {
        if (!alive) return;
        setBt(d);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => {
      alive = false;
    };
  }, [net]);

  const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

  return (
    <details className="group rounded-2xl border border-[var(--line)] bg-[var(--surface)] open:bg-[var(--surface)]">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-semibold text-[var(--text)]">
        <IconShieldCheck className="h-4 w-4 text-emerald-400" />
        How trustworthy is this call?
        {status === 'ready' && bt && bt.scored > 0 && (
          <span className="ml-1 rounded-full border border-emerald-500/40 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
            {pct(bt.accuracy)} accurate
          </span>
        )}
        <IconChevronDown className="ml-auto h-4 w-4 text-[var(--text-muted)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-[var(--line)] p-3">
        {status === 'loading' && (
          <div className="flex items-center gap-2 py-4 text-xs text-[var(--text-muted)]">
            <IconRefresh className="h-3.5 w-3.5 animate-spin" /> Replaying the signal over past stake-ends…
          </div>
        )}
        {status === 'error' && <div className="py-4 text-xs text-red-300">Couldn’t run the backtest right now.</div>}
        {status === 'ready' && bt && (bt.scored === 0 ? (
          <div className="py-4 text-xs text-[var(--text-faint)]">Not enough observable history on {net} to backtest yet.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Accuracy" value={pct(bt.accuracy)} accent="#34d399" sub={`${bt.scored.toLocaleString()} ends`} />
              <Stat
                label="Edge vs. base rate"
                value={`${bt.lift >= 0 ? '+' : ''}${(bt.lift * 100).toFixed(0)}pt`}
                accent={bt.lift > 0 ? '#34d399' : '#ef4444'}
                sub={`base ${pct(bt.baseRestakeRate)} re-stake`}
              />
              <Stat label="“Re-stake” calls right" value={pct(bt.restakePrecision)} sub={`${bt.restakeCalls.toLocaleString()} calls`} />
              <Stat label="“Sell” calls right" value={pct(bt.sellPrecision)} sub={`${bt.sellCalls.toLocaleString()} calls`} />
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-faint)]">
              For each past stake-end we re-built the prediction from only that wallet’s <em>earlier</em> ends, then checked
              whether it really started a new stake within 14 days. “Edge vs. base rate” is how much the signal beats simply
              guessing the majority outcome every time — positive means the behavioral read adds real information. Ends with no
              prior history ({bt.unknown.toLocaleString()}) or whose window runs past our data ({bt.censored.toLocaleString()})
              are excluded.
            </p>
          </>
        ))}
      </div>
    </details>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="truncate text-[10px] uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div className="mt-0.5 text-base font-bold tabular-nums" style={{ color: accent ?? 'var(--text)' }}>{value}</div>
      {sub && <div className="text-[10px] text-[var(--text-muted)] tabular-nums">{sub}</div>}
    </div>
  );
}
