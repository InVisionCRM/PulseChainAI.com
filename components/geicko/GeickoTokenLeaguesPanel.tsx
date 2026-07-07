import React, { useMemo } from 'react';
import { formatAbbrev } from './utils';

export interface GeickoTokenLeaguesPanelProps {
  /** Raw total supply + decimals (from token metrics). */
  totalSupply: { supply: string; decimals: number } | null;
  /** Token price in USD (string or number, e.g. DexScreener priceUsd). */
  priceUsd: string | number | null | undefined;
}

// Ownership tiers, largest first. Each is a fraction of total supply with an
// emoji "rank" — the more of the supply you'd need, the bigger the sea creature.
const LEAGUES: Array<{ pct: number; emoji: string; label: string }> = [
  { pct: 0.1, emoji: '🌊', label: '10%' },
  { pct: 0.01, emoji: '🐋', label: '1%' },
  { pct: 0.001, emoji: '🦈', label: '0.1%' },
  { pct: 0.0001, emoji: '🐬', label: '0.01%' },
  { pct: 0.00001, emoji: '🦑', label: '0.001%' },
  { pct: 0.000001, emoji: '🐢', label: '0.0001%' },
  { pct: 0.0000001, emoji: '🦀', label: '0.00001%' },
];

const formatUsd = (v: number): string => {
  if (v >= 1000) return `$${formatAbbrev(v)}`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(2)}`;
};

/**
 * "Token Leagues" — how much of the supply (and its USD value) each tier of
 * ownership represents. Pure computation from total supply × price, so it needs
 * no extra data beyond what the sidebar already has.
 */
export default function GeickoTokenLeaguesPanel({
  totalSupply,
  priceUsd,
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
      return {
        ...l,
        tokens,
        usd: price > 0 ? tokens * price : 0,
        hasPrice: price > 0,
      };
    });
  }, [totalSupply, priceUsd]);

  if (!rows) return null;

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="text-lg" aria-hidden>🏆</span>
        <h3 className="text-sm font-semibold text-[var(--text)]">Token Leagues</h3>
      </div>
      <div className="grid grid-cols-[1fr_auto] px-4 py-2 border-y border-[var(--line)] bg-white/[0.02]">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
          League
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)] text-right">
          USD Value
        </span>
      </div>
      <ul>
        {rows.map((r) => (
          <li
            key={r.label}
            className="grid grid-cols-[1fr_auto] items-center px-4 py-2.5 border-b border-[var(--line)] last:border-0"
          >
            <span className="flex items-center gap-2.5">
              <span className="text-base" aria-hidden>{r.emoji}</span>
              <span className="text-sm font-medium text-[var(--text)]">{r.label}</span>
            </span>
            <span className="text-right leading-tight">
              <span className="block text-sm font-semibold text-emerald-400">
                {r.hasPrice ? formatUsd(r.usd) : '—'}
              </span>
              <span className="block text-xs text-[var(--text-faint)]">
                {formatAbbrev(r.tokens)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
