'use client';

// Mobile watchlist — a bottom sheet listing the user's starred tokens with live
// price / 24h change / liquidity from /api/watchlist (same source the screener
// watchlist tab uses). Tapping a row opens it in the geicko analyzer.

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconStarFilled, IconX } from '@tabler/icons-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import AdBanner from '@/components/ads/AdBanner';
import { useScreenerWatchlist } from './Screener/watchlist';
import { fmtPrice, fmtUsd, fmtPct, pctClass } from './Screener/format';
import type { ScreenerRow } from '@/lib/screener/types';
import type { WatchedToken } from '@/lib/stores/watchlistStore';

const CHAIN_TAG: Record<string, string> = { pulsechain: 'PLS', robinhood: 'RH', ethereum: 'ETH' };

function geickoHref(address: string, chain: string): string {
  return chain === 'pulsechain' ? `/geicko?address=${address}` : `/geicko?address=${address}&network=${chain}`;
}

function RowLogo({ url, symbol }: { url?: string | null; symbol: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-semibold text-[var(--text-muted)]">
        {(symbol || '?').charAt(0)}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-8 w-8 shrink-0 rounded-full" onError={() => setFailed(true)} loading="lazy" />;
}

export default function WatchlistModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const watchlist = useScreenerWatchlist();
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [loading, setLoading] = useState(false);

  const param = watchlist.tokens.map((t) => `${t.chain}:${t.address}`).join(',');

  useEffect(() => {
    if (!open || !param) {
      if (!param) setRows([]);
      return;
    }
    let alive = true;
    setLoading(true);
    fetch(`/api/watchlist?tokens=${encodeURIComponent(param)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive) setRows(Array.isArray(d?.rows) ? d.rows : []);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, param]);

  const go = (address: string, chain: string) => {
    onClose();
    router.push(geickoHref(address, chain));
  };

  const rowFor = (t: WatchedToken): ScreenerRow | undefined =>
    rows.find((r) => (r.baseAddress ?? '').toLowerCase() === t.address && (r.chainId ?? 'pulsechain') === t.chain);

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DrawerContent className="bg-gradient-to-b from-[var(--panel)] to-[var(--surface-2)] border-[var(--line)]">
        <DrawerHeader className="border-b border-[var(--line)]">
          <DrawerTitle className="text-[var(--text)] text-xl font-semibold">Watchlist</DrawerTitle>
          <DrawerClose className="absolute right-4 top-4">
            <IconX className="h-5 w-5 text-[var(--text-muted)]" />
          </DrawerClose>
        </DrawerHeader>

        <div className="p-3 overflow-y-auto max-h-[65vh]">
          {/* Promo ad slot on top of the watchlist. */}
          <div className="mb-3">
            <AdBanner />
          </div>
          {loading && rows.length === 0 ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-[var(--surface)] animate-pulse" />
              ))}
            </div>
          ) : watchlist.tokens.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--text-faint)]">
              Your watchlist is empty — star any token to add it.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {watchlist.tokens.map((t) => {
                const row = rowFor(t);
                return (
                  <li key={`${t.chain}:${t.address}`}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => go(t.address, t.chain)}
                      onKeyDown={(e) => { if (e.key === 'Enter') go(t.address, t.chain); }}
                      className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                    >
                      <RowLogo url={row?.imageUrl ?? t.logoURI} symbol={row?.baseSymbol ?? t.symbol} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[var(--text)] truncate">{row?.baseSymbol ?? t.symbol}</span>
                          <span className="shrink-0 rounded bg-[var(--surface-2)] px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                            {CHAIN_TAG[t.chain] ?? t.chain}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--text-faint)] truncate">
                          {row?.liquidityUsd != null ? `Liq ${fmtUsd(row.liquidityUsd)}` : (row?.baseName ?? t.name)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold text-[var(--text)] tabular-nums">{row ? fmtPrice(row.priceUsd) : '—'}</div>
                        {row && <div className={`text-xs tabular-nums ${pctClass(row.chg?.h24)}`}>{fmtPct(row.chg?.h24)}</div>}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          watchlist.toggle({ address: t.address, chain: t.chain, symbol: t.symbol, name: t.name });
                        }}
                        aria-label={`Remove ${t.symbol} from watchlist`}
                        className="shrink-0 text-orange-400 hover:text-orange-300 transition-colors"
                      >
                        <IconStarFilled className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
