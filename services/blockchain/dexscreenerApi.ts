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

        // Fetch detailed pair information from v4 endpoint - try direct first, then proxy
        let pairDetails = null;
        if (mainPair.pairAddress) {
          try {
            // Try direct fetch from client (works better with Cloudflare)
            const directV4Url = `https://io.dexscreener.com/dex/pair-details/v4/pulsechain/${mainPair.pairAddress}`;
            console.log('Fetching DexScreener V4 directly:', directV4Url);

            // Add timeout and better error handling
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

            const pairDetailsResponse = await fetch(directV4Url, {
              signal: controller.signal,
              cache: 'no-store',
              mode: 'cors',
              credentials: 'omit',
            });

            clearTimeout(timeoutId);

            console.log('V4 Response Status:', pairDetailsResponse.status, pairDetailsResponse.statusText);
            if (pairDetailsResponse.ok) {
              pairDetails = await pairDetailsResponse.json();
              console.log('✅ DexScreener Pair Details V4 Response (direct):', pairDetails);
              console.log('✅ V4 CMS Description (direct):', pairDetails?.cms?.description);
              console.log('✅ V4 CMS Full Object:', JSON.stringify(pairDetails?.cms, null, 2));
            } else {
              console.warn('V4 endpoint returned error:', pairDetailsResponse.status);
              // Fallback to proxy
              throw new Error('Direct fetch failed, trying proxy');
            }
          } catch (error: any) {
            // Handle specific error types
            if (error.name === 'AbortError') {
              console.warn('V4 endpoint request timed out, trying proxy...');
            } else if (error.message?.includes('Failed to fetch') || error.message?.includes('CORS')) {
              console.warn('V4 endpoint unavailable (CORS/Cloudflare), trying proxy...', error.message);
            } else if (error.message?.includes('Direct fetch failed')) {
              console.warn('Direct fetch failed, trying proxy...');
            } else {
              console.warn('Failed to fetch pair details v4 directly, trying proxy:', error);
            }
            
            // Fallback to proxy route
            try {
              const proxyV4Url = `/api/dexscreener-v4/pulsechain/${mainPair.pairAddress}`;
              console.log('Fetching DexScreener V4 via proxy:', proxyV4Url);
              
              const proxyController = new AbortController();
              const proxyTimeoutId = setTimeout(() => proxyController.abort(), 15000);
              
              const proxyResponse = await fetch(proxyV4Url, {
                signal: proxyController.signal,
                cache: 'no-store'
              });
              
              clearTimeout(proxyTimeoutId);
              
              console.log('Proxy V4 Response Status:', proxyResponse.status, proxyResponse.statusText);
              if (proxyResponse.ok) {
                pairDetails = await proxyResponse.json();
                console.log('✅ DexScreener Pair Details V4 Response (via proxy):', pairDetails);
                console.log('✅ V4 CMS Description (via proxy):', pairDetails?.cms?.description);
                console.log('✅ V4 CMS Full Object:', JSON.stringify(pairDetails?.cms, null, 2));
              } else {
                const errorData = await proxyResponse.json().catch(() => ({}));
                console.error('Proxy V4 endpoint returned error:', proxyResponse.status, errorData);
              }
            } catch (proxyError: any) {
              console.error('Failed to fetch pair details v4 via proxy:', proxyError);
            }
          }
        } else {
          console.warn('No pair address found for v4 fetch');
        }

        // Even if v4 data could not be retrieved, keep a lightweight fallback structure
        const fallbackInfo = mainPair.info || {};
        if (!pairDetails) {
          pairDetails = {
            cms: null,
            profile: {
              socials: fallbackInfo.socials || [],
              websites: fallbackInfo.websites || [],
              description: fallbackInfo.description || '',
              logo: fallbackInfo.imageUrl || mainPair.baseToken?.logoURI || null,
              headerImageUrl: fallbackInfo.header || null,
            },
            info: fallbackInfo,
          };
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
        // Priority: v4 top-level description > cms.description > other sources
        const description = pairDetails?.description || cms?.description || pairDetails?.profile?.description || fallbackInfo.description || tokenInfo?.description || mainPair?.description || '';

        // Debug: Log description sources
        console.log('Description Sources:', {
          v4_description: pairDetails?.description || 'N/A',
          cms_description: cms?.description || 'N/A',
          profile_description: pairDetails?.profile?.description || 'N/A',
          fallback_description: fallbackInfo.description || 'N/A',
          tokenInfo_description: tokenInfo?.description || 'N/A',
          mainPair_description: mainPair?.description || 'N/A',
          final_description: description ? description.substring(0, 100) + '...' : 'EMPTY'
        });

        // Extract Quick Audit data from v4 endpoint
        const quickAudit = pairDetails?.qi?.quickiAudit || null;
        
        // Extract header and icon image URLs
        const tokenAddress = address.toLowerCase();
        const headerImageUrl = cms?.header?.id 
          ? `https://dd.dexscreener.com/ds-data/tokens/pulsechain/${tokenAddress}/header.png?key=${cms.header.id}`
          : (pairDetails?.profile?.headerImageUrl || fallbackInfo.header || null);
        const iconImageUrl = cms?.icon?.id
          ? `https://dd.dexscreener.com/ds-data/tokens/pulsechain/${tokenAddress}/icon.png?key=${cms.icon.id}`
          : (pairDetails?.profile?.iconImageUrl || fallbackInfo.imageUrl || null);
        
        // Extract links from CMS
        const cmsLinks = cms?.links || [];
        
        // Debug logging
        console.log('CMS Data Extraction:', {
          hasDescription: !!description,
          hasHeader: !!headerImageUrl,
          hasIcon: !!iconImageUrl,
          linksCount: cmsLinks.length,
          descriptionPreview: description ? description.substring(0, 100) : 'EMPTY',
          hasQuickAudit: !!quickAudit
        });

        // Extract logo from multiple sources
        const logo = pairDetails?.profile?.logo || 
                    pairDetails?.info?.imageUrl ||
                    tokenInfo?.logoURI || 
                    mainPair.baseToken?.logoURI ||
                    fallbackInfo.imageUrl;

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
          },
          quickAudit: quickAudit
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

  // Get recent transactions/trades for a token from DexScreener v4 API
  async getTokenTransactions(tokenAddress: string, chainId: string = 'pulsechain'): Promise<ApiResponse<any>> {
    validateAddress(tokenAddress);

    try {
      const data = await withRetry(async () => {
        // First get the pair address for this token
        const searchResponse = await fetch(`${this.baseUrl}search/?q=${tokenAddress}`);
        if (!searchResponse.ok) {
          throw new Error('Failed to find token pairs');
        }

        const searchData = await searchResponse.json();
        const pairs = searchData.pairs || [];
        
        if (pairs.length === 0) {
          throw new Error('No pairs found for token');
        }

        // Get the main pair (highest liquidity)
        const mainPair = pairs.sort((a: any, b: any) => 
          (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        )[0];

        console.log('Fetching transactions for pair:', mainPair.pairAddress);

        // Fetch detailed pair data from v4 endpoint which includes transactions
        const pairDetailsUrl = `/api/dexscreener-v4/${chainId}/${mainPair.pairAddress}`;
        const pairResponse = await fetch(pairDetailsUrl, {
          cache: 'no-store'
        });

        if (!pairResponse.ok) {
          throw new Error(`Failed to fetch pair details: ${pairResponse.statusText}`);
        }

        const pairDetails = await pairResponse.json();
        
        // Extract transaction data from the response
        // DexScreener v4 API includes recent trades/transactions
        const transactions = pairDetails.trades || pairDetails.transactions || [];
        
        return {
          pairAddress: mainPair.pairAddress,
          chainId: chainId,
          baseToken: mainPair.baseToken,
          quoteToken: mainPair.quoteToken,
          transactions: transactions,
          priceUsd: mainPair.priceUsd,
          priceNative: mainPair.priceNative,
        };
      }, SERVICE_CONFIG.dexscreener.retries, 1000, 'dexscreener');

      return { data, success: true };
    } catch (error) {
      return { 
        error: `DexScreener transactions error: ${(error as Error).message}`, 
        success: false 
      };
    }
  }

  // Get transactions for a specific pair
  async getPairTransactions(pairAddress: string, chainId: string = 'pulsechain'): Promise<ApiResponse<any>> {
    validateAddress(pairAddress);

    try {
      const data = await withRetry(async () => {
        // Fetch from v4 endpoint via proxy
        const pairDetailsUrl = `/api/dexscreener-v4/${chainId}/${pairAddress}`;
        const response = await fetch(pairDetailsUrl, {
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch pair transactions: ${response.statusText}`);
        }

        const pairDetails = await response.json();
        
        return {
          pairAddress: pairAddress,
          chainId: chainId,
          transactions: pairDetails.trades || pairDetails.transactions || [],
          pair: pairDetails.pair || null,
        };
      }, SERVICE_CONFIG.dexscreener.retries, 1000, 'dexscreener');

      return { data, success: true };
    } catch (error) {
      return { 
        error: `DexScreener pair transactions error: ${(error as Error).message}`, 
        success: false 
      };
    }
  }
}

// Export singleton instance
export const dexscreenerApi = new DexScreenerApiClient();