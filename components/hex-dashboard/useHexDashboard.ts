import { useState, useEffect, useCallback } from 'react';
import { dexscreenerApi } from '@/services/blockchain/dexscreenerApi';
import { hexStakingService } from '@/services/hexStakingService';
import type { DashboardState, HexRow, LiveData, ActiveTab, StakingSubTab } from './types';
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
      console.log('🔍 Loading HEX staking data from The Graph...');
      const stakingMetrics = await hexStakingService.getStakingMetrics();
      console.log('✅ Staking data loaded successfully:', stakingMetrics);
      
      updateState({ 
        stakingData: stakingMetrics,
        isLoadingStaking: false,
        stakingError: null
      });
    } catch (error) {
      console.error('❌ Error loading staking data:', error);
      updateState({ 
        stakingError: error instanceof Error ? error.message : 'Failed to load staking data',
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
      console.log('🔍 Loading all stake start events...');
      const allStakes = await hexStakingService.getAllStakeStartsPaginated(1000);
      console.log(`✅ Loaded ${allStakes.length} stake start events`);
      
      updateState({ 
        allStakeStarts: allStakes,
        isLoadingAllStakes: false
      });
    } catch (error) {
      console.error('❌ Error loading all stake starts:', error);
      updateState({ isLoadingAllStakes: false });
    }
  }, [updateState]);

  const loadActiveStakes = useCallback(async () => {
    updateState({ isLoadingActiveStakes: true });
    
    try {
      console.log('🔍 Loading all active stakes...');
      const activeStakesData = await hexStakingService.getAllActiveStakes();
      console.log(`✅ Loaded ${activeStakesData.length} active stakes`);
      
      updateState({ 
        activeStakes: activeStakesData,
        isLoadingActiveStakes: false
      });
    } catch (error) {
      console.error('❌ Error loading active stakes:', error);
      updateState({ isLoadingActiveStakes: false });
    }
  }, [updateState]);

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
    setActiveTab,
    setCurrentPage,
    setSortConfig,
    setFilterDate,
    setShowGeminiAnalysis,
    setShowDexPairs,
    setStakingSubTab,
  };
};