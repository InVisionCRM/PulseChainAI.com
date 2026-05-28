// Convenience hook for any UI that needs a wallet's portfolio. Triggers an
// initial fetch if no snapshot exists and exposes `refresh` for manual reloads.
// The store dedupes by address so multiple components mounting `usePortfolio`
// for the same wallet share the same snapshot.

import { useEffect, useMemo, useRef } from 'react';
import { usePortfolioStore } from '@/lib/stores/portfolioStore';
import type { PortfolioSnapshot, PortfolioToken } from '@/services';

export interface UsePortfolioResult {
  snapshot: PortfolioSnapshot | null;
  tokens: PortfolioToken[];
  totalUsd: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isTracked: boolean;
}

export function usePortfolio(walletAddress: string | null | undefined): UsePortfolioResult {
  const norm = walletAddress ? walletAddress.trim().toLowerCase() : '';

  const state = usePortfolioStore((s) =>
    norm ? s.snapshotsByAddress[norm] : undefined,
  );
  const isTracked = usePortfolioStore((s) =>
    norm ? s.wallets.some((w) => w.address === norm) : false,
  );
  const refreshWallet = usePortfolioStore((s) => s.refreshWallet);

  // Avoid retriggering on every render — only fetch when address changes and
  // we don't already have a snapshot in flight or in cache.
  const lastFetchedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!norm || !isTracked) return;
    if (lastFetchedFor.current === norm) return;
    if (state?.isLoading) return;
    if (state?.snapshot) {
      lastFetchedFor.current = norm;
      return;
    }
    lastFetchedFor.current = norm;
    refreshWallet(norm);
  }, [norm, isTracked, state?.isLoading, state?.snapshot, refreshWallet]);

  const refresh = useMemo(
    () => async () => {
      if (norm) await refreshWallet(norm);
    },
    [norm, refreshWallet],
  );

  return {
    snapshot: state?.snapshot ?? null,
    tokens: state?.snapshot?.tokens ?? [],
    totalUsd: state?.snapshot?.totalValueUsd ?? 0,
    isLoading: state?.isLoading ?? false,
    error: state?.error ?? null,
    refresh,
    isTracked,
  };
}
