import { pulsechainApi } from '@/services';
import { StatConfig, StatResult } from './index';

export const tokenBalanceStat = {
  id: 'tokenBalance',
  name: 'Token Balance',
  description: 'Check how much of a specific token an address holds.',
  enabled: true,
  format: 'number' as const,

  getConfig: function(): StatConfig {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      enabled: this.enabled,
      format: this.format,
    };
  },
  
  fetch: async function(walletAddress: string, tokenAddress: string): Promise<StatResult> {
    try {
      const tokenInfoRes = await pulsechainApi.getTokenInfo(tokenAddress);
      const decimals = tokenInfoRes.data?.decimals || 18;
      
      const balanceRes = await pulsechainApi.getTokenBalanceLegacy(tokenAddress, walletAddress);
      const rawBalance = parseInt(balanceRes.data?.result ?? '0') || 0;
      const balance = rawBalance / Math.pow(10, decimals);
      
      return {
        value: balance,
        formattedValue: balance.toLocaleString(undefined, { maximumFractionDigits: 2 }),
        lastUpdated: new Date(),
        source: 'pulsechain',
      };
    } catch (error) {
      return {
        value: null,
        formattedValue: 'Error',
        error: 'Failed to fetch token balance',
        lastUpdated: new Date(),
        source: 'pulsechain',
      };
    }
  },
}; 