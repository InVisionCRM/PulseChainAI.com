'use client';

// HEX Whale Unlock Radar — big stakes (≥WHALE_MIN_HEX) ending in the next 30 days,
// with a behavior-based sell-vs-restake read per whale, an aggregate
// sell-pressure forecast, and an unlock calendar. Per-whale drill-down reuses
// the existing HexStakes (history) and ActivityFeed (HEX activity) components.

import { useEffect, useState } from 'react';
import { IconRadar2, IconRefresh, IconChevronDown, IconArrowsExchange, IconCashBanknote, IconQuestionMark, IconShieldCheck, IconExternalLink, IconArrowRight } from '@tabler/icons-react';
import { type Network, type Rates, loadRates } from '@/lib/hex/strategistData';
import type { WhaleRadarData, WhaleStake, WhaleBias } from '@/lib/hex/whaleRadar';
import type { EndBehavior, BehaviorSummary } from '@/lib/hex/whaleBehavior';
import { WHALE_MIN_HEX } from '@/lib/hex/whaleRadar';
import { fmtHex, fmtTShares, fmtUsdShort, fmtDuration, HEX_ADDRESS } from '@/lib/hex/hexDay';
import { HexAmount, HexUnit } from '@/components/hex/HexAmount';
import { HexStakes } from '@/components/portfolio/HexStakes';
import { ActivityFeed } from '@/components/portfolio/ActivityFeed';

const BIAS: Record<WhaleBias, { color: string; label: string; icon: React.ReactNode }> = {
  restake: { color: '#22c55e', label: 'Likely re-stake', icon: <IconArrowsExchange className="h-3.5 w-3.5" /> },
  sell: { color: '#ef4444', label: 'Likely sell', icon: <IconCashBanknote className="h-3.5 w-3.5" /> },
  mixed: { color: '#f59e0b', label: 'Mixed history', icon: <IconArrowsExchange className="h-3.5 w-3.5" /> },
  unknown: { color: '#8b98a5', label: 'No history', icon: <IconQuestionMark className="h-3.5 w-3.5" /> },
};

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtDateY = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const txUrl = (net: Network, tx: string) =>
  net === 'ethereum' ? `https://etherscan.io/tx/${tx}` : `https://midgard.wtf/tx/${tx}`;

