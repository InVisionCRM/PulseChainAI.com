import { NextRequest, NextResponse } from 'next/server';
import { firstFunder } from '@/lib/walletGraph/funding';
import { getKnownAddress } from '@/lib/gumshoe/address-labels';
import { cached } from '@/lib/geicko/serverCache';

// "Are wallet A and wallet B connected in any way?" — answered via funding
// ancestry. We walk each wallet's chain of first-funders (who funded it, who
// funded them, …) and look for a real link:
//   • one wallet funded the other (directly or up the chain), or
//   • both trace back to the same ORDINARY wallet (a shared funder).
// A shared exchange/bridge/locker ancestor is NOT a connection — everyone
// off-ramps from the same CEXes — so those are excluded from the shared-funder
// match (but still shown in the chains). PulseChain (Otterscan funding graph).

export const revalidate = 0;
export const maxDuration = 60;

const ADDR_RX = /^0x[a-fA-F0-9]{40}$/;
const MAX_HOPS = 6;
// Categories that are shared "off-ramps", not evidence of one operator.
const TERMINAL = new Set(['cex', 'bridge', 'locker', 'burn', 'router', 'factory']);

interface Hop { address: string; label: string | null; category: string | null }

async function chainOf(wallet: string): Promise<Hop[]> {
  const chain: Hop[] = [];
  const seen = new Set<string>([wallet]);
  let current = wallet;
  for (let i = 0; i < MAX_HOPS; i++) {
    const f = await firstFunder(current);
    const funder = f.funder?.toLowerCase();
    if (!funder || seen.has(funder)) break;
    seen.add(funder);
    const cat = f.category ?? getKnownAddress(funder)?.category ?? null;
    chain.push({ address: funder, label: f.label ?? getKnownAddress(funder)?.label ?? null, category: cat });
    if (cat && TERMINAL.has(cat)) break; // can't trace meaningfully past an off-ramp
    current = funder;
  }
  return chain;
}

const short = (a?: string | null) => (a && a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || null);

async function build(a: string, b: string) {
  const [chainA, chainB] = await Promise.all([chainOf(a), chainOf(b)]);
  const setB = new Set(chainB.map((h) => h.address));

  // Did A fund B (A appears in B's funder chain), or vice versa?
  const directAtoB = chainB.some((h) => h.address === a);
  const directBtoA = chainA.some((h) => h.address === b);

  // Shared ordinary funder (exclude off-ramp categories).
  let sharedFunder: Hop | null = null;
  for (const h of chainA) {
    if (setB.has(h.address) && !(h.category && TERMINAL.has(h.category))) { sharedFunder = h; break; }
  }

  let relationship: string;
  let connected = true;
  if (directAtoB) relationship = 'wallet-a-funded-wallet-b';
  else if (directBtoA) relationship = 'wallet-b-funded-wallet-a';
  else if (sharedFunder) relationship = 'shared-funder';
  else { relationship = 'no-funding-link-found'; connected = false; }

  return {
    supported: true,
    walletA: short(a),
    walletB: short(b),
    connected,
    relationship,
    link: sharedFunder ? short(sharedFunder.address) : null,
    linkLabel: sharedFunder?.label ?? null,
    walletA_fundingChain: chainA.map((h) => ({ address: short(h.address), label: h.label, category: h.category })),
    walletB_fundingChain: chainB.map((h) => ({ address: short(h.address), label: h.label, category: h.category })),
    note:
      'Connection is inferred from native-coin funding ancestry only (who first funded whom). "Not connected" means no funding link within a few hops — it does not rule out other links (token transfers, contract interactions). A shared exchange/bridge is not treated as a connection.',
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const network = (sp.get('network') || 'pulsechain').toLowerCase();
  const a = (sp.get('a') || sp.get('walletA') || '').toLowerCase();
  const b = (sp.get('b') || sp.get('walletB') || '').toLowerCase();
  if (network !== 'pulsechain') return NextResponse.json({ supported: false, chain: network });
  if (!ADDR_RX.test(a) || !ADDR_RX.test(b)) return NextResponse.json({ error: 'a and b wallet addresses are required' }, { status: 400 });
  if (a === b) return NextResponse.json({ error: 'a and b must differ' }, { status: 400 });

  try {
    const payload = await cached(
      `wallet-link:${a}:${b}`,
      600_000,
      () => build(a, b),
      (v) => v.supported === true,
    );
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=3600' },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to check wallet link' }, { status: 500 });
  }
}
