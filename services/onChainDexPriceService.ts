// On-chain DEX price reconstruction service
// Reconstructs historical price data from Sync events on PulseChain

import { pulsechainApiService } from './pulsechainApiService';

interface SyncEvent {
  timestamp: number;
  blockNumber: number;
  reserve0: bigint;
  reserve1: bigint;
  transactionHash: string;
}

interface PricePoint {
  timestamp: number;
  value: number;
  volume?: number;
}

export class OnChainDexPriceService {
  // Uniswap V2 Sync event signature
  private readonly SYNC_EVENT_TOPIC = '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1';

  /**
   * Parse Sync event from transaction log
   * Sync(uint112 reserve0, uint112 reserve1)
   */
  private parseSyncEvent(log: any): { reserve0: bigint; reserve1: bigint } | null {
    try {
      // Verify it's a Sync event
      if (!log.topics || log.topics[0]?.toLowerCase() !== this.SYNC_EVENT_TOPIC.toLowerCase()) {
        return null;
      }

      // Parse data field (contains reserve0 and reserve1)
      const data = log.data;
      if (!data || data === '0x') {
        return null;
      }

      const cleanData = data.startsWith('0x') ? data.slice(2) : data;

      // Each reserve is a uint112, but encoded as uint256 (64 hex chars)
      const reserve0 = BigInt('0x' + cleanData.slice(0, 64));
      const reserve1 = BigInt('0x' + cleanData.slice(64, 128));

      return { reserve0, reserve1 };
    } catch (error) {
      console.error('Error parsing sync event:', error);
      return null;
    }
  }

