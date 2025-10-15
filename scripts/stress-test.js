#!/usr/bin/env node

/**
 * Database Stress Test Script
 * Pushes the system to its limits with extreme scenarios
 */

const { neon } = require('@neondatabase/serverless');

// Stress test configuration
const config = {
  databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  testTimeout: 300000, // 5 minutes
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
  maxConcurrency: process.argv.includes('--concurrency') ? 
    parseInt(process.argv[process.argv.indexOf('--concurrency') + 1]) : 100,
  maxRecords: process.argv.includes('--max') ? 
    parseInt(process.argv[process.argv.indexOf('--max') + 1]) : 100000
};

// Stress test results
const stressResults = {
  tests: [],
  performance: {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    totalTime: 0,
    peakConcurrency: 0,
    memoryPeak: 0
  },
  errors: []
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

// Memory monitoring
const getMemoryUsage = () => {
  const mem = process.memoryUsage();
  return {
    rss: Math.round(mem.rss / 1024 / 1024), // MB
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024), // MB
    external: Math.round(mem.external / 1024 / 1024) // MB
  };
};

// Stress Test 1: Extreme Concurrency
const testExtremeConcurrency = async (sql) => {
  log('🔥 Starting Extreme Concurrency Test...');
  
  const startTime = Date.now();
  const operations = [];
  const results = [];
  
  // Create massive number of concurrent operations
  for (let i = 0; i < config.maxConcurrency; i++) {
    const operationType = i % 6;
    let query;
    
    switch (operationType) {
      case 0:
        // Simple count queries
        query = sql`SELECT COUNT(*) FROM hex_stake_starts`;
        break;
      case 1:
        // Large data retrieval
        query = sql`SELECT * FROM pulsechain_stake_starts ORDER BY staked_hearts DESC LIMIT 1000`;
        break;
      case 2:
        // Complex aggregations
        query = sql`SELECT staker_addr, COUNT(*), SUM(staked_hearts) FROM hex_stake_starts GROUP BY staker_addr HAVING COUNT(*) > 1`;
        break;
      case 3:
        // Data consistency checks
        query = sql`SELECT COUNT(*) FROM hex_stake_starts WHERE staked_hearts > 0 AND staked_days > 0`;
        break;
      case 4:
        // Top records with ordering
        query = sql`SELECT * FROM pulsechain_stake_starts ORDER BY staked_hearts DESC, staked_days DESC LIMIT 500`;
        break;
      case 5:
        // Statistical analysis
        query = sql`SELECT AVG(staked_days), STDDEV(staked_days), MIN(staked_days), MAX(staked_days) FROM hex_stake_starts`;
        break;
    }
    
    operations.push(query);
  }
  
  log(`📊 Executing ${operations.length} concurrent operations...`);
  
  try {
    const startExecution = Date.now();
    const queryResults = await Promise.allSettled(operations);
    const executionTime = Date.now() - startExecution;
    
    // Analyze results
    const successful = queryResults.filter(r => r.status === 'fulfilled').length;
    const failed = queryResults.filter(r => r.status === 'rejected').length;
    
    // Collect errors
    queryResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        stressResults.errors.push({
          test: 'Extreme Concurrency',
          operation: index,
          error: result.reason.message
        });
      }
    });
    
    const testResult = {
      name: 'Extreme Concurrency Test',
      totalOperations: operations.length,
      successfulOperations: successful,
      failedOperations: failed,
      executionTime,
      successRate: (successful / operations.length) * 100,
      operationsPerSecond: Math.round((operations.length / executionTime) * 1000)
    };
    
    stressResults.tests.push(testResult);
    stressResults.performance.totalOperations += operations.length;
    stressResults.performance.successfulOperations += successful;
    stressResults.performance.failedOperations += failed;
    stressResults.performance.totalTime += executionTime;
    stressResults.performance.peakConcurrency = Math.max(stressResults.performance.peakConcurrency, operations.length);
    
    log(`✅ Extreme Concurrency Test completed:`, 'success');
    log(`   Success Rate: ${testResult.successRate.toFixed(2)}%`);
    log(`   Operations/sec: ${testResult.operationsPerSecond}`);
    log(`   Execution Time: ${executionTime}ms`);
    
    return testResult;
    
  } catch (error) {
    log(`❌ Extreme Concurrency Test failed: ${error.message}`, 'error');
    throw error;
  }
};

