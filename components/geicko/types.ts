/**
 * Type definitions for Geicko token analyzer
 */

// Re-export shared types from main types file
export type { ContractData, TokenInfo, DexScreenerData, SearchResultItem } from '../../types';

// UI preset modes
export type UIPreset = 'classic' | 'rabby1';

// Active tab identifiers
export type ActiveTab = 'gold' | 'chart' | 'holders' | 'liquidity' | 'contract' | 'switch' | 'website' | 'stats' | 'audit';

// Burned tokens data
export interface BurnedTokens {
  amount: number;
  percent: number;
}

// Contract ownership information
export interface OwnershipData {
  creatorAddress: string | null;
  ownerAddress: string | null;
  isRenounced: boolean;
  renounceTxHash: string | null;
  /** Set when token was created via a call to this address (e.g. pump.tires factory); used for badge. */
  creationTxTo?: string | null;
  /** True when token was created by or via a known Pump.tires contract (server-computed). */
  isPumpTiresToken?: boolean;
  isLoading: boolean;
}

// Supply held by top holders
export interface SupplyHeldData {
  top10: number;
  top20: number;
  top50: number;
  isLoading: boolean;
}

// Smart contract holder statistics
export interface ContractHolderItem {
  address: string;
  value: string;
  percent: number;
  type: 'LP' | 'Contract';
}

export interface SmartContractHolderData {
  percent: number;
  contractCount: number;
  /** @deprecated Use contractHolders for rich tooltip data */
  contractAddresses?: string[];
  /** Per-holder details for tooltip: address, value, percent, type (LP | Contract) */
  contractHolders?: ContractHolderItem[];
  isLoading: boolean;
}

// Total liquidity across pairs
export interface LiquidityData {
  usd: number;
  pairCount: number;
  isLoading: boolean;
}

// Total supply information
export interface TotalSupply {
  supply: string;
  decimals: number;
}

// Holder information
export interface Holder {
  address: string;
  value: string;
  isContract?: boolean;
  isVerified?: boolean;
}

// Holder statistics
export interface HolderStats {
  totalHolders: number;
  topBalance: number;
  topPct: number;
  lpCount: number;
  burnCount: number;
  contractCount: number;
}

// Transaction information
export interface Transaction {
  time: string;
  timestamp: number;
  type: 'BUY' | 'SELL' | 'TRANSFER';
  priceNative: number;
  priceUsd: number;
  amount: number;
  txHash: string;
  from: string;
  valueUsd: number;
}

// Holder transfer information
export interface HolderTransfer {
  txHash: string;
  timestamp: string | null;
  from: string;
  to: string;
  amount: number;
  direction: 'Buy' | 'Sell' | 'Transfer';
}

// Active fetch tracking for toast notifications
export interface ActiveFetch {
  statName: string;
  startTime: Date;
  progress: number;
  completed?: boolean;
  processed?: boolean;
  result?: any;
  duration?: number;
  completedAt?: number;
}

// Top token information
export interface TopToken {
  symbol: string;
  priceChange: number;
}

// Tab configuration
export interface TabConfig {
  id: ActiveTab;
  label: string;
}
