import { NextResponse } from 'next/server';
import { sql } from '@/lib/db/connection';

export async function GET() {
  try {
    if (!sql) {
      return NextResponse.json({ error: 'Database not available' });
    }

    // Get total PulseChain stakes
    const totalStakes = await sql`
      SELECT COUNT(*) as total_count
      FROM hex_stake_starts 
      WHERE network = 'pulsechain'
    `;

    // Get stakes by is_active flag
    const activeByFlag = await sql`
      SELECT COUNT(*) as active_count
      FROM hex_stake_starts 
      WHERE network = 'pulsechain' AND is_active = true
    `;

    // Get current global info
    const globalInfo = await sql`
      SELECT hex_day
      FROM hex_global_info 
      WHERE network = 'pulsechain'
      ORDER BY id DESC 
      LIMIT 1
    `;

    const currentDay = globalInfo.length > 0 ? globalInfo[0].hex_day : 0;

    // Check stakes by end_day vs current_day
    const activeByEndDay = await sql`
      SELECT COUNT(*) as count
      FROM hex_stake_starts 
      WHERE network = 'pulsechain' 
      AND end_day > ${currentDay}
    `;

    // Get sample stakes to understand the data
    const sampleStakes = await sql`
      SELECT stake_id, start_day, end_day, is_active, days_left, days_served
      FROM hex_stake_starts 
      WHERE network = 'pulsechain'
      ORDER BY id
      LIMIT 10
    `;

    // Get distribution of end_days
    const endDayStats = await sql`
      SELECT 
        MIN(end_day) as min_end_day,
        MAX(end_day) as max_end_day,
        AVG(end_day) as avg_end_day,
        COUNT(CASE WHEN end_day > ${currentDay} THEN 1 END) as future_end_day,
        COUNT(CASE WHEN end_day <= ${currentDay} THEN 1 END) as past_end_day
      FROM hex_stake_starts 
      WHERE network = 'pulsechain'
    `;

    return NextResponse.json({
      success: true,
      data: {
        currentDay,
        totalStakes: totalStakes[0].total_count,
        activeByFlag: activeByFlag[0].active_count,
        activeByEndDay: activeByEndDay[0].count,
        sampleStakes,
        endDayStats: endDayStats[0],
        message: 'PulseChain stakes analysis'
      }
    });

  } catch (error) {
    console.error('Debug PulseChain stakes error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}