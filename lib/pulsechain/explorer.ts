// Canonical PulseChain explorer links. The app uses the IPFS-hosted Otterscan
// build (scan.pulsechain's IPFS route) rather than a bare domain, so centralize
// it here and link through these helpers.
const IPFS_BASE =
  'https://scan.mypinata.cloud/ipfs/bafybeienxyoyrhn5tswclvd3gdjy5mtkkwmu37aqtml6onbf7xnb3o22pe/#';

export const txUrl = (hash: string) => `${IPFS_BASE}/tx/${hash}`;
export const addressUrl = (address: string) => `${IPFS_BASE}/address/${address}`;
