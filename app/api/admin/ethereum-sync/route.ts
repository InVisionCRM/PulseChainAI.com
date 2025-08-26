import { NextRequest, NextResponse } from 'next/server';
import { ethereumSyncService } from '../../../../lib/sync/ethereumSyncService';
import { hexStakingDb } from '../../../../lib/db/hexStakingDb';
import { testDatabaseConnection } from '../../../../lib/db/connection';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'status':
        const syncStatus = await ethereumSyncService.getStatus();
        const dbConnected = await testDatabaseConnection();
        const tableCounts = dbConnected ? await hexStakingDb.getTableCounts() : null;
        
        return NextResponse.json({
          success: true,
          data: {
            ...syncStatus,
            databaseConnected: dbConnected,
            tableCounts: tableCounts?.find(t => t.network === 'ethereum') || { network: 'ethereum', stakeStarts: 0, globalInfo: 0 }
          }
        });

      case 'sync':
        const result = await ethereumSyncService.performSync();
        return NextResponse.json({
          success: result.success,
          data: result
        });

      case 'force-sync':
        await ethereumSyncService.forcefulSync();
        return NextResponse.json({
          success: true,
          message: 'Forceful Ethereum sync completed'
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Available actions: status, sync, force-sync'
        });
    }

  } catch (error) {
    console.error('Ethereum sync API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// POST endpoint for authenticated operations
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'sync':
        const result = await ethereumSyncService.performSync();
        return NextResponse.json({
          success: result.success,
          data: result
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        });
    }

  } catch (error) {
    console.error('Ethereum sync POST error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}