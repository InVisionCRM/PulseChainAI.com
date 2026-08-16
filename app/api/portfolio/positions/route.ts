import { NextRequest, NextResponse } from 'next/server';
import type { ChainId } from '@/services';
import { detectHeldPosition, type ProtocolPosition } from '@/lib/portfolio/positions';
import { scanFarms } from '@/lib/portfolio/protocolRegistry';
import { detectV3Positions } from '@/lib/portfolio/positionsV3';
import { discoverStakedPositions, type Candidate } from '@/lib/portfolio/positionDiscovery';
import { pulsechainHexStakingService } from '@/services/pulsechainHexStakingService';
import { HEX_ADDRESS, heartsToHex } from '@/lib/hex/hexDay';
import { fetchUsdPrices } from '@/lib/portfolio/dexPrices';

export const revalidate = 0;
export const maxDuration = 60;

const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;
const BLOCKSCOUT: Record<ChainId, string> = {
  pulsechain: 'https://api.scan.pulsechain.com/api/v2',
  ethereum: 'https://eth.blockscout.com/api/v2',
  robinhood: 'https://robinhoodchain.blockscout.com/api/v2',
};
const DEX_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; MorbiusPortfolio/1.0)',
};

// Probe at most this many held tokens (most wallets hold far fewer; this bounds
// RPC fan-out on dust-spammed wallets).
const MAX_TOKENS = 80;

