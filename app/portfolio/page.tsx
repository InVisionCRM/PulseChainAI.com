'use client';

import { useMemo } from 'react';
import { IconWallet, IconRefresh } from '@tabler/icons-react';
import { usePortfolioStore } from '@/lib/stores/portfolioStore';
import { AddWalletForm } from '@/components/portfolio/AddWalletForm';
import { WalletCard } from '@/components/portfolio/WalletCard';
import { PortfolioChart } from '@/components/portfolio/PortfolioChart';
import { WatchlistPanel } from '@/components/portfolio/WatchlistPanel';

const fmtUsd = (n: number) => {
  if (!Number.isFinite(n)) return '$0.00';
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export default function PortfolioPage() {
  const wallets = usePortfolioStore((s) => s.wallets);
  const snapshotsByAddress = usePortfolioStore((s) => s.snapshotsByAddress);
  const refreshAll = usePortfolioStore((s) => s.refreshAll);

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
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0C2340] via-[#0d2a4d] to-[#0C2340]">
      <div className="mx-auto max-w-7xl px-4 py-8 md:py-12 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-orange-400/80 text-xs font-semibold uppercase tracking-wider">
              <IconWallet className="h-4 w-4" />
              Portfolio Tracker
            </div>
            <h1 className="mt-1 text-3xl md:text-4xl font-bold text-white">
              Your wallets, all in one place
            </h1>
            <p
              className="mt-2 leading-none font-black uppercase tracking-tight select-none"
              style={{
                fontSize: 'clamp(3.5rem, 8vw, 6rem)',
                background:
                  'linear-gradient(135deg, #c084fc 0%, #a855f7 35%, #7e22ce 70%, #4c1d95 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                filter:
                  'drop-shadow(0 0 18px rgba(168, 85, 247, 0.45)) drop-shadow(0 4px 16px rgba(76, 29, 149, 0.35))',
                letterSpacing: '-0.04em',
              }}
            >
              MORBY
            </p>
          </div>

          {wallets.length > 0 && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-white/50 uppercase tracking-wide">
                  Total value
                </div>
                <div className="text-2xl font-bold text-white tabular-nums">
                  {fmtUsd(aggregateUsd)}
                </div>
              </div>
              <button
                type="button"
                onClick={refreshAll}
                disabled={anyLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-semibold px-3 py-2 transition-colors disabled:opacity-40"
              >
                <IconRefresh
                  className={`h-4 w-4 ${anyLoading ? 'animate-spin' : ''}`}
                />
                Refresh all
              </button>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            <AddWalletForm />
            {wallets.length > 0 && <PortfolioChart />}
            {wallets.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="space-y-4">
                {wallets.map((w) => (
                  <WalletCard key={w.address} wallet={w} />
                ))}
              </div>
            )}
          </div>
          <WatchlistPanel />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 backdrop-blur-xl p-10 text-center">
      <IconWallet className="h-10 w-10 text-white/30 mx-auto" />
      <h2 className="mt-3 text-lg font-semibold text-white">
        No wallets tracked yet
      </h2>
      <p className="mt-1 text-sm text-white/50 max-w-md mx-auto">
        Paste an EVM address above to start tracking its ERC-20 (Ethereum) and
        PRC-20 (PulseChain) balances. You can track as many as you like.
      </p>
    </div>
  );
}
