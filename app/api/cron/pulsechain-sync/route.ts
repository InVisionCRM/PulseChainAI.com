import { NextRequest, NextResponse } from 'next/server';
import { PulsechainSyncService } from '@/lib/sync/pulsechainSyncService';

// Vercel Cron Job - runs every 24 hours to sync PulseChain data
export async function GET(request: NextRequest) {
  // Verify this is a legitimate cron request
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🕐 Starting scheduled PulseChain sync job...');
  
  try {
    const syncService = new PulsechainSyncService();
    
    // Perform the sync
    const result = await syncService.performSync();
    
    if (result.success) {
      console.log(`✅ Sync completed: ${result.newStakes} new stakes, ${result.newStakeEnds} new stake ends, ${result.updatedStakes} updated`);
      
      return NextResponse.json({
        success: true,
        message: 'PulseChain sync completed successfully',
        data: {
          newStakes: result.newStakes,
          newStakeEnds: result.newStakeEnds,
          updatedStakes: result.updatedStakes,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      console.error('❌ Sync failed:', result.error);
      
      return NextResponse.json({
        success: false,
        error: result.error || 'Sync failed',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Cron job failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}