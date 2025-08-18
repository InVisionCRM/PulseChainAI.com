// DEXScreener API client for market data

import { SERVICE_CONFIG, API_ENDPOINTS } from '../core/config';
import { validateAddress, withRetry, handleApiError } from '../core/errors';
import type { DexScreenerData, ApiResponse } from '../core/types';

export class DexScreenerApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = SERVICE_CONFIG.dexscreener.baseUrl;
  }

  // Get comprehensive token profile data from DEXScreener
  async getTokenProfile(address: string): Promise<ApiResponse<any>> {
    validateAddress(address);

    try {
      const data = await withRetry(async () => {
        // Fetch both token data and search results for comprehensive profile
        const [tokenResponse, searchResponse] = await Promise.all([
          fetch(`${this.baseUrl}tokens/${address}`),
          fetch(`${this.baseUrl}search/?q=${address}`)
        ]);

        if (!tokenResponse.ok && !searchResponse.ok) {
          throw new Error(`DEXScreener API error: Both endpoints failed`);
        }

        const tokenData = tokenResponse.ok ? await tokenResponse.json() : { pairs: [] };
        const searchData = searchResponse.ok ? await searchResponse.json() : { pairs: [] };

        // Combine and deduplicate pairs
        const allPairs = new Map();
        [...(tokenData.pairs || []), ...(searchData.pairs || [])].forEach(pair => {
          if (pair.pairAddress) {
            allPairs.set(pair.pairAddress, pair);
          }
        });

        const combinedPairs = Array.from(allPairs.values());
        
        // Extract comprehensive profile data
        const mainPair = combinedPairs[0];
        if (!mainPair) {
          throw new Error('No pairs found for token');
        }

        // Get the most complete token info
        const tokenInfo = mainPair.baseToken || mainPair.token0 || mainPair.token1;
        
        // Extract social links and additional info
        const socials = [];
        const websites = [];
        
        // Check for social links in various possible locations
        if (mainPair.info?.socials) {
          socials.push(...mainPair.info.socials);
        }
        if (mainPair.info?.websites) {
          websites.push(...mainPair.info.websites);
        }
        
        // Check for additional metadata
        if (mainPair.baseToken?.links) {
          if (mainPair.baseToken.links.website) {
            websites.push({ label: 'Website', url: mainPair.baseToken.links.website });
          }
          if (mainPair.baseToken.links.twitter) {
            socials.push({ type: 'twitter', url: mainPair.baseToken.links.twitter });
          }
          if (mainPair.baseToken.links.telegram) {
            socials.push({ type: 'telegram', url: mainPair.baseToken.links.telegram });
          }
          if (mainPair.baseToken.links.discord) {
            socials.push({ type: 'discord', url: mainPair.baseToken.links.discord });
          }
        }

        const profileData = {
          pairs: combinedPairs,
          tokenInfo: {
            address: tokenInfo?.address || address,
            name: tokenInfo?.name || 'Unknown Token',
            symbol: tokenInfo?.symbol || 'Unknown',
            logoURI: tokenInfo?.logoURI || mainPair.baseToken?.logoURI,
            description: mainPair.baseToken?.description || mainPair.info?.description,
            totalSupply: tokenInfo?.totalSupply,
            decimals: tokenInfo?.decimals || 18
          },
          profile: {
            logo: tokenInfo?.logoURI || mainPair.baseToken?.logoURI,
            description: mainPair.baseToken?.description || mainPair.info?.description,
            socials,
            websites,
            // Additional metadata
            tags: mainPair.baseToken?.tags || [],
            category: mainPair.baseToken?.category,
            verified: mainPair.baseToken?.verified || false
          },
          marketData: {
            priceUsd: mainPair.priceUsd,
            priceChange: mainPair.priceChange,
            liquidity: mainPair.liquidity,
            volume: mainPair.volume,
            fdv: mainPair.fdv,
            marketCap: mainPair.marketCap
          }
        };

        return profileData;
      }, SERVICE_CONFIG.dexscreener.retries, 1000, 'dexscreener');

      return { data, success: true };
    } catch (error) {
      return { 
        error: `DEXScreener profile error: ${(error as Error).message}`, 
        success: false 
      };
    }
  }

  // Get token market data from DEXScreener (enhanced version)
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
          throw new Error(`DEXScreener pair error: ${response.status} ${response.statusText}`);
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
          throw new Error(`DEXScreener search error: ${response.status} ${response.statusText}`);
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

  // Get chart URL for embedding (minimal UI version)
  getChartUrl(pairAddress: string, theme: 'light' | 'dark' = 'dark'): string {
    // Research shows DexScreener has a minimal chart view
    // The chart-only URL format: https://dexscreener.com/pulsechain/{pairAddress}?theme={theme}&embed=true
    return `https://dexscreener.com/pulsechain/${pairAddress}?theme=${theme}&embed=true&trades=false&info=false`;
  }

  // Get minimal chart iframe URL (alternative approach)
  getMinimalChartUrl(pairAddress: string, theme: 'light' | 'dark' = 'dark'): string {
    // Alternative minimal chart URL that removes most UI elements
    return `https://dexscreener.com/pulsechain/${pairAddress}?theme=${theme}&trades=false&info=false&header=false&footer=false`;
  }
}

// Export singleton instance
export const dexscreenerApi = new DexScreenerApiClient();