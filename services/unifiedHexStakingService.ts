import { hexStakingDb, type DbStakeStart, type DbGlobalInfo } from '../lib/db/hexStakingDb';

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
  network: 'ethereum' | 'pulsechain';
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
  network: 'ethereum' | 'pulsechain';
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
  network: 'ethereum' | 'pulsechain';
  lastSyncTime: string | null;
  isDataAvailable: boolean;
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
  network: 'ethereum' | 'pulsechain';
}

type NetworkType = 'ethereum' | 'pulsechain';

export class UnifiedHexStakingService {
  
  // Convert database stake to service format
  private convertDbStakeToService(dbStake: DbStakeStart): HexStake {
    return {
      id: dbStake.stake_id,
      stakeId: dbStake.stake_id,
      stakerAddr: dbStake.staker_addr,
      stakedHearts: dbStake.staked_hearts,
      stakeShares: dbStake.stake_shares,
      stakedDays: dbStake.staked_days.toString(),
      startDay: dbStake.start_day.toString(),
      endDay: dbStake.end_day.toString(),
      timestamp: dbStake.timestamp,
      isAutoStake: dbStake.is_auto_stake,
      stakeTShares: dbStake.stake_t_shares || '0',
      isActive: dbStake.is_active,
      daysServed: dbStake.days_served,
      daysLeft: dbStake.days_left,
      transactionHash: dbStake.transaction_hash,
      blockNumber: dbStake.block_number,
      network: dbStake.network
    };
  }

  // Convert database global info to service format
  private convertDbGlobalInfoToService(dbGlobalInfo: DbGlobalInfo): HexGlobalInfo {
    return {
      id: dbGlobalInfo.id.toString(),
      hexDay: dbGlobalInfo.hex_day.toString(),
      stakeSharesTotal: dbGlobalInfo.stake_shares_total,
      stakePenaltyTotal: dbGlobalInfo.stake_penalty_total,
      latestStakeId: dbGlobalInfo.latest_stake_id,
      shareRate: '0', // Not available in our DB schema yet
      totalSupply: '0', // Not available in our DB schema yet
      lockedHeartsTotal: dbGlobalInfo.locked_hearts_total,
      timestamp: dbGlobalInfo.timestamp
    };
  }

  // Get comprehensive staking metrics for a network
  async getStakingMetrics(network: NetworkType): Promise<HexStakingMetrics> {
    console.log(`🔍 Getting ${network} staking metrics from database...`);
    
    try {
      // Check if tables exist
      const tablesExist = await hexStakingDb.checkTablesExist();
      if (!tablesExist.stakeStarts || !tablesExist.globalInfo) {
        console.warn(`⚠️ Required tables don't exist for ${network}. Run database setup first.`);
        return this.getEmptyMetrics(network);
      }

      // Get all data in parallel
      const [overview, globalInfo, topStakes, recentStakes, syncStatus] = await Promise.all([
        hexStakingDb.getStakingOverview(network),
        hexStakingDb.getLatestGlobalInfo(network),
        hexStakingDb.getTopStakes(network, 100),
        hexStakingDb.getRecentStakeStarts(network, 50),
        hexStakingDb.getSyncStatus(network)
      ]);

      console.log(`✅ Retrieved ${network} metrics: ${overview.totalActiveStakes} active stakes`);

      return {
        totalActiveStakes: overview.totalActiveStakes,
        totalStakedHearts: overview.totalStakedHearts,
        averageStakeLength: overview.averageStakeLength,
        globalInfo: globalInfo ? this.convertDbGlobalInfoToService(globalInfo) : null,
        topStakes: topStakes.map(stake => this.convertDbStakeToService(stake)),
        recentStakeStarts: recentStakes.map(stake => this.convertDbStakeToService(stake)),
        network,
        lastSyncTime: syncStatus?.last_sync_completed_at || null,
        isDataAvailable: overview.totalActiveStakes > 0
      };

    } catch (error) {
      console.error(`❌ Failed to get ${network} staking metrics:`, error);
      return this.getEmptyMetrics(network);
    }
  }

