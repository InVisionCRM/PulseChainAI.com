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
  pulsechainStakeStarts,
  pulsechainActiveStakes,
  isLoadingPulsechainStakes,
  loadPulsechainStakeStarts,
  loadPulsechainActiveStakes,
  getSortedPulsechainData,
  getPulsechainCacheStatus,
  getCurrentHexPrice,
}) => {
  const [allStakesSortField, setAllStakesSortField] = useState<'stakeId' | 'stakedHearts' | 'stakedDays' | 'startDay'>('stakedHearts');
  const [allStakesSortDirection, setAllStakesSortDirection] = useState<'asc' | 'desc'>('desc');
  const [activeStakesSortField, setActiveStakesSortField] = useState<'stakeId' | 'stakedHearts' | 'stakedDays' | 'daysServed' | 'daysLeft'>('stakedHearts');
  const [activeStakesSortDirection, setActiveStakesSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedStakerAddress, setSelectedStakerAddress] = useState<string | null>(null);
  const [isStakerHistoryModalOpen, setIsStakerHistoryModalOpen] = useState<boolean>(false);
  
  // Helper functions for calculations
  const calculateStakeUSD = (stakedHearts: string): number => {
    const hearts = parseFloat(stakedHearts);
    return (hearts / 100000000) * getCurrentHexPrice(); // Convert hearts to HEX, then to USD
  };

  const calculateEstimatedYield = (stakedHearts: string, stakedDays: string): number => {
    const hearts = parseFloat(stakedHearts);
    const days = parseInt(stakedDays);
    const hexAmount = hearts / 100000000;
    
    // Basic yield calculation: longer stakes generally have higher yields
    // This is a simplified calculation - actual HEX yields are more complex
    const baseYield = 0.05; // 5% base yield
    const dayMultiplier = Math.min(days / 365, 2); // Cap at 2x for very long stakes
    return hexAmount * baseYield * dayMultiplier;
  };

  const calculateYieldEarned = (stakedHearts: string, daysServed: number, stakedDays: string): number => {
    const hearts = parseFloat(stakedHearts);
    const days = parseInt(stakedDays);
    const hexAmount = hearts / 100000000;
    
    if (!daysServed || daysServed <= 0) return 0;
    
    // Calculate yield based on days served vs total days
    const progressRatio = daysServed / days;
    const estimatedYield = calculateEstimatedYield(stakedHearts, stakedDays);
    
    return estimatedYield * progressRatio;
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
  
  // Pagination state for active stakes
  const [activeStakesCurrentPage, setActiveStakesCurrentPage] = useState<number>(1);
  const [pulsechainActiveStakesCurrentPage, setPulsechainActiveStakesCurrentPage] = useState<number>(1);
  const [activeStakesPerPage] = useState<number>(50);
  
  // Ensure pagination state is valid
  const validPulsechainActiveStakesCurrentPage = Math.max(1, Math.min(pulsechainActiveStakesCurrentPage, totalPulsechainActiveStakesPages || 1));
  
  // Pagination state for all stake starts
  const [allStakesCurrentPage, setAllStakesCurrentPage] = useState<number>(1);
  const [pulsechainStakeStartsCurrentPage, setPulsechainStakeStartsCurrentPage] = useState<number>(1);
  const [allStakesPerPage] = useState<number>(50);

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

  // Paginated active stakes for Ethereum
  const paginatedActiveStakes = useMemo(() => {
    const startIndex = (activeStakesCurrentPage - 1) * activeStakesPerPage;
    const endIndex = startIndex + activeStakesPerPage;
    return sortedActiveStakes.slice(startIndex, endIndex);
  }, [sortedActiveStakes, activeStakesCurrentPage, activeStakesPerPage]);

  // Paginated active stakes for PulseChain
  const paginatedPulsechainActiveStakes = useMemo(() => {
    const startIndex = (pulsechainActiveStakesCurrentPage - 1) * activeStakesPerPage;
    const endIndex = startIndex + activeStakesPerPage;
    const sliced = pulsechainActiveStakes.slice(startIndex, endIndex);
    console.log(`🔍 Pagination: Page ${pulsechainActiveStakesCurrentPage}, showing ${sliced.length} of ${pulsechainActiveStakes.length} stakes`);
    return sliced;
  }, [pulsechainActiveStakes, pulsechainActiveStakesCurrentPage, activeStakesPerPage]);

  // Calculate total pages for pagination
  const totalActiveStakesPages = Math.ceil(sortedActiveStakes.length / activeStakesPerPage);
  const totalPulsechainActiveStakesPages = Math.ceil(pulsechainActiveStakes.length / activeStakesPerPage);
  
  // Paginated all stake starts for Ethereum
  const paginatedAllStakes = useMemo(() => {
    const startIndex = (allStakesCurrentPage - 1) * allStakesPerPage;
    const endIndex = startIndex + allStakesPerPage;
    return sortedAllStakes.slice(startIndex, endIndex);
  }, [sortedAllStakes, allStakesCurrentPage, allStakesPerPage]);

  // Paginated stake starts for PulseChain
  const paginatedPulsechainStakeStarts = useMemo(() => {
    const startIndex = (pulsechainStakeStartsCurrentPage - 1) * allStakesPerPage;
    const endIndex = startIndex + allStakesPerPage;
    return pulsechainStakeStarts.slice(startIndex, endIndex);
  }, [pulsechainStakeStarts, pulsechainStakeStartsCurrentPage, allStakesPerPage]);

  // Calculate total pages for all stake starts pagination
  const totalAllStakesPages = Math.ceil(sortedAllStakes.length / allStakesPerPage);
  const totalPulsechainStakeStartsPages = Math.ceil(pulsechainStakeStarts.length / allStakesPerPage);

  const getSortIcon = (field: string, currentField: string, direction: 'asc' | 'desc') => {
    if (currentField !== field) return <ArrowUpDown className="w-3 h-3" />;
    return direction === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />;
  };

  // Mobile-optimized pagination controls component
  const PaginationControls = ({ 
    currentPage, 
    totalPages, 
    onPageChange, 
    totalItems, 
    itemsPerPage 
  }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    itemsPerPage: number;
  }) => {
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-t border-white/10 gap-2 sm:gap-0">
        <div className="text-xs sm:text-sm text-slate-400 order-2 sm:order-1">
          <span className="hidden sm:inline">Showing {startItem} to {endItem} of {totalItems} stakes</span>
          <span className="sm:hidden">{startItem}-{endItem} of {totalItems}</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-2 sm:px-3 py-1 text-xs sm:text-sm rounded bg-white/5 border border-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10"
          >
            <span className="hidden sm:inline">Previous</span>
            <span className="sm:hidden">Prev</span>
          </button>
          <span className="text-xs sm:text-sm text-slate-400 px-1 sm:px-2">
            {currentPage}/{totalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-2 sm:px-3 py-1 text-xs sm:text-sm rounded bg-white/5 border border-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10"
          >
            Next
          </button>
        </div>
      </div>
    );
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

  // Handle tab change and reset pagination
  const handleTabChange = (tab: StakingSubTab) => {
    setStakingSubTab(tab);
    
    // Reset pagination when switching tabs
    setAllStakesCurrentPage(1);
    setPulsechainStakeStartsCurrentPage(1);
    setActiveStakesCurrentPage(1);
    setPulsechainActiveStakesCurrentPage(1);
  };

  if (isLoadingStaking) {
    return (
      <div className="text-center py-8 sm:py-12 px-4">
        <RefreshCw className="w-8 h-8 sm:w-12 sm:h-12 animate-spin text-purple-500 mx-auto mb-3 sm:mb-4" />
        <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">
          <span className="hidden sm:inline">Loading Multi-Network HEX Staking Data...</span>
          <span className="sm:hidden">Loading Staking Data...</span>
        </h2>
        <p className="text-sm sm:text-base text-slate-400">
          <span className="hidden sm:inline">Fetching data from Ethereum & PulseChain Graph APIs</span>
          <span className="sm:hidden">Fetching API data...</span>
        </p>
      </div>
    );
  }

  // Get cache status for debugging
  const [cacheStatus, setCacheStatus] = useState<{
    hasStakeStarts: boolean;
    hasStakeEnds: boolean;
    hasActiveStakes: boolean;
    hasGlobalInfo: boolean;
    isExpired: boolean;
    lastFetchTime: string | null;
    cacheAge: number | null;
    totalStakeStarts: number;
    totalActiveStakes: number;
    databaseAvailable: boolean;
    databaseCounts?: {
      stakeStarts: number;
      stakeEnds: number;
      globalInfo: number;
      stakerMetrics: number;
    };
  }>({
    hasStakeStarts: false,
    hasStakeEnds: false,
    hasActiveStakes: false,
    hasGlobalInfo: false,
    isExpired: true,
    lastFetchTime: null,
    cacheAge: null,
    totalStakeStarts: 0,
    totalActiveStakes: 0,
    databaseAvailable: false
  });

  // Load cache status
  useEffect(() => {
    const loadCacheStatus = async () => {
      try {
        const status = await getPulsechainCacheStatus();
        setCacheStatus(status);
      } catch (error) {
        console.error('Error loading cache status:', error);
      }
    };
    loadCacheStatus();
  }, [getPulsechainCacheStatus, stakingData]);

  if (stakingError) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-900/20 border border-red-500/50 text-red-300 px-4 py-3 rounded mb-4">
          <h2 className="font-bold text-lg mb-2">Error Loading Multi-Network Staking Data</h2>
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

  // Get combined totals from both networks
  const combinedData = stakingData.combined;
  const ethereumData = stakingData.ethereum;
  const pulsechainData = stakingData.pulsechain;

  return (
    <div className="space-y-6">
      {/* Mobile-optimized Cache & Database Status Display */}
      <div className="bg-white/5 backdrop-blur border border-white/10 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
        <h4 className="text-xs sm:text-sm font-semibold text-purple-400 mb-2 sm:mb-3">
          <span className="hidden sm:inline">🔧 PulseChain Data Status</span>
          <span className="sm:hidden">🔧 Data Status</span>
        </h4>
        
        {/* Database Status - Mobile Compact */}
        <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <span className="text-xs sm:text-sm font-semibold text-blue-400">
              <span className="hidden sm:inline">📊 Database Integration</span>
              <span className="sm:hidden">📊 DB</span>
            </span>
            <span className={`text-xs px-2 py-1 rounded ${cacheStatus.databaseAvailable ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {cacheStatus.databaseAvailable ? '🟢' : '🔴'}
              <span className="hidden sm:inline ml-1">{cacheStatus.databaseAvailable ? 'Connected' : 'Offline'}</span>
            </span>
          </div>
          {cacheStatus.databaseAvailable && cacheStatus.databaseCounts && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2 text-xs">
              <div className="truncate">
                <span className="text-slate-400 hidden sm:inline">DB Stakes:</span>
                <span className="text-slate-400 sm:hidden">Stakes:</span>
                <span className="ml-1 sm:ml-2 text-blue-300 font-semibold">{cacheStatus.databaseCounts.stakeStarts.toLocaleString()}</span>
              </div>
              <div className="truncate">
                <span className="text-slate-400 hidden sm:inline">DB Ends:</span>
                <span className="text-slate-400 sm:hidden">Ends:</span>
                <span className="ml-1 sm:ml-2 text-blue-300 font-semibold">{cacheStatus.databaseCounts.stakeEnds.toLocaleString()}</span>
              </div>
              <div className="truncate">
                <span className="text-slate-400 hidden sm:inline">DB Global:</span>
                <span className="text-slate-400 sm:hidden">Global:</span>
                <span className="ml-1 sm:ml-2 text-blue-300 font-semibold">{cacheStatus.databaseCounts.globalInfo.toLocaleString()}</span>
              </div>
              <div className="truncate">
                <span className="text-slate-400 hidden sm:inline">DB Metrics:</span>
                <span className="text-slate-400 sm:hidden">Metrics:</span>
                <span className="ml-1 sm:ml-2 text-blue-300 font-semibold">{cacheStatus.databaseCounts.stakerMetrics.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Memory Cache Status - Mobile Compact */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-xs">
          <div className="truncate">
            <span className="text-slate-400 hidden sm:inline">Memory Cache:</span>
            <span className="text-slate-400 sm:hidden">Cache:</span>
            <span className={`ml-1 sm:ml-2 ${cacheStatus.hasStakeStarts ? 'text-green-400' : 'text-red-400'}`}>
              {cacheStatus.hasStakeStarts ? '✅' : '❌'}
              <span className="hidden sm:inline ml-1">{cacheStatus.hasStakeStarts ? 'Active' : 'Empty'}</span>
            </span>
          </div>
          <div className="truncate">
            <span className="text-slate-400 hidden sm:inline">Stake Ends:</span>
            <span className="text-slate-400 sm:hidden">Ends:</span>
            <span className={`ml-1 sm:ml-2 ${cacheStatus.hasStakeEnds ? 'text-green-400' : 'text-red-400'}`}>
              {cacheStatus.hasStakeEnds ? '✅' : '❌'}
              <span className="hidden sm:inline ml-1">{cacheStatus.hasStakeEnds ? 'Cached' : 'Not Cached'}</span>
            </span>
          </div>
          <div className="truncate">
            <span className="text-slate-400 hidden sm:inline">Active Stakes:</span>
            <span className="text-slate-400 sm:hidden">Active:</span>
            <span className={`ml-1 sm:ml-2 ${cacheStatus.hasActiveStakes ? 'text-green-400' : 'text-red-400'}`}>
              {cacheStatus.hasActiveStakes ? '✅' : '❌'}
              <span className="hidden sm:inline ml-1">{cacheStatus.hasActiveStakes ? 'Cached' : 'Not Cached'}</span>
            </span>
          </div>
          <div className="truncate">
            <span className="text-slate-400 hidden sm:inline">Cache Age:</span>
            <span className="text-slate-400 sm:hidden">Age:</span>
            <span className={`ml-1 sm:ml-2 ${cacheStatus.isExpired ? 'text-yellow-400' : 'text-green-400'}`}>
              {cacheStatus.cacheAge ? `${cacheStatus.cacheAge}s` : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Pagination Info */}
      <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
        <h4 className="text-sm font-semibold text-blue-400 mb-2">📄 Pagination Features</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-slate-300">📊 All Stake Starts:</span>
            <span className="ml-2 text-blue-300">
              {allStakeStarts.length > 0 ? `${allStakeStarts.length} stakes (${allStakesPerPage} per page)` : 'Not loaded'}
            </span>
          </div>
          <div>
            <span className="text-slate-300">📊 Active Stakes:</span>
            <span className="ml-2 text-blue-300">
              {activeStakes.length > 0 ? `${activeStakes.length} stakes (${activeStakesPerPage} per page)` : 'Not loaded'}
            </span>
          </div>
          <div>
            <span className="text-slate-300">📊 PulseChain Data:</span>
            <span className="ml-2 text-blue-300">
              {pulsechainStakeStarts.length > 0 ? `${pulsechainStakeStarts.length} stakes` : 'Not loaded'} | 
              {pulsechainActiveStakes.length > 0 ? ` ${pulsechainActiveStakes.length} active` : ' Not loaded'}
            </span>
          </div>
        </div>
        
        {/* Full Dataset Status */}
        <div className="mt-3 pt-3 border-t border-blue-500/30">
          <div className="text-xs text-blue-300">
            <span className="font-semibold">💾 Full Dataset Status:</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-300">Ethereum:</span>
                <span className="ml-2 text-green-400">
                  {allStakeStarts.length > 0 ? `${allStakeStarts.length} total stakes` : 'Not loaded'}
                </span>
              </div>
              <div>
                <span className="text-slate-300">PulseChain:</span>
                <span className="ml-2 text-purple-400">
                  {cacheStatus.totalStakeStarts > 0 ? `${cacheStatus.totalStakeStarts} total stakes` : 'Not loaded'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-optimized Staking Sub-Tabs */}
      <div className="border-b border-white/10 mb-4 sm:mb-6">
        <nav className="-mb-px flex flex-wrap gap-1 sm:gap-4 lg:gap-8">
          <button
            onClick={() => handleTabChange('overview')}
            className={`py-1.5 sm:py-2 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
              stakingSubTab === 'overview'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <span className="hidden sm:inline">Overview & Top Stakes</span>
            <span className="sm:hidden">Overview</span>
          </button>
          <button
            onClick={() => {
              handleTabChange('all-stakes');
              if (allStakeStarts.length === 0) {
                loadAllStakeStarts();
              }
            }}
            className={`py-1.5 sm:py-2 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
              stakingSubTab === 'all-stakes'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <span className="hidden sm:inline">All Stake Starts</span>
            <span className="sm:hidden">All Stakes</span> ({allStakeStarts.length || '...'})
          </button>
          <button
            onClick={() => {
              handleTabChange('active-stakes');
              if (activeStakes.length === 0) {
                loadActiveStakes();
              }
            }}
            className={`py-1.5 sm:py-2 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 whitespace-nowrap ${
              stakingSubTab === 'active-stakes'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Users className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Active Stakes</span>
            <span className="sm:hidden">Active</span> ({activeStakes.length || '...'})
          </button>
        </nav>
      </div>

      {stakingSubTab === 'overview' && (
        <>
          {/* Mobile-optimized Staking Overview Metrics */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
              <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Multi-Network HEX Staking Overview</span>
                <span className="sm:hidden">Staking Overview</span>
              </h3>
              <button
                onClick={loadStakingData}
                disabled={isLoadingStaking}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-bold py-2 px-3 sm:px-4 rounded-lg flex items-center gap-2 text-sm sm:text-base"
              >
                <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${isLoadingStaking ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
                <span className="sm:hidden">↻</span>
              </button>
            </div>

            {/* Mobile-optimized Combined Network Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
              <div className="text-center bg-white/5 backdrop-blur rounded-lg p-3 sm:p-4 border border-white/10">
                <div className="text-lg sm:text-2xl font-bold text-blue-400">
                  {combinedData.latestStakeId || 'N/A'}
                </div>
                <div className="text-xs sm:text-sm text-slate-400">
                  <span className="hidden sm:inline">Latest Stake ID</span>
                  <span className="sm:hidden">Latest ID</span>
              </div>
                </div>
              <div className="text-center bg-white/5 backdrop-blur rounded-lg p-3 sm:p-4 border border-white/10">
                <div className="text-lg sm:text-2xl font-bold text-purple-400">
                  {combinedData.totalActiveStakes.toLocaleString()}
              </div>
                <div className="text-xs sm:text-sm text-slate-400">
                  <span className="hidden sm:inline">Total Active Stakes</span>
                  <span className="sm:hidden">Active Stakes</span>
                </div>
              </div>
              <div className="text-center bg-white/5 backdrop-blur rounded-lg p-3 sm:p-4 border border-white/10">
                <div className="text-lg sm:text-2xl font-bold text-green-400">
                  <span className="hidden sm:inline">{hexStakingService.formatHexAmount(combinedData.totalStakedHearts)} HEX</span>
                  <span className="sm:hidden">{hexStakingService.formatHexAmount(combinedData.totalStakedHearts, true)}</span>
                </div>
                <div className="text-xs sm:text-sm text-slate-400">
                  <span className="hidden sm:inline">Total Staked</span>
                  <span className="sm:hidden">Total HEX</span>
                </div>
              </div>
              <div className="text-center bg-white/5 backdrop-blur rounded-lg p-3 sm:p-4 border border-white/10">
                <div className="text-lg sm:text-2xl font-bold text-orange-400">
                  {hexStakingService.formatStakeLength(combinedData.averageStakeLength)}
                </div>
                <div className="text-xs sm:text-sm text-slate-400">
                  <span className="hidden sm:inline">Avg Stake Length</span>
                  <span className="sm:hidden">Avg Length</span>
                </div>
              </div>
            </div>

            {/* Network Breakdown */}
            <div className="border-t border-white/10 pt-4">
              <h4 className="text-md font-semibold text-white mb-3">Network Breakdown</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Ethereum Network */}
                <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                    <span className="font-semibold text-blue-400">Ethereum Network</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-white font-bold">{ethereumData?.totalActiveStakes?.toLocaleString() || '0'}</div>
                      <div className="text-slate-400">Active Stakes</div>
                    </div>
                    <div>
                      <div className="text-blue-400 font-bold">
                        {ethereumData ? hexStakingService.formatHexAmount(ethereumData.totalStakedHearts) : '0 HEX'}
                      </div>
                      <div className="text-slate-400">Total Staked</div>
                    </div>
                  </div>
                </div>
                
                {/* PulseChain Network */}
                <div className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                    <span className="font-semibold text-purple-400">PulseChain Network</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-white font-bold">{pulsechainData?.totalActiveStakes?.toLocaleString() || '0'}</div>
                      <div className="text-slate-400">Active Stakes</div>
                    </div>
                    <div>
                      <div className="text-purple-400 font-bold">
                        {pulsechainData ? hexStakingService.formatHexAmount(pulsechainData.totalStakedHearts) : '0 HEX'}
                      </div>
                      <div className="text-slate-400">Total Staked</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-white/10 pt-4">
              <h4 className="text-md font-semibold text-white mb-3">Protocol Global Metrics</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center bg-white/5 backdrop-blur rounded-lg p-3 border border-white/10">
                  <div className="text-lg font-bold text-cyan-400">
                    {combinedData.totalStakeShares ? hexStakingService.formatTShareAmount(combinedData.totalStakeShares) : 'N/A'}
                  </div>
                  <div className="text-xs text-slate-400">Stake Shares Total</div>
                </div>
                <div className="text-center bg-white/5 backdrop-blur rounded-lg p-3 border border-white/10">
                  <div className="text-lg font-bold text-yellow-400">
                    {combinedData.hexDay || 'N/A'}
                  </div>
                  <div className="text-xs text-slate-400">Current HEX Day</div>
                </div>
                <div className="text-center bg-white/5 backdrop-blur rounded-lg p-3 border border-white/10">
                  <div className="text-lg font-bold text-emerald-400">
                    {ethereumData?.globalInfo ? hexStakingService.formatHexAmount(ethereumData.globalInfo.lockedHeartsTotal) : 'N/A'} HEX
                  </div>
                  <div className="text-xs text-slate-400">Locked Hearts Total</div>
                </div>
                <div className="text-center bg-white/5 backdrop-blur rounded-lg p-3 border border-white/10">
                  <div className="text-lg font-bold text-red-400">
                    {ethereumData?.globalInfo ? hexStakingService.formatHexAmount(ethereumData.globalInfo.stakePenaltyTotal) : 'N/A'} HEX
                  </div>
                  <div className="text-xs text-slate-400">Penalties Total</div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Stakes Visual Display */}
          <TopStakesVisual stakes={ethereumData?.topStakes || []} />
        </>
      )}

      {stakingSubTab === 'all-stakes' && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h4 className="text-lg font-semibold text-white">All HEX Stake Start Events (Ethereum)</h4>
            {isLoadingAllStakes && (
              <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
            )}
          </div>
          
          {isLoadingAllStakes ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-4" />
              <p className="text-white">Loading all Ethereum stake start events...</p>
              <p className="text-sm text-slate-400">This may take a moment...</p>
            </div>
          ) : allStakeStarts.length > 0 ? (
            <div className="overflow-auto max-h-[70vh]">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-slate-900 text-white sticky top-0">
                  <tr>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider"
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
                  {paginatedAllStakes.map((stake) => (
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
              
              {/* Pagination Controls for Ethereum All Stake Starts */}
              {allStakeStarts.length > allStakesPerPage && (
                <PaginationControls
                  currentPage={allStakesCurrentPage}
                  totalPages={totalAllStakesPages}
                  onPageChange={setAllStakesCurrentPage}
                  totalItems={allStakeStarts.length}
                  itemsPerPage={allStakesPerPage}
                />
              )}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-white mb-2">No Ethereum stake start events loaded</p>
              <button
                onClick={loadAllStakeStarts}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
              >
                Load Ethereum Stakes
              </button>
            </div>
          )}
        </div>
      )}

      {/* PulseChain All Stake Starts Section */}
      {stakingSubTab === 'all-stakes' && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h4 className="text-lg font-semibold text-white">All HEX Stake Start Events (PulseChain)</h4>
            {isLoadingPulsechainStakes && (
              <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
            )}
          </div>
          
          {isLoadingPulsechainStakes ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-4" />
              <p className="text-white">Loading all PulseChain stake start events...</p>
              <p className="text-sm text-slate-400">This may take a moment...</p>
            </div>
          ) : pulsechainStakeStarts.length > 0 ? (
            <div className="overflow-auto max-h-[70vh]">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-slate-900 text-white sticky top-0">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Stake ID</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Staker Address</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Amount (HEX)</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">USD Value</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">T-Shares</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Stake Days</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Est. Yield</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Start Day</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">End Day</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-transparent divide-y divide-white/10">
                  {paginatedPulsechainStakeStarts.map((stake) => (
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
                        {formatUSD(calculateStakeUSD(stake.stakedHearts))}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-purple-400">
                        {hexStakingService.formatTShareAmount(stake.stakeTShares || stake.stakeShares)}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-blue-400">
                        {hexStakingService.formatStakeLength(parseInt(stake.stakedDays))}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-orange-400">
                        {formatUSD(calculateEstimatedYield(stake.stakedHearts, stake.stakedDays))}
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
              
              {/* Pagination Controls for PulseChain All Stake Starts */}
              {pulsechainStakeStarts.length > allStakesPerPage && (
                <PaginationControls
                  currentPage={pulsechainStakeStartsCurrentPage}
                  totalPages={totalPulsechainStakeStartsPages}
                  onPageChange={setPulsechainStakeStartsCurrentPage}
                  totalItems={pulsechainStakeStarts.length}
                  itemsPerPage={allStakesPerPage}
                />
              )}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-white mb-2">No PulseChain stake start events loaded</p>
              <button
                onClick={loadPulsechainStakeStarts}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
              >
                Load PulseChain Stakes
              </button>
            </div>
          )}
        </div>
      )}

      {stakingSubTab === 'active-stakes' && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div>
              <h4 className="text-lg font-semibold text-white">All Active HEX Stakes (Ethereum)</h4>
              <p className="text-sm text-slate-400">Stakes that have not yet ended</p>
            </div>
            {isLoadingActiveStakes && (
              <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
            )}
          </div>
          
          {isLoadingActiveStakes ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-4" />
              <p className="text-white">Loading all Ethereum active stakes...</p>
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
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">USD Value</th>
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
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Est. Yield</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Yield Earned</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Progress</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">End Day</th>
                  </tr>
                </thead>
                <tbody className="bg-transparent divide-y divide-white/10">
                  {paginatedActiveStakes.map((stake) => {
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
                          {formatUSD(calculateStakeUSD(stake.stakedHearts))}
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
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-orange-400">
                          {formatUSD(calculateEstimatedYield(stake.stakedHearts, stake.stakedDays))}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-green-400">
                          {formatUSD(calculateYieldEarned(stake.stakedHearts, stake.daysServed || 0, stake.stakedDays))}
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
              
              {/* Pagination Controls for Ethereum Active Stakes */}
              {activeStakes.length > activeStakesPerPage && (
                <PaginationControls
                  currentPage={activeStakesCurrentPage}
                  totalPages={totalActiveStakesPages}
                  onPageChange={setActiveStakesCurrentPage}
                  totalItems={activeStakes.length}
                  itemsPerPage={activeStakesPerPage}
                />
              )}
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-white mb-2">No Ethereum active stakes loaded</p>
              <button
                onClick={loadActiveStakes}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
              >
                Load Ethereum Active Stakes
              </button>
            </div>
          )}
        </div>
      )}

      {/* PulseChain Active Stakes Section */}
      {stakingSubTab === 'active-stakes' && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div>
              <h4 className="text-lg font-semibold text-white">All Active HEX Stakes (PulseChain)</h4>
              <p className="text-sm text-slate-400">Stakes that have not yet ended</p>
            </div>
            {isLoadingPulsechainStakes && (
              <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
            )}
          </div>
          
          {isLoadingPulsechainStakes ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-4" />
              <p className="text-white">Loading all PulseChain active stakes...</p>
              <p className="text-sm text-slate-400">Fetching and cross-referencing stake data...</p>
            </div>
          ) : pulsechainActiveStakes.length > 0 ? (
            <div className="overflow-auto max-h-[70vh]">
              <table className="min-w-full divide-y divide-white/10">
                <thead className="bg-slate-900 text-white sticky top-0">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Stake ID</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Staker Address</th>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                      onClick={() => handlePulsechainActiveStakesSort('stakedHearts')}
                    >
                      <div className="flex items-center gap-1">
                        Staked Hearts
                        {pulsechainActiveStakesSortField === 'stakedHearts' ? (
                          pulsechainActiveStakesSortDirection === 'desc' ? '↓' : '↑'
                        ) : '↕'}
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">USD Value</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">T-Shares</th>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                      onClick={() => handlePulsechainActiveStakesSort('stakedDays')}
                    >
                      <div className="flex items-center gap-1">
                        Staked Days
                        {pulsechainActiveStakesSortField === 'stakedDays' ? (
                          pulsechainActiveStakesSortDirection === 'desc' ? '↓' : '↑'
                        ) : '↕'}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                      onClick={() => handlePulsechainActiveStakesSort('daysServed')}
                    >
                      <div className="flex items-center gap-1">
                        Days Served
                        {pulsechainActiveStakesSortField === 'daysServed' ? (
                          pulsechainActiveStakesSortDirection === 'desc' ? '↓' : '↑'
                        ) : '↕'}
                      </div>
                    </th>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                      onClick={() => handlePulsechainActiveStakesSort('daysLeft')}
                    >
                      <div className="flex items-center gap-1">
                        Days Left
                        {pulsechainActiveStakesSortField === 'daysLeft' ? (
                          pulsechainActiveStakesSortDirection === 'desc' ? '↓' : '↑'
                        ) : '↕'}
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">Est. Yield</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">Yield Earned</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">Progress</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">End Day</th>
                    <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="bg-transparent divide-y divide-white/10">
                  {paginatedPulsechainActiveStakes.map((stake) => {
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
                            <span className="hidden sm:inline">{stake.stakerAddr.slice(0, 8)}...</span>
                            <span className="sm:hidden">{stake.stakerAddr.slice(0, 4)}...</span>
                          </button>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-green-400 font-semibold">
                          <span className="hidden sm:inline">{hexStakingService.formatHexAmount(stake.stakedHearts)}</span>
                          <span className="sm:hidden">{hexStakingService.formatHexAmount(stake.stakedHearts, true)}</span>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-purple-400">
                          {formatUSD(calculateStakeUSD(stake.stakedHearts))}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-purple-400">
                          {hexStakingService.formatTShareAmount(stake.stakeTShares || stake.stakeShares)}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-blue-400">
                          <span className="hidden sm:inline">{hexStakingService.formatStakeLength(parseInt(stake.stakedDays))}</span>
                          <span className="sm:hidden">{parseInt(stake.stakedDays)}d</span>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-orange-400">
                          {stake.daysServed?.toLocaleString() || 'N/A'}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-yellow-400">
                          {stake.daysLeft?.toLocaleString() || 'N/A'}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-orange-400">
                          {formatUSD(calculateEstimatedYield(stake.stakedHearts, stake.stakedDays))}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-green-400">
                          {formatUSD(calculateYieldEarned(stake.stakedHearts, stake.daysServed || 0, stake.stakedDays))}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-700 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-slate-400 hidden sm:inline">{progress.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-cyan-400">
                          {stake.endDay}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-400">
                          {new Date(parseInt(stake.timestamp) * 1000).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {/* Pagination Controls for PulseChain Active Stakes */}
              {pulsechainActiveStakes.length > 0 && (
                <PaginationControls
                  currentPage={validPulsechainActiveStakesCurrentPage}
                  totalPages={totalPulsechainActiveStakesPages}
                  onPageChange={setPulsechainActiveStakesCurrentPage}
                  totalItems={pulsechainActiveStakes.length}
                  itemsPerPage={activeStakesPerPage}
                />
              )}
              
              {/* Debug Info - Remove after fixing */}
              <div className="px-6 py-2 text-xs text-slate-500 border-t border-white/10">
                Debug: Showing {paginatedPulsechainActiveStakes.length} of {pulsechainActiveStakes.length} stakes | 
                Page {validPulsechainActiveStakesCurrentPage} of {totalPulsechainActiveStakesPages} | 
                Items per page: {activeStakesPerPage}
              </div>
            </div>
          ) : (
            <div className="p-6 sm:p-8 text-center">
              <p className="text-white mb-3 text-sm sm:text-base">
                <span className="hidden sm:inline">No PulseChain active stakes loaded</span>
                <span className="sm:hidden">No PulseChain stakes loaded</span>
              </p>
              <button
                onClick={loadPulsechainActiveStakes}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3 sm:px-4 rounded text-sm sm:text-base"
              >
                <span className="hidden sm:inline">Load PulseChain Active Stakes</span>
                <span className="sm:hidden">Load Stakes</span>
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
        network="ethereum"
        currentPrice={getCurrentHexPrice()}
      />
    </div>
  );
};

export default StakingOverview;