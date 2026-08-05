'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { IconBriefcase, IconLink, IconPinned, IconSearch, IconX } from '@tabler/icons-react';
import { usePortfolioStore } from '@/lib/stores/portfolioStore';
import { useInvestigateStore } from '@/lib/stores/investigateStore';
import { LEAGUES } from '@/components/geicko/GeickoTokenLeaguesPanel';
import { fmtAmount, fmtUsd } from '@/lib/format';

// "My portfolio while I'm on a token page" — a persistent dock chip that
// expands into a slide-over drawer (bottom sheet on phones).
//
// The design intent, in order:
//   1. The chip is ambient: total value, "N hold <SYMBOL>", and a movement dot
//      are visible without a click — landing on a token page already tells you
//      whether you're exposed and whether your pinned suspects acted today.
//   2. The drawer is a workbench, not a mirror of the portfolio page: your
//      wallets joined against THIS token (position, P&L, league rank), plus
//      the "Investigating" tray of pinned holder wallets with the same join.
//   3. On desktop there is deliberately NO backdrop: the page stays fully
//      interactive with the drawer open, because the whole point is reading
//      the holder list and your wallets side by side.
//
// Every number in here is a REUSED computation so figures agree across the app:
// wallet $ = holder-values basket; P&L = holder-detail's pnl (the same record
// an expanded holder row shows); rank = token-leagues; 24h = holder-deltas;
// funding groups = first-funder. PulseChain only (the page mounts it there).

interface WalletValue { usd: number }

interface Pnl {
  realizedUsd: number;
  unrealizedUsd: number | null;
  netUsd: number;
  basisComplete: boolean;
  avgCostUsd: number | null;
}

const OPEN_KEY = 'geicko-portfolio-drawer';
/** token-balances accepts ≤20 addresses per POST; pins are capped at 30. */
const BALANCE_CHUNK = 20;
/** first-funder walks a wallet's earliest txs — bound the connection check. */
const MAX_FUNDER_LOOKUPS = 12;

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const fmtPnl = (v: number) => `${v >= 0 ? '+' : '−'}${fmtUsd(Math.abs(v))}`;

/** Fetch balances for any address list, chunked to the endpoint's cap. */
async function fetchBalances(token: string, addresses: string[]) {
  const out: Record<string, string | null> = {};
  let decimals: number | null = null;
  let totalSupply: string | null = null;
  for (let i = 0; i < addresses.length; i += BALANCE_CHUNK) {
    const chunk = addresses.slice(i, i + BALANCE_CHUNK);
    const r = await fetch('/api/geicko/token-balances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, addresses: chunk }),
    });
    if (!r.ok) continue;
    const d = await r.json();
    if (!d?.supported) continue;
    if (typeof d.decimals === 'number') decimals = d.decimals;
    if (typeof d.totalSupply === 'string') totalSupply = d.totalSupply;
    Object.assign(out, d.balances ?? {});
  }
  return { decimals, totalSupply, balances: out };
}

/**
 * League tier from share-of-supply — the same thresholds the Token Leagues
 * panel and API use, computed locally from data already in hand. The leagues
 * ENDPOINT also pages the whole top-holder list to size each tier (up to ~45s
 * cold), which is far too heavy a dependency for one caption line.
 */
function leagueFor(raw: string, totalSupply: string | null) {
  if (!totalSupply) return null;
  const supply = Number(totalSupply);
  const bal = Number(raw);
  if (!Number.isFinite(supply) || supply <= 0 || !Number.isFinite(bal) || bal <= 0) return null;
  const frac = bal / supply;
  const idx = LEAGUES.findIndex((l) => frac >= l.pct);
  return idx >= 0 ? { league: LEAGUES[idx], pct: frac * 100 } : null;
}

/**
 * 24h position change as the holders table renders it: percentage against the
 * position at the window start (balance_now − change). Null = didn't move.
 */
