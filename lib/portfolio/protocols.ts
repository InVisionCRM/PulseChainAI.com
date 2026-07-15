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
    // Major token contracts — labels approve/stake counterparties (where the
    // tx `to` is the token itself) rather than showing a bare address.
    '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39': { name: 'HEX', kind: 'farm' },
    '0x95b303987a60c71504d99aa1b13b4da07b0790ab': { name: 'PLSX', kind: 'token' },
    '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d': { name: 'INC', kind: 'token' },
  },
  ethereum: {
    '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': { name: 'Uniswap V2', kind: 'dex' },
    '0xe592427a0aece92de3edee1f18e0157c05861564': { name: 'Uniswap V3', kind: 'dex' },
    '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': { name: 'Uniswap', kind: 'dex' },
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { name: 'Wrapped Ether', kind: 'token' },
  },
  robinhood: {
    // Launchpads (factories + lockers) — labels a token's creator/router as
    // "launched via <pad>". See lib/launchpads/robinhood.ts.
    '0xc70e510e14710ea535cab7b2414860af63feab79': { name: 'bow.fun', kind: 'dex' },
    '0x904dccb96d877e6db365282251fa3dd156476660': { name: 'bow.fun Locker', kind: 'dex' },
    '0x62b33a039d289cbda50ebeb72fe4261449e61bcf': { name: 'LaunchHood', kind: 'dex' },
    '0x99b79154ff4fc0e313549b809254b02722631ee0': { name: 'LaunchHood Locker', kind: 'dex' },
    '0xd9ec2db5f3d1b236843925949fe5bd8a3836fccb': { name: 'NOXA', kind: 'dex' },
    '0x7f03effbd7ceb22a3f80dd468f67ef27826acd85': { name: 'NOXA Locker', kind: 'dex' },
    // Shared Uniswap V3 infra used by the pads above.
    '0xcaf681a66d020601342297493863e78c959e5cb2': { name: 'Uniswap V3 Router', kind: 'dex' },
    '0x1f7d7550b1b028f7571e69a784071f0205fd2efa': { name: 'Uniswap V3 Factory', kind: 'dex' },
    // Key tokens.
    '0x0bd7d308f8e1639fab988df18a8011f41eacad73': { name: 'Wrapped Ether', kind: 'token' },
    '0x5fc5360d0400a0fd4f2af552add042d716f1d168': { name: 'USDG', kind: 'token' },
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
