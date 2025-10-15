import type { HexDataPoint } from '@/lib/hooks/useHexGemini';
import type { HexStakingMetrics } from '@/services/hexStakingService';
import type { PulseChainHexStakingService } from '@/services/pulsechainHexStakingService';
import type { DexScreenerData } from '@/services/core/types';

// Core dashboard types
export type HexRow = HexDataPoint & {
  _id?: string;
  priceUV2?: number;
  priceUV3?: number;
  priceChangePulseX?: number;
};

export interface LiveData {
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

export type ActiveTab = 'pulsechain' | 'ethereum' | 'staking';
export type StakingSubTab = 'overview' | 'all-stakes' | 'active-stakes';

export interface SortConfig {
  key: keyof HexRow;
  direction: 'asc' | 'desc';
}

// Multi-network staking data interface
export interface MultiNetworkStakingData {
  ethereum: HexStakingMetrics | null;
  pulsechain: any | null; // Using any for now since PulseChain service returns different structure
  combined: {
    totalActiveStakes: number;
    totalStakedHearts: string;
    totalStakeShares: string;
    averageStakeLength: number;
    latestStakeId: string;
    hexDay: string;
  };
}

// Dashboard state interface
export interface DashboardState {
  ethereumData: HexRow[];
  pulsechainData: HexRow[];
  liveData: LiveData | null;
  activeTab: ActiveTab;
  isLoading: boolean;
  error: string | null;
  sortConfig: SortConfig;
  filterDate: string;
  currentPage: number;
  showGeminiAnalysis: boolean;
  showDexPairs: boolean;
  isLoadingDexPairs: boolean;
  dexPairs: NonNullable<DexScreenerData['pairs']> | null;
  dexPairsError: string | null;
  stakingData: MultiNetworkStakingData | null;
  isLoadingStaking: boolean;
  stakingError: string | null;
  allStakeStarts: any[];
  isLoadingAllStakes: boolean;
  stakingSubTab: StakingSubTab;
  activeStakes: any[];
  isLoadingActiveStakes: boolean;
  // PulseChain specific staking data
  pulsechainStakeStarts: any[];
  pulsechainActiveStakes: any[];
  isLoadingPulsechainStakes: boolean;
}

// Component props interfaces
export interface TabNavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  ethereumDataLength: number;
  pulsechainDataLength: number;
  stakingData: MultiNetworkStakingData | null;
  loadStakingData: () => void;
}

export interface LiveStatsProps {
  liveData: LiveData | null;
  activeTab: ActiveTab;
  isLoading: boolean;
}

export interface DataTableProps {
  data: HexRow[];
  sortConfig: SortConfig;
  setSortConfig: (config: SortConfig) => void;
  currentPage: number;
  itemsPerPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  activeTab: ActiveTab;
}

export interface StakingOverviewProps {
  stakingData: MultiNetworkStakingData | null;
  isLoadingStaking: boolean;
  stakingError: string | null;
  loadStakingData: () => void;
  stakingSubTab: StakingSubTab;
  setStakingSubTab: (tab: StakingSubTab) => void;
  allStakeStarts: any[];
  isLoadingAllStakes: boolean;
  loadAllStakeStarts: () => void;
  activeStakes: any[];
  isLoadingActiveStakes: boolean;
  loadActiveStakes: () => void;
  // PulseChain staking data
  pulsechainStakeStarts: any[];
  pulsechainActiveStakes: any[];
  isLoadingPulsechainStakes: boolean;
  loadPulsechainStakeStarts: () => void;
  loadPulsechainActiveStakes: () => void;
  getSortedPulsechainData: (type: 'stakeStarts' | 'activeStakes', sortBy: string, order: 'asc' | 'desc') => any[];
  getPulsechainCacheStatus: () => Promise<{
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
  }>;
  getCurrentHexPrice: () => number; // Function to get current HEX price
}

export interface DashboardActionsProps {
  fetchData: () => void;
  isLoading: boolean;
  showGeminiAnalysis: boolean;
  setShowGeminiAnalysis: (show: boolean) => void;
  setShowDexPairs: (show: boolean) => void;
  loadDexPairs: () => void;
}

export interface FilterControlsProps {
  filterDate: string;
  setFilterDate: (date: string) => void;
  paginatedDataLength: number;
  sortedDataLength: number;
  activeTab: ActiveTab;
}