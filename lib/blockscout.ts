// Ordered Blockscout REST bases for PulseChain.
//
// The canonical explorer (api.scan.pulsechain.com) has recurring indexer
// flakiness: DB-backed endpoints (holders, token-transfers) intermittently
// return HTTP 500 "Internal server error" — but succeed on a retry a moment
// later (~1-in-2 to 1-in-3 per attempt). The old scan.pulsechain.box mirror is
// DEAD (Cloudflare 530), so it was removed: it never answered and, worse, the
// circuit-breaker below would cool down the *only* working base for 30s after a
// single 500 and route every following call to the dead mirror. With no mirror
// to fail over to, resilience comes from RETRYING the primary instead.
//
// Callers must still not send a `?limit=` param — Blockscout returns 50/page and
// paginates via `next_page_params`.
export const BLOCKSCOUT_V2_BASES = [
  'https://api.scan.pulsechain.com/api/v2',
];

// Retries for the flaky primary: transient 500s / network errors / the odd
// 200-with-"Internal server error"-string body all get another try with a short
// backoff before the call gives up.
const BLOCKSCOUT_RETRIES = 4;
const backoff = (attempt: number) => new Promise((r) => setTimeout(r, 200 * 2 ** attempt));

// A Blockscout body of `"Internal server error"` (a bare JSON string) is an
// error dressed as a 200 — treat any non-object/array body as a failure.
const isBadBody = (data: unknown) => data == null || typeof data === 'string';

/** GET one Blockscout URL, retrying transient failures. Returns parsed JSON (an
 *  object/array) or null. Exported so the generic PulseChain proxy shares one
 *  retry policy for the flaky primary. */
export async function bsFetchJson(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<any | null> {
  for (let attempt = 0; attempt < BLOCKSCOUT_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (!isBadBody(data)) return data;
        // 200 but an error-string body — retry.
      } else if (res.status < 500) {
        return null; // 4xx (e.g. 404 unknown token) — don't retry.
      }
    } catch {
      // network/timeout — retry
    }
    if (attempt < BLOCKSCOUT_RETRIES - 1) await backoff(attempt);
  }
  return null;
}

/**
 * GET a Blockscout v2 path (starting with `/`), retrying the flaky primary.
 * Returns the parsed JSON body, or null if every attempt fails. Do NOT include a
 * `?limit=` param — Blockscout paginates via `next_page_params`.
 */
export async function blockscoutJson(
  path: string,
  opts?: { revalidateSeconds?: number; timeoutMs?: number; bases?: string[] },
): Promise<any | null> {
  const timeoutMs = opts?.timeoutMs ?? 12_000;
  // `bases` lets non-PulseChain chains reuse this helper by pointing at their own
  // Blockscout instance (e.g. Robinhood). Default is the PulseChain primary.
  const list = opts?.bases ?? BLOCKSCOUT_V2_BASES;
  const init: RequestInit = {
    headers: { Accept: 'application/json' },
    ...(opts?.revalidateSeconds ? { next: { revalidate: opts.revalidateSeconds } } : {}),
  };
  for (const base of list) {
    const data = await bsFetchJson(base + path, init, timeoutMs);
    if (data != null) return data;
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
 * Top holders of a token with pagination, up to `cap`. Meta (total supply,
 * decimals, symbol, holders count) is read from /tokens/{addr}. Never sends
 * `?limit=` — Blockscout returns 50/page and we page via `next_page_params`.
 * Each page GET retries the flaky primary through `bsFetchJson`. Returns null
 * if the first page can't be fetched.
 *
 * `deadlineMs` caps total wall-clock: on a large cap (many pages) over the flaky
 * primary, retries can add up, so a caller with a route timeout can bound the
 * scan and take the partial top-holders it has so far rather than risk a 504.
 */
export async function fetchBlockscoutHolders(
  token: string,
  cap = 100,
  bases?: string[],
  deadlineMs?: number,
): Promise<BlockscoutHolders | null> {
  const tok = token.toLowerCase();
  const list = bases ?? BLOCKSCOUT_V2_BASES;
  const init: RequestInit = { headers: { Accept: 'application/json' } };
  const startedAt = Date.now();
  const meta = await blockscoutJson(`/tokens/${tok}`, bases ? { bases } : undefined);

  for (const base of list) {
    const items: BlockscoutHolderItem[] = [];
    let path = `/tokens/${tok}/holders`;
    const maxPages = Math.ceil(cap / 50);
    for (let page = 0; page < maxPages && items.length < cap; page++) {
      if (deadlineMs != null && Date.now() - startedAt > deadlineMs) break;
      const data = await bsFetchJson(base + path, init, 12_000);
      if (data == null) break; // exhausted retries for this page
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
  }
  return null;
}
