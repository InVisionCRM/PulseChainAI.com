"use client";

import React, { useEffect, useState } from 'react';
import { LoaderThree } from '@/components/ui/loader';
import { HolderTransfer } from './types';
import { truncateAddress, formatDateUTC } from './utils';
import { HexStakes } from '@/components/portfolio/HexStakes';
import { isHexAddress } from '@/lib/hex/hexDay';
import { fmtUsd, fmtAmount, fmtPrice } from '@/lib/format';
import { portfolioService } from '@/services';
import type { PortfolioToken } from '@/services';

type HolderModalTab = 'portfolio' | 'transactions' | 'stakes';

export interface GeickoHolderModalProps {
  /** Is modal open */
  isOpen: boolean;
  /** Holder address being viewed */
  holderAddress: string | null;
  /** Array of transfers for this holder */
  transfers: HolderTransfer[];
  /** Is transfers data loading */
  isLoading: boolean;
  /** Error message for transfers, if any */
  error: string | null;
  /** Set of expanded transaction hashes */
  expandedTxs: Set<string>;
  /** Token symbol to display in the transactions list */
  tokenSymbol?: string;
  /** Address of the token being viewed — enables the HEX "Stakes" tab. */
  tokenAddress?: string;
  /** Current token (HEX) USD price, for USD figures in the stakes view. */
  tokenPriceUsd?: number | null;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when a transaction row is toggled */
  onToggleExpand: (hash: string) => void;
}

/**
 * Unified Holder Modal for Geicko.
 *
 * Replaces the previous split between the "transfers" modal (opened by clicking
 * an address) and the "portfolio" modal (opened by the View button). Everything
 * now lives behind a single View button as tabs: Portfolio, Transactions and —
 * for HEX — Stakes.
 */
