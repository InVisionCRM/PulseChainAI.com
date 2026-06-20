// PulseChain is a full fork of Ethereum at block 17233000 (2023-05-10, ~22:52
// UTC). Every block at or below the fork point is inherited Ethereum history:
// those transactions actually happened on Ethereum mainnet, where the native
// asset was ETH — not PLS. The g4mm4 PulseChain node serves this entire pre-fork
// chain, so a wallet's earliest funding can legitimately date back to 2015. We
// use the block height to attribute each transfer to the chain/asset that was
// really in play, so a 2015 transfer reads as ETH on Ethereum rather than PLS.

import type { ChainId } from '@/services';

export const PULSECHAIN_FORK_BLOCK = 17_233_000;

export interface ForkAttribution {
  chain: ChainId; // where this transfer actually happened
  asset: 'ETH' | 'PLS'; // native asset at that time
  preFork: boolean; // true = inherited pre-fork Ethereum history
}

/** Attribute a PulseChain-node result to its real chain/asset by block height. */
export function attributePulsechainBlock(
  block: number | null | undefined,
): ForkAttribution {
  const preFork = typeof block === 'number' && block < PULSECHAIN_FORK_BLOCK;
  return preFork
    ? { chain: 'ethereum', asset: 'ETH', preFork: true }
    : { chain: 'pulsechain', asset: 'PLS', preFork: false };
}
