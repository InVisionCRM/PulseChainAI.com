import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    const migrations = [];

    // Rename tables from pulsechain_* to hex_* for multi-network support
    const tableRenames = [
      { from: 'pulsechain_stake_starts', to: 'hex_stake_starts' },
      { from: 'pulsechain_stake_ends', to: 'hex_stake_ends' },
      { from: 'pulsechain_global_info', to: 'hex_global_info' },
      { from: 'pulsechain_sync_status', to: 'hex_sync_status' },
      { from: 'pulsechain_staker_metrics', to: 'hex_staker_metrics' }
    ];

    for (const rename of tableRenames) {
      try {
        // Check if old table exists
        const tableExists = await sql`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${rename.from}
        `;

        if (tableExists.length > 0) {
          // Check if new table already exists
          const newTableExists = await sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${rename.to}
          `;

          if (newTableExists.length === 0) {
            await sql.unsafe(`ALTER TABLE ${rename.from} RENAME TO ${rename.to}`);
            migrations.push(`✅ Renamed ${rename.from} to ${rename.to}`);
          } else {
            migrations.push(`⚠️ ${rename.to} already exists, skipped ${rename.from}`);
          }
        } else {
          migrations.push(`⚠️ ${rename.from} does not exist, skipped`);
        }
      } catch (error) {
        migrations.push(`❌ Error renaming ${rename.from}: ${error instanceof Error ? error.message : error}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        migrations,
        message: 'Table migration completed'
      }
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}