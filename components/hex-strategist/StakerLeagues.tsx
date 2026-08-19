'use client';

// HEX Staker Leagues — a T-Share ladder you can find yourself on.
//
// Three things happen here:
//   1. THE LADDER      — ten tiers, each a slice of the network's live T-Share
//                        supply, with today's floor in real T-Shares.
//   2. YOUR STANDING   — paste an address (or pick a tracked wallet) and get its
//                        exact locked T-Shares read straight off the HEX
//                        contract, its tier, its rank, and how far it is from
//                        promotion or demotion.
//   3. THE WAR ROOM    — the "what if" panel. Toggle your own stakes off to see
//                        what ending them costs you, or size up a new stake and
//                        watch the crest change before you commit a single HEX.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IconShieldBolt, IconRefresh, IconExternalLink, IconSearch, IconArrowUpRight,
  IconArrowDownRight, IconWallet, IconAlertTriangle, IconChevronDown, IconTrendingUp,
} from '@tabler/icons-react';
import { type Network, type Rates, loadRates } from '@/lib/hex/strategistData';
import {
  LEAGUES, LEAGUE_BY_KEY, ENTRY_LEAGUE, standingFor, leagueFloor, type League, type LeagueRow,
} from '@/lib/hex/leagues';
import { projectedTShares, hexForTShares, LPB_FULL_BONUS_DAYS, HEX_MAX_STAKE_DAYS } from '@/lib/hex/stakeMath';
import { fmtHex, fmtUsdShort, fmtDuration, fmtHexDate } from '@/lib/hex/hexDay';
import { HexLogo } from '@/components/hex/HexAmount';
import { pulsechainAddressUrl } from '@/lib/pulsechainExplorer';
import { usePortfolioStore } from '@/lib/stores/portfolioStore';
import LeagueCrest from './LeagueCrest';

interface LeaguesData {
  networkTShares: number;
  rankedTShares: number;
  coveragePct: number;
  lockedStakes: number;
  stakersFound: number;
  rows: LeagueRow[];
  populations: Record<string, number>;
  note: string;
}

/** Sent while the stake index is still being built for the first time. */
interface IndexingState {
  progressPct: number;
  stakesIndexed: number;
  reason: string;
}

interface StandingStake {
  stakeId: string;
  tShares: number;
  principalHex: number;
  startDay: number;
  endDay: number;
  stakedDays: number;
}

interface StandingData {
  address: string;
  currentDay: number;
  tShares: number;
  principalHex: number;
  stakes: StandingStake[];
  unlockedStakes: number;
}

const addrUrl = (net: Network, a: string) =>
  net === 'ethereum' ? `https://etherscan.io/address/${a}` : pulsechainAddressUrl(a);
const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * T-Shares, written out in full. The app's shared `fmtTShares` rolls 1000 T up
 * into "B-Shares", which is the right call on a stake card but the wrong one on
 * a ladder — league floors and rank gaps only mean something when you can read
 * the digits and compare them directly.
 */
function tsh(t: number): string {
  if (!Number.isFinite(t)) return '—';
  if (t === 0) return '0';
  if (t < 1) return t.toFixed(3);
  if (t < 1000) return t.toFixed(1);
  return Math.round(t).toLocaleString();
}

const pctOfNetwork = (pct: number) => (pct >= 0.01 ? `${pct.toFixed(2)}%` : pct > 0 ? `${pct.toFixed(4)}%` : '0%');

/**
 * A tier's floor as a percent of supply. Written out longhand rather than via
 * toPrecision, which flips to exponent notation ("1e-7%") by the bottom of a
 * ladder that runs down to a ten-millionth of a percent.
 */
const floorPctLabel = (league: League) => {
  const pct = league.share * 100;
  const s = pct >= 1 ? String(Math.round(pct)) : pct.toFixed(8).replace(/0+$/, '');
  return `${s}% of supply`;
};

