import React, { useState } from 'react';
import { Crown, TrendingUp, Clock, Target, Zap, ArrowUpDown, ArrowUp, ArrowDown, Globe, Copy } from 'lucide-react';
import { hexStakingService } from '@/services/hexStakingService';
import { multiNetworkHexStakingService } from '@/services/multiNetworkHexStakingService';
import StakeDetailModal from './StakeDetailModal';
import StakerHistoryModal from './StakerHistoryModal';
import { CometCard } from '@/components/ui/comet-card';
import type { HexStake } from '@/services/hexStakingService';
import type { MultiNetworkHexStake } from '@/services/multiNetworkHexStakingService';

interface TopStakesVisualProps {
  stakes: (HexStake | MultiNetworkHexStake)[];
  hexPrice?: number; // Current HEX price in USD
}

const TopStakesVisual: React.FC<TopStakesVisualProps> = ({ stakes, hexPrice = 0 }) => {
  const [selectedStake, setSelectedStake] = useState<HexStake | MultiNetworkHexStake | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortField, setSortField] = useState<'amount' | 'progress' | 'daysLeft' | 'length'>('amount');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedStakerAddress, setSelectedStakerAddress] = useState<string | null>(null);
  const [isStakerHistoryModalOpen, setIsStakerHistoryModalOpen] = useState<boolean>(false);

  // Helper functions for calculations
  const calculateStakeUSD = (stakedHearts: string): number => {
    const hearts = parseFloat(stakedHearts);
    return (hearts / 100000000) * hexPrice; // Convert hearts to HEX, then to USD
  };

  const calculateExpectedEarnings = (stakedHearts: string, stakedDays: string): number => {
    const hearts = parseFloat(stakedHearts);
    const days = parseInt(stakedDays);
    const hexAmount = hearts / 100000000;
    const baseYield = 0.05; // 5% base yield
    const dayMultiplier = Math.min(days / 365, 2); // Cap at 2x for very long stakes
    return hexAmount * baseYield * dayMultiplier;
  };

  const calculateEarnedSoFar = (stakedHearts: string, daysServed: number, stakedDays: string): number => {
    const hearts = parseFloat(stakedHearts);
    const days = parseInt(stakedDays);
    const hexAmount = hearts / 100000000;
    if (!daysServed || daysServed <= 0) return 0;
    const progressRatio = daysServed / days;
    const expectedEarnings = calculateExpectedEarnings(stakedHearts, stakedDays);
    return expectedEarnings * progressRatio;
  };

  const formatUSD = (amount: number): string => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(2)}K`;
    } else {
      return `$${amount.toFixed(2)}`;
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here if desired
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleStakeClick = (stake: HexStake | MultiNetworkHexStake) => {
    setSelectedStake(stake);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedStake(null);
  };

  const handleStakerClick = (stakerAddress: string) => {
    setSelectedStakerAddress(stakerAddress);
    setIsStakerHistoryModalOpen(true);
  };

  const handleStakerHistoryModalClose = () => {
    setIsStakerHistoryModalOpen(false);
    setSelectedStakerAddress(null);
  };

  const handleSort = (field: 'amount' | 'progress' | 'daysLeft' | 'length') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedStakes = [...stakes].sort((a, b) => {
    let aValue: number, bValue: number;
    
    switch (sortField) {
      case 'amount':
        aValue = parseFloat(a.stakedHearts);
        bValue = parseFloat(b.stakedHearts);
        break;
      case 'progress':
        aValue = a.daysServed && a.stakedDays ? (a.daysServed / parseInt(a.stakedDays)) * 100 : 0;
        bValue = b.daysServed && b.stakedDays ? (b.daysServed / parseInt(b.stakedDays)) * 100 : 0;
        break;
      case 'daysLeft':
        aValue = a.daysLeft || 0;
        bValue = b.daysLeft || 0;
        break;
      case 'length':
        aValue = parseInt(a.stakedDays);
        bValue = parseInt(b.stakedDays);
        break;
      default:
        return 0;
    }
    
    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
  });

  const getProgressColor = (progress: number) => {
    if (progress < 25) return 'from-red-500 to-orange-500';
    if (progress < 50) return 'from-orange-500 to-yellow-500';
    if (progress < 75) return 'from-yellow-500 to-blue-500';
    return 'from-blue-500 to-green-500';
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="w-5 h-5 text-yellow-400" />;
    if (index === 1) return <Crown className="w-5 h-5 text-gray-300" />;
    if (index === 2) return <Crown className="w-5 h-5 text-amber-600" />;
    return <span className="text-sm font-bold text-slate-400">#{index + 1}</span>;
  };

  const getStakeStatusColor = (daysLeft: number) => {
    if (daysLeft < 30) return 'text-red-400';
    if (daysLeft < 365) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-pink-900/20 to-blue-900/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-800" />
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-600">Top 50 Active HEX Stakes</h4>
              <p className="text-sm text-slate-600">Largest currently active stakes by amount • Excludes ended & expired stakes</p>
            </div>
          </div>
          
          {/* Sort Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-600 mr-2">Sort by:</span>
            {[
              { key: 'amount', label: 'Amount' },
              { key: 'progress', label: 'Progress' },
              { key: 'daysLeft', label: 'Days Left' },
              { key: 'length', label: 'Length' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleSort(key as any)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  sortField === key
                    ? 'bg-purple-500/20 text-slate-600 border border-slate-400/30'
                    : 'bg-white/5 text-slate-600 hover:bg-white/10 hover:text-red-600'
                }`}
              >
                {label}
                {sortField === key ? (
                  sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
                ) : (
                  <ArrowUpDown className="w-3 h-3" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="p-6 max-h-[80vh] overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sortedStakes.map((stake, index) => {
            const progress = stake.daysServed && stake.stakedDays 
              ? (stake.daysServed / parseInt(stake.stakedDays)) * 100 
              : 0;
            
            return (
              <div
                key={stake.id}
                onClick={() => handleStakeClick(stake)}
                className="cursor-pointer"
              >
                <CometCard
                  className="relative group bg-gradient-to-br from-white/5 to-white/10 backdrop-blur border border-white/10 rounded-xl transition-all duration-300"
                >
                  <div className="p-6">
                    {/* Rank Badge */}
                    <div className="absolute -top-2 -left-2 flex items-center justify-center w-8 h-8 bg-slate-800 border border-white/20 rounded-full">
                      {getRankIcon(index)}
                    </div>

                    {/* Top 3 Glow Effect */}
                    {index < 3 && (
                      <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/5 to-purple-400/5 rounded-xl -z-10" />
                    )}

                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-lg font-bold text-blue-700">
                            Stake #{stake.stakeId}
                          </div>
                          {stake.network && (
                            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded ${
                              stake.network === 'ethereum' 
                                ? 'bg-blue-500/20 text-blue-600 border border-blue-500/30' 
                                : 'bg-purple-500/20 text-purple-600 border border-purple-500/30'
                            }`}>
                              <Globe className="w-3 h-3" />
                              {stake.network === 'ethereum' ? 'ETH' : 'PLS'}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent triggering the stake detail modal
                              handleStakerClick(stake.stakerAddr);
                            }}
                            className="text-xs text-slate-600 font-mono hover:text-blue-600 transition-colors cursor-pointer underline decoration-green-400/60 decoration-2 underline-offset-2"
                            title={`${stake.stakerAddr} - Click to view staking history`}
                          >
                            {stake.stakerAddr.slice(0, 4)}...{stake.stakerAddr.slice(-4)}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(stake.stakerAddr);
                            }}
                            className="text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                            title="Copy address to clipboard"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-black">
                          {multiNetworkHexStakingService.formatHexAmount(stake.stakedHearts)}
                        </div>
                        <div className="text-md text-slate-600">HEX</div>
                        {hexPrice > 0 && (
                          <div className="text-sm font-semibold text-emerald-600">
                            {formatUSD(calculateStakeUSD(stake.stakedHearts))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress Section */}
                    <div className="space-y-3">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-xs text-slate-600 mb-1">
                          <span>Progress</span>
                          <span>{progress.toFixed(1)}%</span>
                        </div>
                        <div className="relative w-full bg-slate-500/10 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r ${getProgressColor(progress)} transition-all duration-1000 ease-out rounded-full relative`}
                            style={{ 
                              width: `${Math.min(100, Math.max(0, progress))}%`,
                            }}
                          >
                            <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-slate-600 mt-1">
                          <span>Start: Day {stake.startDay}</span>
                          <span>End: Day {stake.endDay}</span>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                          <Clock className="w-4 h-4 text-blue-700" />
                          <div>
                            <div className="text-md text-slate-600">Days Served</div>
                            <div className="text-md font-semibold text-blue-700">
                              {stake.daysServed?.toLocaleString() || 'N/A'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                          <Target className="w-4 h-4 text-red-700" />
                          <div>
                            <div className="text-md text-slate-600">Days Left</div>
                            <div className="text-md font-semibold text-red-700">
                              {stake.daysLeft?.toLocaleString() || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Stats */}
                      <div className="flex justify-between items-center pt-2 border-t border-white/10">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-purple-700" />
                          <div>
                            <div className="text-md text-slate-600">T-Shares</div>
                            <div className="text-md font-semibold text-purple-700">
                              {hexStakingService.formatTShareAmount(stake.stakeTShares || stake.stakeShares)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-md font-semibold text-slate-600">Length</div>
                          <div className="text-md font-semibold text-orange-700">
                            {hexStakingService.formatStakeLength(parseInt(stake.stakedDays))}
                          </div>
                        </div>
                      </div>

                      {/* Earnings Section */}
                      {hexPrice > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="text-center">
                              <div className="text-xs text-slate-600 mb-1">Earned So Far</div>
                              <div className="text-sm font-semibold text-green-600 flex items-center justify-center gap-1">
                                <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                                {multiNetworkHexStakingService.formatHexAmount(
                                  (calculateEarnedSoFar(stake.stakedHearts, stake.daysServed || 0, stake.stakedDays) * 100000000).toString()
                                )}
                              </div>
                              <div className="text-xs text-emerald-600">
                                {formatUSD(calculateEarnedSoFar(stake.stakedHearts, stake.daysServed || 0, stake.stakedDays))}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-xs text-slate-600 mb-1">Expected Total</div>
                              <div className="text-sm font-semibold text-blue-600 flex items-center justify-center gap-1">
                                <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                                {multiNetworkHexStakingService.formatHexAmount(
                                  (calculateExpectedEarnings(stake.stakedHearts, stake.stakedDays) * 100000000).toString()
                                )}
                              </div>
                              <div className="text-xs text-blue-600">
                                {formatUSD(calculateExpectedEarnings(stake.stakedHearts, stake.stakedDays))}
                              </div>
                            </div>
                          </div>
                        
                          {/* Current APY */}
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <div className="text-center">
                              <div className="text-xs text-slate-600 mb-1">Current APY</div>
                              <div className="text-sm font-semibold text-purple-600">
                                {(() => {
                                  if (!stake.daysServed || !stake.stakedDays) return 'N/A';
                                  const daysServed = stake.daysServed;
                                  const totalDays = parseInt(stake.stakedDays);
                                  const progressRatio = daysServed / totalDays;
                                  const baseYield = 0.05; // 5% base yield
                                  const dayMultiplier = Math.min(totalDays / 365, 2);
                                  const annualizedYield = baseYield * dayMultiplier;
                                  const currentAPY = annualizedYield * progressRatio;
                                  return `${(currentAPY * 100).toFixed(2)}%`;
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CometCard>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Bottom Stats Summary */}
      <div className="px-6 py-4 border-t border-white/10 bg-white/5">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-green-700">
              {hexStakingService.formatHexAmount(
                stakes.reduce((sum, stake) => sum + parseFloat(stake.stakedHearts), 0).toString()
              )}
            </div>
            <div className="text-xs text-slate-600">Total in Top 50</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-700">
              {(stakes.reduce((sum, stake) => sum + (stake.daysServed || 0), 0) / stakes.length).toFixed(0)}
            </div>
            <div className="text-xs text-slate-600">Avg Days Served</div>
          </div>
          <div>
            <div className="text-lg font-bold text-orange-700">
              {hexStakingService.formatStakeLength(
                Math.round(stakes.reduce((sum, stake) => sum + parseInt(stake.stakedDays), 0) / stakes.length)
              )}
            </div>
            <div className="text-xs text-slate-600">Avg Length</div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>

      {/* Stake Detail Modal */}
      <StakeDetailModal
        stake={selectedStake}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        rank={selectedStake ? stakes.findIndex(s => s.id === selectedStake.id) + 1 : undefined}
      />

      {/* Staker History Modal */}
      <StakerHistoryModal
        stakerAddress={selectedStakerAddress}
        isOpen={isStakerHistoryModalOpen}
        onClose={handleStakerHistoryModalClose}
        network={selectedStake?.network || 'ethereum'}
        currentPrice={hexPrice}
      />
    </div>
  );
};

export default TopStakesVisual;