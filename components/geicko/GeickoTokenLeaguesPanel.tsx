'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { formatAbbrev } from './utils';

export interface GeickoTokenLeaguesPanelProps {
  /** Token contract address — used to fetch tier populations. */
  token: string;
  /** Raw total supply + decimals (from token metrics). */
  totalSupply: { supply: string; decimals: number } | null;
  /** Token price in USD (string or number, e.g. DexScreener priceUsd). */
  priceUsd: string | number | null | undefined;
  /** Token symbol, shown next to the token amount (optional). */
  symbol?: string | null;
}

// Ownership tiers, largest share first — the original sea-creature ranks. Class
// strings are spelled out statically so Tailwind keeps them. Array position
// lines up with the BANDS array returned by /api/geicko/token-leagues.
interface League {
  pct: number;
  label: string;
  name: string;
  beast: string;
  text: string; // percentage colour
  ring: string; // badge ring colour
  glow: string; // row gradient tint (from-…)
  bar: string; // population bar fill
}
const LEAGUES: League[] = [
  { pct: 0.1,       label: '10%',      name: 'Tsunami', beast: '🌊', text: 'text-amber-300',   ring: 'ring-amber-400/50',   glow: 'from-amber-500/[0.10]',   bar: 'bg-amber-400/70' },
  { pct: 0.01,      label: '1%',       name: 'Whale',   beast: '🐋', text: 'text-rose-300',    ring: 'ring-rose-400/50',    glow: 'from-rose-500/[0.10]',    bar: 'bg-rose-400/70' },
  { pct: 0.001,     label: '0.1%',     name: 'Shark',   beast: '🦈', text: 'text-violet-300',  ring: 'ring-violet-400/50',  glow: 'from-violet-500/[0.10]',  bar: 'bg-violet-400/70' },
  { pct: 0.0001,    label: '0.01%',    name: 'Dolphin', beast: '🐬', text: 'text-indigo-300',  ring: 'ring-indigo-400/50',  glow: 'from-indigo-500/[0.10]',  bar: 'bg-indigo-400/70' },
  { pct: 0.00001,   label: '0.001%',   name: 'Squid',   beast: '🦑', text: 'text-cyan-300',    ring: 'ring-cyan-400/50',    glow: 'from-cyan-500/[0.10]',    bar: 'bg-cyan-400/70' },
  { pct: 0.000001,  label: '0.0001%',  name: 'Turtle',  beast: '🐢', text: 'text-emerald-300', ring: 'ring-emerald-400/50', glow: 'from-emerald-500/[0.10]', bar: 'bg-emerald-400/70' },
  { pct: 0.0000001, label: '0.00001%', name: 'Crab',    beast: '🦀', text: 'text-slate-300',   ring: 'ring-slate-400/40',   glow: 'from-slate-500/[0.08]',   bar: 'bg-slate-400/70' },
];

interface BandRow {
  index: number;
  pct: number;
  count: number;
  exact: boolean;
  supplyHeldPct: number;
}
interface LeaguesResponse {
  totalHolders: number | null;
  scanned: number;
  complete: boolean;
  bands: BandRow[];
  you: { address: string; balance: number; pct: number; bandIndex: number } | null;
}

const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;

const formatUsd = (v: number): string =>
  v >= 1000 ? `$${formatAbbrev(v)}` : `$${v.toFixed(2)}`;

const formatCount = (n: number, exact: boolean): string =>
  `${n >= 1000 ? formatAbbrev(n) : n.toLocaleString()}${exact ? '' : '+'}`;

const rarity = (count: number, total: number | null): string | null => {
  if (!total || total <= 0 || count <= 0) return null;
  const p = (count / total) * 100;
  if (p >= 1) return `${p.toFixed(0)}%`;
  if (p >= 0.01) return `${p.toFixed(2)}%`;
  return '<0.01%';
};

/**
 * "Token Leagues" — the ownership ranks: each creature tier's entry threshold,
 * how many holders are that creature (population), how rare that is, and how
 * much of the supply the tier holds together. Populations come from a cached
 * daily snapshot; the ladder values are computed from supply × price.
 */
