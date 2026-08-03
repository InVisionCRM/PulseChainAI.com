// GET /api/geicko/holder-deltas?token=0x..&network=pulsechain
//
// Every holder's position change over the last 24 hours.
//
// Balances aren't stored per block, so "what did this wallet hold yesterday" has
// two possible answers. `balanceOf` at a historical block needs ARCHIVE STATE,
// which measurement showed only one node in the pool serves (g4mm4; the others
// answer "historical state not available") — a single point of failure. The
// other is to net the token's `Transfer` logs over the window and subtract:
//
//     balance_24h_ago = balance_now − net_change_24h
//
// That needs only archive LOGS, which every node in the pool serves, and it is
// venue-agnostic: a token emits `Transfer` whichever DEX the trade happened on,
// so this sees 9mm and LibertySwap activity that the PulseX-backed buy/sell
// figures miss entirely.
//
// Cost is per TOKEN, not per holder — one scan returns every address at once,
// so there is no saving in limiting it to the top N. Measured over a ~24h
// window (8,300 blocks at PulseChain's 10.4s block time): a mid-cap token is 3
// calls / ~4s; HEX, the busiest on the chain, is 3 calls / ~31s for 52,720
// transfers. The cache below is what keeps that off the request path.
//
// This is a POSITION change, not a buy/sell. A transfer in isn't necessarily a
// purchase — it may be a wallet consolidating — so the payload and the UI both
// say "position".
//
// PulseChain only, free.

import { NextRequest, NextResponse } from 'next/server';
import { getLatestBlock, netTransfers } from '@/lib/geicko/rpcHolders';
import { cached } from '@/lib/geicko/serverCache';

export const revalidate = 0;
export const maxDuration = 60;

const ADDR_RX = /^0x[a-fA-F0-9]{40}$/;

/** PulseChain averages 10.4s blocks (measured); 24h is ~8,300 of them. */
const BLOCKS_24H = 8_308;

/** A 24h window barely moves minute to minute, and the cold scan is expensive
 *  on a busy token, so this is deliberately generous. */
const CACHE_MS = 5 * 60_000;

export interface HolderDelta {
  /** Signed change in raw token units over the window. */
  change: string;
  /** Block the window started at. */
  fromBlock: number;
}

async function build(token: string) {
  const latest = await getLatestBlock();
  const fromBlock = Math.max(0, latest - BLOCKS_24H);

  const walk = await netTransfers(token, {
    fromBlock,
    latest,
    // A 24h window is a handful of calls even on the busiest token, so the
    // budget only has to catch a node going slow, not bound a long history.
    budget: { maxCalls: 40, maxMs: 45_000 },
  });

  // A truncated walk understates movement — a wallet that sold could look
  // untouched. Report nothing rather than something wrong.
  if (!walk.complete) {
    return { supported: true, complete: false, fromBlock, toBlock: latest, deltas: {} };
  }

  const deltas: Record<string, string> = {};
  for (const [addr, change] of walk.net) {
    if (change !== BigInt(0)) deltas[addr] = change.toString();
  }

  return {
    supported: true,
    complete: true,
    fromBlock,
    toBlock: latest,
    /** Addresses absent from this map did not move in the window. */
    deltas,
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const network = (sp.get('network') || 'pulsechain').toLowerCase();
  const token = (sp.get('token') || '').toLowerCase();

  if (network !== 'pulsechain') {
    return NextResponse.json({ supported: false, chain: network, deltas: {} });
  }
  if (!ADDR_RX.test(token)) {
    return NextResponse.json({ error: 'token required' }, { status: 400 });
  }

  try {
    const payload = await cached(
      `holder-deltas:${token}`,
      CACHE_MS,
      () => build(token),
      (v: any) => v?.complete === true,
    );
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build holder deltas' },
      { status: 500 },
    );
  }
}
