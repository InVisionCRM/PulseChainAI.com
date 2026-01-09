import React from 'react';
import { LoaderThree } from '@/components/ui/loader';
import { HolderTransfer } from './types';
import { truncateAddress, formatDateUTC } from './utils';

export interface GeickoHolderTransfersModalProps {
  /** Is modal open */
  isOpen: boolean;
  /** Holder address being viewed */
  holderAddress: string | null;
  /** Array of transfers for this holder */
  transfers: HolderTransfer[];
  /** Is data loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Set of expanded transaction hashes */
  expandedTxs: Set<string>;
  /** Token symbol to display */
  tokenSymbol?: string;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when transaction is toggled */
  onToggleExpand: (hash: string) => void;
}

/**
 * Holder Transfers Modal for Geicko
 * Displays transaction history for a specific holder address
 */
export default function GeickoHolderTransfersModal({
  isOpen,
  holderAddress,
  transfers,
  isLoading,
  error,
  expandedTxs,
  tokenSymbol = 'TOKEN',
  onClose,
  onToggleExpand,
}: GeickoHolderTransfersModalProps) {
  if (!isOpen || !holderAddress) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[90vh] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl shadow-2xl border border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-700 bg-gray-900/80 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Holder activity</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-mono text-white">
                {truncateAddress(holderAddress)}
              </span>
              <a
                href={`https://scan.pulsechain.com/address/${holderAddress}`}
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
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close holder transfers"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)] bg-gray-900">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-gray-400 gap-3">
              <LoaderThree />
              <span className="text-sm">Loading transfers...</span>
            </div>
          ) : error ? (
            <div className="text-center text-sm text-red-400 py-6">{error}</div>
          ) : transfers.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-6">
              No transfers found for this holder.
            </div>
          ) : (
            <div className="space-y-3">
              {transfers.map((tx) => {
                const isExpanded = expandedTxs.has(tx.txHash);
                const badgeClasses =
                  tx.direction === 'Buy'
                    ? 'bg-green-900/40 text-green-300 border-green-700/50'
                    : tx.direction === 'Sell'
                    ? 'bg-red-900/40 text-red-300 border-red-700/50'
                    : 'bg-blue-900/30 text-blue-200 border-blue-700/40';

                return (
                  <div
                    key={tx.txHash}
                    className="rounded-lg border border-gray-700 bg-gray-800/70 p-3 shadow-sm"
                  >
                    {/* Transaction Summary */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] px-2 py-1 rounded-full border ${badgeClasses}`}>
                          {tx.direction}
                        </span>
                        <span className="text-white font-semibold">
                          {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}{' '}
                          {tokenSymbol}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{tx.timestamp ? formatDateUTC(tx.timestamp) : '—'}</span>
                        <a
                          href={`https://scan.pulsechain.com/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline"
                        >
                          Explorer
                        </a>
                        <button
                          type="button"
                          onClick={() => onToggleExpand(tx.txHash)}
                          className="text-blue-300 hover:text-white transition-colors"
                        >
                          {isExpanded ? 'Hide details' : 'Details'}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-200">
                        {/* From Address */}
                        <div className="bg-slate-900/90/30 border border-gray-700 rounded-lg p-2">
                          <p className="text-gray-400">From</p>
                          <a
                            href={`https://scan.pulsechain.com/address/${tx.from}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-300 hover:underline break-all"
                          >
                            {tx.from || '—'}
                          </a>
                        </div>

                        {/* To Address */}
                        <div className="bg-slate-900/90/30 border border-gray-700 rounded-lg p-2">
                          <p className="text-gray-400">To</p>
                          <a
                            href={`https://scan.pulsechain.com/address/${tx.to}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-300 hover:underline break-all"
                          >
                            {tx.to || '—'}
                          </a>
                        </div>

                        {/* Transaction Hash */}
                        <div className="bg-slate-900/90/30 border border-gray-700 rounded-lg p-2 md:col-span-2">
                          <p className="text-gray-400">Transaction</p>
                          <a
                            href={`https://scan.pulsechain.com/tx/${tx.txHash}`}
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
          )}
        </div>
      </div>
    </div>
  );
}
