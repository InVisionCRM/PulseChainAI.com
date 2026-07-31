import { NextRequest, NextResponse } from 'next/server';
import { ethCall } from '@/lib/portfolio/evmRpc';
import { cached } from '@/lib/geicko/serverCache';
import {
  ADDR_RX, NOTIONALS_USD, pad, word, toUnits, fromUnits,
  pulsexTokenMeta, onChainDecimals, buySteps, sellSteps, vsMarket,
  type RawBuy, type RawSell,
} from '@/lib/dex/depth';
import {
  PULSEX_VERSIONS, PULSEX_PRICED_HUBS, PULSEX_ROUTE_PREFIXES,
} from '@/lib/dex/pulsex';

// What a trade of a given size would actually cost on PulseX, read from the
// chain. PulseX is a Uniswap-V2 fork, so there is no QuoterV2 — the router's
// own `getAmountsOut` walks the same constant-product maths the swap will,
// including its fee, which makes it the exact analogue.
//
// Both router versions are probed, along with direct and two-hop routes from
// each priced hub, and the best output wins. That mirrors how PulseX's own
// interface routes, and it matters: a token with no WPLS pair may still trade
// fine through PLSX or HEX, and a direct-only quoter would call it dead.
//
// One limit stated rather than buried: `getAmountsOut` is pool maths only. A
// token that charges a transfer tax (pSSH's toll, reflection tokens, most
// launchpad coins) will deliver less than this quote says, because the tax is
// taken by the token contract after the router has done its part. The payload
// says so instead of quietly overstating the fill.
// PulseChain only, free.

export const revalidate = 0;
export const maxDuration = 60;

const CACHE_MS = 60_000;

/**
 * `getAmountsOut(uint256, address[])`. Returns the final leg's output, or null
 * when the call reverts — which is what a missing pair anywhere along the path
 * looks like. A path whose first hop exists but whose second does not reverts
 * too, so a null is "no route", never "a route worth zero".
 */
async function amountsOut(
  router: string,
  amountIn: bigint,
  path: readonly string[],
): Promise<bigint | null> {
  if (amountIn <= 0n) return null;
  // uint256 amountIn, then a 0x40 offset to the address[] (length + elements).
  const data =
    '0xd06ca61f' + word(amountIn) + word(64) + word(path.length) + path.map(pad).join('');
  const res = await ethCall('pulsechain', router, data);
  if (!res) return null;
  const hex = res.slice(2);
  const len = Number(BigInt('0x' + hex.slice(64, 128)));
  if (len !== path.length || hex.length < 128 + len * 64) return null;
  const out = BigInt('0x' + hex.slice(128 + (len - 1) * 64, 192 + (len - 1) * 64));
  return out > 0n ? out : null;
}

const hubFor = (address: string) =>
  PULSEX_PRICED_HUBS.find((h) => h.address === address.toLowerCase()) ?? null;

const shortPath = (path: readonly string[], symbols: Record<string, string>) =>
  path.map((a) => symbols[a.toLowerCase()] ?? `${a.slice(0, 6)}…`).join(' → ');

async function build(token: string, priceHint: number) {
  const hubAddrs = PULSEX_PRICED_HUBS.map((h) => h.address);
  const routeTokens = [...new Set(PULSEX_ROUTE_PREFIXES.flat().map((a) => a.toLowerCase()))];
  const meta = await pulsexTokenMeta([token, ...new Set([...hubAddrs, ...routeTokens])]);

  const tokenDecimals = meta[token]?.decimals ?? (await onChainDecimals(token));
  if (tokenDecimals == null) {
    return { supported: true, hasRoute: false, reason: 'unknown-decimals' as const, token };
  }
  const marketPrice = priceHint > 0 ? priceHint : (meta[token]?.priceUsd ?? 0);

  const symbols: Record<string, string> = {};
  for (const [addr, m] of Object.entries(meta)) if (m.symbol) symbols[addr] = m.symbol;

  // Probe every version × route at the middle notional. A route can look fine
  // on dust and be dry one step up, so the winner is chosen at a size that bites.
  const probeUsd = NOTIONALS_USD[1];
  const candidates = PULSEX_VERSIONS.flatMap((v) =>
    PULSEX_ROUTE_PREFIXES.map((prefix) => ({ v, prefix })),
  );
  const probes = await Promise.all(
    candidates.map(async ({ v, prefix }) => {
      const hub = hubFor(prefix[0]);
      const hubPrice = hub ? (meta[hub.address]?.priceUsd ?? 0) : 0;
      if (!hub || hubPrice <= 0) return null;
      const path = [...prefix, token];
      const out = await amountsOut(v.router, toUnits(probeUsd / hubPrice, hub.decimals), path);
      if (out == null) return null;
      return { v, hub, hubPrice, path, tokensOut: fromUnits(out, tokenDecimals) };
    }),
  );

  const live = probes.filter((p): p is NonNullable<typeof p> => p != null);
  if (!live.length) {
    return {
      supported: true,
      hasRoute: false,
      reason: 'no-pulsex-route' as const,
      token,
      hubsChecked: PULSEX_PRICED_HUBS.map((h) => h.symbol),
    };
  }

  // Best route = the one handing back the most tokens for the same USD.
  const best = live.reduce((a, b) => (b.tokensOut > a.tokensOut ? b : a));
  const { v, hub, hubPrice, path } = best;
  const sellPath = [...path].reverse();

  const [buyRaw, sellRaw] = await Promise.all([
    Promise.all(
      NOTIONALS_USD.map(async (usd) => {
        const out = await amountsOut(v.router, toUnits(usd / hubPrice, hub.decimals), path);
        return out == null ? null : { usd, tokens: fromUnits(out, tokenDecimals) };
      }),
    ),
    Promise.all(
      NOTIONALS_USD.map(async (usd) => {
        if (marketPrice <= 0) return null;
        const out = await amountsOut(
          v.router,
          toUnits(usd / marketPrice, tokenDecimals),
          sellPath,
        );
        return out == null
          ? null
          : { usd, tokens: usd / marketPrice, usdOut: fromUnits(out, hub.decimals) * hubPrice };
      }),
    ),
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
    /** The token's price everywhere else, for comparison — not PulseX's. */
    marketPriceUsd: marketPrice,
    route: {
      version: v.version,
      router: v.router,
      hub: hub.symbol,
      hubPriceUsd: hubPrice,
      hops: path.length - 1,
      path,
      pathLabel: shortPath(path, symbols),
      /** Every version/route pair that quoted, so the UI can say what lost. */
      alternatives: live
        .filter((l) => l !== best)
        .map((l) => ({
          version: l.v.version,
          pathLabel: shortPath(l.path, symbols),
          worseByPct: best.tokensOut > 0 ? (1 - l.tokensOut / best.tokensOut) * 100 : 0,
        }))
        .sort((a, b) => a.worseByPct - b.worseByPct)
        .slice(0, 4),
    },
    buy,
    sell: sellSteps(sells),
    vsMarketPct: vsMarket(buy, marketPrice),
    /** True when the quote passes through a pair, i.e. always — kept explicit. */
    excludesTransferTax: true,
    note: 'Simulated on chain with the PulseX router. Pool maths only — any transfer tax the token charges is taken on top of this.',
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
      `pulsex-depth:${token}`,
      CACHE_MS,
      () => build(token, priceHint),
      (v: any) => v?.supported === true,
    );
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to quote PulseX' },
      { status: 500 },
    );
  }
}
