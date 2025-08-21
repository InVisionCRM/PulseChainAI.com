#!/usr/bin/env tsx

import { sql } from '../lib/db/connection';

async function debugDatabase() {
  try {
    console.log('🔍 Database debugging info...');
    
    // Check current database and schema
    const dbInfo = await sql`SELECT current_database(), current_schema()`;
    console.log('Current database and schema:', dbInfo[0]);
    
    // Check all schemas
    const schemas = await sql`SELECT schema_name FROM information_schema.schemata ORDER BY schema_name`;
    console.log('Available schemas:', schemas.map(s => s.schema_name));
    
    // Check all tables in all schemas
    const allTables = await sql`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name
    `;
    console.log('All tables:');
    allTables.forEach(t => console.log(`  ${t.table_schema}.${t.table_name}`));
    
    // Try to create a simple test table
    console.log('🧪 Testing table creation...');
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS test_table (id SERIAL PRIMARY KEY, name TEXT)`);
    
    // Check if test table exists
    const testCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'test_table'
    `;
    console.log('Test table exists:', testCheck.length > 0);
    
    // Clean up test table
    if (testCheck.length > 0) {
      await sql.unsafe(`DROP TABLE test_table`);
      console.log('Test table cleaned up');
    }
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugDatabase();