'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IconX,
  IconAlertTriangle,
  IconSearch,
  IconRestore,
} from '@tabler/icons-react';
import { usePortfolioStore } from '@/lib/stores/portfolioStore';
import { useManageTokensStore } from '@/lib/stores/manageTokensStore';
import {
  applyTokenVisibility,
  tokenAutoState,
} from '@/lib/portfolio/tokenVisibility';
import type { PortfolioToken } from '@/services';
import { ChainLogo } from '@/components/ui/ChainLogo';

const truncate = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;


const fmtUsd = (n: number | null | undefined) => {
  if (n == null || !Number.isFinite(n) || n === 0) return null;
  if (Math.abs(n) >= 1000) {
    return `$${n.toLocaleString(undefined, {
      notation: 'compact',
      maximumFractionDigits: 2,
    })}`;
  }
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: n < 0.01 ? 6 : 2,
  })}`;
};

const fmtBalance = (n: number) =>
  n.toLocaleString(undefined, {
    maximumFractionDigits: n < 1 ? 6 : 4,
  });

// Rendered once at the portfolio page level. Reads its open/active-wallet
// state from manageTokensStore so any WalletCard can trigger it without
// prop-drilling. Portals to document.body so the fixed overlay can't be
// trapped or clipped by an ancestor's containing block (e.g. a WalletCard's
// backdrop-blur-xl + overflow-hidden).
export function ManageTokensModal() {
  const walletAddress = useManageTokensStore((s) => s.walletAddress);
  const close = useManageTokensStore((s) => s.close);

  const wallet = usePortfolioStore((s) =>
    walletAddress
      ? s.wallets.find((w) => w.address === walletAddress) ?? null
      : null,
  );
  const snapshot = usePortfolioStore((s) =>
    walletAddress ? s.snapshotsByAddress[walletAddress]?.snapshot ?? null : null,
  );
  const settings = usePortfolioStore((s) =>
    walletAddress ? s.walletTokenSettings[walletAddress] : undefined,
  );
  const setTokenHidden = usePortfolioStore((s) => s.setTokenHidden);
  const setTokenForced = usePortfolioStore((s) => s.setTokenForced);
  const setHideDust = usePortfolioStore((s) => s.setHideDust);
  const setDustThreshold = usePortfolioStore((s) => s.setDustThreshold);
  const markSeen = usePortfolioStore((s) => s.markInitialReviewSeen);
  const resetWalletSettings = usePortfolioStore((s) => s.resetWalletSettings);

  const effectiveSettings =
    settings ?? {
      hidden: [],
      forced: [],
      hideDust: true,
      dustThresholdUsd: 1,
      seenInitialReview: false,
    };

  const tokens: PortfolioToken[] = snapshot?.tokens ?? [];
  const walletLabel =
    wallet?.label || (wallet ? truncate(wallet.address) : '');

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'visible' | 'hidden' | 'spam' | 'dust'>(
    'all',
  );

  // Reset transient UI state when the active wallet changes (or the modal
  // closes), and lock body scroll while open.
  useEffect(() => {
    if (!walletAddress) return;
    setQuery('');
    setFilter('all');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', onKey);
    };
  }, [walletAddress, close]);

  const handleClose = () => {
    if (walletAddress) markSeen(walletAddress);
    close();
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const annotated = tokens
      .filter((t) => !t.isNative)
      .map((t) => {
        const auto = tokenAutoState(t, effectiveSettings);
        const addr = t.address.toLowerCase();
        const isHidden = effectiveSettings.hidden.includes(addr);
        const isForced = effectiveSettings.forced.includes(addr);
        const visible = isForced
          ? true
          : isHidden
            ? false
            : !auto.autoHidden;
        return { token: t, auto, isHidden, isForced, visible };
      });
    return annotated.filter(({ token, auto, visible }) => {
      if (q) {
        const matchesQuery =
          token.symbol.toLowerCase().includes(q) ||
          token.name.toLowerCase().includes(q) ||
          token.address.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }
      switch (filter) {
        case 'visible':
          return visible;
        case 'hidden':
          return !visible;
        case 'spam':
          return auto.reason === 'spam';
        case 'dust':
          return auto.reason === 'dust';
        default:
          return true;
      }
    });
  }, [tokens, query, filter, effectiveSettings]);

  const visibleCount = useMemo(
    () => applyTokenVisibility(tokens, effectiveSettings).visible.length,
    [tokens, effectiveSettings],
  );

  // Select-all reflects the *filtered* list: checked when every listed row is
  // shown, indeterminate when only some are. Toggling bulk-shows/hides them —
  // handy for e.g. filtering to "Flagged spam" and hiding the lot at once.
  const shownInList = rows.filter((r) => r.visible).length;
  const allShown = rows.length > 0 && shownInList === rows.length;
  const someShown = shownInList > 0 && !allShown;
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someShown;
  }, [someShown]);

  if (!walletAddress || !wallet) return null;

  const toggleVisibility = (token: PortfolioToken, shouldBeVisible: boolean) => {
    const addr = token.address;
    if (shouldBeVisible) {
      const auto = tokenAutoState(token, effectiveSettings);
      if (auto.autoHidden) setTokenForced(walletAddress, addr, true);
      else setTokenHidden(walletAddress, addr, false);
    } else {
      setTokenHidden(walletAddress, addr, true);
    }
  };

  const toggleAll = () => {
    const next = !allShown; // all shown → hide them all; otherwise show them all
    for (const { token } of rows) toggleVisibility(token, next);
  };

  const overlay = (
    <>
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[90]"
        onClick={handleClose}
      />
      <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 pointer-events-none sm:items-center sm:p-4">
        <div
          className="w-full max-w-2xl max-h-[90vh] rounded-t-2xl border border-white/15 bg-[#0F1A2E] shadow-2xl pointer-events-auto flex flex-col sm:max-h-[85vh] sm:rounded-2xl"
          style={{
            boxShadow:
              '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(168, 85, 247, 0.12) inset',
          }}
        >
          {/* Grip — signals the bottom-sheet is draggable-feeling on mobile. */}
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/15 sm:hidden" />
          <header className="flex items-start justify-between gap-4 p-4 border-b border-white/10 sm:p-5">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white">
                Manage tokens — {walletLabel}
              </h2>
              <p className="text-xs text-white/50 mt-0.5">
                {visibleCount} of {tokens.filter((t) => !t.isNative).length} tokens
                shown · {effectiveSettings.hidden.length} explicitly hidden ·
                {effectiveSettings.forced.length} force-shown
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="h-8 w-8 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 text-white shrink-0"
              aria-label="Close"
              title="Close (Esc)"
            >
              <IconX className="h-4 w-4" />
            </button>
          </header>

          <div className="px-4 py-3 border-b border-white/10 space-y-3 sm:px-5">
            <label className="flex items-center gap-2 text-sm text-white/70 bg-white/5 rounded-lg px-3 py-2 border border-white/10">
              <IconSearch className="h-4 w-4 text-white/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by symbol, name, or address"
                className="flex-1 bg-transparent outline-none placeholder:text-white/30 text-white"
              />
            </label>

            <div className="flex items-center flex-wrap gap-2">
              {(
                [
                  ['all', 'All'],
                  ['visible', 'Shown'],
                  ['hidden', 'Hidden'],
                  ['spam', 'Flagged spam'],
                  ['dust', 'Dust'],
                ] as Array<[typeof filter, string]>
              ).map(([key, label]) => {
                const active = filter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className="px-3 py-1 text-xs font-semibold rounded-full border transition-colors"
                    style={
                      active
                        ? {
                            backgroundColor: 'rgba(168, 85, 247, 0.25)',
                            borderColor: 'rgba(168, 85, 247, 0.7)',
                            color: '#fff',
                          }
                        : {
                            backgroundColor: 'transparent',
                            borderColor: 'rgba(255,255,255,0.15)',
                            color: 'rgba(255,255,255,0.55)',
                          }
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center flex-wrap gap-3 text-xs text-white/70">
              <label className="inline-flex items-center gap-2 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={effectiveSettings.hideDust}
                  onChange={(e) => setHideDust(walletAddress, e.target.checked)}
                  className="h-3.5 w-3.5 accent-purple-500"
                />
                <span>Hide dust under</span>
              </label>
              <span className="text-white/40">$</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={effectiveSettings.dustThresholdUsd}
                onChange={(e) =>
                  setDustThreshold(walletAddress, Number(e.target.value) || 0)
                }
                className="w-20 px-2 py-1 rounded border border-white/15 bg-white/5 text-white tabular-nums"
              />
              <button
                type="button"
                onClick={() => resetWalletSettings(walletAddress)}
                title="Reset to defaults"
                className="ml-auto inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors text-[11px]"
              >
                <IconRestore className="h-3.5 w-3.5" />
                Reset
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-white/10 sm:px-5">
            <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allShown}
                onChange={toggleAll}
                disabled={rows.length === 0}
                className="h-4 w-4 accent-purple-500 disabled:opacity-40"
              />
              <span className="text-xs font-semibold text-white/75">
                {allShown ? 'Hide all' : 'Select all'}
              </span>
            </label>
            <span className="text-[11px] tabular-nums text-white/40">
              {shownInList} / {rows.length} shown
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {rows.length === 0 ? (
              <div className="text-center py-12 text-white/40 text-sm">
                {query ? 'No tokens match the search.' : 'Nothing to show.'}
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {rows.map(({ token, auto, isHidden, isForced, visible }) => (
                  <li
                    key={`${token.chain}:${token.address}`}
                    className="px-4 py-2.5 flex items-center gap-3 sm:px-5"
                  >
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={(e) =>
                        toggleVisibility(token, e.target.checked)
                      }
                      className="h-4 w-4 accent-purple-500 shrink-0"
                    />

                    <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden grid place-items-center shrink-0">
                      {token.logoURI ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={token.logoURI}
                          alt={token.symbol}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display =
                              'none';
                          }}
                        />
                      ) : (
                        <span className="text-[9px] text-white/60 font-semibold">
                          {token.symbol.slice(0, 3).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-white truncate">
                          {token.symbol}
                        </span>
                        <ChainLogo chain={token.chain} size={14} />
                        {auto.reason === 'spam' && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: 'rgba(239,68,68,0.15)',
                              color: '#fecaca',
                              border: '1px solid rgba(239,68,68,0.4)',
                            }}
                          >
                            <IconAlertTriangle className="h-2.5 w-2.5" />
                            Spam
                          </span>
                        )}
                        {auto.reason === 'dust' && (
                          <span
                            className="text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: 'rgba(120,120,120,0.15)',
                              color: 'rgba(255,255,255,0.6)',
                              border: '1px solid rgba(255,255,255,0.15)',
                            }}
                          >
                            Dust
                          </span>
                        )}
                        {isForced && !auto.autoHidden === false && (
                          <span
                            className="text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: 'rgba(168,85,247,0.18)',
                              color: '#e9d5ff',
                              border: '1px solid rgba(168,85,247,0.5)',
                            }}
                          >
                            Forced
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/45 truncate">
                        {token.name}
                      </div>
                    </div>

                    <div className="text-right shrink-0 tabular-nums">
                      <div className="text-sm text-white">
                        {fmtBalance(token.balanceFormatted)}
                      </div>
                      <div className="text-[11px] text-white/50">
                        {fmtUsd(token.valueUsd ?? null) ?? '—'}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(overlay, document.body);
}
