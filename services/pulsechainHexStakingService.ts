import { HexStake, HexStakeEnd, HexGlobalInfo, StakerHistoryMetrics } from './hexStakingService';
import { pulsechainStakingDb, DbStakeStart, DbStakeEnd, DbGlobalInfo } from '../lib/db/pulsechainStakingDb';
import { testDatabaseConnection } from '../lib/db/connection';

export interface PulseChainHexStake extends HexStake {
  network: 'pulsechain';
}

export interface PulseChainHexStakeEnd extends HexStakeEnd {
  network: 'pulsechain';
}

export interface PulseChainStakerHistoryMetrics extends StakerHistoryMetrics {
  network: 'pulsechain';
  stakes: PulseChainHexStake[];
  stakeEnds: PulseChainHexStakeEnd[];
}

export class PulseChainHexStakingService {
  // Using the correct PulseChain Graph endpoint from the user's file
  private baseUrl = 'https://graph.pulsechain.com/subgraphs/name/Codeakk/Hex';
  
  // Alternative endpoints to try if the main one fails
  private fallbackEndpoints = [
    'https://graph.pulsechain.com/subgraphs/name/hex/hex-staking',
    'https://api.thegraph.com/subgraphs/name/pulsechain/hex-staking'
  ];

  // Cache for storing fetched data to avoid refetching
  private dataCache: {
    allStakeStarts: any[] | null;
    allStakeEnds: any[] | null;
    allActiveStakes: any[] | null;
    lastFetchTime: number | null;
    globalInfo: any | null;
  } = {
    allStakeStarts: null,
    allStakeEnds: null,
    allActiveStakes: null,
    lastFetchTime: null,
    globalInfo: null
  };

  // Cache expiration time (5 minutes)
  private readonly CACHE_EXPIRY = 5 * 60 * 1000;

  // Database availability flag
  private isDatabaseAvailable = false;

