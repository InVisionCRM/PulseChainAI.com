import { sql } from './connection';

// Check if we're on server-side and have a valid connection
function checkServerSide(): boolean {
  return typeof window === 'undefined' && sql !== null;
}

// TypeScript interfaces for database records
export interface DbStakeStart {
  id: number;
  stake_id: string;
  staker_addr: string;
  staked_hearts: string;
  stake_shares: string;
  stake_t_shares: string | null;
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
  created_at: Date;
  updated_at: Date;
}

export interface DbStakeEnd {
  id: number;
  stake_id: string;
  staker_addr: string;
  payout: string;
  staked_hearts: string;
  penalty: string;
  served_days: number;
  timestamp: string;
  transaction_hash: string;
  block_number: string;
  network: string;
  created_at: Date;
}

export interface DbGlobalInfo {
  id: number;
  hex_day: number;
  stake_shares_total: string;
  stake_penalty_total: string;
  locked_hearts_total: string;
  latest_stake_id: string | null;
  timestamp: string;
  network: string;
  created_at: Date;
}

export interface DbSyncStatus {
  id: number;
  last_synced_stake_id: string | null;
  last_synced_block: string | null;
  last_synced_timestamp: string | null;
  total_stakes_synced: number;
  total_stake_ends_synced: number;
  sync_in_progress: boolean;
  last_sync_started_at: Date | null;
  last_sync_completed_at: Date | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbStakerMetrics {
  id: number;
  staker_addr: string;
  total_stakes: number;
  active_stakes: number;
  ended_stakes: number;
  total_staked_hearts: string;
  total_t_shares: string;
  total_payouts: string;
  total_penalties: string;
  average_stake_length: string;
  first_stake_date: Date | null;
  last_stake_date: Date | null;
  network: string;
  updated_at: Date;
}

export class PulsechainStakingDb {
  private isServerSide: boolean;
  
  constructor() {
    this.isServerSide = checkServerSide();
  }
  
  private checkAvailable(): void {
    if (!this.isServerSide) {
      throw new Error('Database operations not available on client-side');
    }
  }
  
  // Stake Start Operations
  async insertStakeStart(stake: Omit<DbStakeStart, 'id' | 'created_at' | 'updated_at'>): Promise<DbStakeStart> {
    this.checkAvailable();
    
    try {
      const result = await sql`
        INSERT INTO pulsechain_stake_starts (
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
        ON CONFLICT (stake_id) DO UPDATE SET
          is_active = EXCLUDED.is_active,
          days_served = EXCLUDED.days_served,
          days_left = EXCLUDED.days_left,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      return result[0] as DbStakeStart;
    } catch (error) {
      console.error('Error inserting stake start:', error);
      throw error;
    }
  }

  async insertStakeStartsBatch(stakes: Omit<DbStakeStart, 'id' | 'created_at' | 'updated_at'>[]): Promise<void> {
    this.checkAvailable();
    if (stakes.length === 0) return;
    
    try {
      console.log(`💾 Inserting ${stakes.length} stake starts to database...`);
      
      // Process in smaller batches for better performance and to avoid timeout
      const batchSize = 50;
      for (let i = 0; i < stakes.length; i += batchSize) {
        const batch = stakes.slice(i, i + batchSize);
        
        // Insert each stake in the batch
        for (const stake of batch) {
          await sql`
            INSERT INTO pulsechain_stake_starts (
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
            ON CONFLICT (stake_id) DO UPDATE SET
              is_active = EXCLUDED.is_active,
              days_served = EXCLUDED.days_served,
              days_left = EXCLUDED.days_left,
              updated_at = CURRENT_TIMESTAMP
          `;
        }
        
        console.log(`   ✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(stakes.length / batchSize)} (${batch.length} stakes)`);
      }
      
      console.log(`✅ Batch inserted ${stakes.length} stake starts`);
    } catch (error) {
      console.error('Error batch inserting stake starts:', error);
      throw error;
    }
  }

  async getStakeStarts(options: {
    limit?: number;
    offset?: number;
    orderBy?: 'timestamp' | 'staked_hearts' | 'stake_id';
    orderDirection?: 'asc' | 'desc';
    activeOnly?: boolean;
    stakerAddr?: string;
  } = {}): Promise<DbStakeStart[]> {
    this.checkAvailable();
    
    try {
      const {
        limit = 1000,
        offset = 0,
        orderBy = 'timestamp',
        orderDirection = 'desc',
        activeOnly = false,
        stakerAddr
      } = options;

      let query = `
        SELECT * FROM pulsechain_stake_starts 
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (activeOnly) {
        query += ` AND is_active = true`;
      }

      if (stakerAddr) {
        query += ` AND staker_addr = $${paramIndex++}`;
        params.push(stakerAddr);
      }

      query += ` ORDER BY ${orderBy} ${orderDirection.toUpperCase()}`;
      query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      const result = await sql(query, ...params);
      return result as DbStakeStart[];
    } catch (error) {
      console.error('Error getting stake starts:', error);
      throw error;
    }
  }

