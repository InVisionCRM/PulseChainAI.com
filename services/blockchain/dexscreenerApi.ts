// DEXScreener API client for market data

import { SERVICE_CONFIG, API_ENDPOINTS } from '../core/config';
import { validateAddress, withRetry, handleApiError } from '../core/errors';
import type { DexScreenerData, ApiResponse } from '../core/types';

export class DexScreenerApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = SERVICE_CONFIG.dexscreener.baseUrl;
  }

  // Get token market data from DEXScreener
  async getTokenData(address: string): Promise<ApiResponse<DexScreenerData>> {
    validateAddress(address);

    try {
      const data = await withRetry(async () => {
        const response = await fetch(
          `${this.baseUrl}${API_ENDPOINTS.dexscreener.tokens}/${address}`,
          {
            headers: SERVICE_CONFIG.dexscreener.headers,
          }
        );

        if (!response.ok) {
          throw new Error(`DEXScreener API error: ${response.status} ${response.statusText}`);
        }

        return response.json();
      }, SERVICE_CONFIG.dexscreener.retries, 1000, 'dexscreener');

      return { data, success: true };
    } catch (error) {
      return { 
        error: `DEXScreener error: ${(error as Error).message}`, 
        success: false 
      };
    }
  }

  // Get pair data for a token
  async getPairData(pairAddress: string): Promise<ApiResponse<any>> {
    validateAddress(pairAddress);

    try {
      const data = await withRetry(async () => {
        const response = await fetch(
          `${this.baseUrl}${API_ENDPOINTS.dexscreener.pairs}/${pairAddress}`,
          {
            headers: SERVICE_CONFIG.dexscreener.headers,
          }
        );

        if (!response.ok) {
          throw new Error(`DEXScreener API error: ${response.status} ${response.statusText}`);
        }

        return response.json();
      }, SERVICE_CONFIG.dexscreener.retries, 1000, 'dexscreener');

      return { data, success: true };
    } catch (error) {
      return { 
        error: `DEXScreener pair error: ${(error as Error).message}`, 
        success: false 
      };
    }
  }

  // Search pairs by token address
  async searchPairs(tokenAddress: string): Promise<ApiResponse<any>> {
    validateAddress(tokenAddress);

    try {
      const data = await withRetry(async () => {
        const response = await fetch(
          `${this.baseUrl}search/?q=${tokenAddress}`,
          {
            headers: SERVICE_CONFIG.dexscreener.headers,
          }
        );

        if (!response.ok) {
          throw new Error(`DEXScreener API error: ${response.status} ${response.statusText}`);
        }

        return response.json();
      }, SERVICE_CONFIG.dexscreener.retries, 1000, 'dexscreener');

      return { data, success: true };
    } catch (error) {
      return { 
        error: `DEXScreener search error: ${(error as Error).message}`, 
        success: false 
      };
    }
  }
}

// Export singleton instance
export const dexscreenerApi = new DexScreenerApiClient();