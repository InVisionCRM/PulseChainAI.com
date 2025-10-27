'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SwapTransactionData, TransactionModalProps, TransactionAsset } from '../types';
import { LoaderOne } from './ui/loader';
import AddressDetailsModal from './AddressDetailsModal';
import { Input } from './ui/input';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { 
  ExternalLink, 
  ArrowUp, 
  ArrowDown, 
  Filter, 
  RefreshCw, 
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { dexscreenerApi } from '@/services/blockchain/dexscreenerApi';

// Logo cache to avoid refetching
const logoCache = new Map<string, string>();

const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  tokenAddress,
  tokenSymbol,
  priceUsd = 0,
  priceWpls = 0
}) => {
  const [transactions, setTransactions] = useState<SwapTransactionData[]>([]);
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [hasMorePages, setHasMorePages] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  
  // Wallet hover functionality
  const [showAddressModal, setShowAddressModal] = useState<boolean>(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);

  // New state for advanced features
  const [activeTab, setActiveTab] = useState<'portfolio' | 'transactions' | 'multichain' | 'spending'>('transactions');
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'contract' | 'receive' | 'send' | 'swap' | 'approval'>('all');
  const [tokenFilter, setTokenFilter] = useState<string>('');
  const [viewAsYou, setViewAsYou] = useState<boolean>(true);
  const [filteredTransactions, setFilteredTransactions] = useState<SwapTransactionData[]>([]);
  const [tokenLogos, setTokenLogos] = useState<Record<string, string>>({});
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  // Pagination for filtered transactions
  const [filteredCurrentPage, setFilteredCurrentPage] = useState<number>(1);
  const [filteredItemsPerPage] = useState<number>(25);
  const [totalFilteredPages, setTotalFilteredPages] = useState<number>(1);

  // Fetch token logo using multiple sources (like lookintorh-clone.tsx)
  const fetchTokenLogo = useCallback(async (tokenAddress: string): Promise<string | null> => {
    // Validate address format
    if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      console.warn(`Invalid token address for logo fetch: ${tokenAddress}`);
      return null;
    }

    // Check cache first
    if (logoCache.has(tokenAddress.toLowerCase())) {
      return logoCache.get(tokenAddress.toLowerCase()) || null;
    }

    try {
      // Try DexScreener first (most reliable for PulseChain tokens)
      const result = await dexscreenerApi.getTokenProfile(tokenAddress);
      if (result.success && result.data) {
        const logoUrl = result.data.tokenInfo?.logoURI || 
                       result.data.tokenInfo?.iconImageUrl ||
                       result.data.profile?.logo ||
                       result.data.profile?.iconImageUrl ||
                       result.data.pairs?.[0]?.baseToken?.logoURI || 
                       result.data.pairs?.[0]?.info?.imageUrl || 
                       null;
        
        if (logoUrl) {
          logoCache.set(tokenAddress.toLowerCase(), logoUrl);
          return logoUrl;
        }
      }
    } catch (error) {
      console.error(`Error fetching logo from DexScreener for ${tokenAddress}:`, error);
    }

    try {
      // Fallback to direct DexScreener API call
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
      if (response.ok) {
        const data = await response.json();
        if (data.pairs && data.pairs.length > 0) {
          const pair = data.pairs[0];
          if (pair.info?.imageUrl) {
            logoCache.set(tokenAddress.toLowerCase(), pair.info.imageUrl);
            return pair.info.imageUrl;
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching logo from direct DexScreener API for ${tokenAddress}:`, error);
    }

    // Final fallback to CoinGecko CDN for known tokens
    const knownTokens: { [key: string]: string } = {
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 'https://assets.coingecko.com/coins/images/279/large/ethereum.png', // WETH
      '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39': 'https://assets.coingecko.com/coins/images/10103/large/HEX-logo.png', // HEX
      '0x95B303987A60C71504D99Aa1b13B4DA07b0790ab': 'https://assets.coingecko.com/coins/images/25437/large/pulsex.png', // PLSX
      '0xA1077a294dDE1B09bB078844df40758a5D0f9a27': 'https://assets.coingecko.com/coins/images/279/large/ethereum.png', // WPLS (use ETH logo)
    };

    const fallbackLogo = knownTokens[tokenAddress.toLowerCase()];
    if (fallbackLogo) {
      logoCache.set(tokenAddress.toLowerCase(), fallbackLogo);
      return fallbackLogo;
    }
    
    return null;
  }, []);

  // Fetch all token logos for transactions
  const fetchAllTokenLogos = useCallback(async (txs: SwapTransactionData[]) => {
    const logos: Record<string, string> = {};
    const uniqueTokens = new Set<string>();

    // Collect all unique token addresses
    txs.forEach(tx => {
      tx.sentAssets?.forEach(asset => uniqueTokens.add(asset.tokenAddress));
      tx.receivedAssets?.forEach(asset => uniqueTokens.add(asset.tokenAddress));
    });

    // Fetch logos for all unique tokens
    await Promise.all(
      Array.from(uniqueTokens).map(async (tokenAddr) => {
        const logo = await fetchTokenLogo(tokenAddr);
        if (logo) {
          logos[tokenAddr.toLowerCase()] = logo;
        }
      })
    );

    setTokenLogos(logos);
  }, [fetchTokenLogo]);

  useEffect(() => {
    if (isOpen && tokenAddress) {
      setCurrentPage(1);
      setTransactions([]);
      fetchTransactions(1, true);
    }
  }, [isOpen, tokenAddress]);

  // Filter transactions based on current filters
  useEffect(() => {
    let filtered = transactions;

    // Filter by transaction type
    if (transactionFilter !== 'all') {
      filtered = filtered.filter(tx => {
        switch (transactionFilter) {
          case 'swap':
            return tx.type === 'swap';
          case 'send':
            return tx.sentAssets && tx.sentAssets.length > 0;
          case 'receive':
            return tx.receivedAssets && tx.receivedAssets.length > 0;
          default:
            return true;
        }
      });
    }

    // Filter by token address
    if (tokenFilter.trim()) {
      filtered = filtered.filter(tx => {
        const filterLower = tokenFilter.toLowerCase();
        const hasSentToken = tx.sentAssets?.some(asset => 
          asset.tokenAddress.toLowerCase().includes(filterLower)
        );
        const hasReceivedToken = tx.receivedAssets?.some(asset => 
          asset.tokenAddress.toLowerCase().includes(filterLower)
        );
        return hasSentToken || hasReceivedToken;
      });
    }

    // Calculate pagination
    const totalPages = Math.ceil(filtered.length / filteredItemsPerPage);
    setTotalFilteredPages(totalPages);
    
    // Reset to first page when filters change
    setFilteredCurrentPage(1);
    
    setFilteredTransactions(filtered);
  }, [transactions, transactionFilter, tokenFilter, filteredItemsPerPage]);

  // Calculate paginated transactions
  const startIndex = (filteredCurrentPage - 1) * filteredItemsPerPage;
  const endIndex = startIndex + filteredItemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  const fetchTransactions = async (page: number = 1, reset: boolean = false) => {
    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);
    
    try {
      // Call new swap transactions API endpoint
      const response = await fetch(`/api/address/${tokenAddress}/swap-transactions?page=${page}&limit=50`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      
      const data = await response.json();
      
      const newTransactions = data.items || [];
      
      if (reset) {
        setTransactions(newTransactions);
        // Fetch logos for new transactions
        await fetchAllTokenLogos(newTransactions);
      } else {
        const combined = [...transactions, ...newTransactions];
        setTransactions(combined);
        // Fetch logos for new transactions only
        await fetchAllTokenLogos(newTransactions);
      }
      
      setHasMorePages(data.pagination?.has_next_page || false);
      setMessage(data.message || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setIsRefreshing(false);
    }
  };

  const loadMoreTransactions = () => {
    if (!isLoadingMore && hasMorePages) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchTransactions(nextPage, false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setCurrentPage(1);
    fetchTransactions(1, true);
  };

  const handleAddressClick = (address: string) => {
    setSelectedAddress(address);
    setShowAddressModal(true);
  };

  const handleExternalLinkClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleFilterByToken = (tokenAddress: string) => {
    setTokenFilter(tokenAddress);
  };

  const formatDetailedTimeAgo = (timestamp: string): string => {
    const now = new Date().getTime();
    const transactionTime = new Date(timestamp).getTime();
    const diffInSeconds = Math.floor((now - transactionTime) / 1000);

    const weeks = Math.floor(diffInSeconds / 604800);
    const days = Math.floor((diffInSeconds % 604800) / 86400);
    const hours = Math.floor((diffInSeconds % 86400) / 3600);

    if (weeks > 0) {
      return `${weeks} week${weeks > 1 ? 's' : ''} and ${days} day${days !== 1 ? 's' : ''} ago`;
    } else if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} and ${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }
  };

  const getDisplayAddress = (address: string, isUserAddress: boolean): string => {
    if (viewAsYou && isUserAddress) {
      return 'You';
    }
    if (address.startsWith('✗')) {
      return address; // DEX name
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-slate-850 rounded-xl overflow-hidden z-50 flex flex-col max-w-7xl w-full max-h-[95vh] mx-4 my-6 border border-gray-700">
        {/* Top Navigation Tabs */}
        <div className="flex items-center justify-between px-4 pt-4 pb-0 border-b border-gray-700">
          <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-transparent border-b-0 h-auto p-0">
              <TabsTrigger 
                value="portfolio" 
                className="text-sm data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white data-[state=active]:text-white text-gray-400 rounded-none pb-3"
              >
                Portfolio
              </TabsTrigger>
              <TabsTrigger 
                value="transactions" 
                className="text-sm data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white data-[state=active]:text-white text-gray-400 rounded-none pb-3"
              >
                Transactions
              </TabsTrigger>
              <TabsTrigger 
                value="multichain" 
                className="text-sm data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white data-[state=active]:text-white text-gray-400 rounded-none pb-3"
              >
                MultiChain Transactions
              </TabsTrigger>
              <TabsTrigger 
                value="spending" 
                className="text-sm data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white data-[state=active]:text-white text-gray-400 rounded-none pb-3"
              >
                Spending Caps
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors ml-4 mb-3"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Transactions Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white">Transactions</h2>
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">View as You</span>
              <button
                onClick={() => setViewAsYou(!viewAsYou)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  viewAsYou ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    viewAsYou ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Input
              type="text"
              placeholder="Paste token address to filter..."
              value={tokenFilter}
              onChange={(e) => setTokenFilter(e.target.value)}
              className="w-64 bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-gray-500"
            />
          </div>
        </div>

        {/* Transaction Filters */}
        <div className="flex items-center gap-2 p-4 border-b border-gray-700">
          {['All', 'Contract Interaction', 'Receive', 'Send', 'Swap', 'Token Approval'].map((filter, index) => {
            const filterKey = ['all', 'contract', 'receive', 'send', 'swap', 'approval'][index] as any;
            const isActive = transactionFilter === filterKey;
            return (
              <button
                key={filter}
                onClick={() => setTransactionFilter(filterKey)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  isActive 
                    ? 'bg-white text-gray-900 font-medium' 
                    : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {filter}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="scale-75">
                <LoaderOne />
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => fetchTransactions(1, true)}
                className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 p-8">
              No transactions found
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {/* Display swap transactions */}
              {paginatedTransactions.map((tx) => (
                <div key={tx.id} className="bg-slate-950 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
                  {/* Transaction Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold">Swap</span>
                      <span className="text-white">
                        From: {getDisplayAddress(tx.from, tx.from === 'You')}
                      </span>
                      <span className="text-white">
                        To: {tx.to}
                      </span>
                        </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm">{formatDetailedTimeAgo(tx.timestamp)}</span>
                      <button 
                        onClick={() => handleExternalLinkClick(`https://scan.pulsechain.com/tx/${tx.txHash}`)}
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Sent Assets */}
                  {tx.sentAssets && tx.sentAssets.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {tx.sentAssets.map((asset, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ArrowUp className="w-4 h-4 text-red-500 flex-shrink-0" />
                            {tokenLogos[asset.tokenAddress.toLowerCase()] ? (
                              <img 
                                src={tokenLogos[asset.tokenAddress.toLowerCase()]} 
                                alt={asset.symbol}
                                className="w-5 h-5 rounded-full flex-shrink-0"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-gray-700 flex-shrink-0" />
                            )}
                            <span className="text-white font-medium">{asset.amount} {asset.symbol}</span>
                            {asset.value > 0 && (
                              <span className="text-gray-400">(${asset.value.toFixed(2)})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleExternalLinkClick(`https://scan.pulsechain.com/token/${asset.tokenAddress}`)}
                              className="p-1 text-gray-400 hover:text-white transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => handleFilterByToken(asset.tokenAddress)}
                              className="p-1 text-gray-400 hover:text-white transition-colors"
                            >
                              <Filter className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Received Assets */}
                  {tx.receivedAssets && tx.receivedAssets.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {tx.receivedAssets.map((asset, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ArrowDown className="w-4 h-4 text-green-500 flex-shrink-0" />
                            {tokenLogos[asset.tokenAddress.toLowerCase()] ? (
                              <img 
                                src={tokenLogos[asset.tokenAddress.toLowerCase()]} 
                                alt={asset.symbol}
                                className="w-5 h-5 rounded-full flex-shrink-0"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-gray-700 flex-shrink-0" />
                            )}
                            <span className="text-white font-medium">{asset.amount} {asset.symbol}</span>
                            <span className="text-gray-400">(${asset.value.toFixed(2)})</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleExternalLinkClick(`https://scan.pulsechain.com/token/${asset.tokenAddress}`)}
                              className="p-1 text-gray-400 hover:text-white transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => handleFilterByToken(asset.tokenAddress)}
                              className="p-1 text-gray-400 hover:text-white transition-colors"
                            >
                              <Filter className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Transaction Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                    <div className="flex items-center gap-2">
                      {tx.status === 'success' ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-green-500 text-sm font-medium">Success</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-red-500" />
                          <span className="text-red-500 text-sm font-medium">Failed</span>
                        </>
                      )}
            </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-sm">
                        Gas: {tx.gasUsed} {tx.gasSymbol} (${tx.gasValue.toFixed(2)})
                      </span>
                      </div>
                      </div>
                        </div>
              ))}
              
              {/* Pagination Controls */}
              {totalFilteredPages > 1 && (
                <div className="flex justify-center items-center gap-2 p-4">
                  <button
                    onClick={() => setFilteredCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={filteredCurrentPage === 1}
                    className="px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  
                  <span className="text-white px-4">
                    Page {filteredCurrentPage} of {totalFilteredPages}
                  </span>
                  
                  <button
                    onClick={() => setFilteredCurrentPage(prev => Math.min(totalFilteredPages, prev + 1))}
                    disabled={filteredCurrentPage === totalFilteredPages}
                    className="px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Address Details Modal */}
      {selectedAddress && (
        <AddressDetailsModal
          isOpen={showAddressModal}
          onClose={() => {
            setShowAddressModal(false);
            setSelectedAddress(null);
          }}
          address={selectedAddress}
          tokenAddress={tokenAddress}
          tokenSymbol={tokenSymbol}
        />
      )}
    </div>
  );
};

export default TransactionModal;
