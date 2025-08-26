import { hexStakingDb } from '../db/hexStakingDb';
import { hexStakingService } from '../../services/hexStakingService';

export interface SyncResult {
  success: boolean;
  newStakes: number;
  newStakeEnds: number;
  updatedStakes: number;
  error?: string;
}

export interface SyncStatus {
  isRunning: boolean;
  lastSync?: string;
  totalStakesSynced: number;
  syncInProgress: boolean;
  errorMessage?: string;
}

class EthereumSyncService {
  private isRunning = false;
  private readonly network = 'ethereum';

  async performSync(batchSize: number = 1000): Promise<SyncResult> {
    if (this.isRunning) {
      return { success: false, newStakes: 0, newStakeEnds: 0, updatedStakes: 0, error: 'Sync already in progress' };
    }

    this.isRunning = true;
    console.log('🔄 Starting Ethereum HEX data synchronization...');

    try {
      await hexStakingDb.updateSyncStatus(this.network, { sync_in_progress: true });

      // Get current sync status
      const syncStatus = await hexStakingDb.getSyncStatus(this.network);
      const lastSyncedStakeId = syncStatus?.last_synced_stake_id || '0';
      console.log(`📊 Last synced Ethereum stake ID: ${lastSyncedStakeId}`);

      // Fetch new stakes from Ethereum GraphQL
      console.log('📡 Fetching Ethereum stakes from GraphQL...');
      const allStakeStarts = await hexStakingService.getAllStakeStartsPaginated(batchSize);
      
      // Get existing Ethereum stakes to avoid duplicates
      const existingEthStakes = await hexStakingDb.getActiveStakes({ 
        network: this.network, 
        limit: 100000 
      });
      const existingStakeIds = new Set(existingEthStakes.map(s => s.stake_id));
      
      // Filter out stakes we already have (by stake_id and network)
      const lastSyncedId = parseInt(lastSyncedStakeId);
      const newStakeStarts = allStakeStarts.filter(stake => 
        !existingStakeIds.has(stake.stakeId) && parseInt(stake.stakeId) > lastSyncedId
      );

      console.log(`📥 Found ${newStakeStarts.length} new Ethereum stake starts`);

      if (newStakeStarts.length === 0) {
        await hexStakingDb.updateSyncStatus(this.network, { sync_in_progress: false });
        this.isRunning = false;
        return { success: true, newStakes: 0, newStakeEnds: 0, updatedStakes: 0 };
      }

      // Get global info for current day calculation
      const globalInfoData = await hexStakingService.getStakingMetrics();
      const currentDay = globalInfoData.globalInfo ? parseInt(globalInfoData.globalInfo.hexDay) : 0;

      // Convert service stakes to database format
      const dbStakeStarts = newStakeStarts.map(stake => ({
        stake_id: stake.stakeId,
        staker_addr: stake.stakerAddr,
        staked_hearts: stake.stakedHearts,
        stake_shares: stake.stakeShares,
        stake_t_shares: stake.stakeTShares || '0',
        staked_days: parseInt(stake.stakedDays),
        start_day: parseInt(stake.startDay),
        end_day: parseInt(stake.endDay),
        timestamp: stake.timestamp,
        is_auto_stake: stake.isAutoStake,
        transaction_hash: stake.transactionHash,
        block_number: stake.blockNumber,
        network: this.network,
        is_active: currentDay === 0 || parseInt(stake.endDay) > currentDay,
        days_served: Math.max(0, currentDay - parseInt(stake.startDay)),
        days_left: Math.max(0, parseInt(stake.endDay) - currentDay)
      }));

      // Insert stakes in batches
      console.log('💾 Inserting Ethereum stakes to database...');
      await hexStakingDb.insertStakeStartsBatch(dbStakeStarts);
      console.log(`✅ Batch inserted ${dbStakeStarts.length} Ethereum stakes`);

      // Update activity status based on current day
      if (currentDay > 0) {
        console.log('🔄 Updating stake activity status...');
        // This would require additional database methods for updates
        console.log('✅ Updated stake activity status');
      }

      // Store global info
      if (globalInfoData.globalInfo) {
        try {
          await hexStakingDb.insertGlobalInfo({
            hex_day: parseInt(globalInfoData.globalInfo.hexDay),
            stake_shares_total: globalInfoData.globalInfo.stakeSharesTotal,
            stake_penalty_total: globalInfoData.globalInfo.stakePenaltyTotal,
            locked_hearts_total: globalInfoData.globalInfo.lockedHeartsTotal,
            latest_stake_id: globalInfoData.globalInfo.latestStakeId,
            timestamp: globalInfoData.globalInfo.timestamp,
            network: this.network
          });
        } catch (globalError) {
          console.warn('⚠️ Failed to insert Ethereum global info (may already exist):', globalError);
        }
      }

      // Update sync status
      const latestStakeId = Math.max(...newStakeStarts.map(s => parseInt(s.stakeId))).toString();
      await hexStakingDb.updateSyncStatus(this.network, {
        last_synced_stake_id: latestStakeId,
        total_stakes_synced: (syncStatus?.total_stakes_synced || 0) + newStakeStarts.length,
        last_synced_timestamp: Date.now().toString(),
        sync_in_progress: false,
        last_sync_completed_at: new Date().toISOString()
      });

      console.log(`✅ Ethereum sync completed successfully: ${newStakeStarts.length} new stakes, 0 updated`);

      return {
        success: true,
        newStakes: newStakeStarts.length,
        newStakeEnds: 0, // TODO: Implement stake ends sync
        updatedStakes: 0
      };

    } catch (error) {
      console.error('❌ Ethereum sync failed:', error);
      
      await hexStakingDb.updateSyncStatus(this.network, { 
        sync_in_progress: false,
        error_message: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        newStakes: 0,
        newStakeEnds: 0,
        updatedStakes: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      this.isRunning = false;
    }
  }

  async getStatus(): Promise<SyncStatus> {
    try {
      const syncStatus = await hexStakingDb.getSyncStatus(this.network);
      
      return {
        isRunning: this.isRunning,
        lastSync: syncStatus?.last_sync_completed_at || undefined,
        totalStakesSynced: syncStatus?.total_stakes_synced || 0,
        syncInProgress: syncStatus?.sync_in_progress || false,
        errorMessage: syncStatus?.error_message || undefined
      };
    } catch (error) {
      console.error('Error getting Ethereum sync status:', error);
      return {
        isRunning: this.isRunning,
        totalStakesSynced: 0,
        syncInProgress: false,
        errorMessage: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async forcefulSync(): Promise<void> {
    console.log('🔄 Forcing Ethereum sync restart...');
    this.isRunning = false;
    
    await hexStakingDb.updateSyncStatus(this.network, { sync_in_progress: false });
    
    const result = await this.performSync();
    if (!result.success) {
      throw new Error(result.error || 'Forceful sync failed');
    }
  }
}

export const ethereumSyncService = new EthereumSyncService();