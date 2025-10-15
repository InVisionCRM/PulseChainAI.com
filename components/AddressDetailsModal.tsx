'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { pulsechainApiService } from '@/services/pulsechainApiService';
import type { AddressInfo, TokenTransfer, Transaction } from '@/services/pulsechainApiService';
import { LoaderThree } from '@/components/ui/loader';

interface AddressDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  tokenAddress: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
}

// Transfer Item Component
interface TransferItemProps {
  transfer: any;
  address: string;
  tokenSymbol: string;
  formatAddress: (addr: string) => string;
  formatAmount: (value: string, decimals?: number) => string;
  formatTime: (timestamp: string) => string;
  openInExplorer: (path: string) => void;
  copyToClipboard: (text: string) => void;
  handleShowMore: (transfer: any) => void;
}

const TransferItem: React.FC<TransferItemProps> = ({
  transfer,
  address,
  tokenSymbol,
  formatAddress,
  formatAmount,
  formatTime,
  openInExplorer,
  copyToClipboard,
  handleShowMore,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const fromAddress = transfer.from?.hash || transfer.from;
  const toAddress = transfer.to?.hash || transfer.to;
  const isSent = fromAddress?.toLowerCase() === address.toLowerCase();
  const isReceived = toAddress?.toLowerCase() === address.toLowerCase();

  // Check if counterparty is a contract (likely DEX/LP)
  const fromIsContract = transfer.from?.is_contract || false;
  const toIsContract = transfer.to?.is_contract || false;

  // Determine if it's a buy/sell or just a transfer
  let actionType = '';
  let actionColor = '';

  if (isSent) {
    // User sent tokens
    if (toIsContract) {
      actionType = '📉 SELL';
      actionColor = 'bg-red-600/20 border-red-500/30 text-red-300';
    } else {
      actionType = '📤 SENT';
      actionColor = 'bg-orange-600/20 border-orange-500/30 text-orange-300';
    }
  } else {
    // User received tokens
    if (fromIsContract) {
      actionType = '📈 BUY';
      actionColor = 'bg-green-600/20 border-green-500/30 text-green-300';
    } else {
      actionType = '📥 RECEIVED';
      actionColor = 'bg-blue-600/20 border-blue-500/30 text-blue-300';
    }
  }

  // Determine the counterparty and token used
  const counterpartyAddress = isSent ? toAddress : fromAddress;
  const otherTokenSymbol = transfer.token?.symbol || 'tokens';
  const actionVerb = isSent ? (toIsContract ? 'sold' : 'sent') : (fromIsContract ? 'bought' : 'received');

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg overflow-hidden hover:bg-slate-800/50 transition-colors">
      {/* Collapsed View */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 text-left hover:bg-slate-700/30 transition-colors cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <span className={`px-2 py-1 border rounded text-xs font-medium ${actionColor}`}>
              {actionType}
            </span>
            <span className="text-sm text-white">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openInExplorer(`address/${address}`);
                }}
                className="text-purple-400 hover:text-purple-300 transition-colors font-medium underline"
              >
                {formatAddress(address)}
              </button>
              {' '}{actionVerb}{' '}
              <span className="font-bold">{tokenSymbol}</span>
              {' '}for{' '}
              <span className="font-medium">{otherTokenSymbol}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 whitespace-nowrap">
              {formatTime(transfer.timestamp)}
            </span>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50">
          <div className="flex items-center gap-2 flex-wrap pt-3">
            <span className="text-lg font-bold text-white">
              {formatAmount(transfer.total?.value || transfer.value || '0')} {tokenSymbol}
            </span>
            {transfer.method && (
              <span className="px-2 py-1 bg-purple-600/20 border border-purple-500/30 rounded text-xs text-purple-300 font-medium">
                {transfer.method}
              </span>
            )}
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2 text-slate-400">
              <span className="text-slate-500 w-12">From:</span>
              <button
                onClick={() => openInExplorer(`address/${fromAddress}`)}
                className="font-mono text-purple-400 hover:text-purple-300 transition-colors underline"
              >
                {formatAddress(fromAddress || 'Unknown')}
              </button>
              {isSent && (
                <span className="text-purple-400 font-medium">(You)</span>
              )}
              {fromIsContract && !isSent && (
                <span className="px-1.5 py-0.5 bg-blue-600/20 border border-blue-500/30 rounded text-xs text-blue-300">
                  Contract
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="text-slate-500 w-12">To:</span>
              <button
                onClick={() => openInExplorer(`address/${toAddress}`)}
                className="font-mono text-purple-400 hover:text-purple-300 transition-colors underline"
              >
                {formatAddress(toAddress || 'Unknown')}
              </button>
              {isReceived && (
                <span className="text-purple-400 font-medium">(You)</span>
              )}
              {toIsContract && !isReceived && (
                <span className="px-1.5 py-0.5 bg-blue-600/20 border border-blue-500/30 rounded text-xs text-blue-300">
                  Contract
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-slate-500 w-12">Tx:</span>
                <button
                  onClick={() => openInExplorer(`tx/${transfer.tx_hash || transfer.transaction_hash}`)}
                  className="font-mono text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {formatAddress(transfer.tx_hash || transfer.transaction_hash)}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(transfer.tx_hash || transfer.transaction_hash);
                  }}
                  className="p-1 hover:bg-slate-700/50 rounded transition-colors"
                  title="Copy transaction hash"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => handleShowMore(transfer)}
                className="text-xs text-orange-500 hover:text-orange-400 transition-colors font-medium"
              >
                Show More
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AddressDetailsModal: React.FC<AddressDetailsModalProps> = ({
  isOpen,
  onClose,
  address,
  tokenAddress,
  tokenSymbol = 'TOKEN',
  tokenDecimals = 18,
}) => {
  const [addressInfo, setAddressInfo] = useState<AddressInfo | null>(null);
  const [tokenTransfers, setTokenTransfers] = useState<any[]>([]); // Token-specific transactions
  const [transactions, setTransactions] = useState<any[]>([]); // All transactions
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'transfers' | 'transactions'>('transfers');
  const [transferPage, setTransferPage] = useState(1);
  const [hasMoreTransfers, setHasMoreTransfers] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen && address) {
      fetchAddressData();
    }
  }, [isOpen, address, tokenAddress]);

  const fetchAddressData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch address info
      const info = await pulsechainApiService.getAddressInfo(address);
      setAddressInfo(info);

      // Fetch token-specific transfers using our filtered endpoint
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const transfersUrl = `${baseUrl}/api/address-transfers?address=${address}&tokenAddress=${tokenAddress}&limit=100`;

      console.log('Fetching transfers from:', transfersUrl);
      const transfersResponse = await fetch(transfersUrl);
      
      if (!transfersResponse.ok) {
        console.error('Transfers fetch failed:', transfersResponse.status, transfersResponse.statusText);
        const errorText = await transfersResponse.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch transfers: ${transfersResponse.statusText}`);
      }
      
      const transfersData = await transfersResponse.json();
      console.log('Transfers response:', transfersData);

      // Handle response - extract items array
      const allTransfers = Array.isArray(transfersData)
        ? transfersData
        : transfersData?.items || [];

      console.log('Parsed transfers:', allTransfers.length, 'items');
      setTokenTransfers(allTransfers);
      setHasMoreTransfers(allTransfers.length >= 100);

      // Fetch token-specific transactions using our filtered endpoint
      const txsUrl = `${baseUrl}/api/address-transactions?address=${address}&tokenAddress=${tokenAddress}&limit=50`;
      console.log('Fetching transactions from:', txsUrl);
      
      const txsResponse = await fetch(txsUrl);
      
      if (!txsResponse.ok) {
        console.error('Transactions fetch failed:', txsResponse.status, txsResponse.statusText);
        const errorText = await txsResponse.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch transactions: ${txsResponse.statusText}`);
      }
      
      const txsData = await txsResponse.json();
      console.log('Transactions response:', txsData);

      // Handle response - extract items array
      const txs = Array.isArray(txsData)
        ? txsData
        : txsData?.items || [];

      console.log('Parsed transactions:', txs.length, 'items');
      setTransactions(txs);
    } catch (err) {
      console.error('Error fetching address data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load address data');
    } finally {
      setIsLoading(false);
    }
  }, [address, tokenAddress]);

  const loadMoreTransfers = async () => {
    setIsLoading(true);
    try {
      const nextPage = transferPage + 1;

      // Fetch more token-specific transfers using our filtered endpoint
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const url = `${baseUrl}/api/address-transfers?address=${address}&tokenAddress=${tokenAddress}&page=${nextPage}&limit=100`;

      const moreTransfersResponse = await fetch(url);
      const moreTransfersData = await moreTransfersResponse.json();

      // Handle response - extract items array
      const moreTransfers = Array.isArray(moreTransfersData)
        ? moreTransfersData
        : moreTransfersData?.items || [];

      setTokenTransfers(prev => [...prev, ...moreTransfers]);
      setTransferPage(nextPage);
      setHasMoreTransfers(moreTransfers.length >= 100);
    } catch (err) {
      console.error('Error loading more transfers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatAmount = (value: string, decimals: number = tokenDecimals): string => {
    try {
      const num = Number(value);
      if (!Number.isFinite(num)) return '0';
      const formatted = num / Math.pow(10, decimals);
      return formatted.toLocaleString(undefined, { maximumFractionDigits: 6 });
    } catch {
      return '0';
    }
  };

  const formatAddress = (addr: string): string => {
    return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
  };

  const formatTime = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const openInExplorer = (path: string) => {
    window.open(`https://scan.mypinata.cloud/ipfs/bafybeienxyoyrhn5tswclvd3gdjy5mtkkwmu37aqtml6onbf7xnb3o22pe/#/${path}`, '_blank');
  };

  const handleShowMore = (transaction: any) => {
    setSelectedTransaction(transaction);
    setShowTransactionModal(true);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-b border-slate-700/50 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-white">Address Details</h2>
                  {addressInfo?.is_contract && (
                    <span className="px-3 py-1 bg-blue-600/20 border border-blue-500/30 rounded-full text-xs text-blue-300 font-medium">
                      📄 Contract
                    </span>
                  )}
                  {addressInfo?.is_verified && (
                    <span className="px-3 py-1 bg-green-600/20 border border-green-500/30 rounded-full text-xs text-green-300 font-medium">
                      ✓ Verified
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <code className="text-sm font-mono bg-slate-800/50 px-3 py-1 rounded border border-slate-700/50">
                    {formatAddress(address)}
                  </code>
                  <button
                    onClick={() => copyToClipboard(address)}
                    className="p-2 hover:bg-slate-700/50 rounded transition-colors"
                    title="Copy full address"
                    aria-label="Copy full address"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => openInExplorer(`address/${address}`)}
                    className="p-2 hover:bg-slate-700/50 rounded transition-colors"
                    title="View in explorer"
                    aria-label="View in explorer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white"
                aria-label="Close modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-slate-700/50">
            <div className="flex gap-1 p-2">
              {[
                { id: 'transfers', label: `${tokenSymbol} Transfers`, icon: '🔄' },
                { id: 'transactions', label: `${tokenSymbol} Transactions`, icon: '📋' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(85vh-180px)]">
            {isLoading && !addressInfo ? (
              <div className="flex items-center justify-center py-12">
                <LoaderThree />
              </div>
            ) : error ? (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-red-300">
                <strong>Error: </strong>
                {error}
              </div>
            ) : (
              <>
                {/* Token Transfers Tab */}
                {activeTab === 'transfers' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">
                        {tokenSymbol} Transfers ({tokenTransfers.length})
                      </h3>
                      <span className="text-xs text-slate-400">
                        Token transfers to/from this address
                      </span>
                    </div>

                    {tokenTransfers.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        No {tokenSymbol} transfers found for this address
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          {tokenTransfers.map((transfer: any, index: number) => (
                            <TransferItem
                              key={transfer.tx_hash || transfer.transaction_hash || index}
                              transfer={transfer}
                              address={address}
                              tokenSymbol={tokenSymbol}
                              formatAddress={formatAddress}
                              formatAmount={formatAmount}
                              formatTime={formatTime}
                              openInExplorer={openInExplorer}
                              copyToClipboard={copyToClipboard}
                              handleShowMore={handleShowMore}
                            />
                          ))}
                        </div>

                        {hasMoreTransfers && (
                          <button
                            onClick={loadMoreTransfers}
                            disabled={isLoading}
                            className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isLoading ? 'Loading...' : 'Load More'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Transactions Tab */}
                {activeTab === 'transactions' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">
                        Recent Transactions ({transactions.length})
                      </h3>
                    </div>

                    {transactions.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        No transactions found for this address
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {transactions.map((tx) => (
                          <div
                            key={tx.hash}
                            className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 hover:bg-slate-800/50 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  tx.status === 'success' || tx.status === 'ok'
                                    ? 'bg-green-600/20 border border-green-500/30 text-green-300'
                                    : 'bg-red-600/20 border border-red-500/30 text-red-300'
                                }`}>
                                  {tx.status === 'success' || tx.status === 'ok' ? 'Success' : 'Failed'}
                                </span>
                                {tx.method && (
                                  <span className="px-2 py-1 bg-blue-600/20 border border-blue-500/30 rounded text-xs text-blue-300 font-medium">
                                    {tx.method}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-400">
                                {formatTime(tx.timestamp)}
                              </span>
                            </div>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2 text-slate-400">
                                <span className="text-slate-500">Value:</span>
                                <span className="text-white font-medium">
                                  {(parseFloat(tx.value) / 1e18).toFixed(6)} PLS
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-400">
                                <span className="text-slate-500">Fee:</span>
                                <span className="text-white">
                                  {(parseFloat(tx.fee) / 1e18).toFixed(8)} PLS
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-slate-400">
                                  <span className="text-slate-500">Tx Hash:</span>
                                  <button
                                    onClick={() => openInExplorer(`tx/${tx.hash}`)}
                                    className="font-mono text-blue-400 hover:text-blue-300 transition-colors"
                                  >
                                    {formatAddress(tx.hash)}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(tx.hash);
                                    }}
                                    className="p-1 hover:bg-slate-700/50 rounded transition-colors"
                                    title="Copy transaction hash"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  </button>
                                </div>
                                <button
                                  onClick={() => handleShowMore(tx)}
                                  className="text-xs text-orange-500 hover:text-orange-400 transition-colors font-medium"
                                >
                                  Show More
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>

        {/* Transaction Details Modal */}
        {selectedTransaction && (
          <TransactionDetailsModal
            isOpen={showTransactionModal}
            onClose={() => {
              setShowTransactionModal(false);
              setSelectedTransaction(null);
            }}
            transaction={selectedTransaction}
            tokenSymbol={tokenSymbol}
            tokenDecimals={tokenDecimals}
            userAddress={address}
            openInExplorer={openInExplorer}
            copyToClipboard={copyToClipboard}
            formatAddress={formatAddress}
            formatAmount={formatAmount}
            formatTime={formatTime}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};

// Transaction Details Modal Component
interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
  tokenSymbol: string;
  tokenDecimals: number;
  userAddress: string;
  openInExplorer: (path: string) => void;
  copyToClipboard: (text: string) => void;
  formatAddress: (addr: string) => string;
  formatAmount: (value: string, decimals?: number) => string;
  formatTime: (timestamp: string) => string;
}

const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({
  isOpen,
  onClose,
  transaction,
  tokenSymbol,
  tokenDecimals,
  userAddress,
  openInExplorer,
  copyToClipboard,
  formatAddress,
  formatAmount,
  formatTime,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'transfers' | 'internal'>('details');
  const [txDetails, setTxDetails] = useState<any>(null);
  const [tokenTransfers, setTokenTransfers] = useState<any>(null);
  const [internalTxns, setInternalTxns] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isLoadingTransfers, setIsLoadingTransfers] = useState(false);
  const [isLoadingInternal, setIsLoadingInternal] = useState(false);

  const txHash = transaction.tx_hash || transaction.transaction_hash || transaction.hash;

  // Fetch transaction details
  useEffect(() => {
    if (isOpen && activeTab === 'details' && !txDetails) {
      fetchTransactionDetails();
    }
  }, [isOpen, activeTab, txHash]);

  // Fetch token transfers
  useEffect(() => {
    if (isOpen && activeTab === 'transfers' && !tokenTransfers) {
      fetchTokenTransfers();
    }
  }, [isOpen, activeTab, txHash]);

  // Fetch internal transactions
  useEffect(() => {
    if (isOpen && activeTab === 'internal' && !internalTxns) {
      fetchInternalTransactions();
    }
  }, [isOpen, activeTab, txHash]);

  const fetchTransactionDetails = async () => {
    setIsLoadingDetails(true);
    try {
      const response = await fetch(`https://scan.pulsechain.box/api/v2/transactions/${txHash}`);
      const data = await response.json();
      setTxDetails(data);
    } catch (error) {
      console.error('Error fetching transaction details:', error);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const fetchTokenTransfers = async () => {
    setIsLoadingTransfers(true);
    try {
      const response = await fetch(`https://scan.pulsechain.box/api/v2/transactions/${txHash}/token-transfers?type=ERC-20%2CERC-721%2CERC-1155`);
      const data = await response.json();
      setTokenTransfers(data);
    } catch (error) {
      console.error('Error fetching token transfers:', error);
    } finally {
      setIsLoadingTransfers(false);
    }
  };

  const fetchInternalTransactions = async () => {
    setIsLoadingInternal(true);
    try {
      const response = await fetch(`https://scan.pulsechain.box/api/v2/transactions/${txHash}/internal-transactions`);
      const data = await response.json();
      setInternalTxns(data);
    } catch (error) {
      console.error('Error fetching internal transactions:', error);
    } finally {
      setIsLoadingInternal(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with large TX hash */}
          <div className="border-b border-slate-700/50 p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Transaction details</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white"
                aria-label="Close transaction details"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Large TX Hash */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => openInExplorer(`tx/${txHash}`)}
                className="text-lg font-mono font-bold text-slate-300 hover:text-white transition-colors break-all text-left"
              >
                {txHash}
              </button>
              <button
                onClick={() => copyToClipboard(txHash)}
                className="p-2 hover:bg-slate-700/50 rounded transition-colors text-slate-400 hover:text-white flex-shrink-0"
                title="Copy transaction hash"
                aria-label="Copy transaction hash"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-slate-700/50 px-6">
            <div className="flex gap-6">
              {[
                { id: 'details', label: 'Details' },
                { id: 'transfers', label: 'Token transfers' },
                { id: 'internal', label: 'Internal txns' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-3 px-1 font-medium text-sm border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-white'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-220px)]">
            {activeTab === 'details' && (
              <DetailsTab
                txDetails={txDetails}
                isLoading={isLoadingDetails}
                formatAddress={formatAddress}
                openInExplorer={openInExplorer}
                copyToClipboard={copyToClipboard}
                formatTime={formatTime}
              />
            )}
            {activeTab === 'transfers' && (
              <TransfersTab
                tokenTransfers={tokenTransfers}
                isLoading={isLoadingTransfers}
                formatAddress={formatAddress}
                openInExplorer={openInExplorer}
              />
            )}
            {activeTab === 'internal' && (
              <InternalTab
                internalTxns={internalTxns}
                isLoading={isLoadingInternal}
                formatAddress={formatAddress}
                openInExplorer={openInExplorer}
              />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Details Tab Component
const DetailsTab: React.FC<{
  txDetails: any;
  isLoading: boolean;
  formatAddress: (addr: string) => string;
  openInExplorer: (path: string) => void;
  copyToClipboard: (text: string) => void;
  formatTime: (timestamp: string) => string;
}> = ({ txDetails, isLoading, formatAddress, openInExplorer, copyToClipboard, formatTime }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!txDetails) {
    return <div className="text-slate-400 text-center py-12">No transaction details available</div>;
  }

  const gasUsagePercentage = txDetails.gas_used && txDetails.gas_limit
    ? (parseInt(txDetails.gas_used) / parseInt(txDetails.gas_limit)) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Transaction hash */}
      <div className="flex items-start gap-4">
        <div className="text-slate-400 text-sm w-48 flex-shrink-0 pt-1">Transaction hash</div>
        <div className="flex items-center gap-2 flex-1">
          <code className="text-white text-sm font-mono break-all">{txDetails.hash}</code>
          <button
            onClick={() => copyToClipboard(txDetails.hash)}
            className="p-1 hover:bg-slate-700/50 rounded transition-colors text-slate-400"
            aria-label="Copy transaction hash"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Status and method */}
      <div className="flex items-start gap-4">
        <div className="text-slate-400 text-sm w-48 flex-shrink-0 pt-1">Status and method</div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-green-600/20 border border-green-500/30 rounded text-xs text-green-300 font-medium">
            {txDetails.status === 'ok' ? 'Success' : txDetails.status}
          </span>
          {txDetails.method && (
            <span className="text-white text-sm">{txDetails.method}</span>
          )}
        </div>
      </div>

      {/* Block */}
      {txDetails.block && (
        <div className="flex items-start gap-4">
          <div className="text-slate-400 text-sm w-48 flex-shrink-0 pt-1">Block</div>
          <div>
            <button
              onClick={() => openInExplorer(`block/${txDetails.block}`)}
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              {txDetails.block}
            </button>
            {txDetails.confirmations && (
              <span className="text-slate-400 text-sm ml-2">
                | {txDetails.confirmations.toLocaleString()} Block confirmations
              </span>
            )}
          </div>
        </div>
      )}

      {/* Timestamp */}
      {txDetails.timestamp && (
        <div className="flex items-start gap-4">
          <div className="text-slate-400 text-sm w-48 flex-shrink-0 pt-1">Timestamp</div>
          <div className="text-white text-sm">
            {formatTime(txDetails.timestamp)} | {new Date(txDetails.timestamp).toLocaleString()}
          </div>
        </div>
      )}

      {/* From */}
      {txDetails.from && (
        <div className="flex items-start gap-4">
          <div className="text-slate-400 text-sm w-48 flex-shrink-0 pt-1">From</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openInExplorer(`address/${txDetails.from.hash}`)}
              className="text-blue-400 hover:text-blue-300 transition-colors font-mono text-sm"
            >
              {formatAddress(txDetails.from.hash)}
            </button>
            <button
              onClick={() => copyToClipboard(txDetails.from.hash)}
              className="p-1 hover:bg-slate-700/50 rounded transition-colors text-slate-400"
              aria-label="Copy from address"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Interacted with contract */}
      {txDetails.to && txDetails.to.is_contract && (
        <div className="flex items-start gap-4">
          <div className="text-slate-400 text-sm w-48 flex-shrink-0 pt-1">Interacted with contract</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openInExplorer(`address/${txDetails.to.hash}`)}
              className="text-blue-400 hover:text-blue-300 transition-colors text-sm"
            >
              {txDetails.to.name || formatAddress(txDetails.to.hash)}
            </button>
            {txDetails.to.is_verified && (
              <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Token transfers */}
      {txDetails.token_transfers && txDetails.token_transfers.length > 0 && (
        <div className="flex items-start gap-4">
          <div className="text-slate-400 text-sm w-48 flex-shrink-0 pt-1">Tokens transferred</div>
          <div className="flex-1 space-y-2">
            {txDetails.token_transfers.slice(0, 10).map((transfer: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => openInExplorer(`address/${transfer.from.hash}`)}
                  className="text-blue-400 hover:text-blue-300 transition-colors font-mono"
                >
                  {formatAddress(transfer.from.hash)}
                </button>
                <span className="text-slate-400">→</span>
                <button
                  onClick={() => openInExplorer(`address/${transfer.to.hash}`)}
                  className="text-blue-400 hover:text-blue-300 transition-colors font-mono"
                >
                  {formatAddress(transfer.to.hash)}
                </button>
                <span className="text-slate-400">for</span>
                <span className="text-white">
                  {parseFloat(transfer.total?.value || transfer.value || '0') / Math.pow(10, transfer.total?.decimals || transfer.token?.decimals || 18)}
                </span>
                <span className="text-slate-400">{transfer.token?.symbol}</span>
              </div>
            ))}
            {txDetails.token_transfers.length > 10 && (
              <button className="text-blue-400 hover:text-blue-300 text-sm">
                View all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Value */}
      <div className="flex items-start gap-4">
        <div className="text-slate-400 text-sm w-48 flex-shrink-0 pt-1">Value</div>
        <div className="text-white text-sm">
          {txDetails.value ? `${(parseFloat(txDetails.value) / 1e18).toFixed(6)} PLS` : '0 PLS'}
        </div>
      </div>

      {/* Transaction fee */}
      {txDetails.fee && (
        <div className="flex items-start gap-4">
          <div className="text-slate-400 text-sm w-48 flex-shrink-0 pt-1">Transaction fee</div>
          <div className="text-white text-sm">
            {(parseFloat(txDetails.fee.value) / 1e18).toFixed(8)} PLS
          </div>
        </div>
      )}

      {/* Gas price */}
      {txDetails.gas_price && (
        <div className="flex items-start gap-4">
          <div className="text-slate-400 text-sm w-48 flex-shrink-0 pt-1">Gas price</div>
          <div className="text-white text-sm">
            {(parseFloat(txDetails.gas_price) / 1e18).toFixed(10)} PLS
          </div>
        </div>
      )}

      {/* Gas usage & limit */}
      {txDetails.gas_used && txDetails.gas_limit && (
        <div className="flex items-start gap-4">
          <div className="text-slate-400 text-sm w-48 flex-shrink-0 pt-1">Gas usage & limit by txn</div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-white text-sm">
                {parseInt(txDetails.gas_used).toLocaleString()}
              </span>
              <span className="text-slate-400 text-sm">|</span>
              <span className="text-white text-sm">
                {parseInt(txDetails.gas_limit).toLocaleString()}
              </span>
              <div className="flex-1 bg-slate-700 rounded-full h-2 max-w-xs">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${gasUsagePercentage}%` }}
                />
              </div>
              <span className="text-green-400 text-sm font-medium">
                {gasUsagePercentage.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Transfers Tab Component
const TransfersTab: React.FC<{
  tokenTransfers: any;
  isLoading: boolean;
  formatAddress: (addr: string) => string;
  openInExplorer: (path: string) => void;
}> = ({ tokenTransfers, isLoading, formatAddress, openInExplorer }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!tokenTransfers || !tokenTransfers.items || tokenTransfers.items.length === 0) {
    return <div className="text-slate-400 text-center py-12">No token transfers found</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-3 px-4 text-slate-400 text-xs font-medium uppercase">Token</th>
            <th className="text-left py-3 px-4 text-slate-400 text-xs font-medium uppercase">Token ID</th>
            <th className="text-left py-3 px-4 text-slate-400 text-xs font-medium uppercase">From/To</th>
            <th className="text-right py-3 px-4 text-slate-400 text-xs font-medium uppercase">Value</th>
          </tr>
        </thead>
        <tbody>
          {tokenTransfers.items.map((transfer: any, idx: number) => (
            <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-800/30">
              <td className="py-4 px-4">
                <div className="flex items-center gap-2">
                  {transfer.token?.icon_url && (
                    <img src={transfer.token.icon_url} alt="" className="w-6 h-6 rounded-full" />
                  )}
                  <div>
                    <div className="text-white text-sm">{transfer.token?.name || 'Unknown'}</div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400">{transfer.token?.type}</span>
                      <span className="px-1.5 py-0.5 bg-orange-600/20 border border-orange-500/30 rounded text-xs text-orange-300">
                        Token transfer
                      </span>
                    </div>
                  </div>
                </div>
              </td>
              <td className="py-4 px-4 text-slate-400 text-sm">
                {transfer.token_id || '-'}
              </td>
              <td className="py-4 px-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openInExplorer(`address/${transfer.from.hash}`)}
                    className="text-blue-400 hover:text-blue-300 transition-colors font-mono text-sm"
                  >
                    {formatAddress(transfer.from.hash)}
                  </button>
                  <span className="text-slate-400">→</span>
                  <button
                    onClick={() => openInExplorer(`address/${transfer.to.hash}`)}
                    className="text-blue-400 hover:text-blue-300 transition-colors font-mono text-sm"
                  >
                    {formatAddress(transfer.to.hash)}
                  </button>
                </div>
              </td>
              <td className="py-4 px-4 text-right text-white text-sm">
                {transfer.total?.value
                  ? (parseFloat(transfer.total.value) / Math.pow(10, transfer.total.decimals || 18)).toFixed(6)
                  : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Internal Tab Component
const InternalTab: React.FC<{
  internalTxns: any;
  isLoading: boolean;
  formatAddress: (addr: string) => string;
  openInExplorer: (path: string) => void;
}> = ({ internalTxns, isLoading, formatAddress, openInExplorer }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!internalTxns || !internalTxns.items || internalTxns.items.length === 0) {
    return <div className="text-slate-400 text-center py-12">No internal transactions found</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-3 px-4 text-slate-400 text-xs font-medium uppercase">Type</th>
            <th className="text-left py-3 px-4 text-slate-400 text-xs font-medium uppercase">From/To</th>
            <th className="text-right py-3 px-4 text-slate-400 text-xs font-medium uppercase">Value PLS</th>
            <th className="text-right py-3 px-4 text-slate-400 text-xs font-medium uppercase">Gas limit PLS</th>
          </tr>
        </thead>
        <tbody>
          {internalTxns.items.map((txn: any, idx: number) => (
            <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-800/30">
              <td className="py-4 px-4">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    txn.type === 'delegatecall' ? 'bg-cyan-600/20 text-cyan-300' :
                    txn.type === 'staticcall' ? 'bg-blue-600/20 text-blue-300' :
                    'bg-teal-600/20 text-teal-300'
                  }`}>
                    {txn.type === 'delegatecall' ? 'Delegate call' :
                     txn.type === 'staticcall' ? 'Static call' : 'Call'}
                  </span>
                  <span className="px-2 py-1 bg-green-600/20 border border-green-500/30 rounded text-xs text-green-300 font-medium">
                    Success
                  </span>
                </div>
              </td>
              <td className="py-4 px-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openInExplorer(`address/${txn.from.hash}`)}
                    className="text-blue-400 hover:text-blue-300 transition-colors font-mono text-sm"
                  >
                    {formatAddress(txn.from.hash)}
                  </button>
                  <span className="text-slate-400">→</span>
                  <button
                    onClick={() => openInExplorer(`address/${txn.to?.hash}`)}
                    className="text-blue-400 hover:text-blue-300 transition-colors font-mono text-sm"
                  >
                    {txn.to ? formatAddress(txn.to.hash) : 'Contract Creation'}
                  </button>
                </div>
              </td>
              <td className="py-4 px-4 text-right text-white text-sm">
                {txn.value ? (parseFloat(txn.value) / 1e18).toFixed(6) : '0'}
              </td>
              <td className="py-4 px-4 text-right text-white text-sm">
                {txn.gas_limit ? parseInt(txn.gas_limit).toLocaleString() : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AddressDetailsModal;
