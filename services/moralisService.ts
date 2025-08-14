import Moralis from 'moralis';

let isInitializing = false;
let isInitialized = false;

// Initialize Moralis
export const initializeMoralis = async (apiKey: string) => {
  // Prevent multiple simultaneous initializations
  if (isInitializing) {
    return;
  }

  // If already initialized, don't initialize again
  if (isInitialized) {
    return;
  }

  isInitializing = true;

  try {
    await Moralis.start({
      apiKey,
    });
    isInitialized = true;
  } catch (error) {
    // Don't throw the error if it's already initialized
    if (error instanceof Error && error.message.includes('Modules are started already')) {
      isInitialized = true;
    } else {
      throw error;
    }
  } finally {
    isInitializing = false;
  }
};

export interface TokenData {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply?: string;
  price?: number;
  marketCap?: number;
  volume24h?: number;
  liquidity?: number;
  lpCount?: number;
  holders?: number;
  // DEXScreener specific fields
  dexScreenerData?: {
    price: number;
    priceChange24h: number;
    marketCap: number;
    volume24h: number;
    liquidity: number;
    lpCount: number;
    pairs: Array<{
      dexId: string;
      pairAddress: string;
      baseToken: { symbol: string; address: string };
      quoteToken: { symbol: string; address: string };
      priceUsd: string;
      priceNative: string;
      volume: { h24: number };
      liquidity: { usd: number };
    }>;
  };
}

export interface SearchResult {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  type: string;
  holders?: number;
  exchange_rate?: string;
  total_supply?: string;
  circulating_market_cap?: string;
  icon_url?: string;
}

class MoralisService {
  private isInitialized = false;

