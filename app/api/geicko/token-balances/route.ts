// POST /api/geicko/token-balances  { token, addresses: string[], network? }
//
// "How much of THIS token do these specific wallets hold?" — the join the
// geicko portfolio drawer needs: the user's own (or pinned) wallets against the
// token page they're on.
//
// This is per-REQUESTED-wallet balanceOf, not the holder list: the wallets in
// question usually aren't in the top holders at all, so the holders endpoint
// can't answer it. Callers send a handful of addresses (portfolio wallets are
// capped well below the request cap), so this is N cheap eth_calls through the
// existing PulseChain RPC pool — no explorer dependency.
//
// PulseChain only, by product decision: the portfolio drawer is a PulseChain
// feature, and answering for other chains would need their RPC pools wired in
// here for no caller that exists.

import { NextRequest, NextResponse } from 'next/server';
import { rpcTokenBalance, rpcTokenMeta } from '@/lib/pulsechainRpcFallback';
import { cached } from '@/lib/geicko/serverCache';

export const revalidate = 0;
export const maxDuration = 30;

const ADDR_RX = /^0x[a-fA-F0-9]{40}$/;
/** Portfolio wallets + pins is a short list; anything bigger is misuse. */
const MAX_ADDRESSES = 20;
/** Balances move with every block, but the drawer is a glance, not a trade
 *  ticket — 30s keeps repeat opens free. */
const CACHE_MS = 30_000;
/** Token decimals are immutable; cache hard. */
const META_CACHE_MS = 60 * 60_000;

export async function POST(req: NextRequest) {
  let body: { token?: string; addresses?: string[]; network?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const network = (body.network || 'pulsechain').toLowerCase();
  if (network !== 'pulsechain') {
    return NextResponse.json({ supported: false, chain: network, balances: {} });
  }

  const token = (body.token || '').toLowerCase();
  if (!ADDR_RX.test(token)) {
    return NextResponse.json({ error: 'token required' }, { status: 400 });
  }

  const addresses = [...new Set(
    (body.addresses ?? [])
      .filter((a): a is string => typeof a === 'string' && ADDR_RX.test(a))
      .map((a) => a.toLowerCase()),
  )];
  if (addresses.length === 0) {
    return NextResponse.json({ error: 'addresses required' }, { status: 400 });
  }
  if (addresses.length > MAX_ADDRESSES) {
    return NextResponse.json({ error: `too many addresses (max ${MAX_ADDRESSES})` }, { status: 400 });
  }

  try {
    const meta = await cached(
      `token-balances:meta:${token}`,
      META_CACHE_MS,
      () => rpcTokenMeta(token),
      (m) => m != null,
    );

    const key = `token-balances:${token}:${addresses.slice().sort().join(',')}`;
    const balances = await cached(key, CACHE_MS, async () => {
      const out: Record<string, string | null> = {};
      const results = await Promise.all(addresses.map((a) => rpcTokenBalance(token, a)));
      addresses.forEach((a, i) => { out[a] = results[i]; });
      return out;
    });

    return NextResponse.json({
      supported: true,
      token,
      decimals: meta?.decimals != null ? Number(meta.decimals) : null,
      symbol: meta?.symbol ?? null,
      /** Raw units — lets callers turn a balance into a share of supply
       *  (league tiers) without another request. */
      totalSupply: meta?.total_supply ?? null,
      /** Raw on-chain units as decimal strings; null = the call failed. */
      balances,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'balance lookup failed' },
      { status: 500 },
    );
  }
}
