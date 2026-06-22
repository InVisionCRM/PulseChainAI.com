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

// Per-wallet visibility settings. Hidden tokens are still fetched (so the
// "Manage tokens" modal can show them as togglable), but filtered out of
// the main row list and excluded from the wallet total. Persisted to
// localStorage so user preferences survive reloads.
export interface WalletTokenSettings {
  // Addresses the user has explicitly hidden. Keys: lowercased contract
  // address; per-chain is implied because addresses are globally unique.
  hidden: string[];
  // Addresses the user has explicitly *unhidden* — overrides any
  // auto-hide rule (dust, spam heuristic). Lets the user say "no really,
  // show this even though it's worth $0.50."
  forced: string[];
  // Auto-hide tokens worth less than this many USD. 0 means "show
  // everything regardless of value."
  hideDust: boolean;
  dustThresholdUsd: number;
  // When the user first opens the modal we surface their auto-hidden
  // tokens for review; this remembers whether they've done that pass.
  seenInitialReview: boolean;
}

const DEFAULT_TOKEN_SETTINGS: WalletTokenSettings = {
  hidden: [],
  forced: [],
  hideDust: true,
  dustThresholdUsd: 1,
  seenInitialReview: false,
};

interface PortfolioStore {
  wallets: PortfolioWallet[];
  snapshotsByAddress: Record<string, SnapshotState>;
  // Aggregate value-over-time. Each refreshAll appends (or replaces) the
  // most recent point — see recordSnapshot for the throttle. Persisted to
  // localStorage so the chart survives reloads.
  history: PortfolioHistoryPoint[];
  // Visibility / dust / spam settings per wallet.
  walletTokenSettings: Record<string, WalletTokenSettings>;

  addWallet: (address: string, label?: string, chains?: ChainId[]) => boolean;
  removeWallet: (address: string) => void;
  setWalletLabel: (address: string, label: string) => void;
  setWalletChains: (address: string, chains: ChainId[]) => void;

  // Manage Tokens modal actions
  getWalletSettings: (walletAddress: string) => WalletTokenSettings;
  setTokenHidden: (
    walletAddress: string,
    tokenAddress: string,
    hidden: boolean,
  ) => void;
  setTokenForced: (
    walletAddress: string,
    tokenAddress: string,
    forced: boolean,
  ) => void;
  setHideDust: (walletAddress: string, on: boolean) => void;
  setDustThreshold: (walletAddress: string, usd: number) => void;
  markInitialReviewSeen: (walletAddress: string) => void;
  resetWalletSettings: (walletAddress: string) => void;

