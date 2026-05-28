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

interface PortfolioStore {
  wallets: PortfolioWallet[];
  snapshotsByAddress: Record<string, SnapshotState>;

  addWallet: (address: string, label?: string, chains?: ChainId[]) => boolean;
  removeWallet: (address: string) => void;
  setWalletLabel: (address: string, label: string) => void;
  setWalletChains: (address: string, chains: ChainId[]) => void;

  refreshWallet: (address: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  clearSnapshots: () => void;
}

const DEFAULT_CHAINS: ChainId[] = ['ethereum', 'pulsechain'];
const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;

const normaliseAddress = (a: string) => a.trim().toLowerCase();

export const usePortfolioStore = create<PortfolioStore>()(
  persist(
    (set, get) => ({
      wallets: [],
      snapshotsByAddress: {},

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
      },

      clearSnapshots: () => set({ snapshotsByAddress: {} }),
    }),
    {
      name: 'morbius-portfolio-v1',
      storage: createJSONStorage(() => localStorage),
      // Only persist the wallet list — snapshots are ephemeral.
      partialize: (state) => ({ wallets: state.wallets }),
    },
  ),
);
