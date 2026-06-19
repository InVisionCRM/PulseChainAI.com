// POST /api/portfolio/funding-trace  { address, chain, maxHops? }
// Returns: { trace: { supported, reachedOrigin, steps: Step[] } }
//
// Walks the funding ancestry: who funded the wallet, who funded THEM, and so on
// — until it reaches a known origin (exchange / LP locker / OFAC), runs into a
// dead end (genesis / a contract with no native funder), hits a cycle, or
// exhausts the hop budget. Each hop is a cached firstFunder() lookup, so a trace
// is cheap and reuses funders already resolved by the "Funded by" strip.
//
// `steps[0]` is the wallet itself; `steps[i].fundedBy` describes how step[i] was
// funded by step[i+1]; the last step's `fundedBy` is null.

import { NextResponse } from 'next/server';
import type { ChainId } from '@/services';
import { firstFunder } from '@/lib/walletGraph/funding';
import { getKnownAddress, type AddressCategory } from '@/lib/gumshoe/address-labels';

const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;
const MAX_HOPS = 5;
const ORIGIN_CATEGORIES: AddressCategory[] = ['exchange', 'locker', 'ofac'];

interface Step {
  address: string;
  label: string | null;
  category: AddressCategory | null;
  fundedBy: { amount: number | null; timestamp: number | null; txHash: string | null } | null;
}

export async function POST(req: Request) {
  let body: { address?: string; chain?: ChainId; maxHops?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const address = (body.address || '').toLowerCase();
  if (!ADDRESS_RX.test(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
  }
  if (body.chain !== 'pulsechain') {
    return NextResponse.json({ trace: { supported: false, reachedOrigin: false, steps: [] } });
  }

  const maxHops = Math.max(1, Math.min(MAX_HOPS, body.maxHops ?? 4));
  const known0 = getKnownAddress(address);
  const steps: Step[] = [
    { address, label: known0?.label ?? null, category: known0?.category ?? null, fundedBy: null },
  ];
  const seen = new Set<string>([address]);
  let reachedOrigin = false;
  let current = address;

  for (let i = 0; i < maxHops; i++) {
    const info = await firstFunder(current);
    if (!info.funder) break;

    steps[steps.length - 1].fundedBy = {
      amount: info.amount,
      timestamp: info.timestamp,
      txHash: info.txHash,
    };
    steps.push({ address: info.funder, label: info.label, category: info.category, fundedBy: null });

    if (seen.has(info.funder)) break; // cycle
    seen.add(info.funder);
    if (info.category && ORIGIN_CATEGORIES.includes(info.category)) {
      reachedOrigin = true;
      break;
    }
    current = info.funder;
  }

  return NextResponse.json({ trace: { supported: true, reachedOrigin, steps } });
}
