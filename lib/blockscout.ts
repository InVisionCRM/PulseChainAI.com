// Ordered Blockscout REST bases for PulseChain.
//
// The canonical explorer (api.scan.pulsechain.com) has recurring indexer
// outages where every DB-backed endpoint returns HTTP 500. scan.pulsechain.box
// is a second, independently-hosted, fully-synced Blockscout instance that
// stays up through those outages and is CORS-enabled (`access-control-allow-
// origin: *`), so both the server and the browser can use it.
//
// Both are Blockscout v2, so response shapes are identical — with ONE quirk:
// the .box instance rejects the non-standard `?limit=` query param with HTTP
// 422. Blockscout returns 50 holders/page by default and paginates via
// `next_page_params` regardless, so callers must simply not send `?limit=`.
export const BLOCKSCOUT_V2_BASES = [
  'https://api.scan.pulsechain.com/api/v2',
  'https://scan.pulsechain.box/api/v2',
];

// Circuit breaker: during the canonical explorer's outages, trying it first on
// every request wastes seconds per call failing over. Once a base fails, skip it
// for a cooldown so subsequent calls go straight to the healthy mirror. If every
// base is cooling down we still try them all (best effort) rather than give up.
const COOLDOWN_MS = 30_000;
const baseFailUntil = new Map<string, number>();

function orderedBases(): string[] {
  const now = Date.now();
  const live = BLOCKSCOUT_V2_BASES.filter((b) => (baseFailUntil.get(b) ?? 0) <= now);
  return live.length ? live : [...BLOCKSCOUT_V2_BASES];
}
const markBaseDown = (base: string) => baseFailUntil.set(base, Date.now() + COOLDOWN_MS);
const markBaseUp = (base: string) => baseFailUntil.delete(base);

/**
 * GET a Blockscout v2 path (starting with `/`) with base failover. Tries each
 * base in order and returns the first OK JSON body, or null if all fail. Do NOT
 * include a `?limit=` param — the .box mirror rejects it.
 */
export async function blockscoutJson(
  path: string,
  opts?: { revalidateSeconds?: number; timeoutMs?: number },
): Promise<any | null> {
  const timeoutMs = opts?.timeoutMs ?? 12_000;
  for (const base of orderedBases()) {
    try {
      const res = await fetch(base + path, {
        headers: { Accept: 'application/json' },
        ...(opts?.revalidateSeconds
          ? { next: { revalidate: opts.revalidateSeconds } }
          : {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) {
        markBaseUp(base);
        return await res.json();
      }
      markBaseDown(base);
    } catch {
      markBaseDown(base);
    }
  }
  return null;
}

export interface BlockscoutHolderItem {
  address: { hash: string; is_contract?: boolean; name?: string | null };
  value: string;
}

export interface BlockscoutHolders {
  items: BlockscoutHolderItem[];
  /** Token meta fetched from /tokens/{addr} (works on both instances). */
  totalSupplyRaw: string | null;
  decimals: number;
  symbol: string | null;
  holdersCount: number | null;
}

/**
 * Top holders of a token with base failover and pagination, up to `cap`. Meta
 * (total supply, decimals, symbol, holders count) is read from /tokens/{addr}
 * because the .box mirror's holder items — unlike the primary's — don't embed a
 * `token` object. Never sends `?limit=` (the mirror rejects it); Blockscout
 * returns 50/page and we page via `next_page_params`. Returns null if every
 * base fails.
 */
export async function fetchBlockscoutHolders(
  token: string,
  cap = 100,
): Promise<BlockscoutHolders | null> {
  const tok = token.toLowerCase();
  const meta = await blockscoutJson(`/tokens/${tok}`);

  for (const base of orderedBases()) {
    try {
      const items: BlockscoutHolderItem[] = [];
      let path = `/tokens/${tok}/holders`;
      const maxPages = Math.ceil(cap / 50);
      for (let page = 0; page < maxPages && items.length < cap; page++) {
        const res = await fetch(base + path, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(12_000),
        });
        if (!res.ok) {
          markBaseDown(base);
          throw new Error(`HTTP ${res.status}`);
        }
        markBaseUp(base);
        const data = await res.json();
        const pageItems: BlockscoutHolderItem[] = Array.isArray(data?.items)
          ? data.items
          : [];
        if (pageItems.length === 0) break;
        items.push(...pageItems);
        const np = data?.next_page_params;
        if (!np) break;
        path =
          `/tokens/${tok}/holders?` +
          new URLSearchParams(
            Object.entries(np).map(([k, v]) => [k, String(v)]),
          ).toString();
      }
      if (items.length === 0) continue;
      return {
        items: items.slice(0, cap),
        totalSupplyRaw: meta?.total_supply ?? null,
        decimals: Number(meta?.decimals ?? 18) || 18,
        symbol: meta?.symbol ?? null,
        holdersCount:
          meta?.holders != null
            ? Number(meta.holders)
            : meta?.holders_count != null
              ? Number(meta.holders_count)
              : null,
      };
    } catch {
      markBaseDown(base);
      // Try the next base.
    }
  }
  return null;
}
