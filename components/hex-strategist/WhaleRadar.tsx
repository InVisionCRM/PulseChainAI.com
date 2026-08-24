'use client';

// HEX Whale Unlock Radar — big stakes (≥WHALE_MIN_HEX) ending in the next 30
// days, with a behavior-based sell-vs-restake read per whale, an aggregate
// sell-pressure forecast, and an unlock calendar. Per-whale drill-down reuses
// the existing HexStakes (history) and ActivityFeed (HEX activity) components.
//
// Styled to the same standard as the other HEX surfaces: a molten hero, the
// shared Speedo dials, a Recharts calendar, Jost figures and Poppins labels.
//
// The three ratings are STATUS colors, not a categorical series: re-stake reads
// as good, sell as bad, mixed as caution. They come from the page's validated
// --viz tokens (teal / crimson / orange — checked for CVD separation in both
// themes) and every badge carries an icon and a word, so the rating is never
// color alone.

import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  IconRadar2, IconRefresh, IconChevronDown, IconArrowsExchange, IconCashBanknote,
  IconQuestionMark, IconShieldCheck, IconExternalLink, IconArrowRight,
} from '@tabler/icons-react';
import { type Network, type Rates, loadRates } from '@/lib/hex/strategistData';
import type { WhaleRadarData, WhaleStake, WhaleBias } from '@/lib/hex/whaleRadar';
import type { EndBehavior, BehaviorSummary } from '@/lib/hex/whaleBehavior';
import { WHALE_MIN_HEX } from '@/lib/hex/whaleRadar';
import { fmtHex, fmtTShares, fmtUsdShort, fmtDuration, HEX_ADDRESS } from '@/lib/hex/hexDay';
import { HexAmount, HexLogo } from '@/components/hex/HexAmount';
import { HeroNumber, Speedo } from '@/components/hex/Instruments';
import { HexStakes } from '@/components/portfolio/HexStakes';
import { ActivityFeed } from '@/components/portfolio/ActivityFeed';
import { pulsechainTxUrl } from '@/lib/pulsechainExplorer';

/** Rating → status color + word + icon. Never color alone. */
const BIAS: Record<WhaleBias, { color: string; label: string; icon: React.ReactNode }> = {
  restake: { color: 'var(--viz-gain)', label: 'Likely re-stake', icon: <IconArrowsExchange className="h-3.5 w-3.5" /> },
  sell: { color: 'var(--viz-loss)', label: 'Likely sell', icon: <IconCashBanknote className="h-3.5 w-3.5" /> },
  mixed: { color: 'var(--viz-a)', label: 'Mixed history', icon: <IconArrowsExchange className="h-3.5 w-3.5" /> },
  unknown: { color: 'var(--text-faint)', label: 'No history', icon: <IconQuestionMark className="h-3.5 w-3.5" /> },
};

