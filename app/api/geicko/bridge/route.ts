// GET /api/geicko/bridge?token=0x..&price=0.0123
//
// Bridge inflows/outflows for a token: transfers between holders and the
// PulseChain omnibridge. A transfer *to* the bridge is an outflow (the token is
// leaving PulseChain for Ethereum); a transfer *from* the bridge is an inflow
// (arriving on PulseChain). USD is amount × the passed spot price.

import { NextRequest, NextResponse } from 'next/server';
import { blockscoutJson } from '@/lib/blockscout';

// PulseChain omnibridge (Omnibridge Proxy / PulseRamp). Same address the
// canonical bridge UI uses; extendable if more mediators need tracking.
const BRIDGES: Array<{ address: string; label: string }> = [
  { address: '0x1715a3e4a142d8b698131108995174f37aeba10d', label: 'PulseChain Bridge' },
];
const BRIDGE_SET = new Set(BRIDGES.map((b) => b.address.toLowerCase()));
const bridgeLabel = (addr: string) =>
  BRIDGES.find((b) => b.address.toLowerCase() === addr.toLowerCase())?.label ?? 'Bridge';

const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;
const MAX_PAGES = 10; // ~500 transfers scanned per bridge
// Bridge addresses attract dust/spam transfers; ignore anything below this USD
// value so the summary reflects real bridge movements, not spam. Only applied
// when we have a price to judge by.
const MIN_USD = 1;

interface Flow {
  bridge: string;
  token: string;
  amount: number;
  usd: number;
  date: string; // ISO
  direction: 'in' | 'out';
  txHash: string | null;
}

export async function GET(req: NextRequest) {
  const token = (req.nextUrl.searchParams.get('token') || '').toLowerCase();
  if (!ADDRESS_RX.test(token)) {
    return NextResponse.json({ error: 'token required' }, { status: 400 });
  }
  const price = Number(req.nextUrl.searchParams.get('price') || 0);

  const flows: Flow[] = [];

  for (const bridge of BRIDGES) {
    let path = `/addresses/${bridge.address}/token-transfers?token=${token}`;
    for (let page = 0; page < MAX_PAGES; page++) {
      const data = await blockscoutJson(path, { revalidateSeconds: 120 });
      const items: any[] = Array.isArray(data?.items) ? data.items : [];
      if (items.length === 0) break;

      for (const it of items) {
        const from = String(it?.from?.hash ?? '').toLowerCase();
        const to = String(it?.to?.hash ?? '').toLowerCase();
        const raw = it?.total?.value ?? it?.value ?? '0';
        const decimals = Number(it?.total?.decimals ?? 18) || 18;
        const amount = Number(raw) / Math.pow(10, decimals);
        // to == bridge → leaving PulseChain (outflow); from == bridge → inflow.
        const direction: 'in' | 'out' | null = BRIDGE_SET.has(to)
          ? 'out'
          : BRIDGE_SET.has(from)
            ? 'in'
            : null;
        if (!direction) continue;
        const usdValue = price > 0 ? amount * price : 0;
        // Drop dust/spam when we can price it.
        if (price > 0 && usdValue < MIN_USD) continue;
        flows.push({
          bridge: bridgeLabel(bridge.address),
          token: it?.token?.symbol ?? '',
          amount,
          usd: usdValue,
          date: it?.timestamp ?? '',
          direction,
          txHash: it?.transaction_hash ?? it?.tx_hash ?? null,
        });
      }

      const np = data?.next_page_params;
      if (!np) break;
      path =
        `/addresses/${bridge.address}/token-transfers?token=${token}&` +
        new URLSearchParams(
          Object.entries(np).map(([k, v]) => [k, String(v)]),
        ).toString();
    }
  }

  flows.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first

  const inflow = flows.filter((f) => f.direction === 'in');
  const outflow = flows.filter((f) => f.direction === 'out');
  const sum = (arr: Flow[]) => arr.reduce((s, f) => s + f.usd, 0);

  return NextResponse.json(
    {
      token,
      totals: {
        inflowUsd: sum(inflow),
        outflowUsd: sum(outflow),
        netUsd: sum(inflow) - sum(outflow),
        inflowCount: inflow.length,
        outflowCount: outflow.length,
      },
      flows,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=120' } },
  );
}
