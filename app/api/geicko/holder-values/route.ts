import { NextRequest, NextResponse } from 'next/server';
import { getChain, isChainKey } from '@/lib/chains/registry';
import { basketForChain } from '@/lib/geicko/valueBasket';
import { fetchUsdPrices } from '@/lib/portfolio/dexPrices';

// POST /api/geicko/holder-values  { addresses: string[], network }
//
// Estimates each holder's wallet value from a fixed "core + stablecoins" basket
// (native coin, wrapped native, the chain's majors, and the PEGGED stables —
// see lib/geicko/valueBasket.ts). Everything is priced BY ADDRESS, chain-scoped,
// so the forked pDAI on PulseChain is valued at its real ~$0.002 and can never
// masquerade as $1 (it isn't in the basket at all).
//
// The holders tab calls this lazily for the page of holders on screen, so we
// only ever read ~100 wallets × a handful of tokens.

export const revalidate = 0;
export const maxDuration = 60;

const ADDR_RX = /^0x[a-fA-F0-9]{40}$/;
const MAX_ADDRESSES = 100;
const BALANCE_OF = '0x70a08231';
const RPC_TIMEOUT_MS = 9000;
const BATCH_CHUNK = 90;
// Per-address value cache — holders repeat across pages/tokens, and this makes
// re-opening a token or paging back instant.
const CACHE_TTL_MS = 60_000;
const valueCache = new Map<string, { usd: number; native: number; core: number; stable: number; at: number }>();

function pad(addr: string): string {
  return addr.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}
function hexToBigInt(hex: string | null | undefined): bigint | null {
  if (!hex || hex === '0x') return null;
  try { return BigInt(hex.startsWith('0x') ? hex : '0x' + hex); } catch { return null; }
}
function toUnits(raw: bigint, decimals: number): number {
  // Scale down with a bit of fractional precision without overflowing Number.
  const neg = raw < 0n;
  let v = neg ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = v % base;
  const num = Number(whole) + Number(frac) / Number(base);
  return neg ? -num : num;
}

async function rpcBatch(url: string, reqs: Array<{ method: string; params: unknown[] }>): Promise<(string | null)[] | null> {
  if (reqs.length === 0) return [];
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqs.map((r, i) => ({ jsonrpc: '2.0', method: r.method, params: r.params, id: i }))),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const arr: any = await res.json();
    if (!Array.isArray(arr)) return null;
    const out: (string | null)[] = new Array(reqs.length).fill(null);
    for (const x of arr) {
      if (typeof x?.id === 'number' && x.id < out.length) {
        out[x.id] = x?.error || x?.result === undefined ? null : x.result;
      }
    }
    return out;
  } catch {
    return null;
  }
}

// Run a batch against the RPC pool, first node that answers wins. Returns null
// when EVERY node refused — which is not the same thing as a call returning
// empty. Robinhood has a single public sequencer RPC that 429s heavy eth_call
// batches (verified by request), and before this distinction existed those
// refusals were coerced to $0 balances and then cached, so the holders tab
// showed "Wallet $0" for every whale on the page.
async function batchWithPool(urls: string[], reqs: Array<{ method: string; params: unknown[] }>): Promise<(string | null)[] | null> {
  for (const url of urls) {
    const r = await rpcBatch(url, reqs);
    if (r) return r;
  }
  return null;
}

/**
 * Run all request slices, retrying refused slices once in smaller pieces after
 * a short backoff (rate limiters usually want less per request, not more
 * retries). Requests whose every attempt was refused end up as FAILED — the
 * caller must leave those holders out of the response entirely rather than
 * report a fabricated zero.
 */
