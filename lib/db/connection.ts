import { neon } from '@neondatabase/serverless';

// Load environment variables from .env.local for scripts (server-side only)
if (typeof window === 'undefined' && typeof require !== 'undefined' && !process.env.DATABASE_URL) {
  try {
    // Dynamically import fs to avoid client-side bundling issues
    const fs = eval('require')('fs');
    const path = eval('require')('path');
    const envPath = path.join(process.cwd(), '.env.local');
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envLines = envContent.split('\n');
      
      for (const line of envLines) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0 && !process.env[key] && !key.startsWith('#')) {
          process.env[key] = valueParts.join('=').trim();
        }
      }
    }
  } catch (error) {
    // Silently fail for browser compatibility
  }
}

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

// Helper function to initialize database schema
export async function initializeDatabase(): Promise<void> {
  if (typeof window !== 'undefined') {
    throw new Error('Database initialization not available on client-side');
  }
  
  if (!sql) {
    throw new Error('Database connection not available');
  }
  
  try {
    console.log('🔧 Initializing PulseChain staking database...');
    
    // Read and execute schema (with proper dynamic imports)
    const fs = await import('fs');
    const path = await import('path');
    
    const schemaPath = path.join(process.cwd(), 'lib/db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split schema into individual statements and execute them
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          // Use unsafe query method for DDL statements
          await sql.unsafe(statement);
        } catch (error) {
          console.error('Error executing statement:', statement.substring(0, 100) + '...');
          throw error;
        }
      }
    }
    
    console.log('✅ Database schema initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
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