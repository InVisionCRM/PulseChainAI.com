import { HexStake, HexStakeEnd, HexGlobalInfo, StakerHistoryMetrics } from './hexStakingService';

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
  // Using a known PulseChain Graph endpoint - this would need to be updated with the actual PulseChain HEX subgraph
  private baseUrl = 'https://graph.pulsechain.com/subgraphs/name/hex/hex-staking';
  
  // Alternative endpoints to try
  private fallbackEndpoints = [
    'https://graph.v4.testnet.pulsechain.com/subgraphs/name/hex/hex-staking',
    'https://api.thegraph.com/subgraphs/name/pulsechain/hex-staking',
    'https://graph.pulsechain.com/subgraphs/name/pulsechain/hex'
  ];

  private async executeQuery<T>(query: string, variables: any = {}): Promise<T> {
    const payload = {
      query,
      variables
    };

    // Try main endpoint first
    try {
      const response = await this.tryEndpoint(this.baseUrl, payload);
      if (response.data) {
        return response.data;
      }
    } catch (error) {
      console.log(`Primary PulseChain endpoint failed: ${this.baseUrl}`);
    }

    // Try fallback endpoints
    for (const endpoint of this.fallbackEndpoints) {
      try {
        console.log(`Trying PulseChain fallback endpoint: ${endpoint}`);
        const response = await this.tryEndpoint(endpoint, payload);
        if (response.data) {
          console.log(`✅ Successfully connected to PulseChain endpoint: ${endpoint}`);
          this.baseUrl = endpoint; // Update to working endpoint
          return response.data;
        }
      } catch (error) {
        console.log(`Fallback endpoint failed: ${endpoint}`);
        continue;
      }
    }

    // If all endpoints fail, throw error but don't crash the app
    console.warn('⚠️ All PulseChain HEX staking endpoints failed. Using mock data.');
    return this.getMockData<T>();
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

  private getMockData<T>(): T {
    // Return mock data structure to prevent app crashes while we wait for proper PulseChain endpoints
    const mockData = {
      stakeStarts: [],
      stakeEnds: [],
      globalInfos: [
        {
          hexDay: '1000',
          stakeSharesTotal: '0',
          stakePenaltyTotal: '0'
        }
      ]
    };
    return mockData as T;
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
        'https://scan.pulsechain.com',
        'https://otter.pulsechain.com'
      ]
    };
  }

  getTransactionUrl(transactionHash: string, explorer = 'pulsescan'): string {
    const chainInfo = this.getChainInfo();
    const baseUrl = explorer === 'otter' ? chainInfo.explorers[1] : chainInfo.explorers[0];
    return `${baseUrl}/tx/${transactionHash}`;
  }

  formatHexAmount(amount: string): string {
    // Same formatting logic as the main service
    const num = parseFloat(amount) / Math.pow(10, 8);
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    } else {
      return num.toFixed(0);
    }
  }

  formatTShareAmount(amount: string): string {
    const num = parseFloat(amount) / Math.pow(10, 12);
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    } else {
      return num.toFixed(2);
    }
  }

  formatStakeLength(days: number): string {
    if (days >= 365) {
      const years = Math.floor(days / 365);
      const remainingDays = days % 365;
      if (remainingDays === 0) {
        return `${years}y`;
      }
      return `${years}y ${remainingDays}d`;
    }
    return `${days}d`;
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
      const query = `
        query GetStakingMetrics {
          globalInfos(first: 1, orderBy: timestamp, orderDirection: desc) {
            id
            hexDay
            stakeSharesTotal
            stakePenaltyTotal
            lockedHeartsTotal
            latestStakeId
          }
          stakeStarts(first: 1000, orderBy: stakedHearts, orderDirection: desc) {
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
        globalInfos: Array<{
          id: string;
          hexDay: string;
          stakeSharesTotal: string;
          stakePenaltyTotal: string;
          lockedHeartsTotal: string;
          latestStakeId: string;
        }>;
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
      }>(query);

      const globalInfo = data.globalInfos[0] || null;
      const allStakes = data.stakeStarts;
      const currentDay = globalInfo ? parseInt(globalInfo.hexDay) : 0;

      // Process stakes to add network identifier and status
      const stakes: PulseChainHexStake[] = allStakes.map(stake => ({
        ...stake,
        network: 'pulsechain' as const,
        isActive: currentDay <= parseInt(stake.endDay), // Simple active check
        daysServed: Math.max(0, currentDay - parseInt(stake.startDay)),
        daysLeft: Math.max(0, parseInt(stake.endDay) - currentDay),
      }));

      // Get top stakes (first 100)
      const topStakes = stakes.slice(0, 100);

      // Calculate metrics
      const totalActiveStakes = stakes.filter(s => s.isActive).length;
      const totalStakedHearts = stakes.reduce((sum, stake) => sum + parseFloat(stake.stakedHearts), 0).toString();
      const averageStakeLength = stakes.length > 0 
        ? stakes.reduce((sum, stake) => sum + parseInt(stake.stakedDays), 0) / stakes.length 
        : 0;

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

  async getAllStakeStartsPaginated(limit: number = 1000): Promise<any[]> {
    console.log(`🔍 Fetching PulseChain stake starts (limit: ${limit})...`);
    
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
      }>(query, { limit });

      return data.stakeStarts.map(stake => ({
        ...stake,
        network: 'pulsechain'
      }));
    } catch (error) {
      console.error('❌ Error fetching PulseChain stake starts:', error);
      throw error;
    }
  }

  async getAllActiveStakes(): Promise<any[]> {
    console.log('🔍 Fetching all PulseChain active stakes...');
    
    try {
      // First get current day
      const globalInfo = await this.getCurrentGlobalInfo();
      const currentDay = globalInfo ? parseInt(globalInfo.hexDay) : 0;

      const query = `
        query GetAllActiveStakes {
          stakeStarts(
            first: 1000,
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
          stakeEnds(
            first: 1000,
            orderBy: timestamp,
            orderDirection: desc
          ) {
            stakeId
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
        stakeEnds: Array<{ stakeId: string }>;
      }>(query);

      // Create a set of ended stake IDs
      const endedStakeIds = new Set(data.stakeEnds.map(end => end.stakeId));

      // Filter active stakes (not ended and not past end day)
      const activeStakes = data.stakeStarts
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

      console.log(`✅ Found ${activeStakes.length} active PulseChain stakes`);
      return activeStakes;
    } catch (error) {
      console.error('❌ Error fetching PulseChain active stakes:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const pulsechainHexStakingService = new PulseChainHexStakingService();
