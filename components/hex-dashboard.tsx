"use client";
import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Calendar, Download, Filter, Brain, Users, Lock, Globe } from 'lucide-react';
import { dexscreenerApi } from '@/services/blockchain/dexscreenerApi';
import type { DexScreenerData } from '@/services/core/types';
import HexGeminiAnalysis from './HexGeminiAnalysis';
import TopStakesVisual from './hex-dashboard/TopStakesVisual';
import StakerHistoryModal from './hex-dashboard/StakerHistoryModal';
import EndstakeTimingAI from './hex-dashboard/EndstakeTimingAI';
import type { HexDataPoint } from '@/lib/hooks/useHexGemini';
import { hexStakingService, type HexStakingMetrics } from '@/services/hexStakingService';
import { pulsechainHexStakingService } from '@/services/pulsechainHexStakingService';
import { HexLoader } from '@/components/ui/hex-loader';

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
  const [activeTab, setActiveTab] = useState<'pulsechain' | 'ethereum' | 'ethereum-staking' | 'pulsechain-staking'>('pulsechain');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof HexRow; direction: 'asc' | 'desc' }>({ key: 'currentDay', direction: 'desc' });
  const [filterDate, setFilterDate] = useState<string>('');
  const [showGeminiAnalysis, setShowGeminiAnalysis] = useState<boolean>(false);
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
  const [ethereumActiveStakesSortField, setEthereumActiveStakesSortField] = useState<'stakeId' | 'stakedHearts' | 'stakedDays' | 'daysServed' | 'daysLeft'>('stakedHearts');
  const [ethereumActiveStakesSortDirection, setEthereumActiveStakesSortDirection] = useState<'asc' | 'desc'>('desc');
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
  const [pulsechainActiveStakesSortField, setPulsechainActiveStakesSortField] = useState<'stakeId' | 'stakedHearts' | 'stakedDays' | 'daysServed' | 'daysLeft'>('stakedHearts');
  const [pulsechainActiveStakesSortDirection, setPulsechainActiveStakesSortDirection] = useState<'asc' | 'desc'>('desc');
  const [pulsechainStakeStartsSortField, setPulsechainStakeStartsSortField] = useState<'stakeId' | 'stakedHearts' | 'stakedDays' | 'startDay' | 'endDay' | 'stakeTShares' | 'timestamp'>('stakeId');
  const [pulsechainStakeStartsSortDirection, setPulsechainStakeStartsSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedStakerAddress, setSelectedStakerAddress] = useState<string | null>(null);
  const [isEthereumStakerHistoryModalOpen, setIsEthereumStakerHistoryModalOpen] = useState<boolean>(false);
  const [isPulsechainStakerHistoryModalOpen, setIsPulsechainStakerHistoryModalOpen] = useState<boolean>(false);
  
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

  // Load Ethereum HEX staking data from The Graph
  const loadEthereumStakingData = async () => {
    setIsLoadingEthereumStaking(true);
    setEthereumStakingError(null);
    try {
      const data = await hexStakingService.getStakingMetrics();
      setEthereumStakingData(data);
    } catch (e) {
      setEthereumStakingData(null);
      setEthereumStakingError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoadingEthereumStaking(false);
    }
  };

  // Load Ethereum stake starts
  const loadEthereumStakeStarts = async () => {
    setIsLoadingEthereumAllStakes(true);
    try {
      const stakes = await hexStakingService.getAllStakeStartsPaginated(1000);
      setEthereumAllStakeStarts(stakes);
    } catch (e) {
      console.error('Error loading Ethereum stake starts:', e);
    } finally {
      setIsLoadingEthereumAllStakes(false);
    }
  };

  // Load Ethereum active stakes
  const loadEthereumActiveStakes = async () => {
    setIsLoadingEthereumActiveStakes(true);
    try {
      const stakes = await hexStakingService.getAllActiveStakes();
      setEthereumActiveStakes(stakes);
    } catch (e) {
      console.error('Error loading Ethereum active stakes:', e);
    } finally {
      setIsLoadingEthereumActiveStakes(false);
    }
  };

  // Load PulseChain HEX staking data from The Graph
  const loadPulsechainStakingData = async () => {
    setIsLoadingPulsechainStaking(true);
    setPulsechainStakingError(null);
    try {
      const data = await pulsechainHexStakingService.getStakingMetrics();
      setPulsechainStakingData(data);
    } catch (e) {
      setPulsechainStakingData(null);
      setPulsechainStakingError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoadingPulsechainStaking(false);
    }
  };

  // Load PulseChain stake starts
  const loadPulsechainStakeStarts = async () => {
    setIsLoadingPulsechainAllStakes(true);
    try {
      const stakes = await pulsechainHexStakingService.getAllStakeStartsPaginated(1000);
      setPulsechainAllStakeStarts(stakes);
    } catch (e) {
      console.error('Error loading PulseChain stake starts:', e);
    } finally {
      setIsLoadingPulsechainAllStakes(false);
    }
  };

  // Load PulseChain active stakes
  const loadPulsechainActiveStakes = async () => {
    setIsLoadingPulsechainActiveStakes(true);
    try {
      const stakes = await pulsechainHexStakingService.getAllActiveStakes();
      setPulsechainActiveStakes(stakes);
    } catch (e) {
      console.error('Error loading PulseChain active stakes:', e);
    } finally {
      setIsLoadingPulsechainActiveStakes(false);
    }
  };

  // Handle Ethereum active stakes sorting
  const handleEthereumActiveStakesSort = (field: 'stakeId' | 'stakedHearts' | 'stakedDays' | 'daysServed' | 'daysLeft') => {
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
        default:
          return 0;
      }
      
      return ethereumActiveStakesSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
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
  const handlePulsechainActiveStakesSort = (field: 'stakeId' | 'stakedHearts' | 'stakedDays' | 'daysServed' | 'daysLeft') => {
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
        default:
          return 0;
      }
      
      return pulsechainActiveStakesSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
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

  useEffect(() => {
    fetchData();
    
    // Set up auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Load initial staking data for both networks
  useEffect(() => {
    loadEthereumStakingData();
    loadPulsechainStakingData();
  }, []);

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
    return (value as number) >= 0 ? 'text-green-700' : 'text-red-600';
  };

  const getChangeIcon = (value: unknown) => {
    if (value === null || value === undefined) return null;
    return (value as number) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />;
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-32 h-32 mx-auto mb-6">
            <HexLoader />
          </div>
                          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <img src="/HEXagon (1).svg" alt="HEX" className="w-6 h-6" />
                  Loading HEX Data...
                </h2>
          <p className="text-slate-400">Fetching data from HEXDailyStats APIs</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
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
    <div className="min-h-screen bg-[#E6E6FA] p-4">
      <div className="max-w-full mx-auto">
        <div className="relative overflow-hidden rounded-2xl p-[1px] bg-gradient-to-br from-white/10 via-white/5 to-white/10 shadow-[0_0_40px_-15px_rgba(168,85,247,0.45)]">
          <div className="relative bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]">
            <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-purple-600/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -right-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

            {/* Header */}
            <div className="mb-6">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 rounded-xl bg-slate-900 text-white px-3 sm:px-4 py-3 border border-white/10 shadow-[0_6px_20px_-10px_rgba(0,0,0,0.6)]">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {activeTab === 'pulsechain' && 'pHEX'}
                {activeTab === 'ethereum' && 'eHEX'}
                {activeTab === 'ethereum-staking' && 'ETH Staking'}
                {activeTab === 'pulsechain-staking' && 'PLS Staking'}
              </h1>
            </div>
            
          </div>

          {/* Network Tabs */}
          <div className="border-b border-white/10 mb-4">
            <nav className="-mb-px flex flex-wrap gap-1 sm:gap-4 lg:gap-8">
              <button
                onClick={() => {
                  setActiveTab('pulsechain');
                  setCurrentPage(1);
                }}
                className={`py-1.5 sm:py-2 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  activeTab === 'pulsechain'
                    ? 'border-purple-500 text-purple-500'
                    : 'border-transparent text-gray-700 hover:text-green-600'
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
                className={`py-1.5 sm:py-2 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  activeTab === 'ethereum'
                    ? 'border-purple-500 text-purple-500'
                    : 'border-transparent text-gray-700 hover:text-green-600'
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
                className={`py-1.5 sm:py-2 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                  activeTab === 'ethereum-staking'
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-gray-700 hover:text-green-600'
                }`}
              >
                <Lock className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Ethereum HEX Staking</span>
                <span className="sm:hidden">ETH Staking</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('pulsechain-staking');
                  setCurrentPage(1);
                }}
                className={`py-1.5 sm:py-2 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                  activeTab === 'pulsechain-staking'
                    ? 'border-pink-700 text-pink-700'
                    : 'border-transparent text-gray-700 hover:text-green-600'
                }`}
              >
                <Lock className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">PulseChain HEX Staking</span>
                <span className="sm:hidden">PLS Staking</span>
              </button>
            </nav>
          </div>

          {/* Filters */}
          {!activeTab.includes('staking') && (
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="border border-white/10 bg-white/5 backdrop-blur text-gray-700 rounded px-3 py-1 text-sm"
                  placeholder="Filter by date"
                />
              </div>
              <button
                onClick={() => setShowGeminiAnalysis(!showGeminiAnalysis)}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 sm:px-4 rounded-lg text-sm sm:text-base"
              >
                <span className="hidden sm:inline">{showGeminiAnalysis ? 'Hide' : 'Ask'} AI</span>
                <span className="sm:hidden">{showGeminiAnalysis ? 'Hide AI' : 'Ask AI'}</span>
              </button>
            </div>
          )}
        </div>

                {/* Live Stats Section */}
        {!activeTab.includes('staking') && liveData ? (
          <div className="mb-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] p-6">
            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-xl font-bold text-gray-700 flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  Live {activeTab === 'ethereum' ? 'Ethereum' : 'PulseChain'} HEX Stats
                </h3>
              
            </div>
            
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4 mb-6">
              <div className="text-center p-3">
                <div className="text-2xl font-bold text-black">
                  {activeTab === 'ethereum' 
                    ? formatPrice(liveData.price, 8)
                    : formatPrice(liveData.price_Pulsechain || liveData.pricePulseX, 8)
                  }
                </div>
                <div className="text-sm text-gray-700 text-center">
                  HEX Price
                </div>
              </div>
              <div className="text-center p-3">
                <div className="text-2xl font-bold text-black">
                  {activeTab === 'ethereum' 
                    ? formatNumber(liveData.tsharePrice, 0)
                    : formatNumber(liveData.tsharePrice_Pulsechain, 0)
                  }
                </div>
                <div className="text-sm text-gray-700 text-center">
                  T-Share Price
                </div>
              </div>
              <div className="text-center p-3">
                <div className="text-2xl font-bold text-black">
                  {activeTab === 'ethereum' 
                    ? formatNumber(liveData.tshareRateHEX, 1)
                    : formatNumber(liveData.tshareRateHEX_Pulsechain, 1)
                  }
                </div>
                <div className="text-sm text-gray-700 text-center">
                  T-Share Rate (HEX)
                </div>
              </div>
              <div className="text-center p-3">
                <div className="text-2xl font-bold text-black">
                  {activeTab === 'ethereum' 
                    ? formatNumber(liveData.stakedHEX, 0)
                    : formatNumber(liveData.stakedHEX_Pulsechain, 0)
                  }
                </div>
                <div className="text-sm text-gray-700">Staked HEX</div>
              </div>
              <div className="text-center p-3">
                <div className="text-2xl font-bold text-black">
                  {activeTab === 'ethereum' 
                    ? formatNumber(liveData.circulatingHEX, 0)
                    : formatHEX(liveData.circulatingHEX_Pulsechain)
                  }
                </div>
                <div className="text-sm text-gray-700">Circulating HEX</div>
              </div>
              <div className="text-center p-3">
                <div className="text-2xl font-bold text-black">
                  {activeTab === 'ethereum' 
                    ? formatPrice(liveData.payoutPerTshare, 2)
                    : formatNumber(liveData.payoutPerTshare_Pulsechain, 2)
                  }
                </div>
                <div className="text-sm text-gray-700 text-center">
                  Payout/T-Share
                </div>
              </div>
            </div>

            {/* Network-Specific Liquidity Metrics */}
            <div className="border-t border-white/10 pt-4">
              <h4 className="text-md font-semibold text-black mb-3">💧 Liquidity Metrics ({activeTab === 'ethereum' ? 'Ethereum' : 'PulseChain'})</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                <div className="text-center p-2">
                  <div className="text-lg font-bold text-black">
                    {activeTab === 'ethereum' 
                      ? formatHEX(liveData.liquidityHEX)
                      : formatHEX(liveData.liquidityHEX_Pulsechain)
                    }
                  </div>
                  <div className="text-xs text-gray-700 flex items-center justify-center gap-1">
                    <img src="/HEXagon (1).svg" alt="HEX" className="w-3 h-3" />
                    Liquidity HEX
                  </div>
                </div>
                <div className="text-center p-2">
                  <div className="text-lg font-bold text-black">
                    {activeTab === 'ethereum' 
                      ? formatCurrency(liveData.liquidityUSDC, 0)
                      : formatNumber(liveData.liquidityPLS_Pulsechain, 0)
                    }
                  </div>
                  <div className="text-xs text-gray-700 flex items-center justify-center gap-1">
                    {activeTab === 'ethereum' ? (
                      <>
                        <img src="/ethlogo.svg" alt="Ethereum" className="w-3 h-3" />
                        Liquidity USDC
                      </>
                    ) : (
                      <>
                        <img src="/LogoVector.svg" alt="PulseChain" className="w-3 h-3" />
                        Liquidity PLS
                      </>
                    )}
                  </div>
                </div>
                <div className="text-center p-2">
                  <div className="text-lg font-bold text-black">
                    {activeTab === 'ethereum' 
                      ? formatNumber(liveData.liquidityETH, 0)
                      : formatNumber(liveData.liquidityEHEX_Pulsechain, 0)
                    }
                  </div>
                  <div className="text-xs text-gray-700 flex items-center justify-center gap-1">
                    {activeTab === 'ethereum' ? (
                      <>
                        <img src="/ethlogo.svg" alt="Ethereum" className="w-3 h-3" />
                        Liquidity ETH
                      </>
                    ) : (
                      <>
                        <img src="/HEXagon (1).svg" alt="HEX" className="w-3 h-3" />
                        Liquidity EHEX
                      </>
                    )}
                  </div>
                </div>
                <div className="text-center p-2">
                  <div className="text-2xl font-bold text-black">
                    {activeTab === 'ethereum' 
                      ? formatNumber(liveData.penaltiesHEX, 0)
                      : formatNumber(liveData.penaltiesHEX_Pulsechain, 0)
                    }
                  </div>
                  <div className="text-xs text-gray-700 flex items-center justify-center gap-1">
                    <img src="/HEXagon (1).svg" alt="HEX" className="w-3 h-3" />
                    Penalties HEX
                  </div>
                </div>
              </div>
              
               {/* PulseChain-specific token prices removed per request */}
             </div>
           </div>
         ) : !activeTab.includes('staking') && (
            <div className="mb-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] p-6">
             <div className="flex items-center justify-between mb-4">
               <h3 className="text-xl font-bold text-white flex items-center gap-2">
                 <div className="w-3 h-3 bg-yellow-400 rounded-full animate-spin"></div>
                 Loading Live Stats...
               </h3>
             </div>
             <div className="text-center text-slate-400">
               <p>Fetching latest live data...</p>
             </div>
           </div>
         )}

        {/* Gemini AI Analysis */}
        {showGeminiAnalysis && currentData.length > 0 && currentData[0]?.priceUV2UV3 && (
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
        )}
        {showGeminiAnalysis && (!currentData.length || !currentData[0]?.priceUV2UV3) && (
          <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-500/50 text-yellow-300 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="font-medium">⚠️ Data Loading</span>
            </div>
            <p className="text-sm mt-1 flex items-center gap-2">
              <img src="/HEXagon (1).svg" alt="HEX" className="w-4 h-4" />
              Please wait for HEX data to fully load before running AI analysis. 
              Current data points: {currentData.length}
              {currentData[0] && ` | Latest price: $${currentData[0].priceUV2UV3 || 'N/A'}`}
            </p>
          </div>
        )}

        {/* Ethereum Staking Data Display */}
        {activeTab === 'ethereum-staking' && (
          <div className="space-y-6">
            {isLoadingEthereumStaking && (
              <div className="text-center py-12">
                <RefreshCw className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading Ethereum HEX Staking Data...</h2>
                <p className="text-slate-400">Fetching data from The Graph API</p>
              </div>
            )}

            {ethereumStakingError && (
              <div className="text-center py-12">
                <div className="bg-red-900/20 border border-red-500/50 text-red-300 px-4 py-3 rounded mb-4">
                  <h2 className="font-bold text-lg mb-2">Error Loading Ethereum Staking Data</h2>
                  <p className="mb-4">{ethereumStakingError}</p>
                  
                </div>
              </div>
            )}

            {ethereumStakingData && !isLoadingEthereumStaking && !ethereumStakingError && (
              <>
                {/* Ethereum Staking Sub-Tabs */}
                <div className="border-b border-white/10 mb-6">
                  <nav className="-mb-px flex space-x-8">
                    <button
                      onClick={() => setEthereumStakingSubTab('overview')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        ethereumStakingSubTab === 'overview'
                          ? 'border-blue-500 text-white'
                          : 'border-transparent text-gray-700 hover:text-green-300'
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
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        ethereumStakingSubTab === 'all-stakes'
                          ? 'border-blue-500 text-white'
                          : 'border-transparent text-gray-700 hover:text-green-300'
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
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        ethereumStakingSubTab === 'active-stakes'
                          ? 'border-blue-500 text-white'
                          : 'border-transparent text-gray-700 hover:text-green-300'
                      }`}
                    >
                      Active Stakes
                    </button>
                    <button
                      onClick={() => setEthereumStakingSubTab('ai-timing')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        ethereumStakingSubTab === 'ai-timing'
                          ? 'border-blue-500 text-white'
                          : 'border-transparent text-gray-700 hover:text-green-300'
                      }`}
                    >
                      AI Timing
                    </button>
                  </nav>
                </div>

                {ethereumStakingSubTab === 'overview' && (
                  <>
                    {/* Ethereum Staking Overview Metrics */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-blue-400 flex items-center gap-2">
                      <Lock className="w-5 h-5" />
                      Ethereum HEX Staking Overview
                    </h3>

                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4">
                      <div className="text-2xl font-bold text-blue-400">
                        {ethereumStakingData.globalInfo?.latestStakeId || 'N/A'}
                      </div>
                      <div className="text-sm text-slate-400">Latest Stake ID</div>
                    </div>
                    <div className="text-center p-4">
                      <div className="text-2xl font-bold text-purple-400">
                        {ethereumStakingData.totalActiveStakes.toLocaleString()}
                      </div>
                      <div className="text-sm text-slate-400">Active Stakes</div>
                    </div>
                    <div className="text-center p-4">
                      <div className="text-2xl font-bold text-green-400">
                        {hexStakingService.formatHexAmount(ethereumStakingData.totalStakedHearts)} HEX
                      </div>
                      <div className="text-sm text-slate-400">Total Staked</div>
                    </div>
                    <div className="text-center p-4">
                      <div className="text-2xl font-bold text-orange-400">
                        {hexStakingService.formatStakeLength(Math.round(ethereumStakingData.averageStakeLength))}
                      </div>
                      <div className="text-sm text-slate-400">Avg Stake Length</div>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-white/10 pt-4">
                    <h4 className="text-md font-semibold text-white mb-3">Ethereum Protocol Global Metrics</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3">
                        <div className="text-lg font-bold text-cyan-400">
                          {ethereumStakingData.globalInfo ? hexStakingService.formatHexAmount(ethereumStakingData.globalInfo.stakeSharesTotal) : 'N/A'}
                        </div>
                        <div className="text-xs text-slate-400">Stake Shares Total</div>
                      </div>
                      <div className="text-center p-3">
                        <div className="text-lg font-bold text-yellow-400">
                          {ethereumStakingData.globalInfo?.hexDay || 'N/A'}
                        </div>
                        <div className="text-xs text-slate-400">Current HEX Day</div>
                      </div>
                      <div className="text-center p-3">
                        <div className="text-lg font-bold text-emerald-400">
                          {ethereumStakingData.globalInfo ? hexStakingService.formatHexAmount(ethereumStakingData.globalInfo.lockedHeartsTotal) : 'N/A'} HEX
                        </div>
                        <div className="text-xs text-slate-400">Locked Hearts Total</div>
                      </div>
                      <div className="text-center p-3">
                        <div className="text-lg font-bold text-red-400">
                          {ethereumStakingData.globalInfo ? hexStakingService.formatHexAmount(ethereumStakingData.globalInfo.stakePenaltyTotal) : 'N/A'} HEX
                        </div>
                        <div className="text-xs text-slate-400">Penalties Total</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ethereum Top Stakes Visual Display */}
                <TopStakesVisual stakes={ethereumStakingData.topStakes} />
                  </>
                )}

                {ethereumStakingSubTab === 'ai-timing' && (
                  <EndstakeTimingAI />
                )}

                {ethereumStakingSubTab === 'all-stakes' && (
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          All Ethereum HEX Stake Start Events
                        </h4>
                        <p className="text-sm text-slate-400 mt-1">
                          All Ethereum HEX stake start events from The Graph API
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-slate-400">
                          {ethereumAllStakeStarts.length.toLocaleString()} total stakes
                        </div>
                      </div>
                    </div>

                    {isLoadingEthereumAllStakes && (
                      <div className="text-center py-12">
                        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
                        <p className="text-gray-700">Loading all Ethereum stake starts...</p>
                        <p className="text-slate-400 text-sm">Fetching from The Graph API...</p>
                      </div>
                    )}

                    {!isLoadingEthereumAllStakes && ethereumAllStakeStarts.length > 0 && (
                      <div className="overflow-auto max-h-[70vh]">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-800/60 border border-gray-300 sticky top-0">
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
                                <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                                  {stake.stakeId}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-300 font-mono">
                                  <a
                                    href={`https://etherscan.io/address/${stake.stakerAddr}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-blue-400 transition-colors"
                                    title={stake.stakerAddr}
                                  >
                                    {stake.stakerAddr.slice(0, 10)}...{stake.stakerAddr.slice(-8)}
                                  </a>
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-emerald-400 font-semibold">
                                  {hexStakingService.formatHexAmount(stake.stakedHearts)} HEX
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-pink-400">
                                  {hexStakingService.formatHexAmount(stake.stakeShares)}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-sky-400">
                                  {hexStakingService.formatStakeLength(parseInt(stake.stakedDays))}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-amber-400">
                                  Day {stake.startDay}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-cyan-400">
                                  Day {stake.endDay}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-yellow-400">
                                  {hexStakingService.formatTShareAmount(stake.stakeTShares)}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-400">
                                  {new Date(parseInt(stake.timestamp) * 1000).toLocaleDateString()}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                                  <a
                                    href={`https://etherscan.io/tx/${stake.transactionHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-blue-400 transition-colors"
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
                          <div className="px-6 py-4 border-t border-white/10 text-center text-slate-400">
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
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          All Ethereum Active HEX Stakes (Not Ended)
                        </h4>
                        <p className="text-sm text-slate-400 mt-1">
                          Ethereum stakes that have started but not yet ended or been emergency ended
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-slate-400">
                          {ethereumActiveStakes.length.toLocaleString()} active stakes
                        </div>

                      </div>
                    </div>

                    {isLoadingEthereumActiveStakes && (
                      <div className="text-center py-12">
                        <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
                        <p className="text-gray-700">Loading all Ethereum active stakes...</p>
                        <p className="text-slate-400 text-sm">Cross-referencing starts vs ends...</p>
                        <p className="text-slate-400 text-xs mt-2">This process fetches all stake starts and ends to determine which are still active</p>
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
                              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">Staker Address</th>
                              <th 
                                className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors bg-gray-800/60 text-white"
                                onClick={() => handleEthereumActiveStakesSort('stakedHearts')}
                              >
                                <div className="flex items-center gap-1">
                                  Staked Hearts
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
                            {getSortedEthereumActiveStakes().slice(0, 1000).map((stake, index) => {
                              const progress = stake.daysServed / parseInt(stake.stakedDays) * 100;
                              const isNearEnd = stake.daysLeft <= 30;
                              const isOverdue = stake.daysLeft < 0;
                              
                              return (
                                <tr key={stake.id} className="hover:bg-gray-100">
                                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                                    {stake.stakeId}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-300 font-mono">
                                    <button
                                      onClick={() => handleEthereumStakerClick(stake.stakerAddr)}
                                      className="hover:text-blue-400 transition-colors cursor-pointer underline decoration-blue-400/60 decoration-2 underline-offset-2"
                                      title={`${stake.stakerAddr} - Click to view staking history`}
                                    >
                                      {stake.stakerAddr.slice(0, 10)}...{stake.stakerAddr.slice(-8)}
                                    </button>
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-emerald-400 font-semibold">
                                    {hexStakingService.formatHexAmount(stake.stakedHearts)} HEX
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-pink-400">
                                    {hexStakingService.formatTShareAmount(stake.stakeTShares)}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-sky-400">
                                    {hexStakingService.formatStakeLength(parseInt(stake.stakedDays))}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-amber-400">
                                    {stake.daysServed.toLocaleString()} days
                                  </td>
                                  <td className={`px-3 py-4 whitespace-nowrap text-sm font-semibold ${
                                    isOverdue ? 'text-red-400' : isNearEnd ? 'text-yellow-400' : 'text-cyan-400'
                                  }`}>
                                    {isOverdue ? `${Math.abs(stake.daysLeft)} overdue` : `${stake.daysLeft} days`}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm">
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 bg-slate-700 rounded-full h-2">
                                        <div 
                                          className={`h-2 rounded-full transition-all duration-300 ${
                                            isOverdue ? 'bg-red-500' : progress > 90 ? 'bg-yellow-500' : 'bg-green-600'
                                          }`}
                                          style={{ width: `${Math.min(100, progress)}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-slate-400">
                                        {progress.toFixed(1)}%
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-cyan-400">
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
                                      className="hover:text-blue-400 transition-colors"
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
                        
                        {ethereumActiveStakes.length > 1000 && (
                          <div className="px-6 py-4 border-t border-white/10 text-center text-slate-400">
                            Showing first 1,000 of {ethereumActiveStakes.length.toLocaleString()} Ethereum active stakes
                            <br />
                            <span className="text-xs">Full dataset loaded in memory for analysis</span>
                          </div>
                        )}
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
                <RefreshCw className="w-12 h-12 animate-spin text-purple-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading PulseChain HEX Staking Data...</h2>
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
                  <nav className="-mb-px flex space-x-8">
                    <button
                      onClick={() => setPulsechainStakingSubTab('overview')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        pulsechainStakingSubTab === 'overview'
                          ? 'border-purple-500 text-purple-400'
                          : 'border-transparent text-slate-400 hover:text-green-300'
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
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        pulsechainStakingSubTab === 'all-stakes'
                          ? 'border-purple-500 text-purple-400'
                          : 'border-transparent text-slate-400 hover:text-green-300'
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
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        pulsechainStakingSubTab === 'active-stakes'
                          ? 'border-purple-500 text-purple-400'
                          : 'border-transparent text-slate-400 hover:text-green-300'
                      }`}
                    >
                      Active Stakes
                    </button>
                    <button
                      onClick={() => setPulsechainStakingSubTab('ai-timing')}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        pulsechainStakingSubTab === 'ai-timing'
                          ? 'border-purple-500 text-purple-400'
                          : 'border-transparent text-slate-400 hover:text-green-300'
                      }`}
                    >
                      AI Timing
                    </button>
                  </nav>
                </div>

                {pulsechainStakingSubTab === 'overview' && (
                  <>
                    {/* PulseChain Staking Overview Metrics */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-purple-400 flex items-center gap-2">
                      <Lock className="w-5 h-5" />
                      PulseChain HEX Staking Overview
                    </h3>

                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4">
                      <div className="text-2xl font-bold text-purple-400">
                        {pulsechainStakingData.globalInfo?.latestStakeId || 'N/A'}
                      </div>
                      <div className="text-sm text-slate-400">Latest Stake ID</div>
                    </div>
                    <div className="text-center p-4">
                      <div className="text-2xl font-bold text-purple-400">
                        {pulsechainStakingData.totalActiveStakes.toLocaleString()}
                      </div>
                      <div className="text-sm text-slate-400">Active Stakes</div>
                    </div>
                    <div className="text-center p-4">
                      <div className="text-2xl font-bold text-green-400">
                        {pulsechainHexStakingService.formatHexAmount(pulsechainStakingData.totalStakedHearts)} HEX
                      </div>
                      <div className="text-sm text-slate-400">Total Staked</div>
                    </div>
                    <div className="text-center p-4">
                      <div className="text-2xl font-bold text-orange-400">
                        {pulsechainHexStakingService.formatStakeLength(Math.round(pulsechainStakingData.averageStakeLength))}
                      </div>
                      <div className="text-sm text-slate-400">Avg Stake Length</div>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-white/10 pt-4">
                    <h4 className="text-md font-semibold text-white mb-3">PulseChain Protocol Global Metrics</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3">
                        <div className="text-lg font-bold text-cyan-400">
                          {pulsechainStakingData.globalInfo ? pulsechainHexStakingService.formatHexAmount(pulsechainStakingData.globalInfo.stakeSharesTotal) : 'N/A'}
                        </div>
                        <div className="text-xs text-slate-400">Stake Shares Total</div>
                      </div>
                      <div className="text-center p-3">
                        <div className="text-lg font-bold text-yellow-400">
                          {pulsechainStakingData.globalInfo?.hexDay || 'N/A'}
                        </div>
                        <div className="text-xs text-slate-400">Current HEX Day</div>
                      </div>
                      <div className="text-center p-3">
                        <div className="text-lg font-bold text-emerald-400">
                          {pulsechainStakingData.globalInfo ? pulsechainHexStakingService.formatHexAmount(pulsechainStakingData.globalInfo.lockedHeartsTotal) : 'N/A'} HEX
                        </div>
                        <div className="text-xs text-slate-400">Locked Hearts Total</div>
                      </div>
                      <div className="text-center p-3">
                        <div className="text-lg font-bold text-red-400">
                          {pulsechainStakingData.globalInfo ? pulsechainHexStakingService.formatHexAmount(pulsechainStakingData.globalInfo.stakePenaltyTotal) : 'N/A'} HEX
                        </div>
                        <div className="text-xs text-slate-400">Penalties Total</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PulseChain Top Stakes Visual Display */}
                <TopStakesVisual stakes={pulsechainStakingData.topStakes} />
                  </>
                )}

                {pulsechainStakingSubTab === 'ai-timing' && (
                  <EndstakeTimingAI />
                )}

                {pulsechainStakingSubTab === 'all-stakes' && (
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
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
                        <RefreshCw className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-4" />
                        <p className="text-gray-700">Loading all PulseChain stake starts...</p>
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
                                    className="hover:text-purple-400 transition-colors"
                                    title={stake.stakerAddr}
                                  >
                                    {stake.stakerAddr.slice(0, 10)}...{stake.stakerAddr.slice(-8)}
                                  </a>
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-emerald-400 font-semibold">
                                  {pulsechainHexStakingService.formatHexAmount(stake.stakedHearts)} HEX
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-pink-400">
                                  {pulsechainHexStakingService.formatHexAmount(stake.stakeShares)}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-sky-400">
                                  {pulsechainHexStakingService.formatStakeLength(parseInt(stake.stakedDays))}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-amber-400">
                                  {stake.daysServed.toLocaleString()} days
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-cyan-400">
                                  Day {stake.endDay}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-yellow-400">
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
                                    className="hover:text-purple-400 transition-colors"
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
                          <div className="px-6 py-4 border-t border-white/10 text-center text-slate-400">
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
                  <div className="bg-grey/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          All PulseChain Active HEX Stakes (Not Ended)
                        </h4>
                        <p className="text-sm text-slate-400 mt-1">
                          PulseChain stakes that have started but not yet ended or been emergency ended
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-slate-400">
                          {pulsechainActiveStakes.length.toLocaleString()} active stakes
                        </div>
                      </div>
                    </div>

                    {isLoadingPulsechainActiveStakes && (
                      <div className="text-center py-12">
                        <RefreshCw className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-4" />
                        <p className="text-gray-700">Loading all PulseChain active stakes...</p>
                        <p className="text-slate-400 text-sm">Cross-referencing starts vs ends...</p>
                        <p className="text-slate-400 text-xs mt-2">This process fetches all stake starts and ends to determine which are still active</p>
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
                              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">Progress</th>
                              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">End Day</th>
                              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider bg-gray-800/60 text-white">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody className="bg-transparent divide-y divide-gray-200">
                            {getSortedPulsechainActiveStakes().slice(0, 1000).map((stake, index) => {
                              const progress = stake.daysServed / parseInt(stake.stakedDays) * 100;
                              const isNearEnd = stake.daysLeft <= 30;
                              const isOverdue = stake.daysLeft < 0;
                              
                              return (
                                <tr key={stake.id} className="hover:bg-gray-100">
                                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                                    {stake.stakeId}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-300 font-mono">
                                    <button
                                      onClick={() => handlePulsechainStakerClick(stake.stakerAddr)}
                                      className="hover:text-purple-400 transition-colors cursor-pointer underline decoration-purple-400/60 decoration-2 underline-offset-2"
                                      title={`${stake.stakerAddr} - Click to view staking history`}
                                    >
                                      {stake.stakerAddr.slice(0, 10)}...{stake.stakerAddr.slice(-8)}
                                    </button>
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-emerald-400 font-semibold">
                                    {pulsechainHexStakingService.formatHexAmount(stake.stakedHearts)} HEX
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-pink-400">
                                    {pulsechainHexStakingService.formatTShareAmount(stake.stakeTShares)}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-sky-400">
                                    {pulsechainHexStakingService.formatStakeLength(parseInt(stake.stakedDays))}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-amber-400">
                                    {stake.daysServed.toLocaleString()} days
                                  </td>
                                  <td className={`px-3 py-4 whitespace-nowrap text-sm font-semibold ${
                                    isOverdue ? 'text-red-400' : isNearEnd ? 'text-yellow-400' : 'text-cyan-400'
                                  }`}>
                                    {isOverdue ? `${Math.abs(stake.daysLeft)} overdue` : `${stake.daysLeft} days`}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm">
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 bg-slate-700 rounded-full h-2">
                                        <div 
                                          className={`h-2 rounded-full transition-all duration-300 ${
                                            isOverdue ? 'bg-red-500' : progress > 90 ? 'bg-yellow-500' : 'bg-green-600'
                                          }`}
                                          style={{ width: `${Math.min(100, progress)}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-slate-400">
                                        {progress.toFixed(1)}%
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-cyan-400">
                                    Day {stake.endDay}
                                  </td>
                                  <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-400">
                                    {new Date(parseInt(stake.timestamp) * 1000).toLocaleDateString()}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        
                        {pulsechainActiveStakes.length > 1000 && (
                          <div className="px-6 py-4 border-t border-white/10 text-center text-slate-400">
                            Showing first 1,000 of {pulsechainActiveStakes.length.toLocaleString()} PulseChain active stakes
                            <br />
                            <span className="text-xs">Full dataset loaded in memory for analysis</span>
                          </div>
                        )}
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
          <div className="bg-black/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
          <div className="overflow-auto max-h-[70vh]">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-800/60 border border-gray-300 sticky top-0">
                <tr>
                  {[
                    { key: 'date', label: 'Date', width: 'w-32', color: 'text-white' },
                    { key: 'currentDay', label: 'Day', width: 'w-20', color: 'text-white' },
                    { key: 'priceUV2UV3', label: 'HEX Price (USD)', width: 'w-28', color: 'text-green-600' },
                    { key: 'priceChangeUV2UV3', label: 'Price Change (%)', width: 'w-24', color: 'text-white' },
                    { key: 'marketCap', label: 'Market Cap', width: 'w-32', color: 'text-white' },
                    { key: 'totalValueLocked', label: 'Total Value Locked', width: 'w-32', color: 'text-purple-500' },
                    { key: 'totalHEX', label: 'Total Supply', width: 'w-32', color: 'text-white' },
                    { key: 'circulatingHEX', label: 'Circulating Supply', width: 'w-32', color: 'text-white' },
                    { key: 'circulatingSupplyChange', label: 'Circulation Change', width: 'w-32', color: 'text-green-600' },
                    { key: 'stakedHEX', label: 'Staked Supply', width: 'w-32', color: 'text-blue-600' },
                    { key: 'stakedSupplyChange', label: 'Staked Change', width: 'w-32', color: 'text-green-600' },
                    { key: 'stakedHEXPercent', label: 'Staked %', width: 'w-24', color: 'text-blue-600' },
                    { key: 'totalTshares', label: 'Total T-Shares', width: 'w-32', color: 'text-purple-600' },
                    { key: 'totalTsharesChange', label: 'T-Shares Change', width: 'w-32', color: 'text-green-600' },
                    { key: 'tshareRateHEX', label: 'T-Share Rate (HEX)', width: 'w-32', color: 'text-orange-600' },
                    { key: 'tshareMarketCap', label: 'T-Share Market Cap', width: 'w-32', color: 'text-purple-600' },
                    { key: 'payoutPerTshareHEX', label: 'Payout/T-Share', width: 'w-28', color: 'text-yellow-600' },
                    { key: 'dailyPayoutHEX', label: 'Daily Payout', width: 'w-32', color: 'text-green-600' },
                    { key: 'dailyMintedInflationTotal', label: 'Daily Inflation', width: 'w-32', color: 'text-green-600' },
                    { key: 'actualAPYRate', label: 'APY Rate (%)', width: 'w-24', color: 'text-orange-600' },
                    { key: 'currentStakerCount', label: 'Active Stakers', width: 'w-28', color: 'text-blue-700' },
                    { key: 'currentStakerCountChange', label: 'Staker Change', width: 'w-28', color: 'text-green-600' },
                    { key: 'currentHolders', label: 'Current Holders', width: 'w-28', color: 'text-orange-800' },
                    { key: 'currentHoldersChange', label: 'Holder Change', width: 'w-28', color: 'text-green-600' },
                    { key: 'numberOfHolders', label: 'Total Holders', width: 'w-28', color: 'text-red-600' },
                    { key: 'averageStakeLength', label: 'Avg Stake Length', width: 'w-28', color: 'text-yellow-700' },
                    { key: 'penaltiesHEX', label: 'Penalties (HEX)', width: 'w-32', color: 'text-red-400' },
                    { key: 'roiMultiplierFromATL', label: 'ROI from ATL', width: 'w-28', color: 'text-emerald-700' },
                    ...(activeTab === 'ethereum' ? [
                      { key: 'priceBTC', label: 'BTC Price', width: 'w-28', color: 'text-orange-700' },
                      { key: 'priceETH', label: 'ETH Price', width: 'w-28', color: 'text-blue-700' },
                    ] : []),
                    ...(activeTab === 'pulsechain' ? [
                      { key: 'pricePulseX', label: 'PulseX Price', width: 'w-28', color: 'text-pink-700' },
                      { key: 'pricePulseX_PLS', label: 'PLS Price', width: 'w-28', color: 'text-pink-700' },
                    ] : [])
                  ].map((column) => {
                    return (
                      <th
                        key={column.key}
                        onClick={() => handleSort(column.key as keyof HexRow)}
                        className={`sticky top-0 z-10 bg-gray-800/60 backdrop-blur-xl border border-gray-300 px-3 py-3 text-center text-sm font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/60 transition-colors select-none ${column.color}`}
                      >
                        <div className="flex items-center gap-1">
                          {column.label}
                          {sortConfig.key === column.key && (
                            sortConfig.direction === 'asc' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="bg-transparent divide-y divide-gray-200">
                {paginatedData.map((row, index) => (
                  <tr key={row._id || index} className="hover:bg-gray-100">
                    {/* Date */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                      {formatDate(row.date)}
                    </td>
                    {/* Current Day */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatNumber(row.currentDay, 0, true)}
                    </td>
                    {/* HEX Price */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">
                      {formatPrice(row.priceUV2UV3, 8)}
                    </td>
                    {/* Price Change */}
                    <td className={`px-3 py-4 whitespace-nowrap text-sm ${getChangeColor(row.priceChangeUV2UV3)}`}>
                      <div className="flex items-center gap-1">
                        {getChangeIcon(row.priceChangeUV2UV3)}
                        {formatPercent(row.priceChangeUV2UV3)}
                      </div>
                    </td>
                    {/* Market Cap */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatCurrency(row.marketCap, 0)}
                    </td>
                    {/* Total Value Locked */}
                    <td className="px-3 py-4 bg-black/5 text-sm text-purple-600 font-semibold">
                      {formatCurrency(row.totalValueLocked, 0)}
                    </td>
                    {/* Total Supply */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatHEX(row.totalHEX)}
                    </td>
                    {/* Circulating Supply */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatHEX(row.circulatingHEX)}
                    </td>
                    {/* Circulation Change */}
                    <td className={`px-3 py-4 whitespace-nowrap text-sm ${getChangeColor(row.circulatingSupplyChange)}`}>
                      <div className="flex items-center gap-1">
                        {getChangeIcon(row.circulatingSupplyChange)}
                        {formatHEX(row.circulatingSupplyChange)}
                      </div>
                    </td>
                    {/* Staked Supply */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-blue-600">
                      {formatHEX(row.stakedHEX)}
                    </td>
                    {/* Staked Change */}
                    <td className={`px-3 py-4 whitespace-nowrap text-sm ${getChangeColor(row.stakedSupplyChange)}`}>
                      <div className="flex items-center gap-1">
                        {getChangeIcon(row.stakedSupplyChange)}
                        {formatHEX(row.stakedSupplyChange)}
                      </div>
                    </td>
                    {/* Staked Percentage */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-blue-800">
                      {formatPercent(row.stakedHEXPercent)}
                    </td>
                    {/* Total T-Shares */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-purple-800">
                      {formatTShares(row.totalTshares)}
                    </td>
                    {/* T-Shares Change */}
                    <td className={`px-3 py-4 whitespace-nowrap text-sm ${getChangeColor(row.totalTsharesChange)}`}>
                      <div className="flex items-center gap-1">
                        {getChangeIcon(row.totalTsharesChange)}
                        {formatTShares(row.totalTsharesChange)}
                      </div>
                    </td>
                    {/* T-Share Rate */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-orange-700">
                      {formatPrice(row.tshareRateHEX, 8)}
                    </td>
                    {/* T-Share Market Cap */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-purple-800">
                      {formatCurrency(row.tshareMarketCap, 0)}
                    </td>
                    {/* Payout per T-Share */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-yellow-700">
                      {formatPrice(row.payoutPerTshareHEX, 8)}
                    </td>
                    {/* Daily Payout */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-green-800">
                      {formatHEX(row.dailyPayoutHEX)}
                    </td>
                    {/* Daily Inflation */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-green-800">
                      {formatHEX(row.dailyMintedInflationTotal)}
                    </td>
                    {/* APY Rate */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-orange-800">
                      {formatPercent(row.actualAPYRate)}
                    </td>
                    {/* Active Stakers */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-blue-800">
                      {formatNumber(row.currentStakerCount, 0)}
                    </td>
                    {/* Staker Change */}
                    <td className={`px-3 py-4 whitespace-nowrap text-sm ${getChangeColor(row.currentStakerCountChange)}`}>
                      <div className="flex items-center gap-1">
                        {getChangeIcon(row.currentStakerCountChange)}
                        {formatNumber(row.currentStakerCountChange, 0)}
                      </div>
                    </td>
                    {/* Current Holders */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-cyan-800">
                      {formatNumber(row.currentHolders, 0)}
                    </td>
                    {/* Holder Change */}
                    <td className={`px-3 py-4 whitespace-nowrap text-sm ${getChangeColor(row.currentHoldersChange)}`}>
                      <div className="flex items-center gap-1">
                        {getChangeIcon(row.currentHoldersChange)}
                        {formatNumber(row.currentHoldersChange, 0)}
                      </div>
                    </td>
                    {/* Total Holders */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-cyan-800">
                      {formatNumber(row.numberOfHolders, 0)}
                    </td>
                    {/* Average Stake Length */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-yellow-700">
                      {formatNumber(row.averageStakeLength, 1)} days
                    </td>
                    {/* Penalties */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-red-700">
                      {formatHEX(row.penaltiesHEX)}
                    </td>
                    {/* ROI from ATL */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-emerald-800">
                      {formatPercent(row.roiMultiplierFromATL)}
                    </td>
                    {/* Network-specific columns */}
                    {activeTab === 'ethereum' && (
                      <>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-orange-800">
                          {formatCurrency(row.priceBTC, 2)}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-blue-600">
                          {formatCurrency(row.priceETH, 2)}
                        </td>
                      </>
                    )}
                    {activeTab === 'pulsechain' && (
                      <>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-pink-800">
                          {formatPrice(row.pricePulseX, 8)}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-pink-600">
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
            <div className="bg-slate-800/30 px-4 py-3 flex items-center justify-between border-t border-slate-700">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md text-slate-300 bg-slate-800 hover:bg-slate-700"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-slate-600 text-sm font-medium rounded-md text-slate-300 bg-slate-800 hover:bg-slate-700"
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
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-600 bg-slate-800 text-sm font-medium text-slate-300 hover:bg-slate-700"
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
                              ? 'z-10 bg-purple-900/50 border-purple-500 text-purple-400'
                              : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-600 bg-slate-800 text-sm font-medium text-slate-300 hover:bg-slate-700"
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
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowDexPairs(false)} />
            <div className="relative w-full max-w-3xl bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.7)] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                <h3 className="text-white font-semibold">PulseChain HEX Liquidity Pairs (DexScreener)</h3>
                <button
                  onClick={() => setShowDexPairs(false)}
                  className="text-slate-300 hover:text-white text-sm"
                  aria-label="Close"
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
                        className="block rounded-lg border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition"
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
              className="font-semibold text-purple-300 hover:text-purple-200 underline decoration-purple-400/60 decoration-2 underline-offset-2"
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
      />

      {/* PulseChain Staker History Modal */}
      <StakerHistoryModal
        stakerAddress={selectedStakerAddress}
        isOpen={isPulsechainStakerHistoryModalOpen}
        onClose={handlePulsechainStakerHistoryModalClose}
        network="pulsechain"
      />
    </div>
  );
};

export default HEXDataDashboard;