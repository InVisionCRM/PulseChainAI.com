import { NextRequest, NextResponse } from 'next/server';
import { cached } from '@/lib/geicko/serverCache';
import {
  LIBERTY_BRIDGE_QUOTE_URL,
  LIBERTY_BRIDGE_CHAINS,
  LIBERTY_BRIDGE_MIN_UNITS,
  LIBERTY_BRIDGE_MAX_UNITS,
  PULSECHAIN_ID,
  isOfficialLibertyRouter,
} from '@/lib/dex/libertyswap';

// A read-only proxy for LibertySwap's bridge quote API.
//
// The API moves USDC between PulseChain and a handful of other chains; this
// route exposes the PulseChain ↔ Ethereum corridor only, which is the pair the
// rest of the app is built around. Probing it with anything else (native PLS,
// HEX, PLSX, WETH, USDT, DAI, or any same-chain route) returns "Unsupported
// swap pair", so it is only ever asked what it can answer.
//
// Two safety decisions, both deliberate:
//
//   • `methodParameters` — the signable calldata and value — is dropped before
//     the response leaves the server. LibertySwap's own docs warn that a
//     compromised API could hand back a hostile router; the cleanest defence
//     is that this app never gives a user anything to sign. Quotes are shown,
//     the swap itself happens on LibertySwap.
//   • The `to` router is still reported, with `routerListed` saying whether it
//     appears on LibertySwap's published deployment list. Only their
//     PulseChain routers are published, so inbound quotes — which return a
//     router on the *source* chain — come back unlisted, and are labelled that
//     way rather than being quietly waved through.
// Free, no key.

export const revalidate = 0;
export const maxDuration = 30;

const CACHE_MS = 30_000;
const ZERO_ADDR = /^0x0{40}$/i;

function toUnits(amount: number, decimals: number): string {
  const [whole, frac = ''] = amount.toFixed(Math.min(decimals, 18)).split('.');
  return BigInt(whole + frac.padEnd(decimals, '0').slice(0, decimals)).toString();
}

async function fetchQuote(srcChain: number, dstChain: number, amountUnits: string) {
  const url =
    `${LIBERTY_BRIDGE_QUOTE_URL}?srcToken=USDC&dstToken=USDC` +
    `&amount=${amountUnits}&srcChain=${srcChain}&dstChain=${dstChain}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const body = await res.json().catch(() => null);

  if (!res.ok || !body || typeof body !== 'object') {
    return { ok: false as const, error: (body as any)?.error ?? `Bridge API returned ${res.status}` };
  }

  const to = typeof body.to === 'string' ? body.to : null;
  const destAddress = body.destToken?.address as string | undefined;
  // Their API has answered with a zero destination token on at least one
  // corridor. A quote that can't name where the money lands isn't a quote.
  if (!to || !destAddress || ZERO_ADDR.test(destAddress)) {
    return { ok: false as const, error: 'Bridge API returned an incomplete route' };
  }

  const srcDecimals = Number(body.srcToken?.decimals);
  const destDecimals = Number(body.destToken?.decimals);
  const feePct = Number(body.fee?.percentage);
  if (!Number.isFinite(srcDecimals) || !Number.isFinite(destDecimals) || !Number.isFinite(feePct)) {
    return { ok: false as const, error: 'Bridge API returned an incomplete route' };
  }

  const srcAmount = Number(BigInt(body.srcAmount ?? amountUnits)) / 10 ** srcDecimals;
  const expected = srcAmount * (1 - feePct / 100);
  const rawDest = BigInt(body.destAmount ?? '0');

  // This is a 1:1 USDC bridge, so the payout has to be the input minus the
  // stated fee. Checking that rather than trusting `destAmount` is not
  // paranoia: on the BNB corridor the API scales it by the *source* token's
  // decimals, which would render as 249,250,000,000,000 USDC. A quote that
  // doesn't reconcile is refused instead of shown.
  const destAmount = Number(rawDest) / 10 ** destDecimals;
  if (!(expected > 0) || Math.abs(destAmount - expected) / expected > 0.01) {
    return { ok: false as const, error: 'Bridge quote did not reconcile with its own fee' };
  }

  return {
    ok: true as const,
    router: to,
    routerListed: isOfficialLibertyRouter(srcChain, to),
    srcToken: body.srcToken ?? null,
    destToken: body.destToken ?? null,
    /** Human-scale amounts — the raw integers carry the bug described above. */
    srcAmount,
    destAmount,
    feePct,
    feeAmount: srcAmount - expected,
    route: body.route ?? null,
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chainId = Number(sp.get('chain'));
  const direction = sp.get('direction') === 'out' ? 'out' : 'in';
  const amount = Number(sp.get('amount'));

  const chain = LIBERTY_BRIDGE_CHAINS.find((c) => c.id === chainId);
  if (!chain) {
    return NextResponse.json(
      { error: 'Unsupported chain', supported: LIBERTY_BRIDGE_CHAINS },
      { status: 400 },
    );
  }
  if (!Number.isFinite(amount) || amount < LIBERTY_BRIDGE_MIN_UNITS || amount > LIBERTY_BRIDGE_MAX_UNITS) {
    return NextResponse.json(
      { error: `Amount must be between ${LIBERTY_BRIDGE_MIN_UNITS} and ${LIBERTY_BRIDGE_MAX_UNITS} USDC` },
      { status: 400 },
    );
  }

  const srcChain = direction === 'in' ? chain.id : PULSECHAIN_ID;
  const dstChain = direction === 'in' ? PULSECHAIN_ID : chain.id;
  // PulseChain's USDC is 6-decimal; the source chain's is whatever it is.
  const srcDecimals = direction === 'in' ? chain.usdcDecimals : 6;

  try {
    const payload = await cached(
      `liberty-bridge:${srcChain}:${dstChain}:${amount}`,
      CACHE_MS,
      () => fetchQuote(srcChain, dstChain, toUnits(amount, srcDecimals)),
      (v) => v.ok,
    );
    return NextResponse.json(
      { direction, srcChain, dstChain, ...payload },
      { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Bridge quote failed' },
      { status: 502 },
    );
  }
}
