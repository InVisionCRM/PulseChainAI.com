import { HexStake, HexStakeEnd, StakerHistoryMetrics, hexStakingService } from './hexStakingService';
import { PulseChainHexStake, PulseChainHexStakeEnd, PulseChainStakerHistoryMetrics, pulsechainHexStakingService } from './pulsechainHexStakingService';

// Enhanced interfaces for multi-network support
export interface MultiNetworkHexStake extends Omit<HexStake, 'network'> {
  network: 'ethereum' | 'pulsechain';
}

export interface MultiNetworkHexStakeEnd extends Omit<HexStakeEnd, 'network'> {
  network: 'ethereum' | 'pulsechain';
}

export interface MultiNetworkStakerHistoryMetrics {
  stakerAddress: string;
  networks: ('ethereum' | 'pulsechain')[];
  
  // Aggregated totals across all networks
  totalStakes: number;
  activeStakes: number;
  endedStakes: number;
  totalStakedHearts: string;
  totalTShares: string;
  averageStakeLength: number;
  totalPayouts: string;
  totalPenalties: string;
  
  // Network-specific data
  ethereum: {
    totalStakes: number;
    activeStakes: number;
    endedStakes: number;
    totalStakedHearts: string;
    totalTShares: string;
    averageStakeLength: number;
    totalPayouts: string;
    totalPenalties: string;
    stakes: MultiNetworkHexStake[];
    stakeEnds: MultiNetworkHexStakeEnd[];
  };
  
  pulsechain: {
    totalStakes: number;
    activeStakes: number;
    endedStakes: number;
    totalStakedHearts: string;
    totalTShares: string;
    averageStakeLength: number;
    totalPayouts: string;
    totalPenalties: string;
    stakes: MultiNetworkHexStake[];
    stakeEnds: MultiNetworkHexStakeEnd[];
  };
  
  // Combined data for display
  allStakes: MultiNetworkHexStake[];
  allStakeEnds: MultiNetworkHexStakeEnd[];
}

export interface MultiNetworkStakingMetrics {
  // Aggregated metrics across all networks
  totalActiveStakes: number;
  totalStakedHearts: string;
  averageStakeLength: number;
  
  // Network breakdown
  ethereum: {
    totalActiveStakes: number;
    totalStakedHearts: string;
    averageStakeLength: number;
    topStakes: MultiNetworkHexStake[];
  };
  
  pulsechain: {
    totalActiveStakes: number;
    totalStakedHearts: string;
    averageStakeLength: number;
    topStakes: MultiNetworkHexStake[];
  };
  
  // Combined top stakes across networks
  topStakes: MultiNetworkHexStake[];
}

export class MultiNetworkHexStakingService {
  
