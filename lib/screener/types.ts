/** Shared types for the home-page screener (server + client). */

export type ScreenerWindow = 'm5' | 'h1' | 'h6' | 'h24';
export type ScreenerTab = 'trending' | 'top' | 'gainers' | 'new' | 'gold';
/** Client-side tabs: 'watchlist' resolves via /api/watchlist, the rest via /api/screener. */
export type ScreenerUiTab = ScreenerTab | 'watchlist';

export interface ScreenerFilters {
  minLiq: number | null;
  minVol24: number | null;
  minAgeH: number | null;
  maxAgeH: number | null;
}

export const EMPTY_FILTERS: ScreenerFilters = { minLiq: null, minVol24: null, minAgeH: null, maxAgeH: null };

export interface WindowValues {
  m5: number | null;
  h1: number | null;
  h6: number | null;
  h24: number | null;
}

export interface ScreenerRow {
  /** Omitted for PulseChain rows; set for cross-chain rows (watchlist, or a
   *  non-PulseChain chain selected in the screener). */
  chainId?: 'pulsechain' | 'ethereum' | 'robinhood';
  pairAddress: string;
  dexId: string | null;
  label: string | null; // v1 / v2 / v3
  baseAddress: string | null;
  baseSymbol: string | null;
  baseName: string | null;
  quoteSymbol: string | null;
  imageUrl: string | null;
  priceUsd: number | null;
  marketCap: number | null;
  liquidityUsd: number | null;
  pairCreatedAt: string | null; // ISO
  txns: WindowValues;
  vol: WindowValues;
  chg: WindowValues;
  gold: boolean;
}

export interface ScreenerStats {
  vol24: number;
  txns24: number;
  pairs: number;
  /** Latest chain block; null when the RPC stat lookup fails (table still renders). */
  block: number | null;
}

export interface DexInfo {
  dexId: string;
  pairs: number;
}

export interface ScreenerResponse {
  rows: ScreenerRow[];
  stats: ScreenerStats;
  dexes: DexInfo[];
  page: number;
  pageSize: number;
}

/** Slim pair shape returned by /api/search (DexScreener search proxy). */
export interface SearchPair {
  /** Chain the pair trades on — drives the analyzer's `?network=` and the row badge. */
  chain: 'pulsechain' | 'ethereum' | 'robinhood';
  pairAddress: string;
  dexId: string | null;
  label: string | null;
  baseAddress: string;
  baseSymbol: string;
  baseName: string | null;
  quoteSymbol: string | null;
  imageUrl: string | null;
  priceUsd: number | null;
  marketCap: number | null;
  liquidityUsd: number | null;
  vol24: number | null;
  chg24: number | null;
  pairCreatedAt: string | null;
}
