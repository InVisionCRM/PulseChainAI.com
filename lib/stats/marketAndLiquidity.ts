
import {
  ensureCoreCaches,
  ensureDex,
  formatPct2,
  formatNumber2,
  formatTokenAmount2,
} from './utils';
import { StatConfig, StatResult } from './index';

// Price USD
export const priceUsdStat = {
  id: 'priceUsd',
  name: 'Price (USD)',
  description: 'The current price of the token in USD.',
  enabled: true,
  format: 'currency' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const dex = await ensureDex(tokenAddress);
    const price = dex?.pairs?.[0]?.priceUsd;
    return {
      value: price,
      formattedValue: price ? `$${formatNumber2(price)}` : 'N/A',
      lastUpdated: new Date(),
      source: 'dexscreener',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'priceUsd',
    name: 'Price (USD)',
    description: 'The current price of the token in USD.',
    enabled: true,
    format: 'currency',
    prefix: '$',
  }),
};

// Liquidity USD
export const liquidityUsdStat = {
  id: 'liquidityUsd',
  name: 'Liquidity (USD)',
  description: 'The total liquidity of the token in USD.',
  enabled: true,
  format: 'currency' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const dex = await ensureDex(tokenAddress);
    const p = dex?.pairs?.[0];
    const usd = Number(p?.liquidity?.usd || 0);
    return {
      value: usd,
      formattedValue: `$${formatNumber2(usd)}`,
      lastUpdated: new Date(),
      source: 'dexscreener',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'liquidityUsd',
    name: 'Liquidity (USD)',
    description: 'The total liquidity of the token in USD.',
    enabled: true,
    format: 'currency',
    prefix: '$',
  }),
};

// Total Liquidity USD
export const totalLiquidityUsdStat = {
  id: 'totalLiquidityUsd',
  name: 'Total Liquidity (USD)',
  description: 'The total liquidity of the token across all pairs in USD.',
  enabled: true,
  format: 'currency' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const dex = await ensureDex(tokenAddress);
    const pairs = dex?.pairs || [];
    const totalUsd = pairs.reduce((s: number, x: any) => s + Number(x?.liquidity?.usd || 0), 0);
    return {
      value: totalUsd,
      formattedValue: `$${formatNumber2(totalUsd)}`,
      lastUpdated: new Date(),
      source: 'dexscreener',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'totalLiquidityUsd',
    name: 'Total Liquidity (USD)',
    description: 'The total liquidity of the token across all pairs in USD.',
    enabled: true,
    format: 'currency',
    prefix: '$',
  }),
};

// Total Tokens in Liquidity
export const totalTokensInLiquidityStat = {
  id: 'totalTokensInLiquidity',
  name: 'Total Tokens in Liquidity',
  description: 'The total amount of tokens in liquidity pools.',
  enabled: true,
  format: 'number' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const dex = await ensureDex(tokenAddress);
    const { tokenInfo } = await ensureCoreCaches(tokenAddress);
    const decimals = Number(tokenInfo?.decimals ?? 18);
    const pairs = dex?.pairs || [];
    const totalBase = pairs.reduce((s: number, x: any) => s + Number(x?.liquidity?.base || 0), 0);
    return {
      value: totalBase,
      formattedValue: formatTokenAmount2(totalBase, decimals),
      lastUpdated: new Date(),
      source: 'dexscreener',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'totalTokensInLiquidity',
    name: 'Total Tokens in Liquidity',
    description: 'The total amount of tokens in liquidity pools.',
    enabled: true,
    format: 'number',
  }),
};
