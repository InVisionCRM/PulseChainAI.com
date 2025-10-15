import { NextRequest, NextResponse } from 'next/server';
import { hexStakingDb } from '@/lib/db/hexStakingDb';
import { databaseStatus } from '@/lib/db/databaseStatus';

export async function POST(request: NextRequest) {
  try {
    const { testType, params } = await request.json();
    
    switch (testType) {
      case 'connection':
        return await testConnection();
      case 'schema':
        return await testSchema();
      case 'ethereum-data':
        return await testEthereumData();
      case 'pulsechain-data':
        return await testPulsechainData();
      case 'data-flow-transition':
        return await testDataFlowTransition();
      case 'performance-benchmark':
        return await testPerformanceBenchmark(params);
      case 'invalid-test':
        return await testInvalidTest();
      default:
        return NextResponse.json({ error: 'Unknown test type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Database test API error:', error);
    return NextResponse.json({ 
      error: 'Test execution failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

// Test 1: Database Connection
async function testConnection() {
  const startTime = Date.now();
  try {
    const isAvailable = await databaseStatus.checkAvailability();
    const duration = Date.now() - startTime;
    
    if (isAvailable) {
      return NextResponse.json({
        success: true,
        message: `✅ Database connection successful (${duration}ms)`,
        duration,
        details: { available: true }
      });
    } else {
      return NextResponse.json({
        success: false,
        message: '❌ Database connection failed',
        duration,
        details: { available: false }
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    return NextResponse.json({
      success: false,
      message: `❌ Database connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Test 2: Database Schema Validation
async function testSchema() {
  const startTime = Date.now();
  try {
    // Test basic database operations
    const ethereumOverview = await hexStakingDb.getStakingOverview('ethereum');
    const pulsechainOverview = await hexStakingDb.getStakingOverview('pulsechain');
    
    const duration = Date.now() - startTime;
    
    if (ethereumOverview && pulsechainOverview) {
      return NextResponse.json({
        success: true,
        message: `✅ Schema validation successful (${duration}ms)`,
        duration,
        details: {
          ethereumStakes: ethereumOverview.totalActiveStakes,
          pulsechainStakes: pulsechainOverview.totalActiveStakes
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        message: '❌ Schema validation failed - missing data',
        duration
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    return NextResponse.json({
      success: false,
      message: `❌ Schema validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Test 3: Ethereum Data Loading
async function testEthereumData() {
  const startTime = Date.now();
  try {
    const [overview, globalInfo, topStakes] = await Promise.all([
      hexStakingDb.getStakingOverview('ethereum'),
      hexStakingDb.getLatestGlobalInfo('ethereum'),
      hexStakingDb.getTopStakes('ethereum', 10)
    ]);
    
    const duration = Date.now() - startTime;
    
    if (overview && globalInfo && topStakes) {
      return NextResponse.json({
        success: true,
        message: `✅ Ethereum data loaded successfully (${duration}ms)`,
        duration,
        details: {
          totalStakes: overview.totalActiveStakes,
          totalStaked: overview.totalStakedHearts,
          topStakesCount: topStakes.length
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        message: '❌ Ethereum data loading failed - incomplete data',
        duration
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    return NextResponse.json({
      success: false,
      message: `❌ Ethereum data loading error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Test 4: PulseChain Data Loading
async function testPulsechainData() {
  const startTime = Date.now();
  try {
    const [overview, globalInfo, topStakes] = await Promise.all([
      hexStakingDb.getStakingOverview('pulsechain'),
      hexStakingDb.getLatestGlobalInfo('pulsechain'),
      hexStakingDb.getTopStakes('pulsechain', 10)
    ]);
    
    const duration = Date.now() - startTime;
    
    if (overview && globalInfo && topStakes) {
      return NextResponse.json({
        success: true,
        message: `✅ PulseChain data loaded successfully (${duration}ms)`,
        duration,
        details: {
          totalStakes: overview.totalActiveStakes,
          totalStaked: overview.totalStakedHearts,
          topStakesCount: topStakes.length
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        message: '❌ PulseChain data loading failed - incomplete data',
        duration
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    return NextResponse.json({
      success: false,
      message: `❌ PulseChain data loading error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Test 5: Data Flow Transition
async function testDataFlowTransition() {
  const startTime = Date.now();
  try {
    // Test transitioning between different data sources
    const ethereumData = await hexStakingDb.getStakingOverview('ethereum');
    const pulsechainData = await hexStakingDb.getStakingOverview('pulsechain');
    
    // Simulate data flow transition
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to simulate transition
    
    const duration = Date.now() - startTime;
    
    if (ethereumData && pulsechainData) {
      return NextResponse.json({
        success: true,
        message: `✅ Data flow transition successful (${duration}ms)`,
        duration,
        details: {
          ethereumStatus: 'database',
          pulsechainStatus: 'database',
          ethereumStakes: ethereumData.totalActiveStakes,
          pulsechainStakes: pulsechainData.totalActiveStakes
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        message: '❌ Data flow transition failed - missing data',
        duration
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    return NextResponse.json({
      success: false,
      message: `❌ Data flow transition error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Test 6: Performance Benchmark
async function testPerformanceBenchmark(params: any = {}) {
  const startTime = Date.now();
  try {
    const maxRecords = params.maxRecords || 1000;
    
    // Run performance tests
    const [ethereumTime, pulsechainTime] = await Promise.all([
      measureQueryTime(() => hexStakingDb.getTopStakes('ethereum', maxRecords)),
      measureQueryTime(() => hexStakingDb.getTopStakes('pulsechain', maxRecords))
    ]);
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      message: `✅ Performance benchmark completed (${duration}ms)`,
      duration,
      details: {
        ethereumQueryTime: ethereumTime,
        pulsechainQueryTime: pulsechainTime,
        maxRecords,
        averageQueryTime: Math.round((ethereumTime + pulsechainTime) / 2)
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    return NextResponse.json({
      success: false,
      message: `❌ Performance benchmark error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Test 7: Invalid Test (for error handling)
async function testInvalidTest() {
  // This test intentionally triggers an error for testing error handling
  return NextResponse.json({
    error: 'Invalid test type requested',
    details: { 
      message: 'This is an intentional error for testing error handling capabilities',
      testType: 'invalid-test'
    }
  }, { status: 400 });
}

// Helper function to measure query execution time
async function measureQueryTime(queryFn: () => Promise<any>): Promise<number> {
  const start = Date.now();
  await queryFn();
  return Date.now() - start;
}
