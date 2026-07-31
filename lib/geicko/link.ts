import type { ChainId } from '@/services';

/**
 * Open a token in the analyzer on its own chain.
 *
 * PulseChain is the analyzer's default and takes no param; every other chain
 * is passed through as `?network=`. This was written out by hand in the search
 * modal and the watchlist modal, and the desktop watchlist had no link at all
 * — one helper so every surface agrees on the convention.
 */
export const geickoHref = (address: string, chain: string = 'pulsechain'): string =>
  `/geicko?address=${address}${chain === 'pulsechain' ? '' : `&network=${chain}`}`;

export type { ChainId };
