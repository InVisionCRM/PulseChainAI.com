import React, { useState, useEffect, useMemo } from 'react';
import { X, Crown, Clock, Target, Zap, Calendar, User, Hash, TrendingUp, Award, Activity, CheckCircle, AlertTriangle, DollarSign, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, Globe } from 'lucide-react';
import { hexStakingService } from '@/services/hexStakingService';
import { multiNetworkHexStakingService } from '@/services/multiNetworkHexStakingService';
import type { HexStake, StakerHistoryMetrics, HexStakeEnd } from '@/services/hexStakingService';
import type { MultiNetworkStakerHistoryMetrics, MultiNetworkHexStake, MultiNetworkHexStakeEnd } from '@/services/multiNetworkHexStakingService';

interface StakeDetailModalProps {
  stake: HexStake | MultiNetworkHexStake | null;
  isOpen: boolean;
  onClose: () => void;
  rank?: number;
}

const StakeDetailModal: React.FC<StakeDetailModalProps> = ({
  stake,
  isOpen,
  onClose,
  rank,
}) => {
  const [stakerHistory, setStakerHistory] = useState<MultiNetworkStakerHistoryMetrics | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [historySubTab, setHistorySubTab] = useState<'overview' | 'active' | 'ended'>('overview');
  const [sortField, setSortField] = useState<'stakeId' | 'stakedHearts' | 'stakedDays' | 'startDay' | 'endDay' | 'daysServed'>('stakeId');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (isOpen && stake && activeTab === 'history' && !stakerHistory) {
      fetchStakerHistory();
    }
  }, [isOpen, stake, activeTab, stakerHistory]);

  // Reset tabs when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('details');
      setHistorySubTab('overview');
      setStakerHistory(null);
      setHistoryError(null);
    }
  }, [isOpen]);

  const fetchStakerHistory = async () => {
    if (!stake) return;
    
    setIsLoadingHistory(true);
    setHistoryError(null);
    
    try {
      const history = await multiNetworkHexStakingService.getStakerHistory(stake.stakerAddr);
      setStakerHistory(history);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Failed to fetch staker history');
    } finally {
      setIsLoadingHistory(false);
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
    if (!stakerHistory) return [];
    
    const stakesToSort = historySubTab === 'active' 
      ? stakerHistory.allStakes.filter(s => s.isActive)
      : historySubTab === 'ended'
      ? stakerHistory.allStakes.filter(s => !s.isActive)
      : stakerHistory.allStakes;

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
            aValue = parseInt(a.stakeId);
            bValue = parseInt(b.stakeId);
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' ? (aValue as string).localeCompare(bValue as string) : (bValue as string).localeCompare(aValue as string);
      }
      
      return sortDirection === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
    });
  }, [stakerHistory, historySubTab, sortField, sortDirection]);

  if (!isOpen || !stake) {
    return null;
  }

  const progress = stake.daysServed && stake.stakedDays 
    ? (stake.daysServed / parseInt(stake.stakedDays)) * 100 
    : 0;

  const getProgressColor = (progress: number) => {
    if (progress < 25) return 'from-red-500 to-orange-500';
    if (progress < 50) return 'from-orange-500 to-yellow-500';
    if (progress < 75) return 'from-yellow-500 to-blue-500';
    return 'from-blue-500 to-green-500';
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: <Crown className="w-5 h-5" />, color: 'text-yellow-400 bg-yellow-400/20', label: '1st Place' };
    if (rank === 2) return { icon: <Crown className="w-5 h-5" />, color: 'text-gray-300 bg-gray-300/20', label: '2nd Place' };
    if (rank === 3) return { icon: <Crown className="w-5 h-5" />, color: 'text-amber-600 bg-amber-600/20', label: '3rd Place' };
    return { icon: <Award className="w-5 h-5" />, color: 'text-purple-400 bg-purple-400/20', label: `#${rank}` };
  };

  const formatDateLong = (timestamp: string) => {
    const date = new Date(parseInt(timestamp) * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateShort = (timestamp: string) => {
    return new Date(parseInt(timestamp) * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  };

  const formatDate = (timestamp: string) => {
    return new Date(parseInt(timestamp) * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  };

  const getStakeEndData = (stakeId: string): MultiNetworkHexStakeEnd | undefined => {
    return stakerHistory?.allStakeEnds.find(end => end.stakeId === stakeId);
  };

  const getStakeStatusColor = (stake: MultiNetworkHexStake) => {
    if (stake.isActive) {
      if (stake.daysLeft && stake.daysLeft < 30) return 'text-yellow-400';
      return 'text-green-400';
    }
    const endData = getStakeEndData(stake.stakeId);
    if (endData && parseFloat(endData.penalty || '0') > 0) return 'text-red-400';
    return 'text-blue-400';
  };

  const getStakeStatusIcon = (stake: MultiNetworkHexStake) => {
    if (stake.isActive) {
      if (stake.daysLeft && stake.daysLeft < 30) return <AlertTriangle className="w-4 h-4" />;
      return <Activity className="w-4 h-4" />;
    }
    const endData = getStakeEndData(stake.stakeId);
    if (endData && parseFloat(endData.penalty || '0') > 0) return <AlertTriangle className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  const rankInfo = rank ? getRankBadge(rank) : null;
  const startDate = formatDate(stake.timestamp);
  const estimatedEndDate = stake.endDay && stake.startDay 
    ? new Date(Date.now() + (parseInt(stake.endDay) - parseInt(stake.startDay)) * 24 * 60 * 60 * 1000).toLocaleDateString()
    : 'N/A';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl bg-gradient-to-br from-slate-900/95 to-purple-900/95 backdrop-blur-xl border border-white/20 rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in duration-300">
        
        {/* Header */}
        <div className="relative px-8 py-6 bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-b border-white/10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {rankInfo && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${rankInfo.color} border border-current/20`}>
                  {rankInfo.icon}
                  <span className="font-bold text-sm">{rankInfo.label}</span>
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <img src="/HEXagon (1).svg" alt="HEX" className="w-6 h-6" />
                  HEX Stake #{stake.stakeId}
                </h2>
                <p className="text-slate-400 text-sm mt-1">Detailed stake information and metrics</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Close modal"
              aria-label="Close modal"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* Tab Navigation */}
          <div className="mt-6 border-b border-white/10">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('details')}
                className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === 'details'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                <Hash className="w-4 h-4" />
                Stake Details
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeTab === 'history'
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                <User className="w-4 h-4" />
                Staker History
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 max-h-[80vh] overflow-y-auto">
          {activeTab === 'details' && (
            <div>
              {/* Progress Section */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-400" />
                Stake Progress
              </h3>
              <span className="text-2xl font-bold text-purple-400">{progress.toFixed(1)}%</span>
            </div>
            <div className="relative w-full bg-slate-700/50 rounded-full h-4 overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${getProgressColor(progress)} transition-all duration-1000 ease-out rounded-full relative`}
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
              </div>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="w-5 h-5 text-green-400" />
                                    <span className="text-sm text-slate-400 flex items-center gap-1">
                      <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                      Staked HEX
                    </span>
              </div>
              <div className="text-xl font-bold text-green-400">
                {multiNetworkHexStakingService.formatHexAmount(stake.stakedHearts)}
              </div>
                                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <img src="/HEXagon (1).svg" alt="HEX" className="w-3 h-3" />
                    HEX
                  </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-500/20 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Award className="w-5 h-5 text-purple-400" />
                <span className="text-sm text-slate-400">T-Shares</span>
              </div>
              <div className="text-xl font-bold text-purple-400">
                {multiNetworkHexStakingService.formatTShareAmount(stake.stakeTShares || stake.stakeShares)}
              </div>
              <div className="text-xs text-slate-500 mt-1">Stake Shares</div>
            </div>

            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-blue-400" />
                <span className="text-sm text-slate-400">Days Served</span>
              </div>
              <div className="text-xl font-bold text-blue-400">
                {stake.daysServed?.toLocaleString() || 'N/A'}
              </div>
              <div className="text-xs text-slate-500 mt-1">of {stake.stakedDays} total</div>
            </div>

            <div className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/20 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-5 h-5 text-orange-400" />
                <span className="text-sm text-slate-400">Days Remaining</span>
              </div>
              <div className="text-xl font-bold text-orange-400">
                {stake.daysLeft?.toLocaleString() || 'N/A'}
              </div>
              <div className="text-xs text-slate-500 mt-1">days left</div>
            </div>
          </div>

          {/* Detailed Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Stake Details */}
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Hash className="w-5 h-5 text-cyan-400" />
                Stake Details
              </h4>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-slate-400">Stake ID:</span>
                  <span className="text-white font-mono">{stake.stakeId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Start Day:</span>
                  <span className="text-white">{stake.startDay}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">End Day:</span>
                  <span className="text-white">{stake.endDay}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Length:</span>
                  <span className="text-white">{multiNetworkHexStakingService.formatStakeLength(parseInt(stake.stakedDays))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Is Auto Stake:</span>
                  <span className={`${stake.isAutoStake ? 'text-green-400' : 'text-slate-400'}`}>
                    {stake.isAutoStake ? 'Yes' : 'No'}
                  </span>
                </div>
                {stake.stakeTShares && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">T-Shares Amount:</span>
                    <span className="text-white">{multiNetworkHexStakingService.formatTShareAmount(stake.stakeTShares)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Staker & Timeline Info */}
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6">
              <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-pink-400" />
                Staker & Timeline
              </h4>
              <div className="space-y-4">
                <div>
                  <span className="text-slate-400 block mb-1">Staker Address:</span>
                  <span className="text-white font-mono text-sm bg-slate-800/50 px-3 py-2 rounded-lg break-all">
                    {stake.stakerAddr}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Started:</span>
                  <span className="text-white text-sm">{formatDateLong(stake.timestamp)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Est. End:</span>
                  <span className="text-white text-sm">{estimatedEndDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Network:</span>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    <span className={`font-semibold ${
                      stake.network === 'ethereum' ? 'text-blue-400' : 'text-purple-400'
                    }`}>
                      {stake.network === 'ethereum' ? 'Ethereum' : 'PulseChain'}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="text-green-400 font-semibold">Active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="mt-8 bg-gradient-to-r from-purple-500/5 to-blue-500/5 border border-purple-500/20 rounded-xl p-6">
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              Performance Summary
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-400">
                  {progress.toFixed(1)}%
                </div>
                <div className="text-sm text-slate-400">Completion Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-cyan-400">
                  {stake.daysServed && stake.stakedDays 
                    ? ((stake.daysServed / parseInt(stake.stakedDays)) * 365).toFixed(0)
                    : 'N/A'
                  }
                </div>
                <div className="text-sm text-slate-400">Annualized Days</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-400">
                  {stake.daysLeft && stake.daysLeft > 0 ? 'Active' : 'Completed'}
                </div>
                <div className="text-sm text-slate-400">Current Status</div>
              </div>
            </div>
          </div>
            </div>
          )}
          
          {activeTab === 'history' && (
            <div className="space-y-6">
              {/* Loading State */}
              {isLoadingHistory && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                  <h3 className="text-xl font-semibold text-white mb-2">Loading Staker History...</h3>
                  <p className="text-slate-400">Fetching comprehensive staking data from The Graph</p>
                </div>
              )}

              {/* Error State */}
              {historyError && (
                <div className="text-center py-12">
                  <div className="bg-red-900/20 border border-red-500/50 text-red-300 px-6 py-4 rounded-xl mb-4">
                    <h3 className="font-bold text-lg mb-2">Error Loading History</h3>
                    <p className="mb-4">{historyError}</p>
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
              {stakerHistory && !isLoadingHistory && !historyError && (
                <div className="space-y-6">
                  
                  {/* Network Summary */}
                  <div className="mb-6">
                    <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <Globe className="w-5 h-5 text-cyan-400" />
                      Multi-Network Summary
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Ethereum Summary */}
                      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                          <span className="font-semibold text-blue-400 flex items-center gap-1">
                    <img src="/ethlogo.svg" alt="Ethereum" className="w-4 h-4" />
                    Ethereum Network
                  </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <div className="text-white font-bold">{stakerHistory.ethereum.totalStakes}</div>
                            <div className="text-slate-400">Total Stakes</div>
                          </div>
                          <div>
                            <div className="text-white font-bold">{stakerHistory.ethereum.activeStakes}</div>
                            <div className="text-slate-400">Active</div>
                          </div>
                          <div className="col-span-2">
                            <div className="text-blue-400 font-bold">
                              <span className="flex items-center gap-1">
                          <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                          {multiNetworkHexStakingService.formatHexAmount(stakerHistory.ethereum.totalStakedHearts)} HEX
                        </span>
                            </div>
                            <div className="text-slate-400">Total Staked</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* PulseChain Summary */}
                      <div className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-500/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                          <span className="font-semibold text-purple-400 flex items-center gap-1">
                    <img src="/LogoVector.svg" alt="PulseChain" className="w-4 h-4" />
                    PulseChain Network
                  </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <div className="text-white font-bold">{stakerHistory.pulsechain.totalStakes}</div>
                            <div className="text-slate-400">Total Stakes</div>
                          </div>
                          <div>
                            <div className="text-white font-bold">{stakerHistory.pulsechain.activeStakes}</div>
                            <div className="text-slate-400">Active</div>
                          </div>
                          <div className="col-span-2">
                            <div className="text-purple-400 font-bold">
                              <span className="flex items-center gap-1">
                          <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                          {multiNetworkHexStakingService.formatHexAmount(stakerHistory.pulsechain.totalStakedHearts)} HEX
                        </span>
                            </div>
                            <div className="text-slate-400">Total Staked</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Overview Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-5 h-5 text-blue-400" />
                        <span className="text-sm text-slate-400">Total Stakes</span>
                      </div>
                      <div className="text-2xl font-bold text-blue-400">
                        {stakerHistory.totalStakes.toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-green-400" />
                        <span className="text-sm text-slate-400">Active</span>
                      </div>
                      <div className="text-2xl font-bold text-green-400">
                        {stakerHistory.activeStakes.toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-purple-400" />
                        <span className="text-sm text-slate-400">Ended</span>
                      </div>
                      <div className="text-2xl font-bold text-purple-400">
                        {stakerHistory.endedStakes.toLocaleString()}
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
                                              <span className="flex items-center gap-1">
                          <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                          {multiNetworkHexStakingService.formatHexAmount(stakerHistory.totalStakedHearts)}
                        </span>
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
                                              <span className="flex items-center gap-1">
                          <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                          {multiNetworkHexStakingService.formatTShareAmount(stakerHistory.totalTShares)}
                        </span>
                    </div>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-500/10 to-blue-500/10 border border-indigo-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-5 h-5 text-indigo-400" />
                        <span className="text-sm text-slate-400 flex items-center gap-1">
                          <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                          Avg Length
                        </span>
                      </div>
                                          <div className="text-xl font-bold text-indigo-400">
                      {multiNetworkHexStakingService.formatStakeLength(Math.round(stakerHistory.averageStakeLength))}
                    </div>
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  {stakerHistory.endedStakes > 0 && (
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
                          <span className="flex items-center gap-1">
                            <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                            {Math.round(parseFloat(stakerHistory.totalPayouts) / Math.pow(10, 8)).toLocaleString()} HEX
                          </span>
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
                          <span className="flex items-center gap-1">
                            <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                            {Math.round(parseFloat(stakerHistory.totalPenalties) / Math.pow(10, 8)).toLocaleString()} HEX
                          </span>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-5 h-5 text-blue-400" />
                          <span className="text-sm text-slate-400">Avg APY</span>
                        </div>
                        <div className="text-xl font-bold text-blue-400">
                          {(() => {
                            const endedStakes = stakerHistory.stakes.filter(s => !s.isActive);
                            const apyValues = endedStakes.map(stake => {
                              const endData = getStakeEndData(stake.stakeId);
                              if (endData && parseFloat(endData.payout || '0') > 0) {
                                return hexStakingService.calculateStakeAPY(stake, endData);
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

                  {/* History Sub-Tabs */}
                  <div className="border-b border-white/10">
                    <nav className="-mb-px flex space-x-8">
                      {[
                        { key: 'overview', label: `All Stakes (${stakerHistory.totalStakes})`, icon: Activity },
                        { key: 'active', label: `Active (${stakerHistory.activeStakes})`, icon: TrendingUp },
                        { key: 'ended', label: `Ended (${stakerHistory.endedStakes})`, icon: CheckCircle }
                      ].map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          onClick={() => setHistorySubTab(key as any)}
                          className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                            historySubTab === key
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
                  
                  {/* Stakes Table - Complete display with all information */}
                  <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl overflow-hidden">
                    <div className="overflow-auto max-h-[40vh]">
                      <table className="min-w-full divide-y divide-white/10">
                        <thead className="bg-slate-900 text-white sticky top-0">
                          <tr>
                            <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                            <th 
                              className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                              onClick={() => handleSort('stakeId')}
                              title="Sort by Stake ID"
                              role="button"
                              tabIndex={0}
                            >
                              <div className="flex items-center gap-1">
                                Stake ID
                                {getSortIcon('stakeId')}
                              </div>
                            </th>
                            <th 
                              className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                              onClick={() => handleSort('stakedHearts')}
                              title="Sort by Amount (HEX)"
                              role="button"
                              tabIndex={0}
                            >
                              <div className="flex items-center gap-1">
                                Amount (HEX)
                                {getSortIcon('stakedHearts')}
                              </div>
                            </th>
                            <th 
                              className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                              onClick={() => handleSort('stakedDays')}
                              title="Sort by Length"
                              role="button"
                              tabIndex={0}
                            >
                              <div className="flex items-center gap-1">
                                Length
                                {getSortIcon('stakedDays')}
                              </div>
                            </th>
                            <th 
                              className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                              onClick={() => handleSort('daysServed')}
                              title="Sort by Days Served"
                              role="button"
                              tabIndex={0}
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
                          {sortedStakes.map((historyStake) => {
                            const endData = getStakeEndData(historyStake.stakeId);
                            const progress = historyStake.daysServed && historyStake.stakedDays 
                              ? (historyStake.daysServed / parseInt(historyStake.stakedDays)) * 100 
                              : 0;
                            const hasPenalty = endData && parseFloat(endData.penalty || '0') > 0;
                            
                            return (
                              <tr key={historyStake.id} className="hover:bg-white/5">
                                <td className="px-3 py-4 whitespace-nowrap text-sm">
                                  <div className={`flex items-center gap-2 ${getStakeStatusColor(historyStake)}`}>
                                    {getStakeStatusIcon(historyStake)}
                                    <span className="font-medium">
                                      {historyStake.isActive ? 'Active' : 'Ended'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-white">
                                  {historyStake.stakeId}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-green-400 font-semibold">
                                  <span className="flex items-center gap-1">
                          <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                          {multiNetworkHexStakingService.formatHexAmount(historyStake.stakedHearts)}
                        </span>
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-purple-400">
                                  <span className="flex items-center gap-1">
                          <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                          {multiNetworkHexStakingService.formatTShareAmount(historyStake.stakeTShares || historyStake.stakeShares)}
                        </span>
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-blue-400">
                                  {multiNetworkHexStakingService.formatStakeLengthInDays(parseInt(historyStake.stakedDays))}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-orange-400">
                                  <div className="space-y-1">
                                    <div>
                                      {historyStake.daysServed?.toLocaleString() || 'N/A'} days
                                    </div>
                                    {endData && !historyStake.isActive && (() => {
                                      const daysLate = multiNetworkHexStakingService.calculateLateEndingDays(historyStake, endData);
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
                                  {formatDate(historyStake.timestamp)}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-400">
                                  <div className="flex items-center gap-1">
                                    <span className={`text-xs px-2 py-1 rounded ${
                                      historyStake.network === 'ethereum' 
                                        ? 'bg-blue-500/20 text-blue-400' 
                                        : 'bg-purple-500/20 text-purple-400'
                                    }`}>
                                      {historyStake.network === 'ethereum' ? 'Ethereum' : 'PulseChain'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm">
                                  <div className="space-y-1">
                                    {/* Start Transaction */}
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-slate-500">Start:</span>
                                      <a
                                        href={multiNetworkHexStakingService.getTransactionUrl(historyStake.transactionHash, historyStake.network)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1 underline"
                                        title={`View start transaction: ${historyStake.transactionHash}`}
                                      >
                                        <span>{historyStake.transactionHash.slice(0, 8)}...</span>
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    </div>
                                    
                                    {/* End Transaction */}
                                    {endData && endData.transactionHash && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs text-slate-500">End:</span>
                                        <a
                                          href={multiNetworkHexStakingService.getTransactionUrl(endData.transactionHash, historyStake.network)}
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
                                    
                                    {historyStake.isActive && (
                                      <div className="text-xs text-slate-500">End: N/A</div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm">
                                  {endData ? (
                                    <div className="space-y-1">
                                      {parseFloat(endData.payout || '0') > 0 && (
                                        <div className="text-xs text-green-400">
                                          <span className="flex items-center gap-1">
                          <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                          +{Math.round(parseFloat(endData.payout) / Math.pow(10, 8)).toLocaleString()} HEX
                        </span>
                                        </div>
                                      )}
                                      {parseFloat(endData.penalty || '0') > 0 && (
                                        <div className="text-xs text-red-400">
                                          <span className="flex items-center gap-1">
                          <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
                          -{Math.round(parseFloat(endData.penalty) / Math.pow(10, 8)).toLocaleString()} HEX
                        </span>
                                        </div>
                                      )}
                                      {parseFloat(endData.payout || '0') > 0 && (
                                        <div className="text-xs text-blue-400">
                                          APY: {multiNetworkHexStakingService.calculateStakeAPY(historyStake, endData).toFixed(1)}%
                                        </div>
                                      )}
                                    </div>
                                  ) : historyStake.isActive ? (
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
          )}
        </div>
      </div>
    </div>
  );
};

export default StakeDetailModal;