  private async ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error('Moralis not initialized. Call initializeMoralis() first.');
    }
  }

  // Search for tokens using PulseChain API (Moralis doesn't have a search endpoint)
  async searchTokens(query: string): Promise<SearchResult[]> {
    await this.ensureInitialized();
    
    try {
      // Use PulseChain's search API since Moralis doesn't have a search endpoint
      const searchUrl = `https://api.scan.pulsechain.com/api/v2/search?q=${encodeURIComponent(query)}`;
      const response = await fetch(searchUrl);
      
      if (!response.ok) {
        throw new Error(`Search API error: ${response.status}`);
      }
      
      const searchResults = await response.json();
      
      if (searchResults && Array.isArray(searchResults)) {
        // Filter for tokens only and convert to our format
        const tokenResults = searchResults
          .filter((result: any) => result.type === 'token')
          .map((result: any) => ({
            address: result.address,
            name: result.name || '',
            symbol: result.symbol || '',
            decimals: result.decimals || 18,
            type: 'ERC20',
            total_supply: result.total_supply,
            holders: result.holders,
            exchange_rate: result.exchange_rate,
            circulating_market_cap: result.circulating_market_cap,
            icon_url: result.icon_url,
          }));
        
        return tokenResults;
      }
      
      return [];
    } catch (error) {
      return [];
    }
  }

  // Get token metadata
  async getTokenMetadata(address: string): Promise<TokenData | null> {
    await this.ensureInitialized();
    
    try {
      // Try Moralis first
      const response = await Moralis.EvmApi.token.getTokenMetadata({
        addresses: [address],
        chain: '0x171', // PulseChain chain ID
      });

      if (!response.result || response.result.length === 0) {
        return null;
      }

      const tokenInfo = response.result[0];
      
      
      const tokenData: TokenData = {
        address: tokenInfo.token.contractAddress.toString(),
        name: tokenInfo.token.name || '',
        symbol: tokenInfo.token.symbol || '',
        decimals: tokenInfo.token.decimals || 18,
        totalSupply: undefined,
      };

      // Get token price
      try {
        const priceResponse = await Moralis.EvmApi.token.getTokenPrice({
          address,
          chain: '0x171',
        });

        if (priceResponse.result) {
          tokenData.price = priceResponse.result.usdPrice;
        }
      } catch (priceError) {
        console.warn('Could not fetch token price from Moralis:', priceError);
      }

      // Get token stats
      try {
        const statsResponse = await Moralis.EvmApi.token.getTokenStats({
          address,
          chain: '0x171',
        });

        if (statsResponse.result) {
          tokenData.holders = undefined; // holdersCount not available in current API
          tokenData.marketCap = undefined; // marketCap not available in current API
        }
      } catch (statsError) {
        console.warn('Could not fetch token stats from Moralis:', statsError);
      }

      return tokenData;
    } catch (moralisError) {
      console.warn('Moralis not supported for PulseChain, falling back to PulseChain API:', moralisError);
      
      // Fallback to PulseChain API
      try {
        const pulsechainResponse = await fetch(`https://api.scan.pulsechain.com/api/v2/tokens/${address}`);
        if (!pulsechainResponse.ok) {
          return null;
        }
        
        const pulsechainData = await pulsechainResponse.json();
        
        const tokenData: TokenData = {
          address: pulsechainData.address || address,
          name: pulsechainData.name || '',
          symbol: pulsechainData.symbol || '',
          decimals: pulsechainData.decimals || 18,
          totalSupply: pulsechainData.total_supply,
          price: pulsechainData.exchange_rate ? parseFloat(pulsechainData.exchange_rate) : undefined,
          marketCap: pulsechainData.circulating_market_cap ? parseFloat(pulsechainData.circulating_market_cap) : undefined,
          holders: pulsechainData.holders,
        };
        
        return tokenData;
      } catch (pulsechainError) {
        return null;
      }
    }
  }

  // Get token owners
  async getTokenOwners(address: string, limit: number = 100): Promise<any[]> {
    await this.ensureInitialized();
    
    try {
      const response = await Moralis.EvmApi.token.getTokenOwners({
        tokenAddress: address,
        chain: '0x171',
        limit,
      });

      return response.result || [];
    } catch (error) {
      return [];
    }
  }

  // Get token transfers
  async getTokenTransfers(address: string, limit: number = 100): Promise<any[]> {
    await this.ensureInitialized();
    
    try {
      const response = await Moralis.EvmApi.token.getTokenTransfers({
        address,
        chain: '0x171',
        limit,
      });

      return response.result || [];
    } catch (error) {
      return [];
    }
  }

  // Get wallet token balances
  async getWalletTokenBalances(walletAddress: string): Promise<any[]> {
    await this.ensureInitialized();
    
    try {
      const response = await Moralis.EvmApi.token.getWalletTokenBalances({
        address: walletAddress,
        chain: '0x171',
      });

      return response.result || [];
    } catch (error) {
      return [];
    }
  }

  // Get burned tokens for a specific token
  async getBurnedTokens(tokenAddress: string): Promise<{ burned: number; burnedAddress: string } | null> {
    await this.ensureInitialized();
    
    try {
      // Check burned tokens in the dead address (0x000000000000000000000000000000000000dEaD)
      const deadAddressResponse = await Moralis.EvmApi.token.getWalletTokenBalances({
        address: '0x000000000000000000000000000000000000dEaD',
        chain: '0x171',
        tokenAddresses: [tokenAddress],
      });


      let totalBurned = 0;
      let burnedAddress = '0x000000000000000000000000000000000000dEaD';

      if (deadAddressResponse && deadAddressResponse.result && Array.isArray(deadAddressResponse.result) && deadAddressResponse.result.length > 0) {
        const burnedToken = deadAddressResponse.result.find((token: any) => 
          token.token_address && token.token_address.toLowerCase() === tokenAddress.toLowerCase()
        );
        
        if (burnedToken) {
          totalBurned = parseFloat(burnedToken.balance) / Math.pow(10, burnedToken.decimals || 18);
        }
      }

      // Also check the 369 burn address
      const burn369Response = await Moralis.EvmApi.token.getWalletTokenBalances({
        address: '0x0000000000000000000000000000000000000369',
        chain: '0x171',
        tokenAddresses: [tokenAddress],
      });


      if (burn369Response && burn369Response.result && Array.isArray(burn369Response.result) && burn369Response.result.length > 0) {
        const burnedToken369 = burn369Response.result.find((token: any) => 
          token.token_address && token.token_address.toLowerCase() === tokenAddress.toLowerCase()
        );
        
        if (burnedToken369) {
          const burned369 = parseFloat(burnedToken369.balance) / Math.pow(10, burnedToken369.decimals || 18);
          totalBurned += burned369;
          
          // If there are tokens in 369 address, use it as the primary burn address
          if (burned369 > 0) {
            burnedAddress = '0x0000000000000000000000000000000000000369';
          }
        }
      }

      return {
        burned: totalBurned,
        burnedAddress,
      };
    } catch (error) {
      return null;
    }
  }

  // Get wallet transactions
  async getWalletTransactions(walletAddress: string, limit: number = 100): Promise<any[]> {
    await this.ensureInitialized();
    
    try {
      const response = await Moralis.EvmApi.transaction.getWalletTransactions({
        address: walletAddress,
        chain: '0x171',
        limit,
      });

      return response.result || [];
    } catch (error) {
      return [];
    }
  }

  // Get native balance
  async getNativeBalance(address: string): Promise<string> {
    await this.ensureInitialized();
    
    try {
      const response = await Moralis.EvmApi.balance.getNativeBalance({
        address,
        chain: '0x171',
      });

      return response.result.balance || '0';
    } catch (error) {
      return '0';
    }
  }

  // Get block information
  async getBlock(blockNumberOrHash: string): Promise<any> {
    await this.ensureInitialized();
    
    try {
      const response = await Moralis.EvmApi.block.getBlock({
        blockNumberOrHash,
        chain: '0x171',
      });

      return response.result;
    } catch (error) {
      return null;
    }
  }

  // Run contract function
  async runContractFunction(
    address: string,
    abi: any[],
    functionName: string,
    params: any[] = []
  ): Promise<any> {
    await this.ensureInitialized();
    
    try {
      const response = await Moralis.EvmApi.utils.runContractFunction({
        address,
        abi,
        functionName,
        params,
        chain: '0x171',
      });

      return response.result;
    } catch (error) {
      return null;
    }
  }

  // Set initialization status
  setInitialized(status: boolean) {
    this.isInitialized = status;
  }
}

// Export singleton instance
export const moralisService = new MoralisService(); 