  async getActiveStakes(options: {
    limit?: number;
    offset?: number;
    currentDay?: number;
  } = {}): Promise<DbStakeStart[]> {
    try {
      const { limit = 1000, offset = 0, currentDay } = options;

      let query = `
        SELECT * FROM pulsechain_stake_starts 
        WHERE is_active = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (currentDay) {
        query += ` AND end_day >= $${paramIndex++}`;
        params.push(currentDay);
      }

      query += ` ORDER BY staked_hearts DESC`;
      query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(limit, offset);

      const result = await sql(query, ...params);
      return result as DbStakeStart[];
    } catch (error) {
      console.error('Error getting active stakes:', error);
      throw error;
    }
  }

  async updateStakeActivity(currentDay: number): Promise<void> {
    try {
      await sql`
        UPDATE pulsechain_stake_starts 
        SET 
          is_active = (end_day >= ${currentDay} AND stake_id NOT IN (
            SELECT stake_id FROM pulsechain_stake_ends
          )),
          days_served = GREATEST(0, ${currentDay} - start_day),
          days_left = GREATEST(0, end_day - ${currentDay}),
          updated_at = CURRENT_TIMESTAMP
      `;
      console.log('✅ Updated stake activity status');
    } catch (error) {
      console.error('Error updating stake activity:', error);
      throw error;
    }
  }

  // Stake End Operations
  async insertStakeEnd(stakeEnd: Omit<DbStakeEnd, 'id' | 'created_at'>): Promise<DbStakeEnd> {
    try {
      const result = await sql`
        INSERT INTO pulsechain_stake_ends (
          stake_id, staker_addr, payout, staked_hearts, penalty,
          served_days, timestamp, transaction_hash, block_number, network
        ) VALUES (
          ${stakeEnd.stake_id}, ${stakeEnd.staker_addr}, ${stakeEnd.payout},
          ${stakeEnd.staked_hearts}, ${stakeEnd.penalty}, ${stakeEnd.served_days},
          ${stakeEnd.timestamp}, ${stakeEnd.transaction_hash}, ${stakeEnd.block_number},
          ${stakeEnd.network}
        )
        ON CONFLICT (stake_id) DO NOTHING
        RETURNING *
      `;
      
      // Update corresponding stake start to inactive
      if (result.length > 0) {
        await sql`
          UPDATE pulsechain_stake_starts 
          SET is_active = false, updated_at = CURRENT_TIMESTAMP
          WHERE stake_id = ${stakeEnd.stake_id}
        `;
      }
      
      return result[0] as DbStakeEnd;
    } catch (error) {
      console.error('Error inserting stake end:', error);
      throw error;
    }
  }

  async getStakeEnds(stakerAddr?: string): Promise<DbStakeEnd[]> {
    try {
      if (stakerAddr) {
        const result = await sql`
          SELECT * FROM pulsechain_stake_ends 
          WHERE staker_addr = ${stakerAddr}
          ORDER BY timestamp DESC
        `;
        return result as DbStakeEnd[];
      } else {
        const result = await sql`
          SELECT * FROM pulsechain_stake_ends 
          ORDER BY timestamp DESC
          LIMIT 1000
        `;
        return result as DbStakeEnd[];
      }
    } catch (error) {
      console.error('Error getting stake ends:', error);
      throw error;
    }
  }

  // Global Info Operations
  async insertGlobalInfo(globalInfo: Omit<DbGlobalInfo, 'id' | 'created_at'>): Promise<DbGlobalInfo> {
    try {
      const result = await sql`
        INSERT INTO pulsechain_global_info (
          hex_day, stake_shares_total, stake_penalty_total, locked_hearts_total,
          latest_stake_id, timestamp, network
        ) VALUES (
          ${globalInfo.hex_day}, ${globalInfo.stake_shares_total}, 
          ${globalInfo.stake_penalty_total}, ${globalInfo.locked_hearts_total},
          ${globalInfo.latest_stake_id}, ${globalInfo.timestamp}, ${globalInfo.network}
        )
        RETURNING *
      `;
      return result[0] as DbGlobalInfo;
    } catch (error) {
      console.error('Error inserting global info:', error);
      throw error;
    }
  }

  async getLatestGlobalInfo(): Promise<DbGlobalInfo | null> {
    try {
      const result = await sql`
        SELECT * FROM pulsechain_global_info 
        ORDER BY hex_day DESC 
        LIMIT 1
      `;
      return result.length > 0 ? (result[0] as DbGlobalInfo) : null;
    } catch (error) {
      console.error('Error getting latest global info:', error);
      throw error;
    }
  }

  // Sync Status Operations
  async getSyncStatus(): Promise<DbSyncStatus | null> {
    try {
      const result = await sql`
        SELECT * FROM pulsechain_sync_status 
        ORDER BY id DESC 
        LIMIT 1
      `;
      return result.length > 0 ? (result[0] as DbSyncStatus) : null;
    } catch (error) {
      console.error('Error getting sync status:', error);
      throw error;
    }
  }

  async updateSyncStatus(updates: Partial<Omit<DbSyncStatus, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
    try {
      const setClauses: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          setClauses.push(`${key} = $${paramIndex++}`);
          params.push(value);
        }
      });

      if (setClauses.length === 0) return;

      const query = `
        UPDATE pulsechain_sync_status 
        SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT id FROM pulsechain_sync_status ORDER BY id DESC LIMIT 1)
      `;

      await sql(query, ...params);
    } catch (error) {
      console.error('Error updating sync status:', error);
      throw error;
    }
  }

  async setSyncInProgress(inProgress: boolean, errorMessage?: string): Promise<void> {
    try {
      const updates: any = {
        sync_in_progress: inProgress,
        error_message: errorMessage || null
      };

      if (inProgress) {
        updates.last_sync_started_at = new Date();
      } else {
        updates.last_sync_completed_at = new Date();
      }

      await this.updateSyncStatus(updates);
    } catch (error) {
      console.error('Error setting sync progress:', error);
      throw error;
    }
  }

  // Staker Metrics Operations
  async upsertStakerMetrics(stakerAddr: string): Promise<void> {
    try {
      await sql`
        INSERT INTO pulsechain_staker_metrics (
          staker_addr, total_stakes, active_stakes, ended_stakes,
          total_staked_hearts, total_t_shares, total_payouts, total_penalties,
          average_stake_length, first_stake_date, last_stake_date, network
        )
        SELECT 
          ${stakerAddr} as staker_addr,
          COUNT(ss.id) as total_stakes,
          COUNT(CASE WHEN ss.is_active THEN 1 END) as active_stakes,
          COUNT(se.id) as ended_stakes,
          COALESCE(SUM(ss.staked_hearts::DECIMAL), 0) as total_staked_hearts,
          COALESCE(SUM(ss.stake_t_shares::DECIMAL), 0) as total_t_shares,
          COALESCE(SUM(se.payout::DECIMAL), 0) as total_payouts,
          COALESCE(SUM(se.penalty::DECIMAL), 0) as total_penalties,
          COALESCE(AVG(ss.staked_days), 0) as average_stake_length,
          MIN(TO_TIMESTAMP(ss.timestamp::BIGINT)) as first_stake_date,
          MAX(TO_TIMESTAMP(ss.timestamp::BIGINT)) as last_stake_date,
          'pulsechain' as network
        FROM pulsechain_stake_starts ss
        LEFT JOIN pulsechain_stake_ends se ON ss.stake_id = se.stake_id
        WHERE ss.staker_addr = ${stakerAddr}
        GROUP BY ss.staker_addr
        ON CONFLICT (staker_addr) DO UPDATE SET
          total_stakes = EXCLUDED.total_stakes,
          active_stakes = EXCLUDED.active_stakes,
          ended_stakes = EXCLUDED.ended_stakes,
          total_staked_hearts = EXCLUDED.total_staked_hearts,
          total_t_shares = EXCLUDED.total_t_shares,
          total_payouts = EXCLUDED.total_payouts,
          total_penalties = EXCLUDED.total_penalties,
          average_stake_length = EXCLUDED.average_stake_length,
          first_stake_date = EXCLUDED.first_stake_date,
          last_stake_date = EXCLUDED.last_stake_date,
          updated_at = CURRENT_TIMESTAMP
      `;
    } catch (error) {
      console.error('Error upserting staker metrics:', error);
      throw error;
    }
  }

  async getStakerMetrics(stakerAddr: string): Promise<DbStakerMetrics | null> {
    try {
      const result = await sql`
        SELECT * FROM pulsechain_staker_metrics 
        WHERE staker_addr = ${stakerAddr}
      `;
      return result.length > 0 ? (result[0] as DbStakerMetrics) : null;
    } catch (error) {
      console.error('Error getting staker metrics:', error);
      throw error;
    }
  }

  // Analytics and Aggregation Methods
  async getStakingOverview(): Promise<{
    totalActiveStakes: number;
    totalStakedHearts: string;
    averageStakeLength: number;
    latestStakeId: string | null;
  }> {
    try {
      const result = await sql`
        SELECT 
          COUNT(CASE WHEN is_active THEN 1 END) as total_active_stakes,
          COALESCE(SUM(CASE WHEN is_active THEN staked_hearts::DECIMAL ELSE 0 END), 0) as total_staked_hearts,
          COALESCE(AVG(CASE WHEN is_active THEN staked_days ELSE NULL END), 0) as average_stake_length,
          MAX(stake_id) as latest_stake_id
        FROM pulsechain_stake_starts
      `;
      
      return {
        totalActiveStakes: parseInt(result[0].total_active_stakes),
        totalStakedHearts: result[0].total_staked_hearts.toString(),
        averageStakeLength: parseFloat(result[0].average_stake_length) || 0,
        latestStakeId: result[0].latest_stake_id
      };
    } catch (error) {
      console.error('Error getting staking overview:', error);
      throw error;
    }
  }

  async getTopStakes(limit: number = 100): Promise<DbStakeStart[]> {
    try {
      const result = await sql`
        SELECT * FROM pulsechain_stake_starts 
        ORDER BY staked_hearts::DECIMAL DESC 
        LIMIT ${limit}
      `;
      return result as DbStakeStart[];
    } catch (error) {
      console.error('Error getting top stakes:', error);
      throw error;
    }
  }

  // Database maintenance methods
  async getTableCounts(): Promise<{
    stakeStarts: number;
    stakeEnds: number;
    globalInfo: number;
    stakerMetrics: number;
  }> {
    try {
      const [stakeStarts, stakeEnds, globalInfo, stakerMetrics] = await Promise.all([
        sql`SELECT COUNT(*) as count FROM pulsechain_stake_starts`,
        sql`SELECT COUNT(*) as count FROM pulsechain_stake_ends`,
        sql`SELECT COUNT(*) as count FROM pulsechain_global_info`,
        sql`SELECT COUNT(*) as count FROM pulsechain_staker_metrics`
      ]);

      return {
        stakeStarts: parseInt(stakeStarts[0].count),
        stakeEnds: parseInt(stakeEnds[0].count),
        globalInfo: parseInt(globalInfo[0].count),
        stakerMetrics: parseInt(stakerMetrics[0].count)
      };
    } catch (error) {
      console.error('Error getting table counts:', error);
      throw error;
    }
  }

  async cleanupOldData(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      await sql`
        DELETE FROM pulsechain_global_info 
        WHERE created_at < ${cutoffDate} 
        AND id NOT IN (
          SELECT id FROM pulsechain_global_info 
          ORDER BY hex_day DESC 
          LIMIT 10
        )
      `;
      
      console.log(`✅ Cleaned up old global info data (keeping last ${daysToKeep} days)`);
    } catch (error) {
      console.error('Error cleaning up old data:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const pulsechainStakingDb = new PulsechainStakingDb();