  constructor() {
    this.initializeDatabase();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      const { databaseStatus } = await import('../lib/db/databaseStatus');
      this.isDatabaseAvailable = await databaseStatus.checkAvailability();
      
      if (this.isDatabaseAvailable) {
        console.log('✅ Database connection established for PulseChain staking service');
      } else {
        console.warn('⚠️ Database not available, using GraphQL API only');
      }
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      this.isDatabaseAvailable = false;
    }
  }

  async executeQuery<T>(query: string, variables: any = {}): Promise<T> {
    const payload = {
      query,
      variables
    };

    try {
      // Use the GraphQL proxy API to avoid CORS issues
      const response = await fetch('/api/pulsechain-graphql-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`GraphQL proxy error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`GraphQL proxy error: ${data.error}`);
      }

      if (data.data) {
        return data.data;
      }

      throw new Error('No data returned from GraphQL proxy');
    } catch (error) {
      console.error('❌ PulseChain GraphQL proxy request failed:', error);
      throw new Error(`PulseChain GraphQL unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async tryEndpoint(url: string, payload: any): Promise<any> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }


  // Cache management methods
  private isCacheValid(): boolean {
    if (!this.dataCache.lastFetchTime) return false;
    return Date.now() - this.dataCache.lastFetchTime < this.CACHE_EXPIRY;
  }

  private clearCache(): void {
    this.dataCache = {
      allStakeStarts: null,
      allStakeEnds: null,
      allActiveStakes: null,
      lastFetchTime: null,
      globalInfo: null
    };
  }

  private updateCache(data: any, type: 'stakeStarts' | 'stakeEnds' | 'activeStakes' | 'globalInfo'): void {
    this.dataCache[type] = data;
    this.dataCache.lastFetchTime = Date.now();
  }

  // Public methods to access cached data for sorting and AI timing
  getCachedStakeStarts(): any[] | null {
    return this.dataCache.stakeStarts;
  }

  getCachedStakeEnds(): any[] | null {
    return this.dataCache.stakeEnds;
  }

  getCachedActiveStakes(): any[] | null {
    return this.dataCache.allActiveStakes;
  }

  // Force refresh cache (useful for admin purposes)
  async refreshCache(): Promise<void> {
    console.log('🔄 Forcing cache refresh...');
    this.clearCache();
    await this.getAllActiveStakes(true);
  }

  // Get sorted data from cache for AI timing analysis
  getSortedStakeStarts(sortBy: 'timestamp' | 'stakedHearts' | 'stakedDays' = 'timestamp', order: 'asc' | 'desc' = 'desc'): any[] {
    const cachedData = this.dataCache.stakeStarts;
    if (!cachedData) {
      console.warn('⚠️ No cached stake starts data available for sorting');
      return [];
    }

    console.log(`📊 Sorting ${cachedData.length} cached stake starts by ${sortBy} (${order})`);
    
    return [...cachedData].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'timestamp':
          aValue = parseInt(a.timestamp);
          bValue = parseInt(b.timestamp);
          break;
        case 'stakedHearts':
          aValue = parseFloat(a.stakedHearts);
          bValue = parseFloat(b.stakedHearts);
          break;
        case 'stakedDays':
          aValue = parseInt(a.stakedDays);
          bValue = parseInt(b.stakedDays);
          break;
        default:
          aValue = parseInt(a.timestamp);
          bValue = parseInt(b.timestamp);
      }
      
      return order === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }

  // Get sorted active stakes from cache for AI timing analysis
  getSortedActiveStakes(sortBy: 'daysLeft' | 'daysServed' | 'stakedHearts' = 'daysLeft', order: 'asc' | 'desc' = 'asc'): any[] {
    const cachedData = this.dataCache.allActiveStakes;
    if (!cachedData) {
      console.warn('⚠️ No cached active stakes data available for sorting');
      return [];
    }

    console.log(`📊 Sorting ${cachedData.length} cached active stakes by ${sortBy} (${order})`);
    
    return [...cachedData].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'daysLeft':
          aValue = a.daysLeft || 0;
          bValue = b.daysLeft || 0;
          break;
        case 'daysServed':
          aValue = a.daysServed || 0;
          bValue = b.daysServed || 0;
          break;
        case 'stakedHearts':
          aValue = parseFloat(a.stakedHearts);
          bValue = parseFloat(b.stakedHearts);
          break;
        default:
          aValue = a.daysLeft || 0;
          bValue = b.daysLeft || 0;
      }
      
      return order === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }

  // Get cache status for debugging (enhanced with database info)
  async getCacheStatus(): Promise<{
    hasStakeStarts: boolean;
    hasStakeEnds: boolean;
    hasActiveStakes: boolean;
    hasGlobalInfo: boolean;
    isExpired: boolean;
    lastFetchTime: string | null;
    cacheAge: number | null;
    totalStakeStarts: number;
    totalActiveStakes: number;
    databaseAvailable: boolean;
    databaseCounts?: {
      stakeStarts: number;
      stakeEnds: number;
      globalInfo: number;
      stakerMetrics: number;
    };
  }> {
    const now = Date.now();
    const age = this.dataCache.lastFetchTime ? now - this.dataCache.lastFetchTime : null;
    
    let databaseCounts;
    if (this.isDatabaseAvailable) {
      try {
        databaseCounts = await pulsechainStakingDb.getTableCounts();
      } catch (error) {
        console.error('Error getting database counts:', error);
      }
    }
    
    return {
      hasStakeStarts: !!this.dataCache.stakeStarts,
      hasStakeEnds: !!this.dataCache.stakeEnds,
      hasActiveStakes: !!this.dataCache.allActiveStakes,
      hasGlobalInfo: !!this.dataCache.globalInfo,
      isExpired: !this.isCacheValid(),
      lastFetchTime: this.dataCache.lastFetchTime ? new Date(this.dataCache.lastFetchTime).toISOString() : null,
      cacheAge: age ? Math.round(age / 1000) : null,
      totalStakeStarts: this.dataCache.stakeStarts?.length || 0,
      totalActiveStakes: this.dataCache.allActiveStakes?.length || 0,
      databaseAvailable: this.isDatabaseAvailable,
      databaseCounts
    };
  }

  // Convert database record to service format
  private dbStakeToServiceStake(dbStake: DbStakeStart, currentDay?: number): PulseChainHexStake {
    const currentHexDay = currentDay || 0;
    return {
      id: dbStake.stake_id,
      stakeId: dbStake.stake_id,
      stakerAddr: dbStake.staker_addr,
      stakedHearts: dbStake.staked_hearts,
      stakeShares: dbStake.stake_shares,
      stakeTShares: dbStake.stake_t_shares || dbStake.stake_shares,
      stakedDays: dbStake.staked_days.toString(),
      startDay: dbStake.start_day.toString(),
      endDay: dbStake.end_day.toString(),
      timestamp: dbStake.timestamp,
      isAutoStake: dbStake.is_auto_stake,
      transactionHash: dbStake.transaction_hash,
      blockNumber: dbStake.block_number,
      network: 'pulsechain' as const,
      isActive: dbStake.is_active,
      daysServed: Math.max(0, currentHexDay - dbStake.start_day),
      daysLeft: Math.max(0, dbStake.end_day - currentHexDay),
    };
  }

  // Convert service stake to database record
  private serviceStakeToDbStake(stake: any, currentDay: number = 0): Omit<DbStakeStart, 'id' | 'created_at' | 'updated_at'> {
    return {
      stake_id: stake.stakeId,
      staker_addr: stake.stakerAddr,
      staked_hearts: stake.stakedHearts,
      stake_shares: stake.stakeShares,
      stake_t_shares: stake.stakeTShares || stake.stakeShares,
      staked_days: parseInt(stake.stakedDays),
      start_day: parseInt(stake.startDay),
      end_day: parseInt(stake.endDay),
      timestamp: stake.timestamp,
      is_auto_stake: stake.isAutoStake || false,
      transaction_hash: stake.transactionHash,
      block_number: stake.blockNumber,
      network: 'pulsechain',
      is_active: currentDay <= parseInt(stake.endDay),
      days_served: Math.max(0, currentDay - parseInt(stake.startDay)),
      days_left: Math.max(0, parseInt(stake.endDay) - currentDay),
    };
  }

  // Get total counts for display purposes
  async getTotalCounts(): Promise<{ totalStakeStarts: number; totalActiveStakes: number }> {
    try {
      // Try to get from cache first
      if (this.dataCache.stakeStarts && this.dataCache.allActiveStakes && this.isCacheValid()) {
        return {
          totalStakeStarts: this.dataCache.stakeStarts.length,
          totalActiveStakes: this.dataCache.allActiveStakes.length
        };
      }

      // If not cached, fetch minimal data for counts
      const stakeStartsQuery = `
        query GetStakeStartsCount {
          stakeStarts(first: 1, orderBy: stakeId, orderDirection: desc) {
            stakeId
          }
        }
      `;

      const stakeStartsData = await this.executeQuery<{ stakeStarts: Array<{ stakeId: string }> }>(stakeStartsQuery);
      const totalStakeStarts = stakeStartsData.stakeStarts.length > 0 ? parseInt(stakeStartsData.stakeStarts[0].stakeId) : 0;

      // For active stakes, we need to get the global info to calculate
      const globalInfo = await this.getCurrentGlobalInfo();
      const currentDay = globalInfo ? parseInt(globalInfo.hexDay) : 0;

      // Estimate active stakes based on global info
      const totalActiveStakes = totalStakeStarts; // This is an approximation

      return {
        totalStakeStarts,
        totalActiveStakes
      };
    } catch (error) {
      console.error('❌ Error getting total counts:', error);
      return {
        totalStakeStarts: 0,
        totalActiveStakes: 0
      };
    }
  }

  async getCurrentGlobalInfo(): Promise<HexGlobalInfo | null> {
    try {
      const query = `
        query GetCurrentGlobalInfo {
          globalInfos(first: 1, orderBy: timestamp, orderDirection: desc) {
            id
            hexDay
            stakeSharesTotal
            stakePenaltyTotal
          }
        }
      `;

      const data = await this.executeQuery<{
        globalInfos: Array<{
          id: string;
          hexDay: string;
          stakeSharesTotal: string;
          stakePenaltyTotal: string;
        }>;
      }>(query);

      return data.globalInfos.length > 0 ? data.globalInfos[0] : null;
    } catch (error) {
      console.error('Error fetching PulseChain global info:', error);
      return null;
    }
  }

  async getStakerHistory(stakerAddr: string): Promise<PulseChainStakerHistoryMetrics> {
    console.log(`🔍 Fetching PulseChain staking history for ${stakerAddr}...`);
    
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

      // Process stakes and add network identifier
      const stakes: PulseChainHexStake[] = data.stakeStarts.map(start => ({
        ...start,
        network: 'pulsechain' as const,
        isActive: true, // Will be updated based on stake ends
        daysServed: Math.max(0, currentDay - parseInt(start.startDay)),
        daysLeft: Math.max(0, parseInt(start.endDay) - currentDay),
      }));

      // Process stake ends and add network identifier
      const stakeEnds: PulseChainHexStakeEnd[] = data.stakeEnds.map(end => ({
        ...end,
        network: 'pulsechain' as const,
      }));

      // Update active status based on stake ends
      const endedStakeIds = new Set(stakeEnds.map(end => end.stakeId));
      stakes.forEach(stake => {
        if (endedStakeIds.has(stake.stakeId)) {
          stake.isActive = false;
        }
      });

      // Calculate metrics
      const totalStakes = stakes.length;
      const activeStakes = stakes.filter(s => s.isActive).length;
      const endedStakes = stakes.filter(s => !s.isActive).length;
      const totalStakedHearts = stakes.reduce((sum, stake) => sum + parseFloat(stake.stakedHearts), 0).toString();
      const totalTShares = stakes.reduce((sum, stake) => sum + parseFloat(stake.stakeTShares || stake.stakeShares), 0).toString();
      const averageStakeLength = stakes.length > 0 
        ? stakes.reduce((sum, stake) => sum + parseInt(stake.stakedDays), 0) / stakes.length 
        : 0;
      const totalPayouts = stakeEnds.reduce((sum, end) => sum + parseFloat(end.payout || '0'), 0).toString();
      const totalPenalties = stakeEnds.reduce((sum, end) => sum + parseFloat(end.penalty || '0'), 0).toString();

      return {
        network: 'pulsechain',
        stakerAddress: stakerAddr,
        totalStakes,
        activeStakes,
        endedStakes,
        totalStakedHearts,
        totalTShares,
        averageStakeLength,
        totalPayouts,
        totalPenalties,
        stakes,
        stakeEnds
      };
    } catch (error) {
      console.error(`❌ Error fetching PulseChain staker history for ${stakerAddr}:`, error);
      throw error;
    }
  }

  async getTopStakes(limit: number = 100): Promise<PulseChainHexStake[]> {
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
          transactionHash
          blockNumber
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
        transactionHash: string;
        blockNumber: string;
      }>;
      globalInfos: Array<{ hexDay: string }>;
    }>(query, { limit });

    const currentDay = data.globalInfos[0] ? parseInt(data.globalInfos[0].hexDay) : 0;

    return data.stakeStarts.map(stake => ({
      ...stake,
      network: 'pulsechain' as const,
      isActive: true, // Assume active for simplicity
      daysServed: Math.max(0, currentDay - parseInt(stake.startDay)),
      daysLeft: Math.max(0, parseInt(stake.endDay) - currentDay),
    }));
  }

  getChainInfo(): { name: string; explorers: string[] } {
    return {
      name: 'PulseChain',
      explorers: [
        'https://midgard.wtf',
        'https://scan.pulsechain.com',
        'https://otter.pulsechain.com'
      ]
    };
  }

  getTransactionUrl(transactionHash: string, explorer = 'midgard'): string {
    // Use Midgard.wtf as the primary explorer for better reliability
    if (explorer === 'midgard') {
      return `https://midgard.wtf/tx/${transactionHash}`;
    }
    
    // Fallback to other explorers if specified
    const chainInfo = this.getChainInfo();
    const baseUrl = explorer === 'otter' ? chainInfo.explorers[1] : chainInfo.explorers[0];
    return `${baseUrl}/tx/${transactionHash}`;
  }

  // Fixed method signatures to match the Ethereum service
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

  calculateLateEndingDays(stake: PulseChainHexStake, stakeEnd: PulseChainHexStakeEnd): number {
    const actualServedDays = parseInt(stakeEnd.servedDays);
    const plannedDays = parseInt(stake.stakedDays);
    return Math.max(0, actualServedDays - plannedDays);
  }

  calculateStakeAPY(stake: PulseChainHexStake, stakeEnd: PulseChainHexStakeEnd): number {
    const principal = parseFloat(stake.stakedHearts);
    const payout = parseFloat(stakeEnd.payout || '0');
    const penalty = parseFloat(stakeEnd.penalty || '0');
    const netGain = payout - penalty;
    const daysStaked = parseInt(stakeEnd.servedDays);
    
    if (principal <= 0 || daysStaked <= 0 || netGain <= 0) {
      return 0;
    }
    
    const dailyReturn = netGain / principal / daysStaked;
    const annualizedReturn = dailyReturn * 365;
    
    return annualizedReturn * 100;
  }

  async getStakingMetrics(): Promise<import('./hexStakingService').HexStakingMetrics> {
    console.log('🔍 Fetching PulseChain HEX staking metrics...');
    
    try {
      // TEMPORARILY SKIP database first for metrics (sync issues - using GraphQL for fresh data)  
      if (false && this.isDatabaseAvailable) {
        try {
          console.log('🗄️ Fetching metrics from database...');
          const [overview, globalInfo, topStakes] = await Promise.all([
            pulsechainStakingDb.getStakingOverview(),
            pulsechainStakingDb.getLatestGlobalInfo(),
            pulsechainStakingDb.getTopStakes(100)
          ]);

          if (globalInfo && overview.totalActiveStakes > 0) {
            const serviceTopStakes = topStakes.map(stake => this.dbStakeToServiceStake(stake, globalInfo.hex_day));
            
            console.log(`✅ Database metrics: ${overview.totalActiveStakes} active stakes, ${this.formatHexAmount(overview.totalStakedHearts)} HEX staked`);
            
            return {
              globalInfo: {
                id: globalInfo.id.toString(),
                hexDay: globalInfo.hex_day.toString(),
                stakeSharesTotal: globalInfo.stake_shares_total,
                stakePenaltyTotal: globalInfo.stake_penalty_total,
                lockedHeartsTotal: globalInfo.locked_hearts_total,
                latestStakeId: globalInfo.latest_stake_id || overview.latestStakeId || '0'
              },
              topStakes: serviceTopStakes,
              totalActiveStakes: overview.totalActiveStakes,
              totalStakedHearts: overview.totalStakedHearts,
              averageStakeLength: overview.averageStakeLength
            };
          }
        } catch (error) {
          console.warn('⚠️ Database metrics query failed, falling back to GraphQL:', error);
        }
      }

      // Fallback to GraphQL API
      console.log('🔗 Fetching metrics from GraphQL API...');
      
      // Check cache for global info first
      let globalInfo = this.dataCache.globalInfo;
      let currentDay = 0;
      
      if (!globalInfo || !this.isCacheValid()) {
        console.log('📋 Fetching fresh global info...');
        const globalInfoQuery = `
          query GetGlobalInfo {
            globalInfos(first: 1, orderBy: timestamp, orderDirection: desc) {
              id
              hexDay
              stakeSharesTotal
              stakePenaltyTotal
              lockedHeartsTotal
              latestStakeId
            }
          }
        `;

        const globalData = await this.executeQuery<{
          globalInfos: Array<{
            id: string;
            hexDay: string;
            stakeSharesTotal: string;
            stakePenaltyTotal: string;
            lockedHeartsTotal: string;
            latestStakeId: string;
          }>;
        }>(globalInfoQuery);

        globalInfo = globalData.globalInfos[0] || null;
        this.updateCache(globalInfo, 'globalInfo');
      } else {
        console.log('📋 Using cached global info');
      }
      
      currentDay = globalInfo ? parseInt(globalInfo.hexDay) : 0;

      // Get all active stakes using the paginated method
      console.log('🔍 Getting accurate active stake count...');
      const allActiveStakes = await this.getAllActiveStakes();

      // Get top stakes by amount (limited for performance)
      const topStakesQuery = `
        query GetTopStakes {
          stakeStarts(first: 100, orderBy: stakedHearts, orderDirection: desc) {
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
        }
      `;

      const topStakesData = await this.executeQuery<{
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
      }>(topStakesQuery);

      // Process top stakes to add network identifier and status
      const topStakes: PulseChainHexStake[] = topStakesData.stakeStarts.map(stake => ({
        ...stake,
        network: 'pulsechain' as const,
        isActive: currentDay <= parseInt(stake.endDay), // Simple active check for top stakes
        daysServed: Math.max(0, currentDay - parseInt(stake.startDay)),
        daysLeft: Math.max(0, parseInt(stake.endDay) - currentDay),
      }));

      // Calculate metrics using accurate active stakes count
      const totalActiveStakes = allActiveStakes.length;
      const totalStakedHearts = allActiveStakes.reduce((sum, stake) => sum + parseFloat(stake.stakedHearts), 0).toString();
      const averageStakeLength = allActiveStakes.length > 0 
        ? allActiveStakes.reduce((sum, stake) => sum + parseInt(stake.stakedDays), 0) / allActiveStakes.length 
        : 0;

      console.log(`✅ PulseChain metrics: ${totalActiveStakes} active stakes, ${this.formatHexAmount(totalStakedHearts)} HEX staked`);

      return {
        globalInfo: globalInfo ? {
          ...globalInfo,
          hexDay: globalInfo.hexDay,
          stakeSharesTotal: globalInfo.stakeSharesTotal,
          stakePenaltyTotal: globalInfo.stakePenaltyTotal,
          lockedHeartsTotal: globalInfo.lockedHeartsTotal || '0',
          latestStakeId: globalInfo.latestStakeId || '0'
        } : null,
        topStakes,
        totalActiveStakes,
        totalStakedHearts,
        averageStakeLength
      };
    } catch (error) {
      console.error('❌ Error fetching PulseChain staking metrics:', error);
      throw error;
    }
  }

  async getAllStakeStartsPaginated(limit?: number, forceRefresh = false): Promise<any[]> {
    // Check cache first (unless forcing refresh)
    if (!forceRefresh && this.dataCache.stakeStarts && this.isCacheValid()) {
      console.log('📋 Using cached stake starts data');
      // If no limit specified, return all cached data
      if (limit === undefined) {
        return this.dataCache.stakeStarts.map(stake => ({
          ...stake,
          network: 'pulsechain'
        }));
      }
      // If limit specified, return limited data
      return this.dataCache.stakeStarts.slice(0, limit).map(stake => ({
        ...stake,
        network: 'pulsechain'
      }));
    }

    // If we need to fetch fresh data, we should get ALL data first
    if (limit === undefined) {
      console.log('🔍 Fetching ALL PulseChain stake starts for caching...');
      // This will populate the cache with all data
      await this.getAllActiveStakes(forceRefresh);
      
      // Now return all cached data
      if (this.dataCache.stakeStarts) {
        return this.dataCache.stakeStarts.map(stake => ({
          ...stake,
          network: 'pulsechain'
        }));
      }
    }

    console.log(`🔍 Fetching PulseChain stake starts (limit: ${limit || 'ALL'})...`);
    
    try {
      const query = `
        query GetAllStakeStarts($limit: Int!) {
          stakeStarts(
            first: $limit,
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
            isAutoStake
            stakeTShares
            transactionHash
            blockNumber
          }
        }
      `;

      const data = await this.executeQuery<{
        stakeStarts: Array<{
          id: string;
          stakeId: string;
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
      }>(query, { limit: limit || 1000 });

      const result = data.stakeStarts.map(stake => ({
        ...stake,
        network: 'pulsechain'
      }));

      // Cache the results if we're fetching fresh data
      if (!this.dataCache.stakeStarts || !this.isCacheValid()) {
        this.updateCache(data.stakeStarts, 'stakeStarts');
      }

      return result;
    } catch (error) {
      console.error('❌ Error fetching PulseChain stake starts:', error);
      throw error;
    }
  }

  async getAllActiveStakes(forceRefresh = false): Promise<any[]> {
    // Try database first if available
    if (false && this.isDatabaseAvailable && !forceRefresh) {
      try {
        console.log('🗄️ Fetching active stakes from database...');
        const globalInfo = await pulsechainStakingDb.getLatestGlobalInfo();
        const currentDay = globalInfo ? globalInfo.hex_day : 0;
        
        const dbStakes = await pulsechainStakingDb.getActiveStakes({ currentDay });
        if (dbStakes.length > 0) {
          console.log(`✅ Retrieved ${dbStakes.length} active stakes from database`);
          const serviceStakes = dbStakes.map(stake => this.dbStakeToServiceStake(stake, currentDay));
          
          // Update cache
          this.dataCache.allActiveStakes = serviceStakes;
          this.dataCache.lastFetchTime = Date.now();
          
          return serviceStakes;
        }
      } catch (error) {
        console.warn('⚠️ Database query failed, falling back to GraphQL:', error);
      }
    }

    // Check memory cache next (unless forcing refresh)
    if (!forceRefresh && this.dataCache.allActiveStakes && this.isCacheValid()) {
      console.log('📋 Using cached active stakes data');
      return this.dataCache.allActiveStakes;
    }

    console.log('🔍 Fetching ALL PulseChain active stakes from GraphQL with pagination...');
    
    try {
      // First get current day
      const globalInfo = await this.getCurrentGlobalInfo();
      const currentDay = globalInfo ? parseInt(globalInfo.hexDay) : 0;

      let allStakeStarts: any[] = [];
      let allStakeEnds: any[] = [];
      let skip = 0;
      const batchSize = 1000;
      const maxIterations = 50; // Safety limit to prevent infinite loops
      let iterations = 0;

      // Fetch ALL stake starts with pagination
      console.log('🔍 Fetching all stake starts...');
      while (iterations < maxIterations) {
        const query = `
          query GetStakeStarts($skip: Int!, $first: Int!) {
            stakeStarts(
              skip: $skip,
              first: $first,
              orderBy: stakeId,
              orderDirection: asc
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
        }>(query, { skip, first: batchSize });

        const batch = data.stakeStarts;
        allStakeStarts.push(...batch);
        
        console.log(`📦 Fetched batch ${iterations + 1}: ${batch.length} stakes (Total: ${allStakeStarts.length})`);

        if (batch.length < batchSize) {
          // We've reached the end
          break;
        }

        skip += batchSize;
        iterations++;
      }

      // Fetch ALL stake ends with pagination
      console.log('🔍 Fetching all stake ends...');
      skip = 0;
      iterations = 0;
      
      while (iterations < maxIterations) {
        const query = `
          query GetStakeEnds($skip: Int!, $first: Int!) {
            stakeEnds(
              skip: $skip,
              first: $first,
              orderBy: stakeId,
              orderDirection: asc
            ) {
              stakeId
            }
          }
        `;

        const data = await this.executeQuery<{
          stakeEnds: Array<{ stakeId: string }>;
        }>(query, { skip, first: batchSize });

        const batch = data.stakeEnds;
        allStakeEnds.push(...batch);
        
        console.log(`📦 Fetched stake ends batch ${iterations + 1}: ${batch.length} ends (Total: ${allStakeEnds.length})`);

        if (batch.length < batchSize) {
          // We've reached the end
          break;
        }

        skip += batchSize;
        iterations++;
      }

      // Create a set of ended stake IDs
      const endedStakeIds = new Set(allStakeEnds.map(end => end.stakeId));

      // Filter active stakes (not ended and not past end day)
      const activeStakes = allStakeStarts
        .filter(stake => {
          const isNotEnded = !endedStakeIds.has(stake.stakeId);
          const isNotPastEndDay = parseInt(stake.endDay) >= currentDay;
          return isNotEnded && isNotPastEndDay;
        })
        .map(stake => ({
          ...stake,
          network: 'pulsechain',
          isActive: true,
          daysServed: Math.max(0, currentDay - parseInt(stake.startDay)),
          daysLeft: Math.max(0, parseInt(stake.endDay) - currentDay),
        }));

      console.log(`✅ Found ${activeStakes.length} active PulseChain stakes out of ${allStakeStarts.length} total stakes`);
      
      // Cache the results
      this.updateCache(allStakeStarts, 'stakeStarts');
      this.updateCache(allStakeEnds, 'stakeEnds');
      this.updateCache(activeStakes, 'allActiveStakes');
      
      // Store in database if available
      if (this.isDatabaseAvailable) {
        try {
          console.log('💾 Storing fetched data in database...');
          
          // Convert and store stake starts
          const dbStakeStarts = allStakeStarts.map(stake => this.serviceStakeToDbStake(stake, currentDay));
          await pulsechainStakingDb.insertStakeStartsBatch(dbStakeStarts);
          
          // Store global info
          if (globalInfo) {
            await pulsechainStakingDb.insertGlobalInfo({
              hex_day: parseInt(globalInfo.hexDay),
              stake_shares_total: globalInfo.stakeSharesTotal,
              stake_penalty_total: globalInfo.stakePenaltyTotal,
              locked_hearts_total: '0', // Not available in this query
              latest_stake_id: null,
              timestamp: Date.now().toString(),
              network: 'pulsechain'
            });
          }
          
          console.log('✅ Data successfully stored in database');
        } catch (error) {
          console.warn('⚠️ Failed to store data in database:', error);
        }
      }
      
      return activeStakes;
    } catch (error) {
      console.error('❌ Error fetching PulseChain active stakes:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const pulsechainHexStakingService = new PulseChainHexStakingService();