  async getStakerHistory(stakerAddr: string): Promise<MultiNetworkStakerHistoryMetrics> {
    console.log(`🌐 Fetching multi-network staking history for ${stakerAddr}...`);
    
    try {
      // Fetch data from both networks in parallel
      const [ethereumData, pulsechainDataResult] = await Promise.allSettled([
        hexStakingService.getStakerHistory(stakerAddr),
        pulsechainHexStakingService.getStakerHistory(stakerAddr)
      ]);
      
      // Handle Ethereum data
      let ethereumHistory: StakerHistoryMetrics | null = null;
      if (ethereumData.status === 'fulfilled') {
        ethereumHistory = ethereumData.value;
      } else {
        console.error('Failed to fetch Ethereum staking history:', ethereumData.reason);
      }
      
      // Handle PulseChain data
      let pulsechainHistory: PulseChainStakerHistoryMetrics | null = null;
      if (pulsechainDataResult.status === 'fulfilled') {
        pulsechainHistory = pulsechainDataResult.value;
      } else {
        console.warn('Failed to fetch PulseChain staking history:', pulsechainDataResult.reason);
      }
      
      // Convert Ethereum stakes to multi-network format
      const ethereumStakes: MultiNetworkHexStake[] = ethereumHistory?.stakes.map(stake => ({
        ...stake,
        network: 'ethereum' as const
      })) || [];
      
      const ethereumStakeEnds: MultiNetworkHexStakeEnd[] = ethereumHistory?.stakeEnds.map(end => ({
        ...end,
        network: 'ethereum' as const
      })) || [];
      
      // Convert PulseChain stakes to multi-network format
      const pulsechainStakes: MultiNetworkHexStake[] = pulsechainHistory?.stakes.map(stake => ({
        ...stake,
        network: 'pulsechain' as const
      })) || [];
      
      const pulsechainStakeEnds: MultiNetworkHexStakeEnd[] = pulsechainHistory?.stakeEnds.map(end => ({
        ...end,
        network: 'pulsechain' as const
      })) || [];
      
      // Combine all stakes and ends
      const allStakes = [...ethereumStakes, ...pulsechainStakes];
      const allStakeEnds = [...ethereumStakeEnds, ...pulsechainStakeEnds];
      
      // Calculate aggregated metrics
      const totalStakes = allStakes.length;
      const activeStakes = allStakes.filter(s => s.isActive).length;
      const endedStakes = allStakes.filter(s => !s.isActive).length;
      
      // Calculate total staked hearts (need to handle different decimal places and networks)
      const totalStakedHearts = this.addBigNumberStrings(
        ethereumHistory?.totalStakedHearts || '0',
        pulsechainHistory?.totalStakedHearts || '0'
      );
      
      const totalTShares = this.addBigNumberStrings(
        ethereumHistory?.totalTShares || '0',
        pulsechainHistory?.totalTShares || '0'
      );
      
      const totalPayouts = this.addBigNumberStrings(
        ethereumHistory?.totalPayouts || '0',
        pulsechainHistory?.totalPayouts || '0'
      );
      
      const totalPenalties = this.addBigNumberStrings(
        ethereumHistory?.totalPenalties || '0',
        pulsechainHistory?.totalPenalties || '0'
      );
      
      // Calculate weighted average stake length
      const ethereumTotalDays = ethereumHistory?.stakes.reduce((sum, stake) => sum + parseInt(stake.stakedDays), 0) || 0;
      const pulsechainTotalDays = pulsechainHistory?.stakes.reduce((sum, stake) => sum + parseInt(stake.stakedDays), 0) || 0;
      const averageStakeLength = totalStakes > 0 ? (ethereumTotalDays + pulsechainTotalDays) / totalStakes : 0;
      
      // Determine which networks have data
      const networks: ('ethereum' | 'pulsechain')[] = [];
      if (ethereumHistory && ethereumHistory.totalStakes > 0) networks.push('ethereum');
      if (pulsechainHistory && pulsechainHistory.totalStakes > 0) networks.push('pulsechain');
      
      return {
        stakerAddress: stakerAddr,
        networks,
        totalStakes,
        activeStakes,
        endedStakes,
        totalStakedHearts,
        totalTShares,
        averageStakeLength,
        totalPayouts,
        totalPenalties,
        
        ethereum: {
          totalStakes: ethereumHistory?.totalStakes || 0,
          activeStakes: ethereumHistory?.activeStakes || 0,
          endedStakes: ethereumHistory?.endedStakes || 0,
          totalStakedHearts: ethereumHistory?.totalStakedHearts || '0',
          totalTShares: ethereumHistory?.totalTShares || '0',
          averageStakeLength: ethereumHistory?.averageStakeLength || 0,
          totalPayouts: ethereumHistory?.totalPayouts || '0',
          totalPenalties: ethereumHistory?.totalPenalties || '0',
          stakes: ethereumStakes,
          stakeEnds: ethereumStakeEnds
        },
        
        pulsechain: {
          totalStakes: pulsechainHistory?.totalStakes || 0,
          activeStakes: pulsechainHistory?.activeStakes || 0,
          endedStakes: pulsechainHistory?.endedStakes || 0,
          totalStakedHearts: pulsechainHistory?.totalStakedHearts || '0',
          totalTShares: pulsechainHistory?.totalTShares || '0',
          averageStakeLength: pulsechainHistory?.averageStakeLength || 0,
          totalPayouts: pulsechainHistory?.totalPayouts || '0',
          totalPenalties: pulsechainHistory?.totalPenalties || '0',
          stakes: pulsechainStakes,
          stakeEnds: pulsechainStakeEnds
        },
        
        allStakes,
        allStakeEnds
      };
      
    } catch (error) {
      console.error(`❌ Error fetching multi-network staker history for ${stakerAddr}:`, error);
      throw error;
    }
  }
  
