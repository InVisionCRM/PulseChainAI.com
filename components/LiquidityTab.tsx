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
  return lower.endsWith('dead') || lower.endsWith('000369') || lower.endsWith('000');
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-xs text-gray-400">Loading liquidity data...</p>
        </div>
      </div>
    );
  }

  if (!dexScreenerData || !dexScreenerData.pairs || dexScreenerData.pairs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-2">💧</div>
          <h3 className="text-sm font-semibold text-white mb-1">No Liquidity Pairs Found</h3>
          <p className="text-xs text-gray-400">This token doesn't have any active liquidity pairs on DEXScreener.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto space-y-4 p-3 sm:p-4 text-white">
      {/* Overview Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-white/10 via-sky-500/10 to-purple-500/10 border border-white/10 shadow-[0_15px_45px_-25px_rgba(0,0,0,0.65)] backdrop-blur-xl px-4 py-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">Liquidity Intelligence</p>
            <h3 className="text-lg font-semibold text-white">PulseChain Liquidity</h3>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-gray-300">
            <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10 backdrop-blur">Live pairs {activePairs.length}</span>
            <span className="px-2 py-1 rounded-full bg-white/10 border border-white/10 backdrop-blur">Zero liquidity {zeroLiquidityPairs.length}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-white/10 border border-white/10 px-3 py-2 shadow-inner backdrop-blur">
            <div className="text-[11px] text-white/70">Total Liquidity</div>
            <div className="text-lg font-semibold text-emerald-300">{formatNumber(totalLiquidity)}</div>
          </div>
          <div className="rounded-xl bg-white/10 border border-white/10 px-3 py-2 shadow-inner backdrop-blur">
            <div className="text-[11px] text-white/70">24h Volume</div>
            <div className="text-lg font-semibold text-cyan-300">{formatNumber(totalVolume)}</div>
          </div>
          <div className="rounded-xl bg-white/10 border border-white/10 px-3 py-2 shadow-inner backdrop-blur">
            <div className="text-[11px] text-white/70">24h Transactions</div>
            <div className="text-lg font-semibold text-indigo-200">{totalTransactions.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Main Pair Feature */}
      {top3Pairs[0] && (
        <div className="w-full rounded-2xl bg-gradient-to-br from-blue-500/20 via-sky-500/10 to-cyan-500/10 border border-white/10 shadow-[0_25px_60px_-35px_rgba(59,130,246,0.8)] backdrop-blur-xl p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-cyan-400/40 blur-lg" aria-hidden />
                <img
                  src={top3Pairs[0].baseToken.logoURI || '/LogoVector.svg'}
                  alt={top3Pairs[0].baseToken.symbol}
                  className="relative w-10 h-10 rounded-full border border-white/20 shadow-lg object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/LogoVector.svg';
                  }}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">
                    {top3Pairs[0].baseToken.symbol}/{top3Pairs[0].quoteToken.symbol}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-white/80">
                    {top3Pairs[0].dexId}
                  </span>
                </div>
                <div className="text-xs text-white/70">Featured pair by liquidity</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-white/70">Price (USD)</div>
              <div className="text-lg font-semibold text-white">
                ${parseFloat(top3Pairs[0].priceUsd || '0').toFixed(6)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 backdrop-blur">
              <div className="text-[11px] text-white/70 mb-1">Liquidity</div>
              <div className="text-base font-semibold text-emerald-300">{formatNumber(top3Pairs[0].liquidity?.usd || 0)}</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 backdrop-blur">
              <div className="text-[11px] text-white/70 mb-1">Volume 24h</div>
              <div className="text-base font-semibold text-cyan-300">{formatNumber(top3Pairs[0].volume?.h24 || 0)}</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 backdrop-blur">
              <div className="text-[11px] text-white/70 mb-1">{top3Pairs[0].baseToken.symbol} Reserves</div>
              <div className="text-sm font-semibold text-blue-200">
                {formatTokenAmount(parseFloat(String(top3Pairs[0].liquidity?.base || '0')))}
              </div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 backdrop-blur">
              <div className="text-[11px] text-white/70 mb-1">{top3Pairs[0].quoteToken.symbol} Reserves</div>
              <div className="text-sm font-semibold text-teal-200">
                {formatTokenAmount(parseFloat(String(top3Pairs[0].liquidity?.quote || '0')))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Additional Highlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {top3Pairs.slice(1, 5).map((pair) => (
          <div
            key={pair.pairAddress}
            className="rounded-2xl bg-gradient-to-br from-white/10 via-sky-500/5 to-purple-500/10 border border-white/10 p-3 shadow-[0_18px_40px_-32px_rgba(0,0,0,0.65)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <img
                  src={pair.baseToken.logoURI || '/LogoVector.svg'}
                  alt={pair.baseToken.symbol}
                  className="w-8 h-8 rounded-full border border-white/10 shadow"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/LogoVector.svg';
                  }}
                />
                <div>
                  <div className="text-sm font-semibold text-white">
                    {pair.baseToken.symbol}/{pair.quoteToken.symbol}
                  </div>
                  <div className="text-[11px] text-white/60">{pair.dexId}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-white/70">Price</div>
                <div className="text-sm font-semibold text-white">${parseFloat(pair.priceUsd || '0').toFixed(6)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="rounded-lg bg-white/5 border border-white/10 px-2 py-2">
                <div className="text-[11px] text-white/60">Liquidity</div>
                <div className="text-sm font-semibold text-emerald-300">{formatNumber(pair.liquidity?.usd || 0)}</div>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 px-2 py-2">
                <div className="text-[11px] text-white/60">Volume</div>
                <div className="text-sm font-semibold text-cyan-300">{formatNumber(pair.volume?.h24 || 0)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-white/5 border border-white/10 px-2 py-2">
                <div className="text-[11px] text-white/60">{pair.baseToken.symbol}</div>
                <div className="text-sm font-semibold text-blue-200">
                  {formatTokenAmount(parseFloat(String(pair.liquidity?.base || '0')))}
                </div>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 px-2 py-2">
                <div className="text-[11px] text-white/60">{pair.quoteToken.symbol}</div>
                <div className="text-sm font-semibold text-teal-200">
                  {formatTokenAmount(parseFloat(String(pair.liquidity?.quote || '0')))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* All Pairs List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <h4 className="text-sm font-semibold text-white">Trading Pairs</h4>
            <p className="text-xs text-white/60">Tap to reveal depth, holders, and flow</p>
          </div>
          <div className="text-[11px] text-white/60">Active {activePairs.length}</div>
        </div>

        {activePairs.map((pair) => (
          <div
            key={pair.pairAddress}
            className="rounded-2xl bg-gradient-to-br from-white/10 via-slate-900/40 to-white/5 border border-white/10 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.7)] overflow-hidden backdrop-blur-xl"
          >
            {/* Collapsed View */}
            <button
              type="button"
              className="relative w-full text-left py-3 px-4 hover:bg-white/5 transition-colors focus:outline-none"
              onClick={() => togglePairExpansion(pair.pairAddress)}
              aria-expanded={expandedPairs.has(pair.pairAddress)}
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="rounded-full bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white/80">
                    {pair.dexId}
                  </div>
                  <div className="text-sm font-semibold text-white truncate">
                    {pair.baseToken.symbol}/{pair.quoteToken.symbol}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-white/80">
                  <div className="flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-1">
                    <span className="text-white/70">Price</span>
                    <span className="font-semibold text-cyan-200">${parseFloat(pair.priceUsd || '0').toFixed(6)}</span>
                  </div>
                  {(() => {
                    const priceDiff = calculatePriceDifference(pair);
                    if (priceDiff === null) return null;
                    const isPositive = priceDiff >= 0;
                    return (
                      <div
                        className={`flex items-center gap-1 rounded-full px-2 py-1 border border-white/10 ${
                          isPositive ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'
                        }`}
                      >
                        {isPositive ? '↑' : '↓'}
                        {Math.abs(priceDiff).toFixed(2)}%
                      </div>
                    );
                  })()}
                </div>

                <div className="ml-auto flex items-center gap-3 text-right">
                  <div>
                    <div className="text-xs font-semibold text-white">{formatNumber(pair.liquidity?.usd || 0)}</div>
                    <div className="text-[11px] text-white/60">Liquidity</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">{formatNumber(pair.volume?.h24 || 0)}</div>
                    <div className="text-[11px] text-white/60">24h Volume</div>
                  </div>
                  <div className="text-xs text-white/80">{expandedPairs.has(pair.pairAddress) ? '▲' : '▼'}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg bg-white/5 border border-white/10 px-2 py-2 flex items-center justify-between text-xs">
                  <span className="text-white/60">{pair.baseToken.symbol}</span>
                  <span className="font-semibold text-blue-200">
                    {formatTokenAmount(parseFloat(String(pair.liquidity?.base || '0')))}
                  </span>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/10 px-2 py-2 flex items-center justify-between text-xs">
                  <span className="text-white/60">{pair.quoteToken.symbol}</span>
                  <span className="font-semibold text-teal-200">
                    {formatTokenAmount(parseFloat(String(pair.liquidity?.quote || '0')))}
                  </span>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/10 px-2 py-2 flex items-center justify-between text-xs">
                  <span className="text-white/60">Txns 24h</span>
                  <span className="font-semibold text-indigo-200">
                    {((pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0)).toLocaleString()}
                  </span>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/10 px-2 py-2 flex items-center justify-between text-xs">
                  <span className="text-white/60">FDV</span>
                  <span className="font-semibold text-amber-200">{formatNumber((pair as any).fdv || 0)}</span>
                </div>
              </div>
            </button>

            {/* Expanded View */}
            {expandedPairs.has(pair.pairAddress) && (
              <div className="border-t border-white/10 p-4 space-y-4 bg-gradient-to-br from-white/5 via-slate-900/30 to-white/5 backdrop-blur-xl">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <div className="text-[11px] text-white/60 mb-1">Price USD</div>
                    <div className="text-sm font-semibold text-white">
                      ${parseFloat(pair.priceUsd || '0').toFixed(6)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <div className="text-[11px] text-white/60 mb-1">Price WPLS</div>
                    <div className="text-sm font-semibold text-white">
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
                          <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                            <div className="text-[11px] text-white/60 mb-1">FDV</div>
                            <div className="text-sm font-semibold text-white">{formatNumber((pair as any).fdv || 0)}</div>
                          </div>
                          <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                            <div className="text-[11px] text-white/60 mb-1">Market Cap</div>
                            <div className="text-sm font-semibold text-white">{formatNumber((pair as any).marketCap || 0)}</div>
                          </div>
                        </>
                      );
                    }
                    const isPositive = priceDiff >= 0;
                    return (
                      <>
                        <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                          <div className="text-[11px] text-white/60 mb-1">vs WPLS Pair</div>
                          <div
                            className={`text-sm font-semibold flex items-center gap-1 ${
                              isPositive ? 'text-emerald-300' : 'text-rose-300'
                            }`}
                          >
                            {isPositive ? '↑' : '↓'}
                            {Math.abs(priceDiff).toFixed(2)}%
                          </div>
                        </div>
                        <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                          <div className="text-[11px] text-white/60 mb-1">Market Cap</div>
                          <div className="text-sm font-semibold text-white">{formatNumber((pair as any).marketCap || 0)}</div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <div className="text-[11px] text-white/60">{pair.baseToken.symbol} in Pool</div>
                    <div className="text-sm font-semibold text-white">
                      {formatTokenAmount(parseFloat(String(pair.liquidity?.base || '0')))}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <div className="text-[11px] text-white/60">{pair.quoteToken.symbol} in Pool</div>
                    <div className="text-sm font-semibold text-white">
                      {formatTokenAmount(parseFloat(String(pair.liquidity?.quote || '0')))}
                    </div>
                  </div>
                </div>

                {/* Liquidity Holders Section */}
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold text-white tracking-wide uppercase">LP Holders</h5>

                  {pairHoldersData[pair.pairAddress]?.isLoading && (
                    <div className="flex items-center justify-center py-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-400"></div>
                      <span className="ml-2 text-white/70 text-xs">Loading holders...</span>
                    </div>
                  )}

                  {pairHoldersData[pair.pairAddress]?.error && (
                    <div className="bg-rose-500/10 border border-rose-400/30 text-rose-200 px-3 py-2 rounded-lg text-xs">
                      Failed to load holders: {pairHoldersData[pair.pairAddress].error}
                    </div>
                  )}

                  {pairHoldersData[pair.pairAddress]?.holders && pairHoldersData[pair.pairAddress].holders.length > 0 && (
                    <div className="space-y-1 rounded-xl border border-white/10 bg-white/5 p-2">
                      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-2 text-[11px] text-white/60 pb-1 border-b border-white/10">
                        <div>Rank</div>
                        <div>Address</div>
                        <div>LP Tokens</div>
                        <div>% of Pool</div>
                      </div>

                      <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                        {pairHoldersData[pair.pairAddress].holders.map((holder, holderIndex) => (
                          <div
                            key={holder.address}
                            className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-2 text-xs py-1 px-1 rounded-lg hover:bg-white/5 transition-colors"
                          >
                            <div className="text-white/70 flex items-center gap-1">
                              #{holderIndex + 1}
                              {isBurnAddress(holder.address) && <span title="Burn address" aria-label="Burn address">🔥</span>}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHolderClick(holder.address, pair);
                              }}
                              className="font-mono text-cyan-300 hover:text-cyan-200 underline cursor-pointer text-left transition-colors"
                            >
                              {formatLpAddress(holder.address)}
                            </button>
                            <div className="text-white font-semibold">
                              {formatHolderBalance(holder.value)}
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-semibold text-xs ${
                                    holder.percentage >= 10 ? 'text-rose-300' : holder.percentage >= 5 ? 'text-amber-300' : 'text-emerald-300'
                                  }`}
                                >
                                  {formatHolderPercentage(holder.percentage)}
                                </span>
                                <div className="w-12 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-300 ${
                                      holder.percentage >= 10 ? 'bg-rose-400' : holder.percentage >= 5 ? 'bg-amber-300' : 'bg-emerald-300'
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

                  {pairHoldersData[pair.pairAddress]?.holders &&
                    pairHoldersData[pair.pairAddress].holders.length === 0 &&
                    !pairHoldersData[pair.pairAddress].isLoading && (
                      <div className="text-center text-white/60 py-2 text-xs">
                        No holders data available for this pair
                      </div>
                  )}
                </div>

                {/* Recent Liquidity Activity Section */}
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold text-white tracking-wide uppercase">Recent Activity</h5>

                  {pairLiquidityEvents[pair.pairAddress]?.isLoading && (
                    <div className="flex items-center justify-center py-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-cyan-400"></div>
                      <span className="ml-2 text-white/70 text-xs">Loading activity...</span>
                    </div>
                  )}

                  {pairLiquidityEvents[pair.pairAddress]?.error && (
                    <div className="bg-rose-500/10 border border-rose-400/30 text-rose-200 px-3 py-2 rounded-lg text-xs">
                      Failed to load activity: {pairLiquidityEvents[pair.pairAddress].error}
                    </div>
                  )}

                  {pairLiquidityEvents[pair.pairAddress]?.events && pairLiquidityEvents[pair.pairAddress].events.length > 0 && (
                    <div className="space-y-2">
                      {pairLiquidityEvents[pair.pairAddress].events.map((event, eventIndex) => (
                        <div
                          key={`${event.txHash}-${eventIndex}`}
                          className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`text-lg ${event.type === 'add' ? 'text-emerald-300' : 'text-rose-300'}`}>
                              {event.type === 'add' ? '🟢' : '🔴'}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`font-semibold text-xs ${event.type === 'add' ? 'text-emerald-300' : 'text-rose-300'}`}>
                                  {event.type === 'add' ? 'Added' : 'Removed'}
                                </span>
                                <span className="text-[11px] text-white/60">{formatTimeAgo(event.timestamp)}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-white/70">
                                <span>By</span>
                                <code className="font-mono text-cyan-300">
                                  {event.from ? `${event.from.slice(0, 8)}...${event.from.slice(-6)}` : 'Unknown'}
                                </code>
                                <a
                                  href={`https://scan.pulsechain.com/tx/${event.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-cyan-300 hover:text-cyan-200"
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

                  {pairLiquidityEvents[pair.pairAddress]?.events &&
                    pairLiquidityEvents[pair.pairAddress].events.length === 0 &&
                    !pairLiquidityEvents[pair.pairAddress].isLoading && (
                      <div className="text-center text-white/60 py-2 text-xs">
                        No recent liquidity activity found
                      </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <a
                    href={pair.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center rounded-lg bg-gradient-to-r from-sky-500/30 to-cyan-500/30 border border-white/15 text-white px-3 py-2 text-xs font-semibold hover:from-sky-500/40 hover:to-cyan-500/40 transition-colors"
                  >
                    DexScreener
                  </a>

                  <a
                    href={`https://scan.pulsechain.com/address/${pair.pairAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center rounded-lg bg-gradient-to-r from-emerald-500/25 to-lime-500/20 border border-white/15 text-white px-3 py-2 text-xs font-semibold hover:from-emerald-500/35 hover:to-lime-500/25 transition-colors"
                  >
                    Contract
                  </a>

                  <button
                    onClick={() => navigator.clipboard.writeText(pair.pairAddress || '')}
                    className="flex-1 text-center rounded-lg bg-white/10 border border-white/15 text-white px-3 py-2 text-xs font-semibold hover:bg-white/15 transition-colors"
                    title="Copy pair address"
                  >
                    Copy Address
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Zero Liquidity Pairs */}
        {zeroLiquidityPairs.length > 0 && (
          <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-rose-500/10 border border-white/10 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Zero Liquidity ({zeroLiquidityPairs.length})</div>
                <div className="text-xs text-white/70">Pairs currently holding $0 liquidity</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-white">$0</div>
                <div className="text-[11px] text-white/60">Liquidity</div>
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
