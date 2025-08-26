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
  transactionHash: string;
  blockNumber: string;
  network?: 'ethereum' | 'pulsechain';
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
  transactionHash: string;
  blockNumber: string;
  network?: 'ethereum' | 'pulsechain';
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

export interface StakerHistoryMetrics {
  staker: string;
  totalStakes: number;
  activeStakes: number;
  endedStakes: number;
  totalStakedHearts: string;
  totalTShares: string;
  averageStakeLength: number;
  totalPenalties: string;
  totalPayouts: string;
  stakes: HexStake[];
  stakeEnds: HexStakeEnd[];
  currentDay: number;
}

export class HexStakingService {
  private baseUrl = 'https://gateway.thegraph.com/api';
  private apiKey = 'a08fcab20e333b38bb75daf3d97a0bb5';
  private subgraphId = 'A6JyHRn6CUvvgBZwni9JyrgovKWK6FoSQ8TVt6JJGhcp';

  // Database availability flag
  private isDatabaseAvailable = false;

  constructor() {
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    // Only enable database on server-side to avoid client-side bundling issues
    if (typeof window !== 'undefined') {
      this.isDatabaseAvailable = false;
      return;
    }
    
    try {
      const { databaseStatus } = await import('../lib/db/databaseStatus');
      this.isDatabaseAvailable = await databaseStatus.checkAvailability();
      
      if (this.isDatabaseAvailable) {
        console.log('✅ Database connection established for Ethereum HEX staking service');
      } else {
        console.warn('⚠️ Database not available, using GraphQL API only for Ethereum');
      }
    } catch (error) {
      console.error('❌ Database initialization failed for Ethereum:', error);
      this.isDatabaseAvailable = false;
    }
  }

  private get apiUrl(): string {
    return `${this.baseUrl}/subgraphs/id/${this.subgraphId}`;
  }

