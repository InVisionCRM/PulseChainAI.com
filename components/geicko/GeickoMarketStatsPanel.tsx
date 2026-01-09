import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DexScreenerData, LiquidityData } from './types';
import { formatAbbrev } from './utils';

export interface GeickoMarketStatsPanelProps {
  /** DexScreener data with pairs */
  dexScreenerData: DexScreenerData | null;
  /** Total liquidity across all pairs */
  totalLiquidity: LiquidityData;
}

/**
 * Market stats panel for Geicko (right column)
 * Displays Market Cap, Liquidity, Liq/MCAP ratio, and Total Liquidity
 */
export default function GeickoMarketStatsPanel({
  dexScreenerData,
  totalLiquidity,
}: GeickoMarketStatsPanelProps) {
  const primaryPair = dexScreenerData?.pairs?.[0];

  if (!primaryPair) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Market Cap */}
      <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-3">
        <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">
          Market Cap
        </div>
        <div className="text-center text-base text-white font-semibold">
          {(() => {
            const marketCap = Number(primaryPair.marketCap || 0);
            return marketCap > 0 ? formatAbbrev(marketCap) : '—';
          })()}
        </div>
      </div>

      {/* Liquidity */}
      <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg py-0 px-3 min-h-[60px] flex items-center justify-center">
        <div className="absolute top-2 left-3 text-xs text-gray-400 font-medium uppercase tracking-wider">
          Liquidity
        </div>
        <div className="text-center text-base text-white font-semibold">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                {(() => {
                  const usdLiquidity = Number(primaryPair.liquidity?.usd || 0);
                  return usdLiquidity > 0 ? `$${formatAbbrev(usdLiquidity)}` : '—';
                })()}
              </span>
            </TooltipTrigger>
            {(() => {
              const usdLiquidity = Number(primaryPair.liquidity?.usd || 0);
              return (
                usdLiquidity > 0 && (
                  <TooltipContent>
                    <p>${usdLiquidity.toLocaleString()}</p>
                  </TooltipContent>
                )
              );
            })()}
          </Tooltip>
        </div>
      </div>

      {/* Liq/MCAP Ratio */}
      <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg py-0 px-3 min-h-[60px] flex items-center justify-center">
        <div className="absolute top-2 left-3 text-xs text-gray-400 font-medium uppercase tracking-wider">
          Liq/MCAP
        </div>
        <div className="text-center text-base text-white font-semibold">
          {(() => {
            const liquidity = Number(primaryPair.liquidity?.usd || 0);
            const marketCap = Number(primaryPair.marketCap || 0);
            if (marketCap > 0) {
              const ratio = (liquidity / marketCap) * 100;
              return `${ratio.toFixed(2)}%`;
            }
            return '—';
          })()}
        </div>
      </div>

      {/* Total Liquidity */}
      <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg py-0 px-3 min-h-[80px] flex items-center justify-center">
        <div className="absolute top-2 left-3 text-xs text-gray-400 font-medium uppercase tracking-wider">
          Total Liquidity
        </div>
        {totalLiquidity.isLoading ? (
          <div className="text-center text-gray-500 text-sm">Loading...</div>
        ) : (
          <div className="text-center text-base text-white font-semibold">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  {totalLiquidity.usd > 0 ? `$${formatAbbrev(totalLiquidity.usd)}` : '—'}
                </span>
              </TooltipTrigger>
              {totalLiquidity.usd > 0 && (
                <TooltipContent>
                  <p>${totalLiquidity.usd.toLocaleString()}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        )}
        {totalLiquidity.pairCount > 0 && (
          <div className="absolute bottom-2 right-3 text-xs text-gray-400 font-medium">
            {totalLiquidity.pairCount} {totalLiquidity.pairCount === 1 ? 'Pair' : 'Pairs'}
          </div>
        )}
      </div>
    </div>
  );
}
