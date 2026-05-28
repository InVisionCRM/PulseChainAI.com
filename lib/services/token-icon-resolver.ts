// Single point of truth for resolving a token's logo URL.
// Most callers already have a hint from the balance fetcher (PulseChain's
// `icon_url` or Moralis's `logo`) — pass it as `hint` and skip the network
// call. When no hint is available we fall back to DexScreener's profile
// data, then cache the result (positive or negative) for CACHE_TTL_MS so
// portfolios with many tokens don't fan out into hundreds of requests.

import { dexscreenerApi } from '@/services';
import type { ChainId } from '@/services';

interface IconCacheEntry {
  url: string | null;
  fetchedAt: number;
}

const cache = new Map<string, IconCacheEntry>();
const CACHE_TTL_MS = 10 * 60_000;

const cacheKey = (address: string, chain: ChainId) =>
  `${chain}:${address.toLowerCase()}`;

export async function resolveTokenIcon(
  address: string,
  chain: ChainId,
  hint?: string | null,
): Promise<string | null> {
  if (hint && hint.trim().length > 0) return hint;

  const key = cacheKey(address, chain);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.url;
  }

  let url: string | null = null;
  try {
    const profile = await dexscreenerApi.getTokenProfile(address);
    if (profile.success && profile.data) {
      url =
        profile.data.tokenInfo?.logoURI ||
        profile.data.profile?.logo ||
        profile.data.info?.imageUrl ||
        null;
    }
  } catch {
    url = null;
  }

  cache.set(key, { url, fetchedAt: Date.now() });
  return url;
}

export function clearTokenIconCache(): void {
  cache.clear();
}
