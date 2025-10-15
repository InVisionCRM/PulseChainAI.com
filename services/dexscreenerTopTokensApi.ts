// DexScreener API for top performing tokens
// Docs: https://docs.dexscreener.com/api/reference

export interface DexScreenerToken {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
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
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  fdv: number;
  pairCreatedAt: number;
}

export interface TopTokensResponse {
  pairs: DexScreenerToken[];
}

export class DexScreenerTopTokensApi {
  private baseUrl = 'https://api.dexscreener.com/latest/dex';

  /**
   * Get top tokens on PulseChain by 24h volume
   * No API key required - completely free!
   */
  async getTopTokensByVolume(limit: number = 50): Promise<DexScreenerToken[]> {
    try {
      console.log('Fetching top tokens from DexScreener...');

      // Search for all PulseChain pairs sorted by volume
      const response = await fetch(
        `${this.baseUrl}/search?q=pulsechain`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }

      const data: TopTokensResponse = await response.json();

      // Filter to only PulseChain (chainId: pulsechain)
      const pulsechainPairs = data.pairs.filter(
        pair => pair.chainId === 'pulsechain'
      );

      // Sort by 24h volume descending
      const sortedByVolume = pulsechainPairs.sort(
        (a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0)
      );

      return sortedByVolume.slice(0, limit);
    } catch (error) {
      console.error('Error fetching top tokens:', error);
      throw error;
    }
  }

  /**
   * Get top gainers on PulseChain (24h price change)
   */
  async getTopGainers(limit: number = 50): Promise<DexScreenerToken[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/search?q=pulsechain`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }

      const data: TopTokensResponse = await response.json();

      // Filter to PulseChain and positive price changes
      const pulsechainPairs = data.pairs.filter(
        pair => pair.chainId === 'pulsechain' && (pair.priceChange?.h24 || 0) > 0
      );

      // Sort by 24h price change descending
      const sortedByGains = pulsechainPairs.sort(
        (a, b) => (b.priceChange?.h24 || 0) - (a.priceChange?.h24 || 0)
      );

      return sortedByGains.slice(0, limit);
    } catch (error) {
      console.error('Error fetching top gainers:', error);
      throw error;
    }
  }

  /**
   * Get top losers on PulseChain (24h price change)
   */
  async getTopLosers(limit: number = 50): Promise<DexScreenerToken[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/search?q=pulsechain`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }

      const data: TopTokensResponse = await response.json();

      // Filter to PulseChain and negative price changes
      const pulsechainPairs = data.pairs.filter(
        pair => pair.chainId === 'pulsechain' && (pair.priceChange?.h24 || 0) < 0
      );

      // Sort by 24h price change ascending (most negative first)
      const sortedByLosses = pulsechainPairs.sort(
        (a, b) => (a.priceChange?.h24 || 0) - (b.priceChange?.h24 || 0)
      );

      return sortedByLosses.slice(0, limit);
    } catch (error) {
      console.error('Error fetching top losers:', error);
      throw error;
    }
  }

  /**
   * Get top tokens by liquidity
   */
  async getTopByLiquidity(limit: number = 50): Promise<DexScreenerToken[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/search?q=pulsechain`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }

      const data: TopTokensResponse = await response.json();

      const pulsechainPairs = data.pairs.filter(
        pair => pair.chainId === 'pulsechain'
      );

      // Sort by liquidity descending
      const sortedByLiquidity = pulsechainPairs.sort(
        (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      );

      return sortedByLiquidity.slice(0, limit);
    } catch (error) {
      console.error('Error fetching top by liquidity:', error);
      throw error;
    }
  }

  /**
   * Get newly listed tokens (sorted by pair creation date)
   */
  async getNewTokens(limit: number = 50): Promise<DexScreenerToken[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/search?q=pulsechain`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }

      const data: TopTokensResponse = await response.json();

      const pulsechainPairs = data.pairs.filter(
        pair => pair.chainId === 'pulsechain'
      );

      // Sort by creation date descending (newest first)
      const sortedByDate = pulsechainPairs.sort(
        (a, b) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0)
      );

      return sortedByDate.slice(0, limit);
    } catch (error) {
      console.error('Error fetching new tokens:', error);
      throw error;
    }
  }

  /**
   * Get trending tokens (high volume + positive price change)
   */
  async getTrendingTokens(limit: number = 50): Promise<DexScreenerToken[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/search?q=pulsechain`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`);
      }

      const data: TopTokensResponse = await response.json();

      const pulsechainPairs = data.pairs.filter(
        pair => pair.chainId === 'pulsechain'
      );

      // Calculate trending score: volume * (1 + priceChange/100)
      const withTrendingScore = pulsechainPairs.map(pair => ({
        ...pair,
        trendingScore: (pair.volume?.h24 || 0) * (1 + ((pair.priceChange?.h24 || 0) / 100))
      }));

      // Sort by trending score
      const sortedByTrending = withTrendingScore.sort(
        (a, b) => b.trendingScore - a.trendingScore
      );

      return sortedByTrending.slice(0, limit);
    } catch (error) {
      console.error('Error fetching trending tokens:', error);
      throw error;
    }
  }
}

// Export singleton
export const dexscreenerTopTokensApi = new DexScreenerTopTokensApi();
