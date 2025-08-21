#!/usr/bin/env tsx

import { sql } from '../lib/db/connection';

async function createSyncTable() {
  try {
    console.log('🔧 Creating sync status table...');
    
    const result = await sql.unsafe(`
      CREATE TABLE pulsechain_sync_status (
        id SERIAL PRIMARY KEY,
        last_synced_stake_id VARCHAR(50),
        last_synced_block BIGINT,
        last_synced_timestamp BIGINT,
        total_stakes_synced INTEGER DEFAULT 0,
        total_stake_ends_synced INTEGER DEFAULT 0,
        sync_in_progress BOOLEAN DEFAULT FALSE,
        last_sync_started_at TIMESTAMP,
        last_sync_completed_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Sync table created');
    
    // Insert initial record
    await sql`
      INSERT INTO pulsechain_sync_status (
        last_synced_stake_id, 
        last_synced_block, 
        last_synced_timestamp,
        sync_in_progress
      ) VALUES ('0', 0, 0, FALSE)
    `;
    
    console.log('✅ Initial sync record inserted');
    
  } catch (error) {
    console.error('❌ Error creating sync table:', error);
  }
}

createSyncTable();