// POST /api/portfolio/holder-graph
// Body: { address: string; chain?: ChainId; edgeLimit?: number }
// Returns: { edges, clusters, scannedHolders, holdersCount } — the transfer
// edges + clusters among the token's TOP holders only.
//
// Clusters are the expensive half of the bubble map (one Blockscout transfer
// scan per holder), so we cap the work at the top `edgeLimit` holders — the
// whales and mid-tier where linked-wallet signal actually lives. This is
// deliberately decoupled from how many bubbles /holders renders: you can show
// 1000 bubbles while only clustering the top 150, keeping first-load ~constant.
// Result cached 1h.

import { NextResponse } from 'next/server';
import { fetchTopHolders, type ChainId } from '@/lib/portfolio/holders';
import { buildHolderGraph, type HolderGraph } from '@/lib/portfolio/holderGraph';

const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const cache = new Map<string, { value: HolderGraph & { holdersCount: number | null }; at: number }>();

export async function POST(req: Request) {
  let body: { address?: string; chain?: ChainId; edgeLimit?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const address = (body.address ?? '').toLowerCase();
  if (!ADDRESS_RX.test(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
  }
  const chain: ChainId = body.chain === 'ethereum' ? 'ethereum' : body.chain === 'robinhood' ? 'robinhood' : 'pulsechain';
  // Hard ceiling on clustered holders — beyond ~200 the per-holder transfer
  // scan gets slow and abusive to Blockscout. 150 is the sweet spot.
  const edgeLimit = Math.min(Math.max(body.edgeLimit ?? 150, 10), 200);

  const set = await fetchTopHolders(chain, address, edgeLimit);
  if (!set) {
    return NextResponse.json({ error: 'No holder data' }, { status: 404 });
  }

  const key = `${chain}:${address}:${edgeLimit}`;
  const hit = cache.get(key);
  let payload: HolderGraph & { holdersCount: number | null };
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    payload = hit.value;
  } else {
    const graph = await buildHolderGraph(chain, address, set.nodes);
    payload = { ...graph, holdersCount: set.holdersCount };
    cache.set(key, { value: payload, at: Date.now() });
  }

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  });
}
