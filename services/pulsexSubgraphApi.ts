// PulseX Subgraph API client for historical price data
// PulseX is a Uniswap V2 fork, so it uses similar GraphQL schema

const PULSEX_SUBGRAPH_ENDPOINTS = [
  'https://graph.pulsechain.com/subgraphs/name/pulsechain/pulsex',
  'https://graph.pulsechain.com/subgraphs/name/Codeakk/PulseX',
  'https://graph.pulsechain.com/subgraphs/name/pulsechain/pulseX-v2',
];

export interface PairDayData {
  date: number;
  pairAddress: {
    id: string;
  };
  token0: {
    id: string;
    symbol: string;
  };
  token1: {
    id: string;
    symbol: string;
  };
  reserve0: string;
  reserve1: string;
  reserveUSD: string;
  dailyVolumeUSD: string;
  dailyTxns: string;
}

export interface PairHourData {
  hourStartUnix: number;
  reserve0: string;
  reserve1: string;
  reserveUSD: string;
  volumeUSD: string;
}

export interface Token {
  id: string;
  symbol: string;
  name: string;
  decimals: string;
  derivedUSD: string;
}

export interface Swap {
  timestamp: string;
  amount0In: string;
  amount1In: string;
  amount0Out: string;
  amount1Out: string;
  amountUSD: string;
  to: string;
}

