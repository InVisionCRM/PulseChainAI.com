// POST /api/portfolio/classify
// Body: { addresses: { address: string; chain: ChainId }[] }
// Returns: { classifications: Record<"chain:address", Classification> }
//
// For each address: known-directory lookup first; otherwise eth_getCode (EOA vs
// contract) plus a couple of eth_calls to tell a DEX pool from a token from a
// generic contract. Results are stable, so they're cached for a day.

import { NextResponse } from 'next/server';
import type { ChainId } from '@/services';
import { getKnownAddress } from '@/lib/gumshoe/address-labels';
import { ethCall, getCode } from '@/lib/portfolio/evmRpc';
import {
  resolveType,
  SELECTORS,
  type Classification,
} from '@/lib/walletGraph/classify';

const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;
const MAX_ADDRESSES = 30;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const cache = new Map<string, { value: Classification; at: number }>();

async function classifyOne(
  chain: ChainId,
  address: string,
): Promise<Classification> {
  const known = getKnownAddress(address);
  if (known) {
    return {
      type: resolveType({
        knownCategory: known.category,
        hasCode: true,
        isPair: false,
        isToken: false,
      }),
      label: known.label,
    };
  }

  const code = await getCode(chain, address);
  // null = every RPC failed; treat as an unknown contract rather than guessing EOA.
  const hasCode = code == null ? true : code !== '0x';

  let isPair = false;
  let isToken = false;
  if (hasCode) {
    const [t0, t1] = await Promise.all([
      ethCall(chain, address, SELECTORS.token0),
      ethCall(chain, address, SELECTORS.token1),
    ]);
    isPair = !!t0 && !!t1;
    if (!isPair) {
      const [sym, dec] = await Promise.all([
        ethCall(chain, address, SELECTORS.symbol),
        ethCall(chain, address, SELECTORS.decimals),
      ]);
      isToken = !!sym && !!dec;
    }
  }

  return {
    type: resolveType({ knownCategory: null, hasCode, isPair, isToken }),
    label: null,
  };
}

export async function POST(req: Request) {
  let body: { addresses?: { address: string; chain: ChainId }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const input = (body.addresses ?? [])
    .filter((a) => a && ADDRESS_RX.test(a.address ?? ''))
    .slice(0, MAX_ADDRESSES);

  const now = Date.now();
  const out: Record<string, Classification> = {};

  await Promise.all(
    input.map(async ({ address, chain }) => {
      const key = `${chain}:${address.toLowerCase()}`;
      const hit = cache.get(key);
      if (hit && now - hit.at < CACHE_TTL_MS) {
        out[key] = hit.value;
        return;
      }
      const value = await classifyOne(chain, address.toLowerCase());
      cache.set(key, { value, at: now });
      out[key] = value;
    }),
  );

  return NextResponse.json({ classifications: out });
}
