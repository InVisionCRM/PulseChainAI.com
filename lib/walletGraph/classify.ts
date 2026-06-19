// Address classification for the wallet graph. Decides what each counterparty
// actually IS — a wallet (EOA), a generic contract, an ERC-20 token, a DEX
// pool, or a labelled entity (exchange / router / factory / LP locker / OFAC /
// burn). The on-chain probing (eth_getCode + a few eth_calls) happens in the
// /api/portfolio/classify route; this module holds the taxonomy + pure
// resolution so it can be unit-tested.

import { type AddressCategory } from '@/lib/gumshoe/address-labels';

export type AddressType =
  | 'self'
  | 'eoa'
  | 'contract'
  | 'token'
  | 'pool'
  | 'router'
  | 'factory'
  | 'exchange'
  | 'locker'
  | 'ofac'
  | 'burn';

export interface Classification {
  type: AddressType;
  /** Known label when the address is in the directory, else null. */
  label: string | null;
}

// Function selectors (first 4 bytes of keccak256) for the probes.
export const SELECTORS = {
  token0: '0x0dfe1681',
  token1: '0xd21220a7',
  symbol: '0x95d89b41',
  decimals: '0x313ce567',
} as const;

// Labelled categories map straight to a type. `wrapped` (WPLS/WETH) is an
// ERC-20, so it reads as a token.
function typeFromCategory(cat: AddressCategory): AddressType {
  switch (cat) {
    case 'exchange':
      return 'exchange';
    case 'router':
      return 'router';
    case 'factory':
      return 'factory';
    case 'locker':
      return 'locker';
    case 'ofac':
      return 'ofac';
    case 'burn':
      return 'burn';
    case 'wrapped':
      return 'token';
  }
}

/**
 * Resolve a type from what we know. Known-directory category wins; otherwise the
 * on-chain probes decide: no code → EOA, token0+token1 → pool, symbol+decimals →
 * token, anything else with code → generic contract.
 */
export function resolveType(opts: {
  knownCategory: AddressCategory | null;
  hasCode: boolean;
  isPair: boolean;
  isToken: boolean;
}): AddressType {
  if (opts.knownCategory) return typeFromCategory(opts.knownCategory);
  if (!opts.hasCode) return 'eoa';
  if (opts.isPair) return 'pool';
  if (opts.isToken) return 'token';
  return 'contract';
}

// Display metadata for each type — kept here so the graph and any legend share
// one source of truth. Colours are deliberate hexes (rendered on a dark canvas).
export const TYPE_META: Record<
  AddressType,
  { label: string; color: string }
> = {
  self: { label: 'This wallet', color: '#fb923c' },
  eoa: { label: 'Wallet (EOA)', color: '#a78bfa' },
  contract: { label: 'Contract', color: '#94a3b8' },
  token: { label: 'Token', color: '#e879f9' },
  pool: { label: 'DEX pool', color: '#22d3ee' },
  router: { label: 'Router', color: '#2dd4bf' },
  factory: { label: 'Factory', color: '#5eead4' },
  exchange: { label: 'Exchange', color: '#38bdf8' },
  locker: { label: 'LP locker', color: '#fbbf24' },
  ofac: { label: 'OFAC flagged', color: '#f87171' },
  burn: { label: 'Burn', color: '#9ca3af' },
};
