import { BaseStat, BaseStatConfig } from './base';
import { StatResult } from './index';
import { dexscreenerApi, pulsechainApi } from '@/services';

export class TotalTokensInLiquidityStat extends BaseStat {
  constructor() {
    const config: BaseStatConfig = {
      id: 'totalTokensInLiquidity',
      name: 'Total Tokens in Liquidity',
      description: 'Total tokens locked in liquidity across all pairs',
      enabled: true,
      format: 'number',
      decimals: 2,
      apiSource: 'dexscreener'
    };
    super(config);
  }

  async fetch(tokenAddress: string): Promise<StatResult> {
    try {
      const { data: dexData } = await dexscreenerApi.getTokenData(tokenAddress);
      const { data: tokenInfo } = await pulsechainApi.getTokenInfo(tokenAddress);
      
      if (!dexData?.pairs) {
        return this.createErrorResult('Liquidity data not available');
      }
      
      // Filter for pools with liquidity > 0
      const activePairs = dexData.pairs.filter((pair: any) => Number(pair.liquidity?.usd || 0) > 0);
      
      if (activePairs.length === 0) {
        return this.createErrorResult('No active liquidity pools found');
      }
      
      const decimals = Number(tokenInfo?.decimals ?? 18);
      const totalBase = activePairs.reduce((s: number, x: any) => s + Number(x?.liquidity?.base || 0), 0);
      const totalQuote = activePairs.reduce((s: number, x: any) => s + Number(x?.liquidity?.quote || 0), 0);
      
      const pairDetails = activePairs.map((p: any) => ({
        pair: `${p.baseToken?.symbol}/${p.quoteToken?.symbol}`,
        base: Number(p?.liquidity?.base || 0),
        quote: Number(p?.liquidity?.quote || 0)
      }));
      
      const formattedBase = decimals ? (totalBase / Math.pow(10, decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : totalBase.toLocaleString();
      const formattedQuote = totalQuote.toLocaleString(undefined, { maximumFractionDigits: 2 });
      
      return {
        value: { totalBase, totalQuote, pairDetails, pairCount: activePairs.length },
        formattedValue: `${formattedBase} tokens`,
        lastUpdated: new Date(),
        source: 'dexscreener'
      };
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : 'Failed to fetch total tokens in liquidity');
    }
  }
}

export const totalTokensInLiquidityStat = new TotalTokensInLiquidityStat(); 