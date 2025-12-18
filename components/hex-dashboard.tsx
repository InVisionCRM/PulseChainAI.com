"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Calendar, Download, Filter, Brain, Users, Lock, Globe, Search, X, BarChart3 } from 'lucide-react';
import { dexscreenerApi } from '@/services/blockchain/dexscreenerApi';
import { OptimizedImage } from '@/components/ui/optimized-image';
import type { DexScreenerData } from '@/services/core/types';
// import HexGeminiAnalysis from './HexGeminiAnalysis';
import TopStakesVisual from './hex-dashboard/TopStakesVisual';
import StakerHistoryModal from './hex-dashboard/StakerHistoryModal';
import EndstakeTimingAI from './hex-dashboard/EndstakeTimingAI';
import SellPressureAnalysisTab from './hex-dashboard/SellPressureAnalysisTab';
import type { HexDataPoint } from '@/lib/hooks/useHexGemini';
import { hexStakingService, type HexStakingMetrics } from '@/services/hexStakingService';
import { pulsechainHexStakingService } from '@/services/pulsechainHexStakingService';
import { HexLoader } from '@/components/ui/hex-loader';
import { NumberTicker } from './magicui/number-ticker';
import { FlickeringGrid } from './magicui/flickering-grid';

// Stronger types for dashboard data
type HexRow = HexDataPoint & {
  _id?: string;
  priceUV2?: number;
  priceUV3?: number;
  priceChangePulseX?: number;
};

interface LiveData {
  // Ethereum
  price?: number;
  tsharePrice?: number;
  tshareRateHEX?: number;
  stakedHEX?: number;
  circulatingHEX?: number;
  payoutPerTshare?: number;
  liquidityHEX?: number;
  liquidityUSDC?: number;
  liquidityETH?: number;
  penaltiesHEX?: number;
  // PulseChain
  price_Pulsechain?: number;
  pricePulseX?: number;
  tsharePrice_Pulsechain?: number;
  tshareRateHEX_Pulsechain?: number;
  stakedHEX_Pulsechain?: number;
  circulatingHEX_Pulsechain?: number;
  payoutPerTshare_Pulsechain?: number;
  liquidityHEX_Pulsechain?: number;
  liquidityPLS_Pulsechain?: number;
  liquidityEHEX_Pulsechain?: number;
  penaltiesHEX_Pulsechain?: number;
  pricePLS_Pulsechain?: number;
  pricePLSX_Pulsechain?: number;
  priceINC_Pulsechain?: number;
}

