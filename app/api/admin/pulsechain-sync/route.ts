import { NextRequest, NextResponse } from 'next/server';
import { pulsechainSyncService } from '../../../../lib/sync/pulsechainSyncService';
import { pulsechainStakingDb } from '../../../../lib/db/pulsechainStakingDb';
import { testDatabaseConnection } from '../../../../lib/db/connection';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'status':
        const syncStatus = await pulsechainSyncService.getStatus();
        const dbConnected = await testDatabaseConnection();
        const tableCounts = dbConnected ? await pulsechainStakingDb.getTableCounts() : null;
        
        return NextResponse.json({
          success: true,
          data: {
            ...syncStatus,
            databaseConnected: dbConnected,
            tableCounts
          }
        });

      case 'sync':
        const result = await pulsechainSyncService.performSync();
        return NextResponse.json({
          success: result.success,
          data: result
        });

      case 'force-sync':
        await pulsechainSyncService.forcefulSync();
        return NextResponse.json({
          success: true,
          message: 'Forceful sync completed'
        });

      case 'start-periodic':
        const interval = parseInt(searchParams.get('interval') || '30');
        await pulsechainSyncService.startPeriodicSync(interval);
        return NextResponse.json({
          success: true,
          message: `Periodic sync started (every ${interval} minutes)`
        });

      case 'stop-periodic':
        pulsechainSyncService.stopPeriodicSync();
        return NextResponse.json({
          success: true,
          message: 'Periodic sync stopped'
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Available actions: status, sync, force-sync, start-periodic, stop-periodic'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'sync-staker-metrics':
        const { stakerAddresses } = params;
        await pulsechainSyncService.syncStakerMetrics(stakerAddresses);
        return NextResponse.json({
          success: true,
          message: 'Staker metrics sync completed'
        });

      case 'cleanup-old-data':
        const { daysToKeep = 30 } = params;
        await pulsechainStakingDb.cleanupOldData(daysToKeep);
        return NextResponse.json({
          success: true,
          message: `Cleaned up data older than ${daysToKeep} days`
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Admin API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}