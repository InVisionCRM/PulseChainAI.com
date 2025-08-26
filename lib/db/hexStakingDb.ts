import { sql } from './connection';

export interface DbStakeStart {
  id: number;
  stake_id: string;
  staker_addr: string;
  staked_hearts: string;
  stake_shares: string;
  stake_t_shares: string;
  staked_days: number;
  start_day: number;
  end_day: number;
  timestamp: string;
  is_auto_stake: boolean;
  transaction_hash: string;
  block_number: string;
  network: string;
  is_active: boolean;
  days_served: number;
  days_left: number;
  created_at: string;
  updated_at: string;
}

export interface DbGlobalInfo {
  id: number;
  hex_day: number;
  stake_shares_total: string;
  stake_penalty_total: string;
  locked_hearts_total: string;
  latest_stake_id: string;
  timestamp: string;
  network: string;
  created_at: string;
}

export interface DbSyncStatus {
  id: number;
  network: string;
  last_synced_stake_id: string;
  last_synced_block: string;
  last_synced_timestamp: string;
  total_stakes_synced: number;
  total_stake_ends_synced: number;
  sync_in_progress: boolean;
  last_sync_started_at: string;
  last_sync_completed_at: string;
  error_message: string;
  created_at: string;
  updated_at: string;
}

export class HexStakingDb {
  
  // Get active stakes for a specific network
  async getActiveStakes(options: { network: string; currentDay?: number; limit?: number }): Promise<DbStakeStart[]> {
    try {
      const { network, currentDay = 0, limit = 10000 } = options;
      
      const result = await sql`
        SELECT * FROM hex_stake_starts 
        WHERE network = ${network}
        AND is_active = true
        AND (${currentDay} = 0 OR end_day > ${currentDay})
        ORDER BY staked_hearts DESC
        LIMIT ${limit}
      `;
      
      return result as DbStakeStart[];
    } catch (error) {
      console.error('Error getting active stakes:', error);
      throw error;
    }
  }

  // Get latest global info for a network
  async getLatestGlobalInfo(network: string): Promise<DbGlobalInfo | null> {
    try {
      const result = await sql`
        SELECT * FROM hex_global_info 
        WHERE network = ${network}
        ORDER BY id DESC 
        LIMIT 1
      `;
      return result.length > 0 ? (result[0] as DbGlobalInfo) : null;
    } catch (error) {
      console.error('Error getting latest global info:', error);
      throw error;
    }
  }

  // Get sync status for a network
  async getSyncStatus(network: string): Promise<DbSyncStatus | null> {
    try {
      const result = await sql`
        SELECT * FROM hex_sync_status 
        WHERE network = ${network}
        ORDER BY id DESC 
        LIMIT 1
      `;
      return result.length > 0 ? (result[0] as DbSyncStatus) : null;
    } catch (error) {
      console.error('Error getting sync status:', error);
      throw error;
    }
  }

  // Insert stake starts in batch
  async insertStakeStartsBatch(stakes: Omit<DbStakeStart, 'id' | 'created_at' | 'updated_at'>[]): Promise<void> {
    try {
      for (const stake of stakes) {
        try {
          await sql`
            INSERT INTO hex_stake_starts (
              stake_id, staker_addr, staked_hearts, stake_shares, stake_t_shares,
              staked_days, start_day, end_day, timestamp, is_auto_stake,
              transaction_hash, block_number, network, is_active, days_served, days_left
            ) VALUES (
              ${stake.stake_id}, ${stake.staker_addr}, ${stake.staked_hearts},
              ${stake.stake_shares}, ${stake.stake_t_shares}, ${stake.staked_days},
              ${stake.start_day}, ${stake.end_day}, ${stake.timestamp}, ${stake.is_auto_stake},
              ${stake.transaction_hash}, ${stake.block_number}, ${stake.network},
              ${stake.is_active}, ${stake.days_served}, ${stake.days_left}
            )
          `;
        } catch (insertError: any) {
          // If it's a unique constraint violation, update the existing record
          if (insertError.code === '23505') {
            await sql`
              UPDATE hex_stake_starts SET
                staker_addr = ${stake.staker_addr},
                staked_hearts = ${stake.staked_hearts},
                stake_shares = ${stake.stake_shares},
                stake_t_shares = ${stake.stake_t_shares},
                staked_days = ${stake.staked_days},
                start_day = ${stake.start_day},
                end_day = ${stake.end_day},
                timestamp = ${stake.timestamp},
                is_auto_stake = ${stake.is_auto_stake},
                transaction_hash = ${stake.transaction_hash},
                block_number = ${stake.block_number},
                network = ${stake.network},
                is_active = ${stake.is_active},
                days_served = ${stake.days_served},
                days_left = ${stake.days_left},
                updated_at = CURRENT_TIMESTAMP
              WHERE stake_id = ${stake.stake_id}
            `;
          } else {
            throw insertError;
          }
        }
      }
    } catch (error) {
      console.error('Error inserting stake starts batch:', error);
      throw error;
    }
  }

