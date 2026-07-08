import React, { useMemo } from 'react';
import { formatAbbrev } from './utils';

export interface GeickoTokenLeaguesPanelProps {
  /** Raw total supply + decimals (from token metrics). */
  totalSupply: { supply: string; decimals: number } | null;
  /** Token price in USD (string or number, e.g. DexScreener priceUsd). */
  priceUsd: string | number | null | undefined;
  /** Token symbol, shown next to the token amount (optional). */
  symbol?: string | null;
}

// Ownership tiers, largest share first. Our own rank ladder — a mythic-beast
// hierarchy with rarity-style names and per-tier colours — rather than the
// generic sea-creature set. Class strings are spelled out statically so Tailwind
// keeps them.
interface League {
  pct: number;
  label: string;
  beast: string;
  rank: string;
  text: string; // rank name colour
  ring: string; // badge ring colour
  glow: string; // row gradient tint (from-…)
}
const LEAGUES: League[] = [
  { pct: 0.1,       label: '10%',      beast: '🐉', rank: 'Sovereign', text: 'text-amber-300',   ring: 'ring-amber-400/50',   glow: 'from-amber-500/[0.10]' },
  { pct: 0.01,      label: '1%',       beast: '🦅', rank: 'Mythic',    text: 'text-rose-300',    ring: 'ring-rose-400/50',    glow: 'from-rose-500/[0.10]' },
  { pct: 0.001,     label: '0.1%',     beast: '🦁', rank: 'Legendary', text: 'text-violet-300',  ring: 'ring-violet-400/50',  glow: 'from-violet-500/[0.10]' },
  { pct: 0.0001,    label: '0.01%',    beast: '🐺', rank: 'Epic',      text: 'text-indigo-300',  ring: 'ring-indigo-400/50',  glow: 'from-indigo-500/[0.10]' },
  { pct: 0.00001,   label: '0.001%',   beast: '🦊', rank: 'Rare',      text: 'text-cyan-300',    ring: 'ring-cyan-400/50',    glow: 'from-cyan-500/[0.10]' },
  { pct: 0.000001,  label: '0.0001%',  beast: '🦉', rank: 'Uncommon',  text: 'text-emerald-300', ring: 'ring-emerald-400/50', glow: 'from-emerald-500/[0.10]' },
  { pct: 0.0000001, label: '0.00001%', beast: '🐭', rank: 'Common',    text: 'text-slate-300',   ring: 'ring-slate-400/40',   glow: 'from-slate-500/[0.08]' },
];

const formatUsd = (v: number): string =>
  v >= 1000 ? `$${formatAbbrev(v)}` : `$${v.toFixed(2)}`;

/**
 * "Token Leagues" — the ownership ranks: how much of the supply each tier
 * represents and what it's worth. Pure computation from total supply × price.
 */
export default function GeickoTokenLeaguesPanel({
  totalSupply,
  priceUsd,
  symbol,
}: GeickoTokenLeaguesPanelProps) {
  const rows = useMemo(() => {
    const decimals = totalSupply?.decimals ?? 18;
    const supply = totalSupply?.supply
      ? Number(totalSupply.supply) / Math.pow(10, decimals)
      : 0;
    const price = Number(priceUsd ?? 0);
    if (!(supply > 0)) return null;
    return LEAGUES.map((l) => {
      const tokens = supply * l.pct;
      return { ...l, tokens, usd: price > 0 ? tokens * price : 0, hasPrice: price > 0 };
    });
  }, [totalSupply, priceUsd]);

  if (!rows) return null;
  const sym = (symbol || '').toUpperCase();

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--line)] bg-gradient-to-r from-amber-500/[0.06] to-transparent">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-lg ring-1 ring-amber-400/30" aria-hidden>
          🏆
        </span>
        <div>
          <h3 className="text-sm font-bold text-[var(--text)] leading-tight">Token Leagues</h3>
          <p className="text-[11px] text-[var(--text-faint)]">What each share of supply is worth</p>
        </div>
      </div>

      {/* Rank ladder */}
      <ul className="p-2 space-y-1.5">
        {rows.map((r) => (
          <li
            key={r.label}
            className={`flex items-center gap-3 rounded-xl border border-[var(--line)] bg-gradient-to-r ${r.glow} to-transparent px-2.5 py-2`}
          >
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--panel)] text-xl ring-2 ${r.ring}`}
              aria-hidden
            >
              {r.beast}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className={`text-sm font-bold ${r.text}`}>{r.rank}</span>
                <span className="text-[11px] font-medium text-[var(--text-faint)]">≥ {r.label}</span>
              </div>
              <div className="font-mono text-[11px] text-[var(--text-muted)]">
                {formatAbbrev(r.tokens)}
                {sym ? ` ${sym}` : ''}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-[var(--text)]">
                {r.hasPrice ? formatUsd(r.usd) : '—'}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