  async getTopStakes(limit: number = 100): Promise<MultiNetworkStakingMetrics> {
    console.log(`🌐 Fetching top stakes from both networks (limit: ${limit}) - DATABASE FIRST...`);
    
    try {
      // ALWAYS use database first - NEVER hit expensive GraphQL APIs directly
      const [ethereumStakes, pulsechainStakesResult] = await Promise.allSettled([
        this.getEthereumStakesFromDatabase(limit),
        this.getPulsechainStakesFromDatabase(limit)
      ]);
      
      // Handle Ethereum stakes
      let ethStakes: HexStake[] = [];
      if (ethereumStakes.status === 'fulfilled') {
        ethStakes = ethereumStakes.value;
        console.log(`✅ Retrieved ${ethStakes.length} Ethereum stakes from DATABASE`);
      } else {
        console.error('Failed to fetch Ethereum stakes from database:', ethereumStakes.reason);
      }
      
      // Handle PulseChain stakes
      let pulseStakes: PulseChainHexStake[] = [];
      if (pulsechainStakesResult.status === 'fulfilled') {
        pulseStakes = pulsechainStakesResult.value;
        console.log(`✅ Retrieved ${pulseStakes.length} PulseChain stakes from DATABASE`);
      } else {
        console.warn('Failed to fetch PulseChain stakes from database:', pulsechainStakesResult.reason);
      }
      
      // Convert to multi-network format
      const ethereumMultiStakes: MultiNetworkHexStake[] = ethStakes.map(stake => ({
        ...stake,
        network: 'ethereum' as const
      }));
      
      const pulsechainMultiStakes: MultiNetworkHexStake[] = pulseStakes.map(stake => ({
        ...stake,
        network: 'pulsechain' as const
      }));
      
      // Combine and sort by staked amount
      const allStakes = [...ethereumMultiStakes, ...pulsechainMultiStakes];
      const topCombinedStakes = allStakes
        .sort((a, b) => parseFloat(b.stakedHearts) - parseFloat(a.stakedHearts))
        .slice(0, limit);
      
      // Calculate network-specific metrics
      const ethereumTotalStaked = ethereumMultiStakes.reduce((sum, stake) => sum + parseFloat(stake.stakedHearts), 0);
      const pulsechainTotalStaked = pulsechainMultiStakes.reduce((sum, stake) => sum + parseFloat(stake.stakedHearts), 0);
      
      const ethereumAvgLength = ethereumMultiStakes.length > 0 
        ? ethereumMultiStakes.reduce((sum, stake) => sum + parseInt(stake.stakedDays), 0) / ethereumMultiStakes.length 
        : 0;
      
      const pulsechainAvgLength = pulsechainMultiStakes.length > 0 
        ? pulsechainMultiStakes.reduce((sum, stake) => sum + parseInt(stake.stakedDays), 0) / pulsechainMultiStakes.length 
        : 0;
      
      const totalStaked = ethereumTotalStaked + pulsechainTotalStaked;
      const totalStakes = ethereumMultiStakes.length + pulsechainMultiStakes.length;
      const averageStakeLength = totalStakes > 0 
        ? (ethereumAvgLength * ethereumMultiStakes.length + pulsechainAvgLength * pulsechainMultiStakes.length) / totalStakes 
        : 0;
      
      return {
        totalActiveStakes: totalStakes,
        totalStakedHearts: totalStaked.toString(),
        averageStakeLength,
        
        ethereum: {
          totalActiveStakes: ethereumMultiStakes.length,
          totalStakedHearts: ethereumTotalStaked.toString(),
          averageStakeLength: ethereumAvgLength,
          topStakes: ethereumMultiStakes.slice(0, limit)
        },
        
        pulsechain: {
          totalActiveStakes: pulsechainMultiStakes.length,
          totalStakedHearts: pulsechainTotalStaked.toString(),
          averageStakeLength: pulsechainAvgLength,
          topStakes: pulsechainMultiStakes.slice(0, limit)
        },
        
        topStakes: topCombinedStakes
      };
      
    } catch (error) {
      console.error('❌ Error fetching multi-network top stakes:', error);
      throw error;
    }
  }
  
