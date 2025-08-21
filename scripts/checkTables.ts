#!/usr/bin/env tsx

import { sql } from '../lib/db/connection';

async function checkTables() {
  try {
    console.log('Checking database tables...');
    
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    
    console.log('Tables found:');
    tables.forEach((table: any) => {
      console.log(`- ${table.table_name}`);
    });
    
    if (tables.length === 0) {
      console.log('No tables found in the public schema');
    }
    
  } catch (error) {
    console.error('Error checking tables:', error);
  }
}

checkTables();