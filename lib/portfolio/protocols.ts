// Curated contract → project labels for the activity feed.
//
// The primary source of a counterparty's name is Blockscout's own public tag
// (threaded in as `fallbackName`); this map just upgrades the big DEX routers
// to clean project names plus a `kind` we can colour / group by. Keep it
// small on purpose — a wrong address here mislabels a row, and the Blockscout
// fallback already covers the long tail of contracts.

import type { ChainId } from '@/services';

export type ProtocolKind =
  | 'dex'
  | 'farm'
  | 'lending'
  | 'bridge'
  | 'token'
  | 'nft';

export interface ProtocolInfo {
  name: string;
  kind: ProtocolKind;
}

// Keys are lowercased contract addresses, scoped per chain so an Ethereum
// address can't collide with a PulseChain one.
const PROTOCOLS: Record<ChainId, Record<string, ProtocolInfo>> = {
  pulsechain: {
    '0x98bf93ebf5c380c0e6ae8e192a7e2ae08edacc02': { name: 'PulseX', kind: 'dex' },
    '0x165c3410fc91ef562c50559f7d2289febed552d9': { name: 'PulseX V2', kind: 'dex' },
    '0xa1077a294dde1b09bb078844df40758a5d0f9a27': { name: 'Wrapped PLS', kind: 'token' },
  },
  ethereum: {
    '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': { name: 'Uniswap V2', kind: 'dex' },
    '0xe592427a0aece92de3edee1f18e0157c05861564': { name: 'Uniswap V3', kind: 'dex' },
    '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': { name: 'Uniswap', kind: 'dex' },
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { name: 'Wrapped Ether', kind: 'token' },
  },
};

export function protocolFor(
  chain: ChainId,
  address: string | null | undefined,
): ProtocolInfo | null {
  if (!address) return null;
  return PROTOCOLS[chain]?.[address.toLowerCase()] ?? null;
}

const truncate = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// Best display label for a counterparty: curated project → Blockscout tag →
// truncated address.
export function labelFor(
  chain: ChainId,
  address: string | null | undefined,
  fallbackName?: string | null,
): string {
  const p = protocolFor(chain, address);
  if (p) return p.name;
  if (fallbackName && fallbackName.trim()) return fallbackName.trim();
  return address ? truncate(address) : 'Unknown';
}
