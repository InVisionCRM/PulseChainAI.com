import React, { useState } from 'react';
import { LoaderThree } from '@/components/ui/loader';
import { Holder, HolderStats, TokenInfo } from './types';
import { isBurnAddress } from './utils';
import GeickoPortfolioModal from './GeickoPortfolioModal';
import { AddToGroupButton } from '@/components/portfolio/AddToGroupButton';
import { fmtAmount, fmtNum } from '@/lib/format';

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
  const [portfolioModalOpen, setPortfolioModalOpen] = useState(false);
  const [selectedHolderAddress, setSelectedHolderAddress] = useState<string | null>(null);

  const handleOpenPortfolio = (address: string) => {
    setSelectedHolderAddress(address);
    setPortfolioModalOpen(true);
  };

  const handleClosePortfolio = () => {
    setPortfolioModalOpen(false);
    setSelectedHolderAddress(null);
  };

  if (isLoadingHolders) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <LoaderThree />
          <p className="text-[var(--text-muted)] text-xs mt-2">Loading holders...</p>
        </div>
      </div>
    );
  }

  if (holders.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center text-[var(--text-muted)]">
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
        <div className="border border-[var(--line-strong)] px-2 py-1.5">
          <div className="text-sm text-center justify-center uppercase tracking-wider text-cyan-500">
            Total Holders
          </div>
          <div className="text-sm font-medium text-center justify-center text-[var(--text)]">
            {holderStats.totalHolders ? fmtNum(holderStats.totalHolders) : '—'}
          </div>
        </div>

        {/* LP Addresses */}
        <div className="border border-[var(--line-strong)] px-2 py-1.5">
          <div className="text-sm text-center justify-center uppercase tracking-wider text-cyan-500">
            LP Addresses
          </div>
          <div className="text-sm font-medium text-center justify-center text-[var(--text)]">{holderStats.lpCount}</div>
        </div>

        {/* Contracts */}
        <div className="border border-[var(--line-strong)] px-2 py-1.5">
          <div className="text-sm text-center justify-center uppercase tracking-wider text-cyan-500">
            Contracts
          </div>
          <div className="text-sm font-medium text-center justify-center text-[var(--text)]">
            {holderStats.contractCount}
          </div>
        </div>
      </div>

      {/* Top 50 Holders Header */}
      <div className="text-center">
        <p className="text-[12px] text-cyan-500 uppercase tracking-wider">Showing Top 50 Holders</p>
      </div>

      {/* Holders Table */}
      <div className="border border-[var(--line-strong)] overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--line-strong)] bg-[var(--surface)]">
          <div className="flex-[0.6] min-w-[30px]">#</div>
          <div className="flex-[1.5] min-w-[90px]">Address & Tags</div>
          <div className="flex-[2] min-w-[70px]">Balance</div>
          <div className="flex-[1.5] min-w-[60px]">% Total</div>
          <div className="flex-[0.8] min-w-[64px]">View</div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-[var(--line)]">
          {currentPageHolders.map((holder, i) => {
            const globalIndex = startIndex + i + 1;
            const balance = Number(holder.value) / Math.pow(10, decimals);
            const percentage = totalSupply > 0 ? (Number(holder.value) / totalSupply) * 100 : 0;
            const formattedAddress = holder.address
              ? holder.address.slice(-4)
              : 'Unknown';
            const isLpHolder = lpAddressSet.has((holder.address || '').toLowerCase());
            const isBurn = isBurnAddress(holder.address);

            return (
              <div
                key={holder.address || i}
                className="flex items-center px-2 py-1 text-sm hover:bg-[var(--surface)] transition-colors"
              >
                {/* Rank */}
                <div className="flex-[0.6] min-w-[30px] text-[var(--text)] font-medium">{globalIndex}</div>

                {/* Address & Tags */}
                <div className="flex-[1.5] min-w-[90px] flex items-center gap-1 truncate">
                  <button
                    type="button"
                    onClick={() => onOpenHolderTransfers(holder.address)}
                    className="text-[var(--text)] hover:text-[var(--text)] underline cursor-pointer font-mono truncate text-left"
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
                <div className="flex-[2] min-w-[70px] text-[var(--text)] truncate font-semibold">
                  {fmtAmount(Math.floor(balance))}
                </div>

                {/* Percentage */}
                <div className="flex-[1.5] min-w-[60px] text-[var(--text)] font-semibold">
                  {percentage.toFixed(1)}%
                </div>

                {/* View / Save Buttons */}
                <div className="flex-[0.8] min-w-[64px] flex items-center gap-1.5">
                  {holder.address && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenPortfolio(holder.address);
                        }}
                        className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-semibold bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded border border-blue-500/30 transition-colors"
                      >
                        View O
                      </button>
                      <AddToGroupButton
                        address={holder.address}
                        source="holder"
                        chain="pulsechain"
                        context={{
                          tokenSymbol: tokenInfo?.symbol,
                          tokenName: tokenInfo?.name,
                          rank: globalIndex,
                        }}
                        size={15}
                      />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination Controls */}
        {holders.length > holdersPerPage && (
          <div className="flex items-center justify-between px-2 py-1.5 border-t border-[var(--line)] bg-[var(--surface)]">
            <div className="text-xs text-[var(--text-muted)] font-medium">
              Showing {startIndex + 1}-{Math.min(endIndex, holders.length)} of{' '}
              {holders.length}
            </div>
            <div className="flex items-center gap-0.5">
              {/* Previous Button */}
              <button
                onClick={() => onPageChange(Math.max(1, holdersPage - 1))}
                disabled={holdersPage === 1}
                className="px-2 py-0.5 text-xs font-medium bg-[var(--surface-2)] hover:bg-[var(--surface-3)] disabled:bg-[var(--surface)] disabled:text-[var(--text-faint)] disabled:cursor-not-allowed text-[var(--text)] rounded border border-[var(--line)] transition-colors"
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
                        ? 'bg-cyan-500/30 text-[var(--text)] border-cyan-400/50'
                        : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border-[var(--line)]'
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
                className="px-2 py-0.5 text-xs font-medium bg-[var(--surface-2)] hover:bg-[var(--surface-3)] disabled:bg-[var(--surface)] disabled:text-[var(--text-faint)] disabled:cursor-not-allowed text-[var(--text)] rounded border border-[var(--line)] transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Portfolio Modal */}
      <GeickoPortfolioModal
        isOpen={portfolioModalOpen}
        onClose={handleClosePortfolio}
        holderAddress={selectedHolderAddress}
      />
    </div>
  );
}
