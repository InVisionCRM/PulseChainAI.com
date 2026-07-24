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

const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;
const LIMIT = 100;

async function fromBlockscout(base: string, token: string, sendLimit: boolean): Promise<{
  holders: Array<{ address: string; value: string; isContract: boolean }>;
  totalSupply: string | null;
  holdersCount: number | null;
} | null> {
  // Blockscout returns ~50 holders per page regardless of the ?limit= hint, so
  // to actually reach LIMIT we follow next_page_params. (`sendLimit` still adds
  // the hint on PulseChain; other instances reject it and paginate the default.)
  let url = sendLimit
    ? `${base}/tokens/${token}/holders?limit=${LIMIT}`
    : `${base}/tokens/${token}/holders`;
  const items: any[] = [];
  let meta: any = null;
  for (let page = 0; page < 3 && items.length < LIMIT; page++) {
    // PulseScan intermittently 500s on paginated holder reads (same request
    // succeeds on a retry), so give each page a couple of quick attempts before
    // giving up. If a page ultimately fails we keep whatever we already have.
    let data: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 120 },
      }).catch(() => null);
      if (res && res.ok) {
        const parsed = await res.json().catch(() => null);
        if (parsed && Array.isArray(parsed.items)) { data = parsed; break; }
      }
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
    if (!data) break;
    const pageItems: any[] = Array.isArray(data?.items) ? data.items : [];
    if (pageItems.length === 0) break;
    if (meta == null) meta = pageItems[0]?.token ?? {};
    items.push(...pageItems);
    const np = data?.next_page_params;
    if (!np || items.length >= LIMIT) break;
    const qs = new URLSearchParams(Object.entries(np).map(([k, v]) => [k, String(v)])).toString();
    url = `${base}/tokens/${token}/holders?${qs}`;
  }
  if (items.length === 0) return null;
  return {
    holders: items.slice(0, LIMIT).map((it) => ({
      address: String(it?.address?.hash ?? '').toLowerCase(),
      value: String(it?.value ?? '0'),
      isContract: !!it?.address?.is_contract,
    })),
    totalSupply: meta?.total_supply ?? null,
    holdersCount: meta?.holders != null ? Number(meta.holders) : null,
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

  // Prefer the indexer when it's healthy.
  const bs = await fromBlockscout(base, token, chain === 'pulsechain');
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
        holders: set.holders.slice(0, LIMIT),
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
