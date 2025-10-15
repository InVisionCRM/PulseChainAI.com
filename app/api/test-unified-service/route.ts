import { NextResponse } from 'next/server';
import { unifiedHexStakingService } from '@/services/unifiedHexStakingService';

export async function GET() {
  try {
    console.log('🧪 Testing unified HEX staking service...');
    
    // Test database status
    const dbStatus = await unifiedHexStakingService.getDatabaseStatus();
    console.log('📊 Database Status:', dbStatus);
    
    // Test getting metrics for both networks
    const [ethereumMetrics, pulsechainMetrics] = await Promise.all([
      unifiedHexStakingService.getStakingMetrics('ethereum').catch(err => ({ 
        error: err.message,
        totalActiveStakes: 0,
        isDataAvailable: false 
      })),
      unifiedHexStakingService.getStakingMetrics('pulsechain').catch(err => ({ 
        error: err.message,
        totalActiveStakes: 0,
        isDataAvailable: false 
      }))
    ]);
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      databaseStatus: dbStatus,
      networks: {
        ethereum: {
          hasData: ethereumMetrics.isDataAvailable,
          totalActiveStakes: ethereumMetrics.totalActiveStakes,
          error: (ethereumMetrics as any).error || null
        },
        pulsechain: {
          hasData: pulsechainMetrics.isDataAvailable,
          totalActiveStakes: pulsechainMetrics.totalActiveStakes,
          error: (pulsechainMetrics as any).error || null
        }
      },
      message: 'Unified service test completed successfully'
    });
    
  } catch (error) {
    console.error('❌ Unified service test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}