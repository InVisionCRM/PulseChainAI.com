// POST /api/portfolio/holders
// Body: { address: string; chain?: ChainId; limit?: number }
// Returns: HolderSet — the top holders of a token as bubble-map nodes (size =
// % of supply), plus token meta. Fast path (≤3 Blockscout calls), cached 1h in
// fetchTopHolders. The Bubble Map paints bubbles from this immediately, then
// overlays edges from /api/portfolio/holder-graph.

import { NextResponse } from 'next/server';
import { fetchTopHolders, type ChainId } from '@/lib/portfolio/holders';

const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;

export async function POST(req: Request) {
  let body: { address?: string; chain?: ChainId; limit?: number };
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
  // Up to 1000 bubbles — paginated holder fetch is cheap (50/page) and the
  // renderer uses Barnes-Hut, so node count is not the bottleneck. Clusters are
  // capped separately in /holder-graph.
  const limit = Math.min(Math.max(body.limit ?? 100, 10), 1000);

  const set = await fetchTopHolders(chain, address, limit);
  if (!set) {
    return NextResponse.json({ error: 'No holder data' }, { status: 404 });
  }
  return NextResponse.json(set, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  });
}
