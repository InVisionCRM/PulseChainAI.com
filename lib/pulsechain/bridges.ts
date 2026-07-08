// Known PulseChain bridge contracts. A transfer *to* a bridge is an outflow
// (leaving PulseChain); a transfer *from* a bridge is an inflow (arriving).
// Single source of truth shared by the token- and wallet-scoped bridge views.

export interface BridgeInfo {
  address: string;
  label: string;
}

export const BRIDGES: BridgeInfo[] = [
  // PulseChain-side omnibridge mediator — where tokens are sent to bridge OUT to
  // Ethereum (and released FROM when bridging in). This is the contract real
  // bridge flows go through on PulseChain; verified against known bridge-out
  // transactions. NOTE: 0x1715a3e4…aeba10d is the *Ethereum-side* omnibridge
  // and only receives dust on PulseChain, so it is intentionally not used here.
  { address: '0x4fd0aaa7506f3d9cb8274bdb946ec42a1b8751ef', label: 'PulseChain Bridge' },
];

export const BRIDGE_SET = new Set(BRIDGES.map((b) => b.address.toLowerCase()));

export const isBridge = (addr: string | null | undefined) =>
  !!addr && BRIDGE_SET.has(addr.toLowerCase());

export const bridgeLabel = (addr: string | null | undefined) =>
  BRIDGES.find((b) => b.address.toLowerCase() === (addr || '').toLowerCase())?.label ??
  'Bridge';
