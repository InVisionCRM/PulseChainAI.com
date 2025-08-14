
import {
  ensureCoreCaches,
  ensureTransfers24h,
  formatNumber2,
  formatTokenAmount2,
} from './utils';
import { StatConfig, StatResult } from './index';

// Total Transfers
export const transfersTotalStat = {
  id: 'transfersTotal',
  name: 'Total Transfers',
  description: 'The total number of transfers for the token.',
  enabled: true,
  format: 'number' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { tokenCounters } = await ensureCoreCaches(tokenAddress);
    const count = Number(tokenCounters?.transfers_count ?? 0);
    return {
      value: count,
      formattedValue: formatNumber2(count),
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'transfersTotal',
    name: 'Total Transfers',
    description: 'The total number of transfers for the token.',
    enabled: true,
    format: 'number',
  }),
};

// Transfers 24h
export const transfers24hStat = {
  id: 'transfers24h',
  name: 'Transfers (24h)',
  description: 'The number of transfers in the last 24 hours.',
  enabled: true,
  format: 'number' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const count = (await ensureTransfers24h(tokenAddress)).length;
    return {
      value: count,
      formattedValue: formatNumber2(count),
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'transfers24h',
    name: 'Transfers (24h)',
    description: 'The number of transfers in the last 24 hours.',
    enabled: true,
    format: 'number',
  }),
};
