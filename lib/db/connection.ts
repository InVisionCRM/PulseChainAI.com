import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

// Only create connection on server-side
let sql: any = null;

if (typeof window === 'undefined') {
  if (!databaseUrl) {
    console.warn('DATABASE_URL or POSTGRES_URL environment variable not found');
    sql = null;
  } else {
    try {
      sql = neon(databaseUrl);
    } catch (error) {
      console.error('Failed to create database connection:', error);
      sql = null;
    }
  }
}

export { sql };

export type DatabaseConnection = typeof sql;

// Helper function to test database connection
export async function testDatabaseConnection(): Promise<boolean> {
  if (typeof window !== 'undefined') {
    // Client-side: database not available
    return false;
  }
  
  if (!sql) {
    return false;
  }
  
  try {
    const result = await sql`SELECT 1 as test`;
    return result.length > 0;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}


// Helper function to check if tables exist
export async function checkTablesExist(): Promise<{
  stakeStarts: boolean;
  stakeEnds: boolean;
  globalInfo: boolean;
  syncStatus: boolean;
  stakerMetrics: boolean;
}> {
  if (typeof window !== 'undefined' || !sql) {
    return {
      stakeStarts: false,
      stakeEnds: false,
      globalInfo: false,
      syncStatus: false,
      stakerMetrics: false
    };
  }
  
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'pulsechain_%'
    `;
    
    const tableNames = tables.map(t => t.table_name);
    
    return {
      stakeStarts: tableNames.includes('pulsechain_stake_starts'),
      stakeEnds: tableNames.includes('pulsechain_stake_ends'),
      globalInfo: tableNames.includes('pulsechain_global_info'),
      syncStatus: tableNames.includes('pulsechain_sync_status'),
      stakerMetrics: tableNames.includes('pulsechain_staker_metrics')
    };
  } catch (error) {
    console.error('Error checking table existence:', error);
    return {
      stakeStarts: false,
      stakeEnds: false,
      globalInfo: false,
      syncStatus: false,
      stakerMetrics: false
    };
  }
}