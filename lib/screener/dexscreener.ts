/**
 * DexScreener REST client (server-side only).
 * Single market-data source for the screener — batch pair reads + search.
 * Rate limit: 300 req/min on /latest/dex/*.
 */

import type { SearchPair } from './types';

const BASE = 'https://api.dexscreener.com';
export const BATCH_SIZE = 30;

interface DsToken {
  address: string;
  name: string;
  symbol: string;
}

interface DsPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  labels?: string[];
  baseToken: DsToken;
  quoteToken: DsToken;
  priceUsd?: string;
  txns?: Record<string, { buys: number; sells: number }>;
  volume?: Record<string, number>;
  priceChange?: Record<string, number>;
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string };
}

/** Normalized market row keyed by lowercase pair address. */
export interface MarketRow {
  pairAddress: string;
  dexId: string;
  label: string | null;
  baseAddress: string;
  baseSymbol: string;
  baseName: string;
  quoteAddress: string;
  quoteSymbol: string;
  imageUrl: string | null;
  priceUsd: number | null;
  marketCap: number | null;
  fdv: number | null;
  liquidityUsd: number | null;
  pairCreatedAt: string | null;
  txnsM5: number;
  txnsH1: number;
  txnsH6: number;
  txnsH24: number;
  volM5: number;
  volH1: number;
  volH6: number;
  volH24: number;
  chgM5: number | null;
  chgH1: number | null;
  chgH6: number | null;
  chgH24: number | null;
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function txnCount(p: DsPair, w: string): number {
  const t = p.txns?.[w];
  return t ? (t.buys || 0) + (t.sells || 0) : 0;
}

function normalize(p: DsPair): MarketRow {
  return {
    pairAddress: p.pairAddress.toLowerCase(),
    dexId: p.dexId,
    label: p.labels?.[0] ?? null,
    baseAddress: p.baseToken.address.toLowerCase(),
    baseSymbol: p.baseToken.symbol,
    baseName: p.baseToken.name,
    quoteAddress: p.quoteToken.address.toLowerCase(),
    quoteSymbol: p.quoteToken.symbol,
    imageUrl: p.info?.imageUrl ?? null,
    priceUsd: num(p.priceUsd),
    marketCap: num(p.marketCap),
    fdv: num(p.fdv),
    liquidityUsd: num(p.liquidity?.usd),
    pairCreatedAt: p.pairCreatedAt ? new Date(p.pairCreatedAt).toISOString() : null,
    txnsM5: txnCount(p, 'm5'),
    txnsH1: txnCount(p, 'h1'),
    txnsH6: txnCount(p, 'h6'),
    txnsH24: txnCount(p, 'h24'),
    volM5: num(p.volume?.m5) ?? 0,
    volH1: num(p.volume?.h1) ?? 0,
    volH6: num(p.volume?.h6) ?? 0,
    volH24: num(p.volume?.h24) ?? 0,
    chgM5: num(p.priceChange?.m5),
    chgH1: num(p.priceChange?.h1),
    chgH6: num(p.priceChange?.h6),
    chgH24: num(p.priceChange?.h24),
  };
}

async function dsGet(path: string): Promise<{ pairs: DsPair[] | null }> {
  const res = await fetch(`${BASE}${path}`, {
    signal: AbortSignal.timeout(8000),
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`DexScreener ${res.status} on ${path}`);
  return res.json();
}

/**
 * Fetch market data for up to BATCH_SIZE pair addresses.
 * Returns a map keyed by lowercase pair address; addresses DexScreener
 * does not know are simply absent from the map.
 */
export async function fetchPairsBatch(addresses: string[]): Promise<Map<string, MarketRow>> {
  if (addresses.length === 0) return new Map();
  if (addresses.length > BATCH_SIZE) {
    throw new Error(`fetchPairsBatch: max ${BATCH_SIZE} addresses, got ${addresses.length}`);
  }
  const json = await dsGet(`/latest/dex/pairs/pulsechain/${addresses.join(',')}`);
  const out = new Map<string, MarketRow>();
  for (const p of json.pairs ?? []) {
    if (p && p.chainId === 'pulsechain') {
      const row = normalize(p);
      out.set(row.pairAddress, row);
    }
  }
  return out;
}

/** Search PulseChain pairs by symbol/name/address. */
export async function searchPulsechain(query: string): Promise<SearchPair[]> {
  const json = await dsGet(`/latest/dex/search?q=${encodeURIComponent(query)}`);
  return (json.pairs ?? [])
    .filter((p) => p && p.chainId === 'pulsechain')
    .slice(0, 40)
    .map((p) => ({
      pairAddress: p.pairAddress,
      dexId: p.dexId ?? null,
      label: p.labels?.[0] ?? null,
      baseAddress: p.baseToken.address,
      baseSymbol: p.baseToken.symbol,
      baseName: p.baseToken.name ?? null,
      quoteSymbol: p.quoteToken?.symbol ?? null,
      imageUrl: p.info?.imageUrl ?? null,
      priceUsd: num(p.priceUsd),
      marketCap: num(p.marketCap) ?? num(p.fdv),
      liquidityUsd: num(p.liquidity?.usd),
      vol24: num(p.volume?.h24),
      chg24: num(p.priceChange?.h24),
      pairCreatedAt: p.pairCreatedAt ? new Date(p.pairCreatedAt).toISOString() : null,
    }));
}
