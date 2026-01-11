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

const formatTokenAmount = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num) || num === 0) return '0.00';
  
  const abs = Math.abs(num);
  if (abs >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(2);
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

const formatLpAddress = (address: string): string => (address ? `...${address.slice(-4)}` : 'Unknown');

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

// Identify known burn/dead addresses by suffix
const isBurnAddress = (address: string): boolean => {
  if (!address) return false;
  const lower = address.toLowerCase();
  return lower.endsWith('dead') || lower.endsWith('000369') || lower.endsWith('0000');
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

  // Find the reference WPLS pair (highest liquidity WPLS pair)
  const wplsReferencePair = useMemo(() => {
    const wplsPairs = sortedPairs.filter(pair =>
      pair.quoteToken?.symbol?.toUpperCase() === 'WPLS' ||
      pair.quoteToken?.symbol?.toUpperCase() === 'PLS'
    );
    return wplsPairs[0]; // First one is highest liquidity due to sortedPairs
  }, [sortedPairs]);

  // Calculate price difference compared to WPLS pair
  const calculatePriceDifference = useCallback((pair: any) => {
    if (!wplsReferencePair || pair.pairAddress === wplsReferencePair.pairAddress) {
      return null; // No comparison for WPLS pair itself
    }

    const currentPrice = parseFloat(pair.priceUsd || '0');
    const referencePrice = parseFloat(wplsReferencePair.priceUsd || '0');

    if (referencePrice === 0 || currentPrice === 0) return null;

    const percentDifference = ((currentPrice - referencePrice) / referencePrice) * 100;
    return percentDifference;
  }, [wplsReferencePair]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white/60 mx-auto mb-1.5"></div>
          <p className="text-sm text-white/50">Loading liquidity data...</p>
        </div>
      </div>
    );
  }

  if (!dexScreenerData || !dexScreenerData.pairs || dexScreenerData.pairs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-md mb-1.5">💧</div>
          <h3 className="text-sm font-medium text-white mb-1">No Liquidity Pairs Found</h3>
          <p className="text-sm text-white/50">This token doesn't have any active liquidity pairs on DEXScreener.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto space-y-2 p-2 text-white font-sans" style={{ fontFamily: 'Poppins, sans-serif' }}>
      {/* Overview Banner */}
      <div className="rounded-lg bg-gradient-to-br from-slate-800/50 via-slate-900/50 to-slate-800/50 border border-slate-700/50 backdrop-blur p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div>
            <p className="text-sm uppercase tracking-wider text-slate-400 font-medium">Liquidity Intelligence</p>
            <h3 className="text-sm font-semibold text-white">PulseChain Liquidity</h3>
          </div>
          <div className="flex flex-wrap gap-1.5 text-sm">
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 font-medium">
              {activePairs.length} Live
            </span>
            {zeroLiquidityPairs.length > 0 && (
              <span className="px-2 py-0.5 rounded bg-slate-500/15 border border-slate-500/25 text-slate-300 font-medium">
                {zeroLiquidityPairs.length} Inactive
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-red-500/10 backdrop-blur rounded border border-slate-700/40 p-2 text-center">
            <div className="text-sm text-slate-400 font-medium mb-0.5">Total Liquidity</div>
            <div className="text-sm font-bold text-white">{formatNumber(totalLiquidity)}</div>
          </div>
          <div className="bg-blue-500/10 backdrop-blur rounded border border-slate-700/40 p-2 text-center">
            <div className="text-sm text-slate-400 font-medium mb-0.5">24h Volume</div>
            <div className="text-sm font-bold text-white">{formatNumber(totalVolume)}</div>
          </div>
          <div className="bg-green-500/10 backdrop-blur rounded border border-slate-700/40 p-2 text-center">
            <div className="text-sm text-slate-400 font-medium mb-0.5">24h Txns</div>
            <div className="text-sm font-bold text-white">{totalTransactions.toLocaleString()}</div>
          </div>
        </div>
      </div>


      {/* All Pairs List */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-700/50">
          <h4 className="text-sm font-semibold text-white uppercase tracking-wide">Trading Pairs</h4>
          <div className="text-sm text-slate-400 font-medium">{activePairs.length} Active</div>
        </div>
        {activePairs.map((pair) => (
          <div
            key={pair.pairAddress}
            className="bg-slate-800/30 border border-slate-700/50 rounded-lg overflow-hidden hover:bg-slate-800/50 hover:border-slate-600/50 transition-all"
          >
            {/* Collapsed View */}
            <button
              type="button"
              className="w-full text-left focus:outline-none group"
              onClick={() => togglePairExpansion(pair.pairAddress)}
              aria-expanded={expandedPairs.has(pair.pairAddress)}
            >
              {/* Header with subtle background */}
              <div className="bg-gradient-to-r from-slate-800/60 to-slate-900/40 border-b border-slate-700/30 px-3 py-2 rounded-t-lg group-hover:from-slate-800/70 group-hover:to-slate-900/50 transition-all duration-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={`border px-1.5 py-0.5 rounded text-xs font-semibold ${
                      pair.dexId.toLowerCase() === 'pulsex'
                        ? 'border-blue-500/25 text-blue-300'
                        : 'border-red-500/25 text-red-400'
                    }`}>
                      {pair.dexId}
                    </div>
                    <div className="text-sm font-bold truncate">
                      <span className={pair.dexId.toLowerCase() !== 'pulsex' ? 'text-red-400' : 'text-white'}>
                        {pair.baseToken.symbol}
                      </span>
                      <span className="text-red-400">/{pair.quoteToken.symbol}</span>
                    </div>
                    {/* Price difference indicator */}
                    {(() => {
                      const priceDiff = calculatePriceDifference(pair);
                      if (priceDiff === null) return null;
                      const isPositive = priceDiff >= 0;
                      return (
                        <div className={`flex items-center gap-1 rounded px-1.5 py-1 text-sm font-semibold ${
                          isPositive
                            ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-300'
                            : 'bg-rose-500/15 border border-rose-500/25 text-rose-300'
                        }`}>
                          {isPositive ? '↑' : '↓'}
                          {Math.abs(priceDiff).toFixed(2)}%
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex items-center">
                    {/* View More button on the right */}
                    <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded md:px-3 md:py-1.5 md:text-sm">
                      {expandedPairs.has(pair.pairAddress) ? 'View Less' : 'View More'}
                    </div>
                  </div>
                </div>

              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <div className="bg-slate-900/40 border border-slate-700/40 rounded px-2 py-2 flex flex-col items-center justify-center text-center">
                  <div className="text-sm text-slate-400 font-medium mb-1">Price</div>
                  <div className={`font-semibold text-sm ${
                    pair.dexId.toLowerCase() !== 'pulsex' ? 'text-red-400' : 'text-white'
                  }`}>
                    {pair.priceUsd && Number(pair.priceUsd) > 0 ? `$${Number(pair.priceUsd).toFixed(6)}` : 'N/A'}
                  </div>
                </div>
                <div className="bg-slate-900/40 border border-slate-700/40 rounded px-2 py-2 flex flex-col items-center justify-center text-center">
                  <div className="text-sm text-slate-400 font-medium mb-1">Liquidity</div>
                  <div className="font-semibold text-white text-sm">
                    {formatNumber(pair.liquidity?.usd || 0)}
                  </div>
                </div>
                <div className="bg-slate-900/40 border border-slate-700/40 rounded px-2 py-2 flex flex-col items-center justify-center text-center">
                  <div className="text-sm text-slate-400 font-medium mb-1">24h Vol</div>
                  <div className="font-semibold text-white text-sm">
                    {formatNumber(pair.volume?.h24 || 0)}
                  </div>
                </div>
              </div>
            </button>

            {/* Expanded View */}
            {expandedPairs.has(pair.pairAddress) && (
              <div className="border-t border-slate-700/50 p-2.5 space-y-2 bg-slate-900/20">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                  <div className="bg-slate-900/40 border border-slate-700/40 rounded p-2">
                    <div className="text-sm text-slate-400 font-medium mb-0.5">Price USD</div>
                    <div className="text-sm font-bold text-white">
                      ${parseFloat(pair.priceUsd || '0').toFixed(6)}
                    </div>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-700/40 rounded p-2">
                    <div className="text-sm text-slate-400 font-medium mb-0.5">Price WPLS</div>
                    <div className="text-sm font-bold text-white">
                      {parseFloat(pair.priceNative || '0').toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </div>
                  </div>
                  {(() => {
                    const priceDiff = calculatePriceDifference(pair);
                    if (priceDiff === null) {
                      return (
                        <>
                          <div className="bg-slate-900/40 border border-slate-700/40 rounded p-2">
                            <div className="text-sm text-slate-400 font-medium mb-0.5">FDV</div>
                            <div className="text-sm font-bold text-white">{formatNumber((pair as any).fdv || 0)}</div>
                          </div>
                          <div className="bg-slate-900/40 border border-slate-700/40 rounded p-2">
                            <div className="text-sm text-slate-400 font-medium mb-0.5">Market Cap</div>
                            <div className="text-sm font-bold text-white">{formatNumber((pair as any).marketCap || 0)}</div>
                          </div>
                        </>
                      );
                    }
                    const isPositive = priceDiff >= 0;
                    return (
                      <>
                        <div className={`border rounded p-2 ${
                          isPositive
                            ? 'bg-emerald-500/10 border-emerald-500/25'
                            : 'bg-rose-500/10 border-rose-500/25'
                        }`}>
                          <div className="text-sm font-medium mb-0.5 text-slate-400">vs WPLS</div>
                          <div className={`text-sm font-bold flex items-center gap-0.5 ${
                            isPositive ? 'text-emerald-300' : 'text-rose-300'
                          }`}>
                            {isPositive ? '↑' : '↓'}
                            {Math.abs(priceDiff).toFixed(2)}%
                          </div>
                        </div>
                        <div className="bg-slate-900/40 border border-slate-700/40 rounded p-2">
                          <div className="text-sm text-slate-400 font-medium mb-0.5">Market Cap</div>
                          <div className="text-sm font-bold text-white">{formatNumber((pair as any).marketCap || 0)}</div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded p-2">
                    <div className="text-sm text-blue-300/70 font-medium mb-0.5">{pair.baseToken.symbol} in Pool</div>
                    <div className="text-sm font-bold text-white">
                      {formatTokenAmount(parseFloat(String(pair.liquidity?.base || '0')))}
                    </div>
                  </div>
                  <div className="bg-purple-500/5 border border-purple-500/20 rounded p-2">
                    <div className="text-sm text-purple-300/70 font-medium mb-0.5">{pair.quoteToken.symbol} in Pool</div>
                    <div className="text-sm font-bold text-white">
                      {formatTokenAmount(parseFloat(String(pair.liquidity?.quote || '0')))}
                    </div>
                  </div>
                </div>

                {/* Liquidity Holders Section */}
                <div className="space-y-1.5">
                  <h5 className="text-sm font-semibold text-white uppercase tracking-wide">LP Holders</h5>

                  {pairHoldersData[pair.pairAddress]?.isLoading && (
                    <div className="flex items-center justify-center py-3 bg-slate-900/40 rounded border border-slate-700/40">
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-400 border-t-transparent"></div>
                      <span className="ml-2 text-slate-400 text-sm">Loading holders...</span>
                    </div>
                  )}

                  {pairHoldersData[pair.pairAddress]?.error && (
                    <div className="bg-rose-500/10 border border-rose-500/25 text-rose-300 rounded px-2 py-1.5 text-sm">
                      Failed to load holders: {pairHoldersData[pair.pairAddress].error}
                    </div>
                  )}

                  {pairHoldersData[pair.pairAddress]?.holders && pairHoldersData[pair.pairAddress].holders.length > 0 && (
                    <div className="bg-slate-900/40 border border-slate-700/40 rounded overflow-hidden">
                      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-2 px-2 py-1.5 bg-slate-800/50 border-b border-slate-700/40 text-sm font-semibold text-slate-400 uppercase tracking-wide">
                        <div>Rank</div>
                        <div>Address</div>
                        <div>LP Tokens</div>
                        <div>% Pool</div>
                      </div>

                      <div className="max-h-48 overflow-y-auto divide-y divide-slate-700/30">
                        {pairHoldersData[pair.pairAddress].holders.map((holder, holderIndex) => (
                          <div
                            key={holder.address}
                            className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-2 px-2 py-1.5 hover:bg-slate-800/50 transition-colors"
                          >
                            <div className="text-slate-300 font-semibold text-sm flex items-center gap-1">
                              #{holderIndex + 1}
                              {isBurnAddress(holder.address) && (
                                <span className="text-sm" title="Burn address" aria-label="Burn address">🔥</span>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHolderClick(holder.address, pair);
                              }}
                              className="font-mono text-blue-300 hover:text-blue-200 underline cursor-pointer text-left transition-colors text-sm font-medium"
                            >
                              {formatLpAddress(holder.address)}
                            </button>
                            <div className="text-white font-semibold text-sm">
                              {formatHolderBalance(holder.value)}
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-1 justify-end">
                                <span className="font-semibold text-sm text-white">
                                  {formatHolderPercentage(holder.percentage)}
                                </span>
                                <div className="w-12 h-1 bg-slate-700/50 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-blue-400 to-purple-400"
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

                  {pairHoldersData[pair.pairAddress]?.holders &&
                    pairHoldersData[pair.pairAddress].holders.length === 0 &&
                    !pairHoldersData[pair.pairAddress].isLoading && (
                      <div className="text-center text-slate-400 py-2 text-sm bg-slate-900/40 rounded border border-slate-700/40">
                        No holders data available
                      </div>
                  )}
                </div>

                {/* Recent Liquidity Activity Section */}
                <div className="space-y-1.5">
                  <h5 className="text-sm font-semibold text-white uppercase tracking-wide">Recent Activity</h5>

                  {pairLiquidityEvents[pair.pairAddress]?.isLoading && (
                    <div className="flex items-center justify-center py-3 bg-slate-900/40 rounded border border-slate-700/40">
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-purple-400 border-t-transparent"></div>
                      <span className="ml-2 text-slate-400 text-sm">Loading activity...</span>
                    </div>
                  )}

                  {pairLiquidityEvents[pair.pairAddress]?.error && (
                    <div className="bg-rose-500/10 border border-rose-500/25 text-rose-300 rounded px-2 py-1.5 text-sm">
                      Failed to load activity: {pairLiquidityEvents[pair.pairAddress].error}
                    </div>
                  )}

                  {pairLiquidityEvents[pair.pairAddress]?.events && pairLiquidityEvents[pair.pairAddress].events.length > 0 && (
                    <div className="space-y-0.5">
                      {pairLiquidityEvents[pair.pairAddress].events.map((event, eventIndex) => (
                        <div
                          key={`${event.txHash}-${eventIndex}`}
                          className="flex items-center justify-between p-1.5 border border-slate-700/40 bg-slate-900/40 rounded hover:bg-slate-800/50 transition-colors"
                        >
                          <div className="flex items-center gap-1.5 flex-1">
                            <div className={`text-sm font-bold ${event.type === 'add' ? 'text-emerald-300' : 'text-rose-300'}`}>
                              {event.type === 'add' ? '+' : '−'}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className={`font-semibold text-sm ${event.type === 'add' ? 'text-white' : 'text-slate-300'}`}>
                                  {event.type === 'add' ? 'Added' : 'Removed'}
                                </span>
                                <span className="text-sm text-slate-400">{formatTimeAgo(event.timestamp)}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                                <span>By</span>
                                <code className="font-mono text-slate-400">
                                  {event.from ? `${event.from.slice(0, 8)}...${event.from.slice(-6)}` : 'Unknown'}
                                </code>
                                <a
                                  href={`https://scan.pulsechain.com/tx/${event.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-300 hover:text-blue-200"
                                  title="View transaction"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  →
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {pairLiquidityEvents[pair.pairAddress]?.events &&
                    pairLiquidityEvents[pair.pairAddress].events.length === 0 &&
                    !pairLiquidityEvents[pair.pairAddress].isLoading && (
                      <div className="text-center text-slate-400 py-2 text-sm bg-slate-900/40 rounded border border-slate-700/40">
                        No recent activity
                      </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-1.5">
                  <a
                    href={pair.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center bg-blue-500/10 border border-blue-500/25 text-blue-300 px-2 py-1 text-sm font-semibold rounded hover:bg-blue-500/20 transition-colors"
                  >
                    DexScreener
                  </a>

                  <a
                    href={`https://scan.pulsechain.com/address/${pair.pairAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center bg-slate-700/30 border border-slate-700/50 text-slate-300 px-2 py-1 text-sm font-semibold rounded hover:bg-slate-700/50 transition-colors"
                  >
                    Contract
                  </a>

                  <button
                    onClick={() => navigator.clipboard.writeText(pair.pairAddress || '')}
                    className="flex-1 text-center bg-slate-700/30 border border-slate-700/50 text-slate-300 px-2 py-1 text-sm font-semibold rounded hover:bg-slate-700/50 transition-colors"
                    title="Copy pair address"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Zero Liquidity Pairs */}
        {zeroLiquidityPairs.length > 0 && (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Zero Liquidity ({zeroLiquidityPairs.length})</div>
                <div className="text-sm text-slate-400">Pairs with $0 liquidity</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-white">$0</div>
                <div className="text-sm text-slate-400">Liquidity</div>
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
