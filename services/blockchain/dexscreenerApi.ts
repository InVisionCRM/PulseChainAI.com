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

        // Debug: Log raw response
        console.log('DexScreener Raw Token Response:', tokenData);
        console.log('DexScreener Raw Search Response:', searchData);

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

        // Debug: Log main pair structure
        console.log('DexScreener Main Pair:', mainPair);

        // Fetch detailed pair information from v4 endpoint via proxy
        let pairDetails = null;
        if (mainPair.pairAddress) {
          try {
            const v4Url = `/api/dexscreener-v4/pulsechain/${mainPair.pairAddress}`;
            console.log('Fetching DexScreener V4 via proxy:', v4Url);
            const pairDetailsResponse = await fetch(v4Url);
            console.log('V4 Response Status:', pairDetailsResponse.status, pairDetailsResponse.statusText);
            if (pairDetailsResponse.ok) {
              pairDetails = await pairDetailsResponse.json();
              console.log('DexScreener Pair Details V4 Response:', pairDetails);
              console.log('V4 CMS Description:', pairDetails?.cms?.description);
            } else {
              console.warn('V4 endpoint returned error:', pairDetailsResponse.status);
            }
          } catch (error) {
            console.error('Failed to fetch pair details v4:', error);
          }
        } else {
          console.warn('No pair address found for v4 fetch');
        }

        // Get the most complete token info
        const tokenInfo = mainPair.baseToken || mainPair.token0 || mainPair.token1;
        
        // Extract social links and additional info
        const socials = [];
        const websites = [];
        
        // Check pair details v4 first for socials and websites
        if (pairDetails?.profile?.socials) {
          socials.push(...pairDetails.profile.socials);
        }
        if (pairDetails?.profile?.websites) {
          websites.push(...pairDetails.profile.websites);
        }
        if (pairDetails?.info?.socials) {
          socials.push(...pairDetails.info.socials);
        }
        if (pairDetails?.info?.websites) {
          websites.push(...pairDetails.info.websites);
        }
        
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

        // Extract CMS data from v4 endpoint
        const cms = pairDetails?.cms || null;
        const description = cms?.description || '';
        
        // Extract header and icon image URLs
        const tokenAddress = address.toLowerCase();
        const headerImageUrl = cms?.header?.id 
          ? `https://dd.dexscreener.com/ds-data/tokens/pulsechain/${tokenAddress}/header.png?key=${cms.header.id}`
          : null;
        const iconImageUrl = cms?.icon?.id
          ? `https://dd.dexscreener.com/ds-data/tokens/pulsechain/${tokenAddress}/icon.png?key=${cms.icon.id}`
          : null;
        
        // Extract links from CMS
        const cmsLinks = cms?.links || [];
        
        // Debug logging
        console.log('CMS Data Extraction:', {
          hasDescription: !!description,
          hasHeader: !!headerImageUrl,
          hasIcon: !!iconImageUrl,
          linksCount: cmsLinks.length,
          descriptionPreview: description ? description.substring(0, 100) : 'EMPTY'
        });

        // Extract logo from multiple sources
        const logo = pairDetails?.profile?.logo || 
                    pairDetails?.info?.imageUrl ||
                    tokenInfo?.logoURI || 
                    mainPair.baseToken?.logoURI ||
                    mainPair.info?.imageUrl;

        const profileData = {
          pairs: combinedPairs,
          tokenInfo: {
            address: tokenInfo?.address || address,
            name: cms?.name || tokenInfo?.name || 'Unknown Token',
            symbol: cms?.symbol || tokenInfo?.symbol || 'Unknown',
            logoURI: logo,
            iconImageUrl: iconImageUrl,
            description: description,
            totalSupply: tokenInfo?.totalSupply,
            decimals: tokenInfo?.decimals || 18
          },
          profile: {
            logo: logo,
            headerImageUrl: headerImageUrl,
            iconImageUrl: iconImageUrl,
            description: description,
            socials,
            websites,
            cmsLinks: cmsLinks,
            // Additional metadata
            tags: pairDetails?.profile?.tags || mainPair.baseToken?.tags || [],
            category: pairDetails?.profile?.category || mainPair.baseToken?.category,
            verified: pairDetails?.profile?.verified || mainPair.baseToken?.verified || false
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

        console.log('Final Profile Data:', {
          hasDescription: !!profileData.profile.description,
          hasSocials: profileData.profile.socials.length,
          hasWebsites: profileData.profile.websites.length,
          descriptionPreview: profileData.profile.description ? profileData.profile.description.substring(0, 100) : 'NONE',
          logoSources: {
            profileIconImageUrl: profileData.profile.iconImageUrl || 'NONE',
            profileLogo: profileData.profile.logo || 'NONE',
            tokenInfoLogoURI: profileData.tokenInfo.logoURI || 'NONE',
            tokenInfoIconImageUrl: profileData.tokenInfo.iconImageUrl || 'NONE'
          }
        });

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