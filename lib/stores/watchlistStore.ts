// Watchlist — tokens the user wants to track without holding them. Same
// shape as a portfolio row but with no balance; prices come from the
// shared /api/portfolio/prices proxy so we get DexScreener data with the
// Cloudflare-friendly User-Agent in one place.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ChainId } from '@/services';

export interface WatchedToken {
  address: string;
  chain: ChainId;
  symbol: string;
  name: string;
  logoURI?: string;
  addedAt: number;
}

export interface WatchPriceEntry {
  priceUsd: number | null;
  priceChange24h: number | null;
  logoURI: string | null;
  symbol: string | null;
  name: string | null;
  fetchedAt: number;
}

interface WatchlistStore {
  tokens: WatchedToken[];
  prices: Record<string, WatchPriceEntry>;
  isLoading: boolean;

  add: (token: Omit<WatchedToken, 'addedAt'>) => boolean;
  remove: (address: string, chain: ChainId) => void;
  refresh: () => Promise<void>;
  clear: () => void;
}

const norm = (a: string) => a.trim().toLowerCase();
const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;

export const useWatchlistStore = create<WatchlistStore>()(
  persist(
    (set, get) => ({
      tokens: [],
      prices: {},
      isLoading: false,

      add: (token) => {
        if (!ADDRESS_RX.test(token.address.trim())) return false;
        const address = norm(token.address);
        // Dedupe per (chain, address) so a token can appear under both
        // chains if a bridge contract uses the same address.
        if (
          get().tokens.some((t) => t.address === address && t.chain === token.chain)
        ) {
          return false;
        }
        set((state) => ({
          tokens: [
            ...state.tokens,
            { ...token, address, addedAt: Date.now() },
          ],
        }));
        void get().refresh();
        return true;
      },

      remove: (address, chain) => {
        const n = norm(address);
        set((state) => ({
          tokens: state.tokens.filter((t) => !(t.address === n && t.chain === chain)),
        }));
      },

      refresh: async () => {
        const { tokens } = get();
        if (tokens.length === 0) {
          set({ prices: {} });
          return;
        }
        set({ isLoading: true });
        try {
          const addresses = Array.from(new Set(tokens.map((t) => t.address)));
          const res = await fetch('/api/portfolio/prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses }),
          });
          if (!res.ok) return;
          const data = (await res.json()) as {
            prices?: Record<string, any>;
          };
          const prices: Record<string, WatchPriceEntry> = {};
          for (const [addr, p] of Object.entries(data.prices || {})) {
            prices[addr] = {
              priceUsd: p?.priceUsd ?? null,
              priceChange24h: p?.priceChange24h ?? null,
              logoURI: p?.logoURI ?? null,
              symbol: p?.symbol ?? null,
              name: p?.name ?? null,
              fetchedAt: Date.now(),
            };
          }
          set({ prices });
        } catch {
          // best-effort — leave existing prices alone
        } finally {
          set({ isLoading: false });
        }
      },

      clear: () => set({ tokens: [], prices: {} }),
    }),
    {
      name: 'morbius-watchlist-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ tokens: state.tokens }),
    },
  ),
);
