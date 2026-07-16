import { NextRequest, NextResponse } from 'next/server';
import { ethCall } from '@/lib/portfolio/evmRpc';
import { getChain, isChainKey } from '@/lib/chains/registry';
import type { ChainKey } from '@/lib/chains/types';

// Per-LP enrichment for the geicko pair picker: what % of each LP token's
// supply is burned (locked forever) and how many holders it has.
//
// Free sources only:
//  - burned %  → RPC (totalSupply + balanceOf of the burn addresses). RPCs stay
//                up even when the explorer is flaky; this is the reliable path.
//  - holders   → PulseChain Blockscout /tokens/{lp} (best-effort; null on miss).

const DEAD = '0x000000000000000000000000000000000000dead';
const ZERO = '0x0000000000000000000000000000000000000000';
const TOTAL_SUPPLY = '0x18160ddd';
const BALANCE_OF = '0x70a08231';
const BLOCKSCOUT = 'https://api.scan.pulsechain.com/api/v2';
const ADDRESS_RX = /^0x[a-f0-9]{40}$/;

const balanceOfData = (addr: string) =>
  BALANCE_OF + addr.toLowerCase().replace(/^0x/, '').padStart(64, '0');

const toBigInt = (hex: string | null): bigint | null => {
  if (!hex || hex === '0x') return null;
  try {
    return BigInt(hex);
  } catch {
    return null;
  }
};

interface LpInfo {
  burnedPct: number | null;
  holders: number | null;
}

async function fetchHolders(base: string, lp: string): Promise<number | null> {
  try {
    const r = await fetch(`${base}/tokens/${lp}`, {
      signal: AbortSignal.timeout(6_000),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as { holders?: string | number; holders_count?: string | number };
    const raw = d.holders ?? d.holders_count;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function lpInfo(chain: ChainKey, base: string, lp: string): Promise<LpInfo> {
  const [totalHex, deadHex, zeroHex, holders] = await Promise.all([
    ethCall(chain, lp, TOTAL_SUPPLY),
    ethCall(chain, lp, balanceOfData(DEAD)),
    ethCall(chain, lp, balanceOfData(ZERO)),
    fetchHolders(base, lp),
  ]);

  const total = toBigInt(totalHex);
  const dead = toBigInt(deadHex) ?? 0n;
  const zero = toBigInt(zeroHex) ?? 0n;

  let burnedPct: number | null = null;
  if (total && total > 0n) {
    const burned = dead + zero;
    // basis points → percent, keeps precision without floats on huge supplies.
    burnedPct = Number((burned * 10_000n) / total) / 100;
    if (burnedPct > 100) burnedPct = 100;
  }

  return { burnedPct, holders };
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const raw = (body as { addresses?: unknown })?.addresses;
  const addresses = Array.isArray(raw)
    ? Array.from(
        new Set(
          raw
            .filter((a): a is string => typeof a === 'string')
            .map((a) => a.trim().toLowerCase())
            .filter((a) => ADDRESS_RX.test(a)),
        ),
      ).slice(0, 12)
    : [];

  if (addresses.length === 0) return NextResponse.json({ info: {} });

  const netRaw = String((body as { network?: unknown })?.network ?? 'pulsechain').toLowerCase();
  const chain = isChainKey(netRaw) ? netRaw : 'pulsechain';
  const base = getChain(chain).blockscoutApiBase ?? BLOCKSCOUT;

  const results = await Promise.all(
    addresses.map(async (lp) => [lp, await lpInfo(chain, base, lp)] as const),
  );

  return NextResponse.json({ info: Object.fromEntries(results) });
}
