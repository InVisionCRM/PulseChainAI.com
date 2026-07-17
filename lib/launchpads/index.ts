// Public entry point for the launchpad registry.
//
// Today only Robinhood Chain has launchpads registered; the aggregate shape is
// per-chain so other chains can be added without touching call sites.

import type { ChainKey } from '@/lib/chains/types';
import { ROBINHOOD_LAUNCHPADS } from './robinhood';
import { PULSECHAIN_LAUNCHPADS } from './pulsechain';
import type { Launchpad } from './types';

export * from './types';
export {
  ROBINHOOD_LAUNCHPADS,
  ROBINHOOD_TOKENS,
  ROBINHOOD_UNISWAP_V3,
  ROBINHOOD_UNISWAP_V4,
  ROBINHOOD_MULTICALL3,
} from './robinhood';
export { PULSECHAIN_LAUNCHPADS, PUMP_TIRES_FACTORY } from './pulsechain';

/** All launchpads across every supported chain. */
export const LAUNCHPADS: Launchpad[] = [...ROBINHOOD_LAUNCHPADS, ...PULSECHAIN_LAUNCHPADS];

/** Launchpads on a given chain. */
export function launchpadsForChain(chain: ChainKey): Launchpad[] {
  return LAUNCHPADS.filter((l) => l.chain === chain);
}

/** Only pads whose contracts are published and verified on-chain. */
export function activeLaunchpads(chain?: ChainKey): Launchpad[] {
  return LAUNCHPADS.filter(
    (l) => l.status === 'active' && (!chain || l.chain === chain),
  );
}

/** Lookup by slug id (e.g. 'noxa'). */
export function getLaunchpad(id: string): Launchpad | null {
  return LAUNCHPADS.find((l) => l.id === id) ?? null;
}

/**
 * Reverse-lookup: which launchpad owns a given contract address? Matches the
 * factory and every other shared contract, case-insensitively. Use this to
 * label a token's creator/router as "launched via NOXA", etc.
 */
export function launchpadByAddress(address: string): Launchpad | null {
  const needle = address.toLowerCase();
  return (
    LAUNCHPADS.find((l) =>
      l.contracts.some((c) => c.address.toLowerCase() === needle),
    ) ?? null
  );
}

/** Every known factory address (lowercased), for fast membership checks. */
export function launchpadFactoryAddresses(chain?: ChainKey): string[] {
  return LAUNCHPADS.filter((l) => (!chain || l.chain === chain) && l.factory)
    .map((l) => (l.factory as string).toLowerCase());
}
