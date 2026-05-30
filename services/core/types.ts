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

// Portfolio tracker types
export type ChainId = 'ethereum' | 'pulsechain';

export const CHAIN_NATIVE_SYMBOL: Record<ChainId, string> = {
  ethereum: 'ETH',
  pulsechain: 'PLS',
};

export const CHAIN_MORALIS_ID: Record<ChainId, string> = {
  ethereum: '0x1',
  pulsechain: '0x171',
};

// Native gas tokens can't be priced directly via DexScreener — instead we
// piggy-back on the price of the wrapped equivalent (1 PLS = 1 WPLS by
// definition of the wrapper contract, same for ETH/WETH).
export const WRAPPED_NATIVE: Record<ChainId, string> = {
  ethereum: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
  pulsechain: '0xa1077a294dde1b09bb078844df40758a5d0f9a27', // WPLS
};

// Marker address for native gas-token rows. EVM convention is the zero
// address, but Aave-style 0xEee...eEE is also seen — we just need any
// non-real-token sentinel so the dedupe key doesn't collide with the
// wrapped contract.
export const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface PortfolioWallet {
  address: string;
  label?: string;
  chains: ChainId[];
  addedAt: number;
}

export interface PortfolioToken {
  address: string;
  chain: ChainId;
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
  balanceFormatted: number;
  logoURI?: string;
  priceUsd?: number;
  priceChange24h?: number;
  valueUsd?: number;
  isNative?: boolean;
  isLp?: boolean;
  lp?: LpBreakdown;
}

// A single side of a V2-style LP position (e.g. WPLS/PLSX).
export interface LpUnderlying {
  address: string;
  symbol: string;
  name: string;
  amountFormatted: number;
  priceUsd?: number;
  valueUsd?: number;
  logoURI?: string;
  weightPct: number;
}

// The user's slice of a Uniswap-V2-style PulseX LP, computed from the
// pool reserves and the LP's totalSupply.
export interface LpBreakdown {
  pairAddress: string;
  dexId?: string;
  totalSupply: number;
  userShare: number;
  totalLiquidityUsd?: number;
  userValueUsd?: number;
  sides: [LpUnderlying, LpUnderlying];
}

export interface PortfolioFetchError {
  chain: ChainId;
  stage: 'balances' | 'prices';
  message: string;
}

export interface PortfolioSnapshot {
  walletAddress: string;
  tokens: PortfolioToken[];
  totalValueUsd: number;
  fetchedAt: number;
  errors: PortfolioFetchError[];
}

// ── Wallet activity / transaction history ───────────────────────────────
//
// One decoded transaction in a wallet's history feed (DeBank-style). Built
// server-side in /api/portfolio/history by merging Blockscout's address
// `/transactions` (method, gas, status, native value, counterparty) with
// `/token-transfers` (the per-token in/out flows), keyed by tx hash.

// Coarse action category, derived from the decoded method + the shape of the
// token flows. Drives the row glyph, colour, and the feed's filter chips.
export type TxActionType =
  | 'swap'
  | 'send'
  | 'receive'
  | 'approve'
  | 'add_lp'
  | 'remove_lp'
  | 'stake'
  | 'unstake'
  | 'claim'
  | 'wrap'
  | 'unwrap'
  | 'contract';

// A single asset movement within a transaction, signed relative to the
// wallet: `direction: 'in'` is a credit (+), `'out'` is a debit (−). Native
// gas-coin movements use NATIVE_TOKEN_ADDRESS as the tokenAddress.
export interface TokenFlow {
  direction: 'in' | 'out';
  tokenAddress: string;
  symbol: string;
  name?: string;
  decimals: number;
  amountFormatted: number;
  logoURI?: string;
  isNative?: boolean;
  isLp?: boolean;
  // Current-price USD value of this leg. Historical (at-tx-time) pricing is
  // deferred to the P&L feature; absent when the token has no known price.
  valueUsd?: number;
  // Flagged by the spam heuristic (see looksLikeSpamRaw). The feed hides
  // these behind the "Hide scam" toggle.
  isScam?: boolean;
}

export interface WalletTransaction {
  hash: string;
  chain: ChainId;
  timestamp: number; // ms epoch
  action: TxActionType;
  // Decoded method label, e.g. "swapExactTokensForTokens" / "approve".
  method?: string;
  status: 'success' | 'failed' | 'pending';
  // Inflows then outflows; the UI may re-group but order is stable.
  flows: TokenFlow[];
  // The contract / counterparty the wallet interacted with.
  counterparty?: string; // lowercased address
  counterpartyLabel?: string; // ENS / public tag / curated protocol name
  protocol?: { name: string; kind?: string }; // curated project, when known
  gasFeeNative?: number; // gas paid in the chain's native coin
  gasFeeUsd?: number;
  isScam?: boolean; // any flow flagged scam
}

// Opaque pagination cursor for the history feed. Clients treat it as opaque
// and hand it back verbatim on "load more". It spans two possible sources:
//   • Otterscan (PulseChain primary) pages by block number (`block`).
//   • Blockscout merges two independently-paged streams (`tx` + `tt`).
// `source` records which path produced it so "load more" stays on that path.
export interface HistoryCursor {
  source?: 'otterscan' | 'blockscout';
  block?: number | null;
  tx?: Record<string, string | number> | null;
  tt?: Record<string, string | number> | null;
}

export interface WalletHistoryResponse {
  chain: ChainId;
  address: string;
  items: WalletTransaction[];
  // null when both streams are fully paged.
  nextCursor: HistoryCursor | null;
  fetchedAt: number;
}