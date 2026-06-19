// POST /api/portfolio/first-funder  { address, chain }
// Returns: { funder: { supported, ...FundingInfo } }
//
// The "original funder" — the first address that sent this wallet native coin
// (the gas that bootstrapped it). The lookup lives in lib/walletGraph/funding.ts
// (g4mm4 Otterscan, earliest-tx scan, cached). PulseChain only; Ethereum
// degrades to "unsupported".

import { NextResponse } from 'next/server';
import type { ChainId } from '@/services';
import { firstFunder, type FundingInfo } from '@/lib/walletGraph/funding';

const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;

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

  if (body.chain !== 'pulsechain') {
    return NextResponse.json({ funder: { supported: false } });
  }

  const info: FundingInfo = await firstFunder(address);
  return NextResponse.json({ funder: { supported: true, ...info } });
}
