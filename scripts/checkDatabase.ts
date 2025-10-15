#!/usr/bin/env npx tsx

import { sql } from '../lib/db/connection';

async function checkDatabase() {
  try {
    console.log('🔍 Checking database structure...\n');

    // Check tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'hex_%' 
      ORDER BY table_name
    `;

    console.log('📊 Available tables:');
    tables.forEach(table => {
      console.log(`  • ${table.table_name}`);
    });

    // Check columns for each table
    console.log('\n🔍 Table structures:');
    for (const table of tables) {
      const columns = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = ${table.table_name}
        ORDER BY ordinal_position
      `;
      
      console.log(`\n  📋 ${table.table_name}:`);
      columns.forEach(col => {
        console.log(`     • ${col.column_name}: ${col.data_type}`);
      });
    }

    // Check data counts
    console.log('\n📊 Data counts:');
    for (const table of tables) {
      try {
        const count = await sql.unsafe(`SELECT COUNT(*) as count FROM ${table.table_name}`);
        console.log(`  • ${table.table_name}: ${count[0].count} rows`);
      } catch (error) {
        console.log(`  • ${table.table_name}: Error counting rows`);
      }
    }

    // Check sync status if available
    if (tables.some(t => t.table_name === 'hex_sync_status')) {
      console.log('\n🔄 Sync status:');
      const syncStatus = await sql`SELECT network, last_sync_completed_at, sync_in_progress FROM hex_sync_status ORDER BY network`;
      syncStatus.forEach(status => {
        console.log(`  • ${status.network}: ${status.sync_in_progress ? 'In Progress' : 'Ready'} (Last: ${status.last_sync_completed_at || 'Never'})`);
      });
    }

    console.log('\n✅ Database check complete!');

  } catch (error) {
    console.error('❌ Database check failed:', error);
  }
}

checkDatabase();