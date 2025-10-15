#!/usr/bin/env node

/**
 * Database Integration Test Script
 * Tests the database integration features programmatically
 */

const { neon } = require('@neondatabase/serverless');

// Test configuration
const config = {
  databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  testTimeout: 30000, // 30 seconds
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v')
};

// Test results
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
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

// Test runner
const runTest = async (name, testFunction) => {
  testResults.total++;
  const startTime = Date.now();
  
  try {
    log(`Running test: ${name}...`);
    const result = await testFunction();
    const duration = Date.now() - startTime;
    
    if (result) {
      testResults.passed++;
      log(`Test PASSED: ${name} (${duration}ms)`, 'success');
      testResults.details.push({ name, status: 'PASSED', duration, error: null });
      return true;
    } else {
      testResults.failed++;
      log(`Test FAILED: ${name} (${duration}ms)`, 'error');
      testResults.details.push({ name, status: 'FAILED', duration, error: 'Test returned false' });
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    testResults.failed++;
    log(`Test ERROR: ${name} (${duration}ms) - ${error.message}`, 'error');
    testResults.details.push({ name, status: 'ERROR', duration, error: error.message });
    return false;
  }
};

// Test 1: Database Connection
const testDatabaseConnection = async () => {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL environment variable not set');
  }
  
  try {
    const sql = neon(config.databaseUrl);
    const result = await sql`SELECT 1 as test`;
    return result && result.length > 0 && result[0].test === 1;
  } catch (error) {
    throw new Error(`Database connection failed: ${error.message}`);
  }
};

