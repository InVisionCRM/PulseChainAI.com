'use client';

import { useMemo } from 'react';
import { IconWallet, IconRefresh, IconStar } from '@tabler/icons-react';
import { usePortfolioStore } from '@/lib/stores/portfolioStore';
import { useGroupsStore } from '@/lib/stores/groupsStore';
import { AddWalletForm } from '@/components/portfolio/AddWalletForm';
import { PortfolioGroups } from '@/components/portfolio/PortfolioGroups';
import { WatchlistPanel } from '@/components/portfolio/WatchlistPanel';
import { TokenInsightsCard } from '@/components/portfolio/TokenInsightsCard';
import { ManageTokensModal } from '@/components/portfolio/ManageTokensModal';
import { ConnectWalletButton } from '@/components/portfolio/ConnectWalletButton';
import AdBanner from '@/components/ads/AdBanner';
import { fmtUsd, fmtPct, pctClass } from '@/lib/format';
import type { ChainId } from '@/services';

export default function PortfolioPage() {
  const wallets = usePortfolioStore((s) => s.wallets);
  const snapshotsByAddress = usePortfolioStore((s) => s.snapshotsByAddress);
  const refreshAll = usePortfolioStore((s) => s.refreshAll);
  const hasSavedMembers = useGroupsStore((s) => s.members.length > 0);

  const aggregateUsd = useMemo(
    () =>
      wallets.reduce((sum, w) => {
        const snap = snapshotsByAddress[w.address]?.snapshot;
        return sum + (snap?.totalValueUsd ?? 0);
      }, 0),
    [wallets, snapshotsByAddress],
  );

  // Portfolio-wide 24h move, derived from the per-token `priceChange24h`
  // already on each snapshot — no extra fetch. A token that moved +x% was
  // worth value/(1+x) yesterday, so summing that back out gives the whole
  // portfolio's prior value. Tokens with no price change (unpriced dust,
  // LP positions) sit out of both sides rather than skewing the total, and
  // the whole figure is withheld unless the priced tokens actually cover
  // the portfolio — a delta computed off a third of the value would read
  // as fact while being noise.
  const change24h = useMemo(() => {
    let now = 0;
    let then = 0;
    for (const w of wallets) {
      const snap = snapshotsByAddress[w.address]?.snapshot;
      for (const t of snap?.tokens ?? []) {
        const value = t.valueUsd;
        const pct = t.priceChange24h;
        if (value == null || !Number.isFinite(value) || value <= 0) continue;
        if (pct == null || !Number.isFinite(pct)) continue;
        const prior = value / (1 + pct / 100);
        if (!Number.isFinite(prior) || prior <= 0) continue;
        now += value;
        then += prior;
      }
    }
    if (then <= 0 || now <= 0) return null;
    // Require the priced set to cover most of the portfolio before quoting.
    if (aggregateUsd > 0 && now / aggregateUsd < 0.6) return null;
    return { pct: ((now - then) / then) * 100, usd: now - then };
  }, [wallets, snapshotsByAddress, aggregateUsd]);

  // Composition counts for the hero's stat row.
  const { tokenCount, chainCount } = useMemo(() => {
    const chains = new Set<ChainId>();
    let tokens = 0;
    for (const w of wallets) {
      for (const c of w.chains) chains.add(c);
      const snap = snapshotsByAddress[w.address]?.snapshot;
      for (const t of snap?.tokens ?? []) {
        if ((t.valueUsd ?? 0) > 0) tokens += 1;
      }
    }
    return { tokenCount: tokens, chainCount: chains.size };
  }, [wallets, snapshotsByAddress]);

  const anyLoading = wallets.some(
    (w) => snapshotsByAddress[w.address]?.isLoading,
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[var(--panel)] via-[var(--surface-2)] to-[var(--panel)]">
      <div className="mx-auto max-w-7xl px-4 py-4 md:py-6 space-y-5">
        {/* Hero. The page used to open on the address form, which put data
            entry above the thing the visitor came to see. The total leads
            now, at display size, with the 24h move and composition under it;
            the form drops below. With no wallets yet there's nothing to
            total, so the hero collapses back to the plain title row and the
            form becomes the natural first thing on the page. */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs font-bold uppercase tracking-[0.14em]">
              <IconWallet className="h-4 w-4 text-orange-400" />
              Portfolio
            </div>

            {wallets.length > 0 && (
              <>
                <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-4xl sm:text-5xl font-bold leading-none tracking-tight text-[var(--text)] tabular-nums">
                    {fmtUsd(aggregateUsd)}
                  </span>
                  {change24h && (
                    <span
                      className={`text-sm font-semibold tabular-nums ${pctClass(change24h.pct)}`}
                      title="Change over the last 24 hours, across priced holdings"
                    >
                      {fmtPct(change24h.pct)}
                      <span className="ml-1.5 font-normal text-[var(--text-muted)]">
                        {change24h.usd >= 0 ? '+' : '−'}
                        {fmtUsd(Math.abs(change24h.usd))} · 24h
                      </span>
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-faint)]">
                  <span className="text-[var(--text-muted)]">
                    <span className="font-semibold text-[var(--text)] tabular-nums">
                      {wallets.length}
                    </span>{' '}
                    {wallets.length === 1 ? 'wallet' : 'wallets'}
                  </span>
                  {tokenCount > 0 && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="text-[var(--text-muted)]">
                        <span className="font-semibold text-[var(--text)] tabular-nums">
                          {tokenCount}
                        </span>{' '}
                        {tokenCount === 1 ? 'holding' : 'holdings'}
                      </span>
                    </>
                  )}
                  <span aria-hidden>·</span>
                  <span className="text-[var(--text-muted)]">
                    <span className="font-semibold text-[var(--text)] tabular-nums">
                      {chainCount}
                    </span>{' '}
                    {chainCount === 1 ? 'chain' : 'chains'}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {wallets.length > 0 && (
              <button
                type="button"
                onClick={refreshAll}
                disabled={anyLoading}
                title="Refresh all wallets"
                aria-label="Refresh all wallets"
                className="inline-flex items-center justify-center rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] p-1.5 sm:p-2 transition-colors disabled:opacity-40"
              >
                <IconRefresh
                  className={`h-4 w-4 sm:h-5 sm:w-5 ${anyLoading ? 'animate-spin' : ''}`}
                />
              </button>
            )}
            <ConnectWalletButton />
            {/* Mobile-only shortcut: the watchlist sits in the sidebar on lg+
                but stacks at the bottom of the page below lg, so jump to it. */}
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById('watchlist')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              className="lg:hidden inline-flex items-center gap-1 sm:gap-1.5 rounded-lg border border-orange-500/40 bg-orange-500/10 text-orange-300 hover:bg-orange-500/15 text-xs sm:text-sm font-semibold px-2 py-1.5 sm:px-3 sm:py-2 transition-colors"
              title="Jump to your watchlist"
            >
              <IconStar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Watchlist
            </button>
          </div>
        </header>

        {/* The watchlist now lives in the left nav column on desktop; it only
            renders inline here on mobile. Main column takes the full width. */}
        <div className="space-y-6 min-w-0">
          <AddWalletForm />
          {/* Promo strip sits below the wallet form so it doesn't crowd the
              top of the page. */}
          <AdBanner />
          {wallets.length === 0 && !hasSavedMembers ? (
            <EmptyState />
          ) : (
            <PortfolioGroups />
          )}
        </div>
        <div className="mt-6 md:hidden">
          <WatchlistPanel />
        </div>
      </div>
      <TokenInsightsCard />
      <ManageTokensModal />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] backdrop-blur-xl p-10 text-center">
      <IconWallet className="h-10 w-10 text-[var(--text-faint)] mx-auto" />
      <h2 className="mt-3 text-lg font-semibold text-[var(--text)]">
        No wallets tracked yet
      </h2>
      <p className="mt-1 text-sm text-[var(--text-faint)] max-w-md mx-auto">
        Paste an EVM address above to start tracking its ERC-20 (Ethereum) and
        PRC-20 (PulseChain) balances. You can track as many as you like.
      </p>
    </div>
  );
}