  // Get staker history for a specific address and network
  async getStakerHistory(stakerAddr: string, network: NetworkType): Promise<StakerHistoryMetrics> {
    console.log(`🔍 Fetching staker history for ${stakerAddr} on ${network}...`);
    
    try {
      const [stakerData, globalInfo] = await Promise.all([
        hexStakingDb.getStakerStakes(stakerAddr, network),
        hexStakingDb.getLatestGlobalInfo(network)
      ]);

      const currentDay = globalInfo ? globalInfo.hex_day : 0;
      
      // Convert stakes to service format
      const stakes = stakerData.stakes.map(stake => this.convertDbStakeToService(stake));
      const stakeEnds = stakerData.stakeEnds.map(end => ({
        id: end.stake_id,
        stakeId: end.stake_id,
        stakerAddr: end.staker_addr,
        payout: end.payout,
        stakedHearts: end.staked_hearts,
        penalty: end.penalty,
        servedDays: end.served_days.toString(),
        timestamp: end.timestamp,
        transactionHash: end.transaction_hash,
        blockNumber: end.block_number,
        network: end.network
      }));

      // Calculate metrics
      const activeStakes = stakes.filter(s => s.isActive);
      const endedStakes = stakes.filter(s => !s.isActive);
      
      const totalStakedHearts = stakes.reduce((sum, stake) => sum + parseFloat(stake.stakedHearts), 0);
      const totalTShares = stakes.reduce((sum, stake) => sum + parseFloat(stake.stakeTShares || '0'), 0);
      const averageStakeLength = stakes.length > 0 
        ? stakes.reduce((sum, stake) => sum + parseInt(stake.stakedDays), 0) / stakes.length 
        : 0;
      
      const totalPenalties = stakeEnds.reduce((sum, end) => sum + parseFloat(end.penalty || '0'), 0);
      const totalPayouts = stakeEnds.reduce((sum, end) => sum + parseFloat(end.payout || '0'), 0);

      console.log(`✅ Fetched history for ${stakerAddr}: ${stakes.length} total stakes`);

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
        stakeEnds,
        currentDay,
        network
      };

    } catch (error) {
      console.error(`❌ Failed to fetch staker history for ${stakerAddr}:`, error);
      throw error;
    }
  }

  // Get all active stakes for a network
  async getAllActiveStakes(network: NetworkType, limit: number = 10000): Promise<HexStake[]> {
    console.log(`🔍 Fetching all active ${network} stakes...`);
    
    try {
      const globalInfo = await hexStakingDb.getLatestGlobalInfo(network);
      const currentDay = globalInfo ? globalInfo.hex_day : 0;
      
      const dbStakes = await hexStakingDb.getActiveStakes({ 
        network, 
        currentDay, 
        limit 
      });
      
      const stakes = dbStakes.map(stake => this.convertDbStakeToService(stake));
      
      console.log(`✅ Retrieved ${stakes.length} active ${network} stakes`);
      return stakes;
      
    } catch (error) {
      console.error(`❌ Failed to fetch active ${network} stakes:`, error);
      return [];
    }
  }

  // Get current global info for a network
  async getCurrentGlobalInfo(network: NetworkType): Promise<HexGlobalInfo | null> {
    try {
      const dbGlobalInfo = await hexStakingDb.getLatestGlobalInfo(network);
      return dbGlobalInfo ? this.convertDbGlobalInfoToService(dbGlobalInfo) : null;
    } catch (error) {
      console.error(`❌ Failed to get ${network} global info:`, error);
      return null;
    }
  }

  // Get database status for both networks
  async getDatabaseStatus(): Promise<{
    tablesExist: boolean;
    networks: {
      network: 'ethereum' | 'pulsechain';
      stakeStarts: number;
      stakeEnds: number;
      globalInfo: number;
      lastSync: string | null;
    }[];
  }> {
    try {
      const [tablesExist, tableCounts] = await Promise.all([
        hexStakingDb.checkTablesExist(),
        hexStakingDb.getTableCounts()
      ]);

      const networks = await Promise.all(['ethereum', 'pulsechain'].map(async (network) => {
        const syncStatus = await hexStakingDb.getSyncStatus(network as NetworkType);
        const counts = tableCounts.find(t => t.network === network);
        
        return {
          network: network as 'ethereum' | 'pulsechain',
          stakeStarts: counts?.stakeStarts || 0,
          stakeEnds: counts?.stakeEnds || 0,
          globalInfo: counts?.globalInfo || 0,
          lastSync: syncStatus?.last_sync_completed_at || null
        };
      }));

      return {
        tablesExist: tablesExist.stakeStarts && tablesExist.globalInfo,
        networks
      };
      
    } catch (error) {
      console.error('❌ Failed to get database status:', error);
      return {
        tablesExist: false,
        networks: []
      };
    }
  }

  // Helper: Format HEX amount for display
  formatHexAmount(amount: string, decimals: number = 8): string {
    const num = parseFloat(amount) / Math.pow(10, 8); // HEX has 8 decimals
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(decimals);
  }

  // Helper: Format T-Share amount for display
  formatTShareAmount(amount: string, decimals: number = 2): string {
    const num = parseFloat(amount);
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(decimals);
  }

  // Helper: Format stake length
  formatStakeLength(days: number): string {
    if (days >= 365) {
      const years = (days / 365).toFixed(1);
      return `${years} year${parseFloat(years) !== 1 ? 's' : ''}`;
    }
    return `${days} day${days !== 1 ? 's' : ''}`;
  }

  // Helper: Get chain info
  getChainInfo(network: NetworkType): { name: string; explorers: string[] } {
    if (network === 'ethereum') {
      return {
        name: 'Ethereum',
        explorers: [
          'https://etherscan.io',
          'https://eth.blockscout.com'
        ]
      };
    } else {
      return {
        name: 'PulseChain',
        explorers: [
          'https://scan.pulsechain.com',
          'https://pulsechaindata.com'
        ]
      };
    }
  }

  // Helper: Get transaction URL
  getTransactionUrl(transactionHash: string, network: NetworkType, explorer = 'primary'): string {
    const chainInfo = this.getChainInfo(network);
    const baseUrl = explorer === 'secondary' ? chainInfo.explorers[1] : chainInfo.explorers[0];
    return `${baseUrl}/tx/${transactionHash}`;
  }

  // Helper: Get empty metrics
  private getEmptyMetrics(network: NetworkType): HexStakingMetrics {
    return {
      totalActiveStakes: 0,
      totalStakedHearts: '0',
      averageStakeLength: 0,
      globalInfo: null,
      topStakes: [],
      recentStakeStarts: [],
      network,
      lastSyncTime: null,
      isDataAvailable: false
    };
  }
}

// Export singleton instance
export const unifiedHexStakingService = new UnifiedHexStakingService();