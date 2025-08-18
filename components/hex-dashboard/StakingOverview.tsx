import React, { useState, useMemo } from 'react';
import { RefreshCw, Lock, Users, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { hexStakingService } from '@/services/hexStakingService';
import TopStakesVisual from './TopStakesVisual';
import StakerHistoryModal from './StakerHistoryModal';
import type { StakingOverviewProps } from './types';

const StakingOverview: React.FC<StakingOverviewProps> = ({
  stakingData,
  isLoadingStaking,
  stakingError,
  loadStakingData,
  stakingSubTab,
  setStakingSubTab,
  allStakeStarts,
  isLoadingAllStakes,
  loadAllStakeStarts,
  activeStakes,
  isLoadingActiveStakes,
  loadActiveStakes,
}) => {
  const [allStakesSortField, setAllStakesSortField] = useState<'stakeId' | 'stakedHearts' | 'stakedDays' | 'startDay'>('stakedHearts');
  const [allStakesSortDirection, setAllStakesSortDirection] = useState<'asc' | 'desc'>('desc');
  const [activeStakesSortField, setActiveStakesSortField] = useState<'stakeId' | 'stakedHearts' | 'stakedDays' | 'daysServed' | 'daysLeft'>('stakedHearts');
  const [activeStakesSortDirection, setActiveStakesSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedStakerAddress, setSelectedStakerAddress] = useState<string | null>(null);
  const [isStakerHistoryModalOpen, setIsStakerHistoryModalOpen] = useState<boolean>(false);

  const handleAllStakesSort = (field: 'stakeId' | 'stakedHearts' | 'stakedDays' | 'startDay') => {
    if (allStakesSortField === field) {
      setAllStakesSortDirection(allStakesSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setAllStakesSortField(field);
      setAllStakesSortDirection('desc');
    }
  };

  const handleActiveStakesSort = (field: 'stakeId' | 'stakedHearts' | 'stakedDays' | 'daysServed' | 'daysLeft') => {
    if (activeStakesSortField === field) {
      setActiveStakesSortDirection(activeStakesSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setActiveStakesSortField(field);
      setActiveStakesSortDirection('desc');
    }
  };

  const sortedAllStakes = useMemo(() => {
    return [...allStakeStarts].sort((a, b) => {
      let aValue: number | string, bValue: number | string;
      
      switch (allStakesSortField) {
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
        default:
          return 0;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return allStakesSortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      
      return allStakesSortDirection === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
    });
  }, [allStakeStarts, allStakesSortField, allStakesSortDirection]);

  const sortedActiveStakes = useMemo(() => {
    return [...activeStakes].sort((a, b) => {
      let aValue: number, bValue: number;
      
      switch (activeStakesSortField) {
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
        case 'daysServed':
          aValue = a.daysServed || 0;
          bValue = b.daysServed || 0;
          break;
        case 'daysLeft':
          aValue = a.daysLeft || 0;
          bValue = b.daysLeft || 0;
          break;
        default:
          return 0;
      }
      
      return activeStakesSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [activeStakes, activeStakesSortField, activeStakesSortDirection]);

  const getSortIcon = (field: string, currentField: string, direction: 'asc' | 'desc') => {
    if (currentField !== field) return <ArrowUpDown className="w-3 h-3" />;
    return direction === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />;
  };

  // Handle staker row click
  const handleStakerClick = (stakerAddress: string) => {
    setSelectedStakerAddress(stakerAddress);
    setIsStakerHistoryModalOpen(true);
  };

  // Handle modal close
  const handleStakerHistoryModalClose = () => {
    setIsStakerHistoryModalOpen(false);
    setSelectedStakerAddress(null);
  };
  if (isLoadingStaking) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Loading HEX Staking Data...</h2>
        <p className="text-slate-400">Fetching data from The Graph API</p>
      </div>
    );
  }

  if (stakingError) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-900/20 border border-red-500/50 text-red-300 px-4 py-3 rounded mb-4">
          <h2 className="font-bold text-lg mb-2">Error Loading Staking Data</h2>
          <p className="mb-4">{stakingError}</p>
          <button
            onClick={loadStakingData}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!stakingData) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Staking Sub-Tabs */}
      <div className="border-b border-white/10 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setStakingSubTab('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              stakingSubTab === 'overview'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Overview & Top Stakes
          </button>
          <button
            onClick={() => {
              setStakingSubTab('all-stakes');
              if (allStakeStarts.length === 0) {
                loadAllStakeStarts();
              }
            }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              stakingSubTab === 'all-stakes'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            All Stake Starts ({allStakeStarts.length || '...'})
          </button>
          <button
            onClick={() => {
              setStakingSubTab('active-stakes');
              if (activeStakes.length === 0) {
                loadActiveStakes();
              }
            }}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              stakingSubTab === 'active-stakes'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            Active Stakes ({activeStakes.length || '...'})
          </button>
        </nav>
      </div>

      {stakingSubTab === 'overview' && (
        <>
          {/* Staking Overview Metrics */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5" />
                HEX Staking Overview
              </h3>
              <button
                onClick={loadStakingData}
                disabled={isLoadingStaking}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingStaking ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center bg-white/5 backdrop-blur rounded-lg p-4 border border-white/10">
                <div className="text-2xl font-bold text-blue-400">
                  {stakingData.globalInfo?.latestStakeId || 'N/A'}
                </div>
                <div className="text-sm text-slate-400">Latest Stake ID</div>
              </div>
              <div className="text-center bg-white/5 backdrop-blur rounded-lg p-4 border border-white/10">
                <div className="text-2xl font-bold text-purple-400">
                  {stakingData.totalActiveStakes.toLocaleString()}
                </div>
                <div className="text-sm text-slate-400">Active Stakes</div>
              </div>
              <div className="text-center bg-white/5 backdrop-blur rounded-lg p-4 border border-white/10">
                <div className="text-2xl font-bold text-green-400">
                  {hexStakingService.formatHexAmount(stakingData.totalStakedHearts)} HEX
                </div>
                <div className="text-sm text-slate-400">Total Staked</div>
              </div>
              <div className="text-center bg-white/5 backdrop-blur rounded-lg p-4 border border-white/10">
                <div className="text-2xl font-bold text-orange-400">
                  {hexStakingService.formatStakeLength(Math.round(stakingData.averageStakeLength))}
                </div>
                <div className="text-sm text-slate-400">Avg Stake Length</div>
              </div>
            </div>

            <div className="mt-6 border-t border-white/10 pt-4">
              <h4 className="text-md font-semibold text-white mb-3">Protocol Global Metrics</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center bg-white/5 backdrop-blur rounded-lg p-3 border border-white/10">
                  <div className="text-lg font-bold text-cyan-400">
                    {stakingData.globalInfo ? hexStakingService.formatTShareAmount(stakingData.globalInfo.stakeSharesTotal) : 'N/A'}
                  </div>
                  <div className="text-xs text-slate-400">Stake Shares Total</div>
                </div>
                <div className="text-center bg-white/5 backdrop-blur rounded-lg p-3 border border-white/10">
                  <div className="text-lg font-bold text-yellow-400">
                    {stakingData.globalInfo?.hexDay || 'N/A'}
                  </div>
                  <div className="text-xs text-slate-400">Current HEX Day</div>
                </div>
                <div className="text-center bg-white/5 backdrop-blur rounded-lg p-3 border border-white/10">
                  <div className="text-lg font-bold text-emerald-400">
                    {stakingData.globalInfo ? hexStakingService.formatHexAmount(stakingData.globalInfo.lockedHeartsTotal) : 'N/A'} HEX
                  </div>
                  <div className="text-xs text-slate-400">Locked Hearts Total</div>
                </div>
                <div className="text-center bg-white/5 backdrop-blur rounded-lg p-3 border border-white/10">
                  <div className="text-lg font-bold text-red-400">
                    {stakingData.globalInfo ? hexStakingService.formatHexAmount(stakingData.globalInfo.stakePenaltyTotal) : 'N/A'} HEX
                  </div>
                  <div className="text-xs text-slate-400">Penalties Total</div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Stakes Visual Display */}
          <TopStakesVisual stakes={stakingData.topStakes} />
        </>
      )}

      {stakingSubTab === 'all-stakes' && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h4 className="text-lg font-semibold text-white">All HEX Stake Start Events</h4>
            {isLoadingAllStakes && (
              <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
            )}
          </div>
          
          {isLoadingAllStakes ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-4" />
              <p className="text-white">Loading all stake start events...</p>
              <p className="text-sm text-slate-400">This may take a moment...</p>
            </div>
          ) : allStakeStarts.length > 0 ? (
            <div className="overflow-auto max-h-[70vh]">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-slate-900 text-white sticky top-0">
                  <tr>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                      onClick={() => handleAllStakesSort('stakeId')}
                    >
                      <div className="flex items-center gap-1">
                        Stake ID
                        {getSortIcon('stakeId', allStakesSortField, allStakesSortDirection)}
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Staker Address</th>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                      onClick={() => handleAllStakesSort('stakedHearts')}
                    >
                      <div className="flex items-center gap-1">
                        Amount (HEX)
                        {getSortIcon('stakedHearts', allStakesSortField, allStakesSortDirection)}
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">T-Shares</th>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                      onClick={() => handleAllStakesSort('stakedDays')}
                    >
                      <div className="flex items-center gap-1">
                        Stake Days
                        {getSortIcon('stakedDays', allStakesSortField, allStakesSortDirection)}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                      onClick={() => handleAllStakesSort('startDay')}
                    >
                      <div className="flex items-center gap-1">
                        Start Day
                        {getSortIcon('startDay', allStakesSortField, allStakesSortDirection)}
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">End Day</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-transparent divide-y divide-white/10">
                  {sortedAllStakes.map((stake) => (
                    <tr key={stake.id} className="hover:bg-white/5">
                      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {stake.stakeId}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-300 font-mono">
                        <button
                          onClick={() => handleStakerClick(stake.stakerAddr)}
                          className="hover:text-green-400 transition-colors cursor-pointer underline decoration-green-400/60 decoration-2 underline-offset-2"
                          title={`${stake.stakerAddr} - Click to view staking history`}
                        >
                          {stake.stakerAddr.slice(0, 10)}...{stake.stakerAddr.slice(-8)}
                        </button>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-green-400 font-semibold">
                        {hexStakingService.formatHexAmount(stake.stakedHearts)}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-purple-400">
                        {hexStakingService.formatTShareAmount(stake.stakeTShares || stake.stakeShares)}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-blue-400">
                        {hexStakingService.formatStakeLength(parseInt(stake.stakedDays))}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-orange-400">
                        {stake.startDay}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-yellow-400">
                        {stake.endDay}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-cyan-400">
                        {new Date(parseInt(stake.timestamp) * 1000).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-white mb-2">No stake start events loaded</p>
              <button
                onClick={loadAllStakeStarts}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
              >
                Load All Stakes
              </button>
            </div>
          )}
        </div>
      )}

      {stakingSubTab === 'active-stakes' && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div>
              <h4 className="text-lg font-semibold text-white">All Active HEX Stakes</h4>
              <p className="text-sm text-slate-400">Stakes that have not yet ended</p>
            </div>
            {isLoadingActiveStakes && (
              <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
            )}
          </div>
          
          {isLoadingActiveStakes ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-4" />
              <p className="text-white">Loading all active stakes...</p>
              <p className="text-sm text-slate-400">Fetching and cross-referencing stake data...</p>
            </div>
          ) : activeStakes.length > 0 ? (
            <div className="overflow-auto max-h-[70vh]">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-slate-900 text-white sticky top-0">
                  <tr>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                      onClick={() => handleActiveStakesSort('stakeId')}
                    >
                      <div className="flex items-center gap-1">
                        Stake ID
                        {getSortIcon('stakeId', activeStakesSortField, activeStakesSortDirection)}
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Staker</th>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                      onClick={() => handleActiveStakesSort('stakedHearts')}
                    >
                      <div className="flex items-center gap-1">
                        Amount (HEX)
                        {getSortIcon('stakedHearts', activeStakesSortField, activeStakesSortDirection)}
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">T-Shares</th>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                      onClick={() => handleActiveStakesSort('stakedDays')}
                    >
                      <div className="flex items-center gap-1">
                        Total Days
                        {getSortIcon('stakedDays', activeStakesSortField, activeStakesSortDirection)}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                      onClick={() => handleActiveStakesSort('daysServed')}
                    >
                      <div className="flex items-center gap-1">
                        Days Served
                        {getSortIcon('daysServed', activeStakesSortField, activeStakesSortDirection)}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-slate-800 transition-colors"
                      onClick={() => handleActiveStakesSort('daysLeft')}
                    >
                      <div className="flex items-center gap-1">
                        Days Left
                        {getSortIcon('daysLeft', activeStakesSortField, activeStakesSortDirection)}
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Progress</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">End Day</th>
                  </tr>
                </thead>
                <tbody className="bg-transparent divide-y divide-white/10">
                  {sortedActiveStakes.map((stake) => {
                    const progress = stake.daysServed && stake.stakedDays 
                      ? (stake.daysServed / parseInt(stake.stakedDays)) * 100 
                      : 0;
                    
                    return (
                      <tr key={stake.id} className="hover:bg-white/5">
                        <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-white">
                          {stake.stakeId}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-300">
                          <button
                            onClick={() => handleStakerClick(stake.stakerAddr)}
                            className="hover:text-green-400 transition-colors cursor-pointer underline decoration-green-400/60 decoration-2 underline-offset-2"
                            title={`${stake.stakerAddr} - Click to view staking history`}
                          >
                            {stake.stakerAddr.slice(0, 8)}...
                          </button>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-green-400 font-semibold">
                          {hexStakingService.formatHexAmount(stake.stakedHearts)}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-purple-400">
                          {hexStakingService.formatTShareAmount(stake.stakeTShares || stake.stakeShares)}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-blue-400">
                          {hexStakingService.formatStakeLength(parseInt(stake.stakedDays))}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-orange-400">
                          {stake.daysServed?.toLocaleString() || 'N/A'}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-yellow-400">
                          {stake.daysLeft?.toLocaleString() || 'N/A'}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-700 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-slate-400">{progress.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-cyan-400">
                          {stake.endDay}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-white mb-2">No active stakes loaded</p>
              <button
                onClick={loadActiveStakes}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
              >
                Load Active Stakes
              </button>
            </div>
          )}
        </div>
      )}

      {/* Staker History Modal */}
      <StakerHistoryModal
        stakerAddress={selectedStakerAddress}
        isOpen={isStakerHistoryModalOpen}
        onClose={handleStakerHistoryModalClose}
      />
    </div>
  );
};

export default StakingOverview;