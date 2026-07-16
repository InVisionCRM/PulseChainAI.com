'use client';

import React, { useEffect, useState } from 'react';
import { getChain } from '@/lib/chains/registry';
import { ROBINHOOD_TOKENS } from '@/lib/launchpads';
import { formatCurrencyCompact } from '@/components/geicko/utils';
import type { RobinhoodToken } from '@/app/api/robinhood/top-tokens/route';

// Live "popular tokens" on Robinhood Chain — roster from the Robinhood
// Blockscout, market data from DexScreener (both free; no Moralis). Shared by
// the RH Launchpads page and the home page so the card/fetch logic lives once.

const EXPLORER = getChain('robinhood').explorerUrl; // https://robinhoodchain.blockscout.com
const tokenUrl = (a: string) => `${EXPLORER}/token/${a}`;
const addrUrl = (a: string) => `${EXPLORER}/address/${a}`;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const fmtPrice = (v: number | null): string => {
  if (v == null || !Number.isFinite(v) || v <= 0) return '—';
  if (v >= 1) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toPrecision(2)}`;
};

function TokenLogo({ src, symbol }: { src: string | null; symbol: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--text-muted)]">
        {(symbol || '?').slice(0, 3).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={symbol}
      onError={() => setFailed(true)}
      className="h-8 w-8 shrink-0 rounded-full bg-[var(--surface-2)] object-cover"
    />
  );
}

function TokenCard({ t }: { t: RobinhoodToken }) {
  const change = t.priceChange24;
  return (
    <a
      href={tokenUrl(t.address)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-2)]"
      title={`${t.name} — view on explorer`}
    >
      <div className="flex items-center gap-2">
        <TokenLogo src={t.logo} symbol={t.symbol} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[var(--text)]">{t.symbol}</div>
          <div className="truncate text-[11px] text-[var(--text-faint)]">{t.name}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold text-[var(--text)]">{fmtPrice(t.priceUsd)}</div>
          {change != null && change !== 0 && (
            <div className={`text-[11px] font-semibold ${change >= 0 ? 'text-[#00C805]' : 'text-red-400'}`}>
              {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
        <span>
          Vol <span className="font-medium text-[var(--text)]">{formatCurrencyCompact(t.volume24)}</span>
        </span>
        <span>
          Liq <span className="font-medium text-[var(--text)]">{formatCurrencyCompact(t.liquidityUsd)}</span>
        </span>
        {t.holders != null && (
          <span>
            Holders <span className="font-medium text-[var(--text)]">{t.holders.toLocaleString()}</span>
          </span>
        )}
      </div>
    </a>
  );
}

function CoreTokenFallback() {
  const core = Object.entries(ROBINHOOD_TOKENS);
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="mb-3 text-xs text-[var(--text-faint)]">
        Live market data is momentarily unavailable — showing core token addresses.
      </p>
      <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
        {core.map(([symbol, address]) => (
          <div key={address} className="flex items-center justify-between gap-2 py-1">
            <span className="text-xs text-[var(--text-muted)]">{symbol}</span>
            <a
              href={addrUrl(address)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-[var(--text)] underline decoration-dotted underline-offset-2 hover:text-[#00C805]"
              title={address}
            >
              {short(address)}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface RobinhoodTopTokensProps {
  /** Cap the number of tokens shown (e.g. the home page wants a compact strip). */
  limit?: number;
}

export default function RobinhoodTopTokens({ limit }: RobinhoodTopTokensProps) {
  const [tokens, setTokens] = useState<RobinhoodToken[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/robinhood/top-tokens')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        const list = Array.isArray(d?.tokens) ? (d.tokens as RobinhoodToken[]) : [];
        if (list.length > 0) setTokens(list);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  if (!tokens && !failed) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: limit ?? 6 }).map((_, i) => (
          <div key={i} className="h-[92px] animate-pulse rounded-xl border border-[var(--line)] bg-[var(--surface)]" />
        ))}
      </div>
    );
  }

  if (failed || !tokens) return <CoreTokenFallback />;

  const shown = typeof limit === 'number' ? tokens.slice(0, limit) : tokens;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map((t) => (
        <TokenCard key={t.address} t={t} />
      ))}
    </div>
  );
}
