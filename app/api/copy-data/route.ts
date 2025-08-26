import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    const operations = [];

    // Copy stake starts data
    try {
      const allStakes = await sql`SELECT * FROM pulsechain_stake_starts LIMIT 10`;
      operations.push(`Found ${allStakes.length} stakes in pulsechain_stake_starts`);

      if (allStakes.length > 0) {
        // Use a more explicit insert
        for (const stake of allStakes) {
          try {
            await sql`
              INSERT INTO hex_stake_starts (
                stake_id, staker_addr, staked_hearts, stake_shares, stake_t_shares,
                staked_days, start_day, end_day, timestamp, is_auto_stake,
                transaction_hash, block_number, network, is_active, days_served, days_left
              ) VALUES (
                ${stake.stake_id}, ${stake.staker_addr}, ${stake.staked_hearts}, 
                ${stake.stake_shares}, ${stake.stake_t_shares}, ${stake.staked_days},
                ${stake.start_day}, ${stake.end_day}, ${stake.timestamp}, ${stake.is_auto_stake},
                ${stake.transaction_hash}, ${stake.block_number}, ${stake.network},
                ${stake.is_active}, ${stake.days_served}, ${stake.days_left}
              ) ON CONFLICT (stake_id) DO NOTHING
            `;
          } catch (insertError) {
            operations.push(`❌ Error inserting stake ${stake.stake_id}: ${insertError}`);
          }
        }
        
        const hexCount = await sql`SELECT COUNT(*) as count FROM hex_stake_starts`;
        operations.push(`✅ hex_stake_starts now has ${hexCount[0].count} records`);
      }
    } catch (e) {
      operations.push(`❌ Error copying stakes: ${e}`);
    }

    // Copy global info
    try {
      const globalInfos = await sql`SELECT * FROM pulsechain_global_info`;
      operations.push(`Found ${globalInfos.length} global info records`);

      for (const info of globalInfos) {
        try {
          await sql`
            INSERT INTO hex_global_info (
              hex_day, stake_shares_total, stake_penalty_total, locked_hearts_total,
              latest_stake_id, timestamp, network
            ) VALUES (
              ${info.hex_day}, ${info.stake_shares_total}, ${info.stake_penalty_total},
              ${info.locked_hearts_total}, ${info.latest_stake_id}, ${info.timestamp}, ${info.network}
            )
          `;
        } catch (insertError) {
          operations.push(`❌ Error inserting global info: ${insertError}`);
        }
      }
    } catch (e) {
      operations.push(`❌ Error copying global info: ${e}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        operations,
        message: 'Data copy operation completed'
      }
    });

  } catch (error) {
    console.error('Copy data error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}