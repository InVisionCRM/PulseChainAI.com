// Portfolio aggregator — given a wallet address and a list of chains,
// fetches balances per chain in parallel, normalises into PortfolioToken[],
// enriches with DexScreener prices (batched, cached), and returns a unified
// snapshot. Per-chain failures degrade gracefully into the errors array on
// the snapshot so the UI can show partial data.

import { validateAddress } from '../core/errors';
import {
  NATIVE_TOKEN_ADDRESS,
  WRAPPED_NATIVE,
} from '../core/types';
import { resolveTokenIcon } from '../../lib/services/token-icon-resolver';
import type {
  ApiResponse,
  ChainId,
  LpBreakdown,
  LpUnderlying,
  PortfolioFetchError,
  PortfolioSnapshot,
  PortfolioToken,
} from '../core/types';

// Both chains have a Blockscout instance with the same API surface. The
// actual cross-origin call to the explorer happens server-side via
// /api/portfolio/balances — browser-direct fetches to
// api.scan.pulsechain.com / eth.blockscout.com worked locally but hung
// in production (CORS + rate-limit posture). Every other external call
// we make (prices, lp, approvals, insights, audit) is already proxied;
// this matches the pattern.
const BALANCES_PROXY_URL = '/api/portfolio/balances';

// Cap how many tokens we'll try to price per chain per wallet. Some Ethereum
// addresses (Vitalik's wallet, anything that's done a lot of airdrops) hold
// thousands of dust ERC-20s, and we shouldn't fan out a DexScreener lookup
// for every one of them. We prefer tokens the explorer already has metadata
// for (icon_url or exchange_rate is a decent proxy for "not spam").
const TOKEN_LIMIT_PER_CHAIN = 150;

// Server-side proxies — see app/api/portfolio/{prices,lp}/route.ts.
// Both exist because direct browser fetches to DexScreener are either
// blocked by Cloudflare (without a real User-Agent) or trip intermittent
// ERR_FAILED under load.
const PRICE_PROXY_URL = '/api/portfolio/prices';
const LP_PROXY_URL = '/api/portfolio/lp';

interface PriceProxyEntry {
  priceUsd: number | null;
  priceChange24h: number | null;
  name: string | null;
  symbol: string | null;
  logoURI: string | null;
}

interface LpProxyEntry {
  pairAddress: string;
  dexId: string | null;
  chainId: ChainId;
  token0: {
    address: string;
    symbol: string;
    name: string;
    reserveFormatted: number;
    priceUsd: number | null;
  };
  token1: {
    address: string;
    symbol: string;
    name: string;
    reserveFormatted: number;
    priceUsd: number | null;
  };
  totalSupplyFormatted: number | null;
  totalLiquidityUsd: number | null;
}

// Known V2-style LP token addresses (PulseChain). Address matching is the
// reliable signal: when Blockscout is down the balances route falls back to
// the curated RPC path, which returns LP balances with no symbol/name — and
// the DexScreener *prices* proxy can't name a *pair* address, so the row's
// symbol stays a truncated address and the symbol/name heuristic below never
// fires. Mirror of the LP entries in
// app/api/portfolio/balances/route.ts → FALLBACK_TOKENS.
const KNOWN_LP_ADDRESSES = new Set<string>([
  '0xb876257c7550010f14a527d2bf8fda9360f8597b', // Morbius/WPLS LP
  '0xdbed78e14e230158ec01e534749bd5ae5ed0816f', // RICH/Morbius LP
  '0xe56043671df55de5cdf8459710433c10324de0ae', // WPLS/DAI LP
  '0x6753560538eca67617a9ce605178f788be7e524e', // WPLS/USDC LP
  '0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9', // HEX/WPLS LP
  '0x322df7921f28f1146cdf62afdac0d6bc0ab80711', // PLSX/WPLS LP
  '0xf1f4ee610b2babb05c635f726ef8b0c568c8dc65', // INC/WPLS LP
]);

