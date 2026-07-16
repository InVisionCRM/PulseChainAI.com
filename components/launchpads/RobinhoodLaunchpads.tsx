'use client';

import React, { useEffect, useState } from 'react';
import {
  IconRocket,
  IconExternalLink,
  IconCopy,
  IconCheck,
  IconCircleCheck,
  IconClock,
} from '@tabler/icons-react';
import { getChain } from '@/lib/chains/registry';
import {
  launchpadsForChain,
  ROBINHOOD_TOKENS,
  type Launchpad,
} from '@/lib/launchpads';
import { formatCurrencyCompact } from '@/components/geicko/utils';
import type { RobinhoodToken } from '@/app/api/robinhood/top-tokens/route';

const CHAIN = getChain('robinhood');
const EXPLORER = CHAIN.explorerUrl; // https://robinhoodchain.blockscout.com
const addrUrl = (a: string) => `${EXPLORER}/address/${a}`;
const tokenUrl = (a: string) => `${EXPLORER}/token/${a}`;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const fmtPrice = (v: number | null): string => {
  if (v == null || !Number.isFinite(v) || v <= 0) return '—';
  if (v >= 1) return `$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toPrecision(2)}`;
};

const DEX_LABEL: Record<string, string> = {
  'uniswap-v3': 'Uniswap V3',
  'uniswap-v4': 'Uniswap V4',
  unknown: 'DEX TBD',
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard unavailable — no-op */
        }
      }}
      aria-label={`Copy ${value}`}
      title="Copy address"
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
    >
      {copied ? (
        <IconCheck className="h-3.5 w-3.5 text-[#00C805]" />
      ) : (
        <IconCopy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function AddressRow({ label, address }: { label: string; address: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <span className="flex items-center gap-1">
        <a
          href={addrUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-[var(--text)] underline decoration-dotted underline-offset-2 hover:text-[#00C805]"
          title={address}
        >
          {short(address)}
        </a>
        <CopyButton value={address} />
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: Launchpad['status'] }) {
  const active = status === 'active';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={
        active
          ? {
              backgroundColor: 'rgba(0, 200, 5, 0.15)',
              color: '#7ef29b',
            }
          : {
              backgroundColor: 'rgba(148, 163, 184, 0.15)',
              color: 'var(--text-muted)',
            }
      }
    >
      {active ? (
        <IconCircleCheck className="h-3 w-3" />
      ) : (
        <IconClock className="h-3 w-3" />
      )}
      {active ? 'Verified' : 'Pending'}
    </span>
  );
}

function LaunchpadCard({ pad }: { pad: Launchpad }) {
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <a
            href={pad.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 text-lg font-semibold text-[var(--text)] hover:text-[#00C805]"
          >
            {pad.name}
            <IconExternalLink className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
          </a>
          <div className="mt-1 text-xs text-[var(--text-faint)]">
            {DEX_LABEL[pad.dexVersion] ?? pad.dexVersion}
          </div>
        </div>
        <StatusBadge status={pad.status} />
      </div>

      <p className="mb-3 text-sm leading-relaxed text-[var(--text-muted)]">
        {pad.description}
      </p>

      {pad.contracts.length > 0 ? (
        <div className="mt-auto rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 px-3 py-2">
          {pad.contracts.map((c) => (
            <AddressRow key={c.address} label={c.label} address={c.address} />
          ))}
        </div>
      ) : (
        <div className="mt-auto rounded-xl border border-dashed border-[var(--line)] px-3 py-2 text-xs text-[var(--text-faint)]">
          {pad.notes ?? 'No published contract addresses yet.'}
        </div>
      )}

      {pad.contracts.length > 0 && pad.notes ? (
        <p className="mt-2 text-[11px] leading-snug text-[var(--text-faint)]">
          {pad.notes}
        </p>
      ) : null}
    </div>
  );
}

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

// Live "popular tokens" on Robinhood Chain — roster from Blockscout, market data
// from DexScreener (both free). Falls back to the static core-token reference if
// the live feed is unavailable, so the section never renders empty.
function TopTokens() {
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

  // Loading skeleton.
  if (!tokens && !failed) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[92px] animate-pulse rounded-xl border border-[var(--line)] bg-[var(--surface)]" />
        ))}
      </div>
    );
  }

  // Live feed unavailable → fall back to the static core-token reference.
  if (failed || !tokens) {
    const core = Object.entries(ROBINHOOD_TOKENS);
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <p className="mb-3 text-xs text-[var(--text-faint)]">
          Live market data is momentarily unavailable — showing core token addresses.
        </p>
        <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {core.map(([symbol, address]) => (
            <AddressRow key={address} label={symbol} address={address} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tokens.map((t) => (
        <TokenCard key={t.address} t={t} />
      ))}
    </div>
  );
}

export default function RobinhoodLaunchpads() {
  const pads = launchpadsForChain('robinhood');
  const active = pads.filter((p) => p.status === 'active');
  const pending = pads.filter((p) => p.status === 'pending');

  return (
    <div className="min-h-screen bg-[var(--panel)] text-[var(--text)]">
      {/* Header */}
      <div className="border-b border-[var(--line)] bg-gradient-to-r from-[var(--panel)] to-[#052e10] px-4 py-8 md:px-6 md:py-12">
        <div className="mx-auto max-w-6xl text-center">
          <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-5xl">
            Robinhood Chain Launchpads
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-[var(--text-muted)] md:text-lg">
            Token-launch protocols on Robinhood Chain — the Arbitrum Orbit L2.
            Verified factory and locker addresses link straight to the explorer.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#00C805]/10 px-4 py-2 text-sm text-[#00C805]">
              <IconRocket className="h-4 w-4" />
              Chain ID {CHAIN.chainId} · {CHAIN.nativeSymbol} gas
            </span>
            <a
              href={EXPLORER}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-4 py-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            >
              <IconExternalLink className="h-4 w-4" />
              Blockscout Explorer
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
        {/* Active pads */}
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Live launchpads ({active.length})
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {active.map((pad) => (
            <LaunchpadCard key={pad.id} pad={pad} />
          ))}
        </div>

        {/* Pending pads */}
        {pending.length > 0 && (
          <>
            <h2 className="mb-4 mt-10 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Announced / pending ({pending.length})
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pending.map((pad) => (
                <LaunchpadCard key={pad.id} pad={pad} />
              ))}
            </div>
          </>
        )}

        {/* Popular tokens (live) */}
        <div className="mb-4 mt-10 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Popular tokens
          </h2>
          <span className="text-[11px] text-[var(--text-faint)]">
            Live · ranked by 24h volume
          </span>
        </div>
        <TopTokens />

        <p className="mt-6 text-xs leading-relaxed text-[var(--text-faint)]">
          Popular tokens are ranked live by 24h trading volume — roster from the
          Robinhood Chain explorer, market data from DexScreener. Per-token
          bonding-curve contracts are deployed on each launch and aren&apos;t
          predictable in advance — resolve them from the factory&apos;s launch
          events. Not financial advice; always verify contracts independently
          before interacting.
        </p>
      </div>
    </div>
  );
}