const HEXDataDashboard = () => {
  const [ethereumData, setEthereumData] = useState<HexRow[]>([]);
  const [pulsechainData, setPulsechainData] = useState<HexRow[]>([]);
  const [liveData, setLiveData] = useState<LiveData | null>(null);
  const [activeTab, setActiveTab] = useState<'pulsechain' | 'ethereum' | 'ethereum-staking' | 'pulsechain-staking' | 'sell-pressure'>('pulsechain');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof HexRow; direction: 'asc' | 'desc' }>({ key: 'currentDay', direction: 'desc' });
  const [filterDate, setFilterDate] = useState<string>('');

  const [showDexPairs, setShowDexPairs] = useState<boolean>(false);
  const [isLoadingDexPairs, setIsLoadingDexPairs] = useState<boolean>(false);
  const [dexPairs, setDexPairs] = useState<NonNullable<DexScreenerData['pairs']> | null>(null);
  const [dexPairsError, setDexPairsError] = useState<string | null>(null);
  // Ethereum HEX Staking Data
  const [ethereumStakingData, setEthereumStakingData] = useState<HexStakingMetrics | null>(null);
  const [isLoadingEthereumStaking, setIsLoadingEthereumStaking] = useState<boolean>(false);
  const [ethereumStakingError, setEthereumStakingError] = useState<string | null>(null);
  const [ethereumAllStakeStarts, setEthereumAllStakeStarts] = useState<any[]>([]);
  const [isLoadingEthereumAllStakes, setIsLoadingEthereumAllStakes] = useState<boolean>(false);
  const [ethereumStakingSubTab, setEthereumStakingSubTab] = useState<'overview' | 'all-stakes' | 'active-stakes' | 'ai-timing'>('overview');
  const [ethereumActiveStakes, setEthereumActiveStakes] = useState<any[]>([]);
  const [isLoadingEthereumActiveStakes, setIsLoadingEthereumActiveStakes] = useState<boolean>(false);
  const [ethereumActiveStakesSortField, setEthereumActiveStakesSortField] = useState<'stakeId' | 'stakedHearts' | 'stakedDays' | 'daysServed' | 'daysLeft' | 'progress' | 'startDay' | 'endDay' | 'stakeTShares' | 'timestamp'>('stakedHearts');
  const [ethereumActiveStakesSortDirection, setEthereumActiveStakesSortDirection] = useState<'asc' | 'desc'>('desc');
  const [ethereumActiveStakesCurrentPage, setEthereumActiveStakesCurrentPage] = useState<number>(1);
  const [ethereumStakeStartsSortField, setEthereumStakeStartsSortField] = useState<'stakeId' | 'stakedHearts' | 'stakedDays' | 'startDay' | 'endDay' | 'stakeTShares' | 'timestamp'>('stakeId');
  const [ethereumStakeStartsSortDirection, setEthereumStakeStartsSortDirection] = useState<'asc' | 'desc'>('desc');

  // PulseChain HEX Staking Data
  const [pulsechainStakingData, setPulsechainStakingData] = useState<HexStakingMetrics | null>(null);
  const [isLoadingPulsechainStaking, setIsLoadingPulsechainStaking] = useState<boolean>(false);
  const [pulsechainStakingError, setPulsechainStakingError] = useState<string | null>(null);
  const [pulsechainAllStakeStarts, setPulsechainAllStakeStarts] = useState<any[]>([]);
  const [isLoadingPulsechainAllStakes, setIsLoadingPulsechainAllStakes] = useState<boolean>(false);
  const [pulsechainStakingSubTab, setPulsechainStakingSubTab] = useState<'overview' | 'all-stakes' | 'active-stakes' | 'ai-timing'>('overview');
  const [pulsechainActiveStakes, setPulsechainActiveStakes] = useState<any[]>([]);
  const [isLoadingPulsechainActiveStakes, setIsLoadingPulsechainActiveStakes] = useState<boolean>(false);
  const [pulsechainActiveStakesSortField, setPulsechainActiveStakesSortField] = useState<'stakeId' | 'stakedHearts' | 'stakedDays' | 'daysServed' | 'daysLeft' | 'progress'>('stakedHearts');
  const [pulsechainActiveStakesSortDirection, setPulsechainActiveStakesSortDirection] = useState<'asc' | 'desc'>('desc');
  const [pulsechainActiveStakesCurrentPage, setPulsechainActiveStakesCurrentPage] = useState<number>(1);
  const [pulsechainStakeStartsSortField, setPulsechainStakeStartsSortField] = useState<'stakeId' | 'stakedHearts' | 'stakedDays' | 'startDay' | 'endDay' | 'stakeTShares' | 'timestamp'>('stakeId');
  const [pulsechainStakeStartsSortDirection, setPulsechainStakeStartsSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedStakerAddress, setSelectedStakerAddress] = useState<string | null>(null);
  const [isEthereumStakerHistoryModalOpen, setIsEthereumStakerHistoryModalOpen] = useState<boolean>(false);


  const [isPulsechainStakerHistoryModalOpen, setIsPulsechainStakerHistoryModalOpen] = useState<boolean>(false);
  
  // Database status state
  const [isDatabaseAvailable, setIsDatabaseAvailable] = useState<boolean>(false);
  const [databaseStatus, setDatabaseStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  
  // Simple loading states for database operations
  const [databaseLoadingStates, setDatabaseLoadingStates] = useState<{
    ethereum: {
      overview: boolean;
      stakes: boolean;
      global: boolean;
    };
    pulsechain: {
      overview: boolean;
      stakes: boolean;
      global: boolean;
    };
  }>({
    ethereum: {
      overview: false,
      stakes: false,
      global: false
    },
    pulsechain: {
      overview: false,
      stakes: false,
      global: false
    }
  });
  
  // Chart modal state
  const [isChartModalOpen, setIsChartModalOpen] = useState<boolean>(false);
  
  // Wallet address search state
  const [searchAddress, setSearchAddress] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [dualNetworkStakerData, setDualNetworkStakerData] = useState<{
    ethereum: any | null;
    pulsechain: any | null;
  } | null>(null);
  const [isDualNetworkModalOpen, setIsDualNetworkModalOpen] = useState<boolean>(false);
  
  const getApiUrl = (endpoint: 'ethereum' | 'pulsechain' | 'live'): string => {
    const endpointMap: Record<'ethereum' | 'pulsechain' | 'live', string> = {
      ethereum: 'fulldata',
      pulsechain: 'fulldatapulsechain',
      live: 'livedata'
    };
    return `/api/hex-proxy?endpoint=${endpointMap[endpoint]}`;
  };

  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 50;

  // Data flow management state
  const [dataFlowStatus, setDataFlowStatus] = useState<{
    ethereum: 'database' | 'graphql' | 'transitioning' | 'error';
    pulsechain: 'database' | 'graphql' | 'transitioning' | 'error';
  }>({
    ethereum: 'transitioning',
    pulsechain: 'transitioning'
  });

  // Load Ethereum HEX staking data from database first, then GraphQL as fallback
  const loadEthereumStakingData = useCallback(async () => {
    setIsLoadingEthereumStaking(true);
    setEthereumStakingError(null);
    
    try {
      // Try database first
      try {
        setDatabaseLoading('ethereum', 'overview', true);
        setDatabaseLoading('ethereum', 'global', true);
        setDatabaseLoading('ethereum', 'stakes', true);
        
        const { hexStakingDb } = await import('@/lib/db/hexStakingDb');
        const { databaseStatus } = await import('@/lib/db/databaseStatus');
        
        const isDbAvailable = await databaseStatus.checkAvailability();
        
        if (isDbAvailable) {
          console.log('🗄️ Loading Ethereum staking data from database...');
          const [overview, globalInfo, topStakes] = await Promise.all([
            hexStakingDb.getStakingOverview('ethereum'),
            hexStakingDb.getLatestGlobalInfo('ethereum'),
            hexStakingDb.getTopStakes('ethereum', 100)
          ]);
          
          if (overview && globalInfo && overview.totalActiveStakes > 0) {
            const stakingData = {
              totalActiveStakes: overview.totalActiveStakes,
              totalStakedHearts: overview.totalStakedHearts,
              averageStakeLength: overview.averageStakeLength,
              globalInfo: {
                id: globalInfo.id.toString(),
                hexDay: globalInfo.hex_day.toString(),
                stakeSharesTotal: globalInfo.stake_shares_total,
                stakePenaltyTotal: globalInfo.stake_penalty_total,
                latestStakeId: globalInfo.latest_stake_id,
                shareRate: '0',
                totalSupply: '0',
                lockedHeartsTotal: globalInfo.locked_hearts_total,
                timestamp: globalInfo.timestamp
              },
              topStakes: topStakes.map(stake => ({
                id: stake.id.toString(),
                stakeId: stake.stake_id,
                stakerAddr: stake.staker_addr,
                stakedHearts: stake.staked_hearts,
                stakedDays: stake.staked_days.toString(),
                startDay: stake.start_day.toString(),
                endDay: stake.end_day.toString(),
                stakeShares: stake.stake_shares,
                stakeTShares: stake.stake_t_shares,
                timestamp: stake.timestamp,
                isAutoStake: stake.is_auto_stake,
                transactionHash: stake.transaction_hash,
                blockNumber: stake.block_number,
                daysServed: stake.days_served,
                daysLeft: stake.days_left,
                isActive: true
              })),
              recentStakeStarts: []
            };
            
            setEthereumStakingData(stakingData);
            setDataFlowStatus(prev => ({ ...prev, ethereum: 'database' }));
            console.log('✅ Ethereum staking data loaded from database');
            
            // Clear loading states
            setDatabaseLoading('ethereum', 'overview', false);
            setDatabaseLoading('ethereum', 'global', false);
            setDatabaseLoading('ethereum', 'stakes', false);
            return;
          }
        }
      } catch (dbError) {
        console.warn('⚠️ Database query failed for Ethereum:', dbError);
        // Clear loading states on error
        setDatabaseLoading('ethereum', 'overview', false);
        setDatabaseLoading('ethereum', 'global', false);
        setDatabaseLoading('ethereum', 'stakes', false);
      }
      
      // Fallback to GraphQL API
      console.log('📡 Loading Ethereum staking data from GraphQL API...');
      const stakingData = await hexStakingService.getStakingMetrics();
      setEthereumStakingData(stakingData);
      setDataFlowStatus(prev => ({ ...prev, ethereum: 'graphql' }));
      console.log('✅ Ethereum staking data loaded from GraphQL API');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setEthereumStakingError(errorMessage);
      setDataFlowStatus(prev => ({ ...prev, ethereum: 'error' }));
      console.error('❌ Failed to load Ethereum staking data:', error);
    } finally {
      setIsLoadingEthereumStaking(false);
    }
  }, []);

  // Load PulseChain HEX staking data from database first, then GraphQL as fallback
  const loadPulsechainStakingData = useCallback(async () => {
    setIsLoadingPulsechainStaking(true);
    setPulsechainStakingError(null);
    
    try {
      // Try database first
      try {
        setDatabaseLoading('pulsechain', 'overview', true);
        setDatabaseLoading('pulsechain', 'global', true);
        setDatabaseLoading('pulsechain', 'stakes', true);
        
        const { hexStakingDb } = await import('@/lib/db/hexStakingDb');
        const { databaseStatus } = await import('@/lib/db/databaseStatus');
        
        const isDbAvailable = await databaseStatus.checkAvailability();
        
        if (isDbAvailable) {
          console.log('🗄️ Loading PulseChain staking data from database...');
          const [overview, globalInfo, topStakes] = await Promise.all([
            hexStakingDb.getStakingOverview('pulsechain'),
            hexStakingDb.getLatestGlobalInfo('pulsechain'),
            hexStakingDb.getTopStakes('pulsechain', 100)
          ]);
          
          if (overview && globalInfo && overview.totalActiveStakes > 0) {
            const stakingData = {
              totalActiveStakes: overview.totalActiveStakes,
              totalStakedHearts: overview.totalStakedHearts,
              averageStakeLength: overview.averageStakeLength,
              globalInfo: {
                id: globalInfo.id.toString(),
                hexDay: globalInfo.hex_day.toString(),
                stakeSharesTotal: globalInfo.stake_shares_total,
                stakePenaltyTotal: globalInfo.stake_penalty_total,
                latestStakeId: globalInfo.latest_stake_id,
                shareRate: '0',
                totalSupply: '0',
                lockedHeartsTotal: globalInfo.locked_hearts_total,
                timestamp: globalInfo.timestamp
              },
              topStakes: topStakes.map(stake => ({
                id: stake.id.toString(),
                stakeId: stake.stake_id,
                stakerAddr: stake.staker_addr,
                stakedHearts: stake.staked_hearts,
                stakedDays: stake.staked_days.toString(),
                startDay: stake.start_day.toString(),
                endDay: stake.end_day.toString(),
                stakeShares: stake.stake_shares,
                stakeTShares: stake.stake_t_shares,
                timestamp: stake.timestamp,
                isAutoStake: stake.is_auto_stake,
                transactionHash: stake.transaction_hash,
                blockNumber: stake.block_number,
                daysServed: stake.days_served,
                daysLeft: stake.days_left,
                isActive: true
              })),
              recentStakeStarts: []
            };
            
            setPulsechainStakingData(stakingData);
            setDataFlowStatus(prev => ({ ...prev, pulsechain: 'database' }));
            console.log('✅ PulseChain staking data loaded from database');
            
            // Clear loading states
            setDatabaseLoading('pulsechain', 'overview', false);
            setDatabaseLoading('pulsechain', 'global', false);
            setDatabaseLoading('pulsechain', 'stakes', false);
            return;
          }
        }
      } catch (dbError) {
        console.warn('⚠️ Database query failed for PulseChain:', dbError);
        // Clear loading states on error
        setDatabaseLoading('pulsechain', 'overview', false);
        setDatabaseLoading('pulsechain', 'stakes', false);
        setDatabaseLoading('pulsechain', 'global', false);
      }
      
      // Fallback to GraphQL API
      console.log('📡 Loading PulseChain staking data from GraphQL API...');
      const stakingData = await pulsechainHexStakingService.getStakingMetrics();
      setPulsechainStakingData(stakingData);
      setDataFlowStatus(prev => ({ ...prev, pulsechain: 'graphql' }));
      console.log('✅ PulseChain staking data loaded from GraphQL API');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setPulsechainStakingError(errorMessage);
      setDataFlowStatus(prev => ({ ...prev, pulsechain: 'error' }));
      console.error('❌ Failed to load PulseChain staking data:', error);
    } finally {
      setIsLoadingPulsechainStaking(false);
    }
  }, []);

  // Data consistency checker
  const checkDataConsistency = useCallback((ethereumData: any, pulsechainData: any) => {
    const issues = [];
    
    // Check if data structures are consistent
    if (ethereumData && pulsechainData) {
      if (ethereumData.totalStakes !== undefined && pulsechainData.totalStakes !== undefined) {
        if (typeof ethereumData.totalStakes !== typeof pulsechainData.totalStakes) {
          issues.push('Data type mismatch between networks');
        }
      }
    }
    
    return issues;
  }, []);

  // Enhanced data flow with transitions
  const transitionToDatabase = useCallback(async (network: 'ethereum' | 'pulsechain') => {
    if (!isDatabaseAvailable) return;
    
    setDataFlowStatus(prev => ({
      ...prev,
      [network]: 'transitioning'
    }));
    
    try {
      // Pre-fetch database data
      if (network === 'ethereum') {
        await loadEthereumStakingData();
      } else {
        await loadPulsechainStakingData();
      }
      
      setDataFlowStatus(prev => ({
        ...prev,
        [network]: 'database'
      }));
    } catch (error) {
      console.error(`Failed to transition ${network} to database:`, error);
      setDataFlowStatus(prev => ({
        ...prev,
        [network]: 'error'
      }));
    }
  }, [isDatabaseAvailable, loadEthereumStakingData, loadPulsechainStakingData]);

  // Auto-transition to database when it becomes available
  useEffect(() => {
    if (isDatabaseAvailable) {
      // Transition both networks to database if they're currently using GraphQL
      if (dataFlowStatus.ethereum === 'graphql') {
        transitionToDatabase('ethereum');
      }
      if (dataFlowStatus.pulsechain === 'graphql') {
        transitionToDatabase('pulsechain');
      }
    }
  }, [isDatabaseAvailable, dataFlowStatus, transitionToDatabase]);

  // Enhanced error boundary for data flow
  const handleDataFlowError = useCallback((network: 'ethereum' | 'pulsechain', error: any) => {
    console.error(`${network} data flow error:`, error);
    
    setDataFlowStatus(prev => ({
      ...prev,
      [network]: 'error'
    }));
    
    // Attempt to recover by falling back to GraphQL
    setTimeout(() => {
      if (network === 'ethereum') {
        loadEthereumStakingData();
      } else {
        loadPulsechainStakingData();
      }
    }, 2000);
  }, [loadEthereumStakingData, loadPulsechainStakingData]);



  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Fetching HEX data from proxy API routes...');
      
      const fetchWithRetry = async (url: string, retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            console.log(`Fetching: ${url}`);
            const response = await fetch(url);
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`HTTP error! status: ${response.status}, body: ${errorText}`);
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log(`Successfully fetched data from ${url}`);
            return data;
          } catch (error) {
            console.error(`Attempt ${i + 1} failed for ${url}:`, error);
            if (i === retries - 1) throw error;
            console.log(`Retrying in ${(i + 1)} seconds...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          }
        }
      };

      // Fetch all data with proper error handling
      const results = await Promise.allSettled([
        fetchWithRetry(getApiUrl('ethereum')),
        fetchWithRetry(getApiUrl('pulsechain')),
        fetchWithRetry(getApiUrl('live'))
      ]);

      // Process results
      const processData = (data: unknown): HexRow[] => {
        if (!data) return [] as HexRow[];
        const dataArray = Array.isArray(data) ? data : Object.values(data as Record<string, unknown>);
        return (dataArray as HexRow[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      };

      // Process PulseChain data with price backfill, and trim to PulseChain era
      const processPulseChainData = (historicalData: unknown, live: LiveData | null): HexRow[] => {
        if (!historicalData) return [] as HexRow[];
        const dataArray = Array.isArray(historicalData) ? historicalData : Object.values(historicalData as Record<string, unknown>);
        const sortedData = (dataArray as HexRow[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Helper to coerce to number safely
        const toNum = (val: unknown): number => {
          const n = typeof val === 'string' ? Number(val) : (typeof val === 'number' ? val : 0);
          return Number.isFinite(n) ? n : 0;
        };

        const adjustedData = sortedData.map((row: HexRow, index: number) => {
          // For PulseChain, use pricePulseX as the primary USD price
          let priceUSD = toNum(row.pricePulseX);

          // Fallback to other price fields when missing/zero
          if (priceUSD <= 0) {
            const pUV2UV3 = toNum(row.priceUV2UV3);
            const pUV2 = toNum(row.priceUV2);
            const pUV3 = toNum(row.priceUV3);
            priceUSD = pUV2UV3 > 0 ? pUV2UV3 : (pUV2 > 0 ? pUV2 : (pUV3 > 0 ? pUV3 : 0));
          }

          // Back-compute from marketCap / circulatingHEX if still missing
          if (priceUSD <= 0) {
            const mc = toNum(row.marketCap);
            const circ = toNum(row.circulatingHEX);
            if (mc > 0 && circ > 0) {
              priceUSD = mc / circ;
            }
          }

          // For the latest row, prefer true live price when available
          if (index === 0 && live && toNum(live.price_Pulsechain) > 0) {
            priceUSD = toNum(live.price_Pulsechain);
          }

          // Calculate market cap based on the correct price
          let marketCap = toNum(row.marketCap);
          if (priceUSD > 0) {
            marketCap = priceUSD * toNum(row.circulatingHEX);
          }

          // Use priceChangePulseX for price change
          let priceChange = toNum(row.priceChangePulseX);
          if (priceChange === 0) {
            priceChange = toNum(row.priceChangeUV2UV3);
          }

          return {
            ...row,
            priceUV2UV3: priceUSD, // Use this field for display
            priceChangeUV2UV3: priceChange, // Use PulseX price change
            marketCap,
          } as HexRow;
        });

        // Log once for debugging
        if (adjustedData.length > 0) {
          console.log('🔧 PulseChain data backfilled. Sample:', {
            date: adjustedData[0].date,
            pricePulseX: adjustedData[0].pricePulseX,
            priceUV2UV3: adjustedData[0].priceUV2UV3,
            priceChangePulseX: adjustedData[0].priceChangePulseX,
            marketCap: adjustedData[0].marketCap,
          });
        }

        // Filter out dates before PulseChain mainnet (approx. 2023-05-12)
        const PULSECHAIN_GENESIS = new Date('2023-05-12').getTime();
        const pulsechainEraData = adjustedData.filter((row) => new Date(row.date).getTime() >= PULSECHAIN_GENESIS);

        return pulsechainEraData;
      };

      let successCount = 0;
      
      if (results[0].status === 'fulfilled') {
        const ethereumRows = processData(results[0].value);
        setEthereumData(ethereumRows);
        console.log('✅ Ethereum data loaded successfully');
        console.log('📊 Ethereum data sample:', ethereumData[0]);
        successCount++;
      } else {
        console.error('❌ Ethereum data failed:', results[0].reason.message);
      }
      
      let liveDataResult: LiveData | null = null;
      
      if (results[2].status === 'fulfilled') {
        liveDataResult = results[2].value as LiveData;
        setLiveData(liveDataResult);
        console.log('✅ Live data loaded successfully');
        successCount++;
      } else {
        console.error('❌ Live data failed:', results[2].reason.message);
      }
      
      if (results[1].status === 'fulfilled') {
        const pulsechainRows = processPulseChainData(results[1].value, liveDataResult);
        setPulsechainData(pulsechainRows);
        console.log('✅ PulseChain data loaded successfully');
        console.log('📊 PulseChain data sample:', pulsechainData[0]);
        successCount++;
      } else {
        console.error('❌ PulseChain data failed:', results[1].reason.message);
      }
      
      if (successCount === 0) {
        throw new Error('All API endpoints failed. Please check your internet connection and try again.');
      }
      
      console.log(`🎉 Data loading completed: ${successCount}/3 endpoints successful`);
      
    } catch (err) {
      console.error('Error fetching data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to fetch HEX data: ${errorMessage}. This might be due to API rate limits or network issues.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Custom hook for database-first data fetching - COMMENTED OUT (causes TypeScript errors with generic syntax inside component)
  // This functionality is already handled by loadEthereumStakingData and loadPulsechainStakingData
  /*
  const useDatabaseQuery = <T>(
    queryFn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
    dependencies: any[] = []
  ) => {
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [dataSource, setDataSource] = useState<'database' | 'graphql'>('database');

    const fetchData = useCallback(async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Try database first if available
        if (isDatabaseAvailable) {
          try {
            console.log('🗄️ Attempting database query...');
            const result = await queryFn();
            if (result) {
              setData(result);
              setDataSource('database');
              console.log('✅ Data loaded from database');
              return;
            }
          } catch (dbError) {
            console.warn('⚠️ Database query failed, falling back to GraphQL:', dbError);
          }
        }
        
        // Fallback to GraphQL
        console.log('📡 Loading data from GraphQL API...');
        const result = await fallbackFn();
        setData(result);
        setDataSource('graphql');
        console.log('✅ Data loaded from GraphQL API');
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('❌ Both database and GraphQL failed:', err);
    } finally {
        setIsLoading(false);
      }
    }, [isDatabaseAvailable, ...dependencies]);

    useEffect(() => {
      fetchData();
    }, [fetchData]);

    return { data, isLoading, error, dataSource, refetch: fetchData };
  };

  // Database-first data fetching for Ethereum staking metrics
  const {
    data: ethereumStakingMetrics,
    isLoading: isLoadingEthereumMetrics,
    error: ethereumMetricsError,
    dataSource: ethereumMetricsSource
  } = useDatabaseQuery(
    async () => {
      const { hexStakingDb } = await import('@/lib/db/hexStakingDb');
      const [overview, globalInfo, topStakes] = await Promise.all([
        hexStakingDb.getStakingOverview('ethereum'),
        hexStakingDb.getLatestGlobalInfo('ethereum'),
        hexStakingDb.getTopStakes('ethereum', 100)
      ]);
      
      if (overview && globalInfo && overview.totalActiveStakes > 0) {
        return {
          totalActiveStakes: overview.totalActiveStakes,
          totalStakedHearts: overview.totalStakedHearts,
          averageStakeLength: overview.averageStakeLength,
          globalInfo: {
            id: globalInfo.id.toString(),
            hexDay: globalInfo.hex_day.toString(),
            stakeSharesTotal: globalInfo.stake_shares_total,
            stakePenaltyTotal: globalInfo.stake_penalty_total,
            latestStakeId: globalInfo.latest_stake_id,
            shareRate: '0',
            totalSupply: '0',
            lockedHeartsTotal: globalInfo.locked_hearts_total,
            timestamp: globalInfo.timestamp
          },
          topStakes: topStakes.map(stake => ({
            id: stake.id.toString(),
            stakeId: stake.stake_id,
            stakerAddr: stake.staker_addr,
            stakedHearts: stake.staked_hearts,
            stakedDays: stake.staked_days.toString(),
            startDay: stake.start_day.toString(),
            endDay: stake.end_day.toString(),
            stakeShares: stake.stake_shares,
            stakeTShares: stake.stake_t_shares,
            timestamp: stake.timestamp,
            isAutoStake: stake.is_auto_stake,
            transactionHash: stake.transaction_hash,
            blockNumber: stake.block_number,
            daysServed: stake.days_served,
            daysLeft: stake.days_left
          }))
        };
      }
      return null;
    },
    () => hexStakingService.getStakingMetrics(),
    [isDatabaseAvailable]
  );

  // Database-first data fetching for PulseChain staking metrics
  const {
    data: pulsechainStakingMetrics,
    isLoading: isLoadingPulsechainMetrics,
    error: pulsechainMetricsError,
    dataSource: pulsechainMetricsSource
  } = useDatabaseQuery(
    async () => {
      const { pulsechainStakingDb } = await import('@/lib/db/pulsechainStakingDb');
      const [overview, globalInfo, topStakes] = await Promise.all([
        pulsechainStakingDb.getStakingOverview(),
        pulsechainStakingDb.getLatestGlobalInfo(),
        pulsechainStakingDb.getTopStakes(100)
      ]);
      
      if (overview && globalInfo && overview.totalActiveStakes > 0) {
        return {
          totalActiveStakes: overview.totalActiveStakes,
          totalStakedHearts: overview.totalStakedHearts,
          averageStakeLength: overview.averageStakeLength,
          globalInfo: {
            id: globalInfo.id.toString(),
            hexDay: globalInfo.hex_day.toString(),
            stakeSharesTotal: globalInfo.stake_shares_total,
            stakePenaltyTotal: globalInfo.stake_penalty_total,
            latestStakeId: globalInfo.latest_stake_id,
            shareRate: '0',
            totalSupply: '0',
            lockedHeartsTotal: globalInfo.locked_hearts_total,
            timestamp: globalInfo.timestamp
          },
          topStakes: topStakes.map(stake => ({
            id: stake.id.toString(),
            stakeId: stake.stake_id,
            stakerAddr: stake.staker_addr,
            stakedHearts: stake.staked_hearts,
            stakedDays: stake.staked_days.toString(),
            startDay: stake.start_day.toString(),
            endDay: stake.end_day.toString(),
            stakeShares: stake.stake_shares,
            stakeTShares: stake.stake_t_shares,
            timestamp: stake.timestamp,
            isAutoStake: stake.is_auto_stake,
            transactionHash: stake.transaction_hash,
            blockNumber: stake.block_number,
            daysServed: stake.days_served,
            daysLeft: stake.days_left
          }))
        };
      }
      return null;
    },
    () => pulsechainHexStakingService.getStakingMetrics(),
    [isDatabaseAvailable]
  );

  // Update existing state when database data is available
  useEffect(() => {
    if (ethereumStakingMetrics) {
      setEthereumStakingData(ethereumStakingMetrics);
    }
  }, [ethereumStakingMetrics]);

  useEffect(() => {
    if (pulsechainStakingMetrics) {
      setPulsechainStakingData(pulsechainStakingMetrics);
    }
  }, [pulsechainStakingMetrics]);
  */

  // Load Ethereum stake starts from database first, then GraphQL as fallback
  const loadEthereumStakeStarts = async () => {
    setIsLoadingEthereumAllStakes(true);
    try {
      // Check if we're on server-side and can access database
      if (typeof window === 'undefined') {
        try {
          const { hexStakingDb } = await import('@/lib/db/hexStakingDb');
          const { databaseStatus } = await import('@/lib/db/databaseStatus');
          
          const isDbAvailable = await databaseStatus.checkAvailability();
          
          if (isDbAvailable) {
            console.log('🗄️ Loading Ethereum stake starts from database...');
            
            // Get all stake starts from database (limit to 1000 for performance)
            const dbStakes = await hexStakingDb.getActiveStakes({ 
              network: 'ethereum', 
              limit: 1000 
            });
            
            if (dbStakes.length > 0) {
              console.log(`✅ Retrieved ${dbStakes.length} Ethereum stake starts from database`);
              
              // Convert database format to expected format
              const convertedStakes = dbStakes.map(stake => ({
                id: stake.id.toString(),
                stakeId: stake.stake_id,
                stakerAddr: stake.staker_addr,
                stakedHearts: stake.staked_hearts,
                stakeShares: stake.stake_shares,
                stakedDays: stake.staked_days.toString(),
                startDay: stake.start_day.toString(),
                endDay: stake.end_day.toString(),
                stakeTShares: stake.stake_t_shares,
                timestamp: stake.timestamp,
                isAutoStake: stake.is_auto_stake,
                transactionHash: stake.transaction_hash,
                blockNumber: stake.block_number,
                daysServed: stake.days_served,
                daysLeft: stake.days_left
              }));
              
              setEthereumAllStakeStarts(convertedStakes);
              return; // Successfully loaded from database
            }
          }
        } catch (dbError) {
          console.warn('⚠️ Database query failed for Ethereum stake starts, falling back to GraphQL:', dbError);
        }
      }
      
      // Fallback to GraphQL API
      console.log('📡 Loading Ethereum stake starts from GraphQL API...');
      const stakes = await hexStakingService.getAllStakeStartsPaginated(1000);
      setEthereumAllStakeStarts(stakes);
      
    } catch (e) {
      console.error('Error loading Ethereum stake starts:', e);
    } finally {
      setIsLoadingEthereumAllStakes(false);
    }
  };

  // Load Ethereum active stakes from database first, then GraphQL as fallback
  const loadEthereumActiveStakes = async () => {
    setIsLoadingEthereumActiveStakes(true);
    try {
      // Try database first
      try {
        const { hexStakingDb } = await import('@/lib/db/hexStakingDb');
        const { databaseStatus } = await import('@/lib/db/databaseStatus');
        
        const isDbAvailable = await databaseStatus.checkAvailability();
        
        if (isDbAvailable) {
          console.log('🗄️ Loading Ethereum active stakes from database...');
          
          // Get active stakes from database
          const dbStakes = await hexStakingDb.getActiveStakes({ 
            network: 'ethereum', 
            limit: 10000 
          });
          
          if (dbStakes.length > 0) {
            console.log(`✅ Retrieved ${dbStakes.length} Ethereum active stakes from database`);
            
            // Convert database format to expected format
            const convertedStakes = dbStakes.map(stake => ({
              id: stake.id.toString(),
              stakeId: stake.stake_id,
              stakerAddr: stake.staker_addr,
              stakedHearts: stake.staked_hearts,
              stakeShares: stake.stake_shares,
              stakedDays: stake.staked_days.toString(),
              startDay: stake.start_day.toString(),
              endDay: stake.end_day.toString(),
              stakeTShares: stake.stake_t_shares,
              timestamp: stake.timestamp,
              isAutoStake: stake.is_auto_stake,
              transactionHash: stake.transaction_hash,
              blockNumber: stake.block_number,
              daysServed: stake.days_served,
              daysLeft: stake.days_left
            }));
            
            setEthereumActiveStakes(convertedStakes);
            return; // Successfully loaded from database
          }
        }
      } catch (dbError) {
        console.warn('⚠️ Database query failed for Ethereum active stakes, falling back to GraphQL:', dbError);
      }
      
      // Fallback to GraphQL API
      console.log('📡 Loading Ethereum active stakes from GraphQL API...');
      const stakes = await hexStakingService.getAllActiveStakes();
      setEthereumActiveStakes(stakes);
      
    } catch (e) {
      console.error('Error loading Ethereum active stakes:', e);
    } finally {
      setIsLoadingEthereumActiveStakes(false);
    }
  };

  // Load PulseChain stake starts from database first, then GraphQL as fallback
  const loadPulsechainStakeStarts = async () => {
    setIsLoadingPulsechainAllStakes(true);
    try {
      // Try database first
      try {
        const { pulsechainStakingDb } = await import('@/lib/db/pulsechainStakingDb');
        const { databaseStatus } = await import('@/lib/db/databaseStatus');
        
        const isDbAvailable = await databaseStatus.checkAvailability();
        
        if (isDbAvailable) {
          console.log('🗄️ Loading PulseChain stake starts from database...');
          
          // Get all stake starts from database (limit to 1000 for performance)
          const dbStakes = await pulsechainStakingDb.getStakeStarts({ limit: 1000, offset: 0 });
          
          if (dbStakes.length > 0) {
            console.log(`✅ Retrieved ${dbStakes.length} PulseChain stake starts from database`);
            
            // Convert database format to expected format
            const convertedStakes = dbStakes.map(stake => ({
              id: stake.id.toString(),
              stakeId: stake.stake_id,
              stakerAddr: stake.staker_addr,
              stakedHearts: stake.staked_hearts,
              stakeShares: stake.stake_shares,
              stakedDays: stake.staked_days.toString(),
              startDay: stake.start_day.toString(),
              endDay: stake.end_day.toString(),
              stakeTShares: stake.stake_t_shares,
              timestamp: stake.timestamp,
              isAutoStake: stake.is_auto_stake,
              transactionHash: stake.transaction_hash,
              blockNumber: stake.block_number,
              daysServed: stake.days_served,
              daysLeft: stake.days_left
            }));
            
            setPulsechainAllStakeStarts(convertedStakes);
            return; // Successfully loaded from database
          }
        }
      } catch (dbError) {
        console.warn('⚠️ Database query failed for PulseChain stake starts, falling back to GraphQL:', dbError);
      }
      
      // Fallback to GraphQL API
      console.log('📡 Loading PulseChain stake starts from GraphQL API...');
      const stakes = await pulsechainHexStakingService.getAllStakeStartsPaginated(1000);
      setPulsechainAllStakeStarts(stakes);
      
    } catch (e) {
      console.error('Error loading PulseChain stake starts:', e);
    } finally {
      setIsLoadingPulsechainAllStakes(false);
    }
  };

  // Load PulseChain active stakes from database first, then GraphQL as fallback
  const loadPulsechainActiveStakes = async () => {
    setIsLoadingPulsechainActiveStakes(true);
    try {
      // Try database first
      try {
        const { pulsechainStakingDb } = await import('@/lib/db/pulsechainStakingDb');
        const { databaseStatus } = await import('@/lib/db/databaseStatus');
        
        const isDbAvailable = await databaseStatus.checkAvailability();
        
        if (isDbAvailable) {
          console.log('🗄️ Loading PulseChain active stakes from database...');
          
          // Get active stakes from database
          const dbStakes = await pulsechainStakingDb.getActiveStakes({ limit: 10000, offset: 0 });
          
          if (dbStakes.length > 0) {
            console.log(`✅ Retrieved ${dbStakes.length} PulseChain active stakes from database`);
            
            // Convert database format to expected format
            const convertedStakes = dbStakes.map(stake => ({
              id: stake.id.toString(),
              stakeId: stake.stake_id,
              stakerAddr: stake.staker_addr,
              stakedHearts: stake.staked_hearts,
              stakeShares: stake.stake_shares,
              stakedDays: stake.staked_days.toString(),
              startDay: stake.start_day.toString(),
              endDay: stake.end_day.toString(),
              stakeTShares: stake.stake_t_shares,
              timestamp: stake.timestamp,
              isAutoStake: stake.is_auto_stake,
              transactionHash: stake.transaction_hash,
              blockNumber: stake.block_number,
              daysServed: stake.days_served,
              daysLeft: stake.days_left
            }));
            
            setPulsechainActiveStakes(convertedStakes);
            return; // Successfully loaded from database
          }
        }
      } catch (dbError) {
        console.warn('⚠️ Database query failed for PulseChain active stakes, falling back to GraphQL:', dbError);
      }
      
      // Fallback to GraphQL API
      console.log('📡 Loading PulseChain active stakes from GraphQL API...');
      const stakes = await pulsechainHexStakingService.getAllActiveStakes();
      setPulsechainActiveStakes(stakes);
      
    } catch (e) {
      console.error('Error loading PulseChain active stakes:', e);
    } finally {
      setIsLoadingPulsechainActiveStakes(false);
    }
  };

  // Search wallet address function - fetch from both networks and open modal
  const searchWalletAddress = async (address: string) => {
    if (!address.trim()) {
      setSearchError('Please enter a wallet address');
      return;
    }

    // Basic validation for Ethereum address format
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      setSearchError('Please enter a valid Ethereum address (0x followed by 40 hexadecimal characters)');
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      // Fetch from both networks simultaneously
      const [ethereumResult, pulsechainResult] = await Promise.allSettled([
        hexStakingService.getStakerHistory(address),
        pulsechainHexStakingService.getStakerHistory(address)
      ]);

      const ethereumData = ethereumResult.status === 'fulfilled' ? ethereumResult.value : null;
      const pulsechainData = pulsechainResult.status === 'fulfilled' ? pulsechainResult.value : null;

      // If both failed, show error
      if (!ethereumData && !pulsechainData) {
        const ethereumError = ethereumResult.status === 'rejected' ? ethereumResult.reason?.message : '';
        const pulsechainError = pulsechainResult.status === 'rejected' ? pulsechainResult.reason?.message : '';
        setSearchError(`Failed to fetch data from both networks. Ethereum: ${ethereumError}, PulseChain: ${pulsechainError}`);
        return;
      }

      // Store the data and automatically open the dual network modal
      setSelectedStakerAddress(address);
      setDualNetworkStakerData({
        ethereum: ethereumData,
        pulsechain: pulsechainData
      });
      setIsDualNetworkModalOpen(true);
      
      // Clear the search input after successful search
      setSearchAddress('');

    } catch (error) {
      console.error('Error searching wallet address:', error);
      setSearchError(error instanceof Error ? error.message : 'Failed to fetch wallet data');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchWalletAddress(searchAddress);
  };

  // Handle Ethereum active stakes sorting
  const handleEthereumActiveStakesSort = (field: 'stakeId' | 'stakedHearts' | 'stakedDays' | 'daysServed' | 'daysLeft' | 'progress' | 'startDay' | 'endDay' | 'stakeTShares' | 'timestamp') => {
    if (ethereumActiveStakesSortField === field) {
      setEthereumActiveStakesSortDirection(ethereumActiveStakesSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setEthereumActiveStakesSortField(field);
      setEthereumActiveStakesSortDirection('desc');
    }
  };

  // Handle Ethereum stake starts sorting
  const handleEthereumStakeStartsSort = (field: 'stakeId' | 'stakedHearts' | 'stakedDays' | 'startDay' | 'endDay' | 'stakeTShares' | 'timestamp') => {
    if (ethereumStakeStartsSortField === field) {
      setEthereumStakeStartsSortDirection(ethereumStakeStartsSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setEthereumStakeStartsSortField(field);
      setEthereumStakeStartsSortDirection('desc');
    }
  };

  // Pagination constants
  const ACTIVE_STAKES_PER_PAGE = 100;

  // Get sorted Ethereum active stakes
  const getSortedEthereumActiveStakes = () => {
    return [...ethereumActiveStakes].sort((a, b) => {
      let aValue: number, bValue: number;
      
      switch (ethereumActiveStakesSortField) {
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
        case 'progress':
          aValue = (a.daysServed || 0) / parseInt(a.stakedDays) * 100;
          bValue = (b.daysServed || 0) / parseInt(b.stakedDays) * 100;
          break;
        case 'startDay':
          aValue = parseInt((a as any).startDay) || 0;
          bValue = parseInt((b as any).startDay) || 0;
          break;
        case 'endDay':
          aValue = parseInt((a as any).endDay) || 0;
          bValue = parseInt((b as any).endDay) || 0;
          break;
        case 'stakeTShares':
          aValue = parseFloat(a.stakeTShares);
          bValue = parseFloat(b.stakeTShares);
          break;
        case 'timestamp':
          aValue = parseInt(a.timestamp);
          bValue = parseInt(b.timestamp);
          break;
        default:
          return 0;
      }
      
      return ethereumActiveStakesSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
  };

  // Get paginated Ethereum active stakes
  const getPaginatedEthereumActiveStakes = () => {
    const sortedStakes = getSortedEthereumActiveStakes();
    const startIndex = (ethereumActiveStakesCurrentPage - 1) * ACTIVE_STAKES_PER_PAGE;
    const endIndex = startIndex + ACTIVE_STAKES_PER_PAGE;
    return sortedStakes.slice(startIndex, endIndex);
  };

  // Get Ethereum active stakes pagination info
  const getEthereumActiveStakesPaginationInfo = () => {
    const totalStakes = ethereumActiveStakes.length;
    const totalPages = Math.ceil(totalStakes / ACTIVE_STAKES_PER_PAGE);
    const startIndex = (ethereumActiveStakesCurrentPage - 1) * ACTIVE_STAKES_PER_PAGE;
    const endIndex = Math.min(startIndex + ACTIVE_STAKES_PER_PAGE, totalStakes);
    
    return {
      totalStakes,
      totalPages,
      currentPage: ethereumActiveStakesCurrentPage,
      startIndex: startIndex + 1,
      endIndex,
      hasNextPage: ethereumActiveStakesCurrentPage < totalPages,
      hasPrevPage: ethereumActiveStakesCurrentPage > 1
    };
  };

  // Get sorted Ethereum stake starts
  const getSortedEthereumStakeStarts = () => {
    return [...ethereumAllStakeStarts].sort((a, b) => {
      let aValue: number, bValue: number;
      
      switch (ethereumStakeStartsSortField) {
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
        case 'stakeTShares':
          aValue = parseFloat(a.stakeTShares);
          bValue = parseFloat(b.stakeTShares);
          break;
        case 'timestamp':
          aValue = parseInt(a.timestamp);
          bValue = parseInt(b.timestamp);
          break;
        default:
          return 0;
      }
      
      return ethereumStakeStartsSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
  };

  // Handle PulseChain active stakes sorting
  const handlePulsechainActiveStakesSort = (field: 'stakeId' | 'stakedHearts' | 'stakedDays' | 'daysServed' | 'daysLeft' | 'progress') => {
    if (pulsechainActiveStakesSortField === field) {
      setPulsechainActiveStakesSortDirection(pulsechainActiveStakesSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setPulsechainActiveStakesSortField(field);
      setPulsechainActiveStakesSortDirection('desc');
    }
  };

  // Handle PulseChain stake starts sorting
  const handlePulsechainStakeStartsSort = (field: 'stakeId' | 'stakedHearts' | 'stakedDays' | 'startDay' | 'endDay' | 'stakeTShares' | 'timestamp') => {
    if (pulsechainStakeStartsSortField === field) {
      setPulsechainStakeStartsSortDirection(pulsechainStakeStartsSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setPulsechainStakeStartsSortField(field);
      setPulsechainStakeStartsSortDirection('desc');
    }
  };

  // Get sorted PulseChain active stakes
  const getSortedPulsechainActiveStakes = () => {
    return [...pulsechainActiveStakes].sort((a, b) => {
      let aValue: number, bValue: number;
      
      switch (pulsechainActiveStakesSortField) {
        case 'stakeId':
          aValue = parseInt(a.stakeId);
          bValue = parseInt(b.stakeId);
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
        case 'progress':
          aValue = (a.daysServed || 0) / parseInt(a.stakedDays) * 100;
          bValue = (b.daysServed || 0) / parseInt(b.stakedDays) * 100;
          break;
        default:
          return 0;
      }
      
      return pulsechainActiveStakesSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
  };

  // Get paginated PulseChain active stakes
  const getPaginatedPulsechainActiveStakes = () => {
    const sortedStakes = getSortedPulsechainActiveStakes();
    const startIndex = (pulsechainActiveStakesCurrentPage - 1) * ACTIVE_STAKES_PER_PAGE;
    const endIndex = startIndex + ACTIVE_STAKES_PER_PAGE;
    return sortedStakes.slice(startIndex, endIndex);
  };

  // Get PulseChain active stakes pagination info
  const getPulsechainActiveStakesPaginationInfo = () => {
    const totalStakes = pulsechainActiveStakes.length;
    const totalPages = Math.ceil(totalStakes / ACTIVE_STAKES_PER_PAGE);
    const startIndex = (pulsechainActiveStakesCurrentPage - 1) * ACTIVE_STAKES_PER_PAGE;
    const endIndex = Math.min(startIndex + ACTIVE_STAKES_PER_PAGE, totalStakes);
    
    return {
      totalStakes,
      totalPages,
      currentPage: pulsechainActiveStakesCurrentPage,
      startIndex: startIndex + 1,
      endIndex,
      hasNextPage: pulsechainActiveStakesCurrentPage < totalPages,
      hasPrevPage: pulsechainActiveStakesCurrentPage > 1
    };
  };

  // Get sorted PulseChain stake starts
  const getSortedPulsechainStakeStarts = () => {
    return [...pulsechainAllStakeStarts].sort((a, b) => {
      let aValue: number, bValue: number;
      
      switch (pulsechainStakeStartsSortField) {
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
        case 'stakeTShares':
          aValue = parseFloat(a.stakeTShares);
          bValue = parseFloat(b.stakeTShares);
          break;
        case 'timestamp':
          aValue = parseInt(a.timestamp);
          bValue = parseInt(b.timestamp);
          break;
        default:
          return 0;
      }
      
      return pulsechainStakeStartsSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
  };

  // Handle Ethereum staker row click
  const handleEthereumStakerClick = (stakerAddress: string) => {
    setSelectedStakerAddress(stakerAddress);
    setIsEthereumStakerHistoryModalOpen(true);
  };

  // Handle PulseChain staker row click
  const handlePulsechainStakerClick = (stakerAddress: string) => {
    setSelectedStakerAddress(stakerAddress);
    setIsPulsechainStakerHistoryModalOpen(true);
  };

  // Handle Ethereum modal close
  const handleEthereumStakerHistoryModalClose = () => {
    setIsEthereumStakerHistoryModalOpen(false);
    setSelectedStakerAddress(null);
  };

  // Handle PulseChain modal close
  const handlePulsechainStakerHistoryModalClose = () => {
    setIsPulsechainStakerHistoryModalOpen(false);
    setSelectedStakerAddress(null);
  };

  // Load PulseChain HEX liquidity pairs from DexScreener
  const loadDexPairs = async () => {
    setIsLoadingDexPairs(true);
    setDexPairsError(null);
    try {
      // HEX on PulseChain
      const HEX_PLS = '0x57fde0a71132198dfc1b2490b26c17fcef9601b2';
      const res = await dexscreenerApi.getTokenData(HEX_PLS);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to fetch DexScreener data');
      }
      const raw = res.data as unknown as { pairs?: DexScreenerData['pairs'] } & { data?: DexScreenerData['pairs'] };
      const pairs = (raw.pairs && Array.isArray(raw.pairs)) ? raw.pairs : (raw.data && Array.isArray(raw.data)) ? raw.data : [];
      const normalized = (pairs || []).slice().sort((a, b) => {
        const la = a?.liquidity?.usd ?? 0;
        const lb = b?.liquidity?.usd ?? 0;
        return (lb || 0) - (la || 0);
      });
      setDexPairs(normalized as NonNullable<DexScreenerData['pairs']>);
    } catch (e) {
      setDexPairs(null);
      setDexPairsError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoadingDexPairs(false);
    }
  };

  // Check database availability
  const checkDatabaseStatus = async () => {
    if (typeof window !== 'undefined') {
      // Client-side: database not available
      setIsDatabaseAvailable(false);
      setDatabaseStatus('unavailable');
      return;
    }

    try {
      const { databaseStatus } = await import('@/lib/db/databaseStatus');
      const isAvailable = await databaseStatus.checkAvailability();
      
      setIsDatabaseAvailable(isAvailable);
      setDatabaseStatus(isAvailable ? 'available' : 'unavailable');
      
      if (isAvailable) {
        console.log('✅ Database is available for dashboard operations');
      } else {
        console.log('⚠️ Database is not available, dashboard will use GraphQL APIs');
      }
    } catch (error) {
      console.error('❌ Error checking database status:', error);
      setIsDatabaseAvailable(false);
      setDatabaseStatus('unavailable');
    }
  };

  // Helper functions to manage loading states
  const setDatabaseLoading = useCallback((network: 'ethereum' | 'pulsechain', operation: 'overview' | 'stakes' | 'global', loading: boolean) => {
    setDatabaseLoadingStates(prev => ({
      ...prev,
      [network]: {
        ...prev[network],
        [operation]: loading
      }
    }));
  }, []);

  const isDatabaseLoading = useCallback((network: 'ethereum' | 'pulsechain', operation: 'overview' | 'stakes' | 'global') => {
    return databaseLoadingStates[network][operation];
  }, [databaseLoadingStates]);

  useEffect(() => {
    fetchData();
    
    // Check database status on mount
    checkDatabaseStatus();
    
    // Set up auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Load initial staking data for both networks
  useEffect(() => {
    console.log('🚀 Dashboard mounted, database-first data loading initiated');
    
    // Load staking data from database first
    loadEthereumStakingData();
    loadPulsechainStakingData();
  }, [loadEthereumStakingData, loadPulsechainStakingData]);

  // Load active stakes when overview tab is active for sell pressure analysis
  useEffect(() => {
    if (ethereumStakingSubTab === 'overview' && ethereumActiveStakes.length === 0) {
      loadEthereumActiveStakes();
    }
    if (pulsechainStakingSubTab === 'overview' && pulsechainActiveStakes.length === 0) {
      loadPulsechainActiveStakes();
    }
  }, [ethereumStakingSubTab, pulsechainStakingSubTab, ethereumActiveStakes.length, pulsechainActiveStakes.length]);

  // Enhanced current data that uses live prices when historical prices are zero
  const getEnhancedCurrentData = (): HexRow[] => {
    const baseData: HexRow[] = activeTab === 'ethereum' ? ethereumData : pulsechainData;
    
    if (!baseData || !liveData || baseData.length === 0) {
      return baseData;
    }
    
    // For PulseChain, enhance the latest record with live prices if historical prices are zero
    if (activeTab === 'pulsechain' && liveData && (liveData.price_Pulsechain || liveData.pricePulseX)) {
      const enhancedData: HexRow[] = [...baseData];
      const latestRecord: HexRow | undefined = enhancedData[0];
      
      const livePrice = (liveData.price_Pulsechain ?? liveData.pricePulseX ?? 0);
      
      if (latestRecord && (latestRecord.priceUV2UV3 === 0 || latestRecord.priceUV2UV3 === null || latestRecord.priceUV2UV3 === undefined)) {
        enhancedData[0] = {
          ...latestRecord,
          priceUV2UV3: livePrice,
          priceUV2: livePrice,
          priceUV3: livePrice,
          // Update market cap based on live price
          marketCap: livePrice * (latestRecord.circulatingHEX || 0),
          // Add live data fields
          tsharePrice: liveData.tsharePrice_Pulsechain,
          tshareRateHEX: liveData.tshareRateHEX_Pulsechain,
          liquidityHEX: liveData.liquidityHEX_Pulsechain,
          penaltiesHEX: liveData.penaltiesHEX_Pulsechain,
          payoutPerTshare: liveData.payoutPerTshare_Pulsechain,
          stakedHEX: liveData.stakedHEX_Pulsechain,
          circulatingHEX: liveData.circulatingHEX_Pulsechain,
          // Add network-specific prices
          pricePLS: liveData.pricePLS_Pulsechain,
          pricePLSX: liveData.pricePLSX_Pulsechain,
          priceINC: liveData.priceINC_Pulsechain
        };
        console.log('🔧 Enhanced historical table data with live prices:', enhancedData[0]);
      }
      
      return enhancedData;
    }
    
    return baseData;
  };
  
  const currentData: HexRow[] = getEnhancedCurrentData();
  
  // Debug logging for data enhancement
  useEffect(() => {
    if (activeTab === 'pulsechain' && currentData.length > 0) {
      console.log('🔍 Current PulseChain data sample:', currentData[0]);
      console.log('🔍 Live data available:', !!liveData);
      if (liveData) {
        console.log('🔍 Live PulseChain price:', liveData.price_Pulsechain);
      }
    }
  }, [activeTab, currentData, liveData]);

  // Format numbers with commas and appropriate suffixes
  const formatNumber = (num: unknown, decimals = 2, showFullNumber = false) => {
    if (num === null || num === undefined) return 'N/A';
    const number = Number(num);
    if (isNaN(number)) return 'N/A';
    
    // Ensure decimals is within valid range (0-20)
    const validDecimals = Math.max(0, Math.min(20, Math.floor(decimals || 2)));
    
    if (showFullNumber || Math.abs(number) < 1000) {
      return number.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: validDecimals
      });
    }
    
    if (Math.abs(number) >= 1e12) return (number / 1e12).toFixed(validDecimals) + 'T';
    if (Math.abs(number) >= 1e9) return (number / 1e9).toFixed(validDecimals) + 'B';
    if (Math.abs(number) >= 1e6) return (number / 1e6).toFixed(validDecimals) + 'M';
    if (Math.abs(number) >= 1e3) return (number / 1e3).toFixed(validDecimals) + 'K';
    return number.toFixed(validDecimals);
  };

  const formatCurrency = (num: unknown, decimals = 6) => {
    if (num === null || num === undefined) return 'N/A';
    const number = Number(num);
    if (isNaN(number)) return 'N/A';
    
    // Ensure decimals is within valid range (0-20)
    const validDecimals = Math.max(0, Math.min(20, Math.floor(decimals || 2)));
    
    if (Math.abs(number) >= 1e12) return '$' + (number / 1e12).toFixed(2) + 'T';
    if (Math.abs(number) >= 1e9) return '$' + (number / 1e9).toFixed(2) + 'B';
    if (Math.abs(number) >= 1e6) return '$' + (number / 1e6).toFixed(2) + 'M';
    if (Math.abs(number) >= 1e3) return '$' + (number / 1e3).toFixed(2) + 'K';
    
    return '$' + number.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: validDecimals
    });
  };

  const formatPercent = (num: unknown, decimals = 2) => {
    if (num === null || num === undefined) return 'N/A';
    const number = Number(num);
    if (isNaN(number)) return 'N/A';
    
    // Ensure decimals is within valid range (0-20)
    const validDecimals = Math.max(0, Math.min(20, Math.floor(decimals || 2)));
    return number.toFixed(validDecimals) + '%';
  };

  const formatHEX = (num: unknown, decimals = 0) => {
    if (num === null || num === undefined) return 'N/A';
    return formatNumber(num, decimals) + ' HEX';
  };

  const formatTShares = (num: unknown, decimals = 2) => {
    if (num === null || num === undefined) return 'N/A';
    return formatNumber(num, decimals) + ' T-SHARES';
  };

  const formatPrice = (num: unknown, decimals = 8) => {
    if (num === null || num === undefined) return 'N/A';
    const number = Number(num);
    if (isNaN(number)) return 'N/A';
    
    // Special handling for HEX price - show only 4 decimal places
    if (decimals === 8) {
      return '$' + number.toFixed(4);
    }
    
    // Ensure decimals is within valid range (0-20)
    const validDecimals = Math.max(0, Math.min(20, Math.floor(decimals || 2)));
    
    if (Math.abs(number) < 0.000001) return '$' + number.toExponential(2);
    return '$' + number.toFixed(validDecimals);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  };

  const getChangeColor = (value: unknown) => {
    if (value === null || value === undefined) return 'text-slate-600';
    return (value as number) >= 0 ? 'text-white font-semibold  ' : 'text-red-600';
  };

  const normalizeHistoricalTextColor = (color?: string) => {
    const allowedShades = ['red', 'green', 'blue', 'slate-950 font-semibold  ', 'orange', 'cyan'];
    if (!color) return 'text-white';
    return allowedShades.some((shade) => color.includes(`text-${shade}`)) ? color : 'text-white';
  };


  // Sorting function
  const handleSort = (key: keyof HexRow) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction: direction as 'asc' | 'desc' });
  };

  const sortedData: HexRow[] = React.useMemo(() => {
    let sortableData: HexRow[] = [...currentData];
    
    // Apply date filter
    if (filterDate) {
      sortableData = sortableData.filter((item: HexRow) => 
        item.date.includes(filterDate)
      );
    }
    
    // Apply sorting
    sortableData.sort((a, b) => {
      let aVal = a[sortConfig.key] as unknown as number | string | undefined;
      let bVal = b[sortConfig.key] as unknown as number | string | undefined;
      
      if (aVal === null || aVal === undefined) aVal = 0;
      if (bVal === null || bVal === undefined) bVal = 0;
      
      if (sortConfig.direction === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    
    return sortableData;
  }, [currentData, sortConfig, filterDate, liveData]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData: HexRow[] = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900  flex items-center justify-center relative overflow-hidden">
        {/* FlickeringGrid Background */}
        <div className="absolute inset-0 z-0">
          <FlickeringGrid 
            color="rgb(20, 20, 20)"
            maxOpacity={0.15}
            squareSize={6}
            gridGap={8}
            flickerChance={0.4}
            className="w-full h-full"
          />
        </div>
        
        {/* Loading Content - Positioned above the grid */}
        <div className="text-center relative z-10">
          <div className="w-32 h-32 mx-auto mb-6">
            <HexLoader />
          </div>
          <h2 className="text-xl font-semibold text-white">
                  Loading HEX Data...
                </h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900  flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-900/20 border border-red-500/50 text-red-300 px-4 py-3 rounded mb-4">
            <h2 className="font-bold text-lg mb-2">Error Loading Data</h2>
            <p className="mb-4">{error}</p>
            <details className="text-sm text-slate-400">
              <summary className="cursor-pointer">Debug Information</summary>
              <div className="mt-2 space-y-1">
                <p>• API endpoints being called:</p>
                <p>  - {getApiUrl('ethereum')}</p>
                <p>  - {getApiUrl('pulsechain')}</p>
                <p>  - {getApiUrl('live')}</p>
                <p>• Check browser console for detailed error logs</p>
                <p>• This may be due to HEXDailyStats.com being temporarily unavailable</p>
              </div>
            </details>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-[#050312] via-[#120531] to-[#1b0f3d] text-white">
      <div className="absolute inset-0">
        <FlickeringGrid
          color="rgba(255,255,255,0.12)"
          squareSize={6}
          gridGap={10}
          maxOpacity={0.12}
          flickerChance={0.3}
          className="w-full h-full opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 font-semibold  /40 via-transparent to-slate-950 font-semibold  /40" />
      </div>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="rounded-[32px] border border-white/15 bg-white/5 shadow-[0_35px_120px_rgba(0,0,0,0.45)] backdrop-blur-[45px] p-[1px]">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-3 sm:p-4 lg:p-5 space-y-4">
            <div className="pointer-events-none absolute top-24 left-10 h-64 w-64 rounded-full bg-purple-500/20 blur-[120px]" />
            <div className="pointer-events-none absolute bottom-16 right-10 h-72 w-72 rounded-full bg-blue-500/10 blur-[120px]" />

            {/* Header */}
            <div className="mb-6">
              <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 rounded-[28px] border border-white/15 bg-white/5 px-4 sm:px-6 py-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] overflow-hidden">
                {/* Background Image - Only for PulseChain tabs */}
                {(activeTab === 'pulsechain' || activeTab === 'pulsechain-staking') && (
                  <div className="absolute inset-0 z-10 bg-gradient-to-r from-purple-600/10 via-blue-500/10 to-slate-950 font-semibold  /30">
                    <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-3xl" />
                  </div>
                )}
                
                {/* Background Image - Only for Ethereum tabs */}
                {(activeTab === 'ethereum' || activeTab === 'ethereum-staking') && (
                  <div className="absolute inset-0 z-10 bg-gradient-to-r from-blue-600/10 via-cyan-500/10 to-slate-950 font-semibold  /30">
                    <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-3xl" />
                  </div>
                )}
                
                <div className="flex items-center justify-between w-full relative z-20">
                  {/* Home Button - Far Left */}
                  <button
                    onClick={() => window.location.href = '/'}
                    className="px-4 py-1.5 text-xs sm:text-sm rounded-full border border-white/30 bg-white/10 text-white/80 hover:bg-gray-500/20 transition"
                  >
                    Home
                  </button>
                  
                  {/* Header Text - Centered */}
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-white drop-shadow-lg absolute left-1/2 transform -translate-x-1/2">
                    {activeTab === 'pulsechain' && 'PULSECHAIN'}
                    {activeTab === 'ethereum' && 'ETHEREUM'}
                {activeTab === 'ethereum-staking' && 'ETH Staking'}
                {activeTab === 'pulsechain-staking' && 'PLS Staking'}
                    {activeTab === 'sell-pressure' && 'Sell Pressure Analysis'}
              </h1>
                  
                  {/* Database Status Indicator - Far Right */}
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      databaseStatus === 'checking' ? 'bg-slate-950 font-semibold  -500 animate-pulse' :
                      databaseStatus === 'available' ? 'bg-green-500 animate-pulse' :
                      'bg-red-500'
                    }`}></div>
                    <span className={`text-xs font-medium hidden sm:inline ${
                      databaseStatus === 'checking' ? 'text-white font-semibold  -400' :
                      databaseStatus === 'available' ? 'text-green-400' :
                      'text-red-300'
                    }`}>
                      {databaseStatus === 'checking' ? 'Checking DB...' :
                       databaseStatus === 'available' ? '🗄️ Database' :
                       '📡 GraphQL Only'}
                    </span>
                    
                    {/* Data Flow Status Indicators */}
                    <div className="hidden lg:flex items-center gap-3 pl-3 border-l border-white/20">
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${
                          dataFlowStatus.ethereum === 'database' ? 'bg-green-500' :
                          dataFlowStatus.ethereum === 'graphql' ? 'bg-blue-500' :
                          dataFlowStatus.ethereum === 'transitioning' ? 'bg-slate-950 font-semibold  -500 animate-pulse' :
                          'bg-red-500'
                        }`}></div>
                        <span className="text-xs text-white/70 tracking-[0.2em]">ETH</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${
                          dataFlowStatus.pulsechain === 'database' ? 'bg-green-500' :
                          dataFlowStatus.pulsechain === 'graphql' ? 'bg-blue-500' :
                          dataFlowStatus.pulsechain === 'transitioning' ? 'bg-slate-950 font-semibold  -500 animate-pulse' :
                          'bg-red-500'
                        }`}></div>
                        <span className="text-xs text-white/70 tracking-[0.2em]">PLS</span>
                      </div>
                      
                      {/* Loading Legend */}
                      <div className="flex items-center gap-2 border-l border-white/20 pl-3">
                        <span className="text-[10px] uppercase tracking-[0.3em] text-white/50">Loading</span>
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-slate-950 font-semibold   font-bold font-bold rounded-full"></div>
                          <span className="text-xs text-white/60">Overview</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                          <span className="text-xs text-white/60">Global</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-slate-950 font-semibold   font-bold font-bold rounded-full"></div>
                          <span className="text-xs text-white/60">Stakes</span>
                        </div>
                      </div>
                    </div>
                  </div>
            </div>
            
          </div>

          {/* Network Tabs */}
          <div className="border-b border-white/10 mb-4">
            <div className="overflow-x-auto">
              <nav className="-mb-px flex w-full min-w-max">
              <button
                onClick={() => {
                  setActiveTab('pulsechain');
                  setCurrentPage(1);
                }}
                className={`py-2 sm:py-3 px-4 sm:px-6 border-b-2 font-semibold text-xs sm:text-sm tracking-[0.2em] uppercase whitespace-nowrap flex-shrink-0 transition ${
                  activeTab === 'pulsechain'
                    ? 'border-white text-white'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                <span className="hidden sm:inline">PulseChain HEX</span>
                <span className="sm:hidden">pHEX</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('ethereum');
                  setCurrentPage(1);
                }}
                className={`py-2 sm:py-3 px-4 sm:px-6 border-b-2 font-semibold text-xs sm:text-sm tracking-[0.2em] uppercase whitespace-nowrap flex-shrink-0 transition ${
                  activeTab === 'ethereum'
                    ? 'border-white text-white'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                <span className="hidden sm:inline">Ethereum HEX</span>
                <span className="sm:hidden">eHEX</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('ethereum-staking');
                  setCurrentPage(1);
                }}
                className={`py-2 sm:py-3 px-4 sm:px-6 border-b-2 font-semibold text-xs sm:text-sm tracking-[0.2em] uppercase whitespace-nowrap flex-shrink-0 transition ${
                  activeTab === 'ethereum-staking'
                    ? 'border-white text-white'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                <span className="hidden sm:inline">Ethereum HEX Staking</span>
                <span className="sm:hidden">ETH Staking</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('pulsechain-staking');
                  setCurrentPage(1);
                }}
                className={`py-2 sm:py-3 px-4 sm:px-6 border-b-2 font-semibold text-xs sm:text-sm tracking-[0.2em] uppercase whitespace-nowrap flex-shrink-0 transition ${
                  activeTab === 'pulsechain-staking'
                    ? 'border-white text-white'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                <span className="hidden sm:inline">PulseChain HEX Staking</span>
                <span className="sm:hidden">PLS Staking</span>
              </button>
                <button
                  onClick={() => {
                    setActiveTab('sell-pressure');
                    setCurrentPage(1);
                  }}
                  className={`py-2 sm:py-3 px-4 sm:px-6 border-b-2 font-semibold text-xs sm:text-sm tracking-[0.2em] uppercase whitespace-nowrap flex-shrink-0 transition ${
                    activeTab === 'sell-pressure'
                      ? 'border-white text-white'
                      : 'border-transparent text-white/50 hover:text-white'
                  }`}
                >
                  <span className="hidden sm:inline">Ending Soon</span>
                  <span className="sm:hidden">Ending Soon</span>
              </button>
            </nav>
            </div>
          </div>

          {/* Wallet Address Search */}
          <div className="mb-6 rounded-[28px] border border-white/15 bg-white/5 backdrop-blur-2xl p-4 sm:p-6 shadow-[0_25px_80px_rgba(0,0,0,0.45)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-white/5 opacity-60" />
            <div className="relative z-10">
              <h3 className="text-sm uppercase tracking-[0.4em] text-white/70 mb-3 flex items-center gap-2">
                <Search className="w-5 h-5" />
                Search Wallet Address
              </h3>
              <form onSubmit={handleSearchSubmit} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={searchAddress}
                      onChange={(e) => setSearchAddress(e.target.value)}
                      placeholder="Enter wallet address (0x...)"
                      className="w-full px-4 py-3 rounded-2xl border border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching || !searchAddress.trim()}
                    className="px-6 py-3 rounded-2xl border border-white/30 bg-white/10 text-white font-medium uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-gray-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSearching ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    {isSearching ? 'Searching…' : 'Search'}
                  </button>
                </div>
              </form>

              {searchError && (
                <div className="mt-3 p-3 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-100 text-sm">
                  {searchError}
                </div>
              )}
            </div>
          </div>

          {/* Filters */}

        </div>

                {/* Live Stats Section */}
        {!activeTab.includes('staking') && liveData ? (
          <div className="relative overflow-hidden rounded-[32px] border border-white/15 bg-white/5 backdrop-blur-2xl shadow-[0_25px_80px_rgba(0,0,0,0.45)] p-4 sm:p-6">
            {/* Background Image */}
            {activeTab === 'ethereum' && (
              <div className="absolute inset-0 -z-10 rounded-[32px] overflow-hidden">
                <img
                  src="https://dvba8d38nfde7nic.public.blob.vercel-storage.com/images/minimalhexeth"
                  alt="Ethereum Background"
                  className="w-full h-full object-cover opacity-60"
                  onError={(e) => {
                    console.error('Failed to load background image:', e);
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-slate-900/70" />
              </div>
            )}
            {activeTab === 'pulsechain' && (
              <div className="absolute inset-0 -z-10 rounded-[32px] overflow-hidden">
                <img
                  src="https://dvba8d38nfde7nic.public.blob.vercel-storage.com/images/HEX-pattern"
                  alt="PulseChain Background"
                  className="w-full h-full object-cover opacity-60"
                  onError={(e) => {
                    console.error('Failed to load PulseChain background image:', e);
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-slate-900/70" />
              </div>
            )}
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm uppercase tracking-[0.4em] text-white/70 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-950 font-semibold   font-bold font-bold animate-pulse" />
                  Live {activeTab === 'ethereum' ? 'Ethereum' : 'PulseChain'} HEX Stats
                </h3>
                <button
                  onClick={() => setIsChartModalOpen(true)}
                  className="px-4 py-2 rounded-2xl border border-white/30 bg-white/10 text-white/80 hover:bg-gray-500/20 transition"
                  title={`View ${activeTab === 'ethereum' ? 'Ethereum' : 'PulseChain'} HEX Chart`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase">
                    <BarChart3 className="w-4 h-4" />
                    View Chart
                  </div>
                </button>
              </div>
            
            {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                {[
                  {
                    label: 'HEX Price',
                    value:
                      activeTab === 'ethereum'
                        ? <NumberTicker value={liveData.price || 0} decimalPlaces={4} />
                        : <NumberTicker value={liveData.price_Pulsechain || liveData.pricePulseX || 0} decimalPlaces={4} />,
                  },
                  {
                    label: 'T-Share Price',
                    value:
                      activeTab === 'ethereum'
                        ? <NumberTicker value={liveData.tsharePrice || 0} decimalPlaces={0} />
                        : <NumberTicker value={liveData.tsharePrice_Pulsechain || 0} decimalPlaces={0} />,
                  },
                  {
                    label: 'T-Share Rate',
                    value:
                      activeTab === 'ethereum'
                        ? <NumberTicker value={liveData.tshareRateHEX || 0} decimalPlaces={0} />
                        : <NumberTicker value={liveData.tshareRateHEX_Pulsechain || 0} decimalPlaces={0} />,
                  },
                  {
                    label: 'Staked HEX',
                    value:
                      activeTab === 'ethereum'
                        ? <NumberTicker value={liveData.stakedHEX || 0} decimalPlaces={0} />
                        : <NumberTicker value={liveData.stakedHEX_Pulsechain || 0} decimalPlaces={0} />,
                  },
                  {
                    label: 'Circulating HEX',
                    value:
                      activeTab === 'ethereum'
                        ? formatNumber(liveData.circulatingHEX, 0)
                        : formatNumber(liveData.circulatingHEX_Pulsechain, 0),
                  },
                  {
                    label: 'Payout / T-Share',
                    value:
                      activeTab === 'ethereum'
                        ? <NumberTicker value={liveData.payoutPerTshare || 0} decimalPlaces={2} />
                        : <NumberTicker value={liveData.payoutPerTshare_Pulsechain || 0} decimalPlaces={2} />,
                  },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center space-y-2 shadow-inner shadow-white/5"
                  >
                    <p className="text-[10px] uppercase tracking-[0.4em] text-white/60">{metric.label}</p>
                    <div className="text-xl sm:text-2xl font-semibold text-white">{metric.value}</div>
                  </div>
                ))}
              </div>

            {/* Network-Specific Liquidity Metrics */}
              <div className="border-t border-white/10 pt-4">
                <h4 className="text-[10px] uppercase tracking-[0.4em] text-white/60 mb-3">Liquidity Metrics ({activeTab === 'ethereum' ? 'Ethereum' : 'PulseChain'})</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  {[
                    {
                      label: 'Liquidity HEX',
                      value:
                        activeTab === 'ethereum'
                          ? formatNumber(liveData.liquidityHEX, 0)
                          : formatNumber(liveData.liquidityHEX_Pulsechain, 0),
                      icon: '/HEXagon (1).svg',
                    },
                    {
                      label: activeTab === 'ethereum' ? 'Liquidity USDC' : 'Liquidity PLS',
                      value:
                        activeTab === 'ethereum'
                          ? <NumberTicker value={liveData.liquidityUSDC || 0} decimalPlaces={0} />
                          : <NumberTicker value={liveData.liquidityPLS_Pulsechain || 0} decimalPlaces={0} />,
                      icon: activeTab === 'ethereum' ? '/ethlogo.svg' : '/LogoVector.svg',
                    },
                    {
                      label: activeTab === 'ethereum' ? 'Liquidity ETH' : 'Liquidity EHEX',
                      value:
                        activeTab === 'ethereum'
                          ? <NumberTicker value={liveData.liquidityETH || 0} decimalPlaces={0} />
                          : <NumberTicker value={liveData.liquidityEHEX_Pulsechain || 0} decimalPlaces={0} />,
                      icon: activeTab === 'ethereum' ? '/ethlogo.svg' : '/HEXagon (1).svg',
                    },
                    {
                      label: 'Penalties HEX',
                      value:
                        activeTab === 'ethereum'
                          ? <NumberTicker value={liveData.penaltiesHEX || 0} decimalPlaces={0} />
                          : <NumberTicker value={liveData.penaltiesHEX_Pulsechain || 0} decimalPlaces={0} />,
                      icon: '/HEXagon (1).svg',
                    },
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center space-y-2">
                      <p className="text-xs text-white flex items-center justify-center gap-2">
                        <OptimizedImage src={metric.icon} alt={metric.label} width={12} height={12} className="w-3 h-3" />
                        {metric.label}
                      </p>
                      <div className="text-lg sm:text-xl font-semibold text-white">{metric.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
         ) : !activeTab.includes('staking') && (
            <div className="mb-6 rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-2xl p-4 sm:p-6 flex items-center justify-between">
              <h3 className="text-sm uppercase tracking-[0.4em] text-white/70 flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-slate-950 font-semibold  -400 rounded-full animate-spin" />
                Loading Live Stats
              </h3>
              <p className="text-white/60 text-sm">Fetching latest live data…</p>
            </div>
         )}

        {/* AI Analysis Section - COMMENTED OUT */}
        {/* {!activeTab.includes('staking') && currentData.length > 0 && currentData[0]?.priceUV2UV3 && (
          <div className="mb-6">
            <HexGeminiAnalysis
              dataEth={ethereumData}
              dataPls={pulsechainData}
              defaultNetwork={activeTab as 'ethereum' | 'pulsechain'}
              defaultTimeframe="all"
              concise
              // Optional: pass canonical HEX addresses for better Dex liquidity
              dexTokenAddressEth="0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39"
              dexTokenAddressPls="0x57fde0a71132198dfc1b2490b26c17fcef9601b2"
            />
          </div>
        )} */}
        {/* {!activeTab.includes('staking') && (!currentData.length || !currentData[0]?.priceUV2UV3) && (
          <div className="mb-6 p-4 bg-slate-950 font-semibold  -900/20 border border-slate-950 font-semibold  -500/50 text-white font-semibold  -300 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold  -400">⚠️</span>
              <span className="font-medium">Data Loading</span>
            </div>
            <p className="text-sm mt-1 flex items-center gap-2">
              <OptimizedImage src="/HEXagon (1).svg" alt="HEX" width={16} height={16} className="w-4 h-4" />
              Please wait for HEX data to fully load before running AI analysis. 
              Current data points: {currentData.length}
              {currentData[0] && ` | Latest price: $${currentData[0].priceUV2UV3 || 'N/A'}`}
            </p>
          </div>
        )} */}

        {/* Sell Pressure Analysis Tab */}
        {activeTab === 'sell-pressure' && (
          <div className="space-y-6">
            {/* Sell Pressure Header with Home Button */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-800">Stakes Ending Soon</h2>
              
              {/* Home Button */}
              <button
                onClick={() => window.location.href = '/'}
                className="px-3 py-1.5 text-sm text-white border border-slate-300 rounded-lg hover:border-slate-400 hover:text-slate-800 transition-colors"
              >
                Home
              </button>
            </div>
            
            {isLoadingEthereumActiveStakes || isLoadingPulsechainActiveStakes ? (
              <div className="text-center py-12">
                <RefreshCw className="w-12 h-12 animate-spin text-orange-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-slate-800 mb-2">Loading Stakes</h2>
                <p className="text-slate-800">Fetching active stakes data for analysis</p>
              </div>
            ) : (
              <SellPressureAnalysisTab
                ethereumActiveStakes={ethereumActiveStakes}
                pulsechainActiveStakes={pulsechainActiveStakes}
                ethereumPrice={liveData?.price || 0}
                pulsechainPrice={liveData?.price_Pulsechain || 0}
                ethereumHexDay={ethereumStakingData?.globalInfo ? parseInt(ethereumStakingData.globalInfo.hexDay) : 0}
                pulsechainHexDay={pulsechainStakingData?.globalInfo ? parseInt(pulsechainStakingData.globalInfo.hexDay) : 0}
                isLoadingEthereum={isLoadingEthereumActiveStakes}
                isLoadingPulsechain={isLoadingPulsechainActiveStakes}
              />
            )}
          </div>
        )}

        {/* Ethereum Staking Data Display */}
        {activeTab === 'ethereum-staking' && (
          <div className="space-y-6">
            {isLoadingEthereumStaking && (
              <div className="text-center py-12">
                <RefreshCw className="w-12 h-12 animate-spin text-white font-semibold   font-bold font-bold mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">Loading Ethereum HEX Staking Data...</h2>
                <p className="text-slate-600">Fetching data from The Graph API</p>
              </div>
            )}

            {ethereumStakingError && (
              <div className="text-center py-12">
                <div className="bg-red-900/20 border border-red-500/50 text-red-700 px-4 py-3 rounded mb-4">
                  <h2 className="font-bold text-lg mb-2">Error Loading Ethereum Staking Data</h2>
                  <p className="mb-4">{ethereumStakingError}</p>
                  
                </div>
              </div>
            )}

            {ethereumStakingData && !isLoadingEthereumStaking && !ethereumStakingError && (
              <>
                {/* Ethereum Staking Sub-Tabs */}
                <div className="border-b border-white/10 mb-6">
                  <div className="overflow-x-auto">
                    <nav className="-mb-px flex min-w-max">
                    <button
                      onClick={() => setEthereumStakingSubTab('overview')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm flex-shrink-0 ${
                        ethereumStakingSubTab === 'overview'
                            ? 'border-blue-500 text-white font-semibold  '
                            : 'border-transparent text-white hover:text-white'
                      }`}
                    >
                      Overview & Top Stakes
                    </button>
                    <button
                      onClick={() => {
                        setEthereumStakingSubTab('all-stakes');
                        if (ethereumAllStakeStarts.length === 0) {
                          loadEthereumStakeStarts();
                        }
                      }}
                        className={`py-2 px-1 border-b-2 font-medium text-sm flex-shrink-0 ${
                        ethereumStakingSubTab === 'all-stakes'
                            ? 'border-blue-500 text-white font-semibold  '
                            : 'border-transparent text-white hover:text-white'
                      }`}
                    >
                      All Stake Starts
                    </button>
                    <button
                      onClick={() => {
                        setEthereumStakingSubTab('active-stakes');
                        if (ethereumActiveStakes.length === 0) {
                          loadEthereumActiveStakes();
                        }
                      }}
                        className={`py-2 px-1 border-b-2 font-medium text-sm flex-shrink-0 ${
                        ethereumStakingSubTab === 'active-stakes'
                            ? 'border-blue-500 text-white font-semibold  '
                            : 'border-transparent text-white hover:text-white'
                      }`}
                    >
                      Active Stakes
                    </button>
                    <button
                      onClick={() => setEthereumStakingSubTab('ai-timing')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm flex-shrink-0 ${
                        ethereumStakingSubTab === 'ai-timing'
                            ? 'border-blue-500 text-white font-semibold  '
                            : 'border-transparent text-white hover:text-white'
                      }`}
                    >
                      AI Timing
                    </button>
                  </nav>
                  </div>
                </div>

                {ethereumStakingSubTab === 'overview' && (
                  <>
                    {/* Ethereum Staking Overview Metrics */}
                <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 sm:rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] p-3 sm:p-6 relative overflow-hidden">
                  {/* Background Image - Ethereum Staking */}
                  <div className="absolute inset-0 -z-10">
                    <img 
                      src="https://dvba8d38nfde7nic.public.blob.vercel-storage.com/images/minimalhexeth" 
                      alt="ETH HEX Staking Background" 
                      className="w-full h-full object-cover opacity-100"
                      onError={(e) => {
                        console.error('Failed to load staking background image:', e);
                        console.error('Image path attempted:', 'https://dvba8d38nfde7nic.public.blob.vercel-storage.com/images/minimalhexeth');
                        e.currentTarget.style.display = 'none';
                      }}
                      onLoad={(e) => {
                        console.log('Staking background image loaded successfully');
                        console.log('Image dimensions:', e.currentTarget.naturalWidth, 'x', e.currentTarget.naturalHeight);
                      }}
                      style={{ 
                        display: 'block',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%'
                      }}
                    />
                    {/* slate-950 font-semibold   font-bold font-bold overlay for better text contrast */}
                    <div className="absolute inset-0 bg-slate-900"></div>
                  </div>
                  
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Lock className="w-5 h-5" />
                      Ethereum HEX Staking Overview
                    </h3>

                      {/* Data Flow Status Indicator */}
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          dataFlowStatus.ethereum === 'transitioning' ? 'bg-slate-950 font-semibold  -500 animate-pulse' :
                          dataFlowStatus.ethereum === 'database' ? 'bg-green-500' :
                          dataFlowStatus.ethereum === 'graphql' ? 'bg-blue-500' :
                          'bg-red-500'
                        }`}></div>
                        <span className={`text-xs font-medium ${
                          dataFlowStatus.ethereum === 'transitioning' ? 'text-white font-semibold  -400' :
                          dataFlowStatus.ethereum === 'database' ? 'text-green-400' :
                          dataFlowStatus.ethereum === 'graphql' ? 'text-white font-semibold  ' :
                          'text-red-400'
                        }`}>
                          {dataFlowStatus.ethereum === 'transitioning' ? '🔄 Transitioning...' :
                           dataFlowStatus.ethereum === 'database' ? '🗄️ Database' :
                           dataFlowStatus.ethereum === 'graphql' ? '📡 GraphQL API' :
                           '❌ Error'}
                        </span>
                        
                        {/* Database Loading Indicators */}
                        <div className="flex items-center gap-1 ml-2">
                          {isDatabaseLoading('ethereum', 'overview') && (
                            <div className="w-1.5 h-1.5 bg-slate-950 font-semibold   font-bold font-bold rounded-full animate-pulse"></div>
                          )}
                          {isDatabaseLoading('ethereum', 'global') && (
                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                          )}
                          {isDatabaseLoading('ethereum', 'stakes') && (
                            <div className="w-1.5 h-1.5 bg-slate-950 font-semibold   font-bold font-bold rounded-full animate-pulse"></div>
                          )}
                        </div>
                      </div>

                      {/* Home Button */}
                      <button
                        onClick={() => window.location.href = '/'}
                        className="px-3 py-1.5 text-sm text-white border border-white/30 rounded-lg hover:border-white/50 hover:text-white/90 transition-colors"
                      >
                        Home
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4">
                      <div className="text-2xl font-bold text-white font-semibold  ">
                        {ethereumStakingData.globalInfo?.latestStakeId ? (
                          <NumberTicker value={parseInt(ethereumStakingData.globalInfo.latestStakeId)} decimalPlaces={0} />
                        ) : 'N/A'}
                      </div>
                      <div className="text-sm text-white">Latest Stake ID</div>
                    </div>
                    <div className="text-center p-4">
                      <div className="text-2xl font-bold text-white font-semibold  ">
                        <NumberTicker value={ethereumStakingData.totalActiveStakes} decimalPlaces={0} />
                      </div>
                      <div className="text-sm text-white">Active Stakes</div>
                    </div>
                    <div className="text-center p-4">
                      <div className="text-2xl font-bold text-white font-semibold  ">
                        {hexStakingService.formatHexAmount(ethereumStakingData.totalStakedHearts)} HEX
                      </div>
                      <div className="text-sm text-white">Total Staked</div>
                    </div>
                    <div className="text-center p-4">
                      <div className="text-2xl font-bold text-white font-semibold  ">
                        {hexStakingService.formatStakeLength(Math.round(ethereumStakingData.averageStakeLength))}
                      </div>
                      <div className="text-sm text-white">Avg Stake Length</div>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-white/20 pt-4">
                    <h4 className="text-md font-semibold text-white mb-3">Ethereum Protocol Global Metrics</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3">
                        <div className="text-lg font-bold text-white font-semibold  ">
                          {ethereumStakingData.globalInfo ? hexStakingService.formatHexAmount(ethereumStakingData.globalInfo.stakeSharesTotal) : 'N/A'}
                        </div>
                        <div className="text-xs text-white">Stake Shares Total</div>
                      </div>
                      <div className="text-center p-3">
                        <div className="text-lg font-bold text-white font-semibold  -300">
                          {ethereumStakingData.globalInfo?.hexDay ? (
                            <NumberTicker value={parseInt(ethereumStakingData.globalInfo.hexDay)} decimalPlaces={0} />
                          ) : 'N/A'}
                        </div>
                        <div className="text-xs text-white">Current HEX Day</div>
                      </div>
                      <div className="text-center p-3">
                        <div className="text-lg font-bold text-white font-semibold  ">
                          {ethereumStakingData.globalInfo ? hexStakingService.formatHexAmount(ethereumStakingData.globalInfo.lockedHeartsTotal) : 'N/A'} HEX
                        </div>
                        <div className="text-xs text-white">Locked Hearts Total</div>
                      </div>
                      <div className="text-center p-3">
                        <div className="text-lg font-bold text-white font-semibold  ">
                          {ethereumStakingData.globalInfo ? hexStakingService.formatHexAmount(ethereumStakingData.globalInfo.stakePenaltyTotal) : 'N/A'} HEX
                        </div>
                        <div className="text-xs text-white">Penalties Total</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ethereum Top Stakes Visual Display */}
                <TopStakesVisual 
                  stakes={ethereumStakingData.topStakes} 
                  hexPrice={liveData?.price || 0}
                />


                  </>
                )}

                {ethereumStakingSubTab === 'ai-timing' && (
                  <EndstakeTimingAI 
                    ethereumPrice={liveData?.price || 0}
                    pulsechainPrice={liveData?.price_Pulsechain || 0}
                  />
                )}

                {ethereumStakingSubTab === 'all-stakes' && (
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 sm:rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
                    <div className="flex items-center justify-between px-3 sm:px-6 py-4 border-b border-white/10">
                      <div>
                        <h4 className="text-lg font-semibold text-white font-semibold   font-bold font-bold flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          All Ethereum HEX Stake Start Events
                        </h4>
                        <p className="text-sm text-white font-semibold   font-bold font-bold mt-1">
                          All Ethereum HEX stake start events from The Graph API
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-white font-semibold  ">
                          {ethereumAllStakeStarts.length.toLocaleString()} total stakes
                        </div>
                      </div>
                    </div>

                    {isLoadingEthereumAllStakes && (
                      <div className="text-center py-12">
                        <RefreshCw className="w-8 h-8 animate-spin text-white font-semibold   font-bold font-bold mx-auto mb-4" />
                        <p className="text-white">Loading all Ethereum stake starts...</p>
                        <p className="text-white text-sm">Fetching from The Graph API...</p>
                      </div>
                    )}

                    {!isLoadingEthereumAllStakes && ethereumAllStakeStarts.length > 0 && (
                      <div className="overflow-auto max-h-[70vh]">
                        <table className="min-w-full divide-y divide-slate-950 font-semibold  ">
                          <thead className="bg-slate-950 font-semibold   font-bold font-bold border border-slate-550/70 sticky top-0">
                            <tr>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handleEthereumStakeStartsSort('stakeId')}
                              >
                                <div className="flex items-center gap-1">
                                  Stake ID
                                  {ethereumStakeStartsSortField === 'stakeId' ? (
                                    ethereumStakeStartsSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">Staker Address</th>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handleEthereumStakeStartsSort('stakedHearts')}
                              >
                                <div className="flex items-center gap-1">
                                  Staked Hearts
                                  {ethereumStakeStartsSortField === 'stakedHearts' ? (
                                    ethereumStakeStartsSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">Stake Shares</th>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handleEthereumStakeStartsSort('stakedDays')}
                              >
                                <div className="flex items-center gap-1">
                                  Staked Days
                                  {ethereumStakeStartsSortField === 'stakedDays' ? (
                                    ethereumStakeStartsSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handleEthereumStakeStartsSort('startDay')}
                              >
                                <div className="flex items-center gap-1">
                                  Start Day
                                  {ethereumStakeStartsSortField === 'startDay' ? (
                                    ethereumStakeStartsSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handleEthereumStakeStartsSort('endDay')}
                              >
                                <div className="flex items-center gap-1">
                                  End Day
                                  {ethereumStakeStartsSortField === 'endDay' ? (
                                    ethereumStakeStartsSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handleEthereumStakeStartsSort('stakeTShares')}
                              >
                                <div className="flex items-center gap-1">
                                  T-Shares
                                  {ethereumStakeStartsSortField === 'stakeTShares' ? (
                                    ethereumStakeStartsSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handleEthereumStakeStartsSort('timestamp')}
                              >
                                <div className="flex items-center gap-1">
                                  Timestamp
                                  {ethereumStakeStartsSortField === 'timestamp' ? (
                                    ethereumStakeStartsSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">Transaction</th>
                            </tr>
                          </thead>
                          <tbody className="bg-transparent divide-y divide-gray-200">
                            {getSortedEthereumStakeStarts().slice(0, 500).map((stake, index) => (
                              <tr key={stake.id} className="hover:bg-gray-100">
                                <td className="px-3 py-4 whitespace-nowrap text-sm font-medium slate-950 font-semibold ">
                                  {stake.stakeId}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold   font-bold font-bold font-mono">
                                  <a
                                    href={`https://etherscan.io/address/${stake.stakerAddr}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-white font-semibold   font-bold font-bold transition-colors"
                                    title={stake.stakerAddr}
                                  >
                                    {stake.stakerAddr.slice(0, 10)}...{stake.stakerAddr.slice(-8)}
                                  </a>
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold   font-bold font-bold font-semibold">
                                  {hexStakingService.formatHexAmount(stake.stakedHearts)} HEX
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                                  {hexStakingService.formatHexAmount(stake.stakeShares)}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                                  {hexStakingService.formatStakeLength(parseInt(stake.stakedDays))}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                                  Day {stake.startDay}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                                  Day {stake.endDay}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                                  {hexStakingService.formatTShareAmount(stake.stakeTShares)}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-white">
                                  {new Date(parseInt(stake.timestamp) * 1000).toLocaleDateString()}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-mono">
                                  <a
                                    href={`https://etherscan.io/tx/${stake.transactionHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-blue-500 transition-colors"
                                    title={stake.transactionHash}
                                  >
                                    {stake.transactionHash.slice(0, 8)}...
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        
                        {ethereumAllStakeStarts.length > 500 && (
                          <div className="px-3 sm:px-6 py-4 border-t border-white/10 text-center text-slate-600">
                            Showing first 500 of {ethereumAllStakeStarts.length.toLocaleString()} Ethereum stakes
                            <br />
                            <span className="text-xs">Full dataset loaded in memory for analysis</span>
                          </div>
                        )}
                      </div>
                    )}


                  </div>
                )}

                {ethereumStakingSubTab === 'active-stakes' && (
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 sm:rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
                    <div className="flex items-center justify-between px-3 sm:px-6 py-4 border-b border-white/10">
                      <div>
                        <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          All Ethereum Active HEX Stakes (Not Ended)
                        </h4>
                        <p className="text-sm text-white mt-1">
                          Ethereum stakes that have started but not yet ended or been emergency ended
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-white">
                          {ethereumActiveStakes.length.toLocaleString()} active stakes
                        </div>

                      </div>
                    </div>

                    {isLoadingEthereumActiveStakes && (
                      <div className="text-center py-12">
                        <RefreshCw className="w-8 h-8 animate-spin text-white font-semibold   font-bold font-bold mx-auto mb-4" />
                        <p className="text-white font-semibold  ">Loading all Ethereum active stakes...</p>
                        <p className="text-slate-600 text-sm">Cross-referencing starts vs ends...</p>
                        <p className="text-slate-600 text-xs mt-2">This process fetches all stake starts and ends to determine which are still active</p>
                      </div>
                    )}

                    {!isLoadingEthereumActiveStakes && ethereumActiveStakes.length > 0 && (
                      <div className="overflow-auto max-h-[70vh]">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-800/60 border border-gray-300 sticky top-0">
                            <tr>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handleEthereumActiveStakesSort('stakeId')}
                              >
                                <div className="flex items-center gap-1">
                                  Stake ID
                                  {ethereumActiveStakesSortField === 'stakeId' ? (
                                    ethereumActiveStakesSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white ">Staker Address</th>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handleEthereumActiveStakesSort('stakedHearts')}
                              >
                                <div className="flex items-center gap-1">
                                  Staked HEX
                                  {ethereumActiveStakesSortField === 'stakedHearts' ? (
                                    ethereumActiveStakesSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">T-Shares</th>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handleEthereumActiveStakesSort('stakedDays')}
                              >
                                <div className="flex items-center gap-1">
                                  Staked Days
                                  {ethereumActiveStakesSortField === 'stakedDays' ? (
                                    ethereumActiveStakesSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handleEthereumActiveStakesSort('startDay')}
                              >
                                <div className="flex items-center gap-1">
                                  Start Day
                                  {ethereumActiveStakesSortField === 'startDay' ? (
                                    ethereumActiveStakesSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handleEthereumActiveStakesSort('endDay')}
                              >
                                <div className="flex items-center gap-1">
                                  End Day
                                  {ethereumActiveStakesSortField === 'endDay' ? (
                                    ethereumActiveStakesSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handleEthereumActiveStakesSort('progress')}
                              >
                                <div className="flex items-center gap-1">
                                  Progress
                                  {ethereumActiveStakesSortField === 'progress' ? (
                                    ethereumActiveStakesSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handleEthereumActiveStakesSort('stakeTShares')}
                              >
                                <div className="flex items-center gap-1">
                                  T-Shares
                                  {ethereumActiveStakesSortField === 'stakeTShares' ? (
                                    ethereumActiveStakesSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handleEthereumActiveStakesSort('timestamp')}
                              >
                                <div className="flex items-center gap-1">
                                  Timestamp
                                  {ethereumActiveStakesSortField === 'timestamp' ? (
                                    ethereumActiveStakesSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">Transaction</th>
                            </tr>
                          </thead>
                          <tbody className="bg-transparent divide-y divide-gray-200">
                            {getPaginatedEthereumActiveStakes().map((stake, index) => {
                              const progress = (stake.daysServed || 0) / parseInt(stake.stakedDays || '1') * 100;
                              const isNearEnd = (stake.daysLeft || 0) <= 30;
                              const isOverdue = (stake.daysLeft || 0) < 0;
                              
                              return (
                                <tr key={stake.id} className="hover:bg-gray-100">
                                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-white">
                                    {stake.stakeId}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-mono">
                                    <button
                                      onClick={() => handleEthereumStakerClick(stake.stakerAddr)}
                                      className="hover:text-white font-semibold   font-bold font-bold transition-colors cursor-pointer underline decoration-slate-950 font-semibold  /60 decoration-2 underline-offset-2"
                                      title={`${stake.stakerAddr} - Click to view staking history`}
                                    >
                                      {stake.stakerAddr.slice(0, 10)}...{stake.stakerAddr.slice(-8)}
                                    </button>
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold   font-bold font-bold font-semibold">
                                    {hexStakingService.formatHexAmount(stake.stakedHearts)} HEX
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                                    {hexStakingService.formatTShareAmount(stake.stakeTShares)}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                                    {hexStakingService.formatStakeLength(parseInt(stake.stakedDays))}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                                    {stake.daysServed ? stake.daysServed.toLocaleString() : '0'} days
                                  </td>
                                  <td className={`px-3 py-4 whitespace-nowrap text-sm font-semibold ${
                                    isOverdue ? 'text-red-400' : isNearEnd ? 'text-white font-semibold  ' : 'text-white font-semibold  '
                                  }`}>
                                    {isOverdue ? `${Math.abs(stake.daysLeft || 0)} overdue` : `${stake.daysLeft || 0} days`}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm">
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 bg-white rounded-full h-2">
                                        <div 
                                          className={`h-2 rounded-full transition-all duration-300 ${
                                            isOverdue ? 'bg-red-500' : progress > 90 ? 'bg-slate-950 font-semibold  -500' : 'bg-green-600'
                                          }`}
                                          style={{ width: `${Math.min(100, progress)}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-slate-600">
                                        {progress.toFixed(1)}%
                                      </span>
                                    </div>
                                    {progress > 100 && (
                                      <div className="text-xs text-red-500 mt-1">
                                        {Math.round(progress - 100)} days over
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                                    Day {stake.endDay}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-400">
                                    {new Date(parseInt(stake.timestamp) * 1000).toLocaleDateString()}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                                    <a
                                      href={`https://etherscan.io/tx/${stake.transactionHash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:text-white font-semibold   font-bold font-bold transition-colors"
                                      title={stake.transactionHash}
                                    >
                                      {stake.transactionHash.slice(0, 8)}...
                                    </a>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        
                        {(() => {
                          const paginationInfo = getEthereumActiveStakesPaginationInfo();
                          return (
                            <div className="px-3 sm:px-6 py-4 border-t border-white/10">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 flex justify-between sm:hidden">
                                  <button
                                    onClick={() => setEthereumActiveStakesCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={!paginationInfo.hasPrevPage}
                                    className="relative inline-flex items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md text-slate-300 bg-slate-900 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Previous
                                  </button>
                                  <button
                                    onClick={() => setEthereumActiveStakesCurrentPage(prev => Math.min(prev + 1, paginationInfo.totalPages))}
                                    disabled={!paginationInfo.hasNextPage}
                                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md text-slate-300 bg-slate-900 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Next
                                  </button>
                          </div>
                                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                  <div>
                                    <p className="text-sm text-slate-300">
                                      Showing <span className="font-medium">{paginationInfo.startIndex}</span> to{' '}
                                      <span className="font-medium">{paginationInfo.endIndex}</span> of{' '}
                                      <span className="font-medium">{paginationInfo.totalStakes.toLocaleString()}</span> Ethereum active stakes
                                    </p>
                                  </div>
                                  <div>
                                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                                      <button
                                        onClick={() => setEthereumActiveStakesCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={!paginationInfo.hasPrevPage}
                                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-600 bg-slate-900 text-sm font-medium text-slate-300 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        Previous
                                      </button>
                                      {Array.from({ length: Math.min(5, paginationInfo.totalPages) }, (_, i) => {
                                        let pageNum;
                                        if (paginationInfo.totalPages <= 5) {
                                          pageNum = i + 1;
                                        } else {
                                          const startPage = Math.max(1, Math.min(paginationInfo.currentPage - 2, paginationInfo.totalPages - 4));
                                          pageNum = startPage + i;
                                        }
                                        return (
                                          <button
                                            key={i}
                                            onClick={() => setEthereumActiveStakesCurrentPage(pageNum)}
                                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                              paginationInfo.currentPage === pageNum
                                                ? 'z-10 bg-slate-900/50 border-blue-500 text-white font-semibold  '
                                                : 'bg-slate-900 border-slate-600 text-slate-300 hover:bg-gray-500'
                                            }`}
                                          >
                                            {pageNum}
                                          </button>
                                        );
                                      })}
                                      <button
                                        onClick={() => setEthereumActiveStakesCurrentPage(prev => Math.min(prev + 1, paginationInfo.totalPages))}
                                        disabled={!paginationInfo.hasNextPage}
                                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-600 bg-slate-900 text-sm font-medium text-slate-300 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        Next
                                      </button>
                                    </nav>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* PulseChain Staking Data Display */}
        {activeTab === 'pulsechain-staking' && (
          <div className="space-y-6">
            {isLoadingPulsechainStaking && (
              <div className="text-center py-12">
                <RefreshCw className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold slate-950 font-semibold  mb-2">Loading PulseChain HEX Staking Data...</h2>
                <p className="text-slate-400">Fetching data from The Graph API</p>
              </div>
            )}

            {pulsechainStakingError && (
              <div className="text-center py-12">
                <div className="bg-red-900/20 border border-red-500/50 text-red-300 px-4 py-3 rounded mb-4">
                  <h2 className="font-bold text-lg mb-2">Error Loading PulseChain Staking Data</h2>
                  <p className="mb-4">{pulsechainStakingError}</p>
                  
                </div>
              </div>
            )}

            {pulsechainStakingData && !isLoadingPulsechainStaking && !pulsechainStakingError && (
              <>
                {/* PulseChain Staking Sub-Tabs */}
                <div className="border-b border-white/10 mb-6">
                  <div className="overflow-x-auto">
                    <nav className="-mb-px flex min-w-max">
                    <button
                      onClick={() => setPulsechainStakingSubTab('overview')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm flex-shrink-0 ${
                        pulsechainStakingSubTab === 'overview'
                          ? 'border-blue-500 text-white font-semibold  '
                            : 'border-transparent text-slate-500 hover:text-white font-semibold  '
                      }`}
                    >
                      Overview & Top Stakes
                    </button>
                    <button
                      onClick={() => {
                        setPulsechainStakingSubTab('all-stakes');
                        if (pulsechainAllStakeStarts.length === 0) {
                          loadPulsechainStakeStarts();
                        }
                      }}
                        className={`py-2 px-1 border-b-2 font-medium text-sm flex-shrink-0 ${
                        pulsechainStakingSubTab === 'all-stakes'
                          ? 'border-blue-500 text-white font-semibold  '
                            : 'border-transparent text-slate-500 hover:text-white font-semibold  '
                      }`}
                    >
                      All Stake Starts
                    </button>
                    <button
                      onClick={() => {
                        setPulsechainStakingSubTab('active-stakes');
                        if (pulsechainActiveStakes.length === 0) {
                          loadPulsechainActiveStakes();
                        }
                      }}
                        className={`py-2 px-1 border-b-2 font-medium text-sm flex-shrink-0 ${
                        pulsechainStakingSubTab === 'active-stakes'
                          ? 'border-blue-500 text-white font-semibold  '
                            : 'border-transparent text-slate-500 hover:text-white font-semibold  '
                      }`}
                    >
                      Active Stakes
                    </button>
                    <button
                      onClick={() => setPulsechainStakingSubTab('ai-timing')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm flex-shrink-0 ${
                        pulsechainStakingSubTab === 'ai-timing'
                          ? 'border-blue-500 text-white font-semibold  '
                            : 'border-transparent text-slate-500 hover:text-white font-semibold  '
                      }`}
                    >
                      AI Timing
                    </button>
                  </nav>
                  </div>
                </div>

                {pulsechainStakingSubTab === 'overview' && (
                  <>
                    {/* PulseChain Staking Overview Metrics */}
                <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 sm:rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] p-3 sm:p-6 relative overflow-hidden">
                  {/* Background Image - PulseChain Staking */}
                  <div className="absolute inset-0 -z-10">
                    <img 
                      src="https://dvba8d38nfde7nic.public.blob.vercel-storage.com/images/HEX-pattern" 
                      alt="PLS HEX Staking Background" 
                      className="w-full h-full object-cover opacity-100"
                      onError={(e) => {
                        console.error('Failed to load PulseChain staking background image:', e);
                        console.error('Image path attempted:', 'https://dvba8d38nfde7nic.public.blob.vercel-storage.com/images/HEX-pattern');
                        e.currentTarget.style.display = 'none';
                      }}
                      onLoad={(e) => {
                        console.log('PulseChain staking background image loaded successfully');
                        console.log('Image dimensions:', e.currentTarget.naturalWidth, 'x', e.currentTarget.naturalHeight);
                      }}
                      style={{ 
                        display: 'block',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%'
                      }}
                    />
                    {/* slate-950 font-semibold   font-bold font-bold overlay for better text contrast */}
                    <div className="absolute inset-0 bg-white/10"></div>
                  </div>
                  
                  <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <Lock className="w-5 h-5" />
                      PulseChain HEX Staking Overview
                    </h3>

                        {/* Data Flow Status Indicator */}
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            dataFlowStatus.pulsechain === 'transitioning' ? 'bg-slate-950 font-semibold  -500 animate-pulse' :
                            dataFlowStatus.pulsechain === 'database' ? 'bg-green-500' :
                            dataFlowStatus.pulsechain === 'graphql' ? 'bg-blue-500' :
                            'bg-red-500'
                          }`}></div>
                          <span className={`text-xs font-medium ${
                            dataFlowStatus.pulsechain === 'transitioning' ? 'text-white font-semibold  -400' :
                            dataFlowStatus.pulsechain === 'graphql' ? 'text-white font-semibold  ' :
                            dataFlowStatus.pulsechain === 'database' ? 'text-green-400' :
                            'text-red-400'
                          }`}>
                            {dataFlowStatus.pulsechain === 'transitioning' ? '🔄 Transitioning...' :
                             dataFlowStatus.pulsechain === 'database' ? '🗄️ Database' :
                             dataFlowStatus.pulsechain === 'graphql' ? '📡 GraphQL API' :
                             '❌ Error'}
                          </span>
                          
                          {/* Database Loading Indicators */}
                          <div className="flex items-center gap-1 ml-2">
                            {isDatabaseLoading('pulsechain', 'overview') && (
                              <div className="w-1.5 h-1.5 bg-slate-950 font-semibold   font-bold font-bold rounded-full animate-pulse"></div>
                            )}
                            {isDatabaseLoading('pulsechain', 'global') && (
                              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                            )}
                            {isDatabaseLoading('pulsechain', 'stakes') && (
                              <div className="w-1.5 h-1.5 bg-slate-950 font-semibold   font-bold font-bold rounded-full animate-pulse"></div>
                            )}
                          </div>
                        </div>

                        {/* Home Button */}
                        <button
                          onClick={() => window.location.href = '/'}
                          className="px-3 py-1.5 text-sm text-white border border-white/30 rounded-lg hover:border-white/50 hover:text-white/90 transition-colors"
                        >
                          Home
                        </button>
                      </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4">
                      <div className="text-2xl font-bold text-blue-300">
                        {pulsechainStakingData.globalInfo?.latestStakeId ? (
                          <NumberTicker value={parseInt(pulsechainStakingData.globalInfo.latestStakeId)} decimalPlaces={0} />
                        ) : 'N/A'}
                      </div>
                      <div className="text-md text-white">Latest Stake ID</div>
                    </div>
                    <div className="text-center p-4">
                      <div className="text-2xl font-bold text-blue-300">
                        <NumberTicker value={pulsechainStakingData.totalActiveStakes} decimalPlaces={0} />
                      </div>
                      <div className="text-md text-white">Active Stakes</div>
                    </div>
                    <div className="text-center p-4">
                      <div className="text-2xl font-bold text-green-300">
                        {pulsechainHexStakingService.formatHexAmount(pulsechainStakingData.totalStakedHearts)} HEX
                      </div>
                      <div className="text-md text-white">Total Staked</div>
                    </div>
                    <div className="text-center p-4">
                      <div className="text-2xl font-bold text-orange-300">
                        {pulsechainHexStakingService.formatStakeLength(Math.round(pulsechainStakingData.averageStakeLength))}
                      </div>
                      <div className="text-md text-white">Avg Stake Length</div>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-white/20 pt-4">
                    <h4 className="text-md font-semibold text-white mb-3">PulseChain Protocol Global Metrics</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3">
                        <div className="text-lg font-bold text-blue-300">
                          {pulsechainStakingData.globalInfo ? pulsechainHexStakingService.formatHexAmount(pulsechainStakingData.globalInfo.stakeSharesTotal) : 'N/A'}
                        </div>
                        <div className="text-md text-white">Stake Shares Total</div>
                      </div>
                      <div className="text-center p-3">
                        <div className="text-lg font-bold text-white font-semibold  -300">
                          {pulsechainStakingData.globalInfo?.hexDay ? (
                            <NumberTicker value={parseInt(pulsechainStakingData.globalInfo.hexDay)} decimalPlaces={0} />
                          ) : 'N/A'}
                        </div>
                        <div className="text-md text-white">Current HEX Day</div>
                      </div>
                      <div className="text-center p-3">
                        <div className="text-lg font-bold text-emerald-300">
                          {pulsechainStakingData.globalInfo ? pulsechainHexStakingService.formatHexAmount(pulsechainStakingData.globalInfo.lockedHeartsTotal) : 'N/A'} HEX
                        </div>
                        <div className="text-md text-white">Locked HEX Total</div>
                      </div>
                      <div className="text-center p-3">
                        <div className="text-lg font-bold text-red-300">
                          {pulsechainStakingData.globalInfo ? pulsechainHexStakingService.formatHexAmount(pulsechainStakingData.globalInfo.stakePenaltyTotal) : 'N/A'} HEX
                        </div>
                        <div className="text-md text-white">Penalties Today</div>
                      </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PulseChain Top Stakes Visual Display */}
                <TopStakesVisual 
                  stakes={pulsechainStakingData.topStakes} 
                  hexPrice={liveData?.price_Pulsechain || liveData?.pricePulseX || 0}
                />


                  </>
                )}

                {pulsechainStakingSubTab === 'ai-timing' && (
                  <EndstakeTimingAI 
                    ethereumPrice={liveData?.price || 0}
                    pulsechainPrice={liveData?.price_Pulsechain || 0}
                  />
                )}

                {pulsechainStakingSubTab === 'all-stakes' && (
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 sm:rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
                    <div className="flex items-center justify-between px-3 sm:px-6 py-4 border-b border-white/10">
                      <div>
                        <h4 className="text-lg font-semibold slate-950 font-semibold  flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          All PulseChain HEX Stake Start Events
                        </h4>
                        <p className="text-sm text-slate-400 mt-1">
                          All PulseChain HEX stake start events from The Graph API
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-slate-400">
                          {pulsechainAllStakeStarts.length.toLocaleString()} total stakes
                        </div>
                      </div>
                    </div>

                    {isLoadingPulsechainAllStakes && (
                      <div className="text-center py-12">
                        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
                        <p className="slate-950 font-semibold ">Loading all PulseChain stake starts...</p>
                        <p className="text-slate-400 text-sm">Fetching from The Graph API...</p>
                      </div>
                    )}

                    {!isLoadingPulsechainAllStakes && pulsechainAllStakeStarts.length > 0 && (
                      <div className="overflow-auto max-h-[70vh]">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-800/60 border border-gray-300 sticky top-0">
                            <tr>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handlePulsechainStakeStartsSort('stakeId')}
                              >
                                <div className="flex items-center gap-1">
                                  Stake ID
                                  {pulsechainStakeStartsSortField === 'stakeId' ? (
                                    pulsechainStakeStartsSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">Staker Address</th>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handlePulsechainStakeStartsSort('stakedHearts')}
                              >
                                <div className="flex items-center gap-1">
                                  Staked Hearts
                                  {pulsechainStakeStartsSortField === 'stakedHearts' ? (
                                    pulsechainStakeStartsSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">Stake Shares</th>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handlePulsechainStakeStartsSort('stakedDays')}
                              >
                                <div className="flex items-center gap-1">
                                  Staked Days
                                  {pulsechainStakeStartsSortField === 'stakedDays' ? (
                                    pulsechainStakeStartsSortField === 'stakedDays' ? (
                                      pulsechainStakeStartsSortDirection === 'desc' ? '↓' : '↑'
                                    ) : '↕'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handlePulsechainStakeStartsSort('startDay')}
                              >
                                <div className="flex items-center gap-1">
                                  Start Day
                                  {pulsechainStakeStartsSortField === 'startDay' ? (
                                    pulsechainStakeStartsSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handlePulsechainStakeStartsSort('endDay')}
                              >
                                <div className="flex items-center gap-1">
                                  End Day
                                  {pulsechainStakeStartsSortField === 'endDay' ? (
                                    pulsechainStakeStartsSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handlePulsechainStakeStartsSort('stakeTShares')}
                              >
                                <div className="flex items-center gap-1">
                                  T-Shares
                                  {pulsechainStakeStartsSortField === 'stakeTShares' ? (
                                    pulsechainStakeStartsSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handlePulsechainStakeStartsSort('timestamp')}
                              >
                                <div className="flex items-center gap-1">
                                  Timestamp
                                  {pulsechainStakeStartsSortField === 'timestamp' ? (
                                    pulsechainStakeStartsSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">Transaction</th>
                            </tr>
                          </thead>
                          <tbody className="bg-transparent divide-y divide-gray-200">
                            {getSortedPulsechainStakeStarts().slice(0, 500).map((stake, index) => (
                              <tr key={stake.id} className="hover:bg-gray-100">
                                <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-white">
                                  {stake.stakeId}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-300 font-mono">
                                  <a
                                    href={`https://scan.pulsechain.com/address/${stake.stakerAddr}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-white font-semibold   font-bold font-bold transition-colors"
                                    title={stake.stakerAddr}
                                  >
                                    {stake.stakerAddr.slice(0, 10)}...{stake.stakerAddr.slice(-8)}
                                  </a>
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold   font-bold font-bold font-semibold">
                                  {pulsechainHexStakingService.formatHexAmount(stake.stakedHearts)} HEX
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                                  {pulsechainHexStakingService.formatHexAmount(stake.stakeShares)}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                                  {pulsechainHexStakingService.formatStakeLength(parseInt(stake.stakedDays))}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                                  {stake.daysServed ? stake.daysServed.toLocaleString() : '0'} days
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                                  Day {stake.endDay}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  -400">
                                  {pulsechainHexStakingService.formatTShareAmount(stake.stakeTShares)}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-400">
                                  {new Date(parseInt(stake.timestamp) * 1000).toLocaleDateString()}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                                  <a
                                    href={`https://scan.pulsechain.com/tx/${stake.transactionHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-white font-semibold   font-bold font-bold transition-colors"
                                    title={stake.transactionHash}
                                  >
                                    {stake.transactionHash.slice(0, 8)}...
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        
                        {pulsechainAllStakeStarts.length > 500 && (
                          <div className="px-3 sm:px-6 py-4 border-t border-white/10 text-center text-slate-400">
                            Showing first 500 of {pulsechainAllStakeStarts.length.toLocaleString()} PulseChain stakes
                            <br />
                            <span className="text-xs">Full dataset loaded in memory for analysis</span>
                          </div>
                        )}
                      </div>
                    )}


                  </div>
                )}

                {pulsechainStakingSubTab === 'active-stakes' && (
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 sm:rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
                    <div className="flex items-center justify-between px-3 sm:px-6 py-4 border-b border-white/10">
                      <div>
                        <h4 className="text-lg font-semibold slate-950 font-semibold  flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          All PulseChain Active HEX Stakes (Not Ended)
                        </h4>
                        <p className="text-sm text-slate-600 mt-1">
                          PulseChain stakes that have started but not yet ended or been emergency ended
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-slate-600">
                          {pulsechainActiveStakes.length.toLocaleString()} active stakes
                        </div>
                      </div>
                    </div>

                    {isLoadingPulsechainActiveStakes && (
                      <div className="text-center py-12">
                        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
                        <p className="slate-950 font-semibold ">Loading all PulseChain active stakes...</p>
                        <p className="text-white text-sm">Cross-referencing starts vs ends...</p>
                        <p className="text-white text-xs mt-2">This process fetches all stake starts and ends to determine which are still active</p>
                      </div>
                    )}

                    {!isLoadingPulsechainActiveStakes && pulsechainActiveStakes.length > 0 && (
                      <div className="overflow-auto max-h-[70vh]">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-800/60 border border-gray-300 sticky top-0">
                            <tr>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handlePulsechainActiveStakesSort('stakeId')}
                              >
                                <div className="flex items-center gap-1">
                                  Stake ID
                                  {pulsechainActiveStakesSortField === 'stakeId' ? (
                                    pulsechainActiveStakesSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">Staker Address</th>
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
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-slate-900/60 text-white"
                                onClick={() => handlePulsechainActiveStakesSort('daysLeft')}
                              >
                                <div className="flex items-center gap-1">
                                  Days Left
                                  {pulsechainActiveStakesSortField === 'daysLeft' ? (
                                    pulsechainActiveStakesSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handlePulsechainActiveStakesSort('progress')}
                              >
                                <div className="flex items-center gap-1">
                                  Progress
                                  {pulsechainActiveStakesSortField === 'progress' ? (
                                    pulsechainActiveStakesSortDirection === 'desc' ? '↓' : '↑'
                                  ) : '↕'}
                                </div>
                              </th>
                              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">End Day</th>
                              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">Timestamp</th>
                              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">Transaction</th>
                            </tr>
                          </thead>
                          <tbody className="bg-transparent divide-y divide-gray-200">
                            {getPaginatedPulsechainActiveStakes().map((stake, index) => {
                              const progress = (stake.daysServed || 0) / parseInt(stake.stakedDays || '1') * 100;
                              const isNearEnd = (stake.daysLeft || 0) <= 30;
                              const isOverdue = (stake.daysLeft || 0) < 0;
                              
                              return (
                                <tr key={stake.id} className="hover:bg-gray-800">
                                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium slate-950 font-semibold ">
                                    {stake.stakeId}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-mono">
                                    <button
                                      onClick={() => handlePulsechainStakerClick(stake.stakerAddr)}
                                      className="hover:text-white font-semibold   font-bold font-bold transition-colors cursor-pointer underline decoration-slate-950 font-semibold  /60 decoration-2 underline-offset-2"
                                      title={`${stake.stakerAddr} - Click to view staking history`}
                                    >
                                      {stake.stakerAddr.slice(0, 10)}...{stake.stakerAddr.slice(-8)}
                                    </button>
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold   font-bold font-bold font-semibold">
                                    {pulsechainHexStakingService.formatHexAmount(stake.stakedHearts)} HEX
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                                    {pulsechainHexStakingService.formatTShareAmount(stake.stakeTShares)}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                                    {pulsechainHexStakingService.formatStakeLength(parseInt(stake.stakedDays))}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                                    {stake.daysServed ? stake.daysServed.toLocaleString() : '0'} days
                                  </td>
                                  <td className={`px-3 py-4 whitespace-nowrap text-sm font-semibold ${
                                    isOverdue ? 'text-red-400' : isNearEnd ? 'text-white font-semibold  ' : 'text-white font-semibold  '
                                  }`}>
                                    {isOverdue ? `${Math.abs(stake.daysLeft || 0)} overdue` : `${stake.daysLeft || 0} days`}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm">
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 bg-white rounded-full h-2">
                                        <div 
                                          className={`h-2 rounded-full transition-all duration-300 ${
                                            isOverdue ? 'bg-red-500' : progress > 90 ? 'bg-slate-950 font-semibold  -500' : 'bg-green-600'
                                          }`}
                                          style={{ width: `${Math.min(100, progress)}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-slate-600">
                                        {progress.toFixed(1)}%
                                      </span>
                                    </div>
                                    {progress > 100 && (
                                      <div className="text-xs text-red-500 mt-1">
                                        {Math.round(progress - 100)} days over
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                                    Day {stake.endDay}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-600">
                                    {new Date(parseInt(stake.timestamp) * 1000).toLocaleDateString()}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                                    <a
                                      href={`https://scan.pulsechain.com/tx/${stake.transactionHash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:text-white font-semibold   font-bold font-bold transition-colors"
                                      title={stake.transactionHash}
                                    >
                                      {stake.transactionHash.slice(0, 8)}...
                                    </a>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        
                        {(() => {
                          const paginationInfo = getPulsechainActiveStakesPaginationInfo();
                          return (
                            <div className="px-3 sm:px-6 py-4 border-t border-white/10">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 flex justify-between sm:hidden">
                                  <button
                                    onClick={() => setPulsechainActiveStakesCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={!paginationInfo.hasPrevPage}
                                    className="relative inline-flex items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md text-slate-300 bg-slate-900 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Previous
                                  </button>
                                  <button
                                    onClick={() => setPulsechainActiveStakesCurrentPage(prev => Math.min(prev + 1, paginationInfo.totalPages))}
                                    disabled={!paginationInfo.hasNextPage}
                                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md text-slate-300 bg-slate-900 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Next
                                  </button>
                          </div>
                                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                  <div>
                                    <p className="text-sm text-slate-300">
                                      Showing <span className="font-medium">{paginationInfo.startIndex}</span> to{' '}
                                      <span className="font-medium">{paginationInfo.endIndex}</span> of{' '}
                                      <span className="font-medium">{paginationInfo.totalStakes.toLocaleString()}</span> PulseChain active stakes
                                    </p>
                                  </div>
                                  <div>
                                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                                      <button
                                        onClick={() => setPulsechainActiveStakesCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={!paginationInfo.hasPrevPage}
                                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-600 bg-slate-900 text-sm font-medium text-slate-300 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        Previous
                                      </button>
                                      {Array.from({ length: Math.min(5, paginationInfo.totalPages) }, (_, i) => {
                                        let pageNum;
                                        if (paginationInfo.totalPages <= 5) {
                                          pageNum = i + 1;
                                        } else {
                                          const startPage = Math.max(1, Math.min(paginationInfo.currentPage - 2, paginationInfo.totalPages - 4));
                                          pageNum = startPage + i;
                                        }
                                        return (
                                          <button
                                            key={i}
                                            onClick={() => setPulsechainActiveStakesCurrentPage(pageNum)}
                                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                              paginationInfo.currentPage === pageNum
                                                ? 'z-10 bg-slate-900/50 border-blue-500 text-white font-semibold  '
                                                : 'bg-slate-900 border-slate-600 text-slate-300 hover:bg-gray-500'
                                            }`}
                                          >
                                            {pageNum}
                                          </button>
                                        );
                                      })}
                                      <button
                                        onClick={() => setPulsechainActiveStakesCurrentPage(prev => Math.min(prev + 1, paginationInfo.totalPages))}
                                        disabled={!paginationInfo.hasNextPage}
                                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-600 bg-slate-900 text-sm font-medium text-slate-300 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        Next
                                      </button>
                                    </nav>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Data Table */}
        {!activeTab.includes('staking') && (
          <div className="w-full bg-slate-900 backdrop-blur-xl border border-white/10 sm:rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
            {/* Date Filter and Historical Data Title */}
            <div className="pt-6 pb-1 px-6 rounded-t-2xl bg-white/5 backdrop-blur-xl border-b border-white/10 shadow-[0_8px_20px_-2px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="text-sm uppercase tracking-[0.4em] text-white/70">Historical Data</h3>
                  
                  {/* Home Button */}
                  <button
                    onClick={() => window.location.href = '/'}
                    className="px-3 py-1.5 text-xs sm:text-sm rounded-full border border-white/25 bg-white/10 text-white/80 hover:bg-gray-500/20 transition"
                  >
                    Home
                  </button>
                </div>
                
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-white/60" />
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="border border-white/15 bg-white/5 backdrop-blur rounded-2xl px-3 py-1 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
                    placeholder="Filter by date"
                  />
                </div>
              </div>
            </div>
          <div className="overflow-auto max-h-[70vh]">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-slate-900 border border-gray-300 sticky top-0 rounded-t-lg shadow-[0_8px_25px_-1px_rgba(0,0,0,0.7)]">
                <tr>
                  {[
                    { key: 'date', label: 'Date', width: 'w-32', color: 'text-white' },
                    { key: 'currentDay', label: 'Day', width: 'w-20', color: 'text-white' },
                    { key: 'priceUV2UV3', label: 'HEX Price (USD)', width: 'w-28', color: 'text-white font-semibold  ' },
                    { key: 'priceChangeUV2UV3', label: 'Price Change (%)', width: 'w-24', color: 'text-white' },
                    { key: 'marketCap', label: 'Market Cap', width: 'w-32', color: 'text-white' },
                    { key: 'totalValueLocked', label: 'Total Value Locked', width: 'w-32', color: 'text-blue-500' },
                    { key: 'totalHEX', label: 'Total Supply', width: 'w-32', color: 'text-white' },
                    { key: 'circulatingHEX', label: 'Circulating Supply', width: 'w-32', color: 'text-white' },
                    { key: 'circulatingSupplyChange', label: 'Circulation Change', width: 'w-32', color: 'text-white font-semibold  ' },
                    { key: 'stakedHEX', label: 'Staked Supply', width: 'w-32', color: 'text-white font-semibold  ' },
                    { key: 'stakedSupplyChange', label: 'Staked Change', width: 'w-32', color: 'text-white font-semibold  ' },
                    { key: 'stakedHEXPercent', label: 'Staked %', width: 'w-24', color: 'text-white font-semibold  ' },
                    { key: 'totalTshares', label: 'Total T-Shares', width: 'w-32', color: 'text-white font-semibold  ' },
                    { key: 'totalTsharesChange', label: 'T-Shares Change', width: 'w-32', color: 'text-white font-semibold  ' },
                    { key: 'tshareRateHEX', label: 'T-Share Rate (HEX)', width: 'w-32', color: 'text-orange-600' },
                    { key: 'tshareMarketCap', label: 'T-Share Market Cap', width: 'w-32', color: 'text-white font-semibold  ' },
                    { key: 'payoutPerTshareHEX', label: 'Payout/T-Share', width: 'w-28', color: 'text-white font-semibold  -600' },
                    { key: 'dailyPayoutHEX', label: 'Daily Payout', width: 'w-32', color: 'text-white font-semibold  ' },
                    { key: 'dailyMintedInflationTotal', label: 'Daily Inflation', width: 'w-32', color: 'text-white font-semibold  ' },
                    { key: 'actualAPYRate', label: 'APY Rate (%)', width: 'w-24', color: 'text-orange-600' },
                    { key: 'currentStakerCount', label: 'Active Stakers', width: 'w-28', color: 'text-white font-semibold  ' },
                    { key: 'currentStakerCountChange', label: 'Staker Change', width: 'w-28', color: 'text-white font-semibold  ' },
                    { key: 'currentHolders', label: 'Current Holders', width: 'w-28', color: 'text-white font-semibold  ' },
                    { key: 'currentHoldersChange', label: 'Holder Change', width: 'w-28', color: 'text-white font-semibold  ' },
                    { key: 'numberOfHolders', label: 'Total Holders', width: 'w-28', color: 'text-red-600' },
                    { key: 'averageStakeLength', label: 'Avg Stake Length', width: 'w-28', color: 'text-white font-semibold  ' },
                    { key: 'penaltiesHEX', label: 'Penalties (HEX)', width: 'w-32', color: 'text-red-400' },
                    { key: 'roiMultiplierFromATL', label: 'ROI from ATL', width: 'w-28', color: 'text-white font-semibold  ' },
                    ...(activeTab === 'ethereum' ? [
                      { key: 'priceBTC', label: 'BTC Price', width: 'w-28', color: 'text-white font-semibold  ' },
                      { key: 'priceETH', label: 'ETH Price', width: 'w-28', color: 'text-white font-semibold  ' },
                    ] : []),
                    ...(activeTab === 'pulsechain' ? [
                  { key: 'pricePulseX', label: 'PulseX Price', width: 'w-28', color: 'text-white font-semibold  ' },
                  { key: 'pricePulseX_PLS', label: 'PLS Price', width: 'w-28', color: 'text-white font-semibold  ' },
                ] : [])
              ].map((column) => {
                const headerColorClass = normalizeHistoricalTextColor(column.color);
                return (
                  <th
                    key={column.key}
                    onClick={() => handleSort(column.key as keyof HexRow)}
                    className={`sticky top-0 z-10 bg-slate-950 font-semibold   font-bold font-bold backdrop-blur-xl border border-gray-300 px-3 py-3 text-center text-sm font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors select-none ${headerColorClass}`}
                  >
                    <div className="flex items-center gap-1">
                      {column.label}
                    </div>
                  </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="bg-transparent divide-y divide-gray-200">
                {paginatedData.map((row, index) => (
                  <tr key={row._id || index} className="hover:bg-gray-500/5 transition">
                    {/* Date */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-white/80">
                      {formatDate(row.date)}
                    </td>
                    {/* Current Day */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-white/80">
                      {formatNumber(row.currentDay, 0, true)}
                    </td>
                    {/* HEX Price */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold   font-bold font-bold font-semibold">
                      {formatPrice(row.priceUV2UV3, 8)}
                    </td>
                    {/* Price Change */}
                    <td className={`px-3 py-4 whitespace-nowrap text-sm ${getChangeColor(row.priceChangeUV2UV3)}`}>
                      <div className="flex items-center gap-1">
                        {formatPercent(row.priceChangeUV2UV3)}
                      </div>
                    </td>
                    {/* Market Cap */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-white/80">
                      {formatCurrency(row.marketCap, 0)}
                    </td>
                    {/* Total Value Locked */}
                    <td className="px-3 py-4 bg-white/10 text-sm text-white font-semibold">
                      {formatCurrency(row.totalValueLocked, 0)}
                    </td>
                    {/* Total Supply */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-white/80">
                      {formatHEX(row.totalHEX)}
                    </td>
                    {/* Circulating Supply */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-white/80">
                      {formatHEX(row.circulatingHEX)}
                    </td>
                    {/* Circulation Change */}
                    <td className={`px-3 py-4 whitespace-nowrap text-sm ${getChangeColor(row.circulatingSupplyChange)}`}>
                      <div className="flex items-center gap-1">
                        {formatHEX(row.circulatingSupplyChange)}
                      </div>
                    </td>
                    {/* Staked Supply */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-white">
                      {formatHEX(row.stakedHEX)}
                    </td>
                    {/* Staked Change */}
                    <td className={`px-3 py-4 whitespace-nowrap text-sm ${getChangeColor(row.stakedSupplyChange)}`}>
                      <div className="flex items-center gap-1">
                        {formatHEX(row.stakedSupplyChange)}
                      </div>
                    </td>
                    {/* Staked Percentage */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-white">
                      {formatPercent(row.stakedHEXPercent)}
                    </td>
                    {/* Total T-Shares */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-white">
                      {formatTShares(row.totalTshares)}
                    </td>
                    {/* T-Shares Change */}
                    <td className={`px-3 py-4 whitespace-nowrap text-sm ${getChangeColor(row.totalTsharesChange)}`}>
                      <div className="flex items-center gap-1">
                        {formatTShares(row.totalTsharesChange)}
                      </div>
                    </td>
                    {/* T-Share Rate */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                      {formatPrice(row.tshareRateHEX, 8)}
                    </td>
                    {/* T-Share Market Cap */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-white">
                      {formatCurrency(row.tshareMarketCap, 0)}
                    </td>
                    {/* Payout per T-Share */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                      {formatPrice(row.payoutPerTshareHEX, 8)}
                    </td>
                    {/* Daily Payout */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                      {formatHEX(row.dailyPayoutHEX)}
                    </td>
                    {/* Daily Inflation */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                      {formatHEX(row.dailyMintedInflationTotal)}
                    </td>
                    {/* APY Rate */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                      {formatPercent(row.actualAPYRate)}
                    </td>
                    {/* Active Stakers */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-white">
                      {formatNumber(row.currentStakerCount, 0)}
                    </td>
                    {/* Staker Change */}
                    <td className={`px-3 py-4 whitespace-nowrap text-sm ${getChangeColor(row.currentStakerCountChange)}`}>
                      <div className="flex items-center gap-1">
                        {formatNumber(row.currentStakerCountChange, 0)}
                      </div>
                    </td>
                    {/* Current Holders */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-white">
                      {formatNumber(row.currentHolders, 0)}
                    </td>
                    {/* Holder Change */}
                    <td className={`px-3 py-4 whitespace-nowrap text-sm ${getChangeColor(row.currentHoldersChange)}`}>
                      <div className="flex items-center gap-1">
                        {formatNumber(row.currentHoldersChange, 0)}
                      </div>
                    </td>
                    {/* Total Holders */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-white">
                      {formatNumber(row.numberOfHolders, 0)}
                    </td>
                    {/* Average Stake Length */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                      {formatNumber(row.averageStakeLength, 1)} days
                    </td>
                    {/* Penalties */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                      {formatHEX(row.penaltiesHEX)}
                    </td>
                    {/* ROI from ATL */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                      {formatPercent(row.roiMultiplierFromATL)}
                    </td>
                    {/* Network-specific columns */}
                    {activeTab === 'ethereum' && (
                      <>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                          {formatCurrency(row.priceBTC, 2)}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-white">
                          {formatCurrency(row.priceETH, 2)}
                        </td>
                      </>
                    )}
                    {activeTab === 'pulsechain' && (
                      <>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                          {formatPrice(row.pricePulseX, 8)}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-white font-semibold  ">
                          {formatPrice(row.pricePulseX_PLS, 8)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-slate-800/30 px-4 py-3 flex items-center justify-between border-t border-white rounded-b-2xl shadow-[0_-8px_20px_-2px_rgba(0,0,0,0.5)]">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md text-slate-300 bg-slate-900 hover:bg-gray-500"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md text-slate-300 bg-slate-900 hover:bg-gray-500"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-300">
                    Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(currentPage * itemsPerPage, sortedData.length)}</span> of{' '}
                    <span className="font-medium">{sortedData.length}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-600 bg-slate-900 text-sm font-medium text-slate-300 hover:bg-gray-500"
                    >
                      Previous
                    </button>
                    
                    {/* Page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else {
                        const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                        pageNum = startPage + i;
                      }
                      return (
                        <button
                          key={`page-${pageNum}`}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === pageNum
                              ? 'z-10 bg-slate-900/50 border-blue-500 text-white font-semibold  '
                              : 'bg-slate-900 border-slate-600 text-slate-300 hover:bg-gray-500'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-600 bg-slate-900 text-sm font-medium text-slate-300 hover:bg-gray-500"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Dex Pairs Card (PulseChain HEX) */}
        {showDexPairs && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60" onClick={() => setShowDexPairs(false)} />
            <div className="relative w-full max-w-3xl bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.7)] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                <h3 className="text-white font-semibold">PulseChain HEX Liquidity Pairs (DexScreener)</h3>
                <button
                  onClick={() => setShowDexPairs(false)}
                  className="text-slate-300 hover:text-white text-sm"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto p-4">
                {isLoadingDexPairs && (
                  <div className="text-center text-slate-300 py-6">Loading pairs…</div>
                )}
                {dexPairsError && (
                  <div className="text-center text-red-300 py-6">{dexPairsError}</div>
                )}
                {!isLoadingDexPairs && !dexPairsError && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(dexPairs || []).map((p, idx) => (
                    <a
                      key={`${p?.baseToken?.address}-${idx}`}
                      href={(p && (p as { url?: string }).url) || `https://dexscreener.com/pulsechain/${(p as { pairAddress?: string } | undefined)?.pairAddress ?? ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-lg border border-white/10 bg-white/5 p-3 hover:bg-gray-500/10 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div className="text-white font-medium truncate">
                            {p?.baseToken?.symbol}/{p?.quoteToken?.symbol}
                          </div>
                          <div className="text-xs text-slate-400">FDV: ${p?.fdv?.toLocaleString?.() ?? '—'}</div>
                        </div>
                        <div className="mt-1 text-sm text-slate-300">
                          <span className="mr-3">Price: ${Number(p?.priceUsd || 0).toFixed(6)}</span>
                          <span>Liquidity: ${p?.liquidity?.usd?.toLocaleString?.() ?? '—'}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          24h Vol: ${(p?.volume?.h24 ?? 0).toLocaleString?.()} • 24h Δ: {(p?.priceChange?.h24 ?? 0).toFixed?.(2)}%
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}



        {/* Footer */}
        <footer className="mt-8 text-center text-slate-400 text-sm">
          <p>
            Data provided by{' '}
            <a
              href="https://hexdailystats.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-blue-300 hover:text-blue-200 underline decoration-slate-950 font-semibold  /60 decoration-2 underline-offset-2"
            >
              HEXDailyStats.com
            </a>
          </p>
          <p className="mt-1">Last updated: {new Date().toLocaleString()}</p>
        </footer>
          </div>
        </div>
      </div>

      {/* Ethereum Staker History Modal */}
      <StakerHistoryModal
        stakerAddress={selectedStakerAddress}
        isOpen={isEthereumStakerHistoryModalOpen}
        onClose={handleEthereumStakerHistoryModalClose}
        network="ethereum"
        currentPrice={liveData?.price || 0}
      />

      {/* PulseChain Staker History Modal */}
      <StakerHistoryModal
        stakerAddress={selectedStakerAddress}
        isOpen={isPulsechainStakerHistoryModalOpen}
        onClose={handlePulsechainStakerHistoryModalClose}
        network="pulsechain"
        currentPrice={liveData?.price_Pulsechain || liveData?.pricePulseX || 0}
      />

      {/* Dual Network Staker History Modal */}
      {isDualNetworkModalOpen && dualNetworkStakerData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold slate-950 font-semibold ">
                Staker History: {selectedStakerAddress}
              </h2>
              <button
                onClick={() => {
                  setIsDualNetworkModalOpen(false);
                  setSelectedStakerAddress(null);
                  setDualNetworkStakerData(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-5 h-5 slate-950 font-semibold " />
              </button>
            </div>
            
            <div className="p-6">
              {/* Network Tabs */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  {dualNetworkStakerData.ethereum && (
                    <button
                      onClick={() => {
                        setIsEthereumStakerHistoryModalOpen(true);
                        setIsDualNetworkModalOpen(false);
                      }}
                      className="py-2 px-1 border-b-2 border-transparent slate-950 font-semibold  hover:text-white font-semibold   font-bold font-bold hover:border-blue-300 font-medium text-sm whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        Ethereum ({dualNetworkStakerData.ethereum.totalStakes} stakes)
                      </div>
                    </button>
                  )}
                  {dualNetworkStakerData.pulsechain && (
                    <button
                      onClick={() => {
                        setIsPulsechainStakerHistoryModalOpen(true);
                        setIsDualNetworkModalOpen(false);
                      }}
                      className="py-2 px-1 border-b-2 border-transparent slate-950 font-semibold  hover:text-white font-semibold   font-bold font-bold hover:border-blue-300 font-medium text-sm whitespace-nowrap"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        PulseChain ({dualNetworkStakerData.pulsechain.totalStakes} stakes)
                      </div>
                    </button>
                  )}
                </nav>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                {dualNetworkStakerData.ethereum && (
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                    <h3 className="font-semibold text-white font-semibold   font-bold font-bold mb-3 flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      Ethereum Network
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-white font-semibold  ">Total Stakes:</span>
                        <div className="font-bold text-white font-semibold  ">{dualNetworkStakerData.ethereum.totalStakes}</div>
                      </div>
                      <div>
                        <span className="text-white font-semibold  ">Active Stakes:</span>
                        <div className="font-bold text-white font-semibold  ">{dualNetworkStakerData.ethereum.activeStakes}</div>
                      </div>
                      <div>
                        <span className="text-white font-semibold  ">Total Staked:</span>
                        <div className="font-bold text-white font-semibold  ">
                          {hexStakingService.formatHexAmount(dualNetworkStakerData.ethereum.totalStakedHearts)} HEX
                        </div>
                      </div>
                      <div>
                        <span className="text-white font-semibold  ">Avg Length:</span>
                        <div className="font-bold text-white font-semibold  ">
                          {Math.round(dualNetworkStakerData.ethereum.averageStakeLength)} days
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {dualNetworkStakerData.pulsechain && (
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                    <h3 className="font-semibold text-white font-semibold   font-bold font-bold mb-3 flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      PulseChain Network
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-white font-semibold  ">Total Stakes:</span>
                        <div className="font-bold text-white font-semibold  ">{dualNetworkStakerData.pulsechain.totalStakes}</div>
                      </div>
                      <div>
                        <span className="text-white font-semibold  ">Active Stakes:</span>
                        <div className="font-bold text-white font-semibold  ">{dualNetworkStakerData.pulsechain.activeStakes}</div>
                      </div>
                      <div>
                        <span className="text-white font-semibold  ">Total Staked:</span>
                        <div className="font-bold text-white font-semibold  ">
                          {hexStakingService.formatHexAmount(dualNetworkStakerData.pulsechain.totalStakedHearts)} HEX
                        </div>
                      </div>
                      <div>
                        <span className="text-white font-semibold  ">Avg Length:</span>
                        <div className="font-bold text-white font-semibold  ">
                          {Math.round(dualNetworkStakerData.pulsechain.averageStakeLength)} days
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-center slate-950 font-semibold  mb-4">
                Click on a network tab above to view detailed staking history
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart Modal */}
      {isChartModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="relative w-full max-w-7xl max-h-[90vh] bg-white/10 backdrop-blur-2xl border border-white/30 rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 bg-white/10">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <BarChart3 className="w-6 h-6" />
                {activeTab === 'ethereum' ? 'Ethereum' : 'PulseChain'} HEX Price Chart
              </h2>
              <button
                onClick={() => setIsChartModalOpen(false)}
                className="p-2 text-white hover:text-white/80 transition-colors"
                title="Close Chart"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Chart Content */}
            <div className="p-6 h-[calc(90vh-120px)]">
              {activeTab === 'ethereum' ? (
                <div 
                  className="w-full h-full"
                  dangerouslySetInnerHTML={{
                    __html: `<style>#dexscreener-embed{position:relative;width:100%;padding-bottom:125%;}@media(min-width:1400px){#dexscreener-embed{padding-bottom:65%;}}#dexscreener-embed iframe{position:absolute;width:100%;height:100%;top:0;left:0;border:0;}</style><div id="dexscreener-embed"><iframe src="https://dexscreener.com/ethereum/0x55D5c232D921B9eAA6b37b5845E439aCD04b4DBa?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartDefaultOnMobile=1&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15"></iframe></div>`
                  }}
                />
              ) : (
                <div 
                  className="w-full h-full"
                  dangerouslySetInnerHTML={{
                    __html: `<style>#dexscreener-embed{position:relative;width:100%;padding-bottom:125%;}@media(min-width:1400px){#dexscreener-embed{padding-bottom:65%;}}#dexscreener-embed iframe{position:absolute;width:100%;height:100%;top:0;left:0;border:0;}</style><div id="dexscreener-embed"><iframe src="https://dexscreener.com/pulsechain/0xf1F4ee610b2bAbB05C635F726eF8B0C568c8dc65?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartDefaultOnMobile=1&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15"></iframe></div>`
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HEXDataDashboard;
