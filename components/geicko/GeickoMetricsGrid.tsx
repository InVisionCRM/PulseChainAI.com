import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BurnedTokens,
  SupplyHeldData,
  SmartContractHolderData,
  TotalSupply,
} from './types';
import { formatAbbrev } from './utils';

export interface GeickoMetricsGridProps {
  /** Burned tokens data */
  burnedTokens: BurnedTokens | null;
  /** Holders count */
  holdersCount: number | null;
  /** Creation date string */
  creationDate: string | null;
  /** Supply held by top holders */
  supplyHeld: SupplyHeldData;
  /** Smart contract holder statistics */
  smartContractHolderShare: SmartContractHolderData;
  /** Total supply information */
  totalSupply: TotalSupply | null;
}

/**
 * Metrics grid for Geicko (left column)
 * Displays Supply Info, Supply Held, Smart Contract Holders, and Burned Tokens
 */
export default function GeickoMetricsGrid({
  burnedTokens,
  holdersCount,
  creationDate,
  supplyHeld,
  smartContractHolderShare,
  totalSupply,
}: GeickoMetricsGridProps) {
  return (
    <div className="space-y-3">
      {/* Supply & Token Info */}
      <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-3">
        <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">
          Supply Info
        </div>
        <div className="space-y-2">
          {/* Total Supply */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Total Supply</span>
            <span className="text-sm text-white font-semibold">
              {totalSupply
                ? (() => {
                    const supply =
                      Number(totalSupply.supply) / Math.pow(10, totalSupply.decimals);
                    return formatAbbrev(supply);
                  })()
                : '—'}
            </span>
          </div>

          {/* Circulating Supply */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Circulating</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm text-white font-semibold">
                  {totalSupply
                    ? (() => {
                        const supply =
                          Number(totalSupply.supply) / Math.pow(10, totalSupply.decimals);
                        const burned = burnedTokens?.amount ?? 0;
                        const circulating = Math.max(0, supply - burned);
                        return formatAbbrev(circulating);
                      })()
                    : '—'}
                </span>
              </TooltipTrigger>
              {totalSupply &&
                (() => {
                  const supply =
                    Number(totalSupply.supply) / Math.pow(10, totalSupply.decimals);
                  const burned = burnedTokens?.amount ?? 0;
                  const circulating = Math.max(0, supply - burned);
                  return (
                    <TooltipContent>
                      <p>{circulating.toLocaleString()}</p>
                    </TooltipContent>
                  );
                })()}
            </Tooltip>
          </div>

          {/* Holders */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Holders</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm text-white font-semibold">
                  {holdersCount !== null
                    ? holdersCount >= 1000
                      ? `${(holdersCount / 1000).toFixed(1)}k`
                      : holdersCount
                    : '—'}
                </span>
              </TooltipTrigger>
              {holdersCount !== null && (
                <TooltipContent>
                  <p>{holdersCount.toLocaleString()}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>

          {/* Creation Date */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Creation Date</span>
            <span className="text-sm text-white font-semibold">{creationDate || '—'}</span>
          </div>
        </div>
      </div>

      {/* Supply Held */}
      <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-3">
        <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">
          Supply Held
        </div>
        {supplyHeld.isLoading ? (
          <div className="text-center text-gray-500 text-sm">Loading...</div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Top 10</span>
              <span className="text-sm text-white font-semibold">
                {supplyHeld.top10 > 0 ? `${Math.round(supplyHeld.top10)}%` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Top 20</span>
              <span className="text-sm text-white font-semibold">
                {supplyHeld.top20 > 0 ? `${Math.round(supplyHeld.top20)}%` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Top 50</span>
              <span className="text-sm text-white font-semibold">
                {supplyHeld.top50 > 0 ? `${Math.round(supplyHeld.top50)}%` : '—'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Smart Contract Holder Share */}
      <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-3">
        <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">
          Smart Contract Holder Share
        </div>
        {smartContractHolderShare.isLoading ? (
          <div className="text-center text-gray-500 text-sm">Loading...</div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Share</span>
              <span className="text-sm text-white font-semibold">
                {smartContractHolderShare.percent > 0
                  ? `${smartContractHolderShare.percent.toFixed(2)}%`
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Contracts</span>
              <span className="text-sm text-white font-semibold">
                {smartContractHolderShare.contractCount > 0
                  ? smartContractHolderShare.contractCount
                  : '—'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Burned Tokens */}
      <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg py-0 px-3 min-h-[60px] flex items-center justify-center">
        <div className="absolute top-2 left-3 text-xs text-gray-400 font-medium uppercase tracking-wider">
          Burned
        </div>
        {burnedTokens ? (
          <div className="text-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-base text-white font-semibold">
                  {formatAbbrev(burnedTokens.amount)}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{burnedTokens.amount.toLocaleString()}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="text-center text-base text-white font-semibold">—</div>
        )}
        {burnedTokens && (
          <div className="absolute top-4 right-2 flex items-center justify-center w-9 h-9 rounded-full border-2 border-green-400">
            <span className="text-[10px] text-green-400 font-semibold">
              {burnedTokens.percent.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
