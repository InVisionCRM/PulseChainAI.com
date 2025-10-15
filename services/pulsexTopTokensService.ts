// PulseX Subgraph service for top tokens
// Uses the Graph Protocol subgraph (completely free)

const PULSEX_SUBGRAPH_ENDPOINTS = [
  'https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsex',
  'https://graph.pulsechain.com/subgraphs/name/Codeakk/PulseX',
];

export interface PulseXToken {
  id: string;
  symbol: string;
  name: string;
  decimals: string;
  derivedUSD: string; // Current price in USD
  tradeVolume: string;
  tradeVolumeUSD: string;
  txCount: string;
  totalLiquidity: string;
  // Calculated fields
  priceUSD?: number;
  volumeUSD?: number;
  liquidityUSD?: number;
}

export interface PulseXPair {
  id: string;
  token0: {
    id: string;
    symbol: string;
    name: string;
  };
  token1: {
    id: string;
    symbol: string;
    name: string;
  };
  reserve0: string;
  reserve1: string;
  reserveUSD: string;
  volumeUSD: string;
  txCount: string;
  token0Price: string;
  token1Price: string;
}

export class PulseXTopTokensService {
  private async querySubgraph<T>(query: string, variables?: Record<string, any>): Promise<T | null> {
    for (const endpoint of PULSEX_SUBGRAPH_ENDPOINTS) {
      try {
        console.log(`Querying PulseX subgraph: ${endpoint}`);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            variables: variables || {},
          }),
        });

        if (!response.ok) {
          console.log(`Endpoint ${endpoint} failed with status: ${response.status}`);
          continue;
        }

        const data = await response.json();

        if (data.errors) {
          console.log(`GraphQL errors from ${endpoint}:`, data.errors);
          continue;
        }

        if (!data.data) {
          continue;
        }

        console.log(`✅ Successfully fetched from PulseX subgraph`);
        return data.data as T;
      } catch (error) {
        console.log(`Endpoint ${endpoint} error:`, error);
        continue;
      }
    }

    console.error('All PulseX subgraph endpoints failed');
    return null;
  }

  /**
   * Get top tokens by trading volume
   */
  async getTopByVolume(limit: number = 50): Promise<PulseXToken[]> {
    const query = `
      query GetTopTokensByVolume($limit: Int!) {
        tokens(
          first: $limit,
          orderBy: tradeVolumeUSD,
          orderDirection: desc,
          where: { tradeVolumeUSD_gt: "0" }
        ) {
          id
          symbol
          name
          decimals
          derivedUSD
          tradeVolume
          tradeVolumeUSD
          txCount
          totalLiquidity
        }
      }
    `;

    const result = await this.querySubgraph<{ tokens: PulseXToken[] }>(query, { limit });

    if (!result?.tokens) return [];

    // Add calculated fields
    return result.tokens.map(token => ({
      ...token,
      priceUSD: parseFloat(token.derivedUSD),
      volumeUSD: parseFloat(token.tradeVolumeUSD),
      liquidityUSD: parseFloat(token.totalLiquidity),
    }));
  }

  /**
   * Get top tokens by total liquidity
   */
  async getTopByLiquidity(limit: number = 50): Promise<PulseXToken[]> {
    const query = `
      query GetTopTokensByLiquidity($limit: Int!) {
        tokens(
          first: $limit,
          orderBy: totalLiquidity,
          orderDirection: desc,
          where: { totalLiquidity_gt: "0" }
        ) {
          id
          symbol
          name
          decimals
          derivedUSD
          tradeVolume
          tradeVolumeUSD
          txCount
          totalLiquidity
        }
      }
    `;

    const result = await this.querySubgraph<{ tokens: PulseXToken[] }>(query, { limit });

    if (!result?.tokens) return [];

    return result.tokens.map(token => ({
      ...token,
      priceUSD: parseFloat(token.derivedUSD),
      volumeUSD: parseFloat(token.tradeVolumeUSD),
      liquidityUSD: parseFloat(token.totalLiquidity),
    }));
  }

  /**
   * Get top trading pairs by volume
   */
  async getTopPairsByVolume(limit: number = 50): Promise<PulseXPair[]> {
    const query = `
      query GetTopPairs($limit: Int!) {
        pairs(
          first: $limit,
          orderBy: volumeUSD,
          orderDirection: desc,
          where: { volumeUSD_gt: "0" }
        ) {
          id
          token0 {
            id
            symbol
            name
          }
          token1 {
            id
            symbol
            name
          }
          reserve0
          reserve1
          reserveUSD
          volumeUSD
          txCount
          token0Price
          token1Price
        }
      }
    `;

    const result = await this.querySubgraph<{ pairs: PulseXPair[] }>(query, { limit });
    return result?.pairs || [];
  }

  /**
   * Get top pairs by liquidity (TVL)
   */
  async getTopPairsByLiquidity(limit: number = 50): Promise<PulseXPair[]> {
    const query = `
      query GetTopPairsByLiquidity($limit: Int!) {
        pairs(
          first: $limit,
          orderBy: reserveUSD,
          orderDirection: desc,
          where: { reserveUSD_gt: "0" }
        ) {
          id
          token0 {
            id
            symbol
            name
          }
          token1 {
            id
            symbol
            name
          }
          reserve0
          reserve1
          reserveUSD
          volumeUSD
          txCount
          token0Price
          token1Price
        }
      }
    `;

    const result = await this.querySubgraph<{ pairs: PulseXPair[] }>(query, { limit });
    return result?.pairs || [];
  }

  /**
   * Get tokens with highest transaction count (most active)
   */
  async getMostActiveTokens(limit: number = 50): Promise<PulseXToken[]> {
    const query = `
      query GetMostActiveTokens($limit: Int!) {
        tokens(
          first: $limit,
          orderBy: txCount,
          orderDirection: desc,
          where: { txCount_gt: "0" }
        ) {
          id
          symbol
          name
          decimals
          derivedUSD
          tradeVolume
          tradeVolumeUSD
          txCount
          totalLiquidity
        }
      }
    `;

    const result = await this.querySubgraph<{ tokens: PulseXToken[] }>(query, { limit });

    if (!result?.tokens) return [];

    return result.tokens.map(token => ({
      ...token,
      priceUSD: parseFloat(token.derivedUSD),
      volumeUSD: parseFloat(token.tradeVolumeUSD),
      liquidityUSD: parseFloat(token.totalLiquidity),
    }));
  }
}

// Export singleton
export const pulsexTopTokensService = new PulseXTopTokensService();
