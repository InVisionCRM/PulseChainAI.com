'use client';

/**
 * Screener ↔ portfolio watchlist bridge. The screener reads and writes the
 * same persisted zustand store the portfolio page uses, so starring a pair
 * here shows up there and vice versa. On first visit with an empty
 * watchlist we seed the house defaults exactly once.
 */

import { useCallback, useEffect } from 'react';
import { useWatchlistStore, type WatchedToken } from '@/lib/stores/watchlistStore';
import type { ChainId } from '@/services';
import type { ScreenerRow } from '@/lib/screener/types';

const SEEDED_KEY = 'screener.watchlist.seeded';

export const DEFAULT_WATCHLIST: Omit<WatchedToken, 'addedAt'>[] = [
  { address: '0xb7d4eb5fdfe3d4d3b5c16a44a49948c6ec77c6f1', chain: 'pulsechain', symbol: 'Morbius', name: 'Morbius' },
  { address: '0xa1077a294dde1b09bb078844df40758a5d0f9a27', chain: 'pulsechain', symbol: 'WPLS', name: 'Wrapped Pulse' },
  { address: '0x95b303987a60c71504d99aa1b13b4da07b0790ab', chain: 'pulsechain', symbol: 'PLSX', name: 'PulseX' },
  { address: '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d', chain: 'pulsechain', symbol: 'INC', name: 'Incentive' },
  { address: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', chain: 'pulsechain', symbol: 'HEX', name: 'HEX' },
  { address: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', chain: 'ethereum', symbol: 'HEX', name: 'HEX on Ethereum' },
];

export interface ScreenerWatchlist {
  tokens: WatchedToken[];
  has: (address: string | null, chain?: ChainId) => boolean;
  toggle: (token: { address: string; chain?: ChainId; symbol: string; name: string; logoURI?: string }) => void;
  toggleRow: (row: ScreenerRow) => void;
}

export function useScreenerWatchlist(): ScreenerWatchlist {
  const tokens = useWatchlistStore((s) => s.tokens);
  const add = useWatchlistStore((s) => s.add);
  const remove = useWatchlistStore((s) => s.remove);

  // One-time seed: only when the user has never had a watchlist.
  useEffect(() => {
    if (localStorage.getItem(SEEDED_KEY)) return;
    localStorage.setItem(SEEDED_KEY, '1');
    if (useWatchlistStore.getState().tokens.length === 0) {
      for (const t of DEFAULT_WATCHLIST) add(t);
    }
  }, [add]);

  const has = useCallback(
    (address: string | null, chain: ChainId = 'pulsechain') =>
      address !== null && tokens.some((t) => t.address === address.toLowerCase() && t.chain === chain),
    [tokens],
  );

  const toggle = useCallback(
    (token: { address: string; chain?: ChainId; symbol: string; name: string; logoURI?: string }) => {
      const chain: ChainId = token.chain ?? 'pulsechain';
      if (has(token.address, chain)) {
        remove(token.address, chain);
      } else {
        add({ address: token.address, chain, symbol: token.symbol, name: token.name, logoURI: token.logoURI });
      }
    },
    [add, remove, has],
  );

  const toggleRow = useCallback(
    (row: ScreenerRow) => {
      if (!row.baseAddress) return;
      toggle({
        address: row.baseAddress,
        chain: row.chainId === 'ethereum' ? 'ethereum' : 'pulsechain',
        symbol: row.baseSymbol ?? '?',
        name: row.baseName ?? row.baseSymbol ?? '?',
        logoURI: row.imageUrl ?? undefined,
      });
    },
    [toggle],
  );

  return { tokens, has, toggle, toggleRow };
}
