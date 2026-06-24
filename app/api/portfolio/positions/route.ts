import { NextRequest, NextResponse } from 'next/server';
import type { ChainId } from '@/services';
import { detectHeldPosition, type ProtocolPosition } from '@/lib/portfolio/positions';
import { scanFarms } from '@/lib/portfolio/protocolRegistry';

export const revalidate = 0;
export const maxDuration = 60;

const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;
const BLOCKSCOUT: Record<ChainId, string> = {
  pulsechain: 'https://api.scan.pulsechain.com/api/v2',
  ethereum: 'https://eth.blockscout.com/api/v2',
};
const DEX_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; MorbiusPortfolio/1.0)',
};

// Probe at most this many held tokens (most wallets hold far fewer; this bounds
// RPC fan-out on dust-spammed wallets).
const MAX_TOKENS = 80;

async function fetchJson(url: string, headers?: Record<string, string>): Promise<any | null> {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** DexScreener USD price per token address (chunked, best-effort). */
async function priceMap(addresses: string[]): Promise<Map<string, number>> {
  const uniq = [...new Set(addresses.map((a) => a.toLowerCase()))];
  const map = new Map<string, number>();
  for (let i = 0; i < uniq.length; i += 30) {
    const chunk = uniq.slice(i, i + 30);
    const data = await fetchJson(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`, DEX_HEADERS);
    const pairs: any[] = data?.pairs ?? [];
    for (const p of pairs) {
      const addr = String(p?.baseToken?.address ?? '').toLowerCase();
      const price = Number(p?.priceUsd);
      if (addr && Number.isFinite(price) && price > 0 && !map.has(addr)) map.set(addr, price);
    }
  }
  return map;
}

function priceAll(positions: ProtocolPosition[], prices: Map<string, number>) {
  for (const pos of positions) {
    let total = 0;
    let known = false;
    for (const u of pos.underlying) {
      const px = prices.get(u.address.toLowerCase());
      if (px != null) {
        u.valueUsd = u.amount * px;
        total += u.valueUsd;
        known = true;
      }
    }
    // Debt (borrowed) reduces net worth.
    if (known) pos.valueUsd = pos.note === 'Borrowed' ? -total : total;
  }
}

export async function POST(req: NextRequest) {
  let body: { address?: string; chain?: ChainId };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const address = String(body?.address ?? '').toLowerCase();
  if (!ADDRESS_RX.test(address)) return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  const chain: ChainId = body?.chain === 'ethereum' ? 'ethereum' : 'pulsechain';

  try {
    // Held tokens from Blockscout (same source as the balances route).
    const balances = await fetchJson(`${BLOCKSCOUT[chain]}/addresses/${address}/token-balances`);
    const items: any[] = Array.isArray(balances) ? balances : balances?.items ?? [];
    const held = items
      .filter((it) => it?.token?.type?.includes('ERC-20') || it?.token?.address)
      .map((it) => ({
        address: String(it?.token?.address ?? it?.token?.address_hash ?? '').toLowerCase(),
        symbol: String(it?.token?.symbol ?? '???'),
        decimals: Number(it?.token?.decimals ?? 18) || 18,
        raw: BigInt(String(it?.value ?? '0')),
      }))
      .filter((t) => t.address && t.raw > 0n)
      .slice(0, MAX_TOKENS);

    // Detect held-token positions + scan custodial farms in parallel.
    const CONC = 6;
    const heldPositions: ProtocolPosition[] = [];
    let idx = 0;
    const detectWorker = async () => {
      while (idx < held.length) {
        const t = held[idx++];
        try {
          const pos = await detectHeldPosition(chain, t.address, t.raw, t.decimals, t.symbol);
          if (pos) heldPositions.push(pos);
        } catch {
          /* skip token */
        }
      }
    };
    const [, farmPositions] = await Promise.all([
      Promise.all(Array.from({ length: CONC }, detectWorker)),
      scanFarms(chain, address).catch(() => [] as ProtocolPosition[]),
    ]);

    const positions = [...heldPositions, ...farmPositions];

    // Price the underlying assets, then sum per position.
    const prices = await priceMap(positions.flatMap((p) => p.underlying.map((u) => u.address)));
    priceAll(positions, prices);

    // Group by category, sorted by USD desc within each.
    const order: ProtocolPosition['kind'][] = ['lending', 'farm', 'lp', 'vault', 'staking'];
    const groups = order
      .map((kind) => ({
        kind,
        positions: positions.filter((p) => p.kind === kind).sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0)),
      }))
      .filter((g) => g.positions.length > 0);

    const totalUsd = positions.reduce((s, p) => s + (p.valueUsd ?? 0), 0);

    return NextResponse.json(
      { address, chain, totalUsd, groups },
      { headers: { 'Cache-Control': 'private, max-age=120' } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load positions' },
      { status: 500 },
    );
  }
}
