// Consolidated type definitions for all blockchain services
// Replaces scattered type definitions across pulsechainService, pulsechainApiService, and moralisService

// Base blockchain types
export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  type: string;
  holders: number;
  exchange_rate?: string;
  total_supply?: string;
  circulating_market_cap?: string;
  icon_url?: string;
}

export interface TokenInfoDetailed extends TokenInfo {
  circulating_market_cap: string;
  icon_url: string;
  exchange_rate: string;
}

export interface TokenBalance {
  token: TokenInfo;
  value: string;
  token_id?: string | null;
}

export interface Holder {
  address: string;
  value: string;
  token_id?: string;
}

export interface HoldersResponse {
  items: Holder[];
  next_page_params?: any;
}

export interface Transaction {
  hash: string;
  block_number: number;
  from: string;
  to: string;
  value: string;
  gas_used: string;
  gas_price: string;
  status: string;
  timestamp: string;
  method?: string;
  fee?: string;
}

export interface TransactionResponse {
  items: Transaction[];
  next_page_params?: any;
}

// Token transfer entry (ERC-20/721/1155)
export interface TokenTransfer {
  transaction_hash: string;
  from: string;
  to: string;
  value: string;
  timestamp?: string;
  block_hash?: string;
  log_index?: number;
  token?: TokenInfo;
  total?: { value: string };
}

export interface AddressInfo {
  hash: string;
  is_contract: boolean;
  is_verified?: boolean;
  name?: string;
  coin_balance?: string;
  transactions_count?: number;
  token_balances_count?: number;
}

export interface ContractData {
  address: string;
  name: string;
  compiler_version: string;
  optimization_enabled: boolean;
  optimization_runs: number;
  evm_version: string;
  verified_at: string;
  source_code: string;
  constructor_args: string;
  abi: any[];
  creation_bytecode?: string;
  deployed_bytecode?: string;
  is_verified: boolean;
  is_partially_verified?: boolean;
  proxy_type?: string;
  implementation_address?: string;
}

export interface ReadMethodWithValue {
  inputs: any[];
  name: string;
  outputs: any[];
  stateMutability: string;
  type: string;
  value?: string;
}

export interface SearchResultItem {
  type: string;
  name: string;
  address: string;
  url: string;
  is_smart_contract_verified?: boolean;
}

export interface SearchResponse {
  items: SearchResultItem[];
}

export interface DexScreenerData {
  pairs?: Array<{
    baseToken: {
      address: string;
      name: string;
      symbol: string;
    };
    quoteToken: {
      address: string;
      name: string;
      symbol: string;
    };
    priceNative: string;
    priceUsd?: string;
    txns: {
      m5: { buys: number; sells: number };
      h1: { buys: number; sells: number };
      h6: { buys: number; sells: number };
      h24: { buys: number; sells: number };
    };
    volume: {
      m5: number;
      h1: number;
      h6: number;
      h24: number;
    };
    priceChange: {
      m5: number;
      h1: number;
      h6: number;
      h24: number;
    };
    liquidity?: {
      usd?: number;
      base: number;
      quote: number;
    };
    fdv?: number;
    marketCap?: number;
    pairCreatedAt?: number;
  }>;
}

// Network stats & charts
export interface StatsResponse {
  total_blocks: number;
  total_addresses: number;
  total_transactions: number;
  average_block_time: number;
  coin_price: string;
  total_gas_used?: string;
  transactions_today?: number;
  gas_used_today?: string;
}

export interface MarketChartItem {
  date: string;
  closing_price: number | string;
  market_cap: number | string;
}

export interface TransactionChartItem {
  date: string;
  transaction_count: number;
}

// API Response wrappers
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  next_page_params?: Record<string, any>;
  total_count?: number;
}

// Analysis types
export interface TokenAnalysis {
  tokenInfo: TokenInfoDetailed;
  holders: HoldersResponse;
  transfers: TransactionResponse;
  marketData?: DexScreenerData;
  burnedAmount?: string;
}

export interface HolderOverlap {
  token1: string;
  token2: string;
  commonHolders: Holder[];
  overlapPercentage: number;
}

export interface WhaleMovement {
  hash: string;
  from: string;
  to: string;
  value: string;
  token: TokenInfo;
  timestamp: string;
  isWhale: boolean;
  threshold: string;
}

// Error types
export interface ServiceError extends Error {
  code?: string;
  statusCode?: number;
  service?: string;
}

// Configuration types
export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  headers?: Record<string, string>;
}

export interface ServiceConfig {
  pulsechain: ApiConfig;
  moralis: {
    apiKey?: string;
    chainId: string;
  };
  dexscreener: ApiConfig;
}

// Additional models for comprehensive API coverage (Blockscout v2)
export interface Block {
  hash: string;
  number: number;
  timestamp: string;
  transactions_count: number;
  gas_used?: string;
  gas_limit?: string;
  base_fee_per_gas?: string;
  burnt_fees?: string;
  miner?: string;
}

export interface InternalTransaction {
  transaction_hash: string;
  block_number: number;
  from: string;
  to: string;
  value: string;
  gas_limit?: string;
  gas_used?: string;
  success: boolean;
  error?: string;
  type?: string;
  created_contract?: string;
  timestamp?: string;
}

export interface LogEntry {
  transaction_hash: string;
  block_number: number;
  address: string;
  topics: string[];
  data: string;
  log_index?: number;
  decoded?: any;
}

export interface AddressCounters {
  transactions_count: number;
  token_transfers_count: number;
  gas_usage_count?: number;
  validations_count?: number;
}

export interface CoinBalanceHistoryEntry {
  block_number: number;
  block_timestamp: string;
  delta: string;
  value: string;
  transaction_hash?: string;
}

export interface Withdrawal {
  index: number;
  amount: string;
  validator_index: number;
  receiver: string;
  timestamp: string;
  block_number: number;
}

export interface RawTrace {
  action: any;
  result?: any;
  subtraces: number;
  traceAddress: number[];
  type: string;
  error?: string;
}

export interface StateChange {
  type: string;
  address: string;
  balance_before?: string;
  balance_after?: string;
  token?: TokenInfo;
}

export interface NFTInstance {
  id: string;
  token_id: string;
  owner: string;
  token: TokenInfo;
  metadata?: any;
  image_url?: string;
}