// POST /api/portfolio/first-funder  { address, chain }
// Returns: { funder: FirstFunder }
//
// The "original funder" — the first address that sent this wallet native coin
// (the gas that bootstrapped it). It lives at the *start* of history, which the
// recent-first history route never reaches; PulseChain's g4mm4 Otterscan node
// exposes ots_searchTransactionsAfter(addr, 0, n), returning the EARLIEST txs in
// one call (the ascending variant is reliable for the first page on this RPC).
// Original funding never changes, so results are cached for a week.

import { NextResponse } from 'next/server';
import type { ChainId } from '@/services';
import { getKnownAddress, type AddressCategory } from '@/lib/gumshoe/address-labels';

const OTTERSCAN_RPC = 'https://rpc-pulsechain.g4mm4.io';
const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;
const RPC_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface FirstFunder {
  /** false when the chain has no Otterscan source (e.g. Ethereum). */
  supported: boolean;
  funder: string | null;
  label: string | null;
  category: AddressCategory | null;
  txHash: string | null;
  block: number | null;
  timestamp: number | null; // ms epoch
  amount: number | null; // native coin amount
}

const cache = new Map<string, { value: FirstFunder; at: number }>();

async function ots(method: string, params: unknown[]): Promise<any | null> {
  try {
    const r = await fetch(OTTERSCAN_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { result?: any; error?: unknown };
    if (j.error) return null;
    return j.result ?? null;
  } catch {
    return null;
  }
}

async function firstFunder(address: string): Promise<FirstFunder> {
  const self = address.toLowerCase();
  const empty: FirstFunder = {
    supported: true,
    funder: null,
    label: null,
    category: null,
    txHash: null,
    block: null,
    timestamp: null,
    amount: null,
  };

  const res = await ots('ots_searchTransactionsAfter', [address, 0, 25]);
  if (!res || !Array.isArray(res.txs)) return empty;

  const rcByHash = new Map<string, any>();
  for (const rc of Array.isArray(res.receipts) ? res.receipts : []) {
    const h = String(rc?.transactionHash || '').toLowerCase();
    if (h) rcByHash.set(h, rc);
  }

  const txs: any[] = res.txs
    .slice()
    .sort(
      (a, b) =>
        parseInt(a?.blockNumber || '0x0', 16) - parseInt(b?.blockNumber || '0x0', 16),
    );

  // First inbound native-value transfer = the wallet's original funding event.
  for (const tx of txs) {
    const to = String(tx?.to || '').toLowerCase();
    const from = String(tx?.from || '').toLowerCase();
    if (to !== self || !from || from === self) continue;
    let value = 0n;
    try {
      value = BigInt(tx.value ?? '0x0');
    } catch {
      /* ignore */
    }
    if (value <= 0n) continue;

    const rc = rcByHash.get(String(tx?.hash || '').toLowerCase());
    const tsSec = rc?.timestamp ?? rc?.timeStamp;
    const known = getKnownAddress(from);
    return {
      supported: true,
      funder: from,
      label: known?.label ?? null,
      category: known?.category ?? null,
      txHash: String(tx.hash),
      block: parseInt(tx?.blockNumber || '0x0', 16),
      timestamp: tsSec ? Number(tsSec) * 1000 : null,
      amount: Number(value) / 1e18,
    };
  }
  return empty;
}

export async function POST(req: Request) {
  let body: { address?: string; chain?: ChainId };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const address = (body.address || '').toLowerCase();
  if (!ADDRESS_RX.test(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
  }

  // Original-funder lookup relies on the Otterscan ots_* namespace, which we
  // only have for PulseChain (g4mm4). Ethereum degrades to "unsupported".
  if (body.chain !== 'pulsechain') {
    const unsupported: FirstFunder = {
      supported: false,
      funder: null,
      label: null,
      category: null,
      txHash: null,
      block: null,
      timestamp: null,
      amount: null,
    };
    return NextResponse.json({ funder: unsupported });
  }

  const key = `pulsechain:${address}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json({ funder: hit.value });
  }
  const value = await firstFunder(address);
  cache.set(key, { value, at: Date.now() });
  return NextResponse.json({ funder: value });
}
