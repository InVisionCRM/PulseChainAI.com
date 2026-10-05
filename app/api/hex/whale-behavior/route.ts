import { NextRequest, NextResponse } from 'next/server';
import { type HexNet as Net } from '@/lib/hex/subgraph';
import { behaviorSummary } from '@/lib/hex/whaleBehavior';
import { walletEndBehavior } from '@/lib/hex/hexWalletBehavior';

export const revalidate = 0;
// Pages the wallet's HEX transfer history + reads the receipt of each transfer
// that falls inside an end's window.
export const maxDuration = 60;

// Cap the ends we return so a wallet with a huge history stays responsive.
const MAX_ENDS = 40;

export async function GET(req: NextRequest) {
  const net = (req.nextUrl.searchParams.get('network') === 'ethereum' ? 'ethereum' : 'pulsechain') as Net;
  const address = (req.nextUrl.searchParams.get('address') || '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  try {
    const { behavior: all, oldestActivityTs } = await walletEndBehavior(net, address);
    const behavior = all.slice(0, MAX_ENDS);
    const summary = behaviorSummary(behavior);

    return NextResponse.json(
      { address, network: net, oldestActivityTs, behavior, summary },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800' } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load whale behavior' },
      { status: 500 },
    );
  }
}