/** Outcome → the same status colors, for the per-end evidence rows. */
const OUTCOME_COLOR = {
  restaked: 'var(--viz-gain)',
  sold: 'var(--viz-loss)',
  moved: 'var(--viz-a)',
  held: 'var(--text-muted)',
  unknown: 'var(--text-faint)',
} as const;

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtDateY = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const pct0 = (x: number) => `${Math.round(x * 100)}%`;
const txUrl = (net: Network, tx: string) =>
  net === 'ethereum' ? `https://etherscan.io/tx/${tx}` : pulsechainTxUrl(tx);

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

  /** The dial readings and the calendar series. Kept above the early returns —
   *  hooks cannot sit behind them. */
  const shape = useMemo(() => {
    const stakes = data?.stakes ?? [];
    const calendar = data?.calendar ?? [];
    const total = data?.totalEndingHex ?? 0;
    const restakers = stakes.filter((s) => s.bias === 'restake').length;
    let peak = { hex: 0, dateMs: 0, count: 0 };
    for (const c of calendar) if (c.hex > peak.hex) peak = { hex: c.hex, dateMs: c.dateMs, count: c.count };
    return {
      sellFrac: total > 0 ? (data?.estSellHex ?? 0) / total : 0,
      restakeFrac: stakes.length > 0 ? restakers / stakes.length : 0,
      restakers,
      peak,
      peakFrac: total > 0 ? peak.hex / total : 0,
      series: calendar.map((c) => ({ ts: c.dateMs, hex: c.hex, count: c.count })),
    };
  }, [data]);

  const usd = (hex: number) => (rates?.priceUsd ? hex * rates.priceUsd : 0);
  const hasPrice = !!rates?.priceUsd;

  if (status === 'loading') {
    return (
      <div className="grid place-items-center py-20">
        <span className="font-poppins inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <IconRefresh className="h-4 w-4 animate-spin" /> Scanning for whale unlocks…
        </span>
      </div>
    );
  }
  if (status === 'error' || !data) {
    return (
      <div className="py-20 text-center">
        <div className="font-jost text-[22px] font-bold text-[var(--text)]">Couldn’t load the radar</div>
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
  if (data.stakes.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="font-jost text-[22px] font-bold text-[var(--text)]">Nothing big is unlocking</div>
        <div className="font-poppins mt-2 text-[13px] text-[var(--text-muted)]">
          No stake of {(WHALE_MIN_HEX / 1e6).toFixed(0)}M HEX or more ends in the next 30 days on{' '}
          {net === 'ethereum' ? 'Ethereum' : 'PulseChain'}.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Hero: what is coming loose, and what it might do ── */}
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
          <span className="font-poppins inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
            <IconRadar2 className="h-3.5 w-3.5" />
            Stakes of {(WHALE_MIN_HEX / 1e6).toFixed(0)}M HEX or more ending in the next 30 days
          </span>
          <div className="mt-5 grid gap-6 sm:grid-cols-3 md:gap-8">
            <HeroNumber
              label="HEX unlocking"
              value={data.totalEndingHex}
              fmt="hex"
              sub={hasPrice ? `${fmtUsdShort(usd(data.totalEndingHex))} at today’s price` : undefined}
              gradient
            />
            <HeroNumber
              label="Whales ending"
              value={data.stakes.length}
              fmt="int"
              sub={`${shape.restakers} of them usually re-stake`}
            />
            <HeroNumber
              label="If they behave as before"
              text={hasPrice ? fmtUsdShort(usd(data.estSellHex)) : `${fmtHex(data.estSellHex)} HEX`}
              sub={`${fmtHex(data.estSellHex)} HEX could be sold`}
            />
          </div>
        </div>
      </div>

      {/* ── The three readings ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Speedo
          frac={shape.sellFrac}
          figure={pct0(shape.sellFrac)}
          label="Expected to be sold"
          sub="of the unlocking HEX, weighted by each whale’s own history"
          tone="b"
        />
        <Speedo
          frac={shape.restakeFrac}
          figure={pct0(shape.restakeFrac)}
          label="Rated likely to re-stake"
          sub={`${shape.restakers} of ${data.stakes.length} whales`}
          tone="a"
        />
        <Speedo
          frac={shape.peakFrac}
          figure={fmtHex(shape.peak.hex)}
          label="Heaviest single day"
          sub={shape.peak.dateMs ? `${fmtDate(shape.peak.dateMs)} · ${shape.peak.count} stake${shape.peak.count === 1 ? '' : 's'} · ${pct0(shape.peakFrac)} of the month` : '—'}
          tone="a"
        />
      </div>

      {/* ── Unlock calendar ── */}
      <div className="anim-rise rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 md:p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 px-1">
          <span className="font-jost text-[15px] font-bold text-[var(--text)]">When it comes loose — the next 30 days</span>
          <span className="font-poppins text-[11px] text-[var(--text-faint)]">
            peak {fmtHex(shape.peak.hex)} HEX on {shape.peak.dateMs ? fmtDate(shape.peak.dateMs) : '—'}
          </span>
        </div>
        <div className="h-[210px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={shape.series} margin={{ top: 8, right: 10, bottom: 0, left: 4 }}>
              <CartesianGrid stroke="var(--line-soft)" vertical={false} />
              <XAxis
                dataKey="ts"
                tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
                tickFormatter={(t) => fmtDate(Number(t))}
                stroke="var(--line)"
                minTickGap={24}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-faint)' }}
                tickFormatter={(v) => fmtHex(Number(v))}
                width={52}
                stroke="var(--line)"
              />
              <Tooltip content={<CalendarTooltip hasPrice={hasPrice} usd={usd} />} cursor={{ fill: 'var(--surface-3)' }} />
              <Bar dataKey="hex" fill="var(--viz-a)" radius={[4, 4, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── The whales ── */}
      <div className="anim-rise">
        <div className="font-poppins mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
          Every whale, biggest first
        </div>
        <div className="space-y-2">
          {data.stakes.map((s) => (
            <WhaleRow
              key={s.stakeId}
              s={s}
              net={net}
              usd={usd}
              hasPrice={hasPrice}
              hexUsd={rates?.priceUsd ?? null}
              payoutPerTShare={rates?.dailyPayoutPerTShare ?? null}
            />
          ))}
        </div>
      </div>

      {/* ── How well the call backtests ── */}
      <RadarTrust net={net} />

      <p className="font-poppins px-1 text-[10px] leading-relaxed text-[var(--text-faint)]">
        The badge is a quick read of how often a wallet re-staked within ~14 days of a past end. Open a whale for the real
        evidence — every past end classified from on-chain activity, not assumed.
      </p>
    </div>
  );
}

