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

const BLOCKSCOUT = 'https://api.scan.pulsechain.com/api/v2';
const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;
const LIMIT = 100;

async function fromBlockscout(token: string): Promise<{
  holders: Array<{ address: string; value: string; isContract: boolean }>;
  totalSupply: string | null;
  holdersCount: number | null;
} | null> {
  const res = await fetch(`${BLOCKSCOUT}/tokens/${token}/holders?limit=${LIMIT}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 120 },
  }).catch(() => null);
  if (!res || !res.ok) return null;
  const data = await res.json().catch(() => null);
  const items: any[] = Array.isArray(data?.items) ? data.items : [];
  if (items.length === 0) return null;
  const meta = items[0]?.token ?? {};
  return {
    holders: items.map((it) => ({
      address: String(it?.address?.hash ?? '').toLowerCase(),
      value: String(it?.value ?? '0'),
      isContract: !!it?.address?.is_contract,
    })),
    totalSupply: meta.total_supply ?? null,
    holdersCount: meta.holders != null ? Number(meta.holders) : null,
  };
}

export async function GET(req: NextRequest) {
  const token = (req.nextUrl.searchParams.get('token') || '').toLowerCase();
  if (!ADDRESS_RX.test(token)) {
    return NextResponse.json({ error: 'token required' }, { status: 400 });
  }

  // Prefer the indexer when it's healthy.
  const bs = await fromBlockscout(token);
  if (bs) {
    return NextResponse.json(
      { source: 'blockscout', complete: true, ...bs },
      { headers: { 'Cache-Control': 'public, s-maxage=120' } },
    );
  }

  // Indexer down — reconstruct from Transfer logs.
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
