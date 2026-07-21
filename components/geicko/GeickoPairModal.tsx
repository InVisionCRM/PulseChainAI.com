'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { IconX, IconCheck, IconExternalLink } from '@tabler/icons-react';
import { resolveTokenIcon } from '@/lib/services/token-icon-resolver';
import { formatCurrencyCompact } from '@/components/geicko/utils';
import { fmtAmount } from '@/lib/format';
import { pulsechainAddressUrl } from '@/lib/pulsechainExplorer';
import { dexLogo, dexName } from '@/components/Screener/format';

// A trading-pair to render. Fields are optional because the list can come from
// either GeckoTerminal or DexScreener (already normalised by the page).
export interface PairLike {
  pairAddress?: string;
  dexId?: string;
  priceUsd?: string | number;
  pairCreatedAt?: number;
  baseToken?: { address?: string; symbol?: string; name?: string; logoURI?: string };
  quoteToken?: { address?: string; symbol?: string; logoURI?: string };
  liquidity?: { usd?: number; base?: number; quote?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  info?: { imageUrl?: string };
}

interface LpInfo {
  burnedPct: number | null;
  holders: number | null;
}

export interface GeickoPairModalProps {
  isOpen: boolean;
  pairs: PairLike[];
  selectedPairAddress: string | null;
  onSelect: (pairAddress: string) => void;
  onClose: () => void;
}

const fmtDate = (ms?: number): string => {
  if (!ms || !Number.isFinite(ms)) return '—';
  try {
    return new Date(ms).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    });
  } catch {
    return '—';
  }
};

const fmtPrice = (v?: string | number): string => {
  const p = Number(v ?? 0);
  if (!Number.isFinite(p) || p <= 0) return '—';
  return `$${p >= 1 ? p.toFixed(4) : p.toFixed(6)}`;
};

// ── token logo (resolves via DexScreener hint, falls back to an initial) ─────
function TokenLogo({
  address,
  hint,
  symbol,
  size = 22,
  className = '',
}: {
  address?: string;
  hint?: string | null;
  symbol?: string;
  size?: number;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(hint ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    if (hint) {
      setSrc(hint);
      return;
    }
    if (!address) return;
    resolveTokenIcon(address, 'pulsechain').then((url) => {
      if (alive && url) setSrc(url);
    });
    return () => {
      alive = false;
    };
  }, [address, hint]);

  const dim = { width: size, height: size };
  if (!src || failed) {
    return (
      <span
        style={dim}
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--surface-3)] text-[9px] font-semibold text-[var(--text-muted)] ring-2 ring-[var(--panel)] ${className}`}
      >
        {(symbol || '?').slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={symbol || ''}
      style={dim}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full bg-[var(--surface-2)] object-cover ring-2 ring-[var(--panel)] ${className}`}
    />
  );
}

// ── DEX logo (DexScreener per-dex icon, falls back to nothing on 404) ─────────
function DexLogo({ dexId }: { dexId: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dexLogo(dexId)}
      alt=""
      onError={() => setFailed(true)}
      className="h-3.5 w-3.5 shrink-0 rounded-full bg-[var(--surface-2)] object-cover"
    />
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">{label}</div>
      <div className="truncate text-sm font-semibold text-[var(--text)]">{value}</div>
    </div>
  );
}

