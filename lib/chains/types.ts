// Forward-looking chain descriptor used by multi-chain features.
//
// The app's existing `ChainId` union (`services/core/types.ts`) is still the
// type threaded through the portfolio/screener tools today. This registry is a
// SUPERSET that also describes Robinhood Chain, so new chain-aware code can be
// written against a single source of truth without having to widen `ChainId`
// (and refill ~40 `Record<ChainId, …>` literals) in one shot. As individual
// tools are migrated they can read `CHAINS[key]` here instead of hand-rolling
// per-chain Blockscout/DexScreener/RPC constants.

export type ChainKey = 'ethereum' | 'pulsechain' | 'robinhood';

export interface ChainConfig {
  /** Stable internal key. Overlaps with the legacy `ChainId` where they share
   *  a chain (ethereum, pulsechain). */
  key: ChainKey;
  /** Human display name. */
  name: string;
  /** EIP-155 numeric chain id. */
  chainId: number;
  /** 0x-hex chain id (wallet / Moralis style). */
  chainIdHex: string;
  /** Native gas token symbol. */
  nativeSymbol: string;
  /** Native gas token decimals (18 for every EVM chain we support). */
  nativeDecimals: number;
  /** Wrapped-native ERC-20. Native gas tokens can't be priced directly on
   *  DexScreener, so pricing piggy-backs on the wrapped equivalent. */
  wrappedNative: string;
  /** True for rollups / sidechains that settle to another chain. */
  isL2: boolean;
  /** Rollup stack, when `isL2` (e.g. 'Arbitrum Orbit'). */
  l2Stack?: string;
  /** Blockscout v2 API base (no trailing slash), or null when the chain isn't
   *  served by a Blockscout instance. */
  blockscoutApiBase: string | null;
  /** Explorer web base (no trailing slash). */
  explorerUrl: string;
  /** Ordered public JSON-RPC endpoints; first that answers wins. */
  rpcUrls: string[];
  /** DexScreener chain slug (the `chainId` field DexScreener returns), or null
   *  if DexScreener doesn't index the chain. */
  dexscreenerSlug: string | null;
  /** Moralis chain id (hex), or null when Moralis doesn't index the chain.
   *  Robinhood Chain is a brand-new L2 that Moralis does not yet cover, so its
   *  balances must be sourced from Blockscout instead. */
  moralisChainId: string | null;
}
