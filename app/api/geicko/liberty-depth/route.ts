import { NextRequest, NextResponse } from 'next/server';
import { ethCall } from '@/lib/portfolio/evmRpc';
import { cached } from '@/lib/geicko/serverCache';
import {
  ADDR_RX, NOTIONALS_USD, pad, word, toUnits, fromUnits,
  pulsexTokenMeta, onChainDecimals, buySteps, sellSteps, vsMarket,
  type RawBuy, type RawSell,
} from '@/lib/dex/depth';
import {
  LIBERTY_FACTORY,
  LIBERTY_QUOTER_V2,
  LIBERTY_FEE_TIERS,
  LIBERTY_HUBS,
} from '@/lib/dex/libertyswap';

// What a trade of a given size would actually cost on LibertySwap, straight
// from the chain: QuoterV2 simulates the swap through the real pools, so the
// numbers include the pool's own curve rather than a mid-price guess.
//
// Every figure here is one `eth_call` against the RPC pool — no indexer, no
// paid quote service, nothing to go stale. A token with no LibertySwap pool
// makes the quoter revert, which is reported as "no route" rather than
// smoothed into a zero.
//
// Two things this deliberately does NOT do:
//   • It never returns calldata. This is a read-only depth view; nothing it
//     produces is signable, so a compromised response can't cost anyone funds.
//   • It never presents LibertySwap's price as *the* price. LibertySwap is a
//     small venue and its pools can sit well off market — the payload reports
//     that gap (`vsMarketPct`) instead of hiding it.
// PulseChain only, free.

export const revalidate = 0;
export const maxDuration = 60;

const CACHE_MS = 60_000;

/**
 * `QuoterV2.quoteExactInputSingle`. Returns null when the call reverts, which
 * is what a missing or empty pool looks like — the quoter has no "0 out" path.
 */
async function quote(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  fee: number,
): Promise<bigint | null> {
  if (amountIn <= 0n) return null;
  const data =
    '0xc6a5026a' + pad(tokenIn) + pad(tokenOut) + word(amountIn) + word(fee) + word(0);
  const res = await ethCall('pulsechain', LIBERTY_QUOTER_V2, data);
  if (!res || res.length < 2 + 64 * 4) return null;
  const out = BigInt('0x' + res.slice(2).slice(0, 64));
  return out > 0n ? out : null;
}

async function poolAddress(tokenA: string, tokenB: string, fee: number): Promise<string | null> {
  const res = await ethCall(
    'pulsechain',
    LIBERTY_FACTORY,
    '0x1698ee82' + pad(tokenA) + pad(tokenB) + word(fee),
  );
  if (!res) return null;
  const addr = '0x' + res.slice(-40);
  return /^0x0{40}$/.test(addr) ? null : addr;
}

async function build(token: string, priceHint: number) {
  const hubAddrs = LIBERTY_HUBS.map((h) => h.address);
  const meta = await pulsexTokenMeta([token, ...hubAddrs]);

  const tokenDecimals = meta[token]?.decimals ?? (await onChainDecimals(token));
  if (tokenDecimals == null) {
    return { supported: true, hasRoute: false, reason: 'unknown-decimals' as const };
  }
  const marketPrice = priceHint > 0 ? priceHint : (meta[token]?.priceUsd ?? 0);

  // Probe every hub × fee tier at the middle notional. A tier can look fine on
  // dust and be dry one step up, so the winner is chosen at a size that matters.
  const probeUsd = NOTIONALS_USD[1];
  const candidates = LIBERTY_HUBS.flatMap((hub) =>
    LIBERTY_FEE_TIERS.map((fee) => ({ hub, fee })),
  );
  const probes = await Promise.all(
    candidates.map(async ({ hub, fee }) => {
      const hubPrice = meta[hub.address]?.priceUsd ?? 0;
      if (hubPrice <= 0) return null;
      const amountIn = toUnits(probeUsd / hubPrice, hub.decimals);
      const out = await quote(hub.address, token, amountIn, fee);
      if (out == null) return null;
      return { hub, fee, hubPrice, tokensOut: fromUnits(out, tokenDecimals) };
    }),
  );

  const live = probes.filter((p): p is NonNullable<typeof p> => p != null);
  if (!live.length) {
    return {
      supported: true,
      hasRoute: false,
      reason: 'no-liberty-pool' as const,
      token,
      hubsChecked: LIBERTY_HUBS.map((h) => h.symbol),
    };
  }

  // Best route = the one handing back the most tokens for the same USD.
  const best = live.reduce((a, b) => (b.tokensOut > a.tokensOut ? b : a));
  const { hub, fee, hubPrice } = best;

  const [buyRaw, sellRaw, pool] = await Promise.all([
    Promise.all(
      NOTIONALS_USD.map(async (usd) => {
        const out = await quote(hub.address, token, toUnits(usd / hubPrice, hub.decimals), fee);
        return out == null ? null : { usd, tokens: fromUnits(out, tokenDecimals) };
      }),
    ),
    Promise.all(
      NOTIONALS_USD.map(async (usd) => {
        if (marketPrice <= 0) return null;
        const out = await quote(token, hub.address, toUnits(usd / marketPrice, tokenDecimals), fee);
        return out == null
          ? null
          : { usd, tokens: usd / marketPrice, usdOut: fromUnits(out, hub.decimals) * hubPrice };
      }),
    ),
    poolAddress(hub.address, token, fee),
  ]);

  const buys: RawBuy[] = buyRaw.filter((b): b is RawBuy => b != null && b.tokens > 0);
  const sells: RawSell[] = sellRaw.filter((s): s is RawSell => s != null && s.usdOut > 0);
  const buy = buySteps(buys);

  return {
    supported: true,
    hasRoute: true,
    token,
    symbol: meta[token]?.symbol ?? null,
    decimals: tokenDecimals,
    /** The token's price everywhere else, for comparison — not LibertySwap's. */
    marketPriceUsd: marketPrice,
    route: {
      hub: hub.symbol,
      hubAddress: hub.address,
      hubPriceUsd: hubPrice,
      feeTier: fee,
      feePct: fee / 10_000,
      pool,
      /** Fee tiers that quoted at all, so the UI can say what was considered. */
      tiersWithLiquidity: live
        .filter((l) => l.hub.address === hub.address)
        .map((l) => l.fee)
        .sort((a, b) => a - b),
    },
    buy,
    sell: sellSteps(sells),
    /**
     * LibertySwap's small-trade price against the token's market price.
     * Positive means buying here costs more than it should.
     */
    vsMarketPct: vsMarket(buy, marketPrice),
    note: 'Simulated on chain with LibertySwap QuoterV2. Read-only — no transaction data is produced here.',
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const network = (sp.get('network') || 'pulsechain').toLowerCase();
  const token = (sp.get('token') || '').toLowerCase();
  const priceRaw = parseFloat(sp.get('price') || '');
  const priceHint = Number.isFinite(priceRaw) && priceRaw > 0 ? priceRaw : 0;

  if (network !== 'pulsechain') return NextResponse.json({ supported: false, chain: network });
  if (!ADDR_RX.test(token)) {
    return NextResponse.json({ error: 'token required' }, { status: 400 });
  }

  try {
    // The price hint only scales the sell-side sizes, so it stays out of the key.
    const payload = await cached(
      `liberty-depth:${token}`,
      CACHE_MS,
      () => build(token, priceHint),
      (v: any) => v?.supported === true,
    );
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to quote LibertySwap' },
      { status: 500 },
    );
  }
}
