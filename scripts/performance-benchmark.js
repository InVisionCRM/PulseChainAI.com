#!/usr/bin/env node

/**
 * Advanced Performance Benchmark Script
 * Tests database performance with larger datasets and various scenarios
 */

const { neon } = require('@neondatabase/serverless');

// Test configuration
const config = {
  databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  testTimeout: 120000, // 2 minutes
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
  maxRecords: process.argv.includes('--max') ? 
    parseInt(process.argv[process.argv.indexOf('--max') + 1]) : 10000
};

// Performance results
const benchmarkResults = {
  tests: [],
  summary: {
    totalQueries: 0,
    totalTime: 0,
    averageQueryTime: 0,
    fastestQuery: Infinity,
    slowestQuery: 0,
    totalRecordsProcessed: 0
  }
};

// Utility functions
const log = (message, type = 'info') => {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
  console.log(`[${timestamp}] ${prefix} ${message}`);
};

const logVerbose = (message) => {
  if (config.verbose) {
    log(message, 'debug');
  }
};

// Performance measurement wrapper
const measurePerformance = async (testName, operation) => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();
  
  try {
    const result = await operation();
    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    
    const duration = endTime - startTime;
    const memoryDelta = {
      rss: endMemory.rss - startMemory.rss,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      external: endMemory.external - startMemory.external
    };
    
    const testResult = {
      name: testName,
      duration,
      memoryDelta,
      success: true,
      error: null,
      result
    };
    
    benchmarkResults.tests.push(testResult);
    benchmarkResults.summary.totalQueries++;
    benchmarkResults.summary.totalTime += duration;
    benchmarkResults.summary.fastestQuery = Math.min(benchmarkResults.summary.fastestQuery, duration);
    benchmarkResults.summary.slowestQuery = Math.max(benchmarkResults.summary.slowestQuery, duration);
    
    return testResult;
  } catch (error) {
    const endTime = Date.now();
    const testResult = {
      name: testName,
      duration: endTime - startTime,
      memoryDelta: null,
      success: false,
      error: error.message,
      result: null
    };
    
    benchmarkResults.tests.push(testResult);
    return testResult;
  }
};

// Test 1: Large Dataset Retrieval (Ethereum)
const testLargeEthereumDataset = async (sql) => {
  return await measurePerformance('Large Ethereum Dataset Retrieval', async () => {
    const recordCounts = [100, 500, 1000, 2500, 5000, config.maxRecords];
    const results = {};
    
    for (const count of recordCounts) {
      if (count > config.maxRecords) break;
      
      const start = Date.now();
      const stakes = await sql`
        SELECT stake_id, staker_addr, staked_hearts, staked_days, start_day, end_day, stake_shares
        FROM hex_stake_starts 
        ORDER BY staked_hearts DESC 
        LIMIT ${count}
      `;
      const duration = Date.now() - start;
      
      results[count] = {
        records: stakes.length,
        duration,
        recordsPerSecond: Math.round((stakes.length / duration) * 1000)
      };
      
      logVerbose(`  ${count} records: ${duration}ms (${results[count].recordsPerSecond} records/sec)`);
    }
    
    return results;
  });
};

// Test 2: Large Dataset Retrieval (PulseChain)
const testLargePulsechainDataset = async (sql) => {
  return await measurePerformance('Large PulseChain Dataset Retrieval', async () => {
    const recordCounts = [100, 500, 1000, 2500, 5000, 10000, 25000, config.maxRecords];
    const results = {};
    
    for (const count of recordCounts) {
      if (count > config.maxRecords) break;
      
      const start = Date.now();
      const stakes = await sql`
        SELECT stake_id, staker_addr, staked_hearts, staked_days, start_day, end_day, stake_shares
        FROM pulsechain_stake_starts 
        ORDER BY staked_hearts DESC 
        LIMIT ${count}
      `;
      const duration = Date.now() - start;
      
      results[count] = {
        records: stakes.length,
        duration,
        recordsPerSecond: Math.round((stakes.length / duration) * 1000)
      };
      
      logVerbose(`  ${count} records: ${duration}ms (${results[count].recordsPerSecond} records/sec)`);
    }
    
    return results;
  });
};