// Stress Test 2: Memory Bomb
const testMemoryBomb = async (sql) => {
  log('💣 Starting Memory Bomb Test...');
  
  const startTime = Date.now();
  const startMemory = getMemoryUsage();
  const operations = [];
  const results = [];
  
  // Create operations that will consume significant memory
  for (let i = 0; i < 50; i++) {
    operations.push(
      sql`SELECT * FROM hex_stake_starts ORDER BY staked_hearts DESC LIMIT 10000`,
      sql`SELECT * FROM pulsechain_stake_starts ORDER BY staked_hearts DESC LIMIT 10000`
    );
  }
  
  log(`📊 Executing ${operations.length} memory-intensive operations...`);
  
  try {
    const startExecution = Date.now();
    const queryResults = await Promise.allSettled(operations);
    const executionTime = Date.now() - startExecution;
    
    const endMemory = getMemoryUsage();
    const memoryDelta = {
      rss: endMemory.rss - startMemory.rss,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      external: endMemory.external - startMemory.external
    };
    
    const successful = queryResults.filter(r => r.status === 'fulfilled').length;
    const failed = queryResults.filter(r => r.status === 'rejected').length;
    
    // Collect errors
    queryResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        stressResults.errors.push({
          test: 'Memory Bomb',
          operation: index,
          error: result.reason.message
        });
      }
    });
    
    const testResult = {
      name: 'Memory Bomb Test',
      totalOperations: operations.length,
      successfulOperations: successful,
      failedOperations: failed,
      executionTime,
      memoryDelta,
      successRate: (successful / operations.length) * 100
    };
    
    stressResults.tests.push(testResult);
    stressResults.performance.totalOperations += operations.length;
    stressResults.performance.successfulOperations += successful;
    stressResults.performance.failedOperations += failed;
    stressResults.performance.totalTime += executionTime;
    stressResults.performance.memoryPeak = Math.max(stressResults.performance.memoryPeak, endMemory.heapUsed);
    
    log(`✅ Memory Bomb Test completed:`, 'success');
    log(`   Success Rate: ${testResult.successRate.toFixed(2)}%`);
    log(`   Memory Increase: +${memoryDelta.heapUsed}MB heap, +${memoryDelta.rss}MB RSS`);
    log(`   Execution Time: ${executionTime}ms`);
    
    return testResult;
    
  } catch (error) {
    log(`❌ Memory Bomb Test failed: ${error.message}`, 'error');
    throw error;
  }
};

// Stress Test 3: Query Storm
const testQueryStorm = async (sql) => {
  log('⚡ Starting Query Storm Test...');
  
  const startTime = Date.now();
  const operations = [];
  
  // Create a storm of different query types
  const queryTypes = [
    // Simple queries
    () => sql`SELECT 1 as test`,
    () => sql`SELECT COUNT(*) FROM hex_stake_starts`,
    () => sql`SELECT COUNT(*) FROM pulsechain_stake_starts`,
    
    // Complex queries
    () => sql`SELECT staker_addr, COUNT(*) FROM hex_stake_starts GROUP BY staker_addr HAVING COUNT(*) > 5`,
    () => sql`SELECT staker_addr, COUNT(*) FROM pulsechain_stake_starts GROUP BY staker_addr HAVING COUNT(*) > 5`,
    
    // Data retrieval
    () => sql`SELECT * FROM hex_stake_starts ORDER BY staked_hearts DESC LIMIT 100`,
    () => sql`SELECT * FROM pulsechain_stake_starts ORDER BY staked_hearts DESC LIMIT 100`,
    
    // Aggregations
    () => sql`SELECT AVG(staked_days), MAX(staked_days), MIN(staked_days) FROM hex_stake_starts`,
    () => sql`SELECT AVG(staked_days), MAX(staked_days), MIN(staked_days) FROM pulsechain_stake_starts`
  ];
  
  // Create 200 operations with random query types
  for (let i = 0; i < 200; i++) {
    const queryType = queryTypes[i % queryTypes.length];
    operations.push(queryType());
  }
  
  log(`📊 Executing ${operations.length} queries in storm pattern...`);
  
  try {
    const startExecution = Date.now();
    const queryResults = await Promise.allSettled(operations);
    const executionTime = Date.now() - startExecution;
    
    const successful = queryResults.filter(r => r.status === 'fulfilled').length;
    const failed = queryResults.filter(r => r.status === 'rejected').length;
    
    // Collect errors
    queryResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        stressResults.errors.push({
          test: 'Query Storm',
          operation: index,
          error: result.reason.message
        });
      }
    });
    
    const testResult = {
      name: 'Query Storm Test',
      totalOperations: operations.length,
      successfulOperations: successful,
      failedOperations: failed,
      executionTime,
      successRate: (successful / operations.length) * 100,
      queriesPerSecond: Math.round((operations.length / executionTime) * 1000)
    };
    
    stressResults.tests.push(testResult);
    stressResults.performance.totalOperations += operations.length;
    stressResults.performance.successfulOperations += successful;
    stressResults.performance.failedOperations += failed;
    stressResults.performance.totalTime += executionTime;
    
    log(`✅ Query Storm Test completed:`, 'success');
    log(`   Success Rate: ${testResult.successRate.toFixed(2)}%`);
    log(`   Queries/sec: ${testResult.queriesPerSecond}`);
    log(`   Execution Time: ${executionTime}ms`);
    
    return testResult;
    
  } catch (error) {
    log(`❌ Query Storm Test failed: ${error.message}`, 'error');
    throw error;
  }
};

