// Portfolio state — wallets the user is tracking plus a per-wallet snapshot
// cache. Persisted to localStorage so the wallet list survives reloads,
// but the snapshot cache is treated as ephemeral (stale data is fine to
// hold in memory but we always re-fetch on demand via refreshWallet).

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { portfolioService } from '@/services';
import type {
  ChainId,
  PortfolioSnapshot,
  PortfolioWallet,
} from '@/services';

interface SnapshotState {
  snapshot: PortfolioSnapshot | null;
  isLoading: boolean;
  error: string | null;
}

export interface PortfolioHistoryPoint {
  ts: number;
  totalUsd: number;
}

interface PortfolioStore {
  wallets: PortfolioWallet[];
  snapshotsByAddress: Record<string, SnapshotState>;
  // Aggregate value-over-time. Each refreshAll appends (or replaces) the
  // most recent point — see recordSnapshot for the throttle. Persisted to
  // localStorage so the chart survives reloads.
  history: PortfolioHistoryPoint[];

  addWallet: (address: string, label?: string, chains?: ChainId[]) => boolean;
  removeWallet: (address: string) => void;
  setWalletLabel: (address: string, label: string) => void;
  setWalletChains: (address: string, chains: ChainId[]) => void;

  refreshWallet: (address: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  clearSnapshots: () => void;
  clearHistory: () => void;
}

const DEFAULT_CHAINS: ChainId[] = ['ethereum', 'pulsechain'];
const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;
const HISTORY_THROTTLE_MS = 60 * 60 * 1000; // 1 hour
const HISTORY_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

const normaliseAddress = (a: string) => a.trim().toLowerCase();

export const usePortfolioStore = create<PortfolioStore>()(
  persist(
    (set, get) => ({
      wallets: [],
      snapshotsByAddress: {},
      history: [],

      addWallet: (address, label, chains) => {
        if (!ADDRESS_RX.test(address.trim())) return false;
        const norm = normaliseAddress(address);
        const exists = get().wallets.some((w) => w.address === norm);
        if (exists) return false;
        set((state) => ({
          wallets: [
            ...state.wallets,
            {
              address: norm,
              label,
              chains: chains && chains.length > 0 ? chains : DEFAULT_CHAINS,
              addedAt: Date.now(),
            },
          ],
        }));
        return true;
      },

      removeWallet: (address) => {
        const norm = normaliseAddress(address);
        set((state) => {
          const { [norm]: _, ...rest } = state.snapshotsByAddress;
          return {
            wallets: state.wallets.filter((w) => w.address !== norm),
            snapshotsByAddress: rest,
          };
        });
      },

      setWalletLabel: (address, label) => {
        const norm = normaliseAddress(address);
        set((state) => ({
          wallets: state.wallets.map((w) =>
            w.address === norm ? { ...w, label } : w,
          ),
        }));
      },

      setWalletChains: (address, chains) => {
        const norm = normaliseAddress(address);
        set((state) => ({
          wallets: state.wallets.map((w) =>
            w.address === norm ? { ...w, chains } : w,
          ),
        }));
      },

      refreshWallet: async (address) => {
        const norm = normaliseAddress(address);
        const wallet = get().wallets.find((w) => w.address === norm);
        if (!wallet) return;

        set((state) => ({
          snapshotsByAddress: {
            ...state.snapshotsByAddress,
            [norm]: {
              snapshot: state.snapshotsByAddress[norm]?.snapshot ?? null,
              isLoading: true,
              error: null,
            },
          },
        }));

        const resp = await portfolioService.getPortfolio(wallet.address, wallet.chains);

        set((state) => ({
          snapshotsByAddress: {
            ...state.snapshotsByAddress,
            [norm]: {
              snapshot: resp.success && resp.data ? resp.data : state.snapshotsByAddress[norm]?.snapshot ?? null,
              isLoading: false,
              error: resp.success ? null : resp.error || 'Portfolio fetch failed',
            },
          },
        }));
      },

      refreshAll: async () => {
        const wallets = get().wallets;
        await Promise.all(wallets.map((w) => get().refreshWallet(w.address)));
        // Snapshot the aggregate total *after* every wallet has resolved.
        const { wallets: w, snapshotsByAddress } = get();
        const totalUsd = w.reduce((sum, wal) => {
          const snap = snapshotsByAddress[wal.address]?.snapshot;
          return sum + (snap?.totalValueUsd ?? 0);
        }, 0);
        if (!Number.isFinite(totalUsd) || totalUsd === 0) return;

        const now = Date.now();
        set((state) => {
          const last = state.history[state.history.length - 1];
          let history: PortfolioHistoryPoint[];
          if (last && now - last.ts < HISTORY_THROTTLE_MS) {
            // Same hour bucket — replace the last point so the chart stays
            // current without ballooning the history array on every refresh.
            history = [
              ...state.history.slice(0, -1),
              { ts: now, totalUsd },
            ];
          } else {
            history = [...state.history, { ts: now, totalUsd }];
          }
          const cutoff = now - HISTORY_MAX_AGE_MS;
          history = history.filter((p) => p.ts >= cutoff);
          return { history };
        });
      },

      clearSnapshots: () => set({ snapshotsByAddress: {} }),
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'morbius-portfolio-v1',
      storage: createJSONStorage(() => localStorage),
      // Persist the wallet list AND the value history; snapshots are
      // ephemeral and re-fetched on demand.
      partialize: (state) => ({
        wallets: state.wallets,
        history: state.history,
      }),
    },
  ),
);
