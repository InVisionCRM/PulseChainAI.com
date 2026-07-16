// Single source of truth for chain-level configuration.
//
// Values here are verified against live infrastructure (see
// `scripts/verifyRobinhoodChain.ts`). Robinhood Chain is the newest addition:
// an Ethereum L2 on the Arbitrum Orbit stack, chain id 4663, ETH gas,
// ~100 ms blocks. Crucially it exposes a Blockscout v2 API that is
// byte-for-byte compatible with PulseChain's, so read tooling that already
// targets `…/api/v2/*` works unchanged against `robinhoodchain.blockscout.com`.

import type { ChainConfig, ChainKey } from './types';

export const CHAINS: Record<ChainKey, ChainConfig> = {
  ethereum: {
    key: 'ethereum',
    name: 'Ethereum',
    chainId: 1,
    chainIdHex: '0x1',
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    wrappedNative: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
    isL2: false,
    blockscoutApiBase: 'https://eth.blockscout.com/api/v2',
    explorerUrl: 'https://etherscan.io',
    rpcUrls: [
      'https://ethereum-rpc.publicnode.com',
      'https://rpc.ankr.com/eth',
    ],
    dexscreenerSlug: 'ethereum',
    moralisChainId: '0x1',
  },
  pulsechain: {
    key: 'pulsechain',
    name: 'PulseChain',
    chainId: 369,
    chainIdHex: '0x171',
    nativeSymbol: 'PLS',
    nativeDecimals: 18,
    wrappedNative: '0xa1077a294dde1b09bb078844df40758a5d0f9a27', // WPLS
    isL2: false,
    blockscoutApiBase: 'https://api.scan.pulsechain.com/api/v2',
    explorerUrl: 'https://scan.pulsechain.com',
    rpcUrls: [
      'https://rpc.pulsechainrpc.com',
      'https://pulsechain-rpc.publicnode.com',
      'https://rpc.gigatheminter.com',
      'https://rpc-pulsechain.g4mm4.io',
    ],
    dexscreenerSlug: 'pulsechain',
    moralisChainId: '0x171',
  },
  robinhood: {
    key: 'robinhood',
    name: 'Robinhood Chain',
    chainId: 4663,
    chainIdHex: '0x1237',
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    // aeWETH proxy — the canonical wrapped ETH on Robinhood Chain, used as the
    // quote asset by every launchpad's Uniswap pools.
    wrappedNative: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73',
    isL2: true,
    l2Stack: 'Arbitrum Orbit',
    blockscoutApiBase: 'https://robinhoodchain.blockscout.com/api/v2',
    explorerUrl: 'https://robinhoodchain.blockscout.com',
    rpcUrls: [
      // Public, rate-limited sequencer RPC. An Alchemy key
      // (https://robinhood-mainnet.g.alchemy.com/v2/{KEY}) can be prepended
      // later for higher throughput.
      'https://rpc.mainnet.chain.robinhood.com',
    ],
    dexscreenerSlug: 'robinhood',
    // Robinhood Chain (4663) is not indexed by Moralis yet — balances for this
    // chain are sourced from Blockscout instead (see `blockscoutApiBase`).
    moralisChainId: null,
  },
};

export const SUPPORTED_CHAIN_KEYS = Object.keys(CHAINS) as ChainKey[];

/** Lookup by internal key. */
export function getChain(key: ChainKey): ChainConfig {
  return CHAINS[key];
}

/** Lookup by EIP-155 numeric chain id (e.g. 4663 → robinhood). */
export function chainByNumericId(id: number): ChainConfig | null {
  return SUPPORTED_CHAIN_KEYS.map((k) => CHAINS[k]).find((c) => c.chainId === id) ?? null;
}

/** Lookup by DexScreener slug (e.g. 'robinhood' → robinhood). */
export function chainByDexscreenerSlug(slug: string): ChainConfig | null {
  return (
    SUPPORTED_CHAIN_KEYS.map((k) => CHAINS[k]).find(
      (c) => c.dexscreenerSlug === slug,
    ) ?? null
  );
}

/** Type guard: is this string a chain we support? */
export function isChainKey(v: string): v is ChainKey {
  return v in CHAINS;
}