const FAILED = Symbol('rpc-failed');
async function runBatches(
  urls: string[],
  reqs: Array<{ method: string; params: unknown[] }>,
): Promise<(string | null | typeof FAILED)[]> {
  const out: (string | null | typeof FAILED)[] = new Array(reqs.length).fill(FAILED);
  const RETRY_CHUNK = 30;
  for (let i = 0; i < reqs.length; i += BATCH_CHUNK) {
    const slice = reqs.slice(i, i + BATCH_CHUNK);
    let r = await batchWithPool(urls, slice);
    if (r) {
      r.forEach((v, j) => { out[i + j] = v; });
      continue;
    }
    // Refused. Back off, then retry this slice in smaller chunks.
    await new Promise((res) => setTimeout(res, 700));
    for (let k = 0; k < slice.length; k += RETRY_CHUNK) {
      const sub = slice.slice(k, k + RETRY_CHUNK);
      r = await batchWithPool(urls, sub);
      if (r) r.forEach((v, j) => { out[i + k + j] = v; });
      // Still refused → stays FAILED for these indexes.
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const network = typeof body?.network === 'string' ? body.network.toLowerCase() : 'pulsechain';
  const chain = isChainKey(network) ? network : 'pulsechain';
  const addresses: string[] = Array.isArray(body?.addresses)
    ? body.addresses.map((a: any) => String(a || '').toLowerCase()).filter((a: string) => ADDR_RX.test(a))
    : [];
  const uniq = [...new Set(addresses)].slice(0, MAX_ADDRESSES);
  if (uniq.length === 0) return NextResponse.json({ values: {}, pricedAt: null });

  const basket = basketForChain(chain);
  const rpcUrls = getChain(chain).rpcUrls;
  const dexChain = getChain(chain).dexscreenerSlug;

  // Split into cached vs. to-fetch.
  const now = Date.now();
  const values: Record<string, { usd: number; native: number; core: number; stable: number }> = {};
  const toFetch: string[] = [];
  for (const a of uniq) {
    const c = valueCache.get(`${chain}:${a}`);
    if (c && now - c.at < CACHE_TTL_MS) values[a] = { usd: c.usd, native: c.native, core: c.core, stable: c.stable };
    else toFetch.push(a);
  }

  if (toFetch.length > 0) {
    // Price the basket once (by address, chain-scoped). Native uses the wrapped
    // price; stables fall back to their pegged value when no DEX pair exists.
    const prices = await fetchUsdPrices(basket.tokens.map((t) => t.address), dexChain);
    const priceOf = (addr: string, pegged?: number): number => {
      const p = prices.get(addr.toLowerCase());
      if (p != null && Number.isFinite(p) && p > 0) return p;
      return pegged ?? 0;
    };
    const nativePrice = priceOf(basket.wrappedNative);

    // Build one request list: per holder, eth_getBalance + a balanceOf per token.
    const perHolder = 1 + basket.tokens.length;
    const reqs: Array<{ method: string; params: unknown[] }> = [];
    for (const holder of toFetch) {
      reqs.push({ method: 'eth_getBalance', params: [holder, 'latest'] });
      for (const t of basket.tokens) {
        reqs.push({ method: 'eth_call', params: [{ to: t.address, data: BALANCE_OF + pad(holder) }, 'latest'] });
      }
    }
    const results = await runBatches(rpcUrls, reqs);

    toFetch.forEach((holder, hIdx) => {
      const off = hIdx * perHolder;
      // If any of this holder's reads were refused by every RPC, we don't know
      // the wallet's value — leave the holder out (the UI shows "—" and its
      // retry logic asks again) instead of caching a fake $0.
      for (let k = 0; k < perHolder; k++) {
        if (results[off + k] === FAILED) return;
      }
      // Native.
      const nativeRaw = hexToBigInt(results[off] as string | null);
      const nativeAmt = nativeRaw != null ? toUnits(nativeRaw, 18) : 0;
      const nativeUsd = nativeAmt * nativePrice;
      let coreUsd = 0;
      let stableUsd = 0;
      basket.tokens.forEach((t, tIdx) => {
        const raw = hexToBigInt(results[off + 1 + tIdx] as string | null);
        if (raw == null || raw === 0n) return;
        const amt = toUnits(raw, t.decimals);
        const usd = amt * priceOf(t.address, t.peggedUsd);
        if (t.kind === 'stable') stableUsd += usd;
        else coreUsd += usd; // wrapped-native + core majors
      });
      const totalCore = nativeUsd + coreUsd;
      const usd = totalCore + stableUsd;
      const entry = { usd, native: nativeUsd, core: coreUsd, stable: stableUsd, at: Date.now() };
      valueCache.set(`${chain}:${holder}`, entry);
      values[holder] = { usd, native: nativeUsd, core: coreUsd, stable: stableUsd };
    });
  }

  return NextResponse.json({
    values,
    chain,
    basket: basket.tokens.map((t) => t.symbol),
    pricedAt: Date.now(),
  });
}
