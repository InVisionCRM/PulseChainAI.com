import { NextRequest, NextResponse } from 'next/server';
import { getChain, isChainKey } from '@/lib/chains/registry';
import { cached } from '@/lib/geicko/serverCache';

// "How many holders of token A also hold token B?" — a cross-token overlap a
// single token page can't show. We take token A's largest holders (real wallets,
// not LP pools / contracts) and check each one's on-chain balance of token B, so
// we catch any B holding, not just wallets that are ALSO in B's top list.
//
// Works on any EVM chain we know (balance reads go through that chain's RPC pool).
// Bounded to A's top holders — the underlying holder list is capped — so the
// result is "of A's top N holders, X also hold B", stated plainly.

export const revalidate = 0;
export const maxDuration = 60;

const ADDR_RX = /^0x[a-fA-F0-9]{40}$/;
const BALANCE_OF = '0x70a08231';
// The explorer returns up to 100 holders; check the full set of real wallets.
const MAX_HOLDERS = 100;
const RPC_TIMEOUT_MS = 6000;

async function ethCall(rpcUrls: string[], to: string, data: string): Promise<string | null> {
  const results = await Promise.allSettled(
    rpcUrls.map((url) =>
      (async () => {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to, data }, 'latest'], id: 1 }),
          signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
        });
        if (!res.ok) return null;
        const j = await res.json();
        if (j?.error || !j?.result || j.result === '0x') return null;
        return j.result as string;
      })().catch(() => null),
    ),
  );
  for (const r of results) if (r.status === 'fulfilled' && r.value) return r.value;
  return null;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
    }),
  );
  return out;
}

async function build(origin: string, tokenA: string, tokenB: string, network: string) {
  const chain = isChainKey(network) ? network : 'pulsechain';
  const rpcUrls = getChain(chain).rpcUrls;

  // Token A's holders + token B's symbol for a friendly label.
  const [ha, hb] = await Promise.all([
    fetch(`${origin}/api/geicko/holders?token=${tokenA}&network=${chain}&limit=100`, { headers: { accept: 'application/json' } }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(`${origin}/api/geicko/holders?token=${tokenB}&network=${chain}&limit=100`, { headers: { accept: 'application/json' } }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);

  const holdersA: any[] = ha?.holders ?? [];
  if (!holdersA.length) return { supported: true, hasData: false, reason: 'no-holders-for-token-a' };

  // Focus on real wallets — LP pools and contracts holding both tokens are noise.
  const totalHolders = holdersA.length;
  const contractCount = holdersA.filter((h) => h.isContract).length;
  const wallets = holdersA.filter((h) => !h.isContract).slice(0, MAX_HOLDERS);

  const bData = BALANCE_OF; // + padded holder below
  const checks = await mapLimit(wallets, 10, async (h) => {
    const data = bData + h.address.slice(2).toLowerCase().padStart(64, '0');
    const hex = await ethCall(rpcUrls, tokenB, data);
    let holds = false;
    try { holds = hex ? BigInt(hex) > 0n : false; } catch { holds = false; }
    return { address: h.address, holds };
  });

  const overlap = checks.filter((c) => c.holds);
  const checked = wallets.length;

  return {
    supported: true,
    hasData: true,
    tokenB_symbol: hb?.holders?.length ? (hb?.meta?.symbol ?? null) : null,
    holdersChecked: checked,
    overlapCount: overlap.length,
    overlapPercent: checked ? Number(((overlap.length / checked) * 100).toFixed(1)) : null,
    overlappingWallets: overlap.slice(0, 20).map((c) => c.address),
    holdersLookedAt: totalHolders,
    contractsExcluded: contractCount,
    note: `Checked ${checked} real wallets for any balance of token B. Source: the token's top ${totalHolders} holders from the explorer${contractCount ? `, of which ${contractCount} are LP pools/contracts (excluded)` : ''}.`,
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const network = (sp.get('network') || 'pulsechain').toLowerCase();
  const tokenA = (sp.get('tokenA') || '').toLowerCase();
  const tokenB = (sp.get('tokenB') || '').toLowerCase();
  if (!ADDR_RX.test(tokenA) || !ADDR_RX.test(tokenB)) {
    return NextResponse.json({ error: 'tokenA and tokenB are required' }, { status: 400 });
  }
  if (tokenA === tokenB) return NextResponse.json({ error: 'tokenA and tokenB must differ' }, { status: 400 });

  const origin = req.nextUrl.origin;
  try {
    const payload = await cached(
      `holder-overlap:${network}:${tokenA}:${tokenB}`,
      600_000,
      () => build(origin, tokenA, tokenB, network),
      (v) => v.supported === true,
    );
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=3600' },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to compute overlap' }, { status: 500 });
  }
}
