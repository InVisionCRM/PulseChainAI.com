// GET /api/geicko/holders?token=0x..&network=pulsechain
//
// Holder list for the Geicko holders tab / bubble map. Primary source is
// PulseScan (Blockscout) — fast and complete. When that indexer is down
// (recurring HTTP 500 outages), we reconstruct the holder set directly from
// on-chain Transfer logs via the archive RPC pool. That walk is exact but only
// affordable for tokens whose full history fits the budget; for larger tokens
// we return complete:false so the client can show "partial / unavailable"
// rather than wrong balances.

import { NextRequest, NextResponse } from 'next/server';
import {
  getLatestBlock,
  findDeploymentBlock,
  reconstructHolders,
} from '@/lib/geicko/rpcHolders';
import { getChain, isChainKey } from '@/lib/chains/registry';
import { cached } from '@/lib/geicko/serverCache';

const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;
// The holders tab lazy-loads a page at a time (cursor-based) so it can go deep
// without ever blocking on a big sequential walk. `limit` is the page size —
// how many holders one response returns. Blockscout serves 50 per page, so a
// 100-holder page is ~2 upstream pages. Consumers that only want a top slice
// (connections, holder-overlap, gumshoe) call once with no cursor.
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 100;

// A single page is cheap (1–2 upstream fetches), so a short budget is plenty;
// on timeout/failure we return what we got and DON'T cache it, so the next
// request retries rather than being stuck with a short page.
const PAGE_DEADLINE_MS = 12_000;

type BlockscoutPage = {
  holders: Array<{ address: string; value: string; isContract: boolean }>;
  totalSupply: string | null;
  holdersCount: number | null;
  complete: boolean;
  // Opaque cursor for the next page (JSON of Blockscout's next_page_params), or
  // null when there are no more holders. The client passes it back as `?cursor=`.
  nextCursor: string | null;
};

async function fromBlockscout(
  base: string,
  token: string,
  sendLimit: boolean,
  pageSize: number,
  startCursor: Record<string, unknown> | null,
): Promise<BlockscoutPage | null> {
  // Build the first upstream URL: from the cursor if we're paging deeper,
  // otherwise from the top (with the limit hint on PulseChain).
  const buildUrl = (params: Record<string, unknown> | null) => {
    if (params) {
      const qs = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      ).toString();
      return `${base}/tokens/${token}/holders?${qs}`;
    }
    return sendLimit
      ? `${base}/tokens/${token}/holders?limit=${pageSize}`
      : `${base}/tokens/${token}/holders`;
  };

  let url = buildUrl(startCursor);
  const maxUpstreamPages = Math.ceil(pageSize / 50) + 1;
  const items: any[] = [];
  let meta: any = null;
  let complete = false;
  let lastNextParams: Record<string, unknown> | null = null;
  const start = Date.now();

  for (let page = 0; page < maxUpstreamPages && items.length < pageSize; page++) {
    if (Date.now() - start > PAGE_DEADLINE_MS) break; // partial; complete stays false
    // PulseScan intermittently 500s on paginated holder reads (same request
    // succeeds on a retry), so give each upstream page one quick second attempt.
    let data: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 120 },
      }).catch(() => null);
      if (res && res.ok) {
        const parsed = await res.json().catch(() => null);
        if (parsed && Array.isArray(parsed.items)) { data = parsed; break; }
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, 200));
    }
    if (!data) break; // page failed after retry; partial, complete stays false
    const pageItems: any[] = Array.isArray(data?.items) ? data.items : [];
    if (pageItems.length === 0) { complete = true; lastNextParams = null; break; }
    if (meta == null) meta = pageItems[0]?.token ?? {};
    items.push(...pageItems);
    const np = data?.next_page_params;
    lastNextParams = np ?? null;
    if (!np) { complete = true; break; }                 // natural end of the list
    if (items.length >= pageSize) { complete = true; break; } // page is full
    url = buildUrl(np);
  }
  if (items.length === 0) return null;

  const trimmed = items.slice(0, pageSize);
  // If we trimmed mid-upstream-page there are definitely more holders; keep the
  // cursor. Otherwise the cursor is whatever the last upstream page reported.
  const moreExist = items.length > pageSize || !!lastNextParams;
  return {
    holders: trimmed.map((it) => ({
      address: String(it?.address?.hash ?? '').toLowerCase(),
      value: String(it?.value ?? '0'),
      isContract: !!it?.address?.is_contract,
    })),
    totalSupply: meta?.total_supply ?? null,
    holdersCount: meta?.holders != null ? Number(meta.holders) : null,
    complete,
    nextCursor: moreExist && lastNextParams ? JSON.stringify(lastNextParams) : null,
  };
}