  private async executeQuery<T>(query: string, variables?: Record<string, any>, retries = 3): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`🔍 GraphQL query attempt ${attempt}/${retries}`);
        
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
          throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.errors) {
          const errorMessage = data.errors.map((e: any) => e.message).join(', ');
          
          // Check if it's a network/indexer issue that might be retryable
          if (errorMessage.includes('BadResponse') || errorMessage.includes('bad indexers') || errorMessage.includes('network')) {
            console.warn(`⚠️  Network/indexer error on attempt ${attempt}: ${errorMessage}`);
            
            if (attempt < retries) {
              const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
              console.log(`⏳ Retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
          }
          
          throw new Error(`GraphQL error: ${errorMessage}`);
        }

        console.log(`✅ GraphQL query successful on attempt ${attempt}`);
        return data.data;
        
      } catch (error) {
        console.error(`❌ HexStakingService query attempt ${attempt} failed:`, error);
        
        if (attempt === retries) {
          // On final attempt, provide more user-friendly error message
          if (error instanceof Error && error.message.includes('BadResponse')) {
            throw new Error('The Graph indexer is temporarily unavailable. Please try again in a few moments.');
          }
          throw error;
        }
        
        // Wait before retry (except on last attempt)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('All retry attempts failed');
  }

  async getStakingMetrics(): Promise<HexStakingMetrics> {
    console.log('🔍 Getting comprehensive Ethereum staking metrics...');
    
    // Try database first if available
    if (this.isDatabaseAvailable) {
      try {
        console.log('🗄️ Fetching Ethereum metrics from database...');
        const { hexStakingDb } = await import('../lib/db/hexStakingDb');
        const [overview, globalInfo, topStakes] = await Promise.all([
          hexStakingDb.getStakingOverview('ethereum'),
          hexStakingDb.getLatestGlobalInfo('ethereum'),
          hexStakingDb.getTopStakes('ethereum', 100)
        ]);
        
        if (globalInfo && overview.totalActiveStakes > 0) {
          console.log(`✅ Retrieved Ethereum metrics from database: ${overview.totalActiveStakes} active stakes`);
          
          return {
            totalActiveStakes: overview.totalActiveStakes,
            totalStakedHearts: overview.totalStakedHearts,
            averageStakeLength: overview.averageStakeLength,
            globalInfo: {
              id: globalInfo.id.toString(),
              hexDay: globalInfo.hex_day.toString(),
              stakeSharesTotal: globalInfo.stake_shares_total,
              stakePenaltyTotal: globalInfo.stake_penalty_total,
              latestStakeId: globalInfo.latest_stake_id,
              shareRate: '0', // Not stored in DB yet
              totalSupply: '0', // Not stored in DB yet
              lockedHeartsTotal: globalInfo.locked_hearts_total,
              timestamp: globalInfo.timestamp
            }
          };
        }
      } catch (dbError) {
        console.warn('⚠️ Database query failed for Ethereum, falling back to GraphQL:', dbError);
      }
    }
    
    console.log('📡 Fetching Ethereum metrics from GraphQL API...');
    try {
      // Get global info first
      const globalInfoQuery = `
        query GetGlobalInfo {
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

      const globalData = await this.executeQuery<{
        globalInfos: HexGlobalInfo[];
      }>(globalInfoQuery);

      const globalInfo = globalData.globalInfos[0] || null;
      console.log('✅ Global info fetched');

      // Get all active stakes using the existing comprehensive method
      console.log('🔍 Fetching all active stakes...');
      const allActiveStakes = await this.getAllActiveStakes();
      console.log(`✅ Found ${allActiveStakes.length} total active stakes`);

    // Calculate total staked hearts from all active stakes
    const totalStakedHearts = allActiveStakes.reduce((sum, stake) => {
      return sum + parseFloat(stake.stakedHearts);
    }, 0);

    // Calculate average stake length from all active stakes
    const averageStakeLength = allActiveStakes.length > 0 
      ? allActiveStakes.reduce((sum, stake) => {
          return sum + parseInt(stake.stakedDays);
        }, 0) / allActiveStakes.length
      : 0;

    // Get top 50 stakes by amount for display
    const topStakes = allActiveStakes
      .sort((a, b) => parseFloat(b.stakedHearts) - parseFloat(a.stakedHearts))
      .slice(0, 50);

    // Get recent stake starts for display (top 20 by amount, regardless of active status)
    const recentStakeStartsQuery = `
      query GetRecentStakeStarts {
        stakeStarts(
          first: 20,
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
      }
    `;

    const recentData = await this.executeQuery<{
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
    }>(recentStakeStartsQuery);

    const recentStakeStarts = recentData.stakeStarts.map(start => ({
      ...start,
      isActive: allActiveStakes.some(active => active.stakeId === start.stakeId),
      daysServed: globalInfo ? Math.max(0, parseInt(globalInfo.hexDay) - parseInt(start.startDay)) : 0,
      daysLeft: globalInfo ? Math.max(0, parseInt(start.endDay) - parseInt(globalInfo.hexDay)) : 0,
    }));

    console.log(`✅ Staking metrics calculated: ${allActiveStakes.length} active stakes, ${this.formatHexAmount(totalStakedHearts.toString())} HEX staked`);

    return {
      totalActiveStakes: allActiveStakes.length,
      totalStakedHearts: totalStakedHearts.toString(),
      averageStakeLength,
      globalInfo,
      topStakes,
      recentStakeStarts,
    };
  } catch (error) {
    console.error('❌ Failed to fetch staking metrics:', error);
    
    // Provide graceful fallback when The Graph is completely unavailable
    return {
      totalActiveStakes: 0,
      totalStakedHearts: '0',
      averageStakeLength: 0,
      globalInfo: null,
      topStakes: [],
      recentStakeStarts: [],
    };
  }
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

  async getStakerHistory(stakerAddr: string): Promise<StakerHistoryMetrics> {
    console.log(`🔍 Fetching comprehensive staking history for ${stakerAddr}...`);
    
    try {
      // Get global info for current day calculations
      const globalInfo = await this.getCurrentGlobalInfo();
      const currentDay = globalInfo ? parseInt(globalInfo.hexDay) : 0;

      const query = `
        query GetStakerHistory($stakerAddr: String!) {
          stakeStarts(
            where: { stakerAddr: $stakerAddr }, 
            orderBy: timestamp, 
            orderDirection: desc,
            first: 1000
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
            transactionHash
            blockNumber
          }
          stakeEnds(
            where: { stakerAddr: $stakerAddr }, 
            orderBy: timestamp, 
            orderDirection: desc,
            first: 1000
          ) {
            id
            stakeId
            stakerAddr
            payout
            stakedHearts
            penalty
            servedDays
            timestamp
            transactionHash
            blockNumber
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
          transactionHash: string;
          blockNumber: string;
        }>;
        stakeEnds: Array<{
          id: string;
          stakeId: string;
          stakerAddr: string;
          payout: string;
          stakedHearts: string;
          penalty: string;
          servedDays: string;
          timestamp: string;
          transactionHash: string;
          blockNumber: string;
        }>;
      }>(query, { stakerAddr });

      // Create lookup for ended stakes
      const endedStakeIds = new Set(data.stakeEnds.map(end => end.stakeId));
      const stakeEndLookup = new Map(data.stakeEnds.map(end => [end.stakeId, end]));

      // Process stakes with enhanced data
      const stakes: HexStake[] = data.stakeStarts.map(start => {
        const startDay = parseInt(start.startDay);
        const endDay = parseInt(start.endDay);
        const isActive = !endedStakeIds.has(start.stakeId);
        const daysServed = isActive 
          ? Math.max(0, currentDay - startDay)
          : (stakeEndLookup.get(start.stakeId) ? parseInt(stakeEndLookup.get(start.stakeId)!.servedDays) : 0);
        const daysLeft = isActive ? Math.max(0, endDay - currentDay) : 0;

        return {
          ...start,
          isActive,
          daysServed,
          daysLeft,
        };
      });

      // Calculate metrics
      const activeStakes = stakes.filter(s => s.isActive);
      const endedStakes = stakes.filter(s => !s.isActive);
      
      const totalStakedHearts = stakes.reduce((sum, stake) => sum + parseFloat(stake.stakedHearts), 0);
      const totalTShares = stakes.reduce((sum, stake) => sum + parseFloat(stake.stakeTShares || stake.stakeShares), 0);
      const averageStakeLength = stakes.length > 0 
        ? stakes.reduce((sum, stake) => sum + parseInt(stake.stakedDays), 0) / stakes.length 
        : 0;
      
      const totalPenalties = data.stakeEnds.reduce((sum, end) => sum + parseFloat(end.penalty || '0'), 0);
      const totalPayouts = data.stakeEnds.reduce((sum, end) => sum + parseFloat(end.payout || '0'), 0);

      console.log(`✅ Fetched history for ${stakerAddr}: ${stakes.length} total stakes, ${activeStakes.length} active, ${endedStakes.length} ended`);

      return {
        staker: stakerAddr,
        totalStakes: stakes.length,
        activeStakes: activeStakes.length,
        endedStakes: endedStakes.length,
        totalStakedHearts: totalStakedHearts.toString(),
        totalTShares: totalTShares.toString(),
        averageStakeLength,
        totalPenalties: totalPenalties.toString(),
        totalPayouts: totalPayouts.toString(),
        stakes,
        stakeEnds: data.stakeEnds,
        currentDay,
      };

    } catch (error) {
      console.error(`❌ Failed to fetch staker history for ${stakerAddr}:`, error);
      throw error;
    }
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

  formatTShareAmount(amount: string, decimals: number = 2): string {
    const num = parseFloat(amount); // T-Shares are already in correct format from GraphQL
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

  formatStakeLengthInDays(days: number): string {
    return `${days.toLocaleString()} days`;
  }

  calculateLateEndingDays(stake: HexStake, stakeEnd: HexStakeEnd): number {
    const plannedLengthDays = parseInt(stake.stakedDays);
    const actualServedDays = parseInt(stakeEnd.servedDays);
    
    // If served more days than planned, it was ended late
    const daysLate = Math.max(0, actualServedDays - plannedLengthDays);
    
    return daysLate;
  }

  calculateStakeAPY(stakeStart: HexStake, stakeEnd: HexStakeEnd): number {
    const stakedHearts = parseFloat(stakeStart.stakedHearts);
    const payout = parseFloat(stakeEnd.payout || '0');
    const penalty = parseFloat(stakeEnd.penalty || '0');
    const daysServed = parseInt(stakeEnd.servedDays);
    
    if (stakedHearts === 0 || daysServed === 0) return 0;
    
    // Net return = payout - penalty
    const netReturn = payout - penalty;
    
    // Calculate return rate
    const returnRate = netReturn / stakedHearts;
    
    // Annualize the return rate
    const annualizedReturn = (returnRate * 365) / daysServed;
    
    // Convert to percentage
    return annualizedReturn * 100;
  }

  getChainInfo(): { name: string; explorers: string[] } {
    // Based on the subgraph ID and API endpoint, this appears to be Ethereum mainnet HEX data
    return {
      name: 'Ethereum',
      explorers: [
        'https://etherscan.io',
        'https://eth.blockscout.com'
      ]
    };
  }

  getTransactionUrl(transactionHash: string, explorer = 'etherscan'): string {
    const chainInfo = this.getChainInfo();
    const baseUrl = explorer === 'blockscout' ? chainInfo.explorers[1] : chainInfo.explorers[0];
    return `${baseUrl}/tx/${transactionHash}`;
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
    const MAX_SKIP = 5000; // The Graph's maximum skip limit

    console.log('🔍 Fetching all stake starts...');

    while (hasMore && skip < MAX_SKIP) {
      try {
        console.log(`📥 Fetching batch starting at ${skip}...`);
        const batch = await this.getAllStakeStarts(batchSize, skip);
        
        allStakes = allStakes.concat(batch.stakeStarts);
        skip += batchSize;
        hasMore = batch.hasMore && skip < MAX_SKIP;
        
        console.log(`✅ Fetched ${batch.stakeStarts.length} stakes (total: ${allStakes.length})`);
        
        // Stop if we've hit the skip limit
        if (skip >= MAX_SKIP) {
          console.log(`⚠️  Reached maximum skip limit (${MAX_SKIP}). Stopping pagination.`);
          hasMore = false;
        }
        
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
    console.log('🔍 Fetching all active Ethereum stakes...');
    
    // Try database first if available
    if (this.isDatabaseAvailable) {
      try {
        console.log('🗄️ Fetching active Ethereum stakes from database...');
        const { hexStakingDb } = await import('../lib/db/hexStakingDb');
        const globalInfo = await hexStakingDb.getLatestGlobalInfo('ethereum');
        const currentDay = globalInfo ? globalInfo.hex_day : 0;
        
        const dbStakes = await hexStakingDb.getActiveStakes({ network: 'ethereum', currentDay });
        if (dbStakes.length > 0) {
          console.log(`✅ Retrieved ${dbStakes.length} active Ethereum stakes from database`);
          
          // Convert database stakes to service format
          return dbStakes.map(stake => ({
            id: stake.stake_id,
            stakeId: stake.stake_id,
            stakerAddr: stake.staker_addr,
            stakedHearts: stake.staked_hearts,
            stakeShares: stake.stake_shares,
            stakedDays: stake.staked_days.toString(),
            startDay: stake.start_day.toString(),
            endDay: stake.end_day.toString(),
            timestamp: stake.timestamp,
            isAutoStake: stake.is_auto_stake,
            stakeTShares: stake.stake_t_shares || '0',
            isActive: stake.is_active,
            daysServed: stake.days_served,
            daysLeft: stake.days_left,
            transactionHash: stake.transaction_hash,
            blockNumber: stake.block_number,
            network: 'ethereum' as const
          }));
        }
      } catch (dbError) {
        console.warn('⚠️ Database query failed for Ethereum active stakes, falling back to GraphQL:', dbError);
      }
    }
    
    console.log('📡 Fetching active Ethereum stakes from GraphQL API...');
    try {
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

    // Step 7: Filter out stakes that have naturally expired (daysLeft <= 0)
    const trulyActiveStakes = enrichedActiveStakes.filter(stake => stake.daysLeft > 0);
    console.log(`🔍 Filtered to ${trulyActiveStakes.length} truly active stakes (removed ${enrichedActiveStakes.length - trulyActiveStakes.length} expired stakes)`);

    return trulyActiveStakes;
    } catch (error) {
      console.error('❌ Failed to fetch active stakes:', error);
      // Return empty array on failure to prevent app crashes
      return [];
    }
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
    const MAX_SKIP = 5000; // The Graph's maximum skip limit

    console.log('🔍 Fetching all stake ends...');

    while (hasMore && skip < MAX_SKIP) {
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
        hasMore = data.stakeEnds.length === batchSize && skip < MAX_SKIP;
        
        console.log(`✅ Fetched ${data.stakeEnds.length} stake ends (total: ${allEnds.length})`);
        
        // Stop if we've hit the skip limit
        if (skip >= MAX_SKIP) {
          console.log(`⚠️  Reached maximum skip limit (${MAX_SKIP}). Stopping pagination.`);
          hasMore = false;
        }
        
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