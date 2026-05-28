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

// Both chains have a Blockscout instance with the same API surface, so
// we can fetch ERC-20/PRC-20 wallet balances + the native coin balance
// the same way for either. No Moralis, no API key. The previous Moralis
// path required MORALIS_API_KEY which only works server-side, and that
// asymmetry showed up to users as an "ETHEREUM Moralis unavailable"
// banner whenever they tracked an ETH wallet.
const BLOCKSCOUT_BASE: Record<ChainId, string> = {
  pulsechain: 'https://api.scan.pulsechain.com/api/v2',
  ethereum: 'https://eth.blockscout.com/api/v2',
};

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

// Heuristic match for V2-style PulseX LP tokens. The explorer balance row
// has type === 'ERC-20' (LP tokens are still ERC-20), so we have to fall
// back to symbol/name patterns. PLP is PulseX V2, PLT was V1.
function isLpToken(symbol: string, name: string): boolean {
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

// Single Blockscout-shaped fetcher that works for both chains. Returns
// the user's native balance via the address-info endpoint and the ERC-20
// balances via the token-balances endpoint — the two are called in
// parallel since they don't depend on each other.
async function fetchBlockscoutTokens(
  chain: ChainId,
  walletAddress: string,
): Promise<{ tokens: PortfolioToken[]; error: PortfolioFetchError | null }> {
  const base = BLOCKSCOUT_BASE[chain];
  const nativeName = chain === 'pulsechain' ? 'Pulse' : 'Ether';
  const nativeSymbol = chain === 'pulsechain' ? 'PLS' : 'ETH';

  const [balancesRes, infoRes] = await Promise.allSettled([
    fetch(`${base}/addresses/${walletAddress}/token-balances`),
    fetch(`${base}/addresses/${walletAddress}`),
  ]);

  const tokens: PortfolioToken[] = [];

  if (infoRes.status === 'fulfilled' && infoRes.value.ok) {
    try {
      const info = await infoRes.value.json();
      const coinRaw = String(info?.coin_balance || '0');
      if (coinRaw !== '0' && coinRaw !== '') {
        tokens.push({
          address: NATIVE_TOKEN_ADDRESS,
          chain,
          name: nativeName,
          symbol: nativeSymbol,
          decimals: 18,
          balance: coinRaw,
          balanceFormatted: toBalanceFormatted(coinRaw, 18),
          isNative: true,
        });
      }
    } catch {
      // best-effort — fall through with whatever we have
    }
  }

  if (balancesRes.status !== 'fulfilled' || !balancesRes.value.ok) {
    return {
      tokens,
      error: {
        chain,
        stage: 'balances',
        message: `${chain === 'pulsechain' ? 'PulseChain' : 'Ethereum'} balances unavailable`,
      },
    };
  }

  let data: any;
  try {
    data = await balancesRes.value.json();
  } catch {
    return {
      tokens,
      error: {
        chain,
        stage: 'balances',
        message: 'Balance response was not JSON',
      },
    };
  }

  const items: any[] = Array.isArray(data) ? data : data.items || [];

  // Normalise every item, drop zero balances, then rank by "looks like a
  // real token" so the top TOKEN_LIMIT_PER_CHAIN we keep are the ones the
  // user actually cares about. Spam ERC-20s typically have no icon, no
  // exchange_rate, and no market cap.
  const candidates = items
    .map((item): { token: PortfolioToken; quality: number } | null => {
      const t = item.token || {};
      // PulseScan uses `address`, eth.blockscout uses `address_hash`.
      const tokenAddress: string | undefined =
        t.address || t.address_hash || item.contractAddress;
      if (!tokenAddress) return null;

      const decimalsRaw = t.decimals ?? item.decimals ?? 18;
      const decimals = typeof decimalsRaw === 'string' ? parseInt(decimalsRaw, 10) : decimalsRaw;
      const balance = String(item.value ?? item.balance ?? '0');
      if (balance === '0' || balance === '') return null;

      const finalDecimals = Number.isFinite(decimals) ? decimals : 18;
      const symbol = t.symbol || '???';
      const name = t.name || 'Unknown';

      // Quality score: explorer-derived signals only, no network calls.
      let quality = 0;
      if (t.icon_url) quality += 2;
      if (t.exchange_rate != null) quality += 2;
      if (t.circulating_market_cap != null) quality += 1;
      if (t.holders_count != null && Number(t.holders_count) > 100) quality += 1;

      return {
        token: {
          address: tokenAddress.toLowerCase(),
          chain,
          name,
          symbol,
          decimals: finalDecimals,
          balance,
          balanceFormatted: toBalanceFormatted(balance, finalDecimals),
          logoURI: t.icon_url || undefined,
          isLp: chain === 'pulsechain' ? isLpToken(symbol, name) : false,
        },
        quality,
      };
    })
    .filter((x): x is { token: PortfolioToken; quality: number } => x !== null)
    .sort((a, b) => b.quality - a.quality);

  for (const { token } of candidates.slice(0, TOKEN_LIMIT_PER_CHAIN)) {
    tokens.push(token);
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

    // First, enrich the LP underlying sides if any. Even if the LP row
    // itself has no DexScreener price, the sides may.
    let next: PortfolioToken = t;
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
    return {
      ...t,
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
    chains: ChainId[] = ['ethereum', 'pulsechain'],
  ): Promise<ApiResponse<PortfolioSnapshot>> {
    try {
      validateAddress(walletAddress);
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }

    const fetchers: Promise<{ tokens: PortfolioToken[]; error: PortfolioFetchError | null }>[] = [];
    if (chains.includes('pulsechain')) fetchers.push(fetchBlockscoutTokens('pulsechain', walletAddress));
    if (chains.includes('ethereum')) fetchers.push(fetchBlockscoutTokens('ethereum', walletAddress));

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

    // Order matters: detect LP breakdowns first so enrichWithPrices can
    // include the LP underlying token addresses in its proxy call, fixing
    // both missing prices and missing logos on the sub-rows.
    const withLp = await enrichLpTokens(tokens);
    const priced = await enrichWithPrices(withLp);
    const withIcons = await resolveMissingIcons(priced);

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