export default function WhaleRadar({ net }: { net: Network }) {
  const [data, setData] = useState<WhaleRadarData | null>(null);
  const [rates, setRates] = useState<Rates | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    setErrMsg(null);
    Promise.all([
      fetch(`/api/hex/whale-unlocks?network=${net}`).then(async (r) => {
        if (r.ok) return r.json();
        const j = await r.json().catch(() => null);
        throw new Error(j?.error || `HTTP ${r.status}`);
      }),
      loadRates(net).catch(() => null),
    ])
      .then(([d, r]) => {
        if (!alive) return;
        setData(d);
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
        {errMsg && <div className="mt-2 text-xs text-[var(--text-faint)]">{errMsg}</div>}
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
        <Stat label="HEX unlocking" value={fmtHex(data.totalEndingHex)} hex sub={hasPrice ? fmtUsdShort(usd(data.totalEndingHex)) : undefined} />
        <Stat label="Est. sell pressure" value={hasPrice ? fmtUsdShort(usd(data.estSellHex)) : fmtHex(data.estSellHex)} hex={!hasPrice} accent="#ef4444" />
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
        The badge on each whale is a <span className="text-[var(--text-muted)]">quick heuristic</span> from re-stake history (how
        often it started a new stake within ~14 days of a past end). For the real picture, tap any whale →{' '}
        <span className="text-[var(--text-muted)]">“Why this rating”</span>: it reads on-chain activity and classifies each past
        stake-end as <span className="text-[#22c55e]">re-staked</span>, <span className="text-[#ef4444]">sold</span> (with the amount
        actually swapped out), or <span className="text-[var(--text-muted)]">held</span> — not assuming a sale just because they
        didn’t re-stake. A whale can always surprise you.
      </p>
    </div>
  );
}

function WhaleRow({ s, net, usd, hasPrice, hexUsd, payoutPerTShare }: { s: WhaleStake; net: Network; usd: (h: number) => number; hasPrice: boolean; hexUsd: number | null; payoutPerTShare: number | null }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'why' | 'stakes' | 'activity'>('why');
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
          <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[11px] text-[var(--text-muted)] tabular-nums">
            <HexAmount hex={s.principalHex} />{hasPrice ? ` · ${fmtUsdShort(usd(s.principalHex))}` : ''} · {fmtTShares(s.tShares)} T · ends in {fmtDuration(s.daysToEnd)}
          </div>
        </div>
        <IconChevronDown className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-[var(--line)] p-3">
          <div className="mb-3 inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-0.5">
            <button onClick={() => setTab('why')} className={`rounded-md px-3 py-1 text-xs font-semibold ${tab === 'why' ? 'bg-[var(--surface)] text-orange-300' : 'text-[var(--text-muted)]'}`}>Why this rating</button>
            <button onClick={() => setTab('stakes')} className={`rounded-md px-3 py-1 text-xs font-semibold ${tab === 'stakes' ? 'bg-[var(--surface)] text-orange-300' : 'text-[var(--text-muted)]'}`}>Stake history</button>
            <button onClick={() => setTab('activity')} className={`rounded-md px-3 py-1 text-xs font-semibold ${tab === 'activity' ? 'bg-[var(--surface)] text-orange-300' : 'text-[var(--text-muted)]'}`}>HEX activity</button>
          </div>
          {tab === 'why'
            ? <RatingEvidence s={s} net={net} />
            : tab === 'stakes'
              ? <HexStakes address={s.stakerAddr} hexUsd={hexUsd} payoutPerTShare={payoutPerTShare} />
              : <ActivityFeed walletAddress={s.stakerAddr} chains={[net]} tokenAddress={HEX_ADDRESS} />}
        </div>
      )}
    </div>
  );
}

interface BehaviorResponse {
  address: string;
  network: string;
  oldestActivityTs: number | null;
  behavior: EndBehavior[];
  summary: BehaviorSummary;
}

// The evidence behind a whale's rating, from REAL on-chain activity: for each
// past stake-end we check the staking subgraph for a re-stake and the wallet's
// HEX swaps for a sale, and classify each as re-staked / sold / held / unknown —
// no longer assuming "didn't re-stake" means "sold". Fetched on demand.
function RatingEvidence({ s, net }: { s: WhaleStake; net: Network }) {
  const [data, setData] = useState<BehaviorResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    setErr(null);
    fetch(`/api/hex/whale-behavior?network=${net}&address=${s.stakerAddr}`)
      .then(async (r) => {
        if (r.ok) return r.json();
        throw new Error((await r.json().catch(() => null))?.error || `HTTP ${r.status}`);
      })
      .then((d: BehaviorResponse) => {
        if (!alive) return;
        setData(d);
        setStatus('ready');
      })
      .catch((e) => {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : null);
        setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, [s.stakerAddr, net]);

  if (status === 'loading') {
    return (
      <div className="py-6 text-center text-xs text-[var(--text-muted)]">
        <IconRefresh className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Reading on-chain re-stake &amp; sale activity…
      </div>
    );
  }
  if (status === 'error' || !data) {
    return <div className="py-6 text-center text-xs text-red-300">Couldn’t load activity{err ? `: ${err}` : ''}.</div>;
  }

  const sum = data.summary;
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-xs leading-relaxed text-[var(--text-muted)]">
        {sum.total === 0 ? (
          'No past stake-ends on record for this wallet yet — nothing to judge behaviour from.'
        ) : (
          <>
            Across this wallet’s last <span className="font-semibold text-[var(--text)]">{sum.total}</span> stake-end{sum.total === 1 ? '' : 's'}:{' '}
            <span className="font-semibold text-[#22c55e]">{sum.restaked} re-staked</span>,{' '}
            <span className="font-semibold text-[#ef4444]">{sum.sold} sold</span>
            {sum.soldHex > 0 ? <> (~{fmtHex(sum.soldHex)} HEX{sum.soldUsd > 0 ? ` · ${fmtUsdShort(sum.soldUsd)}` : ''})</> : null},{' '}
            <span className="font-semibold text-[var(--text)]">{sum.held} held</span>
            {sum.unknown > 0 ? <>, <span className="text-[var(--text-faint)]">{sum.unknown} unknown</span></> : null}. Sale = HEX
            swapped out within 30 days of the end; re-stake = new stake within 14 days; “held” = did neither; “unknown” = no swap
            data that far back.
          </>
        )}
      </div>

      {data.behavior.length > 0 && (
        <div className="space-y-1.5">
          <div className="px-1 text-[10px] uppercase tracking-wider text-[var(--text-faint)]">Past stake-ends · newest first</div>
          {data.behavior.map((e) => <BehaviorRow key={e.endStakeId} e={e} net={net} />)}
        </div>
      )}
    </div>
  );
}

