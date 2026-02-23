import React, { useCallback, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Info, Copy } from 'lucide-react';
import {
  BurnedTokens,
  SupplyHeldData,
  SmartContractHolderData,
  TotalSupply,
  ContractHolderItem,
} from './types';
import { formatAbbrev, truncateAddress } from './utils';

function ContractHolderRow({ holder }: { holder: ContractHolderItem }) {
  const [copied, setCopied] = useState(false);
  const copyOne = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(holder.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }, [holder.address]);
  return (
    <li className="text-xs font-mono text-gray-400 space-y-0.5 border-b border-white/10 pb-1.5 last:border-0">
      <div className="flex items-center gap-1.5">
        <span className="text-gray-300">{truncateAddress(holder.address)}</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            copyOne();
          }}
          className="shrink-0 p-0.5 rounded text-cyan-400 hover:text-cyan-300"
          aria-label="Copy address"
          title="Copy address"
        >
          {copied ? (
            <span className="text-[10px]">Copied</span>
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
      <div className="text-[10px] text-gray-500 mt-0.5">
        {holder.type} · {holder.percent.toFixed(2)}% of supply
      </div>
    </li>
  );
}

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
      <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-3 relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
            Supply Held
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-cyan-400 hover:text-cyan-300 p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500/50 shrink-0"
                aria-label="What Supply Held excludes"
              >
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[240px]">
              <p className="text-xs">
                Excludes burn addresses (e.g. …dead, …0000) and smart contract addresses (e.g. LPs, routers).
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        {supplyHeld.isLoading ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Top 10</span>
              <Skeleton className="h-5 w-12" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Top 20</span>
              <Skeleton className="h-5 w-12" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Top 50</span>
              <Skeleton className="h-5 w-12" />
            </div>
          </div>
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

      {/* Supply In Contracts */}
      <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-3 relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
            Supply In Contracts
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-cyan-400 hover:text-cyan-300 p-0.5 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500/50 shrink-0"
                aria-label="Addresses counted as contracts"
              >
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[340px] p-2">
              <div className="space-y-1.5">
                <p className="text-xs text-gray-300 font-medium">Addresses counted (top 50):</p>
                {(() => {
                  const holders = smartContractHolderShare.contractHolders;
                  const fallbackAddrs = smartContractHolderShare.contractAddresses;
                  const hasRich = holders && holders.length > 0;
                  const hasFallback = fallbackAddrs && fallbackAddrs.length > 0;
                  if (hasRich) {
                    return (
                      <ul className="space-y-0 max-h-48 overflow-y-auto">
                        {holders!.map((h) => (
                          <ContractHolderRow key={h.address} holder={h} />
                        ))}
                      </ul>
                    );
                  }
                  if (hasFallback) {
                    return (
                      <ul className="text-xs font-mono text-gray-400 space-y-0.5 max-h-40 overflow-y-auto">
                        {fallbackAddrs!.map((addr) => (
                          <li key={addr} className="text-gray-300">
                            {truncateAddress(addr)}
                          </li>
                        ))}
                      </ul>
                    );
                  }
                  return (
                    <p className="text-[10px] text-gray-500">No contract holders in top 50.</p>
                  );
                })()}
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
        {smartContractHolderShare.isLoading ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Share</span>
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Contracts</span>
              <Skeleton className="h-5 w-8" />
            </div>
          </div>
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