// Stress Test 4: Data Flood
const testDataFlood = async (sql) => {
  log('🌊 Starting Data Flood Test...');
  
  const startTime = Date.now();
  const operations = [];
  
  // Create operations that retrieve massive amounts of data
  const dataSizes = [1000, 5000, 10000, 25000, 50000];
  
  for (const size of dataSizes) {
    if (size > config.maxRecords) break;
    
    operations.push(
      sql`SELECT * FROM hex_stake_starts ORDER BY staked_hearts DESC LIMIT ${size}`,
      sql`SELECT * FROM pulsechain_stake_starts ORDER BY staked_hearts DESC LIMIT ${size}`,
      sql`SELECT stake_id, staker_addr, staked_hearts, staked_days FROM hex_stake_starts ORDER BY staked_hearts DESC LIMIT ${size}`,
      sql`SELECT stake_id, staker_addr, staked_hearts, staked_days FROM pulsechain_stake_starts ORDER BY staked_hearts DESC LIMIT ${size}`
    );
  }
  
  log(`📊 Executing ${operations.length} data flood operations...`);
  
  try {
    const startExecution = Date.now();
    const queryResults = await Promise.allSettled(operations);
    const executionTime = Date.now() - startExecution;
    
    const successful = queryResults.filter(r => r.status === 'fulfilled').length;
    const failed = queryResults.filter(r => r.status === 'rejected').length;
    
    // Calculate total records processed
    let totalRecords = 0;
    queryResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        totalRecords += result.value.length;
      }
      if (result.status === 'rejected') {
        stressResults.errors.push({
          test: 'Data Flood',
          operation: index,
          error: result.reason.message
        });
      }
    });
    
    const testResult = {
      name: 'Data Flood Test',
      totalOperations: operations.length,
      successfulOperations: successful,
      failedOperations: failed,
      executionTime,
      totalRecordsProcessed: totalRecords,
      successRate: (successful / operations.length) * 100,
      recordsPerSecond: Math.round((totalRecords / executionTime) * 1000)
    };
    
    stressResults.tests.push(testResult);
    stressResults.performance.totalOperations += operations.length;
    stressResults.performance.successfulOperations += successful;
    stressResults.performance.failedOperations += failed;
    stressResults.performance.totalTime += executionTime;
    
    log(`✅ Data Flood Test completed:`, 'success');
    log(`   Success Rate: ${testResult.successRate.toFixed(2)}%`);
    log(`   Total Records: ${totalRecords.toLocaleString()}`);
    log(`   Records/sec: ${testResult.recordsPerSecond.toLocaleString()}`);
    log(`   Execution Time: ${executionTime}ms`);
    
    return testResult;
    
  } catch (error) {
    log(`❌ Data Flood Test failed: ${error.message}`, 'error');
    throw error;
  }
};