function deltaPct(nowRaw: string | null | undefined, changeRaw: string | undefined):
  { text: string; up: boolean } | null {
  if (!changeRaw || changeRaw === '0') return null;
  let now: bigint, change: bigint;
  try { now = BigInt(nowRaw ?? '0'); change = BigInt(changeRaw); } catch { return null; }
  const before = now - change;
  if (before <= BigInt(0)) return { text: 'new', up: true };
  if (now === BigInt(0) && change < BigInt(0)) return { text: 'exited', up: false };
  const pct = (Number(change) / Number(before)) * 100;
  if (!Number.isFinite(pct)) return null;
  const a = Math.abs(pct);
  const digits = a >= 10 ? 0 : 1;
  return { text: `${pct >= 0 ? '+' : '−'}${a.toFixed(digits)}%`, up: pct >= 0 };
}

export default function PortfolioDrawer({
  token,
  symbol,
  priceUsd,
  onViewHolder,
}: {
  /** Current token address (lowercased ok), null while the page resolves. */
  token: string | null;
  /** Current token symbol for labels. */
  symbol: string;
  /** Current token USD price, for valuing your position. */
  priceUsd: number | null;
  /** Opens the existing holder modal (portfolio / txs / stakes) for a wallet. */
  onViewHolder: (address: string) => void;
}) {
  const wallets = usePortfolioStore((s) => s.wallets);
  const pins = useInvestigateStore((s) => s.pins);
  const unpin = useInvestigateStore((s) => s.unpin);
  const clearPins = useInvestigateStore((s) => s.clear);

  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, WalletValue>>({});
  // Everything token-scoped is stored WITH the token it was fetched for, and
  // only renders when that token is still on screen. Anything looser shows
  // token A's data labeled as token B while navigating (effects run after
  // paint, so eager resets still flash one wrong frame).
  const [tokenBal, setTokenBal] = useState<{
    token: string;
    decimals: number | null;
    totalSupply: string | null;
    balances: Record<string, string | null>;
  } | null>(null);
  const [pinBal, setPinBal] = useState<{
    token: string;
    decimals: number | null;
    totalSupply: string | null;
    balances: Record<string, string | null>;
  } | null>(null);
  const [deltas, setDeltas] = useState<{
    token: string;
    map: Record<string, string>;
  } | null>(null);
  const [pnl, setPnl] = useState<{ token: string; byWallet: Record<string, Pnl | null> } | null>(null);
  // Shared-funder groups among the pins; null = not run for this pin set yet.
  const [funders, setFunders] = useState<{
    key: string;
    status: 'loading' | 'done' | 'error';
    groups: { funder: string; label: string | null; members: string[] }[];
    checked: number;
  } | null>(null);

  // Reopen state survives tab-to-tab navigation within the session.
  useEffect(() => {
    try { setOpen(sessionStorage.getItem(OPEN_KEY) === '1'); } catch { /* ignore */ }
  }, []);
  const toggle = useCallback((v: boolean) => {
    setOpen(v);
    try { sessionStorage.setItem(OPEN_KEY, v ? '1' : '0'); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') toggle(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, toggle]);

  const walletAddrs = useMemo(
    () => wallets.map((w) => w.address.toLowerCase()),
    [wallets],
  );
  const pinAddrs = useMemo(() => pins.map((p) => p.address), [pins]);
  // One value fetch covers wallets AND pinned holders — same endpoint, one POST.
  const valueAddrs = useMemo(
    () => [...new Set([...walletAddrs, ...pinAddrs])],
    [walletAddrs, pinAddrs],
  );

  // Wallet $ values via the same basket estimate the holders table shows.
  useEffect(() => {
    if (valueAddrs.length === 0) { setValues({}); return; }
    let alive = true;
    fetch('/api/geicko/holder-values', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses: valueAddrs, network: 'pulsechain' }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.values) setValues(d.values as Record<string, WalletValue>); })
      .catch(() => { /* values stay blank; balances still work */ });
    return () => { alive = false; };
  }, [valueAddrs]);

  // MY balance of the current token, per wallet. Cheap; powers the chip badge.
  useEffect(() => {
    if (!token || walletAddrs.length === 0) { setTokenBal(null); return; }
    let alive = true;
    const fetchedFor = token.toLowerCase();
    fetchBalances(fetchedFor, walletAddrs)
      .then((r) => { if (alive) setTokenBal({ token: fetchedFor, ...r }); })
      .catch(() => { /* strip just doesn't render */ });
    return () => { alive = false; };
  }, [token, walletAddrs]);

  // PINS × the current token — "which of my suspects are in this one too?"
  useEffect(() => {
    if (!token || pinAddrs.length === 0) { setPinBal(null); return; }
    let alive = true;
    const fetchedFor = token.toLowerCase();
    fetchBalances(fetchedFor, pinAddrs)
      .then((r) => { if (alive) setPinBal({ token: fetchedFor, ...r }); })
      .catch(() => { /* tray rows just skip the holding line */ });
    return () => { alive = false; };
  }, [token, pinAddrs]);

  // 24h movement on this token, for wallets AND pins — one fetch, the server
  // computes every address's delta anyway (and caches it for the holders tab).
  useEffect(() => {
    if (!token || (walletAddrs.length === 0 && pinAddrs.length === 0)) { setDeltas(null); return; }
    let alive = true;
    const fetchedFor = token.toLowerCase();
    fetch(`/api/geicko/holder-deltas?token=${fetchedFor}&network=pulsechain`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d?.supported || !d.complete) return;
        setDeltas({ token: fetchedFor, map: d.deltas ?? {} });
      })
      .catch(() => { /* movement chips just don't render */ });
    return () => { alive = false; };
  }, [token, walletAddrs, pinAddrs]);

  // Only data fetched for the token on screen is usable.
  const lowerToken = token?.toLowerCase() ?? null;
  const current = lowerToken && tokenBal?.token === lowerToken ? tokenBal : null;
  const currentPins = lowerToken && pinBal?.token === lowerToken ? pinBal : null;
  const currentDeltas = lowerToken && deltas?.token === lowerToken ? deltas.map : null;
  const currentPnl = lowerToken && pnl?.token === lowerToken ? pnl.byWallet : null;
  const decimals = current?.decimals ?? null;

  const holding = useMemo(() => {
    if (!current || current.decimals == null) return [];
    const d = current.decimals;
    return walletAddrs
      .map((a) => ({ address: a, raw: current.balances[a] }))
      .filter((x): x is { address: string; raw: string } => !!x.raw && x.raw !== '0')
      .map((x) => ({ address: x.address, raw: x.raw, amount: Number(x.raw) / Math.pow(10, d) }))
      .sort((a, b) => b.amount - a.amount);
  }, [walletAddrs, current]);

  const pinsHolding = useMemo(() => {
    if (!currentPins || currentPins.decimals == null) return new Map<string, number>();
    const d = currentPins.decimals;
    const m = new Map<string, number>();
    for (const a of pinAddrs) {
      const raw = currentPins.balances[a];
      if (raw && raw !== '0') m.set(a, Number(raw) / Math.pow(10, d));
    }
    return m;
  }, [pinAddrs, currentPins]);

  /** Pins that moved on THIS token in the last 24h — drives the chip dot. */
  const pinsMoved = useMemo(() => {
    if (!currentDeltas) return 0;
    return pinAddrs.filter((a) => currentDeltas[a] && currentDeltas[a] !== '0').length;
  }, [pinAddrs, currentDeltas]);

  // P&L for MY holding wallets — a heavier lookup (PulseX subgraph walk), so
  // it runs only while the drawer is actually open, and lands PROGRESSIVELY:
  // a wallet with a long record must not hold every other wallet's number
  // hostage behind one Promise.all.
  // The fetched-marker is a REF, not the pnl state: marking in-flight via
  // setState re-runs this effect, and an effect-cleanup `alive` flag would
  // then kill the fetches it just started. Staleness is handled by the token
  // tag on every merge instead — a result for a token no longer on screen
  // merges into nothing.
  const pnlFetchedFor = React.useRef<string | null>(null);
  useEffect(() => {
    if (!open || !lowerToken || holding.length === 0) return;
    if (pnlFetchedFor.current === lowerToken) return;
    pnlFetchedFor.current = lowerToken;
    const fetchedFor = lowerToken;
    setPnl({ token: fetchedFor, byWallet: {} });
    for (const { address, amount } of holding) {
      fetch(`/api/geicko/holder-detail?token=${fetchedFor}&wallet=${address}&network=pulsechain&balance=${encodeURIComponent(amount)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const val = d?.supported && d?.hasData && d?.pnl ? (d.pnl as Pnl) : null;
          setPnl((prev) => prev && prev.token === fetchedFor
            ? { token: fetchedFor, byWallet: { ...prev.byWallet, [address]: val } }
            : prev);
        })
        .catch(() => { /* that wallet's line just stays absent */ });
    }
  }, [open, lowerToken, holding]);


  const totalUsd = useMemo(
    () => walletAddrs.reduce((s, a) => s + (values[a]?.usd ?? 0), 0),
    [walletAddrs, values],
  );

  const labelFor = (addr: string) =>
    wallets.find((w) => w.address.toLowerCase() === addr)?.label || null;

  /** Group pins by first funder — the shared-wallet-behind-them check. */
  const checkConnections = useCallback(async () => {
    const targets = pinAddrs.slice(0, MAX_FUNDER_LOOKUPS);
    const key = targets.join(',');
    setFunders({ key, status: 'loading', groups: [], checked: 0 });
    try {
      const results = await Promise.all(
        targets.map(async (address) => {
          const r = await fetch('/api/portfolio/first-funder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, chain: 'pulsechain' }),
          });
          const d = r.ok ? await r.json() : null;
          const f = d?.funder;
          return { address, funder: f?.supported && f?.funder ? String(f.funder).toLowerCase() : null, label: f?.label ?? null };
        }),
      );
      const byFunder = new Map<string, { label: string | null; members: string[] }>();
      for (const r of results) {
        if (!r.funder) continue;
        const e = byFunder.get(r.funder) ?? { label: r.label, members: [] };
        e.members.push(r.address);
        if (!e.label && r.label) e.label = r.label;
        byFunder.set(r.funder, e);
      }
      const groups = [...byFunder.entries()]
        .filter(([, g]) => g.members.length >= 2)
        .map(([funder, g]) => ({ funder, label: g.label, members: g.members }))
        .sort((a, b) => b.members.length - a.members.length);
      setFunders({ key, status: 'done', groups, checked: results.filter((r) => r.funder).length });
    } catch {
      setFunders({ key, status: 'error', groups: [], checked: 0 });
    }
  }, [pinAddrs]);

  /** Hand the pinned set to Sleuth as a prefilled prompt. */
  const askSleuth = useCallback(() => {
    const lines = pins.slice(0, 15).map((p) => {
      const ctx = [p.rank != null ? `#${p.rank} holder` : null, p.symbol ? `on ${p.symbol}` : null]
        .filter(Boolean).join(' ');
      return `- ${p.address}${ctx ? ` (${ctx})` : ''}`;
    });
    const prompt =
      `I've pinned these wallets while investigating:\n${lines.join('\n')}\n\n` +
      `Are any of them connected through shared funding? What else do they hold in common` +
      `${symbol ? `, and what does their trading on ${symbol} look like` : ''}? Flag anything suspicious.`;
    window.dispatchEvent(new CustomEvent('sleuth-ask', { detail: { prompt } }));
  }, [pins, symbol]);

  // ----- chip (always mounted) -----
  const chip = (
    <button
      type="button"
      onClick={() => toggle(!open)}
      aria-expanded={open}
      aria-label="Toggle the portfolio drawer"
      className="fixed bottom-20 right-20 md:bottom-6 z-[110] flex items-center gap-2 rounded-full border border-[var(--line-strong)] bg-[color-mix(in_srgb,var(--panel)_92%,transparent)] px-3 py-2 shadow-xl shadow-black/40 backdrop-blur transition-transform hover:scale-[1.03]"
    >
      <IconBriefcase className="h-4 w-4 text-[var(--text-muted)]" />
      <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--text)]">
        Portfolio
      </span>
      {wallets.length === 0 ? (
        <span className="text-[10px] text-[var(--text-faint)]">set up</span>
      ) : (
        <>
          {totalUsd > 0 && (
            <span className="text-[11px] font-bold tabular-nums text-[var(--text)]">{fmtUsd(totalUsd)}</span>
          )}
          {holding.length > 0 && (
            <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300">
              {holding.length} hold {symbol}
            </span>
          )}
          {pins.length > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-300">
              <IconPinned className="h-3 w-3" />{pins.length}
              {/* A pinned wallet moved on THIS token in the last 24h. */}
              {pinsMoved > 0 && (
                <span
                  className="ml-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400"
                  title={`${pinsMoved} pinned wallet${pinsMoved === 1 ? '' : 's'} moved ${symbol} in the last 24h`}
                />
              )}
            </span>
          )}
        </>
      )}
    </button>
  );

  if (!open) return chip;

  // ----- drawer / sheet -----
  const row = 'flex items-center gap-2.5 px-3.5 py-2.5 border-b border-[var(--line-soft)]';
  const viewBtn =
    'rounded border border-cyan-400/40 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 hover:bg-cyan-400/10 transition-colors flex-none';
  const heading = 'text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-faint)]';

  const Delta = ({ addr, raw }: { addr: string; raw?: string | null }) => {
    const d = currentDeltas ? deltaPct(raw, currentDeltas[addr]) : null;
    if (!d) return null;
    return (
      <span
        className={`text-[9.5px] font-bold tabular-nums ${d.up ? 'text-emerald-400' : 'text-red-400'}`}
        title={`Position change over the last 24h on ${symbol}`}
      >
        {d.text}
      </span>
    );
  };

  return (
    <>
      {chip}
      {/* z-order: the Sleuth FAB sits at z-[120], so the backdrop (121) dims it
          and the sheet (125) covers it while the drawer is open. Mobile only —
          desktop keeps the page interactive on purpose. */}
      <div
        className="fixed inset-0 z-[121] bg-black/50 md:hidden"
        onClick={() => toggle(false)}
        aria-hidden="true"
      />
      <aside
        role="complementary"
        aria-label="My portfolio"
        className={
          'fixed z-[125] flex flex-col overflow-hidden border border-[var(--line-strong)] bg-[var(--panel)] shadow-2xl shadow-black/60 ' +
          'inset-x-0 bottom-0 max-h-[70vh] rounded-t-2xl ' +
          'md:inset-x-auto md:right-0 md:top-14 md:bottom-3 md:max-h-none md:w-[336px] md:rounded-l-2xl md:rounded-tr-none md:border-r-0'
        }
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] px-3.5 py-2.5">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[var(--text)]">My portfolio</span>
            <span className="truncate text-[10px] text-[var(--text-faint)]">
              {wallets.length} wallet{wallets.length === 1 ? '' : 's'}{totalUsd > 0 ? ` · ${fmtUsd(totalUsd)}` : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={() => toggle(false)}
            aria-label="Close"
            className="text-[var(--text-faint)] hover:text-[var(--text)]"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {wallets.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
              No wallets yet.
              <Link href="/portfolio" className="ml-1 font-semibold text-cyan-300 hover:underline">
                Add them on the portfolio page →
              </Link>
            </div>
          ) : (
            <>
              {/* Position in the CURRENT token — the reason this drawer exists. */}
              {token && (
                holding.length > 0 ? (
                  <div className="border-b border-[var(--line)] bg-cyan-400/[0.05] px-3.5 py-2.5">
                    <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-cyan-300">
                      You hold {symbol} in {holding.length} of {wallets.length} wallet{wallets.length === 1 ? '' : 's'}
                    </div>
                    {holding.map((h) => {
                      const p = currentPnl?.[h.address];
                      const lg = leagueFor(h.raw, current?.totalSupply ?? null);
                      return (
                        <div key={h.address} className="py-1 first:pt-0">
                          <div className="flex items-baseline justify-between gap-2 text-[11px]">
                            <span className="font-mono text-[var(--text-muted)]">{labelFor(h.address) ?? short(h.address)}</span>
                            <Delta addr={h.address} raw={h.raw} />
                            <span className="ml-auto font-bold tabular-nums text-[var(--text)]">
                              {fmtAmount(Math.floor(h.amount))} {symbol}
                            </span>
                            {priceUsd != null && priceUsd > 0 && (
                              <span className="w-14 text-right tabular-nums text-[var(--text-faint)]">
                                {fmtUsd(h.amount * priceUsd)}
                              </span>
                            )}
                          </div>
                          {/* League + net P&L, both reused computations. */}
                          {(lg || p) && (
                            <div className="mt-0.5 flex items-center gap-2 text-[9.5px] text-[var(--text-faint)]">
                              {lg && (
                                <span title={`Holds ${lg.pct.toFixed(2)}% of supply — ${lg.league.name} tier`}>
                                  {lg.league.beast} {lg.league.name} · {lg.pct >= 0.01 ? lg.pct.toFixed(2) : lg.pct.toPrecision(2)}%
                                </span>
                              )}
                              {p && (
                                <span
                                  className={`font-semibold tabular-nums ${p.netUsd >= 0 ? 'text-emerald-400/90' : 'text-red-400/90'}`}
                                  title={`Net P&L from this wallet's PulseX record${p.avgCostUsd != null ? ` · avg cost $${p.avgCostUsd.toPrecision(3)}` : ''}${p.basisComplete ? '' : ' · partial — some tokens moved outside PulseX'}`}
                                >
                                  {fmtPnl(p.netUsd)}{p.basisComplete ? '' : '*'}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : decimals != null ? (
                  <div className="border-b border-[var(--line)] px-3.5 py-2 text-[10px] text-[var(--text-faint)]">
                    None of your wallets hold {symbol}.
                  </div>
                ) : null
              )}

              <div className={`px-3.5 pb-1 pt-2.5 ${heading}`}>Wallets</div>
              {wallets.map((w) => {
                const a = w.address.toLowerCase();
                const v = values[a]?.usd;
                return (
                  <div key={a} className={row}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-[11px] text-[var(--text)]">{short(a)}</div>
                      {w.label && <div className="text-[9px] text-[var(--text-faint)]">{w.label}</div>}
                    </div>
                    <span className="text-[12px] font-bold tabular-nums text-[var(--text)]">
                      {v != null ? fmtUsd(v) : '—'}
                    </span>
                    <button type="button" onClick={() => onViewHolder(a)} className={viewBtn}>
                      view
                    </button>
                  </div>
                );
              })}
              <div className="px-3.5 py-2 text-right">
                <Link href="/portfolio" className="text-[10px] font-semibold text-[var(--text-faint)] hover:text-[var(--text)]">
                  Manage wallets →
                </Link>
              </div>
            </>
          )}

          {/* Investigating tray — pins survive tab and token changes. */}
          <div className="flex items-center justify-between px-3.5 pb-1 pt-2 border-t border-[var(--line)]">
            <span className={heading}>
              Investigating{pins.length > 0 ? ` · ${pins.length}` : ''}
              {pinsHolding.size > 0 && (
                <span className="ml-1.5 normal-case tracking-normal text-cyan-300">
                  {pinsHolding.size} hold {symbol}
                </span>
              )}
            </span>
            {pins.length > 0 && (
              <button type="button" onClick={clearPins} className="text-[9px] font-semibold text-cyan-300 hover:underline">
                clear
              </button>
            )}
          </div>
          {pins.length === 0 ? (
            <div className="px-3.5 pb-4 pt-1 text-[10px] leading-relaxed text-[var(--text-faint)]">
              Open any holder on the Holders tab and press <b className="text-[var(--text-muted)]">Pin</b> — it
              stays here while you move between tabs and tokens.
            </div>
          ) : (
            <>
              {pins.map((p) => {
                const held = pinsHolding.get(p.address);
                return (
                  <div key={p.address} className={`${row} border-l-2 border-l-amber-400/50`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="truncate font-mono text-[11px] text-[var(--text)]">{short(p.address)}</span>
                        <Delta addr={p.address} raw={currentPins?.balances[p.address]} />
                      </div>
                      <div className="text-[9px] text-[var(--text-faint)]">
                        {p.rank != null ? `#${p.rank} holder` : 'pinned'}{p.symbol ? ` on ${p.symbol}` : ''}
                        {/* The cross-token hit: this suspect is in the CURRENT token too. */}
                        {held != null && (
                          <span className="ml-1.5 font-semibold text-cyan-300">
                            holds {fmtAmount(Math.floor(held))} {symbol}
                          </span>
                        )}
                      </div>
                    </div>
                    {values[p.address]?.usd != null && (
                      <span className="text-[11px] font-bold tabular-nums text-[var(--text)]">
                        {fmtUsd(values[p.address].usd)}
                      </span>
                    )}
                    <button type="button" onClick={() => onViewHolder(p.address)} className={viewBtn}>
                      view
                    </button>
                    <button
                      type="button"
                      onClick={() => unpin(p.address)}
                      aria-label={`Unpin ${short(p.address)}`}
                      className="text-[var(--text-faint)] hover:text-[var(--text)] flex-none"
                    >
                      <IconX className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}

              {/* Tray tools: shared-funding check + hand the case to Sleuth. */}
              <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
                {pins.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => void checkConnections()}
                    disabled={funders?.status === 'loading'}
                    className="inline-flex items-center gap-1 rounded border border-[var(--line-strong)] px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)] transition-colors hover:border-cyan-400/50 hover:text-cyan-300 disabled:opacity-50"
                  >
                    <IconLink className="h-3 w-3" />
                    {funders?.status === 'loading' ? 'Checking funding…' : 'Check connections'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={askSleuth}
                  className="inline-flex items-center gap-1 rounded border border-[#FA4616]/50 px-2 py-1 text-[10px] font-semibold text-[#FA4616] transition-colors hover:bg-[#FA4616]/10"
                >
                  <IconSearch className="h-3 w-3" />
                  Ask Sleuth
                </button>
              </div>

              {funders?.status === 'error' && (
                <div className="px-3.5 pb-3 text-[10px] text-red-400">
                  Funding lookup failed — the origin tracer didn’t answer. Try again.
                </div>
              )}
              {funders?.status === 'done' && (
                funders.groups.length > 0 ? (
                  <div className="px-3.5 pb-3">
                    {funders.groups.map((g) => (
                      <div key={g.funder} className="mb-1.5 rounded border border-amber-400/30 bg-amber-400/[0.06] px-2.5 py-1.5">
                        <div className="text-[10px] font-bold text-amber-300">
                          {g.members.length} pins share a funder
                        </div>
                        <div className="font-mono text-[10px] text-[var(--text-muted)]">
                          {short(g.funder)}{g.label ? ` · ${g.label}` : ''} → {g.members.map(short).join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-3.5 pb-3 text-[10px] text-[var(--text-faint)]">
                    No shared first-funder among the {funders.checked} pins that resolved
                    {pins.length > MAX_FUNDER_LOOKUPS ? ` (first ${MAX_FUNDER_LOOKUPS} checked)` : ''}.
                  </div>
                )
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
