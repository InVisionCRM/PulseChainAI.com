'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { DexScreenerData } from '@/types';
import { pulsechainApiService } from '@/services/pulsechainApiService';
import AddressDetailsModal from './AddressDetailsModal';

interface LiquidityTabProps {
  dexScreenerData: DexScreenerData | null;
  isLoading: boolean;
}

interface PairHolder {
  address: string;
  value: string;
  percentage: number;
}

interface PairHoldersData {
  [pairAddress: string]: {
    holders: PairHolder[];
    isLoading: boolean;
    error: string | null;
    totalSupply: string;
  };
}

interface LiquidityEvent {
  type: 'add' | 'remove';
  timestamp: string;
  txHash: string;
  from: string;
  method: string;
}

interface PairLiquidityEvents {
  [pairAddress: string]: {
    events: LiquidityEvent[];
    isLoading: boolean;
    error: string | null;
  };
}

// Move formatting functions outside component to prevent recreation on each render
const formatNumber = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'N/A';
  
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
};

const formatPercentage = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'N/A';
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
};

const formatHolderBalance = (value: string, decimals: number = 18): string => {
  const num = Number(value);
  if (isNaN(num)) return 'N/A';
  
  const balance = num / Math.pow(10, decimals);
  if (balance >= 1e9) return `${(balance / 1e9).toFixed(2)}B`;
  if (balance >= 1e6) return `${(balance / 1e6).toFixed(2)}M`;
  if (balance >= 1e3) return `${(balance / 1e3).toFixed(2)}K`;
  return balance.toFixed(6);
};

const formatHolderPercentage = (percentage: number): string => {
  if (percentage >= 1) return `${percentage.toFixed(2)}%`;
  if (percentage >= 0.01) return `${percentage.toFixed(4)}%`;
  return `<0.01%`;
};

