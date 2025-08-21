import React, { useState, useEffect, useMemo } from 'react';
import { X, User, TrendingUp, Target, Clock, Zap, Award, AlertTriangle, CheckCircle, Activity, Calendar, DollarSign, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Link, Globe } from 'lucide-react';
import { hexStakingService } from '@/services/hexStakingService';
import { pulsechainHexStakingService } from '@/services/pulsechainHexStakingService';
import type { StakerHistoryMetrics, HexStake, HexStakeEnd } from '@/services/hexStakingService';

interface StakerHistoryModalProps {
  stakerAddress: string | null;
  isOpen: boolean;
  onClose: () => void;
  network: 'ethereum' | 'pulsechain';
}

const StakerHistoryModal: React.FC<StakerHistoryModalProps> = ({
  stakerAddress,
  isOpen,
  onClose,
  network,
}) => {
  const [historyData, setHistoryData] = useState<StakerHistoryMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'active' | 'ended'>('overview');
  const [sortField, setSortField] = useState<'stakeId' | 'stakedHearts' | 'stakedDays' | 'startDay' | 'endDay' | 'daysServed'>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Helper functions for calculations
  const calculateStakeUSD = (stakedHearts: string): number => {
    const hearts = parseFloat(stakedHearts);
    // Use a default price if not available - this should be passed from parent
    const defaultPrice = 0.01; // Default HEX price
    return (hearts / 100000000) * defaultPrice;
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

  useEffect(() => {
    if (isOpen && stakerAddress) {
      fetchStakerHistory();
    }
  }, [isOpen, stakerAddress, network]);

  const fetchStakerHistory = async () => {
    if (!stakerAddress) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const service = network === 'ethereum' ? hexStakingService : pulsechainHexStakingService;
      const data = await service.getStakerHistory(stakerAddress);
      setHistoryData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch staker history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3" />;
    return sortDirection === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />;
  };

  const sortedStakes = useMemo(() => {
    if (!historyData || !historyData.stakes || !Array.isArray(historyData.stakes)) return [];
    
    const stakesToSort = activeTab === 'active' 
      ? historyData.stakes.filter(s => s && s.isActive)
      : activeTab === 'ended'
      ? historyData.stakes.filter(s => s && !s.isActive)
      : historyData.stakes.filter(s => s);

    return [...stakesToSort].sort((a, b) => {
      let aValue: number | string, bValue: number | string;
      
      switch (sortField) {
        case 'stakeId':
          aValue = parseInt(a.stakeId);
          bValue = parseInt(b.stakeId);
          break;
        case 'stakedHearts':
          aValue = parseFloat(a.stakedHearts);
          bValue = parseFloat(b.stakedHearts);
          break;
        case 'stakedDays':
          aValue = parseInt(a.stakedDays);
          bValue = parseInt(b.stakedDays);
          break;
        case 'startDay':
          aValue = parseInt(a.startDay);
          bValue = parseInt(b.startDay);
          break;
        case 'endDay':
          aValue = parseInt(a.endDay);
          bValue = parseInt(b.endDay);
          break;
        case 'daysServed':
          aValue = a.daysServed || 0;
          bValue = b.daysServed || 0;
          break;
        default:
          aValue = parseInt(a.timestamp);
          bValue = parseInt(b.timestamp);
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      
      return sortDirection === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
    });
  }, [historyData, activeTab, sortField, sortDirection]);

  const getStakeEndData = (stakeId: string): HexStakeEnd | undefined => {
    if (!historyData?.stakeEnds || !Array.isArray(historyData.stakeEnds)) return undefined;
    return historyData.stakeEnds.find(end => end && end.stakeId === stakeId);
  };

  const getStakeStatusColor = (stake: HexStake) => {
    if (stake.isActive) {
      if (stake.daysLeft && stake.daysLeft < 30) return 'text-yellow-400';
      return 'text-green-400';
    }
    const endData = getStakeEndData(stake.stakeId);
    if (endData && parseFloat(endData.penalty || '0') > 0) return 'text-red-400';
    return 'text-blue-400';
  };

  const getStakeStatusIcon = (stake: HexStake) => {
    if (stake.isActive) {
      if (stake.daysLeft && stake.daysLeft < 30) return <AlertTriangle className="w-4 h-4" />;
      return <Activity className="w-4 h-4" />;
    }
    const endData = getStakeEndData(stake.stakeId);
    if (endData && parseFloat(endData.penalty || '0') > 0) return <AlertTriangle className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  const formatDate = (timestamp: string) => {
    return new Date(parseInt(timestamp) * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-7xl max-h-[90vh] bg-gradient-to-br from-slate-900/95 to-purple-900/95 backdrop-blur-xl border border-white/20 rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)] overflow-hidden transform transition-all duration-300 ease-out scale-100">
        
        {/* Header */}
        <div className="relative px-8 py-6 bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-b border-white/10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <User className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  {network === 'ethereum' ? (
                    <>
                      <img src="/ethlogo.svg" alt="Ethereum" className="w-6 h-6" />
                      Ethereum
                    </>
                  ) : (
                    <>
                      <img src="/LogoVector.svg" alt="PulseChain" className="w-6 h-6" />
                      PulseChain
                    </>
                  )} Staker History
                </h2>
                <p className="text-slate-400 text-sm mt-1 font-mono break-all">
                  {stakerAddress}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 max-h-[calc(90vh-120px)] overflow-y-auto">
          
          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <h3 className="text-xl font-semibold text-white mb-2">Loading Staker History...</h3>
              <p className="text-slate-400">Fetching comprehensive staking data from The Graph</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-12">
              <div className="bg-red-900/20 border border-red-500/50 text-red-300 px-6 py-4 rounded-xl mb-4">
                <h3 className="font-bold text-lg mb-2">Error Loading History</h3>
                <p className="mb-4">{error}</p>
                <button
                  onClick={fetchStakerHistory}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Data Display */}
          {historyData && !isLoading && !error && (
            <div className="space-y-8">

              {/* Overview Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    <span className="text-sm text-slate-400 flex items-center gap-1">
                      <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                      Total Stakes
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-blue-400">
                    {(historyData.totalStakes || 0).toLocaleString()}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    <span className="text-sm text-slate-400">Active</span>
                  </div>
                  <div className="text-2xl font-bold text-green-400">
                    {(historyData.activeStakes || 0).toLocaleString()}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-purple-400" />
                    <span className="text-sm text-slate-400">Ended</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-400">
                    {(historyData.endedStakes || 0).toLocaleString()}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    <span className="text-sm text-slate-400 flex items-center gap-1">
                      <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                      Total HEX
                    </span>
                  </div>
                  <div className="text-xl font-bold text-yellow-400">
                    {(network === 'ethereum' ? hexStakingService : pulsechainHexStakingService).formatHexAmount(historyData.totalStakedHearts || '0')}
                  </div>
                  <div className="text-xs text-yellow-600 mt-1">
                    {formatUSD(calculateStakeUSD(historyData.totalStakedHearts || '0'))}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="w-5 h-5 text-pink-400" />
                    <span className="text-sm text-slate-400 flex items-center gap-1">
                      <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                      Total T-Shares
                    </span>
                  </div>
                  <div className="text-xl font-bold text-pink-400">
                    {(network === 'ethereum' ? hexStakingService : pulsechainHexStakingService).formatTShareAmount(historyData.totalTShares || '0')}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-500/10 to-blue-500/10 border border-indigo-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-indigo-400" />
                    <span className="text-sm text-slate-400">Avg Length</span>
                  </div>
                  <div className="text-xl font-bold text-indigo-400">
                    {(network === 'ethereum' ? hexStakingService : pulsechainHexStakingService).formatStakeLength(Math.round(historyData.averageStakeLength || 0))}
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              {(historyData.endedStakes || 0) > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-5 h-5 text-green-400" />
                      <span className="text-sm text-slate-400 flex items-center gap-1">
                      <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                      Total Payouts
                    </span>
                    </div>
                    <div className="text-xl font-bold text-green-400">
                      {Math.round(parseFloat(historyData.totalPayouts || '0') / Math.pow(10, 8)).toLocaleString()} HEX
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      <span className="text-sm text-slate-400 flex items-center gap-1">
                      <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                      Total Penalties
                    </span>
                    </div>
                    <div className="text-xl font-bold text-red-400">
                      {Math.round(parseFloat(historyData.totalPenalties || '0') / Math.pow(10, 8)).toLocaleString()} HEX
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-blue-400" />
                      <span className="text-sm text-slate-400">Avg APY</span>
                    </div>
                    <div className="text-xl font-bold text-blue-400">
                      {(() => {
                        if (!historyData || !historyData.stakes || !Array.isArray(historyData.stakes)) return '0.0%';
                        
                        const endedStakes = historyData.stakes.filter(s => s && !s.isActive);
                        const service = network === 'ethereum' ? hexStakingService : pulsechainHexStakingService;
                        const apyValues = endedStakes.map(stake => {
                          if (!stake) return 0;
                          const endData = getStakeEndData(stake.stakeId);
                          if (endData && parseFloat(endData.payout || '0') > 0) {
                            return service.calculateStakeAPY(stake, endData);
                          }
                          return 0;
                        }).filter(apy => apy > 0);
                        
                        const avgAPY = apyValues.length > 0 
                          ? apyValues.reduce((sum, apy) => sum + apy, 0) / apyValues.length 
                          : 0;
                        
                        return `${avgAPY.toFixed(1)}%`;
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Earnings Projections for Active Stakes */}
              {(historyData.activeStakes || 0) > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-green-400" />
                      <span className="text-sm text-slate-400">Active Stakes Earnings</span>
                    </div>
                    <div className="text-xl font-bold text-green-400">
                      {(() => {
                        if (!historyData || !historyData.stakes || !Array.isArray(historyData.stakes)) return '0 HEX';
                        
                        const activeStakes = historyData.stakes.filter(s => s && s.isActive);
                        const totalEarned = activeStakes.reduce((sum, stake) => {
                          return sum + calculateEarnedSoFar(stake.stakedHearts, stake.daysServed || 0, stake.stakedDays);
                        }, 0);
                        
                        return `${(totalEarned * 100000000).toFixed(0)} HEX`;
                      })()}
                    </div>
                    <div className="text-xs text-emerald-400">
                      {(() => {
                        if (!historyData || !historyData.stakes || !Array.isArray(historyData.stakes)) return '$0.00';
                        
                        const activeStakes = historyData.stakes.filter(s => s && s.isActive);
                        const totalEarned = activeStakes.reduce((sum, stake) => {
                          return sum + calculateEarnedSoFar(stake.stakedHearts, stake.daysServed || 0, stake.stakedDays);
                        }, 0);
                        
                        return formatUSD(totalEarned);
                      })()}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-5 h-5 text-blue-400" />
                      <span className="text-sm text-slate-400">Expected Total</span>
                    </div>
                    <div className="text-xl font-bold text-blue-400">
                      {(() => {
                        if (!historyData || !historyData.stakes || !Array.isArray(historyData.stakes)) return '0 HEX';
                        
                        const activeStakes = historyData.stakes.filter(s => s && s.isActive);
                        const totalExpected = activeStakes.reduce((sum, stake) => {
                          return sum + calculateExpectedEarnings(stake.stakedHearts, stake.stakedDays);
                        }, 0);
                        
                        return `${(totalExpected * 100000000).toFixed(0)} HEX`;
                      })()}
                    </div>
                    <div className="text-xs text-blue-400">
                      {(() => {
                        if (!historyData || !historyData.stakes || !Array.isArray(historyData.stakes)) return '$0.00';
                        
                        const activeStakes = historyData.stakes.filter(s => s && s.isActive);
                        const totalExpected = activeStakes.reduce((sum, stake) => {
                          return sum + calculateExpectedEarnings(stake.stakedHearts, stake.stakedDays);
                        }, 0);
                        
                        return formatUSD(totalExpected);
                      })()}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-5 h-5 text-purple-400" />
                      <span className="text-sm text-slate-400">Remaining to Earn</span>
                    </div>
                    <div className="text-xl font-bold text-purple-400">
                      {(() => {
                        if (!historyData || !historyData.stakes || !Array.isArray(historyData.stakes)) return '0 HEX';
                        
                        const activeStakes = historyData.stakes.filter(s => s && s.isActive);
                        const totalEarned = activeStakes.reduce((sum, stake) => {
                          return sum + calculateEarnedSoFar(stake.stakedHearts, stake.daysServed || 0, stake.stakedDays);
                        }, 0);
                        const totalExpected = activeStakes.reduce((sum, stake) => {
                          return sum + calculateExpectedEarnings(stake.stakedHearts, stake.stakedDays);
                        }, 0);
                        
                        return `${((totalExpected - totalEarned) * 100000000).toFixed(0)} HEX`;
                      })()}
                    </div>
                    <div className="text-xs text-purple-400">
                      {(() => {
                        if (!historyData || !historyData.stakes || !Array.isArray(historyData.stakes)) return '$0.00';
                        
                        const activeStakes = historyData.stakes.filter(s => s && s.isActive);
                        const totalEarned = activeStakes.reduce((sum, stake) => {
                          return sum + calculateEarnedSoFar(stake.stakedHearts, stake.daysServed || 0, stake.stakedDays);
                        }, 0);
                        const totalExpected = activeStakes.reduce((sum, stake) => {
                          return sum + calculateExpectedEarnings(stake.stakedHearts, stake.stakedDays);
                        }, 0);
                        
                        return formatUSD(totalExpected - totalEarned);
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="border-b border-white/10">
                <nav className="-mb-px flex space-x-8">
                  {[
                    { key: 'overview', label: `All Stakes (${historyData.totalStakes || 0})`, icon: Activity },
                    { key: 'active', label: `Active (${historyData.activeStakes || 0})`, icon: TrendingUp },
                    { key: 'ended', label: `Ended (${historyData.endedStakes || 0})`, icon: CheckCircle }
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key as any)}
                      className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                        activeTab === key
                          ? 'border-purple-500 text-purple-400'
                          : 'border-transparent text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Stakes Table */}
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl overflow-hidden">
                <div className="overflow-auto max-h-[60vh]">
                  <table className="min-w-full divide-y divide-white/10">
                    <thead className="bg-slate-900 text-white sticky top-0">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                        <th 
                          className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                          onClick={() => handleSort('stakeId')}
                        >
                          <div className="flex items-center gap-1">
                            Stake ID
                            {getSortIcon('stakeId')}
                          </div>
                        </th>
                        <th 
                          className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                          onClick={() => handleSort('stakedHearts')}
                        >
                          <div className="flex items-center gap-1">
                            Amount (HEX)
                            {getSortIcon('stakedHearts')}
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">T-Shares</th>
                        <th 
                          className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                          onClick={() => handleSort('stakedDays')}
                        >
                          <div className="flex items-center gap-1">
                            Length
                            {getSortIcon('stakedDays')}
                          </div>
                        </th>
                        <th 
                          className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                          onClick={() => handleSort('daysServed')}
                        >
                          <div className="flex items-center gap-1">
                            Days Served
                            {getSortIcon('daysServed')}
                          </div>
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Progress</th>
                        <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Started</th>
                        <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Chain</th>
                        <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Transactions</th>
                        <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Performance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-transparent divide-y divide-white/10">
                      {sortedStakes.filter(stake => stake).map((stake) => {
                        if (!stake) return null;
                        const endData = getStakeEndData(stake.stakeId);
                        const progress = stake.daysServed && stake.stakedDays 
                          ? (stake.daysServed / parseInt(stake.stakedDays)) * 100 
                          : 0;
                        const hasPenalty = endData && parseFloat(endData.penalty || '0') > 0;
                        
                        return (
                          <tr key={stake.id || stake.stakeId} className="hover:bg-white/5">
                            <td className="px-3 py-4 whitespace-nowrap text-sm">
                              <div className={`flex items-center gap-2 ${getStakeStatusColor(stake)}`}>
                                {getStakeStatusIcon(stake)}
                                <span className="font-medium">
                                  {stake.isActive ? 'Active' : 'Ended'}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-white">
                              {stake.stakeId}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-green-400 font-semibold">
                              {(network === 'ethereum' ? hexStakingService : pulsechainHexStakingService).formatHexAmount(stake.stakedHearts)}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-purple-400">
                              {(network === 'ethereum' ? hexStakingService : pulsechainHexStakingService).formatTShareAmount(stake.stakeTShares || stake.stakeShares)}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-blue-400">
                              {(network === 'ethereum' ? hexStakingService : pulsechainHexStakingService).formatStakeLengthInDays(parseInt(stake.stakedDays))}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-orange-400">
                              <div className="space-y-1">
                                <div>
                                  {stake.daysServed?.toLocaleString() || 'N/A'} days
                                </div>
                                {endData && !stake.isActive && (() => {
                                  const service = network === 'ethereum' ? hexStakingService : pulsechainHexStakingService;
                                  const daysLate = service.calculateLateEndingDays(stake, endData);
                                  if (daysLate > 0) {
                                    return (
                                      <div className="text-xs text-yellow-400">
                                        +{daysLate.toLocaleString()} days late
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-slate-700 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full transition-all ${
                                      hasPenalty ? 'bg-red-500' : progress >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-purple-500 to-blue-500'
                                    }`}
                                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                                  />
                                </div>
                                <span className="text-xs text-slate-400">{progress.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-400">
                              {formatDate(stake.timestamp)}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-400">
                              <div className="flex items-center gap-1">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  network === 'ethereum' 
                                    ? 'bg-blue-500/20 text-blue-400' 
                                    : 'bg-purple-500/20 text-purple-400'
                                }`}>
                                  {network === 'ethereum' ? 'Ethereum' : 'PulseChain'}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm">
                              <div className="space-y-1">
                                {/* Start Transaction */}
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-slate-500">Start:</span>
                                  <a
                                    href={(network === 'ethereum' ? hexStakingService : pulsechainHexStakingService).getTransactionUrl(stake.transactionHash)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1 underline"
                                    title={`View start transaction: ${stake.transactionHash}`}
                                  >
                                    <span>{stake.transactionHash.slice(0, 8)}...</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                                
                                {/* End Transaction */}
                                {endData && endData.transactionHash && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-slate-500">End:</span>
                                    <a
                                      href={(network === 'ethereum' ? hexStakingService : pulsechainHexStakingService).getTransactionUrl(endData.transactionHash)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 underline"
                                      title={`View end transaction: ${endData.transactionHash}`}
                                    >
                                      <span>{endData.transactionHash.slice(0, 8)}...</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                )}
                                
                                {stake.isActive && (
                                  <div className="text-xs text-slate-500">End: N/A</div>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm">
                              {endData ? (
                                <div className="space-y-1">
                                  {parseFloat(endData.payout || '0') > 0 && (
                                    <div className="text-xs text-green-400">
                                      +{Math.round(parseFloat(endData.payout) / Math.pow(10, 8)).toLocaleString()} HEX
                                    </div>
                                  )}
                                  {parseFloat(endData.penalty || '0') > 0 && (
                                    <div className="text-xs text-red-400">
                                      -{Math.round(parseFloat(endData.penalty) / Math.pow(10, 8)).toLocaleString()} HEX
                                    </div>
                                  )}
                                  {parseFloat(endData.payout || '0') > 0 && (
                                    <div className="text-xs text-blue-400">
                                      APY: {(network === 'ethereum' ? hexStakingService : pulsechainHexStakingService).calculateStakeAPY(stake, endData).toFixed(1)}%
                                    </div>
                                  )}
                                </div>
                              ) : stake.isActive ? (
                                <span className="text-xs text-slate-500">Active</span>
                              ) : (
                                <span className="text-xs text-slate-500">N/A</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  
                  {sortedStakes.length === 0 && (
                    <div className="text-center py-8 text-slate-400">
                      No stakes found for this filter
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StakerHistoryModal;