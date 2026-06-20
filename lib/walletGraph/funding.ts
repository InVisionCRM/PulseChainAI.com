// Original-funder lookup, shared by /api/portfolio/first-funder and the
// /api/portfolio/funding-trace recursive walk. Reads a wallet's EARLIEST
// transactions from g4mm4's Otterscan node (ots_searchTransactionsAfter — the
// ascending variant is reliable for the first page) and returns the first
// inbound native-coin transfer: the address that bootstrapped the wallet.
//
// PulseChain only — the ots_* namespace isn't in our Ethereum RPC pool.
// Per-address results are memoised (original funding never changes), so a
// multi-hop trace reuses already-resolved funders for free.

import { getKnownAddress, type AddressCategory } from '@/lib/gumshoe/address-labels';

const OTTERSCAN_RPC = 'https://rpc-pulsechain.g4mm4.io';
const RPC_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface FundingInfo {
  funder: string | null;
  label: string | null;
  category: AddressCategory | null;
  txHash: string | null;
  block: number | null;
  timestamp: number | null; // ms epoch
  amount: number | null; // native coin
}

const EMPTY: FundingInfo = {
  funder: null,
  label: null,
  category: null,
  txHash: null,
  block: null,
  timestamp: null,
  amount: null,
};

const cache = new Map<string, { value: FundingInfo; at: number }>();

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

/** The address that sent `address` its first native-coin transfer, or EMPTY. */
export async function firstFunder(address: string): Promise<FundingInfo> {
  const self = address.toLowerCase();
  const hit = cache.get(self);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const res = await ots('ots_searchTransactionsAfter', [self, 0, 25]);
  if (!res || !Array.isArray(res.txs)) return EMPTY;

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

  let result: FundingInfo = EMPTY;
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
    result = {
      funder: from,
      label: known?.label ?? null,
      category: known?.category ?? null,
      txHash: String(tx.hash),
      block: parseInt(tx?.blockNumber || '0x0', 16),
      timestamp: tsSec ? Number(tsSec) * 1000 : null,
      amount: Number(value) / 1e18,
    };
    break;
  }

  cache.set(self, { value: result, at: Date.now() });
  return result;
}