function TxLink({ net, tx, label }: { net: Network; tx: string; label: string }) {
  return (
    <a href={txUrl(net, tx)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-normal text-[var(--text-faint)] hover:text-orange-300" title={`${label} transaction`}>
      {label}<IconExternalLink className="h-2.5 w-2.5" />
    </a>
  );
}

function BehaviorRow({ e, net }: { e: EndBehavior; net: Network }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[11px]">
      <span className="inline-flex items-center gap-1 text-[var(--text-muted)] tabular-nums">
        Ended {fmtDateY(e.endTimestamp * 1000)} · <HexAmount hex={e.endHex} />
      </span>
      {e.endTx && <TxLink net={net} tx={e.endTx} label="end tx" />}
      <IconArrowRight className="h-3 w-3 shrink-0 text-[var(--text-faint)]" />

      {e.outcome === 'restaked' ? (
        <span className="inline-flex flex-wrap items-center gap-1.5 font-semibold text-[#22c55e]">
          <span className="inline-flex items-center gap-1">re-staked {e.daysAfter}d later{e.restakeHex != null ? <> · <HexAmount hex={e.restakeHex} /></> : null}</span>
          {e.restakeTx && <TxLink net={net} tx={e.restakeTx} label="tx" />}
          {e.soldHex > 0 && (
            <span className="inline-flex items-center gap-1 font-normal text-[#ef4444]">· also sold <HexAmount hex={e.soldHex} /></span>
          )}
        </span>
      ) : e.outcome === 'sold' ? (
        <span className="inline-flex flex-wrap items-center gap-1.5 font-semibold text-[#ef4444]">
          <span className="inline-flex items-center gap-1">
            sold <HexAmount hex={e.soldHex} />{e.soldUsd > 0 ? ` · ${fmtUsdShort(e.soldUsd)}` : ''}
            {e.sellCount > 1 ? ` · ${e.sellCount} swaps` : ''}{e.daysToSell != null ? ` · ${e.daysToSell}d later` : ''}
          </span>
          {e.firstSellTx && <TxLink net={net} tx={e.firstSellTx} label="tx" />}
        </span>
      ) : e.outcome === 'held' ? (
        <span className="font-semibold text-[var(--text-muted)]">held — no re-stake or HEX sale within the window</span>
      ) : (
        <span className="text-[var(--text-faint)]">no re-stake · sale activity not available this far back</span>
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

function Stat({ label, value, sub, accent, hex }: { label: string; value: string; sub?: string; accent?: string; hex?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="truncate text-[10px] uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div className="mt-0.5 flex items-center gap-1 text-base font-bold tabular-nums" style={{ color: accent ?? 'var(--text)' }}>
        {value}{hex && <HexUnit className="text-[0.7em] font-semibold" />}
      </div>
      {sub && <div className="text-[10px] text-[var(--text-muted)] tabular-nums">{sub}</div>}
    </div>
  );
}