export default function GeickoHolderModal({
  isOpen,
  holderAddress,
  transfers,
  isLoading,
  error,
  expandedTxs,
  tokenSymbol = 'TOKEN',
  tokenAddress,
  tokenPriceUsd,
  onClose,
  onToggleExpand,
}: GeickoHolderModalProps) {
  const isHex = isHexAddress(tokenAddress);
  const [tab, setTab] = useState<HolderModalTab>('portfolio');

  // Portfolio state (lazily fetched when the Portfolio tab is viewed)
  const [portfolio, setPortfolio] = useState<PortfolioToken[]>([]);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [portfolioFetchedFor, setPortfolioFetchedFor] = useState<string | null>(null);

  // Default to the Portfolio tab; reset when the holder changes.
  useEffect(() => {
    setTab('portfolio');
  }, [holderAddress]);

  const fetchPortfolio = async (address: string) => {
    setIsLoadingPortfolio(true);
    setPortfolioError(null);
    setPortfolio([]);
    setPortfolioFetchedFor(address);

    try {
      // Reuse the same fast path the Portfolio page uses (Blockscout balances
      // enriched with prices/LP/icons), already sorted by USD value.
      const res = await portfolioService.getPortfolio(address, ['pulsechain']);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to load portfolio');
      }
      setPortfolio(res.data.tokens);
    } catch (err) {
      console.error('Portfolio fetch error:', err);
      setPortfolioError(err instanceof Error ? err.message : 'Failed to load portfolio');
    } finally {
      setIsLoadingPortfolio(false);
    }
  };

  // Lazily fetch the portfolio the first time the Portfolio tab is shown for an address.
  useEffect(() => {
    if (isOpen && tab === 'portfolio' && holderAddress && portfolioFetchedFor !== holderAddress) {
      fetchPortfolio(holderAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tab, holderAddress]);

  if (!isOpen || !holderAddress) {
    return null;
  }

  const totalPortfolioValue = portfolio.reduce((sum, t) => sum + (t.valueUsd ?? 0), 0);

  const tabButton = (id: HolderModalTab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
        tab === id
          ? 'bg-[var(--surface-2)] text-cyan-300'
          : 'text-[var(--text-muted)] hover:text-[var(--text)]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[90vh] bg-gradient-to-br from-[var(--panel)] via-[var(--surface-2)] to-[var(--panel)] rounded-xl shadow-2xl border border-[var(--line)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--line)] bg-[var(--panel)] backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Holder</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-mono text-[var(--text)]">
                {truncateAddress(holderAddress)}
              </span>
              <a
                href={`https://scan.mypinata.cloud/ipfs/bafybeienxyoyrhn5tswclvd3gdjy5mtkkwmu37aqtml6onbf7xnb3o22pe/#/address/${holderAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 text-xs hover:underline"
              >
                View on Explorer
              </a>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] rounded-lg transition-colors"
            aria-label="Close holder modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-5 py-2">
          {tabButton('portfolio', 'Portfolio')}
          {tabButton('transactions', 'Transactions')}
          {isHex && tabButton('stakes', 'Stakes')}
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-150px)] bg-[var(--panel)]">
          {/* Portfolio tab */}
          {tab === 'portfolio' && (
            isLoadingPortfolio ? (
              <div className="flex items-center justify-center py-10 text-[var(--text-muted)] gap-3">
                <LoaderThree />
                <span className="text-sm">Loading portfolio...</span>
              </div>
            ) : portfolioError ? (
              <div className="flex items-center justify-center py-10">
                <div className="text-center text-red-400">
                  <div className="text-2xl mb-2">⚠️</div>
                  <div className="text-sm">Error loading portfolio</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">{portfolioError}</div>
                </div>
              </div>
            ) : portfolio.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <div className="text-center text-[var(--text-muted)]">
                  <div className="text-2xl mb-2">📊</div>
                  <div className="text-sm">No tokens found</div>
                  <div className="text-xs mt-1">This address holds no tokens</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Total value summary */}
                {totalPortfolioValue > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--surface)]">
                    <span className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
                      Total Value ({portfolio.length} tokens)
                    </span>
                    <span className="text-sm font-semibold text-cyan-300 font-mono">
                      {fmtUsd(totalPortfolioValue)}
                    </span>
                  </div>
                )}

                {/* Header */}
                <div className="grid grid-cols-11 gap-1 px-3 py-2 text-xs font-semibold text-[var(--text-muted)] border-b border-[var(--line)] bg-[var(--surface)] rounded">
                  <div className="col-span-1 text-left">#</div>
                  <div className="col-span-4 text-left">Token</div>
                  <div className="col-span-2 text-left">Balance</div>
                  <div className="col-span-2 text-left">Price</div>
                  <div className="col-span-2 text-left">Value</div>
                </div>

                {/* Token rows */}
                <div className="space-y-1">
                  {portfolio.map((token, index) => (
                    <div
                      key={token.address}
                      className="grid grid-cols-11 gap-1 px-3 py-2 text-sm hover:bg-[var(--surface)] rounded transition-colors"
                    >
                      <div className="col-span-1 text-[var(--text-muted)] font-medium">{index + 1}</div>

                      <div className="col-span-4 flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center overflow-hidden flex-shrink-0">
                          {token.logoURI ? (
                            <img
                              src={token.logoURI}
                              alt={token.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-full h-full flex items-center justify-center text-xs ${token.logoURI ? 'hidden' : ''}`}>
                            {token.symbol.slice(0, 2).toUpperCase()}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-[var(--text)] truncate">{token.name}</div>
                          <div className="text-xs text-[var(--text-muted)] truncate">{token.symbol}</div>
                        </div>
                      </div>

                      <div className="col-span-2 text-left text-[var(--text)] font-mono truncate">
                        {fmtAmount(token.balanceFormatted)}
                      </div>

                      <div className="col-span-2 text-left text-[var(--text)] font-mono truncate">
                        {token.priceUsd != null ? fmtPrice(token.priceUsd) : 'N/A'}
                      </div>

                      <div className="col-span-2 text-left text-[var(--text)] font-semibold font-mono truncate">
                        {token.valueUsd != null ? fmtUsd(token.valueUsd) : 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* Transactions tab */}
          {tab === 'transactions' && (
            isLoading ? (
              <div className="flex items-center justify-center py-10 text-[var(--text-muted)] gap-3">
                <LoaderThree />
                <span className="text-sm">Loading transfers...</span>
              </div>
            ) : error ? (
              <div className="text-center text-sm text-red-400 py-6">{error}</div>
            ) : transfers.length === 0 ? (
              <div className="text-center text-sm text-[var(--text-muted)] py-6">
                No transfers found for this holder.
              </div>
            ) : (
              <div className="space-y-3">
                {transfers.map((tx) => {
                  const isExpanded = expandedTxs.has(tx.txHash);
                  const badgeClasses =
                    tx.direction === 'Buy'
                      ? 'bg-green-900/40 text-[var(--up)] border-green-700/50'
                      : tx.direction === 'Sell'
                      ? 'bg-red-900/40 text-red-300 border-red-700/50'
                      : 'bg-blue-900/30 text-blue-200 border-blue-700/40';

                  return (
                    <div
                      key={tx.txHash}
                      className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] px-2 py-1 rounded-full border ${badgeClasses}`}>
                            {tx.direction}
                          </span>
                          <span className="text-[var(--text)] font-semibold">
                            {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
                            {tokenSymbol}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                          <span>{tx.timestamp ? formatDateUTC(tx.timestamp) : '—'}</span>
                          <a
                            href={`https://scan.mypinata.cloud/ipfs/bafybeienxyoyrhn5tswclvd3gdjy5mtkkwmu37aqtml6onbf7xnb3o22pe/#/tx/${tx.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            Explorer
                          </a>
                          <button
                            type="button"
                            onClick={() => onToggleExpand(tx.txHash)}
                            className="text-blue-300 hover:text-[var(--text)] transition-colors"
                          >
                            {isExpanded ? 'Hide details' : 'Details'}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-[var(--text)]">
                          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-lg p-2">
                            <p className="text-[var(--text-muted)]">From</p>
                            <a
                              href={`https://scan.mypinata.cloud/ipfs/bafybeienxyoyrhn5tswclvd3gdjy5mtkkwmu37aqtml6onbf7xnb3o22pe/#/address/${tx.from}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-300 hover:underline break-all"
                            >
                              {tx.from || '—'}
                            </a>
                          </div>

                          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-lg p-2">
                            <p className="text-[var(--text-muted)]">To</p>
                            <a
                              href={`https://scan.mypinata.cloud/ipfs/bafybeienxyoyrhn5tswclvd3gdjy5mtkkwmu37aqtml6onbf7xnb3o22pe/#/address/${tx.to}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-300 hover:underline break-all"
                            >
                              {tx.to || '—'}
                            </a>
                          </div>

                          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-lg p-2 md:col-span-2">
                            <p className="text-[var(--text-muted)]">Transaction</p>
                            <a
                              href={`https://scan.mypinata.cloud/ipfs/bafybeienxyoyrhn5tswclvd3gdjy5mtkkwmu37aqtml6onbf7xnb3o22pe/#/tx/${tx.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-300 hover:underline break-all"
                            >
                              {tx.txHash}
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Stakes tab (HEX only) */}
          {tab === 'stakes' && isHex && (
            <HexStakes address={holderAddress} hexUsd={tokenPriceUsd} />
          )}
        </div>
      </div>
    </div>
  );
}
