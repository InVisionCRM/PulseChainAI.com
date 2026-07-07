// Known PulseChain bridge contracts. A transfer *to* a bridge is an outflow
// (leaving PulseChain); a transfer *from* a bridge is an inflow (arriving).
// Single source of truth shared by the token- and wallet-scoped bridge views.

export interface BridgeInfo {
  address: string;
  label: string;
}

export const BRIDGES: BridgeInfo[] = [
  { address: '0x1715a3e4a142d8b698131108995174f37aeba10d', label: 'PulseChain Bridge' },
];

export const BRIDGE_SET = new Set(BRIDGES.map((b) => b.address.toLowerCase()));

export const isBridge = (addr: string | null | undefined) =>
  !!addr && BRIDGE_SET.has(addr.toLowerCase());

export const bridgeLabel = (addr: string | null | undefined) =>
  BRIDGES.find((b) => b.address.toLowerCase() === (addr || '').toLowerCase())?.label ??
  'Bridge';