/** Value first, in the house tooltip. */
function CalendarTooltip({ active, payload, hasPrice, usd }: {
  active?: boolean;
  payload?: { payload: { ts: number; hex: number; count: number } }[];
  hasPrice?: boolean;
  usd?: (h: number) => number;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 shadow-xl">
      <div className="font-jost text-[22px] font-bold leading-none tabular-nums" style={{ color: 'var(--viz-a)' }}>
        {fmtHex(p.hex)}
      </div>
      <div className="font-poppins mt-1 text-[11px] text-[var(--text-muted)]">
        HEX unlocking · {p.count} stake{p.count === 1 ? '' : 's'}
      </div>
      <div className="font-poppins mt-0.5 text-[11px] text-[var(--text-faint)]">
        {fmtDateY(p.ts)}{hasPrice && usd ? ` · ${fmtUsdShort(usd(p.hex))}` : ''}
      </div>
    </div>
  );
}

function WhaleRow({ s, net, usd, hasPrice, hexUsd, payoutPerTShare }: {
  s: WhaleStake; net: Network; usd: (h: number) => number; hasPrice: boolean;
  hexUsd: number | null; payoutPerTShare: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'why' | 'stakes' | 'activity'>('why');
  const b = BIAS[s.bias];

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-3.5 text-left md:p-4">
        <div className="min-w-0 flex-1">
          {/* The stake itself is the headline — the address is the caption. */}
          <div className="font-jost flex items-baseline gap-2 text-[26px] font-bold leading-none tabular-nums text-[var(--text)]">
            <HexLogo className="h-5 w-5 shrink-0 self-center" />
            <span>{fmtHex(s.principalHex)}</span>
            {hasPrice && (
              <span className="font-poppins text-[13px] font-medium text-[var(--text-muted)]">
                {fmtUsdShort(usd(s.principalHex))}
              </span>
            )}
          </div>
          <div className="font-poppins mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--text-muted)] tabular-nums">
            <span className="font-mono text-[12px] text-[var(--text)]">{shortAddr(s.stakerAddr)}</span>
            <span className="text-[var(--text-faint)]">·</span>
            <span>{fmtTShares(s.tShares)} T-Shares</span>
            <span className="text-[var(--text-faint)]">·</span>
            <span>ends in {fmtDuration(s.daysToEnd)}</span>
          </div>
          <span
            className="font-poppins mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
            style={{ color: b.color, borderColor: `color-mix(in srgb, ${b.color} 45%, transparent)` }}
          >
            {b.icon}
            {b.label}
            {s.priorEnds > 0 ? ` · ${(s.restakeRate! * 100).toFixed(0)}% re-staked before` : ''}
          </span>
        </div>
        <IconChevronDown className={`h-5 w-5 shrink-0 text-[var(--text-faint)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-[var(--line)] p-3 md:p-4">
          <div className="mb-3 inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-0.5">
            {([['why', 'Why this rating'], ['stakes', 'Stake history'], ['activity', 'HEX activity']] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                aria-pressed={tab === k}
                className={`font-poppins rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  tab === k ? 'bg-[var(--surface)] text-[var(--viz-a)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'why'
            ? <RatingEvidence s={s} net={net} hexUsd={hexUsd} />
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
function RatingEvidence({ s, net, hexUsd }: { s: WhaleStake; net: Network; hexUsd: number | null }) {
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
      <div className="font-poppins py-6 text-center text-xs text-[var(--text-muted)]">
        <IconRefresh className="mr-1 inline h-3.5 w-3.5 animate-spin" /> Reading on-chain re-stake &amp; sale activity…
      </div>
    );
  }
  if (status === 'error' || !data) {
    return <div className="font-poppins py-6 text-center text-xs text-[var(--viz-loss)]">Couldn’t load activity{err ? `: ${err}` : ''}.</div>;
  }

  const sum = data.summary;
  const soldUsd = hexUsd ? sum.soldHex * hexUsd : 0;

  if (sum.total === 0) {
    return (
      <div className="font-poppins rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-3 text-[12px] text-[var(--text-muted)]">
        No past stake-ends on record for this wallet yet — nothing to judge behaviour from.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* What they did last time, as counts rather than a paragraph. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Count label="Re-staked" n={sum.restaked} of={sum.total} color={OUTCOME_COLOR.restaked} />
        <Count
          label="Sold"
          n={sum.sold}
          of={sum.total}
          color={OUTCOME_COLOR.sold}
          sub={sum.soldHex > 0 ? `${fmtHex(sum.soldHex)} HEX${soldUsd > 0 ? ` · ${fmtUsdShort(soldUsd)}` : ''}` : undefined}
        />
        <Count
          label="Moved out"
          n={sum.moved}
          of={sum.total}
          color={OUTCOME_COLOR.moved}
          sub={sum.movedHex > 0 ? `${fmtHex(sum.movedHex)} HEX` : undefined}
        />
        <Count label="Held" n={sum.held} of={sum.total} color={OUTCOME_COLOR.held} sub={sum.unknown > 0 ? `${sum.unknown} unknown` : undefined} />
      </div>

      <p className="font-poppins px-1 text-[10px] leading-relaxed text-[var(--text-faint)]">
        Sold = swapped out on a DEX within 30 days. Re-staked = a new stake within 14 days. Moved out = transferred, not sold.
      </p>

      {data.behavior.length > 0 && (
        <div className="space-y-1.5">
          <div className="font-poppins px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
            Past stake-ends · newest first
          </div>
          {data.behavior.map((e) => <BehaviorRow key={e.endStakeId} e={e} net={net} hexUsd={hexUsd} />)}
        </div>
      )}
    </div>
  );
}

/** One outcome count — the figure carries the color, the word carries the meaning. */
function Count({ label, n, of, color, sub }: { label: string; n: number; of: number; color: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5">
      <div className="font-poppins truncate text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div className="font-jost text-[26px] font-bold leading-none tabular-nums" style={{ color: n > 0 ? color : 'var(--text-faint)' }}>
        {n}
        <span className="text-[13px] text-[var(--text-faint)]">/{of}</span>
      </div>
      {sub && <div className="font-poppins mt-1 truncate text-[11px] text-[var(--text-muted)]">{sub}</div>}
    </div>
  );
}

function TxLink({ net, tx, label }: { net: Network; tx: string; label: string }) {
  return (
    <a
      href={txUrl(net, tx)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-0.5 font-normal text-[var(--text-faint)] hover:text-[var(--viz-a)]"
      title={`${label} transaction`}
    >
      {label}<IconExternalLink className="h-2.5 w-2.5" />
    </a>
  );
}

function BehaviorRow({ e, net, hexUsd }: { e: EndBehavior; net: Network; hexUsd: number | null }) {
  const soldUsd = hexUsd ? e.soldHex * hexUsd : 0;
  return (
    <div className="font-poppins flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[11.5px]">
      <span className="inline-flex items-center gap-1 text-[var(--text-muted)] tabular-nums">
        Ended {fmtDateY(e.endTimestamp * 1000)} · <HexAmount hex={e.endHex} />
      </span>
      {e.endTx && <TxLink net={net} tx={e.endTx} label="end tx" />}
      <IconArrowRight className="h-3 w-3 shrink-0 text-[var(--text-faint)]" />

      {e.outcome === 'restaked' ? (
        <span className="inline-flex flex-wrap items-center gap-1.5 font-semibold" style={{ color: OUTCOME_COLOR.restaked }}>
          <span className="inline-flex items-center gap-1">
            re-staked {e.daysAfter}d later{e.restakeHex != null ? <> · <HexAmount hex={e.restakeHex} /></> : null}
          </span>
          {e.restakeTx && <TxLink net={net} tx={e.restakeTx} label="tx" />}
          {e.soldHex > 0 && (
            <span className="inline-flex items-center gap-1 font-normal" style={{ color: OUTCOME_COLOR.sold }}>
              · also sold <HexAmount hex={e.soldHex} />
            </span>
          )}
        </span>
      ) : e.outcome === 'sold' ? (
        <span className="inline-flex flex-wrap items-center gap-1.5 font-semibold" style={{ color: OUTCOME_COLOR.sold }}>
          <span className="inline-flex items-center gap-1">
            sold <HexAmount hex={e.soldHex} />{soldUsd > 0 ? ` · ~${fmtUsdShort(soldUsd)}` : ''}
            {e.sellCount > 1 ? ` · ${e.sellCount} swaps` : ''}{e.daysToSell != null ? ` · ${e.daysToSell}d later` : ''}
          </span>
          {e.firstSellTx && <TxLink net={net} tx={e.firstSellTx} label="tx" />}
        </span>
      ) : e.outcome === 'moved' ? (
        <span className="inline-flex flex-wrap items-center gap-1.5 font-semibold" style={{ color: OUTCOME_COLOR.moved }}>
          <span className="inline-flex items-center gap-1">
            moved out <HexAmount hex={e.movedHex} />{e.daysToMove != null ? ` · ${e.daysToMove}d later` : ''}{' '}
            <span className="font-normal text-[var(--text-faint)]">(transfer, not a DEX sale)</span>
          </span>
          {e.firstMoveTx && <TxLink net={net} tx={e.firstMoveTx} label="tx" />}
        </span>
      ) : e.outcome === 'held' ? (
        <span className="font-semibold" style={{ color: OUTCOME_COLOR.held }}>held — no re-stake, sale, or transfer in the window</span>
      ) : (
        <span className="text-[var(--text-faint)]">no re-stake · transfer data doesn’t reach this far back</span>
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

  return (
    <details className="anim-rise group overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 p-3.5 md:p-4">
        <IconShieldCheck className="h-4.5 w-4.5 shrink-0" style={{ color: 'var(--viz-gain)' }} />
        <span className="font-jost text-[15px] font-bold text-[var(--text)]">How often is this call right?</span>
        {status === 'ready' && bt && bt.scored > 0 && (
          <span className="font-jost text-[26px] font-bold leading-none tabular-nums" style={{ color: 'var(--viz-gain)' }}>
            {pct0(bt.accuracy)}
          </span>
        )}
        <IconChevronDown className="ml-auto h-4 w-4 shrink-0 text-[var(--text-faint)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-[var(--line)] p-3 md:p-4">
        {status === 'loading' && (
          <div className="font-poppins flex items-center gap-2 py-4 text-xs text-[var(--text-muted)]">
            <IconRefresh className="h-3.5 w-3.5 animate-spin" /> Replaying the signal over past stake-ends…
          </div>
        )}
        {status === 'error' && <div className="font-poppins py-4 text-xs text-[var(--viz-loss)]">Couldn’t run the backtest right now.</div>}
        {status === 'ready' && bt && (bt.scored === 0 ? (
          <div className="font-poppins py-4 text-xs text-[var(--text-faint)]">
            Not enough observable history on {net === 'ethereum' ? 'Ethereum' : 'PulseChain'} to backtest yet.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Tile label="Accuracy" value={pct0(bt.accuracy)} color="var(--viz-gain)" sub={`over ${bt.scored.toLocaleString()} past ends`} />
              <Tile
                label="Edge vs. guessing"
                value={`${bt.lift >= 0 ? '+' : ''}${(bt.lift * 100).toFixed(0)}pt`}
                color={bt.lift > 0 ? 'var(--viz-gain)' : 'var(--viz-loss)'}
                sub={`base rate ${pct0(bt.baseRestakeRate)} re-stake`}
              />
              <Tile label="“Re-stake” calls right" value={pct0(bt.restakePrecision)} sub={`${bt.restakeCalls.toLocaleString()} calls`} />
              <Tile label="“Sell” calls right" value={pct0(bt.sellPrecision)} sub={`${bt.sellCalls.toLocaleString()} calls`} />
            </div>
            <p className="font-poppins mt-2.5 px-1 text-[10px] leading-relaxed text-[var(--text-faint)]">
              Each past end was re-predicted from only that wallet’s <em>earlier</em> ends, then checked against what it really
              did. Edge is how much that beats always guessing the majority outcome. Excluded: {bt.unknown.toLocaleString()} with
              no prior history, {bt.censored.toLocaleString()} whose window runs past our data.
            </p>
          </>
        ))}
      </div>
    </details>
  );
}

/** A figure with its label, in the house type scale. */
function Tile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-3">
      <div className="font-poppins truncate text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div className="font-jost truncate text-[26px] font-bold leading-none tabular-nums" style={{ color: color ?? 'var(--text)' }}>
        {value}
      </div>
      {sub && <div className="font-poppins mt-1 truncate text-[11px] text-[var(--text-muted)]">{sub}</div>}
    </div>
  );
}
