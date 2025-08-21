#!/usr/bin/env tsx

import { sql } from '../lib/db/connection';

async function diagnoseDatabaseIssues() {
  console.log('🔍 Comprehensive Database Diagnostics\n');

  try {
    // 1. Basic connection test
    console.log('1. Testing basic database connection...');
    const basicTest = await sql`SELECT 1 as test, current_user, current_database(), current_schema()`;
    console.log('✅ Connection successful');
    console.log(`   User: ${basicTest[0].current_user}`);
    console.log(`   Database: ${basicTest[0].current_database}`);
    console.log(`   Schema: ${basicTest[0].current_schema}\n`);

    // 2. Check user permissions
    console.log('2. Checking user permissions...');
    const permissions = await sql`
      SELECT 
        table_catalog as database,
        table_schema as schema,
        privilege_type
      FROM information_schema.table_privileges 
      WHERE grantee = current_user
      AND table_schema = 'public'
      LIMIT 10
    `;
    
    if (permissions.length > 0) {
      console.log('✅ User has table privileges:');
      permissions.forEach(p => {
        console.log(`   ${p.privilege_type} on ${p.schema}`);
      });
    } else {
      console.log('⚠️ No specific table privileges found');
    }
    console.log('');

    // 3. Check schema permissions
    console.log('3. Checking schema permissions...');
    const schemaPermissions = await sql`
      SELECT 
        schema_name,
        schema_owner
      FROM information_schema.schemata 
      WHERE schema_name = 'public'
    `;
    console.log(`   Schema owner: ${schemaPermissions[0]?.schema_owner || 'unknown'}\n`);

    // 4. Test table creation with different approaches
    console.log('4. Testing table creation capabilities...');
    
    // Try creating a simple table
    try {
      console.log('   Attempting simple table creation...');
      await sql.unsafe(`CREATE TABLE pulse_test_simple (id SERIAL PRIMARY KEY, name TEXT)`);
      console.log('   ✅ Simple table created successfully');
      
      // Test insert
      await sql`INSERT INTO pulse_test_simple (name) VALUES ('test')`;
      console.log('   ✅ Insert successful');
      
      // Test select
      const result = await sql`SELECT * FROM pulse_test_simple`;
      console.log(`   ✅ Select successful (${result.length} rows)`);
      
      // Clean up
      await sql.unsafe(`DROP TABLE pulse_test_simple`);
      console.log('   ✅ Table dropped successfully');
      
    } catch (error) {
      console.log(`   ❌ Table creation failed: ${error.message}`);
      
      // Try with different syntax
      try {
        console.log('   Trying alternative CREATE TABLE syntax...');
        await sql`CREATE TABLE IF NOT EXISTS pulse_test_alt (id INTEGER PRIMARY KEY, data VARCHAR(255))`;
        console.log('   ✅ Alternative syntax worked');
        await sql`DROP TABLE IF EXISTS pulse_test_alt`;
      } catch (altError) {
        console.log(`   ❌ Alternative syntax also failed: ${altError.message}`);
      }
    }
    console.log('');

    // 5. Check existing PulseChain tables
    console.log('5. Checking existing PulseChain tables...');
    const existingTables = await sql`
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%pulse%'
      ORDER BY table_name
    `;
    
    if (existingTables.length > 0) {
      console.log('   Existing PulseChain-related tables:');
      existingTables.forEach(t => {
        console.log(`   - ${t.table_name} (${t.table_type})`);
      });
    } else {
      console.log('   ❌ No PulseChain tables found');
    }
    console.log('');

    // 6. Check all tables to understand the database structure
    console.log('6. Current database tables:');
    const allTables = await sql`
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    allTables.forEach(t => {
      console.log(`   - ${t.table_name}`);
    });
    console.log('');

    // 7. Test specific PulseChain table creation
    console.log('7. Testing PulseChain table creation...');
    try {
      await sql.unsafe(`
        CREATE TABLE IF NOT EXISTS pulsechain_test_table (
          id SERIAL PRIMARY KEY,
          stake_id VARCHAR(50) UNIQUE NOT NULL,
          staker_addr VARCHAR(42) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✅ PulseChain test table created');
      
      // Test insert
      await sql`
        INSERT INTO pulsechain_test_table (stake_id, staker_addr) 
        VALUES ('12345', '0x1234567890123456789012345678901234567890')
        ON CONFLICT (stake_id) DO NOTHING
      `;
      console.log('   ✅ Test insert successful');
      
      // Verify
      const testResult = await sql`SELECT COUNT(*) as count FROM pulsechain_test_table`;
      console.log(`   ✅ Table has ${testResult[0].count} rows`);
      
    } catch (error) {
      console.log(`   ❌ PulseChain table test failed: ${error.message}`);
    }
    console.log('');

    // 8. Database configuration check
    console.log('8. Database configuration:');
    try {
      const config = await sql`
        SELECT name, setting, category 
        FROM pg_settings 
        WHERE name IN ('max_connections', 'shared_buffers', 'effective_cache_size', 'work_mem')
      `;
      config.forEach(c => {
        console.log(`   ${c.name}: ${c.setting}`);
      });
    } catch (error) {
      console.log(`   ⚠️ Could not fetch config: ${error.message}`);
    }

    console.log('\n🎯 Diagnosis Summary:');
    console.log('   Database connection: ✅ Working');
    console.log('   User permissions: Need investigation');
    console.log('   Table operations: Testing completed');
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
}

diagnoseDatabaseIssues();