// Heuristic match for V2-style PulseX LP tokens. The explorer balance row
// has type === 'ERC-20' (LP tokens are still ERC-20), so we fall back to the
// known-address set plus symbol/name patterns. PLP is PulseX V2, PLT was V1.
function isLpToken(symbol: string, name: string, address: string): boolean {
  if (KNOWN_LP_ADDRESSES.has(address.toLowerCase())) return true;
  const s = symbol.toUpperCase();
  if (s === 'PLP' || s === 'PLT' || s === 'PLP-LP') return true;
  const n = name.toLowerCase();
  if (n.includes('pulsex') && n.includes('lp')) return true;
  return false;
}

function toBalanceFormatted(raw: string, decimals: number): number {
  if (!raw) return 0;
  try {
    const big = BigInt(raw);
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = Number(big / divisor);
    const fraction = Number(big % divisor) / Number(divisor);
    return whole + fraction;
  } catch {
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed / 10 ** decimals : 0;
  }
}

// Server-proxied Blockscout token enumeration. The route returns every
// non-zero balance the wallet holds, plus the basic metadata Blockscout
// already knows (name, symbol, decimals, icon). NFTs are filtered
// upstream. Names / symbols / logos / prices still get enriched
// downstream via the DexScreener prices proxy where Blockscout's data
// is sparse.
interface BlockscoutBalanceItem {
  address: string;
  balanceRaw: string;
  decimals: number;
  symbol?: string;
  name?: string;
  iconUrl?: string;
  isVerified?: boolean;
  exchangeRate?: number | null;
  circulatingMarketCap?: number | null;
  holdersCount?: number | null;
  totalSupplyRaw?: string | null;
  type?: string;
}

async function fetchBlockscoutTokens(
  chain: ChainId,
  walletAddress: string,
): Promise<{ tokens: PortfolioToken[]; error: PortfolioFetchError | null }> {
  const nativeName = chain === 'pulsechain' ? 'Pulse' : 'Ether';
  const nativeSymbol = chain === 'pulsechain' ? 'PLS' : 'ETH';

  let proxyData: {
    tokens?: BlockscoutBalanceItem[];
    nativeBalanceRaw?: string | null;
  } | null = null;
  try {
    const res = await fetch(BALANCES_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: walletAddress, chain }),
    });
    if (res.ok) proxyData = await res.json();
  } catch {
    // proxyData stays null -> "balances unavailable" error below
  }

  const tokens: PortfolioToken[] = [];

  const nativeRaw = proxyData?.nativeBalanceRaw;
  if (nativeRaw && nativeRaw !== '0') {
    tokens.push({
      address: NATIVE_TOKEN_ADDRESS,
      chain,
      name: nativeName,
      symbol: nativeSymbol,
      decimals: 18,
      balance: nativeRaw,
      balanceFormatted: toBalanceFormatted(nativeRaw, 18),
      isNative: true,
    });
  }

  if (!proxyData || !Array.isArray(proxyData.tokens)) {
    return {
      tokens,
      error: {
        chain,
        stage: 'balances',
        message: `${chain === 'pulsechain' ? 'PulseChain' : chain === 'robinhood' ? 'Robinhood' : 'Ethereum'} balances unavailable`,
      },
    };
  }

  // Rank by "looks like a real token" so the top TOKEN_LIMIT_PER_CHAIN
  // we keep are the ones the user actually cares about. Spam ERC-20s
  // typically have no icon, no exchange_rate, no market cap. This is the
  // first cut — the per-wallet "manage tokens" modal also lets users
  // explicitly include/exclude tokens after the fact.
  const ranked = proxyData.tokens
    .filter((t) => t?.address && t.balanceRaw && t.balanceRaw !== '0')
    .map((t) => {
      let quality = 0;
      if (t.iconUrl) quality += 2;
      if (t.exchangeRate != null) quality += 2;
      if (t.circulatingMarketCap != null) quality += 1;
      if (t.holdersCount != null && t.holdersCount > 100) quality += 1;
      if (t.isVerified) quality += 1;
      return { t, quality };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { t } of ranked.slice(0, TOKEN_LIMIT_PER_CHAIN)) {
    const decimals = Number.isFinite(t.decimals) ? t.decimals : 18;
    const short = `${t.address.slice(0, 6)}…${t.address.slice(-4)}`;
    const symbol = t.symbol || short;
    const name = t.name || short;
    tokens.push({
      address: t.address.toLowerCase(),
      chain,
      name,
      symbol,
      decimals,
      balance: t.balanceRaw,
      balanceFormatted: toBalanceFormatted(t.balanceRaw, decimals),
      logoURI: t.iconUrl || undefined,
      // isLp filled later in enrichLpTokens once we know the symbol.
    });
  }

  return { tokens, error: null };
}