export default function GeickoPairModal({
  isOpen,
  pairs,
  selectedPairAddress,
  onSelect,
  onClose,
}: GeickoPairModalProps) {
  const [lpInfo, setLpInfo] = useState<Record<string, LpInfo>>({});

  const sorted = useMemo(
    () =>
      [...pairs]
        .filter((p) => p.pairAddress)
        .sort((a, b) => Number(b?.liquidity?.usd ?? 0) - Number(a?.liquidity?.usd ?? 0)),
    [pairs],
  );

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Fetch burn % + LP holders for the visible pairs when opened.
  useEffect(() => {
    if (!isOpen) return;
    const addresses = sorted.map((p) => p.pairAddress).filter(Boolean) as string[];
    if (addresses.length === 0) return;
    let alive = true;
    fetch('/api/geicko/lp-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.info) setLpInfo(d.info as Record<string, LpInfo>);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [isOpen, sorted]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Select trading pair"
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">Trading pairs</h2>
            <p className="text-xs text-[var(--text-faint)]">
              {sorted.length} pair{sorted.length === 1 ? '' : 's'} · sorted by liquidity
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {/* Pair list */}
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {sorted.map((p) => {
            const addr = p.pairAddress as string;
            const selected = !!selectedPairAddress && addr.toLowerCase() === selectedPairAddress.toLowerCase();
            const baseSym = p.baseToken?.symbol || '?';
            const quoteSym = p.quoteToken?.symbol || '?';
            const info = lpInfo[addr.toLowerCase()] ?? lpInfo[addr];
            const change = Number(p.priceChange?.h24 ?? 0);
            const liqUsd = Number(p.liquidity?.usd ?? 0);
            const base = Number(p.liquidity?.base ?? 0);
            const quote = Number(p.liquidity?.quote ?? 0);

            return (
              <button
                key={addr}
                type="button"
                onClick={() => {
                  onSelect(addr);
                  onClose();
                }}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  selected
                    ? 'border-[var(--line-strong)] bg-[var(--surface-2)]'
                    : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-2)]'
                }`}
              >
                {/* Top row: logos + symbols + dex, price + change */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex items-center -space-x-2">
                      <TokenLogo
                        address={p.baseToken?.address}
                        hint={p.baseToken?.logoURI || p.info?.imageUrl}
                        symbol={baseSym}
                        className="relative z-10"
                      />
                      <TokenLogo address={p.quoteToken?.address} hint={p.quoteToken?.logoURI} symbol={quoteSym} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-bold text-[var(--text)]">
                          {baseSym} <span className="text-[var(--text-faint)]">/</span> {quoteSym}
                        </span>
                        {selected && <IconCheck className="h-3.5 w-3.5 shrink-0 text-[var(--up)]" />}
                      </span>
                      {p.dexId && (
                        <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                          <DexLogo dexId={p.dexId} />
                          {dexName(p.dexId)}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold text-[var(--text)]">{fmtPrice(p.priceUsd)}</div>
                    {Number.isFinite(change) && change !== 0 && (
                      <div className={`text-xs font-semibold ${change >= 0 ? 'text-[var(--up)]' : 'text-red-400'}`}>
                        {change >= 0 ? '↑' : '↓'}
                        {Math.abs(change).toFixed(2)}%
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats grid */}
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                  <Stat label="Liquidity" value={liqUsd > 0 ? formatCurrencyCompact(liqUsd) : '—'} />
                  <Stat label="Created" value={fmtDate(p.pairCreatedAt)} />
                  <Stat
                    label="LP burned"
                    value={
                      info?.burnedPct != null ? (
                        <span className={info.burnedPct >= 90 ? 'text-[var(--up)]' : undefined}>
                          {info.burnedPct.toFixed(info.burnedPct >= 99.95 ? 0 : 1)}%
                        </span>
                      ) : (
                        <span className="text-[var(--text-faint)]">…</span>
                      )
                    }
                  />
                  <Stat
                    label="LP holders"
                    value={
                      info?.holders != null ? (
                        info.holders.toLocaleString()
                      ) : (
                        <span className="text-[var(--text-faint)]">…</span>
                      )
                    }
                  />
                </div>

                {/* Pooled reserves (weight of each side), when available */}
                {(base > 0 || quote > 0) && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                    <span className="text-[var(--text-faint)]">Pooled</span>
                    <span className="font-medium text-[var(--text)]">
                      {fmtAmount(base)} {baseSym}
                    </span>
                    <span className="text-[var(--text-faint)]">·</span>
                    <span className="font-medium text-[var(--text)]">
                      {fmtAmount(quote)} {quoteSym}
                    </span>
                    <a
                      href={pulsechainAddressUrl(addr)}
                      onClick={(e) => e.stopPropagation()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto inline-flex items-center gap-0.5 text-[var(--text-faint)] hover:text-[var(--text)]"
                      title="View LP on explorer"
                    >
                      <IconExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
