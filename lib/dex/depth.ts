// Shared machinery for "what would a trade of this size actually execute at",
// used by every venue-specific depth route.
//
// The venues differ only in how a quote is obtained — LibertySwap has a
// Uniswap-V3 QuoterV2, PulseX is a V2 fork whose router does the same job via
// `getAmountsOut`. Everything around that is identical and lives here: token
// metadata, integer/decimal conversion, and the slippage arithmetic. Keeping
// one copy means the two panels can be read against each other without
// wondering whether they measured the same way.

import { ethCall } from '@/lib/portfolio/evmRpc';
import { PULSEX_SUBGRAPHS, gql, num } from '@/lib/geicko/pulsex';

export const ADDR_RX = /^0x[a-fA-F0-9]{40}$/;

/** Trade sizes probed, in USD. Small enough to read spot, large enough to bite. */
export const NOTIONALS_USD = [100, 1_000, 10_000] as const;

export const pad = (a: string) => a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
export const word = (n: bigint | number) => BigInt(n).toString(16).padStart(64, '0');

/** Decimal amount → integer token units, without going through a float. */
export function toUnits(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) return 0n;
  const [whole, frac = ''] = amount.toFixed(Math.min(decimals, 18)).split('.');
  return BigInt(whole + frac.padEnd(decimals, '0').slice(0, decimals));
}

export const fromUnits = (v: bigint, decimals: number) => Number(v) / 10 ** decimals;

export interface TokenMeta {
  symbol: string | null;
  decimals: number | null;
  priceUsd: number;
}

/**
 * Symbol, decimals and USD price for a batch of tokens, from PulseX.
 *
 * Aliased into one query per subgraph rather than one per token: a depth probe
 * needs the token plus every hub, and that is a lot of round trips otherwise.
 * v1 is only consulted for what v2 could not price.
 */
export async function pulsexTokenMeta(addresses: string[]): Promise<Record<string, TokenMeta>> {
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

/**
 * ERC-20 `decimals()`, for a token PulseX has never indexed. Worth the extra
 * call: pSSH is 9-decimal, and assuming 18 turns a real quote into a silent
 * zero rather than an obvious error.
 */
export async function onChainDecimals(token: string): Promise<number | null> {
  const res = await ethCall('pulsechain', token, '0x313ce567');
  if (!res) return null;
  const d = Number(BigInt(res));
  return d >= 0 && d <= 36 ? d : null;
}

export interface Step {
  usd: number;
  /** Tokens received (buy) or spent (sell). */
  tokens: number;
  /** USD paid (buy) or received (sell). */
  usdOther: number;
  /** USD per token this trade actually executes at. */
  effectivePrice: number;
  /** How much worse than the smallest probed size, in percent. */
  impactPct: number;
}

export interface RawBuy {
  usd: number;
  tokens: number;
}
export interface RawSell {
  usd: number;
  tokens: number;
  usdOut: number;
}

/**
 * Slippage is measured against the smallest probed ticket, not a mid-price.
 * A pool's mid-price is a number nobody can trade at; the $100 fill is the
 * closest honest proxy for spot, and every larger ticket is quoted as how much
 * worse it does than that.
 */
export function buySteps(raw: RawBuy[]): Step[] {
  const base = raw.length ? raw[0].usd / raw[0].tokens : 0;
  return raw.map((b) => {
    const eff = b.usd / b.tokens;
    return {
      usd: b.usd,
      tokens: b.tokens,
      usdOther: b.usd,
      effectivePrice: eff,
      impactPct: base > 0 ? (eff / base - 1) * 100 : 0,
    };
  });
}

export function sellSteps(raw: RawSell[]): Step[] {
  const base = raw.length ? raw[0].usdOut / raw[0].tokens : 0;
  return raw.map((s) => {
    const eff = s.usdOut / s.tokens;
    return {
      usd: s.usd,
      tokens: s.tokens,
      usdOther: s.usdOut,
      effectivePrice: eff,
      impactPct: base > 0 ? (1 - eff / base) * 100 : 0,
    };
  });
}

/** The venue's small-trade price against the token's market price, in percent. */
export function vsMarket(buys: Step[], marketPrice: number): number | null {
  if (!buys.length || marketPrice <= 0) return null;
  return (buys[0].effectivePrice / marketPrice - 1) * 100;
}
