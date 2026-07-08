// GET /api/portfolio/bridge?wallet=0x..
//
// A single wallet's bridge inflows/outflows: its ERC-20 transfers where the
// counterparty is the PulseChain bridge. From the bridge → inflow (bridged in);
// to the bridge → outflow (bridged out). Each is valued at the token's current
// USD price; dust below $1 is dropped so totals reflect real movements.

import { NextRequest, NextResponse } from 'next/server';
import { blockscoutJson } from '@/lib/blockscout';
import { fetchUsdPrices } from '@/lib/portfolio/dexPrices';
import { BRIDGE_SET, bridgeLabel } from '@/lib/pulsechain/bridges';

const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;
const MAX_PAGES = 10; // ~500 transfers scanned
const MIN_USD = 1;

interface Flow {
  bridge: string;
  token: string;
  tokenAddress: string;
  amount: number;
  usd: number;
  date: string;
  direction: 'in' | 'out';
  txHash: string | null;
}

const tokenAddrOf = (it: any): string =>
  String(it?.token?.address_hash ?? it?.token?.address ?? '').toLowerCase();

export async function GET(req: NextRequest) {
  const wallet = (req.nextUrl.searchParams.get('wallet') || '').toLowerCase();
  if (!ADDRESS_RX.test(wallet)) {
    return NextResponse.json({ error: 'wallet required' }, { status: 400 });
  }

  // 1) Walk the wallet's ERC-20 transfers, keeping only bridge counterparties.
  const matches: Array<{ it: any; direction: 'in' | 'out'; bridgeAddr: string }> = [];
  let path = `/addresses/${wallet}/token-transfers?type=ERC-20`;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await blockscoutJson(path, { revalidateSeconds: 120 });
    const items: any[] = Array.isArray(data?.items) ? data.items : [];
    if (items.length === 0) break;

    for (const it of items) {
      const from = String(it?.from?.hash ?? '').toLowerCase();
      const to = String(it?.to?.hash ?? '').toLowerCase();
      if (BRIDGE_SET.has(from)) matches.push({ it, direction: 'in', bridgeAddr: from });
      else if (BRIDGE_SET.has(to)) matches.push({ it, direction: 'out', bridgeAddr: to });
    }

    const np = data?.next_page_params;
    if (!np) break;
    path =
      `/addresses/${wallet}/token-transfers?type=ERC-20&` +
      new URLSearchParams(Object.entries(np).map(([k, v]) => [k, String(v)])).toString();
  }

  // 2) Price every token that appeared. Prefer a PulseChain DEX price; fall back
  // to the explorer's own exchange_rate (chain-native, so it's correct for
  // forked tokens whose address is a high-value asset on Ethereum, e.g. WETH).
  const tokenAddrs = [...new Set(matches.map((m) => tokenAddrOf(m.it)).filter(Boolean))];
  const prices = tokenAddrs.length
    ? await fetchUsdPrices(tokenAddrs, 'pulsechain')
    : new Map<string, number>();
  const explorerRate = new Map<string, number>();
  for (const { it } of matches) {
    const addr = tokenAddrOf(it);
    const rate = Number(it?.token?.exchange_rate);
    if (addr && Number.isFinite(rate) && rate > 0 && !explorerRate.has(addr)) {
      explorerRate.set(addr, rate);
    }
  }

  // 3) Build flows, dropping priced dust.
  const flows: Flow[] = [];
  for (const { it, direction, bridgeAddr } of matches) {
    const tokenAddress = tokenAddrOf(it);
    const decimals = Number(it?.total?.decimals ?? 18) || 18;
    const amount = Number(it?.total?.value ?? 0) / Math.pow(10, decimals);
    const price = prices.get(tokenAddress) ?? explorerRate.get(tokenAddress) ?? 0;
    const usd = amount * price;
    if (price > 0 && usd < MIN_USD) continue;
    flows.push({
      bridge: bridgeLabel(bridgeAddr),
      token: it?.token?.symbol ?? '',
      tokenAddress,
      amount,
      usd,
      date: it?.timestamp ?? '',
      direction,
      txHash: it?.transaction_hash ?? null,
    });
  }
  flows.sort((a, b) => (a.date < b.date ? 1 : -1));

  const inflow = flows.filter((f) => f.direction === 'in');
  const outflow = flows.filter((f) => f.direction === 'out');
  const sum = (arr: Flow[]) => arr.reduce((s, f) => s + f.usd, 0);

  return NextResponse.json(
    {
      wallet,
      totals: {
        inflowUsd: sum(inflow),
        outflowUsd: sum(outflow),
        netUsd: sum(inflow) - sum(outflow),
        inflowCount: inflow.length,
        outflowCount: outflow.length,
      },
      flows,
    },
    { headers: { 'Cache-Control': 'private, max-age=120' } },
  );
}
