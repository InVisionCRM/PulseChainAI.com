// Portfolio aggregator — given a wallet address and a list of chains,
// fetches balances per chain in parallel, normalises into PortfolioToken[],
// enriches with DexScreener prices (batched, cached), and returns a unified
// snapshot. Per-chain failures degrade gracefully into the errors array on
// the snapshot so the UI can show partial data.

import { pulsechainApi } from '../blockchain/pulsechainApi';
import { moralisApi } from '../blockchain/moralisApi';
import { validateAddress } from '../core/errors';
import { CHAIN_MORALIS_ID } from '../core/types';
import { resolveTokenIcon } from '../../lib/services/token-icon-resolver';
import type {
  ApiResponse,
  ChainId,
  PortfolioFetchError,
  PortfolioSnapshot,
  PortfolioToken,
} from '../core/types';

// Server-side price proxy — see app/api/portfolio/prices/route.ts.
// We call this once per portfolio refresh with the full token-address list
// instead of hammering DexScreener with one fetch-per-token from the browser
// (which trips intermittent ERR_FAILED in the network panel and shows as
// missing prices in the UI).
const PRICE_PROXY_URL = '/api/portfolio/prices';

interface PriceProxyEntry {
  priceUsd: number | null;
  priceChange24h: number | null;
  name: string | null;
  symbol: string | null;
  logoURI: string | null;
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

async function fetchPulseChainTokens(
  walletAddress: string,
): Promise<{ tokens: PortfolioToken[]; error: PortfolioFetchError | null }> {
  const resp = await pulsechainApi.getAddressTokenBalances(walletAddress);
  if (!resp.success || !resp.data) {
    return {
      tokens: [],
      error: {
        chain: 'pulsechain',
        stage: 'balances',
        message: resp.error || 'PulseChain balances unavailable',
      },
    };
  }

  const items = Array.isArray(resp.data) ? resp.data : resp.data.items || [];
  const tokens: PortfolioToken[] = items
    .map((item: any): PortfolioToken | null => {
      const tokenAddress = item.token?.address || item.contractAddress;
      if (!tokenAddress) return null;
      const decimalsRaw = item.token?.decimals ?? item.decimals ?? 18;
      const decimals = typeof decimalsRaw === 'string' ? parseInt(decimalsRaw, 10) : decimalsRaw;
      const balance = String(item.value ?? item.balance ?? '0');
      if (balance === '0' || balance === '') return null;
      return {
        address: tokenAddress.toLowerCase(),
        chain: 'pulsechain',
        name: item.token?.name || 'Unknown',
        symbol: item.token?.symbol || '???',
        decimals: Number.isFinite(decimals) ? decimals : 18,
        balance,
        balanceFormatted: toBalanceFormatted(balance, Number.isFinite(decimals) ? decimals : 18),
        logoURI: item.token?.icon_url || undefined,
      };
    })
    .filter((t): t is PortfolioToken => t !== null);

  return { tokens, error: null };
}

async function fetchEthereumTokens(
  walletAddress: string,
): Promise<{ tokens: PortfolioToken[]; error: PortfolioFetchError | null }> {
  if (!moralisApi.isAvailable()) {
    const ok = await moralisApi.initialize();
    if (!ok) {
      return {
        tokens: [],
        error: {
          chain: 'ethereum',
          stage: 'balances',
          message: 'Moralis unavailable — set MORALIS_API_KEY',
        },
      };
    }
  }

  const resp = await moralisApi.getWalletTokenBalances(walletAddress, CHAIN_MORALIS_ID.ethereum);
  if (!resp.success || !resp.data) {
    return {
      tokens: [],
      error: {
        chain: 'ethereum',
        stage: 'balances',
        message: resp.error || 'Moralis balances unavailable',
      },
    };
  }

  const tokens: PortfolioToken[] = resp.data
    .map((bal): PortfolioToken | null => {
      const tokenAddress = bal.token?.address;
      if (!tokenAddress) return null;
      const decimals = bal.token?.decimals ?? 18;
      const balance = String(bal.value ?? '0');
      if (balance === '0' || balance === '') return null;
      return {
        address: tokenAddress.toLowerCase(),
        chain: 'ethereum',
        name: bal.token?.name || 'Unknown',
        symbol: bal.token?.symbol || '???',
        decimals,
        balance,
        balanceFormatted: toBalanceFormatted(balance, decimals),
        logoURI: (bal.token as any)?.icon_url || (bal.token as any)?.logo || undefined,
      };
    })
    .filter((t): t is PortfolioToken => t !== null);

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
  const addresses = Array.from(
    new Set(tokens.map((t) => t.address.toLowerCase())),
  );
  const priceMap = await fetchPriceMap(addresses);
  return tokens.map((t) => {
    const entry = priceMap[t.address.toLowerCase()];
    if (!entry || entry.priceUsd == null) return t;
    return applyPrice(t, entry.priceUsd, entry.priceChange24h ?? undefined);
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
    if (chains.includes('pulsechain')) fetchers.push(fetchPulseChainTokens(walletAddress));
    if (chains.includes('ethereum')) fetchers.push(fetchEthereumTokens(walletAddress));

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

    const priced = await enrichWithPrices(tokens);
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