export default function StakerLeagues({ net }: { net: Network }) {
  const [data, setData] = useState<LeaguesData | null>(null);
  const [indexing, setIndexing] = useState<IndexingState | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'indexing' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [rates, setRates] = useState<Rates | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    setErrMsg(null);
    fetch(`/api/hex/leagues?network=${net}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        // 503 with `indexing` is the first-run state, not a failure.
        if (r.status === 503 && j?.indexing) {
          return { indexing: j as IndexingState, data: null };
        }
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        return { indexing: null, data: j as LeaguesData };
      })
      .then((res) => {
        if (!alive) return;
        if (res.indexing) {
          setIndexing(res.indexing);
          setStatus('indexing');
        } else {
          setData(res.data);
          setStatus('ready');
        }
      })
      .catch((e) => {
        if (!alive) return;
        setErrMsg(e instanceof Error ? e.message : null);
        setStatus('error');
      });
    return () => { alive = false; };
  }, [net, reload]);

  // Rates power the "what would it cost" math. Best-effort — without them the
  // ladder still works, it just can't quote a HEX price for a promotion.
  useEffect(() => {
    let alive = true;
    loadRates(net).then((r) => alive && setRates(r)).catch(() => {});
    return () => { alive = false; };
  }, [net]);

  if (status === 'loading') {
    return (
      <div className="grid place-items-center py-20 text-center text-sm text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-2">
          <IconRefresh className="h-4 w-4 animate-spin" /> Reading the stake index…
        </span>
      </div>
    );
  }
  if (status === 'indexing' && indexing) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
          <IconRefresh className="h-4 w-4 animate-spin text-orange-400" /> Building the stake index
        </div>
        <div className="mb-2 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{
              width: `${Math.max(2, indexing.progressPct)}%`,
              background: 'linear-gradient(90deg,#ff9e00,#ff2e7e)',
            }}
          />
        </div>
        <div className="mb-3 flex items-center justify-between text-[11px] tabular-nums text-[var(--text-muted)]">
          <span>{indexing.progressPct.toFixed(0)}%</span>
          <span>{indexing.stakesIndexed.toLocaleString()} locked stakes so far</span>
        </div>
        <p className="text-xs leading-relaxed text-[var(--text-muted)]">{indexing.reason}</p>
        <button onClick={() => setReload((n) => n + 1)} className="mt-3 text-xs text-[var(--text-faint)] underline hover:text-[var(--text)]">
          check again
        </button>
      </div>
    );
  }
  if (status === 'error' || !data) {
    return (
      <div className="py-20 text-center text-sm text-red-300">
        Couldn’t build the leagues.
        <button onClick={() => setReload((n) => n + 1)} className="ml-2 underline">retry</button>
        {errMsg && <div className="mt-2 text-xs text-[var(--text-faint)]">{errMsg}</div>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <NetworkStrip data={data} rates={rates} />
      <YourStanding net={net} data={data} rates={rates} />
      <Ladder data={data} />
      <Board net={net} data={data} rates={rates} />
      <p className="px-1 text-[10px] leading-relaxed text-[var(--text-faint)]">
        Ranked over every locked stake on {net} — counts are exact. Ended and good-accounted stakes sit
        out; HEX removes their shares from the network total.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Network summary
// ---------------------------------------------------------------------------

function NetworkStrip({ data, rates }: { data: LeaguesData; rates: Rates | null }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat label="T-Shares locked" value={tsh(data.networkTShares)} />
      <Stat label="Stakers ranked" value={data.stakersFound.toLocaleString()} />
      <Stat
        label="Poseidon floor"
        value={tsh(leagueFloor(LEAGUES[0], data.networkTShares))}
        accent={LEAGUES[0].color}
      />
      <Stat
        label="T-Share price"
        value={rates?.tSharePriceUsd ? fmtUsdShort(rates.tSharePriceUsd) : '—'}
        sub={rates?.tShareRateHex ? `${fmtHex(rates.tShareRateHex)} HEX each` : undefined}
      />
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-faint)]">{label}</div>
      <div className="truncate text-base font-bold tabular-nums" style={{ color: accent ?? 'var(--text)' }}>{value}</div>
      {sub && <div className="truncate text-[10px] text-[var(--text-muted)]">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Your standing + the what-if war room
// ---------------------------------------------------------------------------

function YourStanding({ net, data, rates }: { net: Network; data: LeaguesData; rates: Rates | null }) {
  const wallets = usePortfolioStore((s) => s.wallets);
  const [input, setInput] = useState('');
  const [standing, setStanding] = useState<StandingData | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [err, setErr] = useState<string | null>(null);
  // Stakes the simulator is pretending have been ended.
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  // Hypothetical new stake, as typed into the "stake more" panel.
  const [addHex, setAddHex] = useState('');
  const [addDays, setAddDays] = useState(LPB_FULL_BONUS_DAYS);

  const look = useCallback((raw: string) => {
    const a = raw.trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(a)) {
      setState('error');
      setErr('That doesn’t look like a wallet address — paste a full 0x… address.');
      return;
    }
    setState('loading');
    setErr(null);
    setDropped(new Set());
    fetch(`/api/hex/leagues/standing?network=${net}&address=${a}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        return j as StandingData;
      })
      .then((d) => { setStanding(d); setState('ready'); })
      .catch((e) => { setErr(e instanceof Error ? e.message : 'Lookup failed'); setState('error'); });
  }, [net]);

  // Re-read on network switch so a standing never belongs to the other chain.
  useEffect(() => { setStanding(null); setState('idle'); setDropped(new Set()); }, [net]);

  const hexWallets = useMemo(
    () => wallets.filter((w) => w.chains.includes(net as 'ethereum' | 'pulsechain')),
    [wallets, net],
  );

  const addTShares = useMemo(() => {
    const hex = parseFloat(addHex.replace(/,/g, ''));
    if (!(hex > 0) || !rates?.tShareRateHex) return 0;
    return projectedTShares(hex, addDays, rates.tShareRateHex);
  }, [addHex, addDays, rates]);

  // Everything the simulator removes, in both T-Shares and the principal behind
  // them — the header has to move together or it would report a live figure
  // beside a simulated tier.
  const droppedTotals = useMemo(() => {
    const off = (standing?.stakes ?? []).filter((s) => dropped.has(s.stakeId));
    return { tShares: off.reduce((t, s) => t + s.tShares, 0), hex: off.reduce((h, s) => h + s.principalHex, 0) };
  }, [standing, dropped]);

  const addHexNum = parseFloat(addHex.replace(/,/g, ''));
  const addedHex = addTShares > 0 && addHexNum > 0 ? addHexNum : 0;
  const simulating = dropped.size > 0 || addTShares > 0;

  const live = standing ? standingFor(standing.tShares, data.networkTShares) : null;
  const simTShares = standing ? Math.max(0, standing.tShares - droppedTotals.tShares + addTShares) : 0;
  const simPrincipal = standing ? Math.max(0, standing.principalHex - droppedTotals.hex + addedHex) : 0;
  const sim = standing ? standingFor(simTShares, data.networkTShares) : null;
  const changed = !!live && !!sim && sim.league.key !== live.league.key;
  // The board rank is a live standing — it says nothing about a simulated one,
  // so it is hidden rather than left sitting next to a tier it doesn't match.
  const rank = standing && !simulating ? data.rows.find((r) => r.address === standing.address)?.rank ?? null : null;

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
        <IconShieldBolt className="h-4 w-4 text-orange-400" /> Where do you stand?
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); look(input); }}
        className="flex flex-wrap items-center gap-2"
      >
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2">
          <IconSearch className="h-4 w-4 shrink-0 text-[var(--text-faint)]" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="0x… wallet address"
            spellCheck={false}
            className="w-full bg-transparent font-mono text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl border border-orange-500/50 bg-orange-500/15 px-4 py-2 text-xs font-bold uppercase tracking-wide text-orange-200 transition-colors hover:bg-orange-500/25"
        >
          Rank me
        </button>
      </form>

      {hexWallets.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
            <IconWallet className="h-3 w-3" /> Your wallets
          </span>
          {hexWallets.map((w) => (
            <button
              key={w.address}
              type="button"
              onClick={() => { setInput(w.address); look(w.address); }}
              className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              {w.label || shortAddr(w.address)}
            </button>
          ))}
        </div>
      )}

      {state === 'loading' && (
        <div className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <IconRefresh className="h-4 w-4 animate-spin" /> Reading your stakes off the HEX contract…
        </div>
      )}
      {state === 'error' && (
        <div className="mt-4 inline-flex items-center gap-2 text-sm text-red-300">
          <IconAlertTriangle className="h-4 w-4" /> {err}
        </div>
      )}

      {state === 'ready' && standing && live && sim && (
        <div className="mt-4 space-y-4">
          {/* Rank card */}
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border p-4"
            style={{ borderColor: `${sim.league.color}55`, background: `linear-gradient(135deg, ${sim.league.color}14, transparent 65%)` }}
          >
            <LeagueCrest league={sim.league} size={72} />
            <div className="min-w-[200px] flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-xl font-black uppercase tracking-wide" style={{ color: sim.league.color }}>
                  {sim.league.name}
                </span>
                {rank != null && (
                  <span className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--text-muted)]">
                    Rank #{rank}
                  </span>
                )}
                {simulating && (
                  <span
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold uppercase"
                    style={{
                      color: sim.tShares > live.tShares ? 'var(--up)' : '#fca5a5',
                      background: sim.tShares > live.tShares ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    }}
                  >
                    {sim.tShares > live.tShares ? <IconArrowUpRight className="h-3 w-3" /> : <IconArrowDownRight className="h-3 w-3" />}
                    {changed ? `simulated — was ${live.league.name}` : 'simulated'}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {sim.tShares > 0
                  ? sim.league.tagline
                  : 'No locked T-Shares on this address. Open a stake and you are on the board.'}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                <span className="text-[var(--text)]">
                  <b className="tabular-nums">{tsh(sim.tShares)}</b> <span className="text-[var(--text-faint)]">T-Shares</span>
                </span>
                <span className="text-[var(--text-muted)] tabular-nums">{pctOfNetwork(sim.sharePct)} of the network</span>
                <span className="inline-flex items-center gap-1 text-[var(--text-muted)] tabular-nums">
                  <HexLogo className="h-3 w-3" />{fmtHex(simPrincipal)} locked
                </span>
                <a
                  href={addrUrl(net, standing.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[var(--text-faint)] hover:text-[var(--text)]"
                >
                  {shortAddr(standing.address)} <IconExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          <PromotionBar standing={sim} />
          <ClimbAndFall standing={sim} rates={rates} />

          <WhatIf
            standing={standing}
            dropped={dropped}
            onToggle={(id) =>
              setDropped((prev) => {
                const n = new Set(prev);
                if (n.has(id)) n.delete(id); else n.add(id);
                return n;
              })
            }
            addHex={addHex}
            setAddHex={setAddHex}
            addDays={addDays}
            setAddDays={setAddDays}
            addTShares={addTShares}
            addHexNum={addHexNum}
            rates={rates}
            hasRates={!!rates?.tShareRateHex}
          />
        </div>
      )}

      {state === 'idle' && (
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Read live off the HEX contract — exact to the minute, nothing stored.
        </p>
      )}
    </div>
  );
}