// Test 3: Complex Aggregation Queries
const testComplexAggregations = async (sql) => {
  return await measurePerformance('Complex Aggregation Queries', async () => {
    const queries = [
      // Top stakers by total staked amount
      sql`
        SELECT 
          staker_addr,
          COUNT(*) as stake_count,
          SUM(staked_hearts) as total_staked,
          AVG(staked_days) as avg_stake_length,
          MAX(staked_days) as max_stake_length
        FROM hex_stake_starts 
        GROUP BY staker_addr 
        HAVING COUNT(*) > 1
        ORDER BY total_staked DESC 
        LIMIT 100
      `,
      
      // Stake length distribution
      sql`
        SELECT 
          CASE 
            WHEN staked_days < 100 THEN '0-100 days'
            WHEN staked_days < 500 THEN '100-500 days'
            WHEN staked_days < 1000 THEN '500-1000 days'
            WHEN staked_days < 2000 THEN '1000-2000 days'
            ELSE '2000+ days'
          END as stake_range,
          COUNT(*) as stake_count,
          AVG(staked_hearts) as avg_staked,
          SUM(staked_hearts) as total_staked
        FROM hex_stake_starts 
        GROUP BY stake_range
        ORDER BY stake_count DESC
      `,
      
      // PulseChain top stakers
      sql`
        SELECT 
          staker_addr,
          COUNT(*) as stake_count,
          SUM(staked_hearts) as total_staked,
          AVG(staked_days) as avg_stake_length
        FROM pulsechain_stake_starts 
        GROUP BY staker_addr 
        HAVING COUNT(*) > 1
        ORDER BY total_staked DESC 
        LIMIT 100
      `
    ];
    
    const results = await Promise.all(queries);
    return {
      query1: { records: results[0].length, description: 'Top Ethereum stakers' },
      query2: { records: results[1].length, description: 'Stake length distribution' },
      query3: { records: results[2].length, description: 'Top PulseChain stakers' }
    };
  });
};

// Test 4: Concurrent Heavy Load
const testConcurrentHeavyLoad = async (sql) => {
  return await measurePerformance('Concurrent Heavy Load Test', async () => {
    const concurrentQueries = 20;
    const queries = [];
    
    // Create a mix of different query types
    for (let i = 0; i < concurrentQueries; i++) {
      if (i % 4 === 0) {
        // Large dataset queries
        queries.push(sql`SELECT COUNT(*) FROM hex_stake_starts`);
        queries.push(sql`SELECT COUNT(*) FROM pulsechain_stake_starts`);
      } else if (i % 4 === 1) {
        // Aggregation queries
        queries.push(sql`SELECT AVG(staked_days) FROM hex_stake_starts`);
        queries.push(sql`SELECT AVG(staked_days) FROM pulsechain_stake_starts`);
      } else if (i % 4 === 2) {
        // Top records queries
        queries.push(sql`SELECT * FROM hex_stake_starts ORDER BY staked_hearts DESC LIMIT 50`);
        queries.push(sql`SELECT * FROM pulsechain_stake_starts ORDER BY staked_hearts DESC LIMIT 50`);
      } else {
        // Complex queries
        queries.push(sql`SELECT staker_addr, COUNT(*) FROM hex_stake_starts GROUP BY staker_addr HAVING COUNT(*) > 5`);
        queries.push(sql`SELECT staker_addr, COUNT(*) FROM pulsechain_stake_starts GROUP BY staker_addr HAVING COUNT(*) > 5`);
      }
    }
    
    const startTime = Date.now();
    const results = await Promise.all(queries);
    const totalTime = Date.now() - startTime;
    
    return {
      concurrentQueries: queries.length,
      totalTime,
      averageTimePerQuery: totalTime / queries.length,
      successfulQueries: results.filter(r => r && r.length >= 0).length,
      failedQueries: results.filter(r => !r || r.length < 0).length
    };
  });
};