// Test 2: Database Schema Validation
const testDatabaseSchema = async () => {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL environment variable not set');
  }
  
  try {
    const sql = neon(config.databaseUrl);
    
    // Check if required tables exist
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('pulsechain_stake_starts', 'hex_stake_starts', 'hex_global_info', 'pulsechain_global_info')
    `;
    
    logVerbose(`Found tables: ${tables.map(t => t.table_name).join(', ')}`);
    
    // Check if tables have data
    const ethereumStakesCount = await sql`SELECT COUNT(*) as count FROM hex_stake_starts`;
    const pulsechainStakesCount = await sql`SELECT COUNT(*) as count FROM pulsechain_stake_starts`;
    const globalInfoCount = await sql`SELECT COUNT(*) as count FROM hex_global_info`;
    
    logVerbose(`Ethereum stakes: ${ethereumStakesCount[0]?.count || 0}`);
    logVerbose(`PulseChain stakes: ${pulsechainStakesCount[0]?.count || 0}`);
    logVerbose(`Global info records: ${globalInfoCount[0]?.count || 0}`);
    
    return tables.length >= 4 && 
           (ethereumStakesCount[0]?.count || 0) > 0 && 
           (pulsechainStakesCount[0]?.count || 0) > 0;
  } catch (error) {
    throw new Error(`Schema validation failed: ${error.message}`);
  }
};

// Test 3: Data Retrieval Performance
const testDataRetrievalPerformance = async () => {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL environment variable not set');
  }
  
  try {
    const sql = neon(config.databaseUrl);
    
    // Test Ethereum data retrieval
    const ethereumStart = Date.now();
    const ethereumStakes = await sql`
      SELECT stake_id, staker_addr, staked_hearts, staked_days, start_day, end_day
      FROM hex_stake_starts 
      ORDER BY staked_hearts DESC 
      LIMIT 100
    `;
    const ethereumDuration = Date.now() - ethereumStart;
    
    // Test PulseChain data retrieval
    const pulsechainStart = Date.now();
    const pulsechainStakes = await sql`
      SELECT stake_id, staker_addr, staked_hearts, staked_days, start_day, end_day
      FROM pulsechain_stake_starts 
      ORDER BY staked_hearts DESC 
      LIMIT 100
    `;
    const pulsechainDuration = Date.now() - pulsechainStart;
    
    logVerbose(`Ethereum stakes retrieval: ${ethereumDuration}ms for ${ethereumStakes.length} records`);
    logVerbose(`PulseChain stakes retrieval: ${pulsechainDuration}ms for ${pulsechainStakes.length} records`);
    
    // Performance should be under 1000ms for 100 records
    return ethereumDuration < 1000 && pulsechainDuration < 1000 && 
           ethereumStakes.length > 0 && pulsechainStakes.length > 0;
  } catch (error) {
    throw new Error(`Data retrieval performance test failed: ${error.message}`);
  }
};

// Test 4: Data Integrity
const testDataIntegrity = async () => {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL environment variable not set');
  }
  
  try {
    const sql = neon(config.databaseUrl);
    
    // Check for data consistency
    const ethereumOverview = await sql`
      SELECT 
        COUNT(*) as total_stakes,
        SUM(staked_hearts) as total_staked,
        AVG(staked_days) as avg_stake_length
      FROM hex_stake_starts
    `;
    
    const pulsechainOverview = await sql`
      SELECT 
        COUNT(*) as total_stakes,
        SUM(staked_hearts) as total_staked,
        AVG(staked_days) as avg_stake_length
      FROM pulsechain_stake_starts
    `;
    
    logVerbose(`Ethereum overview: ${JSON.stringify(ethereumOverview[0])}`);
    logVerbose(`PulseChain overview: ${JSON.stringify(pulsechainOverview[0])}`);
    
    // Basic integrity checks
    const ethereumValid = ethereumOverview[0] && 
                         ethereumOverview[0].total_stakes > 0 && 
                         ethereumOverview[0].total_staked > 0;
    
    const pulsechainValid = pulsechainOverview[0] && 
                           pulsechainOverview[0].total_stakes > 0 && 
                           pulsechainOverview[0].total_staked > 0;
    
    return ethereumValid && pulsechainValid;
  } catch (error) {
    throw new Error(`Data integrity test failed: ${error.message}`);
  }
};

// Test 5: Concurrent Operations
const testConcurrentOperations = async () => {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL environment variable not set');
  }
  
  try {
    const sql = neon(config.databaseUrl);
    
    // Run multiple concurrent queries
    const startTime = Date.now();
    const operations = [
      sql`SELECT COUNT(*) as count FROM hex_stake_starts`,
      sql`SELECT COUNT(*) as count FROM pulsechain_stake_starts`,
      sql`SELECT COUNT(*) as count FROM hex_global_info`,
      sql`SELECT MAX(stake_id) as max_id FROM hex_stake_starts`,
      sql`SELECT MAX(stake_id) as max_id FROM pulsechain_stake_starts`
    ];
    
    const results = await Promise.all(operations);
    const duration = Date.now() - startTime;
    
    logVerbose(`Concurrent operations completed in ${duration}ms`);
    
    // All operations should succeed
    return results.length === 5 && results.every(result => result && result.length > 0);
  } catch (error) {
    throw new Error(`Concurrent operations test failed: ${error.message}`);
  }
};

// Main test execution
const runAllTests = async () => {
  log('🚀 Starting Database Integration Test Suite...');
  log(`Database URL: ${config.databaseUrl ? 'Set' : 'Not set'}`);
  log(`Verbose mode: ${config.verbose ? 'Enabled' : 'Disabled'}`);
  log(`Test timeout: ${config.timeout}ms`);
  log('');
  
  const tests = [
    { name: 'Database Connection', fn: testDatabaseConnection },
    { name: 'Database Schema Validation', fn: testDatabaseSchema },
    { name: 'Data Retrieval Performance', fn: testDataRetrievalPerformance },
    { name: 'Data Integrity', fn: testDataIntegrity },
    { name: 'Concurrent Operations', fn: testConcurrentOperations }
  ];
  
  for (const test of tests) {
    await runTest(test.name, test.fn);
    log(''); // Add spacing between tests
  }
  
  // Print summary
  log('📊 Test Results Summary');
  log(`Total Tests: ${testResults.total}`);
  log(`Passed: ${testResults.passed}`, 'success');
  log(`Failed: ${testResults.failed}`, testResults.failed > 0 ? 'error' : 'success');
  log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  
  // Print detailed results
  if (config.verbose) {
    log('');
    log('📋 Detailed Results:');
    testResults.details.forEach(result => {
      const statusIcon = result.status === 'PASSED' ? '✅' : '❌';
      log(`${statusIcon} ${result.name}: ${result.status} (${result.duration}ms)`, 
           result.status === 'PASSED' ? 'success' : 'error');
      if (result.error) {
        log(`   Error: ${result.error}`, 'error');
      }
    });
  }
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
};

// Handle process termination
process.on('SIGINT', () => {
  log('Test interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  log('Test terminated');
  process.exit(1);
});

// Run tests with timeout
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error(`Test suite timed out after ${config.testTimeout}ms`)), config.testTimeout);
});

Promise.race([runAllTests(), timeoutPromise])
  .catch(error => {
    log(`Test suite failed: ${error.message}`, 'error');
    process.exit(1);
  });
