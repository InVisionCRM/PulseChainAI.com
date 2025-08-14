
import {
  ensureCoreCaches,
  ensureHolders,
  ensureTransfers24h,
  formatTokenAmount2,
  formatNumber2,
  formatPct2,
  DEAD_ADDRESS,
} from './utils';
import { StatConfig, StatResult } from './index';

// Total Supply
export const totalSupplyStat = {
  id: 'totalSupply',
  name: 'Total Supply',
  description: 'The total amount of tokens in existence.',
  enabled: true,
  format: 'number' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { tokenInfo } = await ensureCoreCaches(tokenAddress);
    const raw = Number(tokenInfo?.total_supply ?? 0);
    const decimals = Number(tokenInfo?.decimals ?? 18);
    return {
      value: raw,
      formattedValue: formatTokenAmount2(raw, decimals),
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'totalSupply',
    name: 'Total Supply',
    description: 'The total amount of tokens in existence.',
    enabled: true,
    format: 'number',
  }),
};

// Total Holders
export const holdersStat = {
  id: 'holders',
  name: 'Total Holders',
  description: 'The total number of unique addresses that hold the token.',
  enabled: true,
  format: 'number' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { tokenCounters, tokenInfo } = await ensureCoreCaches(tokenAddress);
    const count = Number(tokenCounters?.token_holders_count ?? tokenInfo?.holders ?? 0);
    return {
      value: count,
      formattedValue: formatNumber2(count),
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'holders',
    name: 'Total Holders',
    description: 'The total number of unique addresses that hold the token.',
    enabled: true,
    format: 'number',
  }),
};

// Total Burned
export const burnedTotalStat = {
  id: 'burnedTotal',
  name: 'Total Burned',
  description: 'The total amount of tokens that have been sent to the burn address.',
  enabled: true,
  format: 'number' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { tokenInfo } = await ensureCoreCaches(tokenAddress);
    const decimals = Number(tokenInfo?.decimals ?? 18);
    const holders = await ensureHolders(tokenAddress);
    const dead = holders.find(h => h.hash.toLowerCase() === DEAD_ADDRESS)?.value || '0';
    const rawNum = Number(dead);
    const totalSupply = Number(tokenInfo?.total_supply ?? 0);
    const pct = totalSupply ? (rawNum / totalSupply) * 100 : 0;
    return {
      value: {
        raw: rawNum,
        formatted: formatTokenAmount2(rawNum, decimals),
        percent: pct,
        percentFormatted: formatPct2(pct),
      },
      formattedValue: `${formatTokenAmount2(rawNum, decimals)} (${formatPct2(pct)})`,
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'burnedTotal',
    name: 'Total Burned',
    description: 'The total amount of tokens that have been sent to the burn address.',
    enabled: true,
    format: 'number',
  }),
};

// Burned 24h
export const burned24hStat = {
  id: 'burned24h',
  name: 'Burned (24h)',
  description: 'The amount of tokens that have been sent to the burn address in the last 24 hours.',
  enabled: true,
  format: 'number' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { tokenInfo } = await ensureCoreCaches(tokenAddress);
    const totalSupply = Number(tokenInfo?.total_supply ?? 0);
    const sum = (await ensureTransfers24h(tokenAddress))
      .filter(t => (t.to?.hash || '').toLowerCase() === DEAD_ADDRESS)
      .reduce((s, t) => s + Number(t.total?.value || 0), 0);
    const pct = totalSupply ? (sum / totalSupply) * 100 : 0;
    const decimals = Number(tokenInfo?.decimals ?? 18);
    return {
      value: {
        raw: sum,
        formatted: formatTokenAmount2(sum, decimals),
        percent: pct,
        percentFormatted: formatPct2(pct),
      },
      formattedValue: `${formatTokenAmount2(sum, decimals)} (${formatPct2(pct)})`,
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'burned24h',
    name: 'Burned (24h)',
    description: 'The amount of tokens that have been sent to the burn address in the last 24 hours.',
    enabled: true,
    format: 'number',
  }),
};

// Minted 24h
export const minted24hStat = {
  id: 'minted24h',
  name: 'Minted (24h)',
  description: 'The amount of tokens that have been minted in the last 24 hours.',
  enabled: true,
  format: 'number' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { tokenInfo } = await ensureCoreCaches(tokenAddress);
    const decimals = Number(tokenInfo?.decimals ?? 18);
    const sum = (await ensureTransfers24h(tokenAddress))
      .filter(t => (t.from?.hash || '').toLowerCase() === tokenAddress.toLowerCase())
      .reduce((s, t) => s + Number(t.total?.value || 0), 0);
    return {
      value: sum,
      formattedValue: formatTokenAmount2(sum, decimals),
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'minted24h',
    name: 'Minted (24h)',
    description: 'The amount of tokens that have been minted in the last 24 hours.',
    enabled: true,
    format: 'number',
  }),
};