async function fetchJson(url: string, headers?: Record<string, string>): Promise<any | null> {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/**
 * USD price per token address, scoped to the chain.
 *
 * Delegates to lib/portfolio/dexPrices.ts rather than querying DexScreener
 * here. That helper already does the three things this needs and the local
 * version got wrong:
 *
 *   • It scopes to the chain. The same address is a different token on
 *     PulseChain and Ethereum. The wallet measured here holds an "LPT" whose
 *     address is Livepeer's: $1.18 on Ethereum, $0.0001454 on PulseChain. Priced
 *     unscoped, one position read as $80,862 instead of about ten dollars.
 *   • It reads the quote side, so tokens that mostly sit on the other half of a
 *     pair — WPLS, BSV — get a price at all. Without it, 0 of 29 V3 positions
 *     had both sides priced and the whole value landed on one side.
 *   • It asks per token instead of batching thirty into one URL. A batched
 *     request comes back with only the deepest pairs overall, so a PulseChain
 *     token whose pools are small simply had no pairs in the response — which
 *     is how the local version still missed prices after being chain-scoped.
 *
 * Its liquidity floor also applies, so a token whose only pools are worth tens
 * of dollars returns no price rather than a number nobody could trade at.
 */
async function priceMap(addresses: string[], chain: ChainId): Promise<Map<string, number>> {
  return fetchUsdPrices(addresses, chain);
}

function priceAll(positions: ProtocolPosition[], prices: Map<string, number>) {
  for (const pos of positions) {
    let total = 0;
    let known = false;
    for (const u of pos.underlying) {
      const px = prices.get(u.address.toLowerCase());
      if (px != null) {
        u.valueUsd = u.amount * px;
        total += u.valueUsd;
        known = true;
      }
    }
    // Debt (borrowed) reduces net worth.
    if (known) pos.valueUsd = pos.note === 'Borrowed' ? -total : total;
  }
}

/** Approval (spender, token) pairs — candidate custodial farm/staker contracts
 * plus the token approved to each (the likely staked asset). */
async function approvalCandidates(origin: string, address: string, chain: ChainId): Promise<Candidate[]> {
  try {
    const r = await fetch(`${origin}/api/portfolio/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, chain }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) return [];
    const d = await r.json();
    return ((d?.approvals as any[]) ?? [])
      .map((a) => ({
        contract: String(a?.spender ?? '').toLowerCase(),
        approvedToken: String(a?.token?.address ?? a?.token?.address_hash ?? '').toLowerCase() || undefined,
      }))
      .filter((c) => c.contract);
  } catch {
    return [];
  }
}

/** Sum the wallet's active HEX stakes into a single staking position. */
async function hexStakePosition(address: string): Promise<ProtocolPosition | null> {
  const hist = await pulsechainHexStakingService.getStakerHistory(address);
  const stakes = (hist?.stakes ?? []) as { stakedHearts?: string; isActive?: boolean }[];
  const hearts = stakes.filter((s) => s.isActive).reduce((sum, s) => sum + Number(s.stakedHearts ?? 0), 0);
  if (hearts <= 0) return null;
  return {
    kind: 'staking',
    address: HEX_ADDRESS,
    symbol: 'HEX',
    protocol: 'HEX',
    note: 'Staked',
    underlying: [{ address: HEX_ADDRESS, symbol: 'HEX', decimals: 8, amount: heartsToHex(hearts) }],
  };
}

/**
 * Drop duplicate positions (same kind + address + id), in place.
 *
 * The id matters: a wallet's V3 positions are all minted by the same position
 * manager, so keying on the address alone folded every one of them into a
 * single row — 29 live positions were arriving and 1 was being kept.
 */
function dedupePositions(positions: ProtocolPosition[]): void {
  const seen = new Set<string>();
  for (let i = positions.length - 1; i >= 0; i--) {
    const key = `${positions[i].kind}:${positions[i].address.toLowerCase()}:${positions[i].id ?? ''}`;
    if (seen.has(key)) positions.splice(i, 1);
    else seen.add(key);
  }
}

export async function POST(req: NextRequest) {
  let body: { address?: string; chain?: ChainId };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const address = String(body?.address ?? '').toLowerCase();
  if (!ADDRESS_RX.test(address)) return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  const chain: ChainId = body?.chain === 'ethereum' ? 'ethereum' : body?.chain === 'robinhood' ? 'robinhood' : 'pulsechain';

  try {
    // Held tokens from Blockscout (same source as the balances route).
    const balances = await fetchJson(`${BLOCKSCOUT[chain]}/addresses/${address}/token-balances`);
    const items: any[] = Array.isArray(balances) ? balances : balances?.items ?? [];
    const held = items
      .filter((it) => it?.token?.type?.includes('ERC-20') || it?.token?.address)
      .map((it) => ({
        address: String(it?.token?.address ?? it?.token?.address_hash ?? '').toLowerCase(),
        symbol: String(it?.token?.symbol ?? '???'),
        decimals: Number(it?.token?.decimals ?? 18) || 18,
        raw: BigInt(String(it?.value ?? '0')),
      }))
      .filter((t) => t.address && t.raw > 0n)
      .slice(0, MAX_TOKENS);

    // Detect held-token positions + scan custodial farms in parallel.
    const CONC = 6;
    const heldPositions: ProtocolPosition[] = [];
    let idx = 0;
    const detectWorker = async () => {
      while (idx < held.length) {
        const t = held[idx++];
        try {
          const pos = await detectHeldPosition(chain, t.address, t.raw, t.decimals, t.symbol);
          if (pos) heldPositions.push(pos);
        } catch {
          /* skip token */
        }
      }
    };
    // In parallel: held-token detection, registry farms, V3 NFT positions,
    // footprint-discovered custodial stakers, and (PulseChain) HEX stakes.
    const origin = req.nextUrl.origin;
    const [, farmPositions, v3Positions, discovered, hexPositions] = await Promise.all([
      Promise.all(Array.from({ length: CONC }, detectWorker)),
      scanFarms(chain, address).catch(() => [] as ProtocolPosition[]),
      detectV3Positions(chain, address).catch(() => [] as ProtocolPosition[]),
      approvalCandidates(origin, address, chain)
        .then((cands) => discoverStakedPositions(chain, address, cands))
        .catch(() => [] as ProtocolPosition[]),
      chain === 'pulsechain'
        ? hexStakePosition(address).catch(() => null)
        : Promise.resolve(null),
    ]);

    const positions = [
      ...heldPositions,
      ...farmPositions,
      ...v3Positions,
      ...discovered,
      ...(hexPositions ? [hexPositions] : []),
    ];
    dedupePositions(positions);

    // Price the underlying assets, then sum per position.
    const prices = await priceMap(positions.flatMap((p) => p.underlying.map((u) => u.address)), chain);
    priceAll(positions, prices);

    // Group by category, sorted by USD desc within each.
    const order: ProtocolPosition['kind'][] = ['lending', 'farm', 'lp', 'vault', 'staking'];
    const groups = order
      .map((kind) => ({
        kind,
        positions: positions.filter((p) => p.kind === kind).sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0)),
      }))
      .filter((g) => g.positions.length > 0);

    const totalUsd = positions.reduce((s, p) => s + (p.valueUsd ?? 0), 0);

    return NextResponse.json(
      { address, chain, totalUsd, groups },
      { headers: { 'Cache-Control': 'private, max-age=120' } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load positions' },
      { status: 500 },
    );
  }
}