/** Progress through the current tier, with the promotion bar. */
function PromotionBar({ standing }: { standing: ReturnType<typeof standingFor> }) {
  const { league, next, progressPct, toPromotion } = standing;
  if (!next) {
    return (
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-muted)]">
        Top of the ladder. There is nothing above {league.name}.
      </div>
    );
  }
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-semibold uppercase tracking-wide" style={{ color: league.color }}>{league.name}</span>
        <span className="tabular-nums text-[var(--text-muted)]">
          {toPromotion != null && toPromotion > 0
            ? <><b className="text-[var(--text)]">{tsh(toPromotion)}</b> T-Shares to {next.name}</>
            : `${next.name} reached`}
        </span>
        <span className="font-semibold uppercase tracking-wide" style={{ color: next.color }}>{next.name}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.max(1.5, progressPct)}%`, background: `linear-gradient(90deg, ${league.color}, ${next.color})` }}
        />
      </div>
    </div>
  );
}

/**
 * The two directions of the ladder, side by side: what promotion costs in HEX,
 * and how much of the position can be unwound before the tier is lost.
 */
function ClimbAndFall({ standing, rates }: { standing: ReturnType<typeof standingFor>; rates: Rates | null }) {
  const rate = rates?.tShareRateHex ?? 0;
  const usd = (hex: number) => (rates?.priceUsd ? hex * rates.priceUsd : null);
  const { next, below, toPromotion, cushion, league } = standing;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {/* Climb */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
        <div className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: next?.color ?? 'var(--text-muted)' }}>
          <IconArrowUpRight className="h-3.5 w-3.5" /> {next ? `Climb to ${next.name}` : 'Ladder topped out'}
        </div>
        {next && toPromotion != null ? (
          rate > 0 ? (
            <>
              <p className="text-xs text-[var(--text-muted)]">
                Needs <b className="tabular-nums text-[var(--text)]">{tsh(toPromotion)}</b> more T-Shares. One new stake buys that at:
              </p>
              <ul className="mt-1.5 space-y-1">
                {[
                  { days: LPB_FULL_BONUS_DAYS, label: 'Max share bonus' },
                  { days: 1111, label: '3 years' },
                  { days: 365, label: '1 year' },
                ].map(({ days, label }) => {
                  const hex = hexForTShares(toPromotion, days, rate);
                  const $ = usd(hex);
                  return (
                    <li key={days} className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="shrink-0 text-[var(--text-faint)]">
                        {label} <span className="text-[10px]">({fmtDuration(days)})</span>
                      </span>
                      <span className="inline-flex items-center gap-1 tabular-nums font-semibold text-[var(--text)]">
                        <HexLogo className="h-3 w-3" />{fmtHex(hex)}
                        {$ != null && <span className="font-normal text-[var(--text-faint)]">({fmtUsdShort($)})</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">
              Needs <b className="tabular-nums text-[var(--text)]">{tsh(toPromotion)}</b> more T-Shares. The live
              share rate didn’t load, so we can’t price that in HEX right now.
            </p>
          )
        ) : (
          <p className="text-xs text-[var(--text-muted)]">Nothing above this tier — you are the ceiling.</p>
        )}
      </div>

      {/* Fall */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3">
        <div className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: below?.color ?? 'var(--text-muted)' }}>
          <IconArrowDownRight className="h-3.5 w-3.5" /> {below ? `Fall to ${below.name}` : 'Bottom rung'}
        </div>
        {below ? (
          <>
            <p className="text-xs text-[var(--text-muted)]">
              <b className="tabular-nums text-[var(--text)]">{tsh(cushion)}</b> T-Shares clear of the{' '}
              {league.name} floor. End more than that and you drop to{' '}
              <b style={{ color: below.color }}>{below.name}</b>
              {rate > 0 && cushion > 0 && (
                <>
                  {' '}— roughly{' '}
                  <span className="inline-flex items-center gap-1 tabular-nums text-[var(--text)]">
                    <HexLogo className="h-3 w-3" />{fmtHex(hexForTShares(cushion, LPB_FULL_BONUS_DAYS, rate))}
                  </span>{' '}
                  of principal
                </>
              )}.
            </p>
            <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--text-faint)]">
              Only ending a stake moves T-Shares — selling liquid HEX never costs a tier.
            </p>
          </>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">There is no tier below this one.</p>
        )}
      </div>
    </div>
  );
}

/** The simulator: end stakes, or size up a new one, and watch the tier move. */
function WhatIf({
  standing, dropped, onToggle, addHex, setAddHex, addDays, setAddDays, addTShares, addHexNum, rates, hasRates,
}: {
  standing: StandingData;
  dropped: Set<string>;
  onToggle: (id: string) => void;
  addHex: string;
  setAddHex: (v: string) => void;
  addDays: number;
  setAddDays: (v: number) => void;
  addTShares: number;
  addHexNum: number;
  rates: Rates | null;
  hasRates: boolean;
}) {
  const [open, setOpen] = useState(true);
  const usdOf = (hex: number) => (rates?.priceUsd ? hex * rates.priceUsd : null);

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[var(--text)]"
      >
        <span className="inline-flex items-center gap-1.5"><IconTrendingUp className="h-3.5 w-3.5 text-orange-400" /> Run the numbers</span>
        <IconChevronDown className={`h-4 w-4 text-[var(--text-faint)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-[var(--line)] p-3">
          {/* Sell side */}
          <div>
            <div className="mb-1.5 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">
              If I end these stakes {standing.stakes.length > 0 && <>— tap to simulate</>}
            </div>
            {standing.stakes.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                No locked stakes on this address{standing.unlockedStakes > 0 && `, though ${standing.unlockedStakes} already-unlocked one${standing.unlockedStakes > 1 ? 's' : ''} sit${standing.unlockedStakes > 1 ? '' : 's'} in its list`}.
              </p>
            ) : (
              <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                {standing.stakes.map((s) => {
                  const off = dropped.has(s.stakeId);
                  return (
                    <button
                      key={s.stakeId}
                      type="button"
                      onClick={() => onToggle(s.stakeId)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                        off
                          ? 'border-red-500/40 bg-red-500/10 text-[var(--text-faint)] line-through'
                          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--text-faint)]'
                      }`}
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-mono text-[var(--text-faint)]">#{s.stakeId}</span>{' '}
                        <span className="inline-flex items-center gap-1 tabular-nums"><HexLogo className="h-3 w-3" />{fmtHex(s.principalHex)}</span>{' '}
                        <span className="text-[10px] text-[var(--text-faint)]">ends {fmtHexDate(s.endDay)}</span>
                      </span>
                      <span className="shrink-0 tabular-nums font-semibold" style={{ color: off ? '#fca5a5' : 'var(--text)' }}>
                        {off ? '−' : ''}{tsh(s.tShares)} T
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Buy side */}
          <div>
            <div className="mb-1.5 text-[11px] uppercase tracking-wider text-[var(--text-faint)]">If I open a new stake</div>
            {!hasRates ? (
              <p className="text-xs text-[var(--text-muted)]">
                The live T-Share rate didn’t load, so a new stake can’t be projected right now.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5">
                    <HexLogo className="h-3.5 w-3.5" />
                    <input
                      value={addHex}
                      onChange={(e) => setAddHex(e.target.value)}
                      inputMode="decimal"
                      placeholder="HEX to stake"
                      className="w-full bg-transparent text-sm tabular-nums text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
                    />
                  </div>
                  <span className="tabular-nums text-xs text-[var(--text-muted)]">
                    {addTShares > 0 ? <>+<b className="text-[var(--up)]">{tsh(addTShares)}</b> T-Shares</> : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={HEX_MAX_STAKE_DAYS}
                    value={addDays}
                    onChange={(e) => setAddDays(Number(e.target.value))}
                    className="h-1 w-full flex-1 cursor-pointer appearance-none rounded-full bg-[var(--line)] accent-orange-500"
                  />
                  <span className="w-24 shrink-0 text-right text-xs tabular-nums text-[var(--text-muted)]">
                    {fmtDuration(addDays)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[365, 1111, LPB_FULL_BONUS_DAYS, HEX_MAX_STAKE_DAYS].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setAddDays(d)}
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                        addDays === d
                          ? 'border-orange-500/50 bg-orange-500/15 text-orange-200'
                          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      {d === LPB_FULL_BONUS_DAYS ? 'Max bonus' : d === HEX_MAX_STAKE_DAYS ? 'Max stake' : fmtDuration(d)}
                    </button>
                  ))}
                  {addHexNum > 0 && usdOf(addHexNum) != null && (
                    <span className="ml-auto text-[10px] text-[var(--text-faint)]">≈ {fmtUsdShort(usdOf(addHexNum)!)}</span>
                  )}
                </div>
                {addDays < LPB_FULL_BONUS_DAYS && (
                  <p className="text-[10px] text-[var(--text-faint)]">
                    The length bonus keeps growing to {LPB_FULL_BONUS_DAYS.toLocaleString()} days — the same HEX
                    mints up to 3× the T-Shares there.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The ladder
// ---------------------------------------------------------------------------

function Ladder({ data }: { data: LeaguesData }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm font-semibold text-[var(--text)]">The ladder</span>
        <span className="text-[11px] text-[var(--text-muted)]">
          Floors move with the network — standing still is how you get demoted.
        </span>
      </div>
      <div className="space-y-1.5">
        {LEAGUES.map((l) => {
          const floor = leagueFloor(l, data.networkTShares);
          const pop = data.populations[l.key] ?? 0;
          return (
            <div
              key={l.key}
              className="flex items-center gap-3 rounded-xl border px-3 py-2"
              style={{ borderColor: `${l.color}33`, background: `linear-gradient(90deg, ${l.color}0d, transparent 55%)` }}
            >
              <LeagueCrest league={l} size={34} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold uppercase tracking-wide" style={{ color: l.color }}>{l.name}</div>
                <div className="hidden truncate text-[11px] text-[var(--text-faint)] sm:block">{l.tagline}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs font-semibold tabular-nums text-[var(--text)]">
                  {tsh(floor)}+<span className="ml-1 font-normal text-[var(--text-faint)]">T</span>
                </div>
                <div className="text-[10px] tabular-nums text-[var(--text-faint)]">{floorPctLabel(l)}</div>
              </div>
              <div className="w-16 shrink-0 text-right">
                <div className="text-xs font-semibold tabular-nums text-[var(--text-muted)]">
                  {pop > 0 ? pop.toLocaleString() : '—'}
                </div>
                <div className="text-[10px] text-[var(--text-faint)]">stakers</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

const PAGE_STEP = 50;

function Board({ net, data, rates }: { net: Network; data: LeaguesData; rates: Rates | null }) {
  const [shown, setShown] = useState(PAGE_STEP);
  const rows = data.rows.slice(0, shown);
  const usd = (hex: number) => (rates?.priceUsd ? hex * rates.priceUsd : null);

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-[var(--text)]">The board</div>
          <p className="text-xs text-[var(--text-muted)]">Every ranked staker, by locked T-Shares.</p>
        </div>
        <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
          all {data.stakersFound.toLocaleString()} stakers
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[540px] text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
              <th className="px-3 py-2 text-left font-semibold">#</th>
              <th className="px-3 py-2 text-left font-semibold">League</th>
              <th className="px-3 py-2 text-left font-semibold">Address</th>
              <th className="px-3 py-2 text-right font-semibold">T-Shares</th>
              <th className="px-3 py-2 text-right font-semibold">Network</th>
              <th className="px-3 py-2 text-right font-semibold">
                <span className="inline-flex items-center justify-end gap-1"><HexLogo className="h-3 w-3" />Locked</span>
              </th>
              <th className="px-3 py-2 text-right font-semibold">Stakes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const l = LEAGUE_BY_KEY[r.leagueKey] ?? ENTRY_LEAGUE;
              const $ = usd(r.principalHex);
              return (
                <tr key={r.address} className="border-b border-[var(--line-soft)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-3 py-2 tabular-nums text-[var(--text-faint)]">{r.rank}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <LeagueCrest league={l} size={20} />
                      <span className="hidden text-[11px] font-semibold uppercase tracking-wide sm:inline" style={{ color: l.color }}>
                        {l.name}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={addrUrl(net, r.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[var(--text)] hover:text-orange-300"
                    >
                      {shortAddr(r.address)}
                      <IconExternalLink className="h-3 w-3 text-[var(--text-faint)]" />
                    </a>
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-[var(--text)]">{tsh(r.tShares)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-muted)]">{pctOfNetwork(r.sharePct)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-muted)]">
                    {fmtHex(r.principalHex)}
                    {$ != null && <div className="text-[10px] text-[var(--text-faint)]">{fmtUsdShort($)}</div>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--text-muted)]">{r.stakes}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {shown < data.rows.length && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE_STEP)}
          className="w-full border-t border-[var(--line)] py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          Show {Math.min(PAGE_STEP, data.rows.length - shown)} more
        </button>
      )}
    </div>
  );
}
