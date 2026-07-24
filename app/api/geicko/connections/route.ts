import { NextRequest, NextResponse } from 'next/server';
import { firstFunder } from '@/lib/walletGraph/funding';
import { getKnownAddress } from '@/lib/gumshoe/address-labels';
import { cached } from '@/lib/geicko/serverCache';

// General wallet-connection engine. Answers "are these wallets connected — to
// each other, or to a target wallet?" for a chosen population:
//   scope=first_buyers  → the token's earliest buyers
//   scope=holders       → the token's largest (non-contract) holders
// and an optional target:
//   target=creator      → the token's creator/launcher wallet
//   target=0x…          → any specific wallet
//
// Connection = native-coin funding linkage: two wallets are linked if one funded
// the other or they share an ordinary (non-exchange) funder. This one endpoint
// replaces the old first-buyers-only analysis, so questions like "how many
// HOLDERS are connected to the CREATOR" are answered against the right set.
// PulseChain only (Otterscan funding graph).

export const revalidate = 0;
export const maxDuration = 90;

const ADDR_RX = /^0x[a-fA-F0-9]{40}$/;
const NOISE = new Set(['cex', 'router', 'bridge', 'locker', 'burn', 'factory', 'defi']);
// The block explorer returns up to 100 holders; we analyze the full set (minus
// LP pools / contracts). Round caps so results read as "the top 100 holders".
const MAX_HOLDERS = 100;
const MAX_BUYERS = 30;

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

const short = (a?: string | null) => (a && a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || null);

async function build(origin: string, token: string, scope: string, targetArg: string) {
  // Forensics gives us both the first-buyer list and the creator identity.
  const f = await fetch(`${origin}/api/geicko/forensics?token=${token}&network=pulsechain`, { headers: { accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const creator: string | null = (f?.creator?.address ?? '').toLowerCase() || null;

  // Resolve the wallet set.
  let wallets: string[] = [];
  if (scope === 'holders') {
    const h = await fetch(`${origin}/api/geicko/holders?token=${token}&network=pulsechain`, { headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    wallets = (h?.holders ?? [])
      .filter((x: any) => !x.isContract)
      .map((x: any) => (x.address ?? '').toLowerCase())
      .filter((a: string) => ADDR_RX.test(a))
      .slice(0, MAX_HOLDERS);
  } else {
    wallets = (f?.firstBuyers?.buyers ?? [])
      .map((b: any) => (b.wallet ?? '').toLowerCase())
      .filter((a: string) => ADDR_RX.test(a))
      .slice(0, MAX_BUYERS);
  }
  if (!wallets.length) return { supported: true, hasData: false, reason: `no-${scope}` };

  // Resolve the target (if any).
  let target: string | null = null;
  if (targetArg === 'creator') target = creator;
  else if (ADDR_RX.test(targetArg)) target = targetArg.toLowerCase();

  // Funding source for every wallet in the set (+ the target).
  const funders = await mapLimit(wallets, 8, async (w) => ({ w, fund: await firstFunder(w) }));
  const targetFund = target ? await firstFunder(target) : null;

  // Cluster the set by shared ordinary funder.
  const clusters = new Map<string, { funder: string; label: string | null; wallets: string[] }>();
  for (const { w, fund } of funders) {
    const funder = fund.funder?.toLowerCase();
    if (!funder) continue;
    if (fund.category && NOISE.has(fund.category)) continue;
    if (!clusters.has(funder)) clusters.set(funder, { funder, label: fund.label ?? getKnownAddress(funder)?.label ?? null, wallets: [] });
    clusters.get(funder)!.wallets.push(w);
  }
  const groups = [...clusters.values()].filter((c) => c.wallets.length >= 2).sort((a, b) => b.wallets.length - a.wallets.length);

  // Connection to the target: funded BY the target, or sharing the target's funder.
  let connectedToTarget: { count: number; wallets: { address: string; via: string }[] } | null = null;
  if (target) {
    const tFunder = targetFund?.funder?.toLowerCase() || null;
    const tFunderNoise = targetFund?.category ? NOISE.has(targetFund.category) : false;
    const hits: { address: string; via: string }[] = [];
    for (const { w, fund } of funders) {
      if (w === target) continue;
      const funder = fund.funder?.toLowerCase();
      if (funder && funder === target) hits.push({ address: w, via: 'funded-by-target' });
      else if (funder && tFunder && !tFunderNoise && funder === tFunder && !(fund.category && NOISE.has(fund.category))) hits.push({ address: w, via: 'shares-target-funder' });
    }
    connectedToTarget = { count: hits.length, wallets: hits.slice(0, 25).map((h) => ({ address: short(h.address)!, via: h.via })) };
  }

  return {
    supported: true,
    hasData: true,
    scope,
    walletsAnalyzed: wallets.length,
    target: target ? short(target) : null,
    targetKind: targetArg === 'creator' ? 'creator' : (target ? 'wallet' : null),
    connectedToTarget,
    clusterCount: groups.length,
    walletsInClusters: groups.reduce((s, g) => s + g.wallets.length, 0),
    clusters: groups.slice(0, 10).map((g) => ({
      sharedFunder: short(g.funder),
      funderLabel: g.label,
      isTokenCreator: !!creator && g.funder === creator,
      count: g.wallets.length,
      wallets: g.wallets.map(short),
    })),
    note: scope === 'holders'
      ? `Analyzed the ${wallets.length} real wallets among the token's top 100 holders (the block explorer returns at most 100; LP pools and contracts are excluded). "Connected" means a native-coin funding link.`
      : `Analyzed the token's ${wallets.length} earliest buyers. "Connected" means a native-coin funding link.`,
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const network = (sp.get('network') || 'pulsechain').toLowerCase();
  const token = (sp.get('token') || '').toLowerCase();
  const scope = (sp.get('scope') || 'first_buyers').toLowerCase() === 'holders' ? 'holders' : 'first_buyers';
  const target = (sp.get('target') || '').toLowerCase();
  if (network !== 'pulsechain') return NextResponse.json({ supported: false, chain: network });
  if (!ADDR_RX.test(token)) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const origin = req.nextUrl.origin;
  try {
    const payload = await cached(
      `connections:${token}:${scope}:${target}`,
      600_000,
      () => build(origin, token, scope, target),
      // Don't cache a run where the creator target failed to resolve (transient
      // forensics/Blockscout hiccup) — otherwise a null result sticks for 10 min.
      (v) => v.supported === true && v.hasData !== false && !(target === 'creator' && !v.target),
    );
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=3600' },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to analyze connections' }, { status: 500 });
  }
}