  /**
   * Fetch historical price data by reconstructing from on-chain Sync events
   * @param pairAddress - The liquidity pair contract address
   * @param timeRange - Time range for historical data
   */
  async getPriceHistoryFromChain(
    pairAddress: string,
    timeRange: '1H' | '1D' | '1W' | '1M' | '1Y' | 'ALL'
  ): Promise<PricePoint[]> {
    try {
      console.log(`📊 Starting on-chain price reconstruction for ${pairAddress}`);
      const startTime = Date.now();

      // Step 1: Get token decimals from the pair contract
      console.log('🔍 Step 1: Fetching token decimals...');
      const [token0Address, token1Address] = await Promise.all([
        pulsechainApiService.getToken0FromPair(pairAddress),
        pulsechainApiService.getToken1FromPair(pairAddress),
      ]);

      const [token0Decimals, token1Decimals] = await Promise.all([
        pulsechainApiService.getTokenDecimals(token0Address),
        pulsechainApiService.getTokenDecimals(token1Address),
      ]);

      console.log(`   ✓ Token0: ${token0Address} (${token0Decimals} decimals)`);
      console.log(`   ✓ Token1: ${token1Address} (${token1Decimals} decimals)`);

      // Step 2: Calculate time range
      const now = Date.now();
      const timeRangeMs: Record<string, number> = {
        '1H': 60 * 60 * 1000,
        '1D': 24 * 60 * 60 * 1000,
        '1W': 7 * 24 * 60 * 60 * 1000,
        '1M': 30 * 24 * 60 * 60 * 1000,
        '1Y': 365 * 24 * 60 * 60 * 1000,
        'ALL': 730 * 24 * 60 * 60 * 1000, // 2 years
      };
      const fromTime = now - timeRangeMs[timeRange];

      // Step 3: Fetch logs with pagination
      console.log('🔍 Step 2: Fetching Sync event logs...');
      const allLogs: any[] = [];
      let page = 1;
      const logsPerPage = 1000;
      let hasMore = true;
      const maxPages = 10; // Safety limit to prevent infinite loops

      while (hasMore && page <= maxPages) {
        try {
          const logs = await pulsechainApiService.getAddressLogs(pairAddress, page, logsPerPage);
          
          if (!logs || logs.length === 0) {
            hasMore = false;
            break;
          }

          // Filter for Sync events only
          const syncLogs = logs.filter(log => 
            log.topics && log.topics[0]?.toLowerCase() === this.SYNC_EVENT_TOPIC.toLowerCase()
          );

          allLogs.push(...syncLogs);
          console.log(`   Page ${page}: Found ${syncLogs.length} Sync events (${logs.length} total logs)`);

          // If we got fewer logs than requested, we've reached the end
          if (logs.length < logsPerPage) {
            hasMore = false;
          } else {
            page++;
          }
        } catch (error) {
          console.error(`   Error fetching page ${page}:`, error);
          hasMore = false;
        }
      }

      if (allLogs.length === 0) {
        console.warn('⚠️  No Sync events found');
        return [];
      }

      console.log(`   ✓ Total Sync events found: ${allLogs.length}`);

      // Step 4: Get unique block numbers and fetch block data efficiently
      console.log('🔍 Step 3: Fetching block timestamps...');
      const uniqueBlocks = new Set<number>();
      allLogs.forEach(log => {
        if (log.block_number) {
          uniqueBlocks.add(log.block_number);
        }
      });

      console.log(`   Found ${uniqueBlocks.size} unique blocks`);

      // Fetch block data for timestamp mapping (in batches to avoid overwhelming API)
      const blockTimestamps = new Map<number, number>();
      const blockArray = Array.from(uniqueBlocks);
      const batchSize = 50; // Fetch 50 blocks at a time
      
      for (let i = 0; i < blockArray.length; i += batchSize) {
        const batch = blockArray.slice(i, i + batchSize);
        const blockPromises = batch.map(async blockNum => {
          try {
            const block = await pulsechainApiService.getBlock(blockNum.toString());
            if (block && block.timestamp) {
              const timestamp = new Date(block.timestamp).getTime();
              return { blockNum, timestamp };
            }
            return null;
          } catch (error) {
            console.warn(`   Failed to fetch block ${blockNum}:`, error);
            return null;
          }
        });

        const results = await Promise.all(blockPromises);
        results.forEach(result => {
          if (result) {
            blockTimestamps.set(result.blockNum, result.timestamp);
          }
        });

        console.log(`   Fetched ${i + batch.length}/${blockArray.length} blocks...`);
      }

      console.log(`   ✓ Successfully fetched ${blockTimestamps.size} block timestamps`);

      // Step 5: Parse Sync events and create price points
      console.log('🔍 Step 4: Parsing Sync events and calculating prices...');
      const syncEvents: SyncEvent[] = [];

      for (const log of allLogs) {
        const syncData = this.parseSyncEvent(log);
        if (!syncData) continue;

        const blockNumber = log.block_number;
        const timestamp = blockTimestamps.get(blockNumber);

        if (!timestamp) {
          // Skip events where we couldn't get block timestamp
          continue;
        }

        // Filter by time range
        if (timestamp < fromTime) {
          continue;
        }

        syncEvents.push({
          timestamp,
          blockNumber,
          reserve0: syncData.reserve0,
          reserve1: syncData.reserve1,
          transactionHash: log.transaction_hash || '',
        });
      }

      // Sort by timestamp
      syncEvents.sort((a, b) => a.timestamp - b.timestamp);

      console.log(`   ✓ Parsed ${syncEvents.length} valid Sync events in time range`);

      if (syncEvents.length === 0) {
        console.warn('⚠️  No Sync events found in the requested time range');
        return [];
      }

      // Step 6: Convert to price points
      console.log('🔍 Step 5: Converting to price points...');
      const pricePoints: PricePoint[] = syncEvents.map(event => {
        // Convert reserves to decimal values
        const reserve0 = Number(event.reserve0) / Math.pow(10, token0Decimals);
        const reserve1 = Number(event.reserve1) / Math.pow(10, token1Decimals);

        // Calculate price: token1 per token0 (how much token1 you get for 1 token0)
        // This is the standard price calculation for Uniswap V2 pairs
        const price = reserve0 > 0 ? reserve1 / reserve0 : 0;

        return {
          timestamp: event.timestamp,
          value: price,
          volume: 0, // Volume not available from Sync events
        };
      });

      // Step 7: Filter out anomalies
      console.log('🔍 Step 6: Filtering anomalies...');
      const filtered = this.filterAnomalies(pricePoints);
      console.log(`   ✓ Filtered to ${filtered.length} price points (removed ${pricePoints.length - filtered.length} anomalies)`);

      // Step 8: Aggregate into time buckets
      console.log('🔍 Step 7: Aggregating into time buckets...');
      const aggregated = this.aggregateIntoBuckets(filtered, timeRange);
      console.log(`   ✓ Aggregated to ${aggregated.length} final data points`);

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Price reconstruction complete in ${totalTime}s`);

      return aggregated;
    } catch (error) {
      console.error('❌ Error in getPriceHistoryFromChain:', error);
      throw error;
    }
  }

  /**
   * Filter out anomalous price data (spikes, zero prices, etc.)
   */
  private filterAnomalies(pricePoints: PricePoint[]): PricePoint[] {
    if (pricePoints.length < 3) return pricePoints;

    const filtered: PricePoint[] = [];

    for (let i = 0; i < pricePoints.length; i++) {
      const point = pricePoints[i];

      // Filter out zero or invalid prices
      if (point.value <= 0 || isNaN(point.value) || !isFinite(point.value)) {
        continue;
      }

      // If we have previous points, check for extreme spikes
      if (filtered.length > 0) {
        const prevPoint = filtered[filtered.length - 1];
        const priceChange = Math.abs(point.value - prevPoint.value) / prevPoint.value;

        // Filter out price changes > 1000% (likely anomalies from flash loans or bugs)
        if (priceChange > 10.0) {
          continue;
        }
      }

      filtered.push(point);
    }

    return filtered;
  }

  /**
   * Aggregate price points into time buckets for smoother charts
   */
  private aggregateIntoBuckets(pricePoints: PricePoint[], timeRange: string): PricePoint[] {
    if (pricePoints.length === 0) return [];

    // Determine bucket size based on time range
    const bucketSizeMs: Record<string, number> = {
      '1H': 1 * 60 * 1000,      // 1 minute buckets
      '1D': 5 * 60 * 1000,      // 5 minute buckets  
      '1W': 30 * 60 * 1000,     // 30 minute buckets
      '1M': 60 * 60 * 1000,     // 1 hour buckets
      '1Y': 24 * 60 * 60 * 1000, // 1 day buckets
      'ALL': 7 * 24 * 60 * 60 * 1000, // 1 week buckets
    };

    const bucketSize = bucketSizeMs[timeRange] || 60 * 60 * 1000;

    // Group points into buckets
    const buckets = new Map<number, PricePoint[]>();

    for (const point of pricePoints) {
      const bucketKey = Math.floor(point.timestamp / bucketSize) * bucketSize;

      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }

      buckets.get(bucketKey)!.push(point);
    }

    // Calculate average price for each bucket (using median for better outlier resistance)
    const aggregated: PricePoint[] = [];

    for (const [timestamp, points] of buckets.entries()) {
      // Sort prices and take median
      const sortedPrices = points.map(p => p.value).sort((a, b) => a - b);
      const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];

      aggregated.push({
        timestamp,
        value: medianPrice,
        volume: 0,
      });
    }

    // Sort by timestamp
    aggregated.sort((a, b) => a.timestamp - b.timestamp);

    return aggregated;
  }
}

// Export singleton
export const onChainDexPriceService = new OnChainDexPriceService();
