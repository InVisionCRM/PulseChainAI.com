import type { ScreenerRow } from './types';

// Tokens that are always surfaced on the home screener — pinned to the top of
// the list and guaranteed a spot in the bubble field, regardless of the active
// tab, sort, or filters. Resolved live via the watchlist API (DexScreener), so
// they appear even when not present in the screener's own indexed universe.
export const PINNED_TOKENS: Array<{ chain: 'pulsechain' | 'ethereum'; address: string; symbol: string }> = [
  { chain: 'pulsechain', address: '0xb7d4eb5fdfe3d4d3b5c16a44a49948c6ec77c6f1', symbol: 'Morbius' },
];

export const PINNED_PARAM = PINNED_TOKENS.map((t) => `${t.chain}:${t.address}`).join(',');

const PINNED_SET = new Set(PINNED_TOKENS.map((t) => t.address.toLowerCase()));

/** True if a token address is one of the pinned tokens. */
export const isPinnedAddress = (addr?: string | null): boolean =>
  !!addr && PINNED_SET.has(addr.toLowerCase());

/**
 * Fetch the live representative row for each pinned token (one per token, order
 * preserved). Returns an empty array on any failure so pinning never breaks the
 * rest of the screener.
 */
export async function fetchPinnedRows(signal?: AbortSignal): Promise<ScreenerRow[]> {
  if (!PINNED_PARAM) return [];
  try {
    const res = await fetch(`/api/watchlist?tokens=${encodeURIComponent(PINNED_PARAM)}`, { signal });
    if (!res.ok) return [];
    const json = (await res.json()) as { rows?: ScreenerRow[] };
    return json.rows ?? [];
  } catch {
    return [];
  }
}
