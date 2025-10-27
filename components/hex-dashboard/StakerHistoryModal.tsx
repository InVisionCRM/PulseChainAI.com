import React, { useState, useEffect, useMemo } from 'react';
import { hexStakingService } from '@/services/hexStakingService';
import { pulsechainHexStakingService } from '@/services/pulsechainHexStakingService';
import { hexTransactionService, type WalletTransactionData, type HexTransaction } from '@/services/hexTransactionService';
import type { StakerHistoryMetrics, HexStake, HexStakeEnd } from '@/services/hexStakingService';
import { liquidHexBalanceService, type LiquidHexBalances } from '@/services/liquidHexBalanceService';
import { hexSwapService, type HexSwap, type SwapResponse } from '@/services/hexSwapService';
import { GridPattern } from '@/components/magicui/grid-pattern';
import { OptimizedImage } from '@/components/ui/optimized-image';

interface StakerHistoryModalProps {
  stakerAddress: string | null;
  isOpen: boolean;
  onClose: () => void;
  network: 'ethereum' | 'pulsechain';
  currentPrice: number;
}

const StakerHistoryModal: React.FC<StakerHistoryModalProps> = ({
  stakerAddress,
  isOpen,
  onClose,
  network,
  currentPrice,
}) => {
  const [historyData, setHistoryData] = useState<StakerHistoryMetrics | null>(null);
  const [transactionData, setTransactionData] = useState<WalletTransactionData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'active' | 'ended' | 'transactions'>('overview');
  const [activeNetwork, setActiveNetwork] = useState<'ethereum' | 'pulsechain'>(network);
  const [sortField, setSortField] = useState<'stakeId' | 'stakedHearts' | 'stakedDays' | 'startDay' | 'endDay' | 'daysServed' | 'timestamp'>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [liquidHexBalances, setLiquidHexBalances] = useState<{
    ethereum: number | null;
    pulsechain: number | null;
  }>({ ethereum: null, pulsechain: null });
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  
  // HEX Swap state
  const [hexSwaps, setHexSwaps] = useState<SwapResponse | null>(null);
  const [isLoadingHexSwaps, setIsLoadingHexSwaps] = useState(false);
  const [hexSwapsError, setHexSwapsError] = useState<string | null>(null);
  const [hexSwapsPage, setHexSwapsPage] = useState(1);

  // Helper functions for calculations
  const calculateStakeUSD = (stakedHearts: string): number => {
    const hearts = parseFloat(stakedHearts);
    // Use the actual current HEX price passed from parent
    return (hearts / 100000000) * currentPrice;
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
      fetchLiquidHexBalances();
      if (activeTab === 'transactions') {
        fetchTransactionData();
        fetchHexSwaps();
      }
    }
  }, [isOpen, stakerAddress, network]);

  useEffect(() => {
    if (isOpen && stakerAddress && activeTab === 'transactions' && !transactionData) {
      fetchTransactionData();
    }
  }, [activeTab, isOpen, stakerAddress]);

  useEffect(() => {
    if (isOpen && stakerAddress && activeTab === 'transactions') {
      fetchHexSwaps();
    }
  }, [activeTab, isOpen, stakerAddress]);

  useEffect(() => {
    setActiveNetwork(network);
  }, [network]);

  useEffect(() => {
    if (isOpen && stakerAddress && activeNetwork !== network) {
      fetchStakerHistory();
      fetchLiquidHexBalances();
      if (activeTab === 'transactions') {
        fetchTransactionData();
        fetchHexSwaps();
      }
    }
  }, [activeNetwork, isOpen, stakerAddress]);

  const fetchStakerHistory = async () => {
    if (!stakerAddress) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const service = activeNetwork === 'ethereum' ? hexStakingService : pulsechainHexStakingService;
      const data = await service.getStakerHistory(stakerAddress);
      setHistoryData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch staker history');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactionData = async () => {
    if (!stakerAddress) return;
    
    setIsLoadingTransactions(true);
    setTransactionError(null);
    
    try {
      const data = await hexTransactionService.getWalletTransactionData(stakerAddress, network);
      setTransactionData(data);
    } catch (err) {
      setTransactionError(err instanceof Error ? err.message : 'Failed to fetch transaction data');
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  const fetchLiquidHexBalances = async () => {
    if (!stakerAddress) return;
    
    setIsLoadingBalances(true);
    
    try {
      const balances = await liquidHexBalanceService.getLiquidHexBalances(stakerAddress);
      setLiquidHexBalances(balances);
    } catch (err) {
      console.error('Failed to fetch liquid HEX balances:', err);
      setLiquidHexBalances({ ethereum: null, pulsechain: null });
    } finally {
      setIsLoadingBalances(false);
    }
  };

  const fetchHexSwaps = async (page: number = 1) => {
    if (!stakerAddress) return;
    
    setIsLoadingHexSwaps(true);
    setHexSwapsError(null);
    
    try {
      const swaps = await hexSwapService.getHexSwaps(stakerAddress, activeNetwork, page);
      setHexSwaps(swaps);
      setHexSwapsPage(page);
    } catch (err) {
      console.error('Failed to fetch HEX swaps:', err);
      setHexSwapsError(err instanceof Error ? err.message : 'Failed to fetch HEX swaps');
      setHexSwaps(null);
    } finally {
      setIsLoadingHexSwaps(false);
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
    if (sortField !== field) return '↕️';
    return sortDirection === 'desc' ? '↓' : '↑';
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
        return sortDirection === 'asc' ? (aValue as string).localeCompare(bValue as string) : (bValue as string).localeCompare(aValue as string);
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
      if (stake.daysLeft && stake.daysLeft < 30) return 'text-yellow-700';
      return 'text-green-700';
    }
    const endData = getStakeEndData(stake.stakeId);
    if (endData && parseFloat(endData.penalty || '0') > 0) return 'text-red-700';
    return 'text-slate-950';
  };

  const getStakeStatusIcon = (stake: HexStake) => {
    if (stake.isActive) {
      if (stake.daysLeft && stake.daysLeft < 30) return '⚠️';
      return '🔄';
    }
    const endData = getStakeEndData(stake.stakeId);
    if (endData && parseFloat(endData.penalty || '0') > 0) return '❌';
    return '✅';
  };

  const handleHexSwapsPageChange = (newPage: number) => {
    setHexSwapsPage(newPage);
    fetchHexSwaps(newPage);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
             <div className="relative w-full max-w-7xl max-h-[90vh] bg-slate-950/75 backdrop-blur-2xl border border-white/30 rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)] overflow-hidden transform transition-all duration-300 ease-out scale-100">
        {/* Grid Pattern Background */}
        <div className="absolute inset-0 z-0">
          <GridPattern 
            width={32}
            height={32}
            strokeDasharray="0"
            className="opacity-20"
          />
        </div>
        
        {/* Header */}
        <div className="relative px-8 py-3 bg-white/20 backdrop-blur-xl border-b border-white/30 overflow-hidden z-10">
          {/* Network-Specific Background Image */}
          <div className="absolute inset-0 z-0">
            <OptimizedImage
              src={activeNetwork === 'ethereum' ? '/app-pics/eth-banner.png' : '/app-pics/pls-hex.png'}
              alt={`${activeNetwork === 'ethereum' ? 'Ethereum' : 'PulseChain'} background`}
              fill
              className="object-cover opacity-30"
              priority
              quality={85}
            />
          </div>
          
          {/* Content Layer - Above the grid */}
          <div className="relative z-10 flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div>
                 <h2 className="text-2xl font-bold text-white flex items-center gap-2 drop-shadow-lg">
                   <button
                     onClick={onClose}
                     className="text-white hover:text-white/80 transition-colors text-2xl font-bold"
                   >
                     ←
                   </button>
                   Staker History
                </h2>
                <p className="text-white text-sm mt-1 font-mono break-all drop-shadow-lg">
                  {stakerAddress}
                </p>
                
                {/* Network Tabs */}
                <div className="flex gap-1 mt-3">
            <button
                    onClick={() => setActiveNetwork('ethereum')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors backdrop-blur-sm ${
                      activeNetwork === 'ethereum'
                        ? 'bg-blue-500/90 text-white shadow-lg'
                        : 'bg-white/20 text-white/90 hover:bg-white/30 hover:text-white shadow-md'
                    }`}
                  >
                    Ethereum
                  </button>
                  <button
                    onClick={() => setActiveNetwork('pulsechain')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors backdrop-blur-sm ${
                      activeNetwork === 'pulsechain'
                        ? 'bg-blue-500/90 text-white shadow-lg'
                        : 'bg-white/20 text-white/90 hover:bg-white/30 hover:text-white shadow-md'
                    }`}
                  >
                    PulseChain
            </button>
              </div>
            </div>
            </div>
            
            
          </div>
          
          {/* Explorer Links - Bottom Right of Header */}
          <div className="absolute bottom-0 right-0 flex items-center gap-2 pb-0" style={{ right: '15px' }}>
            <a
              href={`https://etherscan.io/address/${stakerAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 bg-blue-500/30 hover:bg-blue-500/40 text-white text-xs font-medium rounded transition-colors backdrop-blur-sm"
            >
              Etherscan
            </a>
            <a
              href={`https://scan.mypinata.cloud/ipfs/bafybeih3olry3is4e4lzm7rus5l3h6zrphcal5a7ayfkhzm5oivjro2cp4/#/address/${stakerAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 bg-blue-500/30 hover:bg-blue-500/40 text-white text-xs font-medium rounded transition-colors backdrop-blur-sm"
            >
              PulseScan
            </a>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 p-8 max-h-[calc(90vh-120px)] overflow-y-auto">
          
          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <h3 className="text-xl font-semibold text-white mb-2">Loading Staker History...</h3>
              <p className="text-white">Fetching comprehensive staking data from The Graph</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-12">
              <div className="bg-red-900/20 border border-red-500/50 text-red-700 px-6 py-4 rounded-xl mb-4">
                <h3 className="font-bold text-lg mb-2">Error Loading History</h3>
                <p className="mb-4">{error}</p>
                <button
                  onClick={fetchStakerHistory}
                  className="bg-slate-950 hover:bg-slate-950 text-white font-bold py-2 px-4 rounded-lg"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Data Display */}
          {historyData && !isLoading && !error && (
            <div className="space-y-8">

              {/* Overview Metrics - Consolidated Layout */}
              <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Staking Overview</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column - Basic Stats */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-2 border-b border-white/10">
                      <span className="text-white font-medium">Total Stakes</span>
                      <span className="text-white font-bold text-lg">{(historyData.totalStakes || 0).toLocaleString()}</span>
                  </div>
                    
                    <div className="flex items-center justify-between py-2 border-b border-white/10">
                      <span className="text-white font-medium">Active Stakes</span>
                      <span className="text-white font-bold text-lg">{(historyData.activeStakes || 0).toLocaleString()}</span>
                </div>

                    <div className="flex items-center justify-between py-2 border-b border-white/10">
                      <span className="text-white font-medium">Ended Stakes</span>
                      <span className="text-white font-bold text-lg">{(historyData.endedStakes || 0).toLocaleString()}</span>
                </div>

                    <div className="flex items-center justify-between py-2 border-b border-white/10">
                      <span className="text-white font-medium">Average Length</span>
                      <span className="text-white font-bold text-lg">
                        {(activeNetwork === 'ethereum' ? hexStakingService : pulsechainHexStakingService).formatStakeLength(Math.round(historyData.averageStakeLength || 0))}
                      </span>
                  </div>
                </div>

                  {/* Right Column - Liquid HEX & Performance */}
                  <div className="space-y-4">
                    {/* Liquid HEX Balances */}
                    <div className="space-y-3">
                      <h4 className="text-white font-medium text-sm uppercase tracking-wider">Liquid HEX</h4>
                      
                      {liquidHexBalances.ethereum !== null && liquidHexBalances.ethereum > 0 && (
                        <div className="flex items-center justify-between py-2 px-3 bg-blue-500/10 rounded-lg">
                          <span className="text-slate-950 text-sm">eHEX</span>
                          <span className="text-white font-semibold">
                            {isLoadingBalances ? (
                              <div className="animate-pulse bg-white/20 h-4 w-16 rounded"></div>
                            ) : (
                              liquidHexBalanceService.formatHexAmount(liquidHexBalances.ethereum)
                            )}
                    </span>
                  </div>
                      )}
                      
                      {liquidHexBalances.pulsechain !== null && liquidHexBalances.pulsechain > 0 && (
                        <div className="flex items-center justify-between py-2 px-3 bg-blue-500/10 rounded-lg">
                          <span className="text-slate-950 text-sm">pHEX</span>
                          <span className="text-white font-semibold">
                            {isLoadingBalances ? (
                              <div className="animate-pulse bg-white/20 h-4 w-16 rounded"></div>
                            ) : (
                              liquidHexBalanceService.formatHexAmount(liquidHexBalances.pulsechain)
                            )}
                    </span>
                  </div>
                      )}
                      
                      {(!liquidHexBalances.ethereum || liquidHexBalances.ethereum === 0) && 
                       (!liquidHexBalances.pulsechain || liquidHexBalances.pulsechain === 0) && (
                        <div className="flex items-center justify-between py-2 px-3 bg-slate-500/10 rounded-lg">
                          <span className="text-white text-sm">No liquid HEX</span>
                          <span className="text-white text-sm">0</span>
                  </div>
                      )}
              </div>

              {/* Performance Metrics */}
              {(historyData.endedStakes || 0) > 0 && (
                      <div className="space-y-3 pt-2">
                        <h4 className="text-white font-medium text-sm uppercase tracking-wider">Performance</h4>
                        
                        <div className="flex items-center justify-between py-2 px-3 bg-green-500/10 rounded-lg">
                          <span className="text-green-700 text-sm">Total Payouts</span>
                          <span className="text-white font-semibold">
                            {Math.round(parseFloat(historyData.totalPayouts || '0') / Math.pow(10, 8)).toLocaleString()} HEX
                    </span>
                  </div>

                        <div className="flex items-center justify-between py-2 px-3 bg-red-500/10 rounded-lg">
                          <span className="text-red-700 text-sm">Total Penalties</span>
                          <span className="text-white font-semibold">
                            {Math.round(parseFloat(historyData.totalPenalties || '0') / Math.pow(10, 8)).toLocaleString()} HEX
                    </span>
                  </div>

                        <div className="flex items-center justify-between py-2 px-3 bg-blue-500/10 rounded-lg">
                          <span className="text-slate-950 text-sm">Avg APY</span>
                          <span className="text-white font-semibold">
                      {(() => {
                        if (!historyData || !historyData.stakes || !Array.isArray(historyData.stakes)) return '0.0%';
                        
                        const endedStakes = historyData.stakes.filter(s => s && !s.isActive);
                              const service = activeNetwork === 'ethereum' ? hexStakingService : pulsechainHexStakingService;
                        const apyValues = endedStakes.map(stake => {
                          if (!stake) return 0;
                          const endData = getStakeEndData(stake.stakeId);
                          if (endData && parseFloat(endData.payout || '0') > 0) {
                                  return service.calculateStakeAPY(stake as any, endData as any);
                          }
                          return 0;
                        }).filter(apy => apy > 0);
                        
                        const avgAPY = apyValues.length > 0 
                          ? apyValues.reduce((sum, apy) => sum + apy, 0) / apyValues.length 
                          : 0;
                        
                        return `${avgAPY.toFixed(1)}%`;
                      })()}
                          </span>
                  </div>
                </div>
              )}
                  </div>
                </div>
              </div>

              {/* Earnings Projections for Active Stakes */}
              {(historyData.activeStakes || 0) > 0 && (
                <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Active Stakes Earnings</h3>
                  
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center justify-between py-3 px-4 bg-green-500/10 rounded-lg">
                      <span className="text-green-300 text-sm font-medium">Earned So Far</span>
                      <span className="text-white font-bold">
                      {(() => {
                        if (!historyData || !historyData.stakes || !Array.isArray(historyData.stakes)) return '0 HEX';
                        
                        const activeStakes = historyData.stakes.filter(s => s && s.isActive);
                        const totalEarned = activeStakes.reduce((sum, stake) => {
                          return sum + calculateEarnedSoFar(stake.stakedHearts, stake.daysServed || 0, stake.stakedDays);
                        }, 0);
                        
                          const service = activeNetwork === 'ethereum' ? hexStakingService : pulsechainHexStakingService;
                        return service.formatHexAmount((totalEarned * 100000000).toString()) + ' HEX';
                      })()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-3 px-4 bg-blue-500/10 rounded-lg">
                      <span className="text-blue-300 text-sm font-medium">Expected Total</span>
                      <span className="text-white font-bold">
                      {(() => {
                        if (!historyData || !historyData.stakes || !Array.isArray(historyData.stakes)) return '0 HEX';
                        
                        const activeStakes = historyData.stakes.filter(s => s && s.isActive);
                        const totalExpected = activeStakes.reduce((sum, stake) => {
                          return sum + calculateExpectedEarnings(stake.stakedHearts, stake.stakedDays);
                        }, 0);
                        
                          const service = activeNetwork === 'ethereum' ? hexStakingService : pulsechainHexStakingService;
                        return service.formatHexAmount((totalExpected * 100000000).toString()) + ' HEX';
                      })()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-3 px-4 bg-blue-500/10 rounded-lg">
                      <span className="text-blue-300 text-sm font-medium">Remaining to Earn</span>
                      <span className="text-white font-bold">
                      {(() => {
                        if (!historyData || !historyData.stakes || !Array.isArray(historyData.stakes)) return '0 HEX';
                        
                        const activeStakes = historyData.stakes.filter(s => s && s.isActive);
                        const totalEarned = activeStakes.reduce((sum, stake) => {
                          return sum + calculateEarnedSoFar(stake.stakedHearts, stake.daysServed || 0, stake.stakedDays);
                        }, 0);
                        const totalExpected = activeStakes.reduce((sum, stake) => {
                          return sum + calculateExpectedEarnings(stake.stakedHearts, stake.stakedDays);
                        }, 0);
                        
                          const service = activeNetwork === 'ethereum' ? hexStakingService : pulsechainHexStakingService;
                        return service.formatHexAmount(((totalExpected - totalEarned) * 100000000).toString()) + ' HEX';
                      })()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="border-b border-white/10">
                <nav className="-mb-px flex space-x-8">
                  {[
                    { key: 'overview', label: `All Stakes (${historyData.totalStakes || 0})` },
                    { key: 'active', label: `Active (${historyData.activeStakes || 0})` },
                    { key: 'ended', label: `Ended (${historyData.endedStakes || 0})` },
                    { key: 'transactions', label: `Transactions${transactionData ? ` (${transactionData.totalTransactions})` : ''}` }
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key as any)}
                      className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                        activeTab === key
                          ? 'border-blue-500 text-slate-950'
                          : 'border-transparent text-white hover:text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Content based on active tab */}
              {activeTab === 'transactions' ? (
                /* Transactions Section */
                <div className="space-y-6">


                  {/* Loading State for Transactions */}
                  {isLoadingTransactions && (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                      <h3 className="text-xl font-semibold text-white mb-2">Loading Transactions...</h3>
                      <p className="text-white">Fetching all HEX-related transactions</p>
                    </div>
                  )}

                  {/* Error State for Transactions */}
                  {transactionError && (
                    <div className="text-center py-12">
                      <div className="bg-red-900/20 border border-red-500/50 text-red-700 px-6 py-4 rounded-xl mb-4">
                        <h3 className="font-bold text-lg mb-2">Error Loading Transactions</h3>
                        <p className="mb-4">{transactionError}</p>
                        <button
                          onClick={fetchTransactionData}
                          className="bg-slate-950 hover:bg-slate-950 text-white font-bold py-2 px-4 rounded-lg"
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Transactions Table */}
                  {transactionData && !isLoadingTransactions && !transactionError && (
                    <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl overflow-hidden">
                      <div className="px-6 py-4 border-b border-white/10">
                        <h3 className="text-lg font-semibold text-white">
                          📊 All HEX Transactions ({transactionData.totalTransactions})
                        </h3>
                        <p className="text-sm text-white/70 mt-1">
                          Includes transfers, stakes, and other HEX-related activities
                        </p>
                      </div>
                      <div className="overflow-auto max-h-[60vh]">
                        <table className="min-w-full divide-y divide-white/10">
                          <thead className="bg-slate-900 text-white sticky top-0">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Type</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Description</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Amount</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Transaction</th>
                            </tr>
                          </thead>
                          <tbody className="bg-transparent divide-y divide-white/10">
                            {transactionData.transactions.map((tx) => (
                              <tr key={tx.id} className="hover:bg-white/5">
                                <td className="px-4 py-4 whitespace-nowrap text-sm">
                                  <div className={`${hexTransactionService.getTransactionTypeColor(tx.type)}`}>
                                    <span className="font-medium capitalize">
                                      {tx.type.replace('_', ' ')}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-sm text-white">
                                  <div className="max-w-md">
                                    {tx.description}
                                  </div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm">
                                  <div className="font-semibold text-white">
                                    {(activeNetwork === 'ethereum' ? hexStakingService : pulsechainHexStakingService).formatHexAmount(tx.value)} HEX
                                  </div>
                                  {currentPrice > 0 && (
                                    <div className="text-xs text-white/70">
                                      {formatUSD(parseFloat(tx.value) / Math.pow(10, 8) * currentPrice)}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                                  {hexTransactionService.formatDate(tx.timestamp)}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm">
                                  <a
                                    href={hexTransactionService.getExplorerUrl(tx.hash, network)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1 underline"
                                    title={`View transaction: ${tx.hash}`}
                                  >
                                    <span>{tx.hash.slice(0, 10)}...</span>
                                    <span>↗</span>
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        
                        {transactionData.transactions.length === 0 && (
                          <div className="text-center py-8 text-white">
                            No HEX transactions found for this address
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* HEX Swaps Section */}
                  <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/10">
                      <h3 className="text-lg font-semibold text-white">
                        🔄 HEX Swaps ({hexSwaps?.total || 0})
                      </h3>
                                              <p className="text-sm text-white/70 mt-1">
                          HEX trading activity on {hexSwapService.getNetworkName(activeNetwork)}
                        </p>
                    </div>

                    {/* Loading State for HEX Swaps */}
                    {isLoadingHexSwaps && (
                      <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <h3 className="text-xl font-semibold text-white mb-2">Loading HEX Swaps...</h3>
                        <p className="text-white">Fetching swap transactions from Moralis API</p>
                      </div>
                    )}

                    {/* Error State for HEX Swaps */}
                    {hexSwapsError && (
                      <div className="text-center py-12">
                        <div className="bg-red-900/20 border border-red-500/50 text-red-700 px-6 py-4 rounded-xl mb-4">
                          <h3 className="font-bold text-lg mb-2">Error Loading HEX Swaps</h3>
                          <p className="mb-4">{hexSwapsError}</p>
                          <button
                            onClick={() => fetchHexSwaps()}
                            className="bg-slate-950 hover:bg-slate-950 text-white font-bold py-2 px-4 rounded-lg"
                          >
                            Try Again
                          </button>
                        </div>
                      </div>
                    )}

                    {/* HEX Swaps Table */}
                    {hexSwaps && !isLoadingHexSwaps && !hexSwapsError && (
                      <div className="overflow-auto max-h-[60vh]">
                        {hexSwaps.result.length > 0 ? (
                          <table className="min-w-full divide-y divide-white/10">
                            <thead className="bg-slate-900 text-white sticky top-0">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Token</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Direction</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Amount</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Value (USD)</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Gas Fee</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Transaction</th>
                              </tr>
                            </thead>
                            <tbody className="bg-transparent divide-y divide-white/10">
                              {hexSwaps.result.map((swap) => (
                                <tr key={swap.transaction_hash} className="hover:bg-white/5">
                                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                                    <div className={`${
                                      swap.swap_type === 'HEX_IN' ? 'text-green-400' : 
                                      swap.swap_type === 'HEX_OUT' ? 'text-red-400' : 'text-blue-400'
                                    }`}>
                                      <span className="font-medium capitalize">
                                        {swap.swap_type === 'HEX_IN' ? 'HEX In' : 
                                         swap.swap_type === 'HEX_OUT' ? 'HEX Out' : 'Other'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                                    <div className="flex items-center gap-2">
                                      {swap.token_logo && (
                                        <img 
                                          src={swap.token_logo} 
                                          alt={swap.token_symbol}
                                          className="w-6 h-6 rounded-full"
                                          onError={(e) => e.currentTarget.style.display = 'none'}
                                        />
                                      )}
                                      <div>
                                        <div className="font-medium text-white">{swap.token_symbol}</div>
                                        <div className="text-xs text-white/70">{swap.token_name}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      swap.direction === 'IN' 
                                        ? 'bg-green-500/20 text-green-400' 
                                        : 'bg-red-500/20 text-red-400'
                                    }`}>
                                      {swap.direction === 'IN' ? 'Received' : 'Sent'}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                                    <div className="font-semibold text-white">
                                      {swap.amount_formatted} {swap.token_symbol}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                                    <div className="text-white">
                                      {hexSwapService.formatUSD(swap.value_usd || '0')}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                                    <div className="text-white">
                                      {hexSwapService.formatUSD(swap.gas_fee_usd || '0')}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-white">
                                    {new Date(swap.block_timestamp).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                                    <a
                                      href={hexSwapService.getExplorerUrl(swap.transaction_hash, activeNetwork)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1 underline"
                                      title={`View transaction: ${swap.transaction_hash}`}
                                    >
                                      <span>{swap.transaction_hash.slice(0, 10)}...</span>
                                      <span>↗</span>
                                    </a>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="text-center py-8 text-white">
                            No HEX swaps found for this address
                          </div>
                        )}
                      </div>
                    )}

                    {/* HEX Swaps Pagination */}
                    {hexSwaps && hexSwaps.total > 50 && (
                      <div className="px-6 py-4 border-t border-white/10">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-white/70">
                            Showing page {hexSwaps.page} of {Math.ceil(hexSwaps.total / 50)}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleHexSwapsPageChange(hexSwaps.page - 1)}
                              disabled={hexSwaps.page <= 1}
                              className="px-3 py-1 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                            >
                              Previous
                            </button>
                            <button
                              onClick={() => handleHexSwapsPageChange(hexSwaps.page + 1)}
                              disabled={hexSwaps.page >= Math.ceil(hexSwaps.total / 50)}
                              className="px-3 py-1 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Stakes Table */
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
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold">
                                                                {(activeNetwork === 'ethereum' ? hexStakingService : pulsechainHexStakingService).formatHexAmount(stake.stakedHearts)}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-white">
                                                                {(activeNetwork === 'ethereum' ? hexStakingService : pulsechainHexStakingService).formatTShareAmount(stake.stakeTShares || stake.stakeShares)}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-white">
                                                                {(activeNetwork === 'ethereum' ? hexStakingService : pulsechainHexStakingService).formatStakeLengthInDays(parseInt(stake.stakedDays))}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-white">
                              <div className="space-y-1">
                                <div>
                                  {stake.daysServed?.toLocaleString() || 'N/A'} days
                                </div>
                                {endData && !stake.isActive && (() => {
                                  const service = activeNetwork === 'ethereum' ? hexStakingService : pulsechainHexStakingService;
                                  const daysLate = service.calculateLateEndingDays(stake as any, endData as any);
                                  if (daysLate > 0) {
                                    return (
                                      <div className="text-xs text-white">
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
                                      hasPenalty ? 'bg-red-500' : progress >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-blue-500 to-blue-500'
                                    }`}
                                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                                  />
                                </div>
                                <span className="text-xs text-white">{progress.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-white">
                              {formatDate(stake.timestamp)}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-white">
                              <div className="flex items-center gap-1">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  activeNetwork === 'ethereum' 
                                    ? 'bg-blue-500/20 text-slate-950' 
                                    : 'bg-blue-500/20 text-blue-400'
                                }`}>
                                  {activeNetwork === 'ethereum' ? 'Ethereum' : 'PulseChain'}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm">
                              <div className="space-y-1">
                                {/* Start Transaction */}
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-white">Start:</span>
                                  <a
                                    href={(activeNetwork === 'ethereum' ? hexStakingService : pulsechainHexStakingService).getTransactionUrl(stake.transactionHash)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-green-700 hover:text-green-500 flex items-center gap-1 underline"
                                    title={`View start transaction: ${stake.transactionHash}`}
                                  >
                                    <span>{stake.transactionHash.slice(0, 8)}...</span>
↗
                                  </a>
                                </div>
                                
                                {/* End Transaction */}
                                {endData && endData.transactionHash && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-white">End:</span>
                                    <a
                                      href={(activeNetwork === 'ethereum' ? hexStakingService : pulsechainHexStakingService).getTransactionUrl(endData.transactionHash)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-red-700 hover:text-red-500 flex items-center gap-1 underline"
                                      title={`View end transaction: ${endData.transactionHash}`}
                                    >
                                      <span>{endData.transactionHash.slice(0, 8)}...</span>
  ↗
                                    </a>
                                  </div>
                                )}
                                
                                {stake.isActive && (
                                  <div className="text-xs text-white">End: N/A</div>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm">
                              {endData ? (
                                <div className="space-y-1">
                                  {parseFloat(endData.payout || '0') > 0 && (
                                    <div className="text-xs text-white">
                                      +{Math.round(parseFloat(endData.payout) / Math.pow(10, 8)).toLocaleString()} HEX
                                    </div>
                                  )}
                                  {parseFloat(endData.penalty || '0') > 0 && (
                                    <div className="text-xs text-white">
                                      -{Math.round(parseFloat(endData.penalty) / Math.pow(10, 8)).toLocaleString()} HEX
                                    </div>
                                  )}
                                  {parseFloat(endData.payout || '0') > 0 && (
                                    <div className="text-xs text-white">
                                      APY: {(activeNetwork === 'ethereum' ? hexStakingService : pulsechainHexStakingService).calculateStakeAPY(stake as any, endData as any).toFixed(1)}%
                                    </div>
                                  )}
                                </div>
                              ) : stake.isActive ? (
                                <span className="text-xs text-white">Active</span>
                              ) : (
                                <span className="text-xs text-white">N/A</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  
                  {sortedStakes.length === 0 && (
                    <div className="text-center py-8 text-white">
                      No stakes found for this filter
                    </div>
                  )}
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

export default StakerHistoryModal;