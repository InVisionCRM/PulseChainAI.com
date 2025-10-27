'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion';
import { StatConfig as LibStatConfig, fetchStats, StatResult } from '@/lib/stats';
import { TokenData, StatConfig } from './StatCounterBuilder';
import TokenBalanceForm from './TokenBalanceForm';

interface StatSelectorProps {
  token: TokenData | null;
  onStatsChange: (stats: StatConfig[]) => void;
  onStatResultsChange?: (results: Record<string, unknown>) => void;
  onError: (error: string | null) => void;
}

export default function StatSelector({ token, onStatsChange, onStatResultsChange, onError }: StatSelectorProps) {
  const [availableStats, setAvailableStats] = useState<LibStatConfig[]>([]);
  const [selectedStats, setSelectedStats] = useState<string[]>([]);
  const [statResults, setStatResults] = useState<Record<string, StatResult>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showTokenBalanceForm, setShowTokenBalanceForm] = useState(false);
  const [tokenBalanceConfig, setTokenBalanceConfig] = useState<{ walletAddress: string; tokenAddress: string } | null>(null);

  type StatCategory =
    | 'Market & Liquidity'
    | 'Supply'
    | 'Holders'
    | 'On-chain'
    | 'Creator'
    | 'Metadata'
    | 'Additional'
    | 'Other';

  const categorizeStat = (stat: LibStatConfig): StatCategory => {
    const id = stat.id.toLowerCase();
    if (id.includes('price') || id.includes('market') || id.includes('liquidity') || id.includes('volume')) return 'Market & Liquidity';
    if (id.includes('supply') || id.includes('circulat') || id.includes('burn')) return 'Supply';
    if (id.includes('holder') || id.includes('whale')) return 'Holders';
    if (id.includes('onchain') || id.includes('tx') || id.includes('transaction') || id.includes('gas')) return 'On-chain';
    if (id.includes('creator')) return 'Creator';
    if (id.includes('metadata') || id.includes('contract')) return 'Metadata';
    if (id.includes('additional')) return 'Additional';
    return 'Other';
  };

  const getSampleFormattedValue = (stat: LibStatConfig): string => {
    const decimals = typeof stat.decimals === 'number' ? stat.decimals : 2;
    const prefix = stat.prefix ?? '';
    const suffix = stat.suffix ?? '';
    switch (stat.format) {
      case 'currency':
        return `${prefix}${(12345.6789).toLocaleString('en-US', {
          minimumFractionDigits: Math.min(decimals, 6),
          maximumFractionDigits: Math.min(decimals, 6)
        })}${suffix}`;
      case 'number':
        return `${prefix}${(123456).toLocaleString('en-US')}${suffix}`;
      case 'percentage':
        return `${prefix}${(12.34).toFixed(Math.min(decimals, 4))}%${suffix}`;
      case 'address':
        return `${prefix}0x12...9AbC${suffix}`;
      default:
        return `${prefix}Sample${suffix}`;
    }
  };

  const groupedStats = useMemo(() => {
    const groups: Record<StatCategory, LibStatConfig[]> = {
      'Market & Liquidity': [],
      Supply: [],
      Holders: [],
      'On-chain': [],
      Creator: [],
      Metadata: [],
      Additional: [],
      Other: []
    };
    for (const stat of availableStats) {
      groups[categorizeStat(stat)].push(stat);
    }
    return groups;
  }, [availableStats]);


  // Store token address when token prop changes
  useEffect(() => {
    if (token?.address) {
      // Force convert to string and ensure it's a valid address
      const addressToStore = String(token.address).replace(/[object Object]/g, '');
      
      if (addressToStore && addressToStore.length > 0 && addressToStore !== '[object Object]') {
        localStorage.setItem('selectedTokenAddress', addressToStore);
      } else {
        console.error('Invalid address detected:', token.address);
      }
    }
  }, [token?.address]);

  // Load available stats from the registry
  useEffect(() => {
    const loadStats = async () => {
      try {
        const { availableStats } = await import('@/lib/stats');
        setAvailableStats(availableStats);
      } catch (error) {
        console.error('Failed to load stats:', error);
        onError('Failed to load available statistics');
      }
    };
    loadStats();
  }, [onError]);

  const handleStatToggle = (statId: string) => {
    if (statId === 'tokenBalance') {
      // Special handling for token balance stat
      if (selectedStats.includes(statId)) {
        // Remove from selection
        setSelectedStats(prev => prev.filter(id => id !== statId));
        setTokenBalanceConfig(null);
      } else {
        // Show form for configuration
        setShowTokenBalanceForm(true);
      }
    } else {
      // Normal stat toggle
      setSelectedStats(prev => 
        prev.includes(statId) 
          ? prev.filter(id => id !== statId)
          : [...prev, statId]
      );
    }
  };

  const handleTokenBalanceConfirm = (walletAddress: string, tokenAddress: string) => {
    setTokenBalanceConfig({ walletAddress, tokenAddress });
    setSelectedStats(prev => [...prev, 'tokenBalance']);
    setShowTokenBalanceForm(false);
  };

  const handleTokenBalanceCancel = () => {
    setShowTokenBalanceForm(false);
  };

  const loadSelectedStats = async () => {
    if (!token?.address || selectedStats.length === 0) {
      onError('Please select a token and at least one stat');
      return;
    }

    // Store token address locally - ensure it's a string
    const tokenAddress = typeof token.address === 'string' ? token.address : String(token.address);
    localStorage.setItem('selectedTokenAddress', tokenAddress);

    setIsLoading(true);
    onError(null);

    try {
      // Ensure we have a proper string address
      const addressToUse = typeof token.address === 'string' && token.address !== '[object Object]'
        ? token.address
        : tokenAddress; // Use the processed address from above
      
      // Handle token balance stat specially
      let results: Record<string, StatResult>;
      if (selectedStats.includes('tokenBalance') && tokenBalanceConfig) {
        results = await fetchStats(selectedStats, tokenBalanceConfig.tokenAddress, tokenBalanceConfig.walletAddress);
      } else {
        results = await fetchStats(selectedStats, addressToUse);
      }
      setStatResults(results);
      
      // Convert to StatConfig format for parent component
      const statsConfig: StatConfig[] = selectedStats.map(statId => {
        const result = results[statId];
        const stat = availableStats.find(s => s.id === statId);
        
        return {
          id: statId,
          name: stat?.name || statId,
          label: stat?.name || statId,
          description: stat?.description || '',
          enabled: !result.error,
          format: stat?.format || 'number',
          decimals: stat?.decimals,
          prefix: stat?.prefix,
          suffix: stat?.suffix
        };
      });
      
      onStatsChange(statsConfig);
      
      // Also pass the raw results to parent component
      if (onStatResultsChange) {
        onStatResultsChange(results);
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Token Address Display */}
      <div className="bg-slate-950/20 border border-blue-500/30 rounded-lg p-4">
        <h4 className="text-lg font-semibold text-blue-300 mb-2">Current Token Address</h4>
        <div className="bg-gray-800 rounded p-3 font-mono text-sm">
          {localStorage.getItem('selectedTokenAddress') || 'No token selected'}
        </div>
      </div>

      {/* Stats Selection */}
      <div className="bg-gray-800/70 rounded-xl p-6 border border-white/10 backdrop-blur">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">Select Statistics</h3>
            <p className="text-gray-300">Choose stats to display. Click a tile to toggle. Preview shows how it appears on a card.</p>
          </div>
        </div>

        {availableStats.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📊</div>
            <p className="text-gray-400">No stats available yet</p>
            <p className="text-sm text-gray-500 mt-2">
              Stats will appear here as they are implemented
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedStats).map(([category, stats]) => (
              stats.length === 0 ? null : (
                <div key={category}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-semibold text-white/90">{category}</h4>
                    <span className="text-xs text-white/50">{stats.length} stats</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {stats.map((stat) => {
                      const isSelected = selectedStats.includes(stat.id);
                      return (
                        <motion.div
                          key={stat.id}
                          whileHover={{ scale: 1.02 }}
                          className={`p-4 rounded-xl cursor-pointer transition-all border ${
                            isSelected
                              ? 'border-blue-500/60 bg-slate-950/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
                              : 'border-white/10 bg-white/5 hover:bg-white/10'
                          }`}
                          onClick={() => handleStatToggle(stat.id)}
                          title={`${isSelected ? 'Remove' : 'Add'} ${stat.name}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h5 className="font-semibold text-white leading-tight">{stat.name}</h5>
                                <span className="text-[10px] uppercase tracking-wider text-white/60 bg-white/10 border border-white/10 rounded px-1.5 py-0.5">{stat.format}</span>
                              </div>
                              <p className="text-xs text-white/60 mt-1 line-clamp-2">{stat.description}</p>
                              <div className="mt-3 bg-slate-950/30 border border-white/10 rounded-lg p-3">
                                <div className="text-xs text-white/60">Preview</div>
                                <div className="mt-1 flex items-baseline justify-between">
                                  <span className="text-xs text-white/60">{stat.name}</span>
                                  <span className="text-sm font-bold text-white">{getSampleFormattedValue(stat)}</span>
                                </div>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleStatToggle(stat.id)}
                              className="mt-1 w-4 h-4 text-slate-950 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                              title={`Select ${stat.name} stat`}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={loadSelectedStats}
          disabled={isLoading || !token?.address || selectedStats.length === 0}
          className={`w-full py-3 px-6 rounded-lg font-semibold transition-all mt-6 ${
            isLoading || !token?.address || selectedStats.length === 0
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-slate-950 hover:bg-slate-950 text-white'
          }`}
        >
          {isLoading ? 'Loading Stats...' : 'Load Selected Stats'}
        </motion.button>
      </div>

      {/* Results Display */}
      {Object.keys(statResults).length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Live Results</h3>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(statResults).map(([statId, result]) => (
              <motion.div
                key={statId}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`p-4 rounded-lg border-2 ${
                  result.error
                    ? 'border-red-500 bg-red-900/20'
                    : 'border-blue-500 bg-slate-950/20'
                }`}
              >
                <div className="text-center">
                  <h4 className="font-semibold text-white mb-2">
                    {availableStats.find(s => s.id === statId)?.name || statId}
                  </h4>
                  <div className="text-2xl font-bold text-white">
                    {result.formattedValue}
                  </div>
                  {result.error && (
                    <div className="text-xs text-red-400 mt-2">
                      {result.error}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Token Balance Form Modal */}
      {showTokenBalanceForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <TokenBalanceForm
            onConfirm={handleTokenBalanceConfirm}
            onCancel={handleTokenBalanceCancel}
          />
        </div>
      )}
    </div>
  );
} 