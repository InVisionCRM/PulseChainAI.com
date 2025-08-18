import type { HexDataPoint } from '@/lib/hooks/useHexGemini';
import type { HexStakingMetrics } from '@/services/hexStakingService';
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
  stakingData: HexStakingMetrics | null;
  isLoadingStaking: boolean;
  stakingError: string | null;
  allStakeStarts: any[];
  isLoadingAllStakes: boolean;
  stakingSubTab: StakingSubTab;
  activeStakes: any[];
  isLoadingActiveStakes: boolean;
}

// Component props interfaces
export interface TabNavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  setCurrentPage: (page: number) => void;
  ethereumDataLength: number;
  pulsechainDataLength: number;
  stakingData: HexStakingMetrics | null;
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
  setCurrentPage: (page: number) => void;
  activeTab: ActiveTab;
}

export interface StakingOverviewProps {
  stakingData: HexStakingMetrics | null;
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