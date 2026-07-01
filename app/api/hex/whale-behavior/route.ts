import { NextRequest, NextResponse } from 'next/server';
import { hexSubgraphQuery, type HexNet as Net } from '@/lib/hex/subgraph';
import {
  classifyEnds, behaviorSummary,
  type StakeRecord, type SellRecord,
} from '@/lib/hex/whaleBehavior';

export const revalidate = 0;
// Pages the wallet's swap history + its stake history, so give it headroom.
export const maxDuration = 60;

// How far back to page the wallet's HEX swaps (bounds Moralis usage). Ends older
// than the oldest swap we see are reported "unknown" rather than guessed.
const MAX_SWAP_PAGES = 6;
const SWAP_PAGE_SIZE = 100;
// Cap the ends we return so a wallet with a huge history stays responsive.
const MAX_ENDS = 40;

const num = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

interface RawHist { stakeId?: string; timestamp?: unknown; stakedHearts?: unknown; transactionHash?: unknown }

function toRecords(rows: RawHist[]): StakeRecord[] {
  return (rows ?? [])
    .map((r) => ({
      stakeId: String(r.stakeId ?? ''),
      timestamp: num(r.timestamp),
      principalHex: num(r.stakedHearts) / 1e8,
      tx: r.transactionHash ? String(r.transactionHash) : undefined,
    }))
    .filter((r) => r.timestamp > 0);
}

/** Wallet's stake starts + ends (with tx) from the staking subgraph. */
async function stakeHistory(net: Net, addr: string): Promise<{ starts: StakeRecord[]; ends: StakeRecord[] }> {
  try {
    const d = await hexSubgraphQuery<{ stakeStarts: RawHist[]; stakeEnds: RawHist[] }>(
      net,
      `{ stakeStarts(where:{ stakerAddr: "${addr}" }, first: 1000){ stakeId timestamp stakedHearts transactionHash } stakeEnds(where:{ stakerAddr: "${addr}" }, first: 1000){ stakeId timestamp stakedHearts transactionHash } }`,
    );
    return { starts: toRecords(d.stakeStarts), ends: toRecords(d.stakeEnds) };
  } catch {
    return { starts: [], ends: [] };
  }
}

const tsOf = (iso: unknown) => {
  const ms = Date.parse(String(iso));
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
};

const HEX_TOKEN: Record<Net, string> = {
  ethereum: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39',
  pulsechain: '0x57fde0a71132198dfc1b2490b26c17fcef9601b2',
};
const MORALIS_CHAIN: Record<Net, string> = { ethereum: '0x1', pulsechain: '0x171' };
const MORALIS_KEY = process.env.NEXT_PUBLIC_MORALIS_API_KEY || process.env.MORALIS_API_KEY || '';
const addrEq = (a: unknown, b: string) => String(a ?? '').toLowerCase() === b;

/**
 * Extract a HEX sale from one Moralis swap row, defensively across response
 * shapes: the documented `{ sold, bought }` swaps shape (amounts already
 * human-scaled) and the older flat `{ token_address, direction, amount }` shape.
 * Returns the HEX amount + USD when the wallet sold HEX, else null.
 */
function hexSoldFromSwap(row: Record<string, unknown>, hexAddr: string): { hex: number; usd: number } | null {
  const sold = row.sold as Record<string, unknown> | undefined;
  if (sold && addrEq(sold.address ?? sold.token_address, hexAddr)) {
    const hex = num(sold.amount);
    return hex > 0 ? { hex, usd: num(sold.usd_amount ?? sold.usdAmount ?? sold.usd_value) } : null;
  }
  if (addrEq(row.token_address, hexAddr) && String(row.direction ?? '').toUpperCase() === 'OUT') {
    const hex = num(row.amount) / Math.pow(10, num(row.token_decimals) || 8);
    return hex > 0 ? { hex, usd: num(row.value_usd) } : null;
  }
  return null;
}

/**
 * Wallet's HEX sells + the oldest swap timestamp we saw (the boundary of our
 * activity coverage). Bounded pagination against Moralis. Reads swaps directly
 * so it isn't tied to one assumed response shape.
 */
async function hexSells(net: Net, addr: string): Promise<{ sells: SellRecord[]; oldestActivityTs: number | null }> {
  const sells: SellRecord[] = [];
  let oldest: number | null = null;
  if (!MORALIS_KEY) return { sells, oldestActivityTs: oldest };
  const hexAddr = HEX_TOKEN[net];

  for (let page = 0; page < MAX_SWAP_PAGES; page++) {
    let rows: Record<string, unknown>[] = [];
    let cursor: string | undefined;
    try {
      const url = `https://deep-index.moralis.io/api/v2.2/wallets/${addr}/swaps?chain=${MORALIS_CHAIN[net]}&order=DESC&limit=${SWAP_PAGE_SIZE}&offset=${page * SWAP_PAGE_SIZE}`;
      const res = await fetch(url, { headers: { accept: 'application/json', 'X-API-Key': MORALIS_KEY } });
      if (!res.ok) break;
      const j = await res.json();
      rows = (j.result ?? []) as Record<string, unknown>[];
      cursor = j.cursor as string | undefined;
    } catch {
      break;
    }
    for (const row of rows) {
      const ts = tsOf(row.block_timestamp ?? (row as Record<string, unknown>).blockTimestamp);
      if (ts > 0) oldest = oldest == null ? ts : Math.min(oldest, ts);
      const sale = hexSoldFromSwap(row, hexAddr);
      if (sale && ts > 0) {
        sells.push({ timestamp: ts, hex: sale.hex, usd: sale.usd, tx: String(row.transaction_hash ?? row.transactionHash ?? '') });
      }
    }
    if (!cursor || rows.length === 0) break; // no more pages
  }
  return { sells, oldestActivityTs: oldest };
}

export async function GET(req: NextRequest) {
  const net = (req.nextUrl.searchParams.get('network') === 'ethereum' ? 'ethereum' : 'pulsechain') as Net;
  const address = (req.nextUrl.searchParams.get('address') || '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  try {
    const [{ starts, ends }, { sells, oldestActivityTs }] = await Promise.all([
      stakeHistory(net, address),
      hexSells(net, address),
    ]);

    const behavior = classifyEnds(ends, starts, sells, oldestActivityTs).slice(0, MAX_ENDS);
    const summary = behaviorSummary(behavior);

    return NextResponse.json(
      { address, network: net, oldestActivityTs, behavior, summary },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800' } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load whale behavior' },
      { status: 500 },
    );
  }
}
