// The "core + stablecoins" basket used to estimate a holder's wallet value.
//
// We deliberately value only a fixed, verified basket per chain — native coin,
// wrapped native, the chain's recognized majors, and the PEGGED stablecoins —
// rather than every token a wallet holds. That keeps the number meaningful
// (recognized value, not junk) and, crucially, safe:
//
//   Every token is priced BY CONTRACT ADDRESS, scoped to its chain. On
//   PulseChain the forked "pDAI" (0x6b17…71d0f — name "Dai Stablecoin",
//   symbol "DAI") is a FLOATING token worth ~$0.002, NOT the pegged dollar.
//   The pegged stables on PulseChain are the bridged "…from Ethereum" ones
//   (USDC/USDT/DAI at the addresses below). pDAI is intentionally NOT in the
//   basket, and because we key on address (never symbol) it can never be
//   mistaken for $1.
//
// Addresses verified on-chain (Blockscout metadata + DexScreener price) 2026-07.

import type { ChainKey } from '@/lib/chains/types';

export type BasketKind = 'wrapped-native' | 'core' | 'stable';

export interface BasketToken {
  address: string;
  symbol: string;
  decimals: number;
  kind: BasketKind;
  /** Pegged fair value in USD, used when no live DEX price is available. */
  peggedUsd?: number;
}

export interface ValueBasket {
  /** The chain's native coin symbol (PLS / ETH). */
  nativeSymbol: string;
  /** Wrapped-native address — also the price source for the native coin. */
  wrappedNative: string;
  /** ERC-20s to read + value (includes wrapped native). */
  tokens: BasketToken[];
}

const BASKETS: Record<ChainKey, ValueBasket> = {
  pulsechain: {
    nativeSymbol: 'PLS',
    wrappedNative: '0xa1077a294dde1b09bb078844df40758a5d0f9a27',
    tokens: [
      { address: '0xa1077a294dde1b09bb078844df40758a5d0f9a27', symbol: 'WPLS', decimals: 18, kind: 'wrapped-native' },
      { address: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', symbol: 'HEX', decimals: 8, kind: 'core' },
      { address: '0x95b303987a60c71504d99aa1b13b4da07b0790ab', symbol: 'PLSX', decimals: 18, kind: 'core' },
      { address: '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d', symbol: 'INC', decimals: 18, kind: 'core' },
      // Pegged stablecoins — the bridged "…from Ethereum" tokens (NOT pDAI).
      { address: '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07', symbol: 'USDC', decimals: 6, kind: 'stable', peggedUsd: 1 },
      { address: '0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f', symbol: 'USDT', decimals: 6, kind: 'stable', peggedUsd: 1 },
      { address: '0xefd766ccb38eaf1dfd701853bfce31359239f305', symbol: 'DAI', decimals: 18, kind: 'stable', peggedUsd: 1 },
    ],
  },
  ethereum: {
    nativeSymbol: 'ETH',
    wrappedNative: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    tokens: [
      { address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', symbol: 'WETH', decimals: 18, kind: 'wrapped-native' },
      { address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', symbol: 'WBTC', decimals: 8, kind: 'core' },
      { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC', decimals: 6, kind: 'stable', peggedUsd: 1 },
      { address: '0xdac17f958d2ee523a2206206994597c13d831ec7', symbol: 'USDT', decimals: 6, kind: 'stable', peggedUsd: 1 },
      { address: '0x6b175474e89094c44da98b954eedeac495271d0f', symbol: 'DAI', decimals: 18, kind: 'stable', peggedUsd: 1 },
    ],
  },
  robinhood: {
    nativeSymbol: 'ETH',
    wrappedNative: '0x0bd7d308f8e1639fab988df18a8011f41eacad73',
    tokens: [
      { address: '0x0bd7d308f8e1639fab988df18a8011f41eacad73', symbol: 'WETH', decimals: 18, kind: 'wrapped-native' },
      { address: '0x5fc5360d0400a0fd4f2af552add042d716f1d168', symbol: 'USDG', decimals: 6, kind: 'stable', peggedUsd: 1 },
    ],
  },
};

export function basketForChain(chain: ChainKey): ValueBasket {
  return BASKETS[chain];
}