export default function GeickoTokenLeaguesPanel({
  token,
  totalSupply,
  priceUsd,
  symbol,
}: GeickoTokenLeaguesPanelProps) {
  const [data, setData] = useState<LeaguesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkAddr, setCheckAddr] = useState('');
  const [you, setYou] = useState<LeaguesResponse['you']>(null);
  const [youLoading, setYouLoading] = useState(false);
  const [youError, setYouError] = useState<string | null>(null);

  // Fetch tier populations for this token.
  useEffect(() => {
    if (!token || !ADDRESS_RX.test(token)) return;
    let cancelled = false;
    setLoading(true);
    setData(null);
    setYou(null);
    setYouError(null);
    setCheckAddr('');
    fetch(`/api/geicko/token-leagues?token=${token}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: LeaguesResponse | null) => {
        if (!cancelled) setData(j);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const rows = useMemo(() => {
    const decimals = totalSupply?.decimals ?? 18;
    const supply = totalSupply?.supply
      ? Number(totalSupply.supply) / Math.pow(10, decimals)
      : 0;
    const price = Number(priceUsd ?? 0);
    if (!(supply > 0)) return null;
    const byIndex = new Map((data?.bands ?? []).map((b) => [b.index, b]));
    // Log-scaled population bars so a tier of 1 stays visible next to a tier of
    // hundreds of thousands.
    const counts = (data?.bands ?? []).map((b) => b.count);
    const maxLog = Math.log10(Math.max(1, ...counts) + 1) || 1;
    return LEAGUES.map((l, i) => {
      const tokens = supply * l.pct;
      const band = byIndex.get(i);
      const count = band?.count ?? null;
      const barW =
        count && count > 0 ? Math.max(6, Math.round((Math.log10(count + 1) / maxLog) * 100)) : 0;
      return {
        index: i,
        ...l,
        tokens,
        usd: price > 0 ? tokens * price : 0,
        hasPrice: price > 0,
        count,
        exact: band?.exact ?? false,
        supplyHeldPct: band?.supplyHeldPct ?? null,
        rarity: count != null ? rarity(count, data?.totalHolders ?? null) : null,
        barW,
      };
    });
  }, [totalSupply, priceUsd, data]);

  const checkRank = () => {
    const addr = checkAddr.trim().toLowerCase();
    if (!ADDRESS_RX.test(addr)) {
      setYouError('Enter a valid 0x address');
      setYou(null);
      return;
    }
    setYouError(null);
    setYouLoading(true);
    fetch(`/api/geicko/token-leagues?token=${token}&holder=${addr}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: LeaguesResponse | null) => {
        if (j?.you) {
          setYou(j.you);
        } else {
          setYou(null);
          setYouError('No balance found for that address');
        }
      })
      .catch(() => setYouError('Lookup failed'))
      .finally(() => setYouLoading(false));
  };

  if (!rows) return null;
  const sym = (symbol || '').toUpperCase();
  const youIndex = you && you.bandIndex >= 0 ? you.bandIndex : -1;
  const youBand = youIndex >= 0 ? LEAGUES[youIndex] : null;

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--line)] bg-gradient-to-r from-amber-500/[0.06] to-transparent">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-lg ring-1 ring-amber-400/30" aria-hidden>
          🏆
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[var(--text)] leading-tight">Token Leagues</h3>
          <p className="text-[11px] text-[var(--text-faint)]">Holder ranks by share of supply</p>
        </div>
        {data?.totalHolders != null && (
          <div className="ml-auto text-right">
            <div className="text-sm font-bold text-[var(--text)] tabular-nums leading-none">
              {formatAbbrev(data.totalHolders)}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">holders</div>
          </div>
        )}
      </div>

      {/* Your rank */}
      <div className="px-3 pt-3">
        <div className="flex items-center gap-2">
          <input
            value={checkAddr}
            onChange={(e) => setCheckAddr(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && checkRank()}
            placeholder="Your address — find your rank"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 font-mono text-[12px] text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-amber-400/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={checkRank}
            disabled={youLoading}
            className="shrink-0 rounded-lg bg-amber-500/15 px-3 py-2 text-[12px] font-semibold text-amber-300 ring-1 ring-amber-400/30 transition-colors hover:bg-amber-500/25 disabled:opacity-50"
          >
            {youLoading ? '…' : 'Check'}
          </button>
        </div>
        {youError && <p className="mt-1.5 text-[11px] text-rose-300">{youError}</p>}
        {youBand && you && (
          <div className={`mt-2 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-gradient-to-r ${youBand.glow} to-transparent px-3 py-2.5`}>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--panel)] text-lg ring-2 ${youBand.ring}`} aria-hidden>
              {youBand.beast}
            </span>
            <div className="min-w-0">
              <div className="text-[13px] text-[var(--text)]">
                You&apos;re a <span className={`font-bold ${youBand.text}`}>{youBand.name}</span>
              </div>
              <div className="font-mono text-[11px] text-[var(--text-muted)]">
                {formatAbbrev(you.balance)}{sym ? ` ${sym}` : ''} · {you.pct >= 0.01 ? you.pct.toFixed(2) : you.pct.toFixed(4)}% of supply
              </div>
            </div>
          </div>
        )}
        {you && you.bandIndex < 0 && (
          <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
            That wallet holds too little to rank — below the 🦀 Crab tier.
          </p>
        )}
      </div>

      {/* Tier ladder */}
      <ul className="p-2 space-y-1.5">
        {rows.map((r) => {
          const isMine = r.index === youIndex;
          return (
            <li
              key={r.label}
              className={`flex items-center gap-3 rounded-xl border bg-gradient-to-r ${r.glow} to-transparent px-2.5 py-2 ${
                isMine ? 'border-amber-400/50 ring-1 ring-amber-400/30' : 'border-[var(--line)]'
              }`}
            >
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--panel)] text-xl ring-2 ${r.ring}`}
                aria-hidden
              >
                {r.beast}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-sm font-bold ${r.text}`}>{r.name}</span>
                  <span className="text-[11px] font-medium text-[var(--text-faint)]">≥ {r.label}</span>
                  {isMine && (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300">
                      you
                    </span>
                  )}
                </div>
                <div className="font-mono text-[11px] text-[var(--text-muted)]">
                  {formatAbbrev(r.tokens)}
                  {sym ? ` ${sym}` : ''}
                  {r.hasPrice ? ` · ${formatUsd(r.usd)}` : ''}
                </div>
                {/* Population bar */}
                {r.count != null && r.count > 0 && (
                  <div className="mt-1.5 h-1 w-full max-w-[180px] overflow-hidden rounded-full bg-[var(--panel)]">
                    <div className={`h-full ${r.bar}`} style={{ width: `${r.barW}%` }} />
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                {loading && r.count == null ? (
                  <div className="ml-auto h-4 w-10 animate-pulse rounded bg-[var(--panel)]" />
                ) : r.count != null ? (
                  <>
                    <div className="text-[15px] font-bold text-[var(--text)] tabular-nums leading-none">
                      {formatCount(r.count, r.exact)}
                    </div>
                    <div className="text-[9px] uppercase tracking-wide text-[var(--text-faint)]">
                      {r.count === 1 ? 'holder' : 'holders'}
                      {r.rarity ? ` · ${r.rarity}` : ''}
                    </div>
                    {r.supplyHeldPct != null && r.supplyHeldPct > 0 && (
                      <div className="mt-0.5 text-[10px] text-[var(--text-muted)] tabular-nums">
                        holds {r.supplyHeldPct >= 0.1 ? r.supplyHeldPct.toFixed(1) : r.supplyHeldPct.toFixed(2)}%
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-[var(--text-faint)]">—</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Footnote */}
      {data && !data.complete && (
        <p className="px-4 pb-3 text-[10px] leading-relaxed text-[var(--text-faint)]">
          Counts marked “+” are a floor — the smaller tiers run into the hundreds of thousands, so we
          count the top {formatAbbrev(data.scanned)} holders exactly and report the long tail as “at least”.
          Refreshed daily.
        </p>
      )}
    </div>
  );
}