// Main stress test execution
const runStressTests = async () => {
  if (!config.databaseUrl) {
    log('❌ DATABASE_URL environment variable not set', 'error');
    process.exit(1);
  }
  
  log('🚀 Starting Database Stress Test Suite...');
  log(`Database URL: ${config.databaseUrl ? 'Set' : 'Not set'}`);
  log(`Max Concurrency: ${config.maxConcurrency.toLocaleString()}`);
  log(`Max Records: ${config.maxRecords.toLocaleString()}`);
  log(`Verbose mode: ${config.verbose ? 'Enabled' : 'Disabled'}`);
  log(`Test timeout: ${config.testTimeout}ms`);
  log('');
  
  try {
    const sql = neon(config.databaseUrl);
    
    // Verify connection
    await sql`SELECT 1 as test`;
    log('✅ Database connection established');
    
    // Run all stress tests
    log('🔥 Running Stress Tests...');
    log('');
    
    await testExtremeConcurrency(sql);
    await testMemoryBomb(sql);
    await testQueryStorm(sql);
    await testDataFlood(sql);
    
    // Print comprehensive results
    log('');
    log('📊 Stress Test Results Summary');
    log('=' .repeat(50));
    
    stressResults.tests.forEach(test => {
      log(`${test.successRate === 100 ? '✅' : '⚠️'} ${test.name}:`, test.successRate === 100 ? 'success' : 'warning');
      log(`   Success Rate: ${test.successRate.toFixed(2)}%`);
      log(`   Operations: ${test.successfulOperations}/${test.totalOperations}`);
      log(`   Execution Time: ${test.executionTime}ms`);
      
      if (test.operationsPerSecond) {
        log(`   Throughput: ${test.operationsPerSecond} ops/sec`);
      }
      if (test.recordsPerSecond) {
        log(`   Data Rate: ${test.recordsPerSecond.toLocaleString()} records/sec`);
      }
      if (test.memoryDelta) {
        log(`   Memory: +${test.memoryDelta.heapUsed}MB heap`);
      }
    });
    
    log('');
    log('📈 Performance Summary');
    log('=' .repeat(30));
    log(`Total Operations: ${stressResults.performance.totalOperations.toLocaleString()}`);
    log(`Successful: ${stressResults.performance.successfulOperations.toLocaleString()}`);
    log(`Failed: ${stressResults.performance.failedOperations.toLocaleString()}`);
    log(`Success Rate: ${((stressResults.performance.successfulOperations / stressResults.performance.totalOperations) * 100).toFixed(2)}%`);
    log(`Total Time: ${stressResults.performance.totalTime}ms`);
    log(`Peak Concurrency: ${stressResults.performance.peakConcurrency.toLocaleString()}`);
    log(`Memory Peak: ${stressResults.performance.memoryPeak}MB`);
    
    // Error analysis
    if (stressResults.errors.length > 0) {
      log('');
      log('❌ Error Analysis');
      log('=' .repeat(20));
      log(`Total Errors: ${stressResults.errors.length}`);
      
      const errorTypes = {};
      stressResults.errors.forEach(error => {
        errorTypes[error.test] = (errorTypes[error.test] || 0) + 1;
      });
      
      Object.entries(errorTypes).forEach(([test, count]) => {
        log(`   ${test}: ${count} errors`);
      });
    }
    
    // Stress test recommendations
    log('');
    log('💡 Stress Test Recommendations');
    log('=' .repeat(35));
    
    const overallSuccessRate = (stressResults.performance.successfulOperations / stressResults.performance.totalOperations) * 100;
    
    if (overallSuccessRate >= 95) {
      log('✅ Excellent stress test results! Database can handle extreme loads.');
    } else if (overallSuccessRate >= 80) {
      log('⚠️  Good stress test results with some failures. Consider optimizing error handling.');
    } else {
      log('❌ Poor stress test results. Database may need optimization or scaling.');
    }
    
    if (stressResults.performance.memoryPeak > 1000) {
      log('⚠️  High memory usage detected. Consider implementing connection pooling.');
    }
    
    if (stressResults.errors.length > 0) {
      log('⚠️  Errors detected during stress testing. Review error patterns.');
    }
    
  } catch (error) {
    log(`❌ Stress test suite failed: ${error.message}`, 'error');
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGINT', () => {
  log('Stress test interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  log('Stress test terminated');
  process.exit(1);
});

// Run stress tests with timeout
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error(`Stress test suite timed out after ${config.testTimeout}ms`)), config.testTimeout);
});

Promise.race([runStressTests(), timeoutPromise])
  .catch(error => {
    log(`Stress test suite failed: ${error.message}`, 'error');
    process.exit(1);
  });
