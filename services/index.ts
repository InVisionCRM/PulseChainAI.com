// Unified service exports
// Single entry point for all blockchain services

// Core services
export * from './core/types';
export * from './core/config';
export * from './core/errors';

// Blockchain API clients
export { pulsechainApi } from './blockchain/pulsechainApi';
export { moralisApi } from './blockchain/moralisApi';
export { dexscreenerApi } from './blockchain/dexscreenerApi';

// Aggregated services
export { tokenService } from './aggregators/tokenService';
export { portfolioService } from './aggregators/portfolioService';

// Legacy compatibility - Re-export commonly used functions for backwards compatibility
import { tokenService } from './aggregators/tokenService';
import { pulsechainApi } from './blockchain/pulsechainApi';
import { dexscreenerApi } from './blockchain/dexscreenerApi';

// Maintain backwards compatibility with existing imports
export const fetchTokenInfo = (address: string) => tokenService.getTokenInfo(address);
export const fetchContract = (address: string) => pulsechainApi.getContract(address);
export const fetchAddressInfo = (address: string) => pulsechainApi.getAddressInfo(address);
export const fetchReadMethods = (address: string) => pulsechainApi.getContractReadMethods(address);
export const fetchReadMethodsWithValues = (address: string) => pulsechainApi.getContractReadMethodsWithValues(address);
// search() preserves the legacy contract — returns SearchResultItem[]
// directly. The canonical pulsechainApi.search() wraps in ApiResponse,
// but every back-compat caller of the facade (HeroTokenAiChat,
// DesktopSearchBar, MobileSearchBar, hero-highlight, stat-counter-
// builder, admin-stats, AdminStatsPanel, etc.) was written against the
// pre-Phase-3 array shape and breaks with `e.slice is not a function`
// if we hand back the wrapper.
export const search = async (query: string) => {
  const resp = await pulsechainApi.search(query);
  if (!resp.success || !resp.data) return [];
  return Array.isArray((resp.data as any)?.items)
    ? (resp.data as any).items
    : [];
};
export const fetchCreatorTransactions = (address: string, limit?: number) => 
  pulsechainApi.getCreatorTransactions(address, limit);
export const fetchAddressTokenBalances = (address: string) => 
  pulsechainApi.getAddressTokenBalances(address);
export const fetchTransaction = (hash: string) => pulsechainApi.getTransaction(hash);

// AIApiOrchestrator compatibility functions
export const getTokenInfo = (address: string) => tokenService.getTokenInfo(address);
export const getTokenHolders = (address: string, limit?: number, offset?: string) => 
  tokenService.getTokenHolders(address, limit, offset);
export const getTokenTransfers = (address: string, limit?: number, offset?: string) => 
  tokenService.getTokenTransfers(address, limit, offset);
export const getAddressInfo = (address: string) => pulsechainApi.getAddressInfo(address);
export const getAddressTransactions = (address: string, limit?: number, offset?: string) => 
  pulsechainApi.getAddressTransactions(address, limit, offset);
export const getAddressTokenBalances = (address: string) => 
  pulsechainApi.getAddressTokenBalances(address);
export const getTransaction = (hash: string) => pulsechainApi.getTransaction(hash);
export const getTransactionByHash = (hash: string) => pulsechainApi.getTransaction(hash);
export const getBurnedTokens = (address: string) => tokenService.getBurnedTokens(address);

// DEXScreener compatibility
export const fetchDexScreenerData = (address: string) => 
  dexscreenerApi.getTokenData(address);