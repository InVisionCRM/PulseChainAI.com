// Token-focused service aggregating data from multiple sources
// Replaces token-related functions from all three original services

import { pulsechainApi } from '../blockchain/pulsechainApi';
import { moralisApi } from '../blockchain/moralisApi';
import { dexscreenerApi } from '../blockchain/dexscreenerApi';
import type { 
  TokenInfo, 
  TokenInfoDetailed, 
  TokenAnalysis, 
  HoldersResponse, 
  TransactionResponse, 
  ApiResponse,
  DexScreenerData
} from '../core/types';
import { DEAD_ADDRESSES } from '../core/config';
import { validateAddress } from '../core/errors';

export class TokenService {
  // Get comprehensive token information with fallbacks
  async getTokenInfo(address: string, useMoralis: boolean = false): Promise<ApiResponse<TokenInfoDetailed>> {
    validateAddress(address);
    
    if (useMoralis && moralisApi.isAvailable()) {
      const moralisResult = await moralisApi.getTokenMetadata(address);
      if (moralisResult.success) {
        return moralisResult;
      }
    }
    
    return pulsechainApi.getTokenInfo(address);
  }

  // Get token holders with optional Moralis fallback
  async getTokenHolders(
    address: string, 
    limit: number = 50, 
    offset?: string,
    useMoralis: boolean = false
  ): Promise<ApiResponse<HoldersResponse>> {
    validateAddress(address);
    
    if (useMoralis && moralisApi.isAvailable()) {
      const moralisResult = await moralisApi.getTokenOwners(address, limit);
      if (moralisResult.success) {
        return moralisResult;
      }
    }
    
    return pulsechainApi.getTokenHolders(address, limit, offset);
  }

  // Get token transfers with source preference
  async getTokenTransfers(
    address: string,
    limit: number = 50,
    offset?: string,
    useMoralis: boolean = false
  ): Promise<ApiResponse<TransactionResponse>> {
    validateAddress(address);
    
    if (useMoralis && moralisApi.isAvailable()) {
      const moralisResult = await moralisApi.getTokenTransfers(address, limit);
      if (moralisResult.success) {
        return moralisResult;
      }
    }
    
    return pulsechainApi.getTokenTransfers(address, limit, offset);
  }

  // Calculate burned tokens by checking dead addresses
  async getBurnedTokens(address: string): Promise<ApiResponse<string>> {
    validateAddress(address);
    
    try {
      let totalBurned = BigInt(0);
      
      for (const deadAddress of DEAD_ADDRESSES) {
        const holdersResult = await this.getTokenHolders(address, 100);
        if (!holdersResult.success || !holdersResult.data) continue;
        
        const deadHolder = holdersResult.data.items.find(
          holder => holder.address.toLowerCase() === deadAddress.toLowerCase()
        );
        
        if (deadHolder && deadHolder.value) {
          totalBurned += BigInt(deadHolder.value);
        }
      }
      
      return { 
        data: totalBurned.toString(), 
        success: true 
      };
    } catch (error) {
      return { 
        error: `Failed to calculate burned tokens: ${(error as Error).message}`, 
        success: false 
      };
    }
  }

  // Get comprehensive token analysis combining all data sources
  async getTokenAnalysis(address: string): Promise<ApiResponse<TokenAnalysis>> {
    validateAddress(address);
    
    try {
      const [tokenInfo, holders, transfers, marketData, burnedAmount] = await Promise.allSettled([
        this.getTokenInfo(address),
        this.getTokenHolders(address),
        this.getTokenTransfers(address),
        dexscreenerApi.getTokenData(address),
        this.getBurnedTokens(address)
      ]);

      const analysis: TokenAnalysis = {
        tokenInfo: tokenInfo.status === 'fulfilled' && tokenInfo.value.success 
          ? tokenInfo.value.data! 
          : {} as TokenInfoDetailed,
        holders: holders.status === 'fulfilled' && holders.value.success 
          ? holders.value.data! 
          : { items: [] },
        transfers: transfers.status === 'fulfilled' && transfers.value.success 
          ? transfers.value.data! 
          : { items: [] },
        marketData: marketData.status === 'fulfilled' && marketData.value.success 
          ? marketData.value.data 
          : undefined,
        burnedAmount: burnedAmount.status === 'fulfilled' && burnedAmount.value.success 
          ? burnedAmount.value.data 
          : undefined
      };

      return { data: analysis, success: true };
    } catch (error) {
      return { 
        error: `Failed to get token analysis: ${(error as Error).message}`, 
        success: false 
      };
    }
  }

  // Search tokens across available sources
  async searchTokens(query: string, useMoralis: boolean = false): Promise<ApiResponse<any>> {
    if (!query || query.length < 2) {
      return { error: 'Search query must be at least 2 characters', success: false };
    }
    
    if (useMoralis && moralisApi.isAvailable()) {
      const moralisResult = await moralisApi.searchTokens(query);
      if (moralisResult.success) {
        return moralisResult;
      }
    }
    
    return pulsechainApi.search(query);
  }

  // Get market data from DEXScreener
  async getMarketData(address: string): Promise<ApiResponse<DexScreenerData>> {
    validateAddress(address);
    return dexscreenerApi.getTokenData(address);
  }

  // Advanced: Find tokens with similar holder patterns
  async findSimilarTokens(address: string, threshold: number = 0.1): Promise<ApiResponse<string[]>> {
    // This would require implementing holder overlap analysis
    // Placeholder for advanced functionality
    return { 
      error: 'Similar token analysis not yet implemented', 
      success: false 
    };
  }

  // Advanced: Get whale movements for token
  async getWhaleMovements(
    address: string, 
    thresholdUsd: number = 10000
  ): Promise<ApiResponse<any[]>> {
    // This would require implementing whale detection
    // Placeholder for advanced functionality
    return { 
      error: 'Whale movement analysis not yet implemented', 
      success: false 
    };
  }
}

// Export singleton instance
export const tokenService = new TokenService();