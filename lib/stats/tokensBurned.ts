// lib/stats/tokensBurned.ts
import { pulsechainApi } from '@/services';
import { StatConfig, StatResult } from './index';

export const tokensBurnedStat = {
  id: 'tokensBurned',
  name: 'Tokens Burned',
  description: 'Total amount of tokens burned across all burn addresses.',
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
  
  fetch: async function(tokenAddress: string): Promise<StatResult> {
    try {
      const tokenInfoRes = await pulsechainApi.getTokenInfo(tokenAddress);
      const decimals = tokenInfoRes.data?.decimals || 18;
      
      const burnAddresses = [
        '0x000000000000000000000000000000000000dEaD',
        '0x0000000000000000000000000000000000000369',
        '0x0000000000000000000000000000000000000000',
      ];

      let totalBurned = 0;

      for (const burnAddress of burnAddresses) {
        try {
          const balanceRes = await pulsechainApi.getTokenBalanceLegacy(tokenAddress, burnAddress);
          const rawAmount = parseInt(balanceRes.data?.result ?? '0') || 0;
          const burnedAmount = rawAmount / Math.pow(10, decimals);
          totalBurned += burnedAmount;
        } catch (error) {
          // ignore individual address errors
        }
      }

      return {
        value: totalBurned,
        formattedValue: totalBurned.toLocaleString(undefined, { maximumFractionDigits: 0 }),
        lastUpdated: new Date(),
        source: 'pulsechain',
      };
    } catch (error) {
      return {
        value: null,
        formattedValue: 'Error',
        error: 'Failed to fetch burned tokens data',
        lastUpdated: new Date(),
        source: 'pulsechain',
      };
    }
  },
}; 