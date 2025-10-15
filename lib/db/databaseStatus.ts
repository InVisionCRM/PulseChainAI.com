// Database status and fallback management
export class DatabaseStatus {
  private static isAvailable = false;
  private static checkedOnce = false;
  private static tablesExist = false;

  static async checkAvailability(): Promise<boolean> {
    if (this.checkedOnce) {
      return this.isAvailable;
    }

    // Allow database access from both server and client
    // The actual database operations will handle connection issues

    try {
      const { sql } = await import('./connection');
      
      if (!sql) {
        this.isAvailable = false;
        this.checkedOnce = true;
        return false;
      }
      
      // Try a simple query first
      await sql`SELECT 1 as test`;
      console.log('✅ Database connection successful');
      
      // Check if PulseChain tables exist instead of creating test tables
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'pulsechain_%'
      `;
      
      this.tablesExist = tables.length >= 4; // We expect at least 4 main tables
      
      if (this.tablesExist) {
        // Tables exist, test a simple operation
        try {
          const testRead = await sql`SELECT COUNT(*) as count FROM pulsechain_sync_status LIMIT 1`;
          this.isAvailable = true;
          console.log('✅ Database is available with PulseChain tables');
        } catch (readError) {
          // Tables exist but can't read - might be a temporary issue
          this.isAvailable = false;
          console.warn('⚠️ PulseChain tables exist but not readable');
        }
      } else {
        // No tables exist, but connection works
        this.isAvailable = true; // Connection works, we can create tables later
        console.log('✅ Database connection works, tables will be created as needed');
      }
      
      this.checkedOnce = true;
      return this.isAvailable;
      
    } catch (error) {
      console.warn('⚠️ Database not available:', error?.message || error);
      this.isAvailable = false;
      this.checkedOnce = true;
      return false;
    }
  }

  static getStatus(): boolean {
    return this.isAvailable;
  }

  static getTablesExist(): boolean {
    return this.tablesExist;
  }

  static async getTableStatus(): Promise<{
    available: boolean;
    tablesExist: boolean;
    tableCount: number;
    tableNames: string[];
  }> {
    // Allow database access from both server and client
    // The actual database operations will handle connection issues

    try {
      const { sql } = await import('./connection');
      
      if (!sql) {
        return {
          available: false,
          tablesExist: false,
          tableCount: 0,
          tableNames: []
        };
      }

      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'pulsechain_%'
        ORDER BY table_name
      `;

      const tableNames = tables.map(t => t.table_name);

      return {
        available: this.isAvailable,
        tablesExist: tables.length >= 4,
        tableCount: tables.length,
        tableNames
      };

    } catch (error) {
      return {
        available: false,
        tablesExist: false,
        tableCount: 0,
        tableNames: []
      };
    }
  }

  static reset(): void {
    this.checkedOnce = false;
    this.isAvailable = false;
    this.tablesExist = false;
  }
}

export const databaseStatus = DatabaseStatus;