  // Insert global info
  async insertGlobalInfo(info: Omit<DbGlobalInfo, 'id' | 'created_at'>): Promise<void> {
    try {
      await sql`
        INSERT INTO hex_global_info (
          hex_day, stake_shares_total, stake_penalty_total, locked_hearts_total,
          latest_stake_id, timestamp, network
        ) VALUES (
          ${info.hex_day}, ${info.stake_shares_total}, ${info.stake_penalty_total},
          ${info.locked_hearts_total}, ${info.latest_stake_id}, ${info.timestamp}, ${info.network}
        )
      `;
    } catch (error) {
      console.error('Error inserting global info:', error);
      throw error;
    }
  }

  // Update sync status
  async updateSyncStatus(network: string, updates: Partial<Omit<DbSyncStatus, 'id' | 'network' | 'created_at' | 'updated_at'>>): Promise<void> {
    try {
      const entries = Object.entries(updates).filter(([_, value]) => value !== undefined);
      if (entries.length === 0) return;

      const setClause = entries.map(([key, value]) => {
        return `${key} = ${typeof value === 'string' ? `'${value}'` : value}`;
      }).join(', ');

      await sql.unsafe(`
        UPDATE hex_sync_status 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE network = '${network}'
      `);
    } catch (error) {
      console.error('Error updating sync status:', error);
      throw error;
    }
  }

  // Get table counts by network
  async getTableCounts(): Promise<{ network: string; stakeStarts: number; globalInfo: number }[]> {
    try {
      const stakeStarts = await sql`
        SELECT network, COUNT(*) as count
        FROM hex_stake_starts
        GROUP BY network
      `;

      const globalInfo = await sql`
        SELECT network, COUNT(*) as count
        FROM hex_global_info
        GROUP BY network
      `;

      const networks = [...new Set([
        ...stakeStarts.map(s => s.network),
        ...globalInfo.map(g => g.network)
      ])];

      return networks.map(network => ({
        network,
        stakeStarts: parseInt(stakeStarts.find(s => s.network === network)?.count || '0'),
        globalInfo: parseInt(globalInfo.find(g => g.network === network)?.count || '0')
      }));
    } catch (error) {
      console.error('Error getting table counts:', error);
      throw error;
    }
  }

  // Get staking overview for a network
  async getStakingOverview(network: string): Promise<{
    totalActiveStakes: number;
    totalStakedHearts: string;
    averageStakeLength: number;
  }> {
    try {
      const result = await sql`
        SELECT 
          COUNT(*) as total_active_stakes,
          COALESCE(SUM(CAST(staked_hearts AS DECIMAL)), 0) as total_staked_hearts,
          COALESCE(AVG(staked_days), 0) as average_stake_length
        FROM hex_stake_starts 
        WHERE network = ${network} AND is_active = true
      `;

      const row = result[0];
      return {
        totalActiveStakes: parseInt(row.total_active_stakes),
        totalStakedHearts: row.total_staked_hearts.toString(),
        averageStakeLength: parseFloat(row.average_stake_length)
      };
    } catch (error) {
      console.error('Error getting staking overview:', error);
      throw error;
    }
  }

  // Get top stakes for a network
  async getTopStakes(network: string, limit: number = 100): Promise<DbStakeStart[]> {
    try {
      const result = await sql`
        SELECT * FROM hex_stake_starts 
        WHERE network = ${network}
        AND is_active = true
        ORDER BY CAST(staked_hearts AS DECIMAL) DESC
        LIMIT ${limit}
      `;
      
      return result as DbStakeStart[];
    } catch (error) {
      console.error('Error getting top stakes:', error);
      throw error;
    }
  }
}

export const hexStakingDb = new HexStakingDb();