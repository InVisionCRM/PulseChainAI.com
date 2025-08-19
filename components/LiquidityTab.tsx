'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { DexScreenerData } from '@/types';
import { pulsechainApiService } from '@/services/pulsechainApiService';

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

const LiquidityTab: React.FC<LiquidityTabProps> = ({ dexScreenerData, isLoading }) => {
  const [expandedPairs, setExpandedPairs] = useState<Set<string>>(new Set());
  const [pairHoldersData, setPairHoldersData] = useState<PairHoldersData>({});

  const fetchPairHolders = async (pairAddress: string) => {
    console.log('Fetching holders for pair:', pairAddress);
    
    if (pairHoldersData[pairAddress]) {
      console.log('Already fetched data for:', pairAddress);
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
      console.log('Making API calls for:', pairAddress);
      
      // Fetch both holders and token info for total supply
      const [holdersResult, tokenInfo] = await Promise.all([
        pulsechainApiService.getTokenHolders(pairAddress, 1, 25), // Get top 25 holders
        pulsechainApiService.getTokenInfo(pairAddress)
      ]);

      console.log('API responses for:', pairAddress, { holdersResult, tokenInfo });

      let holders: PairHolder[] = [];
      const totalSupply = tokenInfo?.total_supply || '0';

      // Process holders data - now directly from the service
      if (Array.isArray(holdersResult)) {
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

      console.log('Processed holders for:', pairAddress, { holders, totalSupply });

      setPairHoldersData(prev => ({
        ...prev,
        [pairAddress]: {
          holders,
          isLoading: false,
          error: null,
          totalSupply
        }
      }));
    } catch (error) {
      console.error('Error fetching pair holders for:', pairAddress, error);
      setPairHoldersData(prev => ({
        ...prev,
        [pairAddress]: {
          holders: [],
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch holders',
          totalSupply: '0'
        }
      }));
    }
  };

  const togglePairExpansion = async (pairAddress: string) => {
    console.log('Toggling pair expansion for:', pairAddress);
    const newExpanded = new Set(expandedPairs);
    if (newExpanded.has(pairAddress)) {
      newExpanded.delete(pairAddress);
    } else {
      newExpanded.add(pairAddress);
      // Fetch holders data when expanding
      await fetchPairHolders(pairAddress);
    }
    setExpandedPairs(newExpanded);
  };

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

  // Sort pairs by liquidity (highest first)
  const sortedPairs = [...dexScreenerData.pairs].sort((a, b) => {
    const liquidityA = parseFloat(a.liquidity?.usd || '0');
    const liquidityB = parseFloat(b.liquidity?.usd || '0');
    return liquidityB - liquidityA;
  });

  const topPair = sortedPairs[0];
  const top3Pairs = sortedPairs.slice(0, 3);
  const totalLiquidity = sortedPairs.reduce((sum, pair) => sum + parseFloat(pair.liquidity?.usd || '0'), 0);
  const totalVolume = sortedPairs.reduce((sum, pair) => sum + parseFloat(pair.volume?.h24 || '0'), 0);
  const totalTransactions = sortedPairs.reduce((sum, pair) => sum + (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0), 0);

  // Separate pairs with $0 liquidity
  const activePairs = sortedPairs.filter(pair => parseFloat(pair.liquidity?.usd || '0') > 0);
  const zeroLiquidityPairs = sortedPairs.filter(pair => parseFloat(pair.liquidity?.usd || '0') === 0);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      {/* TOP 3 PAIRS - Pyramid Layout */}
      <div className="space-y-4">
        {/* Pyramid Layout for Top 3 */}
        <div className="flex flex-col items-center space-y-2">
          {/* #1 - Top */}
          {top3Pairs[0] && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-md bg-gradient-to-r from-yellow-600/20 to-yellow-500/20 border border-yellow-500/30 rounded-xl p-4 text-center shadow-lg shadow-yellow-500/20"
            >
              <div className="text-lg font-bold text-white mb-1">
                {top3Pairs[0].baseToken.symbol}/{top3Pairs[0].quoteToken.symbol}
              </div>
              <div className="text-sm text-yellow-300 mb-2">{top3Pairs[0].dexId}</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-slate-400">Liquidity</div>
                  <div className="text-green-400 font-bold text-lg">{formatNumber(top3Pairs[0].liquidity?.usd || 0)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Volume</div>
                  <div className="text-purple-400 font-bold text-lg">{formatNumber(top3Pairs[0].volume?.h24 || 0)}</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* #2 and #3 - Side by side */}
          <div className="flex gap-4 w-full max-w-lg">
            {top3Pairs[1] && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="flex-1 bg-gradient-to-r from-slate-600/20 to-slate-500/20 border border-slate-500/30 rounded-xl p-3 text-center shadow-lg shadow-slate-500/20"
              >
                <div className="text-sm font-bold text-white mb-1">
                  {top3Pairs[1].baseToken.symbol}/{top3Pairs[1].quoteToken.symbol}
                </div>
                <div className="text-xs text-slate-300 mb-2">{top3Pairs[1].dexId}</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-slate-400">Liquidity</div>
                    <div className="text-green-400 font-bold text-base">{formatNumber(top3Pairs[1].liquidity?.usd || 0)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Volume</div>
                    <div className="text-purple-400 font-bold text-base">{formatNumber(top3Pairs[1].volume?.h24 || 0)}</div>
                  </div>
                </div>
              </motion.div>
            )}

            {top3Pairs[2] && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex-1 bg-gradient-to-r from-amber-600/20 to-amber-500/20 border border-amber-500/30 rounded-xl p-3 text-center shadow-lg shadow-amber-500/20"
              >
                <div className="text-sm font-bold text-white mb-1">
                  {top3Pairs[2].baseToken.symbol}/{top3Pairs[2].quoteToken.symbol}
                </div>
                <div className="text-xs text-amber-300 mb-2">{top3Pairs[2].dexId}</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-slate-400">Liquidity</div>
                    <div className="text-green-400 font-bold text-base">{formatNumber(top3Pairs[2].liquidity?.usd || 0)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Volume</div>
                    <div className="text-purple-400 font-bold text-base">{formatNumber(top3Pairs[2].volume?.h24 || 0)}</div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Liquidity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-slate-800 border border-slate-700/50 rounded-xl p-4 text-center"
        >
          <div className="text-2xl font-bold text-green-400 mb-1">
            {formatNumber(totalLiquidity)}
          </div>
          <div className="text-xs text-slate-400 uppercase tracking-wide">Total Liquidity</div>
        </motion.div>

        {/* Price USD */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-slate-800 border border-slate-700/50 rounded-xl p-4 text-center"
        >
          <div className="text-2xl font-bold text-white mb-1">
            ${parseFloat(topPair?.priceUsd || '0').toFixed(6)}
          </div>
          <div className="text-xs text-slate-400 uppercase tracking-wide">Price USD</div>
        </motion.div>

        {/* Total Volume */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-slate-800 border border-slate-700/50 rounded-xl p-4 text-center"
        >
          <div className="text-2xl font-bold text-purple-400 mb-1">
            {formatNumber(totalVolume)}
          </div>
          <div className="text-xs text-slate-400 uppercase tracking-wide">Total Volume</div>
        </motion.div>

        {/* Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="bg-slate-800 border border-slate-700/50 rounded-xl p-4 text-center"
        >
          <div className="text-2xl font-bold text-cyan-400 mb-1">
            {totalTransactions}
          </div>
          <div className="text-xs text-slate-400 uppercase tracking-wide">TX 24H</div>
        </motion.div>
      </div>

      {/* All Pairs List */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-white">All Trading Pairs</h4>
        
        {/* Active Pairs */}
        {activePairs.map((pair, index) => (
          <motion.div
            key={pair.pairAddress}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
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
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="border-t border-slate-700/50 p-4"
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
                    <div className="text-white font-semibold">{formatNumber(pair.fdv || 0)}</div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-cyan-300 mb-1">Market Cap</div>
                    <div className="text-white font-semibold">{formatNumber(pair.marketCap || 0)}</div>
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
                            <div className="font-mono text-purple-300">
                              {holder.address.slice(0, 8)}...{holder.address.slice(-6)}
                            </div>
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
                      
                      {/* Liquidity Lock Analysis */}
                      {(() => {
                        const holders = pairHoldersData[pair.pairAddress].holders;
                        const top5Percentage = holders.slice(0, 5).reduce((sum, h) => sum + h.percentage, 0);
                        const top10Percentage = holders.slice(0, 10).reduce((sum, h) => sum + h.percentage, 0);
                        
                        return (
                          <div className="mt-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                            <div className="text-xs text-slate-400 mb-2">Liquidity Distribution Analysis</div>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <div className="text-slate-300">Top 5 holders control:</div>
                                <div className={`font-bold ${
                                  top5Percentage >= 80 ? 'text-red-400' : 
                                  top5Percentage >= 60 ? 'text-yellow-400' : 
                                  'text-green-400'
                                }`}>
                                  {top5Percentage.toFixed(2)}% of liquidity
                                </div>
                              </div>
                              <div>
                                <div className="text-slate-300">Top 10 holders control:</div>
                                <div className={`font-bold ${
                                  top10Percentage >= 90 ? 'text-red-400' : 
                                  top10Percentage >= 75 ? 'text-yellow-400' : 
                                  'text-green-400'
                                }`}>
                                  {top10Percentage.toFixed(2)}% of liquidity
                                </div>
                              </div>
                            </div>
                            
                            <div className="mt-2 text-xs">
                              <div className={`font-medium ${
                                top5Percentage >= 80 ? 'text-red-400' : 
                                top5Percentage >= 60 ? 'text-yellow-400' : 
                                'text-green-400'
                              }`}>
                                Risk Level: {
                                  top5Percentage >= 80 ? 'HIGH - Highly concentrated liquidity' : 
                                  top5Percentage >= 60 ? 'MEDIUM - Moderately concentrated' : 
                                  'LOW - Well distributed liquidity'
                                }
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  
                  {pairHoldersData[pair.pairAddress]?.holders && pairHoldersData[pair.pairAddress].holders.length === 0 && !pairHoldersData[pair.pairAddress].isLoading && (
                    <div className="text-center text-slate-400 py-4 text-sm">
                      No holders data available for this pair
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
              </motion.div>
            )}
          </motion.div>
        ))}

        {/* Zero Liquidity Pairs - Collapsed */}
        {zeroLiquidityPairs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: activePairs.length * 0.1 }}
            className="bg-slate-800 border border-slate-700/50 rounded-lg p-4"
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
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default LiquidityTab; 