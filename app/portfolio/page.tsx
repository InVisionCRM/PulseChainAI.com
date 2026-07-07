'use client';

import { useEffect, useMemo } from 'react';
import { IconWallet, IconRefresh, IconStar } from '@tabler/icons-react';
import { usePortfolioStore } from '@/lib/stores/portfolioStore';
import { useGroupsStore } from '@/lib/stores/groupsStore';
import { AddWalletForm } from '@/components/portfolio/AddWalletForm';
import { PortfolioGroups } from '@/components/portfolio/PortfolioGroups';
import { PortfolioChart } from '@/components/portfolio/PortfolioChart';
import { WatchlistPanel } from '@/components/portfolio/WatchlistPanel';
import { TokenInsightsCard } from '@/components/portfolio/TokenInsightsCard';
import { ManageTokensModal } from '@/components/portfolio/ManageTokensModal';
import { ConnectWalletButton } from '@/components/portfolio/ConnectWalletButton';
import { fmtUsd } from '@/lib/format';

export default function PortfolioPage() {
  const wallets = usePortfolioStore((s) => s.wallets);
  const snapshotsByAddress = usePortfolioStore((s) => s.snapshotsByAddress);
  const refreshAll = usePortfolioStore((s) => s.refreshAll);
  const recordHistory = usePortfolioStore((s) => s.recordHistory);
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

  // Build the value-over-time history during normal use: record once the
  // aggregate settles (seeds the first point on first load), again whenever it
  // changes, and on a 5-min tick so the chart accrues points even while idle.
  // recordHistory throttles itself (replace within the bucket, append across).
  useEffect(() => {
    if (wallets.length === 0) return;
    if (!anyLoading) recordHistory();
    const id = setInterval(recordHistory, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [wallets.length, aggregateUsd, anyLoading, recordHistory]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[var(--panel)] via-[var(--surface-2)] to-[var(--panel)]">
      <div className="mx-auto max-w-7xl px-4 py-8 md:py-12 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-orange-400/80 text-xs font-semibold uppercase tracking-wider">
              <IconWallet className="h-4 w-4" />
              Portfolio Tracker
            </div>
            <h1 className="mt-1 text-3xl md:text-4xl font-bold text-[var(--text)]">
              Your wallets, all in one place
            </h1>
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

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            <AddWalletForm />
            {wallets.length > 0 && <PortfolioChart />}
            {wallets.length === 0 && !hasSavedMembers ? (
              <EmptyState />
            ) : (
              <PortfolioGroups />
            )}
          </div>
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
