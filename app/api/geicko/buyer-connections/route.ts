import { NextRequest, NextResponse } from 'next/server';
import { firstFunder } from '@/lib/walletGraph/funding';
import { getKnownAddress } from '@/lib/gumshoe/address-labels';
import { cached } from '@/lib/geicko/serverCache';

// "Are a token's earliest buyers actually the same person?" A V2 launch can't
// tell you this from a holder list — but funding ancestry can. We take the first
// buyers (from /api/geicko/forensics), find who first funded each of their
// wallets, and cluster wallets that share a funder. Wallets funded by the SAME
// ordinary wallet (or by the token's own creator) are the classic "founder
// bought their own launch across many wallets" pattern. Shared exchange/router/
// bridge funders are noise, so those categories are excluded from clustering.
//
// PulseChain only — funding ancestry uses the PulseChain Otterscan RPC.

export const revalidate = 0;
export const maxDuration = 60;

const ADDR_RX = /^0x[a-fA-F0-9]{40}$/;
const MAX_BUYERS = 18; // funding lookups are RPC-heavy; cap the fan-out
// Funder categories that don't imply a shared operator.
const NOISE_CATEGORIES = new Set(['cex', 'router', 'bridge', 'locker', 'burn', 'factory', 'defi']);

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

async function build(origin: string, token: string) {
  // Reuse the forensics pass for the first-buyer list + creator identity.
  const r = await fetch(`${origin}/api/geicko/forensics?token=${token}&network=pulsechain`, {
    headers: { accept: 'application/json' },
  }).catch(() => null);
  const f = r && r.ok ? await r.json() : null;
  const buyers: any[] = (f?.firstBuyers?.buyers ?? []).slice(0, MAX_BUYERS);
  const creator: string | null = (f?.creator?.address ?? '').toLowerCase() || null;

  if (!buyers.length) return { supported: true, hasData: false, reason: 'no-first-buyers' };

  // Who first funded each buyer wallet? (cached, bounded concurrency)
  const funded = await mapLimit(buyers, 5, async (b) => ({ b, fund: await firstFunder(b.wallet) }));

  // Cluster by shared funder, dropping noise categories and unknown-origin wallets.
  const clusters = new Map<string, { funder: string; label: string | null; isCreator: boolean; buyers: any[] }>();
  let tracedCreator = 0;
  for (const { b, fund } of funded) {
    const funder = fund.funder?.toLowerCase();
    if (!funder) continue;
    if (fund.category && NOISE_CATEGORIES.has(fund.category)) continue;
    const isCreator = !!creator && funder === creator;
    if (isCreator) tracedCreator++;
    if (!clusters.has(funder)) {
      clusters.set(funder, {
        funder,
        label: fund.label ?? getKnownAddress(funder)?.label ?? null,
        isCreator,
        buyers: [],
      });
    }
    clusters.get(funder)!.buyers.push({
      wallet: b.wallet,
      sniper: !!b.sniper,
      stillHolds: b.stillHolds ?? null,
      usd: Math.round(Number(b.usd) || 0),
    });
  }

  // A "cluster" needs ≥2 buyers sharing one funder to be meaningful.
  const groups = [...clusters.values()]
    .filter((c) => c.buyers.length >= 2)
    .sort((a, b) => b.buyers.length - a.buyers.length);

  const linkedBuyers = groups.reduce((s, g) => s + g.buyers.length, 0);
  const largest = groups[0]?.buyers.length ?? 0;

  return {
    supported: true,
    hasData: true,
    buyersAnalyzed: buyers.length,
    linkedBuyers,
    largestClusterSize: largest,
    creatorFundedBuyers: tracedCreator,
    clusterCount: groups.length,
    clusters: groups.map((g) => ({
      funder: g.funder,
      label: g.label,
      isCreator: g.isCreator,
      count: g.buyers.length,
      buyers: g.buyers,
    })),
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const network = (sp.get('network') || 'pulsechain').toLowerCase();
  const token = (sp.get('token') || '').toLowerCase();
  if (network !== 'pulsechain') return NextResponse.json({ supported: false, chain: network });
  if (!ADDR_RX.test(token)) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const origin = req.nextUrl.origin;
  try {
    const payload = await cached(
      `buyer-connections:${token}`,
      600_000, // 10 min
      () => build(origin, token),
      (v) => v.supported === true,
    );
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=3600' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to analyze buyer connections' },
      { status: 500 },
    );
  }
}
