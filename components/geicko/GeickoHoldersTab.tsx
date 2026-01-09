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
    <div className="space-y-2">
      {/* Holder Stats Cards */}
      <div className="grid grid-cols-3 gap-1.5">
        {/* Total Holders */}
        <div className="border border-white/20 px-2 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-white/60">
            Total Holders
          </div>
          <div className="text-sm font-medium text-white">
            {holderStats.totalHolders ? holderStats.totalHolders.toLocaleString() : '—'}
          </div>
        </div>

        {/* LP Addresses */}
        <div className="border border-white/20 px-2 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-white/60">
            LP Addresses
          </div>
          <div className="text-sm font-medium text-white">{holderStats.lpCount}</div>
        </div>

        {/* Contracts */}
        <div className="border border-white/20 px-2 py-1.5">
          <div className="text-[10px] uppercase tracking-wider text-white/60">
            Contracts
          </div>
          <div className="text-sm font-medium text-white">
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
        <div className="flex items-center px-2 py-1.5 text-[10px] uppercase tracking-wider text-white/60 border-b border-white/20">
          <div className="flex-[0.8] min-w-[35px]">#</div>
          <div className="flex-[3] min-w-[110px]">Address & Tags</div>
          <div className="flex-[2] min-w-[70px]">Balance</div>
          <div className="flex-[1.5] min-w-[60px]">% Total</div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-white/10">
          {currentPageHolders.map((holder, i) => {
            const globalIndex = startIndex + i + 1;
            const balance = Number(holder.value) / Math.pow(10, decimals);
            const percentage = totalSupply > 0 ? (Number(holder.value) / totalSupply) * 100 : 0;
            const formattedAddress = holder.address
              ? `${holder.address.slice(0, 9)}...${holder.address.slice(-5)}`
              : 'Unknown';
            const isLpHolder = lpAddressSet.has((holder.address || '').toLowerCase());
            const isBurn = isBurnAddress(holder.address);

            return (
              <div
                key={holder.address || i}
                className="flex items-center px-2 py-1.5 text-[11px] hover:bg-white/5 transition-colors"
              >
                {/* Rank */}
                <div className="flex-[0.8] min-w-[35px] text-white">{globalIndex}</div>

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
                      <span className="px-1 py-0.5 text-[8px] bg-white/10 text-white rounded border border-white/20">
                        LP
                      </span>
                    )}
                    {holder.isContract && (
                      <span className="px-1 py-0.5 text-[8px] bg-white/10 text-white rounded border border-white/20">
                        {holder.isVerified ? 'Verified' : 'Contract'}
                      </span>
                    )}
                    {isBurn && (
                      <span className="px-1 py-0.5 text-[8px] bg-white/10 text-white rounded border border-white/20">
                        Burn
                      </span>
                    )}
                  </div>
                  {holder.address && (
                    <a
                      href={`https://scan.pulsechain.com/address/${holder.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-white/50 hover:text-white"
                      aria-label="View address on PulseScan"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.6}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M14 3h7v7m0-7L10 14m4 7H3V10"
                        />
                      </svg>
                    </a>
                  )}
                </div>

                {/* Balance */}
                <div className="flex-[2] min-w-[70px] text-white truncate font-medium">
                  {balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>

                {/* Percentage */}
                <div className="flex-[1.5] min-w-[60px] text-white font-medium">
                  {percentage.toFixed(4)}%
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination Controls */}
        {holders.length > holdersPerPage && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-white/10 bg-white/5">
            <div className="text-[11px] text-white/70">
              Showing {startIndex + 1}-{Math.min(endIndex, holders.length)} of{' '}
              {holders.length}
            </div>
            <div className="flex items-center gap-1">
              {/* Previous Button */}
              <button
                onClick={() => onPageChange(Math.max(1, holdersPage - 1))}
                disabled={holdersPage === 1}
                className="px-2 py-1 text-[11px] bg-white/10 hover:bg-white/15 disabled:bg-white/5 disabled:text-white/40 disabled:cursor-not-allowed text-white rounded border border-white/15 transition-colors"
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
                    className={`px-2 py-1 text-[11px] rounded border transition-colors ${
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
                className="px-2 py-1 text-[11px] bg-white/10 hover:bg-white/15 disabled:bg-white/5 disabled:text-white/40 disabled:cursor-not-allowed text-white rounded border border-white/15 transition-colors"
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
