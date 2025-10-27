'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TokenData, StatConfig } from './StatCounterBuilder';

interface StatsDialogProps {
  open: boolean;
  onClose: () => void;
  token: TokenData;
  currentStats: StatConfig[];
  onStatsChange: (stats: StatConfig[]) => void;
  onStatResultsChange: (results: Record<string, unknown>) => void;
}

// Default available stats
const defaultAvailableStats: StatConfig[] = [
  {
    id: 'price',
    name: 'price',
    label: 'Price',
    description: 'Current token price',
    enabled: false,
    format: 'currency',
    prefix: '$',
    decimals: 6
  },
  {
    id: 'marketCap',
    name: 'marketCap',
    label: 'Market Cap',
    description: 'Total market capitalization',
    enabled: false,
    format: 'currency',
    prefix: '$',
    decimals: 2
  },
  {
    id: 'volume24h',
    name: 'volume24h',
    label: 'Volume 24h',
    description: '24-hour trading volume',
    enabled: false,
    format: 'currency',
    prefix: '$',
    decimals: 2
  },
  {
    id: 'liquidity',
    name: 'liquidity',
    label: 'Liquidity',
    description: 'Total liquidity in DEX pairs',
    enabled: false,
    format: 'currency',
    prefix: '$',
    decimals: 2
  },
  {
    id: 'holders',
    name: 'holders',
    label: 'Holders',
    description: 'Number of token holders',
    enabled: false,
    format: 'number'
  },
  {
    id: 'totalSupply',
    name: 'totalSupply',
    label: 'Total Supply',
    description: 'Total token supply',
    enabled: false,
    format: 'number'
  },
  {
    id: 'lpCount',
    name: 'lpCount',
    label: 'LP Pairs',
    description: 'Number of liquidity pairs',
    enabled: false,
    format: 'number'
  },
  {
    id: 'address',
    name: 'address',
    label: 'Contract Address',
    description: 'Token contract address',
    enabled: false,
    format: 'address'
  }
];

export default function StatsDialog({ 
  open, 
  onClose, 
  token, 
  currentStats, 
  onStatsChange, 
  onStatResultsChange 
}: StatsDialogProps) {
  const [availableStats, setAvailableStats] = useState<StatConfig[]>(defaultAvailableStats);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});

  // Update available stats based on current stats
  useEffect(() => {
    setAvailableStats(prev => 
      prev.map(stat => ({
        ...stat,
        enabled: currentStats.some(currentStat => currentStat.id === stat.id)
      }))
    );
  }, [currentStats]);

  const handleStatToggle = async (statId: string, enabled: boolean) => {
    setIsLoading(prev => ({ ...prev, [statId]: true }));

    try {
      if (enabled) {
        // Add stat to current stats
        const statToAdd = availableStats.find(stat => stat.id === statId);
        if (statToAdd) {
          const newStats = [...currentStats, { ...statToAdd, enabled: true }];
          onStatsChange(newStats);
          
          // Fetch stat data immediately
          await fetchStatData(statId, token.address);
        }
      } else {
        // Remove stat from current stats
        const newStats = currentStats.filter(stat => stat.id !== statId);
        onStatsChange(newStats);
      }
    } catch (error) {
      console.error('Error toggling stat:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, [statId]: false }));
    }
  };

  const fetchStatData = async (statId: string, tokenAddress: string) => {
    try {
      // Single entry point for services
      const { fetchTokenInfo, fetchDexScreenerData } = await import('@/services');
      
      let statValue: unknown = null;
      
      switch (statId) {
        case 'price':
        case 'marketCap':
        case 'volume24h':
        case 'liquidity':
        case 'lpCount':
          try {
            const dexResult = await fetchDexScreenerData(tokenAddress);
            if (dexResult?.data && dexResult.data.pairs && dexResult.data.pairs.length > 0) {
              const mainPair = dexResult.data.pairs[0];
              switch (statId) {
                case 'price':
                  statValue = parseFloat(mainPair.priceUsd);
                  break;
                case 'marketCap':
                  statValue = dexResult.data.marketCap;
                  break;
                case 'volume24h':
                  statValue = mainPair.volume?.h24 || 0;
                  break;
                case 'liquidity':
                  statValue = mainPair.liquidity?.usd || 0;
                  break;
                case 'lpCount':
                  statValue = dexResult.data.pairs.length;
                  break;
              }
            }
          } catch (error) {
            console.warn('Could not fetch DEX data:', error);
          }
          break;
          
        case 'holders':
        case 'totalSupply':
          try {
            const tokenResult = await fetchTokenInfo(tokenAddress);
            if (tokenResult?.data) {
              switch (statId) {
                case 'holders':
                  statValue = tokenResult.data.holders_count;
                  break;
                case 'totalSupply':
                  statValue = tokenResult.data.total_supply;
                  break;
              }
            }
          } catch (error) {
            console.warn('Could not fetch token data:', error);
          }
          break;
          
        case 'address':
          statValue = tokenAddress;
          break;
      }
      
      // Update stat results
      onStatResultsChange(prev => ({
        ...prev,
        [statId]: statValue
      }));
      
    } catch (error) {
      console.error('Error fetching stat data:', error);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-gray-900/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Select Stats for {token.name}</h2>
                <p className="text-sm text-gray-400 mt-1">Choose which stats to display on your card</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors p-2"
                title="Close stats dialog"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableStats.map((stat) => (
                <motion.div
                  key={stat.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-4 rounded-lg border transition-all duration-200 cursor-pointer ${
                    stat.enabled
                      ? 'bg-slate-950/20 border-blue-500/50'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                  onClick={() => handleStatToggle(stat.id, !stat.enabled)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={stat.enabled}
                          onChange={() => handleStatToggle(stat.id, !stat.enabled)}
                          className="w-4 h-4 text-slate-950 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2 transition-all duration-200 hover:scale-110"
                          title={`Toggle ${stat.label} stat`}
                        />
                        <div>
                          <h3 className="font-medium text-white">{stat.label}</h3>
                          <p className="text-sm text-gray-400">{stat.description}</p>
                        </div>
                      </div>
                    </div>
                    {isLoading[stat.id] && (
                      <div className="ml-3">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500/50 border-t-white"></div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-white/10">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-400">
                {currentStats.length} stat{currentStats.length !== 1 ? 's' : ''} selected
              </p>
              <button
                onClick={onClose}
                className="bg-slate-950 hover:bg-slate-950 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
} 