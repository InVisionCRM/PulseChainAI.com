
import {
  ensureCoreCaches,
  ensureHolders,
  formatPct2,
  formatNumber2,
  formatTokenAmount2,
} from './utils';
import { StatConfig, StatResult } from './index';

// Top 1% Holdings
export const top1PctStat = {
  id: 'top1Pct',
  name: 'Top 1% Holdings',
  description: 'The percentage of the total supply held by the top 1% of holders.',
  enabled: true,
  format: 'percentage' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { tokenInfo } = await ensureCoreCaches(tokenAddress);
    const total = Number(tokenInfo?.total_supply ?? 0);
    const holders = await ensureHolders(tokenAddress);
    const sum = holders.sort((a,b)=>Number(b.value)-Number(a.value)).slice(0,1).reduce((s,x)=>s+Number(x.value),0);
    const pct = total ? (sum/total)*100 : 0;
    return {
      value: pct,
      formattedValue: formatPct2(pct),
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'top1Pct',
    name: 'Top 1% Holdings',
    description: 'The percentage of the total supply held by the top 1% of holders.',
    enabled: true,
    format: 'percentage',
  }),
};

// Top 10% Holdings
export const top10PctStat = {
  id: 'top10Pct',
  name: 'Top 10% Holdings',
  description: 'The percentage of the total supply held by the top 10% of holders.',
  enabled: true,
  format: 'percentage' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { tokenInfo } = await ensureCoreCaches(tokenAddress);
    const total = Number(tokenInfo?.total_supply ?? 0);
    const holders = await ensureHolders(tokenAddress);
    const sum = holders.sort((a,b)=>Number(b.value)-Number(a.value)).slice(0,10).reduce((s,x)=>s+Number(x.value),0);
    const pct = total ? (sum/total)*100 : 0;
    return {
      value: pct,
      formattedValue: formatPct2(pct),
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'top10Pct',
    name: 'Top 10% Holdings',
    description: 'The percentage of the total supply held by the top 10% of holders.',
    enabled: true,
    format: 'percentage',
  }),
};

// Top 20% Holdings
export const top20PctStat = {
  id: 'top20Pct',
  name: 'Top 20% Holdings',
  description: 'The percentage of the total supply held by the top 20% of holders.',
  enabled: true,
  format: 'percentage' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { tokenInfo } = await ensureCoreCaches(tokenAddress);
    const total = Number(tokenInfo?.total_supply ?? 0);
    const holders = await ensureHolders(tokenAddress);
    const sum = holders.sort((a,b)=>Number(b.value)-Number(a.value)).slice(0,20).reduce((s,x)=>s+Number(x.value),0);
    const pct = total ? (sum/total)*100 : 0;
    return {
      value: pct,
      formattedValue: formatPct2(pct),
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'top20Pct',
    name: 'Top 20% Holdings',
    description: 'The percentage of the total supply held by the top 20% of holders.',
    enabled: true,
    format: 'percentage',
  }),
};

// Top 50% Holdings
export const top50PctStat = {
  id: 'top50Pct',
  name: 'Top 50% Holdings',
  description: 'The percentage of the total supply held by the top 50% of holders.',
  enabled: true,
  format: 'percentage' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { tokenInfo } = await ensureCoreCaches(tokenAddress);
    const total = Number(tokenInfo?.total_supply ?? 0);
    const holders = await ensureHolders(tokenAddress);
    const sum = holders.sort((a,b)=>Number(b.value)-Number(a.value)).slice(0,50).reduce((s,x)=>s+Number(x.value),0);
    const pct = total ? (sum/total)*100 : 0;
    return {
      value: pct,
      formattedValue: formatPct2(pct),
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'top50Pct',
    name: 'Top 50% Holdings',
    description: 'The percentage of the total supply held by the top 50% of holders.',
    enabled: true,
    format: 'percentage',
  }),
};

// Whale Count 1%
export const whaleCount1PctStat = {
  id: 'whaleCount1Pct',
  name: 'Whale Count (1%)',
  description: 'The number of holders that own more than 1% of the total supply.',
  enabled: true,
  format: 'number' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { tokenInfo } = await ensureCoreCaches(tokenAddress);
    const total = Number(tokenInfo?.total_supply ?? 0);
    const threshold = total * 0.01;
    const holders = await ensureHolders(tokenAddress);
    const count = holders.filter(h => Number(h.value) >= threshold).length;
    return {
      value: count,
      formattedValue: formatNumber2(count),
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'whaleCount1Pct',
    name: 'Whale Count (1%)',
    description: 'The number of holders that own more than 1% of the total supply.',
    enabled: true,
    format: 'number',
  }),
};
