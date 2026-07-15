// Launchpad registry types.
//
// A "launchpad" here is a pump.fun-style token-launch protocol. We track the
// small set of *shared* contracts a launchpad deploys once (factory, LP locker,
// fee vault, etc.) — NOT the per-token contracts, which are deployed on every
// launch via CREATE2/clones and are only discoverable from the factory's
// `TokenCreated`-style events. The factory address is the key that lets tools
// answer "which pad launched this token?" and "list every launch by pad X".

import type { ChainKey } from '@/lib/chains/types';

export type LaunchpadStatus =
  /** Contracts published and verified live on-chain. */
  | 'active'
  /** Pad is live/announced but has not published canonical addresses we could
   *  verify — included so the UI can list it, but not yet wired for reads. */
  | 'pending';

export type LaunchpadDexVersion = 'uniswap-v3' | 'uniswap-v4' | 'unknown';

export type LaunchpadContractRole =
  | 'factory' // launch entry point + on-chain registry
  | 'locker' // permanently holds LP positions
  | 'fee-vault' // collects protocol fees
  | 'token-impl' // ERC-20 implementation the factory clones
  | 'router' // swap router used post-launch
  | 'zap' // 1-tx buy/sell helper
  | 'staking' // revenue-share / staking pool
  | 'other';

export interface LaunchpadContract {
  label: string;
  /** Checksummed address as returned by the chain. */
  address: string;
  role: LaunchpadContractRole;
  /**
   * Whether the address had deployed bytecode when it was added to the registry
   * (checked via `eth_getCode`). `false` on a `pending` pad whose address is
   * unknown or unconfirmed.
   */
  verified: boolean;
}

export interface Launchpad {
  /** Stable slug. */
  id: string;
  /** Display name. */
  name: string;
  chain: ChainKey;
  /** Public front-end / docs URL. */
  url: string;
  status: LaunchpadStatus;
  dexVersion: LaunchpadDexVersion;
  /** One-line description of the pad's mechanics. */
  description: string;
  /**
   * Primary entry-point (factory / registry) address — the single most useful
   * address for pulling launches. Null while `status: 'pending'`.
   */
  factory: string | null;
  /** All shared contracts we know about, including the factory. */
  contracts: LaunchpadContract[];
  /** Free-form caveats (e.g. why a pad is pending). */
  notes?: string;
}
