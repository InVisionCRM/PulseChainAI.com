
import {
  ensureCoreCaches,
  ensureHolders,
  getTransfersLastNDays,
  formatTokenAmount2,
  DEAD_ADDRESS,
} from './utils';
import { StatConfig, StatResult } from './index';

// Top 50 Holders
export const top50HoldersStat = {
  id: 'top50Holders',
  name: 'Top 50 Holders',
  description: 'The top 50 holders of the token.',
  enabled: true,
  format: 'text' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { tokenInfo } = await ensureCoreCaches(tokenAddress);
    const totalSupply = Number(tokenInfo?.total_supply ?? 0);
    const decimals = Number(tokenInfo?.decimals ?? 18);
    const holders = await ensureHolders(tokenAddress);

    const sortedHolders = [...holders].sort((a, b) => Number(b.value) - Number(a.value));
    const top50 = sortedHolders.slice(0, 50);

    const value = top50.map((holder, index) => {
      const balance = Number(holder.value);
      const percentage = totalSupply > 0 ? (balance / totalSupply) * 100 : 0;
      return {
        rank: index + 1,
        address: holder.hash,
        balanceRaw: holder.value,
        balanceFormatted: formatTokenAmount2(balance, decimals),
        percentage: `${percentage.toFixed(4)}%`,
      };
    });

    return {
      value,
      formattedValue: JSON.stringify(value, null, 2),
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'top50Holders',
    name: 'Top 50 Holders',
    description: 'The top 50 holders of the token.',
    enabled: true,
    format: 'text',
  }),
};

// New vs Lost Holders (7d)
export const newVsLostHolders7dStat = {
  id: 'newVsLostHolders7d',
  name: 'New vs Lost Holders (7d)',
  description: 'The number of new holders vs lost holders in the last 7 days.',
  enabled: true,
  format: 'text' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const transfers = await getTransfersLastNDays(tokenAddress, 7);
    if (transfers.length === 0) {
      return { value: { newHolders: 0, lostHolders: 0, netChange: 0 }, formattedValue: '0/0 (0)', lastUpdated: new Date(), source: 'pulsechain' };
    }

    const involvedAddresses = new Set<string>();
    transfers.forEach(t => {
      if (t.from?.hash) involvedAddresses.add(t.from.hash.toLowerCase());
      if (t.to?.hash) involvedAddresses.add(t.to.hash.toLowerCase());
    });

    const receivedOnly = new Set<string>();
    const sentOnly = new Set<string>();

    involvedAddresses.forEach(addr => {
      const sentTx = transfers.some(t => t.from?.hash?.toLowerCase() === addr);
      const receivedTx = transfers.some(t => t.to?.hash?.toLowerCase() === addr);

      if (receivedTx && !sentTx) {
        receivedOnly.add(addr);
      }
      if (sentTx && !receivedTx) {
        sentOnly.add(addr);
      }
    });

    const value = {
      newHolders: receivedOnly.size,
      lostHolders: sentOnly.size,
      netChange: receivedOnly.size - sentOnly.size,
    };

    return {
      value,
      formattedValue: `${value.newHolders}/${value.lostHolders} (${value.netChange})`,
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'newVsLostHolders7d',
    name: 'New vs Lost Holders (7d)',
    description: 'The number of new holders vs lost holders in the last 7 days.',
    enabled: true,
    format: 'text',
  }),
};

// Gini Coefficient
export const giniCoefficientStat = {
  id: 'giniCoefficient',
  name: 'Gini Coefficient',
  description: 'A measure of holder inequality.',
  enabled: true,
  format: 'number' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const holders = await ensureHolders(tokenAddress);
    if (holders.length < 2) return { value: 0, formattedValue: '0', lastUpdated: new Date(), source: 'pulsechain' };

    const values = holders.map(h => Number(h.value)).sort((a, b) => a - b);
    const n = values.length;
    const sumOfDifferences = values.reduce((sum, value, index) => {
      return sum + (2 * (index + 1) - n - 1) * value;
    }, 0);
    const totalValue = values.reduce((sum, value) => sum + value, 0);

    if (totalValue === 0) return { value: 0, formattedValue: '0', lastUpdated: new Date(), source: 'pulsechain' };

    const gini = sumOfDifferences / (n * totalValue);

    return {
      value: gini,
      formattedValue: String(gini.toFixed(4)),
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'giniCoefficient',
    name: 'Gini Coefficient',
    description: 'A measure of holder inequality.',
    enabled: true,
    format: 'number',
  }),
};

// Average Holder Balance
export const avgHolderBalanceStat = {
  id: 'avgHolderBalance',
  name: 'Average Holder Balance',
  description: 'The average balance of all holders.',
  enabled: true,
  format: 'number' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { tokenInfo, tokenCounters } = await ensureCoreCaches(tokenAddress);
    const holders = await ensureHolders(tokenAddress);
    const dead = holders.find(h => h.hash.toLowerCase() === DEAD_ADDRESS)?.value || '0';
    const circulatingSupply = Number(tokenInfo.total_supply) - Number(dead);
    const holderCount = Number(tokenCounters?.token_holders_count ?? 0);

    if (holderCount === 0) return { value: 0, formattedValue: '0', lastUpdated: new Date(), source: 'pulsechain' };

    const avgBalance = circulatingSupply / holderCount;
    const formattedValue = formatTokenAmount2(avgBalance, Number(tokenInfo.decimals));

    return {
      value: avgBalance,
      formattedValue,
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'avgHolderBalance',
    name: 'Average Holder Balance',
    description: 'The average balance of all holders.',
    enabled: true,
    format: 'number',
  }),
};