function applyPrice(token: PortfolioToken, priceUsd: number, change24h?: number | null): PortfolioToken {
  if (!Number.isFinite(priceUsd) || priceUsd === 0) return token;
  return {
    ...token,
    priceUsd,
    priceChange24h: change24h ?? undefined,
    valueUsd: token.balanceFormatted * priceUsd,
  };
}

async function fetchPriceMap(
  addresses: string[],
): Promise<Record<string, PriceProxyEntry>> {
  if (addresses.length === 0) return {};
  try {
    const res = await fetch(PRICE_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses }),
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { prices?: Record<string, PriceProxyEntry> };
    return data.prices || {};
  } catch {
    return {};
  }
}

async function enrichWithPrices(tokens: PortfolioToken[]): Promise<PortfolioToken[]> {
  const addresses = new Set<string>();
  for (const t of tokens) {
    // Native PLS/ETH aren't tradable as themselves on DEXes; piggy-back on
    // the wrapped equivalent (1 PLS ≡ 1 WPLS, 1 ETH ≡ 1 WETH).
    if (t.isNative) addresses.add(WRAPPED_NATIVE[t.chain]);
    else addresses.add(t.address.toLowerCase());

    // Also include underlying LP sides — when a pair isn't on DexScreener,
    // the LP route returns null prices, but each side is typically still
    // listed as its own token. This gives the breakdown rows real prices
    // and logos.
    if (t.lp) {
      for (const side of t.lp.sides) {
        if (side.address) addresses.add(side.address.toLowerCase());
      }
    }
  }

  const priceMap = await fetchPriceMap([...addresses]);

  const lookupPriceFor = (token: PortfolioToken) =>
    token.isNative
      ? priceMap[WRAPPED_NATIVE[token.chain]]
      : priceMap[token.address.toLowerCase()];

  return tokens.map((t) => {
    const entry = lookupPriceFor(t);

    // Apply names/symbols/logos from the DexScreener proxy. Balances now
    // come from RPC enumeration with placeholder symbol/name (truncated
    // address), so this is where they become human-readable.
    let next: PortfolioToken = t;
    if (entry && !t.isNative) {
      next = {
        ...next,
        name: entry.name || next.name,
        symbol: entry.symbol || next.symbol,
        logoURI: next.logoURI || entry.logoURI || undefined,
      };
    }

    // Then enrich any LP underlying sides. Even if the LP row itself has
    // no DexScreener price, the sides may.
    if (t.lp) {
      const sides = t.lp.sides.map((side) => {
        const sideEntry = priceMap[side.address.toLowerCase()];
        if (!sideEntry) return side;
        const priceUsd = side.priceUsd ?? (sideEntry.priceUsd ?? undefined);
        const valueUsd =
          priceUsd != null ? side.amountFormatted * priceUsd : side.valueUsd;
        const logoURI = side.logoURI ?? sideEntry.logoURI ?? undefined;
        return { ...side, priceUsd, valueUsd, logoURI };
      }) as typeof t.lp.sides;

      // Recompute weights from the now-fully-priced reserves where possible.
      const totalSideValue = sides.reduce(
        (sum, s) => sum + (s.valueUsd ?? 0),
        0,
      );
      const weighted = totalSideValue > 0
        ? (sides.map((s) => ({
            ...s,
            weightPct: s.valueUsd != null
              ? (s.valueUsd / totalSideValue) * 100
              : s.weightPct,
          })) as typeof t.lp.sides)
        : sides;

      // If the LP route didn't have a totalLiquidityUsd or userValueUsd,
      // derive them from the now-priced sides.
      const userValueUsd =
        t.lp.userValueUsd ?? (weighted[0].valueUsd ?? 0) + (weighted[1].valueUsd ?? 0);

      next = {
        ...t,
        lp: { ...t.lp, sides: weighted, userValueUsd },
        valueUsd: t.valueUsd ?? userValueUsd ?? undefined,
      };
    }

    if (!entry || entry.priceUsd == null) return next;

    // Then price the LP-or-regular token row itself.
    next = applyPrice(next, entry.priceUsd, entry.priceChange24h ?? undefined);
    if (t.isNative && !next.logoURI && entry.logoURI) {
      next = { ...next, logoURI: entry.logoURI };
    }
    return next;
  });
}

