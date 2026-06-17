// Single source of truth for PulseChain explorer links.
//
// PulseChain's canonical explorer is Otterscan, served from IPFS
// (otter.pulsechain.com). We deep-link through the Pinata gateway with a
// pinned CID plus Otterscan's hash routes (#/tx, #/address, #/block).
//
// If the Otterscan app is re-pinned to a new CID, update OTTERSCAN_IPFS_CID
// here — every PulseChain link in the app flows through these helpers, so it's
// a one-line change. Auto-updating alternative if a gateway misbehaves:
// https://otter.pulsechain.com/#/tx/<hash>
//
// NOTE: Otterscan has no /token route — token contracts open on the address
// page — so pulsechainTokenUrl() intentionally maps to #/address.

export const OTTERSCAN_IPFS_CID =
  'bafybeienxyoyrhn5tswclvd3gdjy5mtkkwmu37aqtml6onbf7xnb3o22pe';

const BASE = `https://scan.mypinata.cloud/ipfs/${OTTERSCAN_IPFS_CID}/#`;

export const pulsechainTxUrl = (hash: string) => `${BASE}/tx/${hash}`;
export const pulsechainAddressUrl = (addr: string) => `${BASE}/address/${addr}`;
export const pulsechainTokenUrl = (addr: string) => `${BASE}/address/${addr}`;
export const pulsechainBlockUrl = (block: string | number) => `${BASE}/block/${block}`;

// Generic builder for a caller that already has an Otterscan path segment
// (e.g. "tx/0x…" or "address/0x…"). Leading slashes are tolerated.
export const pulsechainExplorerUrl = (path: string) =>
  `${BASE}/${String(path).replace(/^\/+/, '')}`;

// Display label for the explorer link text.
export const PULSECHAIN_EXPLORER_NAME = 'Otterscan';