  refreshWallet: (address: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  /** Append (or replace, within the throttle window) a point for the current
   *  aggregate value. Safe to call often — it throttles itself. */
  recordHistory: () => void;
  clearSnapshots: () => void;
  clearHistory: () => void;
}

const DEFAULT_CHAINS: ChainId[] = ['ethereum', 'pulsechain'];
const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;
const HISTORY_THROTTLE_MS = 5 * 60 * 1000; // 5 min — within a bucket the last point is replaced
const HISTORY_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

const normaliseAddress = (a: string) => a.trim().toLowerCase();

export const usePortfolioStore = create<PortfolioStore>()(
  persist(
    (set, get) => ({
      wallets: [],
      snapshotsByAddress: {},
      history: [],
      walletTokenSettings: {},

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
          const { [norm]: _s, ...restSettings } = state.walletTokenSettings;
          return {
            wallets: state.wallets.filter((w) => w.address !== norm),
            snapshotsByAddress: rest,
            walletTokenSettings: restSettings,
          };
        });
      },

      getWalletSettings: (walletAddress) => {
        const norm = normaliseAddress(walletAddress);
        return get().walletTokenSettings[norm] ?? DEFAULT_TOKEN_SETTINGS;
      },

      setTokenHidden: (walletAddress, tokenAddress, hidden) => {
        const wnorm = normaliseAddress(walletAddress);
        const tnorm = tokenAddress.toLowerCase();
        set((state) => {
          const current =
            state.walletTokenSettings[wnorm] ?? DEFAULT_TOKEN_SETTINGS;
          const hiddenSet = new Set(current.hidden);
          const forcedSet = new Set(current.forced);
          if (hidden) {
            hiddenSet.add(tnorm);
            forcedSet.delete(tnorm);
          } else {
            hiddenSet.delete(tnorm);
          }
          return {
            walletTokenSettings: {
              ...state.walletTokenSettings,
              [wnorm]: {
                ...current,
                hidden: [...hiddenSet],
                forced: [...forcedSet],
              },
            },
          };
        });
      },

      setTokenForced: (walletAddress, tokenAddress, forced) => {
        const wnorm = normaliseAddress(walletAddress);
        const tnorm = tokenAddress.toLowerCase();
        set((state) => {
          const current =
            state.walletTokenSettings[wnorm] ?? DEFAULT_TOKEN_SETTINGS;
          const forcedSet = new Set(current.forced);
          const hiddenSet = new Set(current.hidden);
          if (forced) {
            forcedSet.add(tnorm);
            hiddenSet.delete(tnorm);
          } else {
            forcedSet.delete(tnorm);
          }
          return {
            walletTokenSettings: {
              ...state.walletTokenSettings,
              [wnorm]: {
                ...current,
                forced: [...forcedSet],
                hidden: [...hiddenSet],
              },
            },
          };
        });
      },

      setHideDust: (walletAddress, on) => {
        const wnorm = normaliseAddress(walletAddress);
        set((state) => {
          const current =
            state.walletTokenSettings[wnorm] ?? DEFAULT_TOKEN_SETTINGS;
          return {
            walletTokenSettings: {
              ...state.walletTokenSettings,
              [wnorm]: { ...current, hideDust: on },
            },
          };
        });
      },

      setDustThreshold: (walletAddress, usd) => {
        const wnorm = normaliseAddress(walletAddress);
        set((state) => {
          const current =
            state.walletTokenSettings[wnorm] ?? DEFAULT_TOKEN_SETTINGS;
          return {
            walletTokenSettings: {
              ...state.walletTokenSettings,
              [wnorm]: { ...current, dustThresholdUsd: usd },
            },
          };
        });
      },

      markInitialReviewSeen: (walletAddress) => {
        const wnorm = normaliseAddress(walletAddress);
        set((state) => {
          const current =
            state.walletTokenSettings[wnorm] ?? DEFAULT_TOKEN_SETTINGS;
          return {
            walletTokenSettings: {
              ...state.walletTokenSettings,
              [wnorm]: { ...current, seenInitialReview: true },
            },
          };
        });
      },

      resetWalletSettings: (walletAddress) => {
        const wnorm = normaliseAddress(walletAddress);
        set((state) => ({
          walletTokenSettings: {
            ...state.walletTokenSettings,
            [wnorm]: DEFAULT_TOKEN_SETTINGS,
          },
        }));
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
        // Record the aggregate total *after* every wallet has resolved.
        get().recordHistory();
      },

      // Append (or replace, within the throttle bucket) a value point for the
      // current aggregate. Called from refreshAll and, on the portfolio page,
      // whenever the settled aggregate changes + on a periodic tick — so the
      // chart builds up during normal use, not only via manual "Refresh all".
      recordHistory: () => {
        const { wallets, snapshotsByAddress } = get();
        const totalUsd = wallets.reduce((sum, wal) => {
          const snap = snapshotsByAddress[wal.address]?.snapshot;
          return sum + (snap?.totalValueUsd ?? 0);
        }, 0);
        if (!Number.isFinite(totalUsd) || totalUsd === 0) return;

        const now = Date.now();
        set((state) => {
          const last = state.history[state.history.length - 1];
          let history: PortfolioHistoryPoint[];
          if (last && now - last.ts < HISTORY_THROTTLE_MS) {
            // Same bucket — replace the last point so the chart stays current
            // without ballooning the history array on every update.
            history = [...state.history.slice(0, -1), { ts: now, totalUsd }];
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
      // Persist the wallet list, value history, and per-wallet token
      // visibility settings; snapshots are ephemeral and re-fetched.
      partialize: (state) => ({
        wallets: state.wallets,
        history: state.history,
        walletTokenSettings: state.walletTokenSettings,
      }),
    },
  ),
);
