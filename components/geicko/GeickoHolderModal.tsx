"use client";

import React, { useEffect, useState } from 'react';
import { LoaderThree } from '@/components/ui/loader';
import { truncateAddress } from './utils';
import { HexStakes } from '@/components/portfolio/HexStakes';
import { ActivityFeed } from '@/components/portfolio/ActivityFeed';
import { isHexAddress } from '@/lib/hex/hexDay';
import { fmtUsd, fmtAmount } from '@/lib/format';
import { portfolioService } from '@/services';
import type { PortfolioToken } from '@/services';

type HolderModalTab = 'portfolio' | 'transactions' | 'stakes';

export interface GeickoHolderModalProps {
  /** Is modal open */
  isOpen: boolean;
  /** Holder address being viewed */
  holderAddress: string | null;
  /** Address of the token being viewed — enables the HEX "Stakes" tab. */
  tokenAddress?: string;
  /** Current token (HEX) USD price, for USD figures in the stakes view. */
  tokenPriceUsd?: number | null;
  /** Callback when modal is closed */
  onClose: () => void;
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
  tokenAddress,
  tokenPriceUsd,
  onClose,
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
                  <div className="col-span-3 text-left">Balance</div>
                  <div className="col-span-3 text-left">Value</div>
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

                      <div className="col-span-3 text-left text-[var(--text)] font-mono truncate">
                        {fmtAmount(token.balanceFormatted)}
                      </div>

                      <div className="col-span-3 text-left text-[var(--text)] font-semibold font-mono truncate">
                        {token.valueUsd != null ? fmtUsd(token.valueUsd) : 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* Transactions tab — reuse the Portfolio page's decoded activity feed. */}
          {tab === 'transactions' && (
            <ActivityFeed walletAddress={holderAddress} chains={['pulsechain']} />
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
