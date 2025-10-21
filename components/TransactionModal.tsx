'use client';

import React, { useState, useEffect } from 'react';
import { TransactionData, TransactionModalProps } from '../types';
import { LoaderOne } from './ui/loader';

const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  tokenAddress,
  tokenSymbol
}) => {
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [transactionCounts, setTransactionCounts] = useState<any>(null);
  const [pairInfo, setPairInfo] = useState<any>(null);
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && tokenAddress) {
      fetchTransactions();
    }
  }, [isOpen, tokenAddress]);

  const fetchTransactions = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/tokens/${tokenAddress}/transactions`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      
      const data = await response.json();
      setTransactions(data.items || []);
      setTransactionCounts(data.transactionCounts || null);
      setPairInfo(data.pairInfo || null);
      setMessage(data.message || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date().getTime();
    const transactionTime = new Date(timestamp).getTime();
    const diffInSeconds = Math.floor((now - transactionTime) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}m ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(2);
  };

  const formatAddress = (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatPrice = (price: number): string => {
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="fixed inset-4 md:inset-10 bg-gray-900 rounded-xl overflow-hidden z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-white">Transactions</h2>
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-orange-500 text-white text-sm rounded-md">
                Txns
              </button>
              <button className="px-3 py-1 bg-gray-700 text-gray-300 text-sm rounded-md">
                Top Traders
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="scale-75">
                <LoaderOne />
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={fetchTransactions}
                className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8">
              {message && (
                <div className="mb-6 text-center">
                  <p className="text-yellow-400 mb-4">{message}</p>
                  {pairInfo && (
                    <div className="bg-gray-800 rounded-lg p-4 mb-4">
                      <h3 className="text-white font-semibold mb-2">Pair Information</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Base Token:</span>
                          <p className="text-white">{pairInfo.baseToken?.name} ({pairInfo.baseToken?.symbol})</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Quote Token:</span>
                          <p className="text-white">{pairInfo.quoteToken?.name} ({pairInfo.quoteToken?.symbol})</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Price (USD):</span>
                          <p className="text-white">${pairInfo.priceUsd}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">24h Volume:</span>
                          <p className="text-white">${pairInfo.volume24h?.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {transactionCounts && (
                    <div className="bg-gray-800 rounded-lg p-4">
                      <h3 className="text-white font-semibold mb-4">Transaction Counts</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Last 5 Minutes:</span>
                          <div className="flex gap-4 mt-1">
                            <span className="text-green-500">Buys: {transactionCounts.last5Minutes?.buys || 0}</span>
                            <span className="text-red-500">Sells: {transactionCounts.last5Minutes?.sells || 0}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400">Last 1 Hour:</span>
                          <div className="flex gap-4 mt-1">
                            <span className="text-green-500">Buys: {transactionCounts.last1Hour?.buys || 0}</span>
                            <span className="text-red-500">Sells: {transactionCounts.last1Hour?.sells || 0}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400">Last 6 Hours:</span>
                          <div className="flex gap-4 mt-1">
                            <span className="text-green-500">Buys: {transactionCounts.last6Hours?.buys || 0}</span>
                            <span className="text-red-500">Sells: {transactionCounts.last6Hours?.sells || 0}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400">Last 24 Hours:</span>
                          <div className="flex gap-4 mt-1">
                            <span className="text-green-500">Buys: {transactionCounts.last24Hours?.buys || 0}</span>
                            <span className="text-red-500">Sells: {transactionCounts.last24Hours?.sells || 0}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!message && <p className="text-gray-400">No transactions found</p>}
            </div>
          ) : (
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-300 font-medium">
                      <div className="flex items-center gap-1">
                        DATE
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-gray-300 font-medium">
                      <div className="flex items-center gap-1">
                        TYPE
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-gray-300 font-medium">
                      <div className="flex items-center gap-1">
                        USD
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-gray-300 font-medium">
                      <div className="flex items-center gap-1">
                        {tokenSymbol.toUpperCase()}
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-gray-300 font-medium">
                      <div className="flex items-center gap-1">
                        WPLS
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-gray-300 font-medium">
                      <div className="flex items-center gap-1">
                        PRICE
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-gray-300 font-medium">
                      <div className="flex items-center gap-1">
                        MAKER
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-gray-300 font-medium">
                      <div className="flex items-center gap-1">
                        TXN
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx, index) => (
                    <tr key={index} className="hover:bg-gray-800 border-b border-gray-700">
                      <td className="px-4 py-3 text-white">
                        {formatTimeAgo(tx.timestamp)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={tx.type === 'sell' ? 'text-red-500' : 'text-green-500'}>
                          {tx.type === 'sell' ? 'Sell' : 'Buy'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white">
                        {formatNumber(tx.usdValue)}
                      </td>
                      <td className="px-4 py-3 text-white">
                        {formatNumber(tx.tokenAmount)}
                      </td>
                      <td className="px-4 py-3 text-white">
                        {formatNumber(tx.wplsAmount)}
                      </td>
                      <td className="px-4 py-3 text-white flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                        </svg>
                        {formatPrice(tx.price)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {/* Conditional maker icon */}
                          {index % 2 === 0 ? (
                            <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="12" r="10"/>
                            </svg>
                          )}
                          <span className="text-white border-b border-dashed border-white/20">
                            {formatAddress(tx.makerAddress)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`https://scan.pulsechain.box/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionModal;
