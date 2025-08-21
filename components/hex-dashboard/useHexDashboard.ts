import { useState, useEffect, useCallback } from 'react';
import { dexscreenerApi } from '@/services/blockchain/dexscreenerApi';
import { hexStakingService } from '@/services/hexStakingService';
import { pulsechainHexStakingService } from '@/services/pulsechainHexStakingService';
import type { DashboardState, HexRow, LiveData, ActiveTab, StakingSubTab, MultiNetworkStakingData } from './types';
import type { DexScreenerData } from '@/services/core/types';
import type { HexStakingMetrics } from '@/services/hexStakingService';

const getApiUrl = (endpoint: 'ethereum' | 'pulsechain' | 'live'): string => {
  const endpointMap: Record<'ethereum' | 'pulsechain' | 'live', string> = {
    ethereum: 'fulldata',
    pulsechain: 'fulldatapulsechain',
    live: 'livedata'
  };
  return `/api/hex-proxy?endpoint=${endpointMap[endpoint]}`;
};

export const useHexDashboard = () => {
  const [state, setState] = useState<DashboardState>({
    ethereumData: [],
    pulsechainData: [],
    liveData: null,
    activeTab: 'pulsechain',
    isLoading: true,
    error: null,
    sortConfig: { key: 'currentDay', direction: 'desc' },
    filterDate: '',
    currentPage: 1,
    showGeminiAnalysis: false,
    showDexPairs: false,
    isLoadingDexPairs: false,
    dexPairs: null,
    dexPairsError: null,
    stakingData: null,
    isLoadingStaking: false,
    stakingError: null,
    allStakeStarts: [],
    isLoadingAllStakes: false,
    stakingSubTab: 'overview',
    activeStakes: [],
    isLoadingActiveStakes: false,
    pulsechainStakeStarts: [],
    pulsechainActiveStakes: [],
    isLoadingPulsechainStakes: false,
  });

  const updateState = useCallback((updates: Partial<DashboardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const fetchData = useCallback(async () => {
    updateState({ isLoading: true, error: null });
    
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
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          }
        }
      };

      const [ethDataResponse, plsDataResponse, liveDataResponse] = await Promise.allSettled([
        fetchWithRetry(getApiUrl('ethereum')),
        fetchWithRetry(getApiUrl('pulsechain')),
        fetchWithRetry(getApiUrl('live'))
      ]);

      let ethereumData: HexRow[] = [];
      let pulsechainData: HexRow[] = [];
      let liveData: LiveData | null = null;

      if (ethDataResponse.status === 'fulfilled') {
        ethereumData = Array.isArray(ethDataResponse.value) ? ethDataResponse.value : [];
        console.log(`✅ Ethereum data: ${ethereumData.length} records`);
      } else {
        console.error('❌ Failed to fetch Ethereum data:', ethDataResponse.reason);
      }

      if (plsDataResponse.status === 'fulfilled') {
        pulsechainData = Array.isArray(plsDataResponse.value) ? plsDataResponse.value : [];
        console.log(`✅ PulseChain data: ${pulsechainData.length} records`);
      } else {
        console.error('❌ Failed to fetch PulseChain data:', plsDataResponse.reason);
      }

      if (liveDataResponse.status === 'fulfilled') {
        liveData = liveDataResponse.value;
        console.log('✅ Live data fetched successfully');
      } else {
        console.error('❌ Failed to fetch live data:', liveDataResponse.reason);
      }

      updateState({ 
        ethereumData, 
        pulsechainData, 
        liveData, 
        isLoading: false,
        error: null
      });

    } catch (error) {
      console.error('❌ Fetch data error:', error);
      updateState({ 
        error: error instanceof Error ? error.message : 'Failed to fetch data',
        isLoading: false
      });
    }
  }, [updateState]);

  const loadStakingData = useCallback(async () => {
    updateState({ isLoadingStaking: true, stakingError: null });
    
    try {
      console.log('🔍 Loading multi-network HEX staking data from The Graph...');
      
      // Fetch both Ethereum and PulseChain staking data in parallel
      const [ethereumStakingMetrics, pulsechainStakingMetrics] = await Promise.allSettled([
        hexStakingService.getStakingMetrics(),
        pulsechainHexStakingService.getStakingMetrics()
      ]);

      let ethereumData: HexStakingMetrics | null = null;
      let pulsechainData: any = null;
      let combinedData = {
        totalActiveStakes: 0,
        totalStakedHearts: '0',
        totalStakeShares: '0',
        averageStakeLength: 0,
        latestStakeId: '0',
        hexDay: '0'
      };

      // Process Ethereum data
      if (ethereumStakingMetrics.status === 'fulfilled') {
        ethereumData = ethereumStakingMetrics.value;
        console.log('✅ Ethereum staking data loaded successfully:', ethereumData);
        
        // Add to combined totals
        combinedData.totalActiveStakes += ethereumData.totalActiveStakes || 0;
        combinedData.totalStakedHearts = (parseInt(combinedData.totalStakedHearts) + parseInt(ethereumData.totalStakedHearts || '0')).toString();
        combinedData.totalStakeShares = (parseInt(combinedData.totalStakeShares) + parseInt(ethereumData.globalInfo?.stakeSharesTotal || '0')).toString();
        combinedData.averageStakeLength += ethereumData.averageStakeLength || 0;
        combinedData.latestStakeId = ethereumData.globalInfo?.latestStakeId || '0';
        combinedData.hexDay = ethereumData.globalInfo?.hexDay || '0';
      } else {
        console.error('❌ Failed to load Ethereum staking data:', ethereumStakingMetrics.reason);
      }

      // Process PulseChain data
      if (pulsechainStakingMetrics.status === 'fulfilled') {
        pulsechainData = pulsechainStakingMetrics.value;
        console.log('✅ PulseChain staking data loaded successfully:', pulsechainData);
        
        // Add to combined totals (adjust field names as needed based on actual PulseChain response)
        if (pulsechainData.totalActiveStakes) {
          combinedData.totalActiveStakes += pulsechainData.totalActiveStakes;
        }
        if (pulsechainData.totalStakedHearts) {
          combinedData.totalStakedHearts = (parseInt(combinedData.totalStakedHearts) + parseInt(pulsechainData.totalStakedHearts)).toString();
        }
        if (pulsechainData.globalInfo?.stakeSharesTotal) {
          combinedData.totalStakeShares = (parseInt(combinedData.totalStakeShares) + parseInt(pulsechainData.globalInfo.stakeSharesTotal)).toString();
        }
        if (pulsechainData.averageStakeLength) {
          combinedData.averageStakeLength += pulsechainData.averageStakeLength;
        }
        // Use the higher stake ID and hex day
        if (pulsechainData.globalInfo?.latestStakeId && parseInt(pulsechainData.globalInfo.latestStakeId) > parseInt(combinedData.latestStakeId)) {
          combinedData.latestStakeId = pulsechainData.globalInfo.latestStakeId;
        }
        if (pulsechainData.globalInfo?.hexDay && parseInt(pulsechainData.globalInfo.hexDay) > parseInt(combinedData.hexDay)) {
          combinedData.hexDay = pulsechainData.globalInfo.hexDay;
        }
      } else {
        console.error('❌ Failed to load PulseChain staking data:', pulsechainStakingMetrics.reason);
      }

      // Calculate average stake length
      if (ethereumData && pulsechainData) {
        combinedData.averageStakeLength = Math.round(combinedData.averageStakeLength / 2);
      }

      const multiNetworkStakingData: MultiNetworkStakingData = {
        ethereum: ethereumData,
        pulsechain: pulsechainData,
        combined: combinedData
      };

      console.log('✅ Combined multi-network staking data:', multiNetworkStakingData);
      
      updateState({ 
        stakingData: multiNetworkStakingData,
        isLoadingStaking: false,
        stakingError: null
      });
    } catch (error) {
      console.error('❌ Error loading multi-network staking data:', error);
      updateState({ 
        stakingError: error instanceof Error ? error.message : 'Failed to load multi-network staking data',
        isLoadingStaking: false
      });
    }
  }, [updateState]);

  const loadDexPairs = useCallback(async () => {
    updateState({ isLoadingDexPairs: true, dexPairsError: null });
    
    try {
      const dexData = await dexscreenerApi.getTokenData('0x2b591e99afe9f32eaa6214f7b7629768c40eeb39');
      updateState({ 
        dexPairs: dexData?.pairs || null,
        isLoadingDexPairs: false,
        dexPairsError: null
      });
    } catch (error) {
      console.error('Error loading DEX pairs:', error);
      updateState({ 
        dexPairsError: error instanceof Error ? error.message : 'Failed to load DEX pairs',
        isLoadingDexPairs: false
      });
    }
  }, [updateState]);

  const loadAllStakeStarts = useCallback(async () => {
    updateState({ isLoadingAllStakes: true });
    
    try {
      console.log('🔍 Loading all Ethereum stake start events...');
      const allStakes = await hexStakingService.getAllStakeStartsPaginated(1000);
      console.log(`✅ Loaded ${allStakes.length} Ethereum stake start events`);
      
      updateState({ 
        allStakeStarts: allStakes,
        isLoadingAllStakes: false
      });
    } catch (error) {
      console.error('❌ Error loading Ethereum stake starts:', error);
      updateState({ isLoadingAllStakes: false });
    }
  }, [updateState]);

  const loadActiveStakes = useCallback(async () => {
    updateState({ isLoadingActiveStakes: true });
    
    try {
      console.log('🔍 Loading all Ethereum active stakes...');
      const activeStakesData = await hexStakingService.getAllActiveStakes();
      console.log(`✅ Loaded ${activeStakesData.length} Ethereum active stakes`);
      
      updateState({ 
        activeStakes: activeStakesData,
        isLoadingActiveStakes: false
      });
    } catch (error) {
      console.error('❌ Error loading Ethereum active stakes:', error);
      updateState({ isLoadingActiveStakes: false });
    }
  }, [updateState]);

  // New PulseChain staking functions
  const loadPulsechainStakeStarts = useCallback(async () => {
    updateState({ isLoadingPulsechainStakes: true });
    
    try {
      console.log('🔍 Loading PulseChain stake start events...');
      
      // Check if we already have the data from the initial staking load
      if (state.stakingData?.pulsechain?.totalActiveStakes !== undefined) {
        console.log('📋 Using existing PulseChain stake starts data from initial load');
        const cachedData = pulsechainHexStakingService.getCachedStakeStarts();
        if (cachedData) {
          const result = cachedData.slice(0, 1000).map(stake => ({
            ...stake,
            network: 'pulsechain'
          }));
          updateState({ 
            pulsechainStakeStarts: result,
            isLoadingPulsechainStakes: false
          });
          return;
        }
      }
      
      // Fetch fresh data if not cached - get ALL data for pagination
      const allStakes = await pulsechainHexStakingService.getAllStakeStartsPaginated(undefined);
      console.log(`✅ Loaded ${allStakes.length} PulseChain stake start events (full dataset)`);
      
      updateState({ 
        pulsechainStakeStarts: allStakes,
        isLoadingPulsechainStakes: false
      });
    } catch (error) {
      console.error('❌ Error loading PulseChain stake starts:', error);
      updateState({ isLoadingPulsechainStakes: false });
    }
  }, [updateState, state.stakingData?.pulsechain?.totalActiveStakes]);

  const loadPulsechainActiveStakes = useCallback(async () => {
    updateState({ isLoadingPulsechainStakes: true });
    
    try {
      console.log('🔍 Loading PulseChain active stakes...');
      
      // Check if we already have the data from the initial staking load
      if (state.stakingData?.pulsechain?.totalActiveStakes !== undefined) {
        console.log('📋 Using existing PulseChain active stakes data from initial load');
        const cachedData = pulsechainHexStakingService.getCachedActiveStakes();
        if (cachedData) {
          updateState({ 
            pulsechainActiveStakes: cachedData,
            isLoadingPulsechainStakes: false
          });
          return;
        }
      }
      
      // Fetch fresh data if not cached - get ALL active stakes for pagination
      const activeStakesData = await pulsechainHexStakingService.getAllActiveStakes();
      console.log(`✅ Loaded ${activeStakesData.length} PulseChain active stakes (full dataset)`);
      
      updateState({ 
        pulsechainActiveStakes: activeStakesData,
        isLoadingPulsechainStakes: false
      });
    } catch (error) {
      console.error('❌ Error loading PulseChain active stakes:', error);
      updateState({ isLoadingPulsechainStakes: false });
    }
  }, [updateState, state.stakingData?.pulsechain?.totalActiveStakes]);

  const setActiveTab = useCallback((tab: ActiveTab) => {
    updateState({ activeTab });
  }, [updateState]);

  const setCurrentPage = useCallback((page: number) => {
    updateState({ currentPage: page });
  }, [updateState]);

  const setSortConfig = useCallback((sortConfig: DashboardState['sortConfig']) => {
    updateState({ sortConfig });
  }, [updateState]);

  const setFilterDate = useCallback((filterDate: string) => {
    updateState({ filterDate });
  }, [updateState]);

  const setShowGeminiAnalysis = useCallback((show: boolean) => {
    updateState({ showGeminiAnalysis: show });
  }, [updateState]);

  const setShowDexPairs = useCallback((show: boolean) => {
    updateState({ showDexPairs: show });
  }, [updateState]);

  const setStakingSubTab = useCallback((tab: StakingSubTab) => {
    updateState({ stakingSubTab: tab });
  }, [updateState]);

  // Efficient data access for AI timing analysis
  const getSortedPulsechainData = useCallback((type: 'stakeStarts' | 'activeStakes', sortBy: string, order: 'asc' | 'desc') => {
    if (type === 'stakeStarts') {
      return pulsechainHexStakingService.getSortedStakeStarts(
        sortBy as 'timestamp' | 'stakedHearts' | 'stakedDays',
        order
      );
    } else {
      return pulsechainHexStakingService.getSortedActiveStakes(
        sortBy as 'daysLeft' | 'daysServed' | 'stakedHearts',
        order
      );
    }
  }, []);

  // Get cache status for debugging
  const getPulsechainCacheStatus = useCallback(async () => {
    return await pulsechainHexStakingService.getCacheStatus();
  }, []);

  // Load initial data
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    // State
    ...state,
    
    // Actions
    fetchData,
    loadStakingData,
    loadDexPairs,
    loadAllStakeStarts,
    loadActiveStakes,
    loadPulsechainStakeStarts,
    loadPulsechainActiveStakes,
    setActiveTab,
    setCurrentPage,
    setSortConfig,
    setFilterDate,
    setShowGeminiAnalysis,
    setShowDexPairs,
    setStakingSubTab,
    
    // Efficient data access for AI timing
    getSortedPulsechainData,
    getPulsechainCacheStatus,
  };
};