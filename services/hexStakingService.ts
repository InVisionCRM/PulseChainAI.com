export interface HexStake {
  id: string;
  stakeId: string;
  stakerAddr: string;
  stakedHearts: string;
  stakeShares: string;
  stakedDays: string;
  startDay: string;
  endDay: string;
  timestamp: string;
  isAutoStake: boolean;
  stakeTShares: string;
  isActive: boolean;
  daysServed?: number;
  daysLeft?: number;
}

export interface HexStakeEnd {
  id: string;
  stakeId: string;
  stakerAddr: string;
  payout: string;
  stakedHearts: string;
  penalty: string;
  servedDays: string;
  timestamp: string;
}

export interface HexGlobalInfo {
  id: string;
  hexDay: string;
  stakeSharesTotal: string;
  stakePenaltyTotal: string;
  latestStakeId: string;
  shareRate: string;
  totalSupply: string;
  lockedHeartsTotal: string;
  timestamp: string;
}

export interface HexStakingMetrics {
  totalActiveStakes: number;
  totalStakedHearts: string;
  averageStakeLength: number;
  globalInfo: HexGlobalInfo | null;
  topStakes: HexStake[];
  recentStakeStarts: HexStake[];
}

export class HexStakingService {
  private baseUrl = 'https://gateway.thegraph.com/api';
  private apiKey = 'a08fcab20e333b38bb75daf3d97a0bb5';
  private subgraphId = 'A6JyHRn6CUvvgBZwni9JyrgovKWK6FoSQ8TVt6JJGhcp';

  private get apiUrl(): string {
    return `${this.baseUrl}/subgraphs/id/${this.subgraphId}`;
  }