async function fetchLpMap(
  chain: ChainId,
  addresses: string[],
): Promise<Record<string, LpProxyEntry>> {
  if (addresses.length === 0) return {};
  try {
    const res = await fetch(LP_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chain, addresses }),
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { lps?: Record<string, LpProxyEntry | null> };
    const out: Record<string, LpProxyEntry> = {};
    for (const [addr, info] of Object.entries(data.lps || {})) {
      if (info) out[addr] = info;
    }
    return out;
  } catch {
    return {};
  }
}

function computeLpBreakdown(
  token: PortfolioToken,
  info: LpProxyEntry,
): LpBreakdown | null {
  if (!info.totalSupplyFormatted || info.totalSupplyFormatted === 0) return null;
  const userShare = token.balanceFormatted / info.totalSupplyFormatted;
  const userValueUsd = info.totalLiquidityUsd != null
    ? userShare * info.totalLiquidityUsd
    : undefined;

  const make = (side: LpProxyEntry['token0']): LpUnderlying => {
    const amountFormatted = userShare * side.reserveFormatted;
    const valueUsd =
      side.priceUsd != null ? amountFormatted * side.priceUsd : undefined;
    const sideValue =
      side.priceUsd != null ? side.reserveFormatted * side.priceUsd : null;
    const totalSidesValue =
      (info.token0.priceUsd != null
        ? info.token0.reserveFormatted * info.token0.priceUsd
        : 0) +
      (info.token1.priceUsd != null
        ? info.token1.reserveFormatted * info.token1.priceUsd
        : 0);
    const weightPct =
      sideValue != null && totalSidesValue > 0
        ? (sideValue / totalSidesValue) * 100
        : 50;
    return {
      address: side.address,
      symbol: side.symbol,
      name: side.name,
      amountFormatted,
      priceUsd: side.priceUsd ?? undefined,
      valueUsd,
      weightPct,
    };
  };

  return {
    pairAddress: info.pairAddress,
    dexId: info.dexId ?? undefined,
    totalSupply: info.totalSupplyFormatted,
    userShare,
    totalLiquidityUsd: info.totalLiquidityUsd ?? undefined,
    userValueUsd,
    sides: [make(info.token0), make(info.token1)],
  };
}

async function enrichLpTokens(tokens: PortfolioToken[]): Promise<PortfolioToken[]> {
  // Group LP addresses per chain — only PulseChain is wired up today but the
  // signature is chain-aware so adding Ethereum later is mechanical.
  const lpAddrsByChain = new Map<ChainId, Set<string>>();
  for (const t of tokens) {
    if (!t.isLp) continue;
    let set = lpAddrsByChain.get(t.chain);
    if (!set) {
      set = new Set();
      lpAddrsByChain.set(t.chain, set);
    }
    set.add(t.address.toLowerCase());
  }
  if (lpAddrsByChain.size === 0) return tokens;

  const lpMaps = await Promise.all(
    [...lpAddrsByChain.entries()].map(async ([chain, set]) => {
      const map = await fetchLpMap(chain, [...set]);
      return [chain, map] as const;
    }),
  );
  const byChain: Record<string, Record<string, LpProxyEntry>> = {};
  for (const [chain, map] of lpMaps) byChain[chain] = map;

  return tokens.map((t) => {
    if (!t.isLp) return t;
    const info = byChain[t.chain]?.[t.address.toLowerCase()];
    if (!info) return t;
    const breakdown = computeLpBreakdown(t, info);
    if (!breakdown) return t;

    // When the balances fetch couldn't name the LP — the RPC-fallback path
    // strips symbol/name, and DexScreener can't name a pair address — the
    // row's symbol is a truncated address like "0xdbed…816f". Now that the
    // underlying sides are resolved, relabel it "RICH/Morbius LP".
    const [a, b] = breakdown.sides;
    const sidesNamed = ![a.symbol, b.symbol].some(
      (s) => !s || s === '???' || s === 'token0' || s === 'token1',
    );
    const relabel = t.symbol.includes('…') && sidesNamed;

    return {
      ...t,
      symbol: relabel ? `${a.symbol}/${b.symbol} LP` : t.symbol,
      name: relabel ? 'PulseX LP' : t.name,
      lp: breakdown,
      // If the LP itself has no DexScreener price (most don't), use the
      // user's underlying value as the row's valueUsd so sorting works.
      valueUsd: t.valueUsd ?? breakdown.userValueUsd,
    };
  });
}

