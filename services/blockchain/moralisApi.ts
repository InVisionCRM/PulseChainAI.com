// Moralis API integration for PulseChain
// Consolidated from moralisService.ts with improvements

import Moralis from 'moralis';
import { SERVICE_CONFIG } from '../core/config';
import { handleApiError, withRetry, validateAddress } from '../core/errors';
import type { 
  TokenInfoDetailed, 
  HoldersResponse, 
  TransactionResponse, 
  TokenBalance,
  ApiResponse 
} from '../core/types';

export class MoralisApiClient {
  private isInitializing = false;
  private isInitialized = false;
  private chainId = SERVICE_CONFIG.moralis.chainId;

  // Initialize Moralis with API key
  async initialize(apiKey?: string): Promise<boolean> {
    if (this.isInitializing) {
      return false;
    }

    if (this.isInitialized) {
      return true;
    }

    const key = apiKey || SERVICE_CONFIG.moralis.apiKey;
    if (!key) {
      console.warn('Moralis API key not provided');
      return false;
    }

    this.isInitializing = true;

    try {
      await Moralis.start({ apiKey: key });
      this.isInitialized = true;
      return true;
    } catch (error: any) {
      if (error.message?.includes('Modules are started already')) {
        this.isInitialized = true;
        return true;
      }
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  // Check if Moralis is available for use
  isAvailable(): boolean {
    return this.isInitialized && !!SERVICE_CONFIG.moralis.apiKey;
  }

  // Get token metadata
  async getTokenMetadata(address: string): Promise<ApiResponse<TokenInfoDetailed>> {
    validateAddress(address);
    
    if (!this.isAvailable()) {
      return { error: 'Moralis not initialized', success: false };
    }

    try {
      const response = await withRetry(async () => {
        return await Moralis.EvmApi.token.getTokenMetadata({
          chain: this.chainId,
          addresses: [address]
        });
      }, 3, 1000, 'moralis');

      const tokenData = response.result[0];
      if (!tokenData) {
        return { error: 'Token metadata not found', success: false };
      }

      const tokenInfo: TokenInfoDetailed = {
        address: tokenData.contractAddress?.lowercase || address,
        name: tokenData.name || 'Unknown',
        symbol: tokenData.symbol || 'Unknown',
        decimals: tokenData.decimals || 18,
        type: 'ERC-20',
        holders: 0, // Moralis doesn't provide holder count in metadata
        exchange_rate: '0',
        total_supply: tokenData.totalSupply || '0',
        circulating_market_cap: '0',
        icon_url: tokenData.logo || ''
      };

      return { data: tokenInfo, success: true };
    } catch (error) {
      return { 
        error: `Moralis token metadata error: ${(error as Error).message}`, 
        success: false 
      };
    }
  }

  // Get token owners (holders)
  async getTokenOwners(address: string, limit: number = 50): Promise<ApiResponse<HoldersResponse>> {
    validateAddress(address);
    
    if (!this.isAvailable()) {
      return { error: 'Moralis not initialized', success: false };
    }

    try {
      const response = await withRetry(async () => {
        return await Moralis.EvmApi.token.getTokenOwners({
          chain: this.chainId,
          tokenAddress: address,
          limit
        });
      }, 3, 1000, 'moralis');

      const holders = response.result.map(owner => ({
        address: owner.ownerAddress?.lowercase || '',
        value: owner.balance?.toString() || '0',
        token_id: undefined
      }));

      const holdersResponse: HoldersResponse = {
        items: holders,
        next_page_params: response.hasNext() ? { cursor: response.pagination.cursor } : undefined
      };

      return { data: holdersResponse, success: true };
    } catch (error) {
      return { 
        error: `Moralis token owners error: ${(error as Error).message}`, 
        success: false 
      };
    }
  }

  // Get token transfers
  async getTokenTransfers(address: string, limit: number = 50): Promise<ApiResponse<TransactionResponse>> {
    validateAddress(address);
    
    if (!this.isAvailable()) {
      return { error: 'Moralis not initialized', success: false };
    }

    try {
      const response = await withRetry(async () => {
        return await Moralis.EvmApi.token.getTokenTransfers({
          chain: this.chainId,
          contractAddress: address,
          limit
        });
      }, 3, 1000, 'moralis');

      const transfers = response.result.map(transfer => ({
        hash: transfer.transactionHash || '',
        block_number: transfer.blockNumber?.toNumber() || 0,
        from: transfer.fromAddress?.lowercase || '',
        to: transfer.toAddress?.lowercase || '',
        value: transfer.value?.toString() || '0',
        gas_used: '0',
        gas_price: '0',
        status: 'success',
        timestamp: transfer.blockTimestamp?.toISOString() || new Date().toISOString(),
        method: transfer.transactionHash ? 'transfer' : undefined
      }));

      const transfersResponse: TransactionResponse = {
        items: transfers,
        next_page_params: response.hasNext() ? { cursor: response.pagination.cursor } : undefined
      };

      return { data: transfersResponse, success: true };
    } catch (error) {
      return { 
        error: `Moralis token transfers error: ${(error as Error).message}`, 
        success: false 
      };
    }
  }

  // Get wallet token balances
  async getWalletTokenBalances(address: string): Promise<ApiResponse<TokenBalance[]>> {
    validateAddress(address);
    
    if (!this.isAvailable()) {
      return { error: 'Moralis not initialized', success: false };
    }

    try {
      const response = await withRetry(async () => {
        return await Moralis.EvmApi.token.getWalletTokenBalances({
          chain: this.chainId,
          address
        });
      }, 3, 1000, 'moralis');

      const balances = response.result.map(balance => ({
        token: {
          address: balance.tokenAddress?.lowercase || '',
          name: balance.name || 'Unknown',
          symbol: balance.symbol || 'Unknown',
          decimals: balance.decimals || 18,
          type: 'ERC-20',
          holders: 0
        },
        value: balance.balance?.toString() || '0',
        token_id: null
      }));

      return { data: balances, success: true };
    } catch (error) {
      return { 
        error: `Moralis wallet balances error: ${(error as Error).message}`, 
        success: false 
      };
    }
  }

  // Get wallet transactions
  async getWalletTransactions(address: string, limit: number = 50): Promise<ApiResponse<TransactionResponse>> {
    validateAddress(address);
    
    if (!this.isAvailable()) {
      return { error: 'Moralis not initialized', success: false };
    }

    try {
      const response = await withRetry(async () => {
        return await Moralis.EvmApi.transaction.getWalletTransactions({
          chain: this.chainId,
          address,
          limit
        });
      }, 3, 1000, 'moralis');

      const transactions = response.result.map(tx => ({
        hash: tx.hash || '',
        block_number: tx.blockNumber?.toNumber() || 0,
        from: tx.fromAddress?.lowercase || '',
        to: tx.toAddress?.lowercase || '',
        value: tx.value?.toString() || '0',
        gas_used: tx.gasUsed?.toString() || '0',
        gas_price: tx.gasPrice?.toString() || '0',
        status: tx.receiptStatus === '1' ? 'success' : 'failed',
        timestamp: tx.blockTimestamp?.toISOString() || new Date().toISOString()
      }));

      const transactionsResponse: TransactionResponse = {
        items: transactions,
        next_page_params: response.hasNext() ? { cursor: response.pagination.cursor } : undefined
      };

      return { data: transactionsResponse, success: true };
    } catch (error) {
      return { 
        error: `Moralis wallet transactions error: ${(error as Error).message}`, 
        success: false 
      };
    }
  }

  // Search tokens (basic implementation)
  async searchTokens(query: string): Promise<ApiResponse<any>> {
    // Moralis doesn't have a direct search API, so this is a placeholder
    // In practice, you might need to implement search differently
    return { 
      error: 'Token search not supported by Moralis API', 
      success: false 
    };
  }
}

// Export singleton instance
export const moralisApi = new MoralisApiClient();