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
import { fmtUsd } from '@/lib/format';

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

  const anyLoading = wallets.some(
    (w) => snapshotsByAddress[w.address]?.isLoading,
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[var(--panel)] via-[var(--surface-2)] to-[var(--panel)]">
      <div className="mx-auto max-w-7xl px-4 py-4 md:py-6 space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[var(--text)] text-lg font-bold">
            <IconWallet className="h-5 w-5 text-orange-400" />
            Portfolio
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {wallets.length > 0 && (
              <>
                <div className="text-right">
                  <div className="text-xs text-[var(--text-faint)] uppercase tracking-wide">
                    Total value
                  </div>
                  <div className="text-2xl font-bold text-[var(--text)] tabular-nums">
                    {fmtUsd(aggregateUsd)}
                  </div>
                </div>
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
              </>
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
