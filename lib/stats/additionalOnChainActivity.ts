
import {
  ensureCoreCaches,
  ensureTransfers24h,
  formatNumber2,
  formatTokenAmount2,
  formatPct2,
  DEAD_ADDRESS,
  ensureHolders,
} from './utils';
import { StatConfig, StatResult } from './index';

// Unique Senders 24h
export const uniqueSenders24hStat = {
  id: 'uniqueSenders24h',
  name: 'Unique Senders (24h)',
  description: 'The number of unique senders in the last 24 hours.',
  enabled: true,
  format: 'number' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const count = new Set((await ensureTransfers24h(tokenAddress)).map(t => (t.from?.hash || '').toLowerCase())).size;
    return {
      value: count,
      formattedValue: formatNumber2(count),
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'uniqueSenders24h',
    name: 'Unique Senders (24h)',
    description: 'The number of unique senders in the last 24 hours.',
    enabled: true,
    format: 'number',
  }),
};

// Unique Receivers 24h
export const uniqueReceivers24hStat = {
  id: 'uniqueReceivers24h',
  name: 'Unique Receivers (24h)',
  description: 'The number of unique receivers in the last 24 hours.',
  enabled: true,
  format: 'number' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const count = new Set((await ensureTransfers24h(tokenAddress)).map(t => (t.to?.hash || '').toLowerCase())).size;
    return {
      value: count,
      formattedValue: formatNumber2(count),
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'uniqueReceivers24h',
    name: 'Unique Receivers (24h)',
    description: 'The number of unique receivers in the last 24 hours.',
    enabled: true,
    format: 'number',
  }),
};

// Average Transfer Value 24h
export const avgTransferValue24hStat = {
  id: 'avgTransferValue24h',
  name: 'Average Transfer Value (24h)',
  description: 'The average value of transfers in the last 24 hours.',
  enabled: true,
  format: 'number' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { tokenInfo } = await ensureCoreCaches(tokenAddress);
    const decimals = Number(tokenInfo?.decimals ?? 18);
    const vals = (await ensureTransfers24h(tokenAddress)).map(t => Number(t.total?.value || 0));
    const avg = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
    return {
      value: avg,
      formattedValue: formatTokenAmount2(avg, decimals),
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'avgTransferValue24h',
    name: 'Average Transfer Value (24h)',
    description: 'The average value of transfers in the last 24 hours.',
    enabled: true,
    format: 'number',
  }),
};

// Median Transfer Value 24h
export const medianTransferValue24hStat = {
  id: 'medianTransferValue24h',
  name: 'Median Transfer Value (24h)',
  description: 'The median value of transfers in the last 24 hours.',
  enabled: true,
  format: 'number' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { tokenInfo } = await ensureCoreCaches(tokenAddress);
    const decimals = Number(tokenInfo?.decimals ?? 18);
    const vals = (await ensureTransfers24h(tokenAddress)).map(t => Number(t.total?.value || 0)).sort((a,b)=>a-b);
    const median = vals.length ? vals[Math.floor(vals.length/2)] : 0;
    return {
      value: median,
      formattedValue: formatTokenAmount2(median, decimals),
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'medianTransferValue24h',
    name: 'Median Transfer Value (24h)',
    description: 'The median value of transfers in the last 24 hours.',
    enabled: true,
    format: 'number',
  }),
};

// Transaction Velocity 24h
export const transactionVelocityStat = {
  id: 'transactionVelocity',
  name: 'Transaction Velocity (24h)',
  description: 'The ratio of transfer volume to circulating supply in the last 24 hours.',
  enabled: true,
  format: 'percentage' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const transfers = await ensureTransfers24h(tokenAddress);
    const { tokenInfo } = await ensureCoreCaches(tokenAddress);
    const holders = await ensureHolders(tokenAddress);
    const dead = holders.find(h => h.hash.toLowerCase() === DEAD_ADDRESS)?.value || '0';
    const circulatingSupply = Number(tokenInfo.total_supply) - Number(dead);

    if (circulatingSupply === 0) return { value: 0, formattedValue: '0%', lastUpdated: new Date(), source: 'pulsechain' };

    const transferVolume = transfers.reduce((sum, t) => sum + Number(t.total.value), 0);
    const velocity = transferVolume / circulatingSupply;
    return {
      value: velocity,
      formattedValue: formatPct2(velocity * 100),
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'transactionVelocity',
    name: 'Transaction Velocity (24h)',
    description: 'The ratio of transfer volume to circulating supply in the last 24 hours.',
    enabled: true,
    format: 'percentage',
  }),
};