  // Database-first methods - NO expensive GraphQL calls
  private async getEthereumStakesFromDatabase(limit: number): Promise<HexStake[]> {
    try {
      const { hexStakingDb } = await import('../lib/db/hexStakingDb');
      const globalInfo = await hexStakingDb.getLatestGlobalInfo('ethereum');
      const currentDay = globalInfo ? globalInfo.hex_day : 0;
      
      const dbStakes = await hexStakingDb.getActiveStakes({ 
        network: 'ethereum', 
        currentDay, 
        limit: limit * 2 // Get more to account for sorting
      });
      
      return dbStakes.map(stake => ({
        id: stake.stake_id,
        stakeId: stake.stake_id,
        stakerAddr: stake.staker_addr,
        stakedHearts: stake.staked_hearts,
        stakeShares: stake.stake_shares,
        stakeTShares: stake.stake_t_shares || '0',
        stakedDays: stake.staked_days.toString(),
        startDay: stake.start_day.toString(),
        endDay: stake.end_day.toString(),
        timestamp: stake.timestamp,
        isAutoStake: stake.is_auto_stake,
        transactionHash: stake.transaction_hash,
        blockNumber: stake.block_number,
        isActive: stake.is_active,
        daysServed: stake.days_served,
        daysLeft: stake.days_left,
        network: 'ethereum' as const
      }));
    } catch (error) {
      console.error('Database error for Ethereum stakes:', error);
      return [];
    }
  }
  
  private async getPulsechainStakesFromDatabase(limit: number): Promise<PulseChainHexStake[]> {
    try {
      const { hexStakingDb } = await import('../lib/db/hexStakingDb');
      const globalInfo = await hexStakingDb.getLatestGlobalInfo('pulsechain');
      const currentDay = globalInfo ? globalInfo.hex_day : 0;
      
      const dbStakes = await hexStakingDb.getActiveStakes({ 
        network: 'pulsechain', 
        currentDay, 
        limit: limit * 2 // Get more to account for sorting
      });
      
      return dbStakes.map(stake => ({
        id: stake.stake_id,
        stakeId: stake.stake_id,
        stakerAddr: stake.staker_addr,
        stakedHearts: stake.staked_hearts,
        stakeShares: stake.stake_shares,
        stakeTShares: stake.stake_t_shares || '0',
        stakedDays: stake.staked_days.toString(),
        startDay: stake.start_day.toString(),
        endDay: stake.end_day.toString(),
        timestamp: stake.timestamp,
        isAutoStake: stake.is_auto_stake,
        transactionHash: stake.transaction_hash,
        blockNumber: stake.block_number,
        isActive: stake.is_active,
        daysServed: stake.days_served,
        daysLeft: stake.days_left,
        network: 'pulsechain' as const
      }));
    } catch (error) {
      console.error('Database error for PulseChain stakes:', error);
      return [];
    }
  }
  
  // Utility methods
  private addBigNumberStrings(a: string, b: string): string {
    // Simple addition for string numbers (assumes same decimal places)
    const numA = parseFloat(a) || 0;
    const numB = parseFloat(b) || 0;
    return (numA + numB).toString();
  }
  
  getNetworkInfo(network: 'ethereum' | 'pulsechain') {
    return network === 'ethereum' 
      ? hexStakingService.getChainInfo()
      : pulsechainHexStakingService.getChainInfo();
  }
  
  getTransactionUrl(transactionHash: string, network: 'ethereum' | 'pulsechain', explorer?: string): string {
    return network === 'ethereum' 
      ? hexStakingService.getTransactionUrl(transactionHash, explorer)
      : pulsechainHexStakingService.getTransactionUrl(transactionHash, explorer);
  }
  
  formatHexAmount(amount: string): string {
    return hexStakingService.formatHexAmount(amount);
  }
  
  formatTShareAmount(amount: string): string {
    return hexStakingService.formatTShareAmount(amount);
  }
  
  formatStakeLength(days: number): string {
    return hexStakingService.formatStakeLength(days);
  }
  
  formatStakeLengthInDays(days: number): string {
    return hexStakingService.formatStakeLengthInDays(days);
  }
  
  calculateLateEndingDays(stake: MultiNetworkHexStake, stakeEnd: MultiNetworkHexStakeEnd): number {
    if (stake.network === 'ethereum') {
      return hexStakingService.calculateLateEndingDays(stake, stakeEnd);
    } else {
      return pulsechainHexStakingService.calculateLateEndingDays(stake as PulseChainHexStake, stakeEnd as PulseChainHexStakeEnd);
    }
  }
  
  calculateStakeAPY(stake: MultiNetworkHexStake, stakeEnd: MultiNetworkHexStakeEnd): number {
    if (stake.network === 'ethereum') {
      return hexStakingService.calculateStakeAPY(stake, stakeEnd);
    } else {
      return pulsechainHexStakingService.calculateStakeAPY(stake as PulseChainHexStake, stakeEnd as PulseChainHexStakeEnd);
    }
  }
}

// Export singleton instance
export const multiNetworkHexStakingService = new MultiNetworkHexStakingService();
