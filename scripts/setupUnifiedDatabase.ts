#!/usr/bin/env npx tsx

import { sql } from '../lib/db/connection';
import { readFileSync } from 'fs';
import { join } from 'path';

async function setupUnifiedDatabase() {
  console.log('🚀 Setting up unified HEX staking database...\n');

  try {
    // Test database connection first
    console.log('📡 Testing database connection...');
    const testResult = await sql`SELECT 1 as test`;
    if (testResult.length === 0) {
      throw new Error('Database connection test failed');
    }
    console.log('✅ Database connection successful\n');

    // Read and execute the unified schema
    console.log('📄 Reading unified schema...');
    const schemaPath = join(process.cwd(), 'lib/db/unified-schema.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    console.log('✅ Schema file loaded\n');

    // Split schema into statements and execute them
    console.log('⚡ Executing schema statements...');
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    let successCount = 0;
    let skipCount = 0;

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await sql.unsafe(statement);
          if (statement.includes('CREATE TABLE')) {
            const tableName = statement.match(/CREATE TABLE.*?(hex_\w+)/i)?.[1];
            console.log(`  ✅ Table: ${tableName}`);
          } else if (statement.includes('CREATE INDEX')) {
            const indexName = statement.match(/CREATE INDEX.*?(idx_\w+)/i)?.[1];
            console.log(`  ✅ Index: ${indexName}`);
          } else if (statement.includes('CREATE TRIGGER')) {
            const triggerName = statement.match(/CREATE TRIGGER\s+(\w+)/i)?.[1];
            console.log(`  ✅ Trigger: ${triggerName}`);
          } else if (statement.includes('INSERT')) {
            console.log(`  ✅ Initial data inserted`);
          }
          successCount++;
        } catch (error: any) {
          if (error.message.includes('already exists')) {
            skipCount++;
            // Skip logging for existing objects
          } else {
            console.error(`  ❌ Error executing statement: ${error.message}`);
            console.error(`     Statement: ${statement.substring(0, 100)}...`);
            throw error;
          }
        }
      }
    }

    console.log(`\n📊 Schema execution complete:`);
    console.log(`  • ${successCount} statements executed successfully`);
    console.log(`  • ${skipCount} statements skipped (already exist)`);

    // Verify tables were created
    console.log('\n🔍 Verifying table creation...');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'hex_%'
      ORDER BY table_name
    `;

    console.log('✅ Created tables:');
    tables.forEach(table => {
      console.log(`  • ${table.table_name}`);
    });

    // Verify indexes were created
    console.log('\n🔍 Verifying indexes...');
    const indexes = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND indexname LIKE 'idx_hex_%'
      ORDER BY indexname
    `;

    console.log('✅ Created indexes:');
    indexes.forEach(index => {
      console.log(`  • ${index.indexname}`);
    });

    // Check sync status initialization
    console.log('\n🔍 Checking sync status initialization...');
    const syncStatus = await sql`
      SELECT network, sync_in_progress 
      FROM hex_sync_status 
      ORDER BY network
    `;

    console.log('✅ Sync status records:');
    syncStatus.forEach(status => {
      console.log(`  • ${status.network}: ${status.sync_in_progress ? 'In Progress' : 'Ready'}`);
    });

    console.log('\n🎉 Unified database setup complete!');
    console.log('\nNext steps:');
    console.log('1. Run data sync for Ethereum: npm run sync-ethereum');
    console.log('2. Run data sync for PulseChain: npm run sync-pulsechain');
    console.log('3. Start your application: npm run dev');

  } catch (error) {
    console.error('\n❌ Database setup failed:', error);
    process.exit(1);
  }
}

// Check if we can access the database
async function checkDatabaseAccess() {
  try {
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
      console.error('❌ No database URL found in environment variables');
      console.error('   Make sure DATABASE_URL or POSTGRES_URL is set in your .env.local file');
      process.exit(1);
    }

    await setupUnifiedDatabase();
  } catch (error) {
    console.error('❌ Failed to setup database:', error);
    process.exit(1);
  }
}

// Run the setup if this script is executed directly
if (require.main === module) {
  checkDatabaseAccess();
}

export { setupUnifiedDatabase };