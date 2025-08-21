import { pulsechainStakingDb } from '../db/pulsechainStakingDb';
import { PulseChainHexStakingService } from '../../services/pulsechainHexStakingService';

export class PulsechainSyncService {
  private syncService: PulseChainHexStakingService;
  private isRunning = false;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.syncService = new PulseChainHexStakingService();
  }

  async startPeriodicSync(intervalMinutes: number = 30): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Sync service already running');
      return;
    }

    console.log(`🔄 Starting PulseChain sync service (every ${intervalMinutes} minutes)`);
    this.isRunning = true;

    // Run initial sync
    await this.performSync();

    // Set up periodic sync
    this.syncInterval = setInterval(async () => {
      try {
        await this.performSync();
      } catch (error) {
        console.error('❌ Periodic sync failed:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }

  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    console.log('⏹️ PulseChain sync service stopped');
  }

  async performSync(): Promise<{
    success: boolean;
    newStakes: number;
    newStakeEnds: number;
    updatedStakes: number;
    error?: string;
  }> {
    try {
      console.log('🔄 Starting PulseChain data synchronization...');
      
      // Check if sync is already in progress
      const syncStatus = await pulsechainStakingDb.getSyncStatus();
      if (syncStatus?.sync_in_progress) {
        console.log('⚠️ Sync already in progress, skipping...');
        return { success: false, newStakes: 0, newStakeEnds: 0, updatedStakes: 0, error: 'Sync already in progress' };
      }

      // Mark sync as in progress
      await pulsechainStakingDb.setSyncInProgress(true);

      let newStakes = 0;
      let newStakeEnds = 0;
      let updatedStakes = 0;

      try {
        // Get current sync status
        const lastSyncedStakeId = syncStatus?.last_synced_stake_id || '0';
        console.log(`📊 Last synced stake ID: ${lastSyncedStakeId}`);

        // Fetch latest global info to get current day
        const globalInfo = await this.syncService.getCurrentGlobalInfo();
        const currentDay = globalInfo ? parseInt(globalInfo.hexDay) : 0;

        // Sync new stake starts (incremental)
        const newStakeStarts = await this.syncNewStakeStarts(lastSyncedStakeId);
        newStakes = newStakeStarts.length;

        if (newStakes > 0) {
          console.log(`📥 Found ${newStakes} new stake starts`);
          
          // Convert to database format
          const dbStakeStarts = newStakeStarts.map(stake => ({
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
            network: 'pulsechain' as const,
            is_active: currentDay <= parseInt(stake.endDay),
            days_served: Math.max(0, currentDay - parseInt(stake.startDay)),
            days_left: Math.max(0, parseInt(stake.endDay) - currentDay),
          }));

          // Batch insert new stakes
          await pulsechainStakingDb.insertStakeStartsBatch(dbStakeStarts);

          // Update sync status with latest stake ID
          const latestStakeId = Math.max(...newStakeStarts.map(s => parseInt(s.stakeId))).toString();
          await pulsechainStakingDb.updateSyncStatus({
            last_synced_stake_id: latestStakeId,
            total_stakes_synced: (syncStatus?.total_stakes_synced || 0) + newStakes,
            last_synced_timestamp: Date.now().toString()
          });
        }

        // Update stake activity status based on current day
        await pulsechainStakingDb.updateStakeActivity(currentDay);
        
        // Store current global info
        if (globalInfo) {
          await pulsechainStakingDb.insertGlobalInfo({
            hex_day: parseInt(globalInfo.hexDay),
            stake_shares_total: globalInfo.stakeSharesTotal,
            stake_penalty_total: globalInfo.stakePenaltyTotal,
            locked_hearts_total: '0', // Not available from current query
            latest_stake_id: null,
            timestamp: Date.now().toString(),
            network: 'pulsechain'
          });
        }

        // Mark sync as completed
        await pulsechainStakingDb.setSyncInProgress(false);

        console.log(`✅ Sync completed successfully: ${newStakes} new stakes, ${updatedStakes} updated`);
        
        return {
          success: true,
          newStakes,
          newStakeEnds,
          updatedStakes
        };

      } catch (error) {
        // Mark sync as failed
        await pulsechainStakingDb.setSyncInProgress(false, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }

    } catch (error) {
      console.error('❌ Sync failed:', error);
      return {
        success: false,
        newStakes: 0,
        newStakeEnds: 0,
        updatedStakes: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async syncNewStakeStarts(lastSyncedStakeId: string): Promise<any[]> {
    try {
      // Query for stakes with ID greater than last synced
      const query = `
        query GetNewStakeStarts($lastStakeId: String!) {
          stakeStarts(
            where: { stakeId_gt: $lastStakeId },
            first: 1000,
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

      const data = await this.syncService.executeQuery<{
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
      }>(query, { lastStakeId: lastSyncedStakeId });

      return data.stakeStarts || [];
    } catch (error) {
      console.error('❌ Error fetching new stake starts:', error);
      return [];
    }
  }

  async getStatus(): Promise<{
    isRunning: boolean;
    lastSync?: Date;
    totalStakesSynced?: number;
    syncInProgress?: boolean;
    errorMessage?: string;
  }> {
    try {
      const syncStatus = await pulsechainStakingDb.getSyncStatus();
      return {
        isRunning: this.isRunning,
        lastSync: syncStatus?.last_sync_completed_at || undefined,
        totalStakesSynced: syncStatus?.total_stakes_synced || 0,
        syncInProgress: syncStatus?.sync_in_progress || false,
        errorMessage: syncStatus?.error_message || undefined
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      return { isRunning: this.isRunning };
    }
  }

  async forcefulSync(): Promise<void> {
    console.log('🔄 Performing forceful sync (this may take a while)...');
    
    try {
      // Reset sync status
      await pulsechainStakingDb.updateSyncStatus({
        last_synced_stake_id: '0',
        sync_in_progress: false,
        error_message: null
      });

      // Perform full sync
      await this.performSync();
      
      console.log('✅ Forceful sync completed');
    } catch (error) {
      console.error('❌ Forceful sync failed:', error);
      throw error;
    }
  }

  // Method to sync staker metrics for improved analytics
  async syncStakerMetrics(stakerAddresses?: string[]): Promise<void> {
    try {
      console.log('📊 Syncing staker metrics...');
      
      let addresses = stakerAddresses;
      
      // If no specific addresses provided, get all unique staker addresses
      if (!addresses) {
        const result = await pulsechainStakingDb.sql`
          SELECT DISTINCT staker_addr FROM pulsechain_stake_starts LIMIT 1000
        `;
        addresses = result.map((row: any) => row.staker_addr);
      }

      // Update metrics for each staker
      for (const address of addresses) {
        await pulsechainStakingDb.upsertStakerMetrics(address);
      }

      console.log(`✅ Updated metrics for ${addresses.length} stakers`);
    } catch (error) {
      console.error('❌ Error syncing staker metrics:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const pulsechainSyncService = new PulsechainSyncService();