  private async executeQuery<T>(query: string, variables?: Record<string, any>): Promise<T> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.errors) {
        throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
      }

      return data.data;
    } catch (error) {
      console.error('HexStakingService query error:', error);
      throw error;
    }
  }

  async getStakingMetrics(): Promise<HexStakingMetrics> {
    const query = `
      query GetStakingMetrics {
        globalInfos(first: 1, orderBy: timestamp, orderDirection: desc) {
          id
          hexDay
          stakeSharesTotal
          stakePenaltyTotal
          latestStakeId
          shareRate
          totalSupply
          lockedHeartsTotal
          timestamp
        }
        stakeStarts(
          first: 100,
          orderBy: stakedHearts,
          orderDirection: desc
        ) {
          id
          stakeId
          stakerAddr
          stakedHearts
          stakeShares
          stakedDays
          startDay
          endDay
          timestamp
          isAutoStake
          stakeTShares
        }
        stakeEnds(first: 50, orderBy: timestamp, orderDirection: desc) {
          id
          stakeId
          stakerAddr
          payout
          timestamp
          servedDays
        }
      }
    `;

    const data = await this.executeQuery<{
      globalInfos: HexGlobalInfo[];
      stakeStarts: Array<{
        id: string;
        stakeId: string;
        stakerAddr: string;
        stakedHearts: string;
        stakeShares: string;
        stakedDays: string;
        startDay: string;
        endDay: string;
        timestamp: string;
        isAutoStake: boolean;
        stakeTShares: string;
      }>;
      stakeEnds: Array<{
        id: string;
        stakeId: string;
        stakerAddr: string;
        payout: string;
        timestamp: string;
        servedDays: string;
      }>;
    }>(query);

    const globalInfo = data.globalInfos[0] || null;
    const stakeStarts = data.stakeStarts;
    const stakeEnds = data.stakeEnds;
    
    // Create a set of ended stake IDs
    const endedStakeIds = new Set(stakeEnds.map(end => end.stakeId));
    
    // Filter active stakes (those that haven't ended)
    const activeStakes: HexStake[] = stakeStarts
      .filter(start => !endedStakeIds.has(start.stakeId))
      .map(start => {
        const currentDay = globalInfo ? parseInt(globalInfo.hexDay) : 0;
        const startDay = parseInt(start.startDay);
        const endDay = parseInt(start.endDay);
        const daysServed = Math.max(0, currentDay - startDay);
        const daysLeft = Math.max(0, endDay - currentDay);
        
        return {
          ...start,
          isActive: true,
          daysServed,
          daysLeft,
        };
      });

    const totalStakedHearts = activeStakes.reduce((sum, stake) => {
      return sum + parseFloat(stake.stakedHearts);
    }, 0);

    const averageStakeLength = activeStakes.length > 0 
      ? activeStakes.reduce((sum, stake) => {
          return sum + parseInt(stake.stakedDays);
        }, 0) / activeStakes.length
      : 0;

    // Get recent stake starts for display
    const recentStakeStarts = stakeStarts.slice(0, 20).map(start => ({
      ...start,
      isActive: !endedStakeIds.has(start.stakeId),
      daysServed: globalInfo ? Math.max(0, parseInt(globalInfo.hexDay) - parseInt(start.startDay)) : 0,
      daysLeft: globalInfo ? Math.max(0, parseInt(start.endDay) - parseInt(globalInfo.hexDay)) : 0,
    }));

    return {
      totalActiveStakes: activeStakes.length,
      totalStakedHearts: totalStakedHearts.toString(),
      averageStakeLength,
      globalInfo,
      topStakes: activeStakes.slice(0, 10),
      recentStakeStarts,
    };
  }

  async getStakerDetails(stakerAddr: string): Promise<HexStake[]> {
    const query = `
      query GetStakerDetails($stakerAddr: String!) {
        stakeStarts(where: { stakerAddr: $stakerAddr }, orderBy: stakedHearts, orderDirection: desc) {
          id
          stakeId
          stakerAddr
          stakedHearts
          stakeShares
          stakedDays
          startDay
          endDay
          timestamp
          isAutoStake
          stakeTShares
        }
        stakeEnds(where: { stakerAddr: $stakerAddr }) {
          stakeId
          timestamp
        }
      }
    `;

    const data = await this.executeQuery<{
      stakeStarts: Array<{
        id: string;
        stakeId: string;
        stakerAddr: string;
        stakedHearts: string;
        stakeShares: string;
        stakedDays: string;
        startDay: string;
        endDay: string;
        timestamp: string;
        isAutoStake: boolean;
        stakeTShares: string;
      }>;
      stakeEnds: Array<{
        stakeId: string;
        timestamp: string;
      }>;
    }>(query, { stakerAddr });

    const endedStakeIds = new Set(data.stakeEnds.map(end => end.stakeId));

    return data.stakeStarts.map(start => ({
      ...start,
      isActive: !endedStakeIds.has(start.stakeId),
      daysServed: 0, // Would need current day calculation
      daysLeft: 0, // Would need current day calculation
    }));
  }

  async getTopStakes(limit: number = 100): Promise<HexStake[]> {
    const query = `
      query GetTopStakes($limit: Int!) {
        stakeStarts(
          first: $limit,
          orderBy: stakedHearts,
          orderDirection: desc
        ) {
          id
          stakeId
          stakerAddr
          stakedHearts
          stakeShares
          stakedDays
          startDay
          endDay
          timestamp
          isAutoStake
          stakeTShares
        }
        globalInfos(first: 1, orderBy: timestamp, orderDirection: desc) {
          hexDay
        }
      }
    `;

    const data = await this.executeQuery<{
      stakeStarts: Array<{
        id: string;
        stakeId: string;
        stakerAddr: string;
        stakedHearts: string;
        stakeShares: string;
        stakedDays: string;
        startDay: string;
        endDay: string;
        timestamp: string;
        isAutoStake: boolean;
        stakeTShares: string;
      }>;
      globalInfos: Array<{ hexDay: string }>;
    }>(query, { limit });

    const currentDay = data.globalInfos[0] ? parseInt(data.globalInfos[0].hexDay) : 0;

    return data.stakeStarts.map(stake => ({
      ...stake,
      isActive: true, // Assume active for simplicity
      daysServed: Math.max(0, currentDay - parseInt(stake.startDay)),
      daysLeft: Math.max(0, parseInt(stake.endDay) - currentDay),
    }));
  }

  async getStakingHistory(days: number = 30): Promise<Array<{
    day: string;
    totalStakes: number;
    totalStaked: string;
    newStakes: number;
    endedStakes: number;
  }>> {
    const query = `
      query GetStakingHistory($days: Int!) {
        globalInfos(first: $days, orderBy: hexDay, orderDirection: desc) {
          hexDay
          stakeSharesTotal
          lockedHeartsTotal
          stakePenaltyTotal
          timestamp
        }
      }
    `;

    const data = await this.executeQuery<{
      globalInfos: Array<{
        hexDay: string;
        stakeSharesTotal: string;
        lockedHeartsTotal: string;
        stakePenaltyTotal: string;
        timestamp: string;
      }>;
    }>(query, { days });

    // For now, return basic day info. In a real implementation,
    // you might need additional queries to get daily stake counts
    return data.globalInfos.map(dayInfo => ({
      day: dayInfo.hexDay,
      totalStakes: 0, // Would need additional query
      totalStaked: dayInfo.lockedHeartsTotal,
      newStakes: 0, // Would need additional query
      endedStakes: 0, // Would need additional query
    }));
  }

  formatHexAmount(amount: string, decimals: number = 8): string {
    const num = parseFloat(amount) / Math.pow(10, 8); // HEX has 8 decimals
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(decimals);
  }

  formatStakeLength(days: number): string {
    if (days >= 365) {
      const years = (days / 365).toFixed(1);
      return `${years} year${parseFloat(years) !== 1 ? 's' : ''}`;
    }
    return `${days} day${days !== 1 ? 's' : ''}`;
  }

  async getAllStakeStarts(limit: number = 1000, skip: number = 0): Promise<{
    stakeStarts: HexStake[];
    totalCount: number;
    hasMore: boolean;
  }> {
    const query = `
      query GetAllStakeStarts($limit: Int!, $skip: Int!) {
        stakeStarts(
          first: $limit,
          skip: $skip,
          orderBy: timestamp,
          orderDirection: desc
        ) {
          id
          stakeId
          stakerAddr
          stakedHearts
          stakeShares
          stakedDays
          startDay
          endDay
          timestamp
          stakeTShares
          transactionHash
          blockNumber
          isAutoStake
        }
      }
    `;

    const data = await this.executeQuery<{
      stakeStarts: Array<{
        id: string;
        stakeId: string;
        stakerAddr: string;
        stakedHearts: string;
        stakeShares: string;
        stakedDays: string;
        startDay: string;
        endDay: string;
        timestamp: string;
        stakeTShares: string;
        transactionHash: string;
        blockNumber: string;
        isAutoStake: boolean;
      }>;
    }>(query, { limit, skip });

    const stakeStarts = data.stakeStarts.map(stake => ({
      ...stake,
      isActive: true, // We'll determine this later if needed
      daysServed: 0,
      daysLeft: 0,
    }));

    return {
      stakeStarts,
      totalCount: data.stakeStarts.length,
      hasMore: data.stakeStarts.length === limit,
    };
  }

  async getAllStakeStartsPaginated(batchSize: number = 1000): Promise<HexStake[]> {
    let allStakes: HexStake[] = [];
    let skip = 0;
    let hasMore = true;

    console.log('🔍 Fetching all stake starts...');

    while (hasMore) {
      try {
        console.log(`📥 Fetching batch starting at ${skip}...`);
        const batch = await this.getAllStakeStarts(batchSize, skip);
        
        allStakes = allStakes.concat(batch.stakeStarts);
        skip += batchSize;
        hasMore = batch.hasMore;
        
        console.log(`✅ Fetched ${batch.stakeStarts.length} stakes (total: ${allStakes.length})`);
        
        // Small delay to avoid rate limiting
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`❌ Error fetching batch at ${skip}:`, error);
        break;
      }
    }

    console.log(`🎉 Completed! Total stakes fetched: ${allStakes.length}`);
    return allStakes;
  }

  async getAllActiveStakes(): Promise<HexStake[]> {
    console.log('🔍 Fetching all active (non-ended) stakes...');
    
    // Step 1: Get all stake starts
    console.log('📥 Step 1: Fetching all stake starts...');
    const allStakeStarts = await this.getAllStakeStartsPaginated(1000);
    console.log(`✅ Fetched ${allStakeStarts.length} total stake starts`);

    // Step 2: Get all stake ends
    console.log('📥 Step 2: Fetching all stake ends...');
    const allStakeEnds = await this.getAllStakeEndsPaginated(1000);
    console.log(`✅ Fetched ${allStakeEnds.length} total stake ends`);

    // Step 3: Create set of ended stake IDs for fast lookup
    const endedStakeIds = new Set(allStakeEnds.map(end => end.stakeId));
    console.log(`📊 ${endedStakeIds.size} unique stakes have ended`);

    // Step 4: Filter active stakes
    const activeStakes = allStakeStarts.filter(stake => !endedStakeIds.has(stake.stakeId));
    console.log(`🎉 Found ${activeStakes.length} active stakes out of ${allStakeStarts.length} total`);

    // Step 5: Get current day for calculations
    const globalInfo = await this.getCurrentGlobalInfo();
    const currentDay = globalInfo ? parseInt(globalInfo.hexDay) : 0;

    // Step 6: Calculate days served and days left for active stakes
    const enrichedActiveStakes = activeStakes.map(stake => {
      const startDay = parseInt(stake.startDay);
      const endDay = parseInt(stake.endDay);
      const daysServed = Math.max(0, currentDay - startDay);
      const daysLeft = Math.max(0, endDay - currentDay);
      
      return {
        ...stake,
        isActive: true,
        daysServed,
        daysLeft,
      };
    });

    return enrichedActiveStakes;
  }

  async getAllStakeEndsPaginated(batchSize: number = 1000): Promise<Array<{
    id: string;
    stakeId: string;
    stakerAddr: string;
    payout: string;
    penalty: string;
    servedDays: string;
    timestamp: string;
  }>> {
    let allEnds: Array<{
      id: string;
      stakeId: string;
      stakerAddr: string;
      payout: string;
      penalty: string;
      servedDays: string;
      timestamp: string;
    }> = [];
    let skip = 0;
    let hasMore = true;

    console.log('🔍 Fetching all stake ends...');

    while (hasMore) {
      try {
        console.log(`📥 Fetching stake ends batch starting at ${skip}...`);
        
        const query = `
          query GetStakeEnds($limit: Int!, $skip: Int!) {
            stakeEnds(
              first: $limit,
              skip: $skip,
              orderBy: timestamp,
              orderDirection: desc
            ) {
              id
              stakeId
              stakerAddr
              payout
              penalty
              servedDays
              timestamp
            }
          }
        `;

        const data = await this.executeQuery<{
          stakeEnds: Array<{
            id: string;
            stakeId: string;
            stakerAddr: string;
            payout: string;
            penalty: string;
            servedDays: string;
            timestamp: string;
          }>;
        }>(query, { limit: batchSize, skip });
        
        allEnds = allEnds.concat(data.stakeEnds);
        skip += batchSize;
        hasMore = data.stakeEnds.length === batchSize;
        
        console.log(`✅ Fetched ${data.stakeEnds.length} stake ends (total: ${allEnds.length})`);
        
        // Small delay to avoid rate limiting
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
      } catch (error) {
        console.error(`❌ Error fetching stake ends batch at ${skip}:`, error);
        break;
      }
    }

    console.log(`🎉 Completed! Total stake ends fetched: ${allEnds.length}`);
    return allEnds;
  }

  async getCurrentGlobalInfo(): Promise<HexGlobalInfo | null> {
    const query = `
      query GetCurrentGlobalInfo {
        globalInfos(first: 1, orderBy: timestamp, orderDirection: desc) {
          id
          hexDay
          stakeSharesTotal
          stakePenaltyTotal
          latestStakeId
          shareRate
          totalSupply
          lockedHeartsTotal
          timestamp
        }
      }
    `;

    const data = await this.executeQuery<{
      globalInfos: HexGlobalInfo[];
    }>(query);

    return data.globalInfos[0] || null;
  }
}

export const hexStakingService = new HexStakingService();