const formatTimeAgo = (timestamp: string): string => {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const LiquidityTab: React.FC<LiquidityTabProps> = ({ dexScreenerData, isLoading }) => {
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set());
  const [pairHoldersData, setPairHoldersData] = useState<PairHoldersData>({});
  const [pairLiquidityEvents, setPairLiquidityEvents] = useState<PairLiquidityEvents>({});
  const [selectedHolder, setSelectedHolder] = useState<{
    address: string;
    tokenAddress: string;
    tokenSymbol: string;
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchPairHolders = useCallback(async (pairAddress: string) => {
    if (pairHoldersData[pairAddress]) {
      return; // Already fetched or currently fetching
    }

    // Set loading state
    setPairHoldersData(prev => ({
      ...prev,
      [pairAddress]: {
        holders: [],
        isLoading: true,
        error: null,
        totalSupply: '0'
      }
    }));

    try {
      // Fetch both holders and token info for total supply
      const [holdersResult, tokenInfo] = await Promise.all([
        pulsechainApiService.getTokenHolders(pairAddress, 1, 25).catch(() => null), // Get top 25 holders, catch 404
        pulsechainApiService.getTokenInfo(pairAddress).catch(() => null)
      ]);

      let holders: PairHolder[] = [];
      const totalSupply = tokenInfo?.total_supply || '0';

      // Process holders data - now directly from the service
      if (holdersResult && Array.isArray(holdersResult)) {
        holders = holdersResult.map((h: any) => {
          const value = h.value || '0';
          const percentage = totalSupply !== '0' ? (Number(value) / Number(totalSupply)) * 100 : 0;
          return {
            address: h.address?.hash || '',
            value,
            percentage
          };
        }).filter(h => h.address);
      }

      setPairHoldersData(prev => ({
        ...prev,
        [pairAddress]: {
          holders,
          isLoading: false,
          error: holders.length === 0 && !holdersResult ? 'LP token holder data not available for this pair' : null,
          totalSupply
        }
      }));
    } catch (error) {
      console.error('Error fetching pair holders:', error);
      setPairHoldersData(prev => ({
        ...prev,
        [pairAddress]: {
          holders: [],
          isLoading: false,
          error: 'LP token holder data not available',
          totalSupply: '0'
        }
      }));
    }
  }, [pairHoldersData]);

  const fetchLiquidityEvents = useCallback(async (pairAddress: string) => {
    if (pairLiquidityEvents[pairAddress]) {
      return; // Already fetched or currently fetching
    }

    // Set loading state
    setPairLiquidityEvents(prev => ({
      ...prev,
      [pairAddress]: {
        events: [],
        isLoading: true,
        error: null
      }
    }));

    try {
      // Fetch recent transactions for the pair address
      const response = await pulsechainApiService.getAddressTransactions(pairAddress, 1, 50);
      
      // Parse response structure
      const transactions = Array.isArray(response) ? response 
                         : (response as any).data && Array.isArray((response as any).data) ? (response as any).data
                         : (response as any).items && Array.isArray((response as any).items) ? (response as any).items
                         : [];
      
      // Filter for liquidity-related transactions
      const liquidityEvents: LiquidityEvent[] = transactions
        .filter((tx: any) => {
          const method = (tx.method || '').toLowerCase();
          return method.includes('addliquidity') || 
                 method.includes('removeliquidity') ||
                 method.includes('add_liquidity') ||
                 method.includes('remove_liquidity');
        })
        .slice(0, 10) // Only keep the 10 most recent
        .map((tx: any) => {
          const method = (tx.method || '').toLowerCase();
          const isAdd = method.includes('add');
          
          return {
            type: isAdd ? 'add' : 'remove',
            timestamp: tx.timestamp || tx.block_timestamp || '',
            txHash: tx.hash || '',
            from: tx.from?.hash || tx.from || '',
            method: tx.method || 'Unknown'
          } as LiquidityEvent;
        });

      setPairLiquidityEvents(prev => ({
        ...prev,
        [pairAddress]: {
          events: liquidityEvents,
          isLoading: false,
          error: null
        }
      }));
    } catch (error) {
      console.error('Error fetching liquidity events:', error);
      setPairLiquidityEvents(prev => ({
        ...prev,
        [pairAddress]: {
          events: [],
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch liquidity events'
        }
      }));
    }
  }, [pairLiquidityEvents]);

  const togglePairExpansion = useCallback(async (pairAddress: string) => {
    const newExpanded = new Set(expandedPairs);
    if (newExpanded.has(pairAddress)) {
      newExpanded.delete(pairAddress);
    } else {
      newExpanded.add(pairAddress);
      // Fetch both holders data and liquidity events when expanding
      await Promise.all([
        fetchPairHolders(pairAddress),
        fetchLiquidityEvents(pairAddress)
      ]);
    }
    setExpandedPairs(newExpanded);
  }, [expandedPairs, fetchPairHolders, fetchLiquidityEvents]);

  const handleHolderClick = useCallback((holderAddress: string, pair: any) => {
    setSelectedHolder({
      address: holderAddress,
      tokenAddress: pair.pairAddress,
      tokenSymbol: `${pair.baseToken.symbol}/${pair.quoteToken.symbol}`,
    });
    setIsModalOpen(true);
  }, []);

  // Memoize all computed values to prevent recalculation on every render
  const sortedPairs = useMemo(() => {
    if (!dexScreenerData?.pairs) return [];
    return [...dexScreenerData.pairs].sort((a, b) => {
      const liquidityA = parseFloat(String(a.liquidity?.usd || 0));
      const liquidityB = parseFloat(String(b.liquidity?.usd || 0));
      return liquidityB - liquidityA;
    });
  }, [dexScreenerData?.pairs]);

  const topPair = useMemo(() => sortedPairs[0], [sortedPairs]);
  const top3Pairs = useMemo(() => sortedPairs.slice(0, 3), [sortedPairs]);
  
  const totalLiquidity = useMemo(() => 
    sortedPairs.reduce((sum, pair) => sum + parseFloat(String(pair.liquidity?.usd || 0)), 0),
    [sortedPairs]
  );
  
  const totalVolume = useMemo(() => 
    sortedPairs.reduce((sum, pair) => sum + parseFloat(String(pair.volume?.h24 || 0)), 0),
    [sortedPairs]
  );
  
  const totalTransactions = useMemo(() => 
    sortedPairs.reduce((sum, pair) => sum + (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0), 0),
    [sortedPairs]
  );

  const activePairs = useMemo(() => 
    sortedPairs.filter(pair => parseFloat(String(pair.liquidity?.usd || 0)) > 0),
    [sortedPairs]
  );
  
  const zeroLiquidityPairs = useMemo(() => 
    sortedPairs.filter(pair => parseFloat(String(pair.liquidity?.usd || 0)) === 0),
    [sortedPairs]
  );

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white">Loading liquidity data...</p>
        </div>
      </div>
    );
  }

  if (!dexScreenerData || !dexScreenerData.pairs || dexScreenerData.pairs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">💧</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Liquidity Pairs Found</h3>
          <p className="text-white">This token doesn't have any active liquidity pairs on DEXScreener.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto space-y-6">
      {/* TOP BANNER */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white">Liquidity</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Total:</span>
          <span className="text-xl font-bold text-green-400">{formatNumber(totalLiquidity)}</span>
        </div>
      </div>

      {/* MAIN PAIR CARD */}
      {top3Pairs[0] && (
        <div className="w-full bg-gradient-to-r from-slate-800/50 to-slate-700/50 border border-slate-600/50 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <img 
                src={top3Pairs[0].baseToken.logoURI || '/LogoVector.svg'} 
                alt={top3Pairs[0].baseToken.symbol}
                className="w-8 h-8 rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/LogoVector.svg';
                }}
              />
              <div>
                <div className="text-xl font-bold text-white">
                  {top3Pairs[0].baseToken.symbol}/{top3Pairs[0].quoteToken.symbol}
                </div>
                <div className="text-sm text-slate-400">{top3Pairs[0].dexId}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-400">Price</div>
              <div className="text-lg font-bold text-white">${parseFloat(top3Pairs[0].priceUsd || '0').toFixed(6)}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-slate-400 mb-1">Liquidity</div>
              <div className="text-2xl font-bold text-green-400">{formatNumber(top3Pairs[0].liquidity?.usd || 0)}</div>
            </div>
            <div>
              <div className="text-sm text-slate-400 mb-1">Volume 24h</div>
              <div className="text-2xl font-bold text-purple-400">{formatNumber(top3Pairs[0].volume?.h24 || 0)}</div>
            </div>
          </div>

          {/* Token Amounts */}
          <div className="mt-6 grid grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-slate-400 mb-1">{top3Pairs[0].baseToken.symbol} Amount</div>
              <div className="text-lg font-semibold text-blue-400">
                {parseFloat(String(top3Pairs[0].liquidity?.base || '0')).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-400 mb-1">{top3Pairs[0].quoteToken.symbol} Amount</div>
              <div className="text-lg font-semibold text-cyan-400">
                {parseFloat(String(top3Pairs[0].liquidity?.quote || '0')).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADDITIONAL PAIRS GRID */}
      <div className="grid grid-cols-2 gap-4">
        {top3Pairs.slice(1, 5).map((pair, index) => (
          <div key={pair.pairAddress} className="bg-slate-800/50 border border-slate-600/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <img 
                  src={pair.baseToken.logoURI || '/LogoVector.svg'} 
                  alt={pair.baseToken.symbol}
                  className="w-6 h-6 rounded-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/LogoVector.svg';
                  }}
                />
                <div>
                  <div className="text-sm font-semibold text-white">
                    {pair.baseToken.symbol}/{pair.quoteToken.symbol}
                  </div>
                  <div className="text-xs text-slate-400">{pair.dexId}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Price</div>
                <div className="text-sm font-semibold text-white">${parseFloat(pair.priceUsd || '0').toFixed(6)}</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <div className="text-xs text-slate-400">Liquidity</div>
                <div className="text-sm font-bold text-green-400">{formatNumber(pair.liquidity?.usd || 0)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Volume</div>
                <div className="text-sm font-bold text-purple-400">{formatNumber(pair.volume?.h24 || 0)}</div>
              </div>
            </div>

            {/* Token Amounts */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-400">{pair.baseToken.symbol}</div>
                <div className="text-xs font-semibold text-blue-400">
                  {parseFloat(String(pair.liquidity?.base || '0')).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">{pair.quoteToken.symbol}</div>
                <div className="text-xs font-semibold text-cyan-400">
                  {parseFloat(String(pair.liquidity?.quote || '0')).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>


      {/* All Pairs List */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-white">All Trading Pairs</h4>
        
        {/* Active Pairs */}
        {activePairs.map((pair, index) => (
          <div
            key={pair.pairAddress}
            className="bg-slate-800 border border-slate-700/50 rounded-lg overflow-hidden"
          >
            {/* Collapsed View */}
            <div 
              className="p-4 cursor-pointer hover:bg-slate-700/30 transition-colors"
              onClick={() => togglePairExpansion(pair.pairAddress)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-white">
                    {pair.baseToken.symbol}/{pair.quoteToken.symbol} • {pair.dexId}
                  </div>
                  <div className="text-sm text-blue-300">
                    Rank #{index + 1} • ${parseFloat(pair.priceUsd || '0').toFixed(6)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-white">{formatNumber(pair.liquidity?.usd || 0)}</div>
                  <div className="text-xs text-green-300">Liquidity</div>
                </div>
                <div className="text-right ml-4">
                  <div className="text-sm text-white">{formatNumber(pair.volume?.h24 || 0)}</div>
                  <div className="text-xs text-purple-300">Volume</div>
                </div>
                <div className="ml-4 text-white">
                  {expandedPairs.has(pair.pairAddress) ? '▲' : '▼'}
                </div>
              </div>
            </div>

            {/* Expanded View */}
            {expandedPairs.has(pair.pairAddress) && (
              <div className="border-t border-slate-700/50 p-4"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-blue-300 mb-1">Liquidity USD</div>
                    <div className="text-white font-semibold">
                      <span className="text-green-400">$</span>{formatNumber(pair.liquidity?.usd || 0).replace('$', '')}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-purple-300 mb-1">Price WPLS</div>
                    <div className="text-white font-semibold">{parseFloat(pair.priceNative || '0').toFixed(8)}</div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-orange-300 mb-1">FDV</div>
                    <div className="text-white font-semibold">{formatNumber((pair as any).fdv || 0)}</div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-cyan-300 mb-1">Market Cap</div>
                    <div className="text-white font-semibold">{formatNumber((pair as any).marketCap || 0)}</div>
                  </div>
                </div>

                {/* Liquidity Holders Section */}
                <div className="mb-4">
                  <h5 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <span>🏦</span>
                    LP Token Holders (Top 25)
                  </h5>
                  
                  {pairHoldersData[pair.pairAddress]?.isLoading && (
                    <div className="flex items-center justify-center py-6">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
                      <span className="ml-2 text-slate-400 text-sm">Loading holders...</span>
                    </div>
                  )}
                  
                  {pairHoldersData[pair.pairAddress]?.error && (
                    <div className="bg-red-900/20 border border-red-500/30 text-red-300 px-3 py-2 rounded text-sm">
                      Failed to load holders: {pairHoldersData[pair.pairAddress].error}
                    </div>
                  )}
                  
                  {pairHoldersData[pair.pairAddress]?.holders && pairHoldersData[pair.pairAddress].holders.length > 0 && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-4 gap-2 text-xs text-slate-400 pb-2 border-b border-slate-700/50">
                        <div>Rank</div>
                        <div>Address</div>
                        <div>LP Tokens</div>
                        <div>% of Pool</div>
                      </div>
                      
                      <div className="max-h-60 overflow-y-auto space-y-1">
                        {pairHoldersData[pair.pairAddress].holders.map((holder, holderIndex) => (
                          <div key={holder.address} className="grid grid-cols-4 gap-2 text-xs py-2 hover:bg-slate-700/30 rounded transition-colors">
                            <div className="text-slate-400">#{holderIndex + 1}</div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHolderClick(holder.address, pair);
                              }}
                              className="font-mono text-purple-300 hover:text-purple-200 underline cursor-pointer text-left transition-colors"
                            >
                              {holder.address.slice(0, 8)}...{holder.address.slice(-6)}
                            </button>
                            <div className="text-white font-medium">
                              {formatHolderBalance(holder.value)}
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <span className={`font-medium ${
                                  holder.percentage >= 10 ? 'text-red-400' : 
                                  holder.percentage >= 5 ? 'text-yellow-400' : 
                                  'text-green-400'
                                }`}>
                                  {formatHolderPercentage(holder.percentage)}
                                </span>
                                <div className="w-8 h-1 bg-slate-700 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-300 ${
                                      holder.percentage >= 10 ? 'bg-red-500' : 
                                      holder.percentage >= 5 ? 'bg-yellow-500' : 
                                      'bg-green-500'
                                    }`}
                                    style={{ width: `${Math.min(100, holder.percentage * 2)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {pairHoldersData[pair.pairAddress]?.holders && pairHoldersData[pair.pairAddress].holders.length === 0 && !pairHoldersData[pair.pairAddress].isLoading && (
                    <div className="text-center text-slate-400 py-4 text-sm">
                      No holders data available for this pair
                    </div>
                  )}
                </div>

                {/* Recent Liquidity Activity Section */}
                <div className="mb-4">
                  <h5 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <span>📊</span>
                    Recent Liquidity Activity (Last 10)
                  </h5>
                  
                  {pairLiquidityEvents[pair.pairAddress]?.isLoading && (
                    <div className="flex items-center justify-center py-6">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
                      <span className="ml-2 text-slate-400 text-sm">Loading activity...</span>
                    </div>
                  )}
                  
                  {pairLiquidityEvents[pair.pairAddress]?.error && (
                    <div className="bg-red-900/20 border border-red-500/30 text-red-300 px-3 py-2 rounded text-sm">
                      Failed to load activity: {pairLiquidityEvents[pair.pairAddress].error}
                    </div>
                  )}
                  
                  {pairLiquidityEvents[pair.pairAddress]?.events && pairLiquidityEvents[pair.pairAddress].events.length > 0 && (
                    <div className="space-y-2">
                      {pairLiquidityEvents[pair.pairAddress].events.map((event, eventIndex) => (
                        <div 
                          key={`${event.txHash}-${eventIndex}`}
                          className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:bg-slate-700/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`text-2xl ${event.type === 'add' ? 'text-green-400' : 'text-red-400'}`}>
                              {event.type === 'add' ? '🟢' : '🔴'}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`font-medium ${event.type === 'add' ? 'text-green-400' : 'text-red-400'}`}>
                                  {event.type === 'add' ? 'Added' : 'Removed'}
                                </span>
                                <span className="text-xs text-slate-400">{formatTimeAgo(event.timestamp)}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400">By:</span>
                                <code className="font-mono text-purple-300">
                                  {event.from ? `${event.from.slice(0, 8)}...${event.from.slice(-6)}` : 'Unknown'}
                                </code>
                                <a 
                                  href={`https://scan.pulsechain.com/tx/${event.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 ml-2"
                                  title="View transaction"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  🔗
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {pairLiquidityEvents[pair.pairAddress]?.events && pairLiquidityEvents[pair.pairAddress].events.length === 0 && !pairLiquidityEvents[pair.pairAddress].isLoading && (
                    <div className="text-center text-slate-400 py-4 text-sm">
                      No recent liquidity activity found
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-px">
                  <a 
                    href={pair.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-blue-600/20 text-blue-300 px-3 py-2 text-center border border-blue-600/30 hover:bg-blue-600/30 transition-colors text-sm"
                  >
                    DexScreener
                  </a>
                  
                  <a 
                    href={`https://scan.pulsechain.com/address/${pair.pairAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-green-600/20 text-green-300 px-3 py-2 text-center border border-green-600/30 hover:bg-green-600/30 transition-colors text-sm"
                  >
                    Code
                  </a>
                  
                  <button 
                    onClick={() => navigator.clipboard.writeText(pair.pairAddress || '')}
                    className="flex-1 bg-purple-600/20 text-purple-300 px-3 py-2 text-center border border-purple-600/30 hover:bg-purple-600/30 transition-colors text-sm"
                    title="Copy pair address"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Zero Liquidity Pairs - Collapsed */}
        {zeroLiquidityPairs.length > 0 && (
          <div className="bg-slate-800 border border-slate-700/50 rounded-lg p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-semibold text-white">
                  Zero Liquidity Pairs ({zeroLiquidityPairs.length})
                </div>
                <div className="text-sm text-slate-400">
                  Pairs with $0 liquidity
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-white">$0</div>
                <div className="text-xs text-slate-400">Liquidity</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Address Details Modal */}
      {selectedHolder && (
        <AddressDetailsModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedHolder(null);
          }}
          address={selectedHolder.address}
          tokenAddress={selectedHolder.tokenAddress}
          tokenSymbol={selectedHolder.tokenSymbol}
        />
      )}
    </div>
  );
};

export default LiquidityTab; 