export class PulseXSubgraphClient {
  private async querySubgraph<T>(query: string, variables?: Record<string, any>): Promise<T | null> {
    // Try each endpoint until one works
    for (const endpoint of PULSEX_SUBGRAPH_ENDPOINTS) {
      try {
        console.log(`Trying PulseX subgraph endpoint: ${endpoint}`);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
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

        // Check for GraphQL errors
        if (data.errors && data.errors.length > 0) {
          console.log(`GraphQL errors from ${endpoint}:`, data.errors);
          continue;
        }

        if (!data.data) {
          console.log(`No data returned from ${endpoint}`);
          continue;
        }

        console.log(`✅ Successfully fetched from PulseX endpoint: ${endpoint}`);
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
   * Get historical price data for a pair using daily data
   * @param pairAddress - The liquidity pair address
   * @param days - Number of days to fetch (default 30)
   */
  async getPairDailyData(pairAddress: string, days: number = 30): Promise<PairDayData[]> {
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const startTimestamp = nowTimestamp - (days * 24 * 60 * 60);

    const query = `
      query GetPairDayData($pairAddress: String!, $startTimestamp: Int!) {
        pairDayDatas(
          where: {
            pairAddress: $pairAddress,
            date_gte: $startTimestamp
          },
          orderBy: date,
          orderDirection: asc,
          first: 1000
        ) {
          date
          pairAddress {
            id
          }
          token0 {
            id
            symbol
          }
          token1 {
            id
            symbol
          }
          reserve0
          reserve1
          reserveUSD
          dailyVolumeUSD
          dailyTxns
        }
      }
    `;

    const result = await this.querySubgraph<{ pairDayDatas: PairDayData[] }>(query, {
      pairAddress: pairAddress.toLowerCase(),
      startTimestamp,
    });

    return result?.pairDayDatas || [];
  }

  /**
   * Get hourly price data for a pair
   * @param pairAddress - The liquidity pair address
   * @param hours - Number of hours to fetch (default 24)
   */
  async getPairHourlyData(pairAddress: string, hours: number = 24): Promise<PairHourData[]> {
    const nowTimestamp = Math.floor(Date.now() / 1000);
    const startTimestamp = nowTimestamp - (hours * 60 * 60);

    const query = `
      query GetPairHourData($pairAddress: String!, $startTimestamp: Int!) {
        pairHourDatas(
          where: {
            pair: $pairAddress,
            hourStartUnix_gte: $startTimestamp
          },
          orderBy: hourStartUnix,
          orderDirection: asc,
          first: 1000
        ) {
          hourStartUnix
          reserve0
          reserve1
          reserveUSD
          volumeUSD
        }
      }
    `;

    const result = await this.querySubgraph<{ pairHourDatas: PairHourData[] }>(query, {
      pairAddress: pairAddress.toLowerCase(),
      startTimestamp,
    });

    return result?.pairHourDatas || [];
  }

  /**
   * Get recent swaps for a pair (useful for minute-level granularity)
   * @param pairAddress - The liquidity pair address
   * @param limit - Number of swaps to fetch (default 1000)
   */
  async getPairSwaps(pairAddress: string, limit: number = 1000): Promise<Swap[]> {
    const query = `
      query GetSwaps($pairAddress: String!, $limit: Int!) {
        swaps(
          where: { pair: $pairAddress },
          orderBy: timestamp,
          orderDirection: desc,
          first: $limit
        ) {
          timestamp
          amount0In
          amount1In
          amount0Out
          amount1Out
          amountUSD
          to
        }
      }
    `;

    const result = await this.querySubgraph<{ swaps: Swap[] }>(query, {
      pairAddress: pairAddress.toLowerCase(),
      limit,
    });

    return result?.swaps || [];
  }

  /**
   * Get current token price from pair reserves
   * @param pairAddress - The liquidity pair address
   */
  async getCurrentPairData(pairAddress: string): Promise<{
    reserve0: string;
    reserve1: string;
    reserveUSD: string;
    token0: Token;
    token1: Token;
    token0Price: string;
    token1Price: string;
  } | null> {
    const query = `
      query GetPair($pairAddress: String!) {
        pair(id: $pairAddress) {
          reserve0
          reserve1
          reserveUSD
          token0 {
            id
            symbol
            name
            decimals
            derivedUSD
          }
          token1 {
            id
            symbol
            name
            decimals
            derivedUSD
          }
          token0Price
          token1Price
        }
      }
    `;

    const result = await this.querySubgraph<{ pair: any }>(query, {
      pairAddress: pairAddress.toLowerCase(),
    });

    return result?.pair || null;
  }

  /**
   * Get historical price data from subgraph
   * @param pairAddress - The liquidity pair address
   * @param timeRange - Time range for data
   */
  async getPriceHistory(
    pairAddress: string,
    timeRange: '1H' | '1D' | '1W' | '1M' | '1Y' | 'ALL'
  ): Promise<{ timestamp: number; value: number; volume?: number }[]> {
    try {
      let data: any[] = [];
      let priceKey = 'token1Price'; // Assume token1 is the quote token (usually WPLS/USDC)

      // Get current pair data to determine which token is the base
      const currentPair = await this.getCurrentPairData(pairAddress);

      if (!currentPair) {
        console.error('Could not fetch current pair data');
        return [];
      }

      // Fetch appropriate granularity based on time range
      if (timeRange === '1H') {
        // Use swaps for 1-hour data (minute-level granularity)
        const swaps = await this.getPairSwaps(pairAddress, 200);
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);

        // Filter to last hour and aggregate by 1-minute intervals
        const recentSwaps = swaps.filter(swap =>
          Number(swap.timestamp) * 1000 >= oneHourAgo
        );

        // Aggregate swaps into 1-minute buckets
        const buckets = new Map<number, { totalUSD: number; count: number }>();
        recentSwaps.forEach(swap => {
          const timestamp = Number(swap.timestamp) * 1000;
          const bucket = Math.floor(timestamp / (60 * 1000)) * (60 * 1000); // Round to minute
          const existing = buckets.get(bucket) || { totalUSD: 0, count: 0 };
          buckets.set(bucket, {
            totalUSD: existing.totalUSD + Number(swap.amountUSD),
            count: existing.count + 1,
          });
        });

        // Convert to price points (simplified - using USD volume as proxy)
        data = Array.from(buckets.entries())
          .sort(([a], [b]) => a - b)
          .map(([timestamp, bucket]) => ({
            timestamp,
            value: Number(currentPair.token0Price), // Use current price (more accurate for short timeframes)
            volume: bucket.totalUSD,
          }));

      } else if (timeRange === '1D' || timeRange === '1W') {
        // Use hourly data
        const hours = timeRange === '1D' ? 24 : 24 * 7;
        const hourlyData = await this.getPairHourlyData(pairAddress, hours);

        data = hourlyData.map(hour => {
          const reserve0 = Number(hour.reserve0);
          const reserve1 = Number(hour.reserve1);
          const price = reserve0 > 0 ? reserve1 / reserve0 : 0;

          return {
            timestamp: Number(hour.hourStartUnix) * 1000,
            value: price,
            volume: Number(hour.volumeUSD),
          };
        });

      } else {
        // Use daily data for longer timeframes
        const days = timeRange === '1M' ? 30 : timeRange === '1Y' ? 365 : 730;
        const dailyData = await this.getPairDailyData(pairAddress, days);

        data = dailyData.map(day => {
          const reserve0 = Number(day.reserve0);
          const reserve1 = Number(day.reserve1);
          const price = reserve0 > 0 ? reserve1 / reserve0 : 0;

          return {
            timestamp: Number(day.date) * 1000,
            value: price,
            volume: Number(day.dailyVolumeUSD),
          };
        });
      }

      // Filter out invalid data points
      return data.filter(point => point.value > 0 && !isNaN(point.value));

    } catch (error) {
      console.error('Error fetching PulseX price history:', error);
      return [];
    }
  }
}

// Export singleton instance
export const pulsexSubgraphApi = new PulseXSubgraphClient();
