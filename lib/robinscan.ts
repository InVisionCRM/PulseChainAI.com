// Robinscan.io — data client for Robinhood Chain (chain 4663).
//
// Robinhood's Blockscout (robinhoodchain.blockscout.com) is thin/unreliable for
// the fields our token page needs — creator, decimals, supply, holder count,
// per-holder share, verified source — so those UI slots come back empty on the
// Robinhood side. robinscan.io is a dedicated Robinhood Chain explorer whose
// public REST API (free, no key) returns all of it, richer and more complete.
//
// Every endpoint + response shape below was verified live against the API
// (2026-07). It is a single third-party source, so callers should treat a null
// return as "unavailable" and fall back to Blockscout where they can, never
// showing a wrong value.

const BASE = process.env.ROBINSCAN_API_URL || 'https://robinscan.io';
const TIMEOUT_MS = 12_000;
const REVALIDATE_S = 120;

export interface RsToken {
  address: string;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  totalSupply: string | null;
  tokenType: string | null;
  isStock: boolean;
  isIndexed: boolean;
  holderCount: number | null;
  transferCount: number | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  iconUrl: string | null;
}

export interface RsHolder {
  holder: string;
  holderName: string | null;
  amount: string;
  balance: string; // raw (base units)
  share: number;   // fraction 0..1 of supply
  valueUsd: number | null;
}
export interface RsHoldersPage {
  items: RsHolder[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RsAddress {
  address: string;
  isContract: boolean;
  balance: string | null; // native, raw wei
  txCount: number | null;
  contractCreator: string | null;
  contractCreationTx: string | null;
  isVerified: boolean;
  implementation: string | null;
  tokenTransfersCount: number | null;
}

export interface RsContract {
  address: string;
  isVerified: boolean;
  name: string | null;
  language: string | null;
  compilerVersion: string | null;
  evmVersion: string | null;
  optimizationEnabled: boolean | null;
  optimizationRuns: number | null;
  licenseType: string | null;
  sourceFiles: Array<{ name: string; content: string }> | null;
  abi: unknown;
  proxyType: string | null;
  implementation: string | null;
}

async function rsFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: REVALIDATE_S },
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    // The API signals a miss with { error: 'not found' }.
    if (data && typeof data === 'object' && 'error' in (data as any)) return null;
    return data as T;
  } catch {
    return null;
  }
}

/** Absolute URL for a robinscan icon (`iconUrl` is a relative `/api/assets/...`). */
export function robinscanAssetUrl(iconUrl: string | null | undefined): string | null {
  if (!iconUrl) return null;
  if (/^https?:\/\//.test(iconUrl)) return iconUrl;
  return `${BASE}${iconUrl.startsWith('/') ? '' : '/'}${iconUrl}`;
}

/** Token metadata: name, symbol, decimals, supply, holderCount, price, mcap, icon. */
export function robinscanToken(address: string): Promise<RsToken | null> {
  return rsFetch<RsToken>(`/api/tokens/${address.toLowerCase()}`);
}

/** One page of holders (page-numbered). `share` is a 0..1 fraction of supply. */
export function robinscanHolders(
  address: string,
  opts?: { page?: number; pageSize?: number },
): Promise<RsHoldersPage | null> {
  const qs = new URLSearchParams();
  if (opts?.page) qs.set('page', String(opts.page));
  if (opts?.pageSize) qs.set('pageSize', String(opts.pageSize));
  const q = qs.toString();
  return rsFetch<RsHoldersPage>(`/api/tokens/${address.toLowerCase()}/holders${q ? `?${q}` : ''}`);
}

/** Address info — isContract, native balance, creator + creation tx, verified. */
export function robinscanAddress(address: string): Promise<RsAddress | null> {
  return rsFetch<RsAddress>(`/api/addresses/${address.toLowerCase()}`);
}

/** Verified contract source + ABI (for the code reader). */
export function robinscanContract(address: string): Promise<RsContract | null> {
  return rsFetch<RsContract>(`/api/contracts/${address.toLowerCase()}`);
}

/** Resolve a symbol/name to a token address. */
export function robinscanSearch(q: string): Promise<{ kind: string; address: string; symbol?: string } | null> {
  return rsFetch(`/api/search?q=${encodeURIComponent(q)}`);
}
