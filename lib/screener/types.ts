/** Shared types for the home-page screener (server + client). */

export type ScreenerWindow = 'm5' | 'h1' | 'h6' | 'h24';
export type ScreenerTab = 'trending' | 'top' | 'gainers' | 'new' | 'gold';

export interface WindowValues {
  m5: number | null;
  h1: number | null;
  h6: number | null;
  h24: number | null;
}

export interface ScreenerRow {
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