async function resolveMissingIcons(tokens: PortfolioToken[]): Promise<PortfolioToken[]> {
  return Promise.all(
    tokens.map(async (t) => {
      if (t.logoURI) return t;
      const resolved = await resolveTokenIcon(t.address, t.chain);
      return resolved ? { ...t, logoURI: resolved } : t;
    }),
  );
}

class PortfolioService {
  async getPortfolio(
    walletAddress: string,
    chains: ChainId[] = ['ethereum', 'pulsechain', 'robinhood'],
  ): Promise<ApiResponse<PortfolioSnapshot>> {
    try {
      validateAddress(walletAddress);
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }

    const fetchers: Promise<{ tokens: PortfolioToken[]; error: PortfolioFetchError | null }>[] = [];
    if (chains.includes('pulsechain')) fetchers.push(fetchBlockscoutTokens('pulsechain', walletAddress));
    if (chains.includes('ethereum')) fetchers.push(fetchBlockscoutTokens('ethereum', walletAddress));
    if (chains.includes('robinhood')) fetchers.push(fetchBlockscoutTokens('robinhood', walletAddress));

    const results = await Promise.allSettled(fetchers);
    const tokens: PortfolioToken[] = [];
    const errors: PortfolioFetchError[] = [];

    for (const r of results) {
      if (r.status === 'fulfilled') {
        tokens.push(...r.value.tokens);
        if (r.value.error) errors.push(r.value.error);
      } else {
        errors.push({
          chain: 'pulsechain',
          stage: 'balances',
          message: r.reason?.message || 'Unknown fetch failure',
        });
      }
    }

    // Balances now come from /api/portfolio/balances (RPC eth_getLogs +
    // batched balanceOf) without any name/symbol/logo, so prices must run
    // first to make rows human-readable. LP detection then keys on the
    // freshly-fetched symbol/name. If any LPs were found, run prices a
    // second time to enrich the underlying side addresses; this call is
    // mostly served from the proxy's 60s cache.
    const priced = await enrichWithPrices(tokens);
    const flagged = priced.map((t) =>
      !t.isNative && isLpToken(t.symbol, t.name, t.address) ? { ...t, isLp: true } : t,
    );
    const hasLp = flagged.some((t) => t.isLp);
    const withLp = hasLp ? await enrichLpTokens(flagged) : flagged;
    const final = hasLp ? await enrichWithPrices(withLp) : flagged;
    const withIcons = await resolveMissingIcons(final);

    withIcons.sort((a, b) => {
      const av = a.valueUsd ?? 0;
      const bv = b.valueUsd ?? 0;
      if (av !== bv) return bv - av;
      return b.balanceFormatted - a.balanceFormatted;
    });

    const totalValueUsd = withIcons.reduce((sum, t) => sum + (t.valueUsd ?? 0), 0);

    return {
      success: true,
      data: {
        walletAddress: walletAddress.toLowerCase(),
        tokens: withIcons,
        totalValueUsd,
        fetchedAt: Date.now(),
        errors,
      },
    };
  }

}

export const portfolioService = new PortfolioService();