export async function GET(req: NextRequest) {
  const token = (req.nextUrl.searchParams.get('token') || '').toLowerCase();
  if (!ADDRESS_RX.test(token)) {
    return NextResponse.json({ error: 'token required' }, { status: 400 });
  }
  const network = (req.nextUrl.searchParams.get('network') || 'pulsechain').toLowerCase();
  const chain = isChainKey(network) ? network : 'pulsechain';
  const base = getChain(chain).blockscoutApiBase;
  if (!base) {
    return NextResponse.json({ error: 'chain has no explorer' }, { status: 400 });
  }

  // Page size for this response. Clamp to [1, MAX_PAGE_SIZE].
  const limitRaw = parseInt(req.nextUrl.searchParams.get('limit') || '', 10);
  const pageSize = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(MAX_PAGE_SIZE, limitRaw))
    : DEFAULT_PAGE_SIZE;

  // Opaque cursor to page deeper (JSON of Blockscout's next_page_params). Absent
  // for the first page. Malformed cursors are ignored (treated as first page).
  const cursorRaw = req.nextUrl.searchParams.get('cursor');
  let startCursor: Record<string, unknown> | null = null;
  if (cursorRaw) {
    try {
      const parsed = JSON.parse(cursorRaw);
      if (parsed && typeof parsed === 'object') startCursor = parsed;
    } catch { /* ignore bad cursor */ }
  }

  // Prefer the indexer when it's healthy. Memoize each page (keyed by cursor) so
  // re-renders / repeat visits don't re-fetch it within the TTL.
  const cursorKey = startCursor ? (cursorRaw as string) : 'top';
  const bs = await cached(
    `geicko-holders:${chain}:${token}:${pageSize}:${cursorKey}`,
    5 * 60_000,
    () => fromBlockscout(base, token, chain === 'pulsechain', pageSize, startCursor),
    // Only remember a cleanly-fetched page. A partial (explorer 500'd or we hit
    // the time budget) is still returned to the caller but not cached, so the
    // next request retries instead of being stuck with a short page.
    (v) => v != null && v.holders.length > 0 && v.complete === true,
  );
  if (bs) {
    return NextResponse.json(
      { source: 'blockscout', complete: true, ...bs },
      { headers: { 'Cache-Control': 'public, s-maxage=120' } },
    );
  }

  // Indexer down. The Transfer-log reconstruction below runs on PulseChain
  // archive nodes; for other chains we can't reconstruct correctly, so report
  // unavailable rather than return wrong balances.
  if (chain !== 'pulsechain') {
    return NextResponse.json(
      { source: 'unavailable', complete: false, holders: [], holdersCount: null,
        reason: 'explorer indexer is down for this chain' },
      { headers: { 'Cache-Control': 'public, s-maxage=30' } },
    );
  }

  // PulseChain: reconstruct from Transfer logs.
  try {
    const latest = await getLatestBlock();
    const fromBlock = await findDeploymentBlock(token, latest);
    const set = await reconstructHolders(token, { fromBlock, latest });
    // Never return a partial walk's balances — they're net *flow* over the
    // covered range, not true balances, so top-holder ordering would be wrong.
    // Only a complete walk yields correct holders; otherwise report unavailable.
    if (!set.complete) {
      return NextResponse.json(
        {
          source: 'rpc-logs',
          complete: false,
          holders: [],
          holdersCount: null,
          reason: 'token history too large to reconstruct live; needs the indexer',
          walk: { fromBlock: set.fromBlock, toBlock: set.toBlock, calls: set.calls },
        },
        { headers: { 'Cache-Control': 'public, s-maxage=60' } },
      );
    }
    return NextResponse.json(
      {
        source: 'rpc-logs',
        complete: true,
        holders: set.holders.slice(0, pageSize),
        holdersCount: set.holdersCount,
        walk: { fromBlock: set.fromBlock, toBlock: set.toBlock, calls: set.calls },
      },
      { headers: { 'Cache-Control': 'public, s-maxage=600' } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: 'holders unavailable', detail: String(e) },
      { status: 502 },
    );
  }
}
