import React, { useEffect, useRef } from 'react';
import { LoaderThree } from '@/components/ui/loader';
import { Holder, HolderStats, TokenInfo } from './types';
import { isBurnAddress } from './utils';
import { AddToGroupButton } from '@/components/portfolio/AddToGroupButton';
import { fmtAmount, fmtNum } from '@/lib/format';

// Compact USD for the holder value column: "$1.2M", "$3.4k", "$12", "<$1", "$0".
function fmtUsd(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '$0';
  if (v < 1) return '<$1';
  if (v < 1000) return `$${Math.round(v)}`;
  if (v < 1_000_000) return `$${(v / 1000).toFixed(v < 10_000 ? 1 : 0)}k`;
  if (v < 1_000_000_000) return `$${(v / 1_000_000).toFixed(v < 10_000_000 ? 1 : 0)}M`;
  return `$${(v / 1_000_000_000).toFixed(1)}B`;
}

export interface GeickoHoldersTabProps {
  /** Holders loaded so far (accumulates as more pages are lazily fetched) */
  holders: Holder[];
  /** Aggregated holder statistics */
  holderStats: HolderStats;
  /** Is the initial load in flight */
  isLoadingHolders: boolean;
  /** Token information for decimals and total supply */
  tokenInfo: TokenInfo | null;
  /** Set of LP addresses for tagging */
  lpAddressSet: Set<string>;
  /** Callback when opening the holder modal (portfolio / transactions / stakes) */
  onViewHolder: (address: string) => void;
  /** Whether another page of holders can be lazily loaded */
  hasMore: boolean;
  /** Is a "load more" fetch in flight */
  isLoadingMore: boolean;
  /** Fetch the next page of holders (cursor-based, server-side) */
  onLoadMore: () => void;
  /** Estimated wallet value (core + stablecoins) per lowercased address. */
  holderValues: Record<string, { usd: number; native: number; core: number; stable: number }>;
}

/**
 * Holders tab for Geicko
 * Displays holder statistics and paginated table of top holders
 */
export default function GeickoHoldersTab({
  holders,
  holderStats,
  isLoadingHolders,
  tokenInfo,
  lpAddressSet,
  onViewHolder,
  hasMore,
  isLoadingMore,
  onLoadMore,
  holderValues,
}: GeickoHoldersTabProps) {
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

  // Holders accumulate in the parent and are lazily fetched a page at a time, so
  // render everything loaded so far; the footer/sentinel pulls the next page.
  const startIndex = 0;
  const visibleHolders = holders;

  // Auto-load the next page when the sentinel scrolls into view (infinite
  // scroll), with the button below as the accessible fallback.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasMore || isLoadingMore) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

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

      {/* Holders list header */}
      <div className="text-center">
        <p className="text-[12px] text-cyan-500 uppercase tracking-wider">
          Showing top {holders.length} holders{hasMore ? ' — scroll for more' : ''}
        </p>
      </div>

      {/* Holders Table */}
      <div className="border border-[var(--line-strong)] overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--line-strong)] bg-[var(--surface)]">
          <div className="flex-[0.6] min-w-[30px]">#</div>
          <div className="flex-[1.5] min-w-[90px]">Address & Tags</div>
          <div className="flex-[1.6] min-w-[64px]">Balance</div>
          <div className="flex-[1.3] min-w-[52px]" title="Estimated wallet value from native coin, wrapped native, core majors and pegged stablecoins">Wallet $</div>
          <div className="flex-[1.1] min-w-[48px]">% Total</div>
          <div className="flex-[0.8] min-w-[64px]">View</div>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-[var(--line)]">
          {visibleHolders.map((holder, i) => {
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
                  <span className="text-[var(--text)] font-mono truncate text-left">
                    {formattedAddress}
                  </span>
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
                <div className="flex-[1.6] min-w-[64px] text-[var(--text)] truncate font-semibold">
                  {fmtAmount(Math.floor(balance))}
                </div>

                {/* Estimated wallet value (core + stablecoins). '—' while its
                    page of values is still loading; '$0' once known to be empty. */}
                <div className="flex-[1.3] min-w-[52px] font-semibold">
                  {(() => {
                    const v = holderValues[(holder.address || '').toLowerCase()];
                    if (!v) return <span className="text-[var(--text-faint)]">—</span>;
                    return (
                      <span className={v.usd > 0 ? 'text-emerald-400' : 'text-[var(--text-muted)]'} title={`$${v.usd.toLocaleString(undefined, { maximumFractionDigits: 2 })} — native $${v.native.toFixed(0)} · core $${v.core.toFixed(0)} · stables $${v.stable.toFixed(0)}`}>
                        {fmtUsd(v.usd)}
                      </span>
                    );
                  })()}
                </div>

                {/* Percentage */}
                <div className="flex-[1.1] min-w-[48px] text-[var(--text)] font-semibold">
                  {percentage.toFixed(1)}%
                </div>

                {/* View / Save Buttons */}
                <div className="flex-[0.8] min-w-[64px] flex items-center gap-1.5">
                  {holder.address && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewHolder(holder.address);
                        }}
                        className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-semibold bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded border border-blue-500/30 transition-colors"
                      >
                        View
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

        {/* Load-more footer + infinite-scroll sentinel */}
        {hasMore && (
          <div
            ref={sentinelRef}
            className="flex items-center justify-between px-2 py-1.5 border-t border-[var(--line)] bg-[var(--surface)]"
          >
            <div className="text-xs text-[var(--text-muted)] font-medium">
              {holders.length} loaded
            </div>
            <button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="px-3 py-0.5 text-xs font-medium bg-cyan-500/20 hover:bg-cyan-500/30 disabled:opacity-60 text-[var(--text)] rounded border border-cyan-400/40 transition-colors"
            >
              {isLoadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