// Test 5: Memory and Resource Usage
const testMemoryUsage = async (sql) => {
  return await measurePerformance('Memory Usage Test', async () => {
    const initialMemory = process.memoryUsage();
    const results = [];
    
    // Perform multiple operations to test memory usage
    for (let i = 0; i < 10; i++) {
      const stakes = await sql`
        SELECT * FROM hex_stake_starts 
        ORDER BY staked_hearts DESC 
        LIMIT 1000
      `;
      results.push(stakes.length);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
    
    const finalMemory = process.memoryUsage();
    const memoryDelta = {
      rss: finalMemory.rss - initialMemory.rss,
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      external: finalMemory.external - initialMemory.external
    };
    
    return {
      operations: results.length,
      totalRecordsProcessed: results.reduce((sum, count) => sum + count, 0),
      memoryDelta,
      memoryEfficiency: results.reduce((sum, count) => sum + count, 0) / (memoryDelta.heapUsed || 1)
    };
  });
};

// Test 6: Network Latency Simulation
const testNetworkLatency = async (sql) => {
  return await measurePerformance('Network Latency Simulation', async () => {
    const iterations = 50;
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await sql`SELECT 1 as test`;
      const duration = Date.now() - start;
      results.push(duration);
      
      // Small delay to simulate real-world conditions
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    const avgLatency = results.reduce((sum, time) => sum + time, 0) / results.length;
    const minLatency = Math.min(...results);
    const maxLatency = Math.max(...results);
    const latencyVariance = results.reduce((sum, time) => sum + Math.pow(time - avgLatency, 2), 0) / results.length;
    
    return {
      iterations,
      averageLatency: avgLatency,
      minLatency,
      maxLatency,
      latencyVariance: Math.sqrt(latencyVariance),
      latencyStability: (maxLatency - minLatency) / avgLatency
    };
  });
};

// Test 7: Data Consistency Under Load
const testDataConsistencyUnderLoad = async (sql) => {
  return await measurePerformance('Data Consistency Under Load', async () => {
    const consistencyChecks = [];
    
    // Run multiple consistency checks concurrently
    const checks = [
      // Check total stakes consistency
      sql`SELECT COUNT(*) as total FROM hex_stake_starts`,
      sql`SELECT COUNT(*) as total FROM pulsechain_stake_starts`,
      
      // Check data integrity
      sql`SELECT COUNT(*) as valid FROM hex_stake_starts WHERE staked_hearts > 0 AND staked_days > 0`,
      sql`SELECT COUNT(*) as valid FROM pulsechain_stake_starts WHERE staked_hearts > 0 AND staked_days > 0`,
      
      // Check for duplicates
      sql`SELECT COUNT(*) as duplicates FROM (SELECT stake_id, COUNT(*) FROM hex_stake_starts GROUP BY stake_id HAVING COUNT(*) > 1) t`,
      sql`SELECT COUNT(*) as duplicates FROM (SELECT stake_id, COUNT(*) FROM pulsechain_stake_starts GROUP BY stake_id HAVING COUNT(*) > 1) t`
    ];
    
    const results = await Promise.all(checks);
    
    return {
      ethereumTotalStakes: results[0][0]?.total || 0,
      pulsechainTotalStakes: results[1][0]?.total || 0,
      ethereumValidRecords: results[2][0]?.valid || 0,
      pulsechainValidRecords: results[3][0]?.valid || 0,
      ethereumDuplicates: results[4][0]?.duplicates || 0,
      pulsechainDuplicates: results[5][0]?.duplicates || 0,
      dataIntegrity: results[2][0]?.valid === results[0][0]?.total && results[3][0]?.valid === results[1][0]?.total
    };
  });
};

// Main benchmark execution
const runPerformanceBenchmarks = async () => {
  if (!config.databaseUrl) {
    log('❌ DATABASE_URL environment variable not set', 'error');
    process.exit(1);
  }
  
  log('🚀 Starting Advanced Performance Benchmark Suite...');
  log(`Database URL: ${config.databaseUrl ? 'Set' : 'Not set'}`);
  log(`Max records: ${config.maxRecords.toLocaleString()}`);
  log(`Verbose mode: ${config.verbose ? 'Enabled' : 'Disabled'}`);
  log(`Test timeout: ${config.testTimeout}ms`);
  log('');
  
  try {
    const sql = neon(config.databaseUrl);
    
    // Verify connection
    await sql`SELECT 1 as test`;
    log('✅ Database connection established');
    
    // Run all performance tests
    log('📊 Running Performance Tests...');
    log('');
    
    await testLargeEthereumDataset(sql);
    await testLargePulsechainDataset(sql);
    await testComplexAggregations(sql);
    await testConcurrentHeavyLoad(sql);
    await testMemoryUsage(sql);
    await testNetworkLatency(sql);
    await testDataConsistencyUnderLoad(sql);
    
    // Calculate summary statistics
    const successfulTests = benchmarkResults.tests.filter(t => t.success);
    benchmarkResults.summary.averageQueryTime = benchmarkResults.summary.totalTime / benchmarkResults.summary.totalQueries;
    
    // Print results
    log('');
    log('📊 Performance Benchmark Results');
    log('=' .repeat(50));
    
    successfulTests.forEach(test => {
      const status = test.success ? '✅' : '❌';
      log(`${status} ${test.name}: ${test.duration}ms`, test.success ? 'success' : 'error');
      
      if (test.result && typeof test.result === 'object') {
        if (test.result.recordsPerSecond) {
          log(`   Performance: ${test.result.recordsPerSecond} records/second`);
        }
        if (test.result.concurrentQueries) {
          log(`   Concurrency: ${test.result.concurrentQueries} queries in ${test.result.totalTime}ms`);
        }
        if (test.result.memoryEfficiency) {
          log(`   Memory Efficiency: ${test.result.memoryEfficiency.toFixed(2)} records/MB`);
        }
      }
    });
    
    log('');
    log('📈 Summary Statistics');
    log('=' .repeat(30));
    log(`Total Tests: ${benchmarkResults.tests.length}`);
    log(`Successful: ${successfulTests.length}`);
    log(`Failed: ${benchmarkResults.tests.length - successfulTests.length}`);
    log(`Total Query Time: ${benchmarkResults.summary.totalTime}ms`);
    log(`Average Query Time: ${benchmarkResults.summary.averageQueryTime.toFixed(2)}ms`);
    log(`Fastest Query: ${benchmarkResults.summary.fastestQuery}ms`);
    log(`Slowest Query: ${benchmarkResults.summary.slowestQuery}ms`);
    
    // Performance recommendations
    log('');
    log('💡 Performance Recommendations');
    log('=' .repeat(30));
    
    if (benchmarkResults.summary.averageQueryTime > 1000) {
      log('⚠️  Average query time is high (>1s). Consider optimizing database indexes.');
    }
    
    if (benchmarkResults.summary.slowestQuery > 5000) {
      log('⚠️  Some queries are very slow (>5s). Review complex aggregation queries.');
    }
    
    const successRate = (successfulTests.length / benchmarkResults.tests.length) * 100;
    if (successRate < 100) {
      log('⚠️  Not all tests passed. Review failed tests for potential issues.');
    }
    
    if (successRate === 100 && benchmarkResults.summary.averageQueryTime < 500) {
      log('✅ Excellent performance! Database integration is working optimally.');
    }
    
  } catch (error) {
    log(`❌ Benchmark suite failed: ${error.message}`, 'error');
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGINT', () => {
  log('Benchmark interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  log('Benchmark terminated');
  process.exit(1);
});

// Run benchmarks with timeout
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error(`Benchmark suite timed out after ${config.testTimeout}ms`)), config.testTimeout);
});

Promise.race([runPerformanceBenchmarks(), timeoutPromise])
  .catch(error => {
    log(`Benchmark suite failed: ${error.message}`, 'error');
    process.exit(1);
  });
