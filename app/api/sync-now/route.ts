import { NextResponse } from 'next/server';
import { PulsechainSyncService } from '@/lib/sync/pulsechainSyncService';

// Manual sync trigger for testing and immediate updates
export async function POST() {
  console.log('🔄 Manual sync triggered...');
  
  try {
    const syncService = new PulsechainSyncService();
    
    // Perform the sync
    const result = await syncService.performSync();
    
    if (result.success) {
      console.log(`✅ Manual sync completed: ${result.newStakes} new stakes, ${result.newStakeEnds} new stake ends, ${result.updatedStakes} updated`);
      
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
      console.error('❌ Manual sync failed:', result.error);
      
      return NextResponse.json({
        success: false,
        error: result.error || 'Sync failed',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Manual sync failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}