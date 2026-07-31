import { NextRequest, NextResponse } from 'next/server';
import { ethCall } from '@/lib/portfolio/evmRpc';
import { cached } from '@/lib/geicko/serverCache';
import { PULSEX_SUBGRAPHS, gql, num } from '@/lib/geicko/pulsex';
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

const ADDR_RX = /^0x[a-fA-F0-9]{40}$/;
const CACHE_MS = 60_000;
/** Trade sizes probed, in USD. Small enough to read spot, large enough to bite. */
const NOTIONALS_USD = [100, 1_000, 10_000] as const;

const pad = (a: string) => a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
const word = (n: bigint | number) => BigInt(n).toString(16).padStart(64, '0');

/** Decimal amount → integer token units, without going through a float. */
function toUnits(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) return 0n;
  const [whole, frac = ''] = amount.toFixed(Math.min(decimals, 18)).split('.');
  return BigInt(whole + frac.padEnd(decimals, '0').slice(0, decimals));
}

const fromUnits = (v: bigint, decimals: number) => Number(v) / 10 ** decimals;

/**
 * `QuoterV2.quoteExactInputSingle`. Returns null when the call reverts, which
 * is what a missing or empty pool looks like — the quoter has no "0 out" path.
 */
async function quote(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
  fee: number,
): Promise<{ out: bigint; gas: number } | null> {
  if (amountIn <= 0n) return null;
  const data =
    '0xc6a5026a' + pad(tokenIn) + pad(tokenOut) + word(amountIn) + word(fee) + word(0);
  const res = await ethCall('pulsechain', LIBERTY_QUOTER_V2, data);
  if (!res || res.length < 2 + 64 * 4) return null;
  const hex = res.slice(2);
  const out = BigInt('0x' + hex.slice(0, 64));
  if (out <= 0n) return null;
  return { out, gas: Number(BigInt('0x' + hex.slice(192, 256))) };
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

interface TokenMeta {
  symbol: string | null;
  decimals: number | null;
  priceUsd: number;
}

/** Symbol, decimals and USD price for a batch of tokens, from PulseX. */
async function pulsexMeta(addresses: string[]): Promise<Record<string, TokenMeta>> {
  const out: Record<string, TokenMeta> = {};
  for (const url of PULSEX_SUBGRAPHS) {
    const missing = addresses.filter((a) => !out[a] || out[a].priceUsd <= 0);
    if (!missing.length) break;
    const fields = missing
      .map((a, i) => `t${i}: token(id:"${a}"){ symbol decimals derivedUSD }`)
      .join(' ');
    const d = await gql(url, `{ ${fields} }`);
    if (!d) continue;
    missing.forEach((a, i) => {
      const t = d[`t${i}`];
      if (!t) return;
      const price = num(t.derivedUSD);
      const prev = out[a];
      if (prev && prev.priceUsd > 0 && price <= 0) return;
      out[a] = {
        symbol: t.symbol ?? prev?.symbol ?? null,
        decimals: t.decimals != null ? Number(t.decimals) : (prev?.decimals ?? null),
        priceUsd: price > 0 ? price : (prev?.priceUsd ?? 0),
      };
    });
  }
  return out;
}

/** ERC-20 `decimals()`, for a token PulseX has never indexed. */
async function onChainDecimals(token: string): Promise<number | null> {
  const res = await ethCall('pulsechain', token, '0x313ce567');
  if (!res) return null;
  const d = Number(BigInt(res));
  return d >= 0 && d <= 36 ? d : null;
}

interface Step {
  usd: number;
  /** Tokens received (buy) or spent (sell). */
  tokens: number;
  /** USD paid (buy) or received (sell). */
  usdOther: number;
  /** USD per token this trade actually executes at. */
  effectivePrice: number;
  /** How much worse than the smallest probed size, in percent. */
  impactPct: number;
  gas: number;
}

async function build(token: string, priceHint: number) {
  const hubAddrs = LIBERTY_HUBS.map((h) => h.address);
  const meta = await pulsexMeta([token, ...hubAddrs]);

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
      const q = await quote(hub.address, token, amountIn, fee);
      if (!q) return null;
      return { hub, fee, hubPrice, tokensOut: fromUnits(q.out, tokenDecimals) };
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
        const q = await quote(hub.address, token, toUnits(usd / hubPrice, hub.decimals), fee);
        return q ? { usd, tokens: fromUnits(q.out, tokenDecimals), gas: q.gas } : null;
      }),
    ),
    Promise.all(
      NOTIONALS_USD.map(async (usd) => {
        if (marketPrice <= 0) return null;
        const q = await quote(token, hub.address, toUnits(usd / marketPrice, tokenDecimals), fee);
        return q
          ? { usd, tokens: usd / marketPrice, hubOut: fromUnits(q.out, hub.decimals), gas: q.gas }
          : null;
      }),
    ),
    poolAddress(hub.address, token, fee),
  ]);

  const buys = buyRaw.filter((b): b is NonNullable<typeof b> => b != null && b.tokens > 0);
  const sells = sellRaw.filter((s): s is NonNullable<typeof s> => s != null && s.hubOut > 0);

  const buyBase = buys.length ? buys[0].usd / buys[0].tokens : 0;
  const buySteps: Step[] = buys.map((b) => {
    const eff = b.usd / b.tokens;
    return {
      usd: b.usd,
      tokens: b.tokens,
      usdOther: b.usd,
      effectivePrice: eff,
      impactPct: buyBase > 0 ? (eff / buyBase - 1) * 100 : 0,
      gas: b.gas,
    };
  });

  const sellBase = sells.length ? (sells[0].hubOut * hubPrice) / sells[0].tokens : 0;
  const sellSteps: Step[] = sells.map((s) => {
    const usdOut = s.hubOut * hubPrice;
    const eff = usdOut / s.tokens;
    return {
      usd: s.usd,
      tokens: s.tokens,
      usdOther: usdOut,
      effectivePrice: eff,
      impactPct: sellBase > 0 ? (1 - eff / sellBase) * 100 : 0,
      gas: s.gas,
    };
  });

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
    buy: buySteps,
    sell: sellSteps,
    /**
     * LibertySwap's small-trade price against the token's market price.
     * Positive means buying here costs more than it should.
     */
    vsMarketPct: marketPrice > 0 && buyBase > 0 ? (buyBase / marketPrice - 1) * 100 : null,
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
