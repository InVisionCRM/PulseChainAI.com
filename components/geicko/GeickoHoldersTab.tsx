import React from 'react';
import { LoaderThree } from '@/components/ui/loader';
import { Holder, HolderStats, TokenInfo } from './types';
import { isBurnAddress } from './utils';

export interface GeickoHoldersTabProps {
  /** Array of holder data */
  holders: Holder[];
  /** Aggregated holder statistics */
  holderStats: HolderStats;
  /** Current page number */
  holdersPage: number;
  /** Items per page */
  holdersPerPage: number;
  /** Is data loading */
  isLoadingHolders: boolean;
  /** Token information for decimals and total supply */
  tokenInfo: TokenInfo | null;
  /** Set of LP addresses for tagging */
  lpAddressSet: Set<string>;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Callback when opening holder transfers modal */
  onOpenHolderTransfers: (address: string) => void;
}

/**
 * Holders tab for Geicko
 * Displays holder statistics and paginated table of top holders
 */
export default function GeickoHoldersTab({
  holders,
  holderStats,
  holdersPage,
  holdersPerPage,
  isLoadingHolders,
  tokenInfo,
  lpAddressSet,
  onPageChange,
  onOpenHolderTransfers,
}: GeickoHoldersTabProps) {
  if (isLoadingHolders) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <LoaderThree />
          <p className="text-gray-400 text-xs mt-2">Loading holders...</p>
        </div>
      </div>
    );
  }

  if (holders.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center text-gray-400">
          <div className="text-xl mb-1">👥</div>
          <div className="text-xs">No holders found</div>
        </div>
      </div>
    );
  }

  const decimals = tokenInfo?.decimals ? Number(tokenInfo.decimals) : 18;
  const totalSupply = tokenInfo?.total_supply ? Number(tokenInfo.total_supply) : 0;
  const startIndex = (holdersPage - 1) * holdersPerPage;
  const endIndex = startIndex + holdersPerPage;
  const currentPageHolders = holders.slice(startIndex, endIndex);
  const totalPages = Math.ceil(holders.length / holdersPerPage);

  return (
    <div className="space-y-1.5">
      {/* Holder Stats Cards */}
      <div className="grid grid-cols-3 gap-1">
        {/* Total Holders */}
        <div className="border border-white/20 px-2 py-1.5">
          <div className="text-[10px] text-center justify-center uppercase tracking-wider text-white/60">
            Total Holders
          </div>
          <div className="text-sm font-medium text-center justify-center text-white">
            {holderStats.totalHolders ? holderStats.totalHolders.toLocaleString() : '—'}
          </div>
        </div>

        {/* LP Addresses */}
        <div className="border border-white/20 px-2 py-1.5">
          <div className="text-[10px] text-center justify-center uppercase tracking-wider text-white/60">
            LP Addresses
          </div>
          <div className="text-sm font-medium text-center justify-center text-white">{holderStats.lpCount}</div>
        </div>

        {/* Contracts */}
        <div className="border border-white/20 px-2 py-1.5">
          <div className="text-[10px] text-center justify-center uppercase tracking-wider text-white/60">
            Contracts
          </div>
          <div className="text-sm font-medium text-center justify-center text-white">
            {holderStats.contractCount}
          </div>
        </div>
      </div>

      {/* Top 50 Holders Header */}
      <div className="text-center">
        <p className="text-[9px] text-white/50 uppercase tracking-wider">Showing Top 50 Holders</p>
      </div>

      {/* Holders Table */}
      <div className="border border-white/20 overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center px-2 py-1 text-[10px] uppercase tracking-wider text-white/60 border-b border-white/20 bg-white/5">
          <div className="flex-[0.6] min-w-[30px]">#</div>
          <div className="flex-[3] min-w-[110px]">Address & Tags</div>
          <div className="flex-[2] min-w-[70px]">Balance</div>
          <div className="flex-[1.5] min-w-[60px]">% Total</div>
          <div className="flex-[0.8] min-w-[45px]">View</div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-white/10">
          {currentPageHolders.map((holder, i) => {
            const globalIndex = startIndex + i + 1;
            const balance = Number(holder.value) / Math.pow(10, decimals);
            const percentage = totalSupply > 0 ? (Number(holder.value) / totalSupply) * 100 : 0;
            const formattedAddress = holder.address
              ? `${holder.address.slice(0, 4)}...${holder.address.slice(-4)}`
              : 'Unknown';
            const isLpHolder = lpAddressSet.has((holder.address || '').toLowerCase());
            const isBurn = isBurnAddress(holder.address);

            return (
              <div
                key={holder.address || i}
                className="flex items-center px-2 py-1 text-sm hover:bg-white/5 transition-colors"
              >
                {/* Rank */}
                <div className="flex-[0.6] min-w-[30px] text-white font-medium">{globalIndex}</div>

                {/* Address & Tags */}
                <div className="flex-[3] min-w-[110px] flex items-center gap-1 truncate">
                  <button
                    type="button"
                    onClick={() => onOpenHolderTransfers(holder.address)}
                    className="text-white hover:text-white/80 underline cursor-pointer font-mono truncate text-left"
                  >
                    {formattedAddress}
                  </button>
                  <div className="flex items-center gap-0.5 flex-wrap">
                    {isLpHolder && (
                      <span className="px-1 py-0.5 text-[11px] font-bold text-blue-300">
                        LP
                      </span>
                    )}
                    {holder.isContract && (
                      <span className="px-1 py-0.5 text-[9px] bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">
                        {holder.isVerified ? 'Verified' : 'Contract'}
                      </span>
                    )}
                    {isBurn && (
                      <span className="px-1 py-0.5 text-[11px] font-bold text-red-500">
                        Burn
                      </span>
                    )}
                  </div>
                </div>

                {/* Balance */}
                <div className="flex-[2] min-w-[70px] text-white truncate font-semibold">
                  {Math.floor(balance).toLocaleString()}
                </div>

                {/* Percentage */}
                <div className="flex-[1.5] min-w-[60px] text-white font-semibold">
                  {percentage.toFixed(4)}%
                </div>

                {/* View Button */}
                <div className="flex-[0.8] min-w-[45px]">
                  {holder.address && (
                    <a
                      href={`https://scan.pulsechain.com/address/${holder.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-semibold bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded border border-blue-500/30 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination Controls */}
        {holders.length > holdersPerPage && (
          <div className="flex items-center justify-between px-2 py-1.5 border-t border-white/10 bg-white/5">
            <div className="text-xs text-white/70 font-medium">
              Showing {startIndex + 1}-{Math.min(endIndex, holders.length)} of{' '}
              {holders.length}
            </div>
            <div className="flex items-center gap-0.5">
              {/* Previous Button */}
              <button
                onClick={() => onPageChange(Math.max(1, holdersPage - 1))}
                disabled={holdersPage === 1}
                className="px-2 py-0.5 text-xs font-medium bg-white/10 hover:bg-white/15 disabled:bg-white/5 disabled:text-white/40 disabled:cursor-not-allowed text-white rounded border border-white/15 transition-colors"
              >
                Prev
              </button>

              {/* Page Numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (holdersPage <= 3) {
                  pageNum = i + 1;
                } else if (holdersPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = holdersPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`px-2 py-0.5 text-xs font-medium rounded border transition-colors ${
                      holdersPage === pageNum
                        ? 'bg-cyan-500/30 text-white border-cyan-400/50'
                        : 'bg-white/10 hover:bg-white/15 text-white border-white/15'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Next Button */}
              <button
                onClick={() => onPageChange(Math.min(totalPages, holdersPage + 1))}
                disabled={holdersPage === totalPages}
                className="px-2 py-0.5 text-xs font-medium bg-white/10 hover:bg-white/15 disabled:bg-white/5 disabled:text-white/40 disabled:cursor-not-allowed text-white rounded border border-white/15 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
