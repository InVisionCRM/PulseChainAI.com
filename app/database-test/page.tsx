"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Database, Server, Wifi, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error' | 'skipped';
  message: string;
  duration?: number;
  details?: any;
}

interface DatabaseTestData {
  ethereum: any;
  pulsechain: any;
  timestamp: string;
}

const DatabaseTestPage = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [databaseStatus, setDatabaseStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const [isDatabaseAvailable, setIsDatabaseAvailable] = useState<boolean>(false);
  const [testData, setTestData] = useState<DatabaseTestData | null>(null);
  const [dataFlowStatus, setDataFlowStatus] = useState<{
    ethereum: 'database' | 'graphql' | 'transitioning' | 'error';
    pulsechain: 'database' | 'graphql' | 'transitioning' | 'error';
  }>({
    ethereum: 'transitioning',
    pulsechain: 'transitioning'
  });

  // Initialize test results
  useEffect(() => {
    const initialTests: TestResult[] = [
      { name: 'Database Connection Test', status: 'pending', message: 'Waiting to start...' },
      { name: 'Database Schema Validation', status: 'pending', message: 'Waiting to start...' },
      { name: 'Ethereum Data Loading Test', status: 'pending', message: 'Waiting to start...' },
      { name: 'PulseChain Data Loading Test', status: 'pending', message: 'Waiting to start...' },
      { name: 'GraphQL Fallback Test', status: 'pending', message: 'Waiting to start...' },
      { name: 'Data Flow Transition Test', status: 'pending', message: 'Waiting to start...' },
      { name: 'Error Handling Test', status: 'pending', message: 'Waiting to start...' },
      { name: 'Performance Benchmark Test', status: 'pending', message: 'Waiting to start...' }
    ];
    setTestResults(initialTests);
  }, []);

  // Check database availability
  const checkDatabaseStatus = useCallback(async () => {
    setDatabaseStatus('checking');
    try {
      const { databaseStatus } = await import('@/lib/db/databaseStatus');
      const isAvailable = await databaseStatus.checkAvailability();
      setIsDatabaseAvailable(isAvailable);
      setDatabaseStatus(isAvailable ? 'available' : 'unavailable');
      return isAvailable;
    } catch (error) {
      console.error('Database status check failed:', error);
      setIsDatabaseAvailable(false);
      setDatabaseStatus('unavailable');
      return false;
    }
  }, []);

  // Update test result
  const updateTestResult = useCallback((testName: string, status: TestResult['status'], message: string, details?: any) => {
    setTestResults(prev => prev.map(test => 
      test.name === testName 
        ? { ...test, status, message, details }
        : test
    ));
  }, []);

  // Test 1: Database Connection
  const testDatabaseConnection = async (): Promise<boolean> => {
    const startTime = Date.now();
    try {
      const response = await fetch('/api/database-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType: 'connection' })
      });
      
      const result = await response.json();
      const duration = Date.now() - startTime;
      
      if (result.success) {
        updateTestResult('Database Connection Test', 'success', result.message, { duration, ...result.details });
        return true;
      } else {
        updateTestResult('Database Connection Test', 'error', result.message, { duration, error: result.error });
        return false;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTestResult('Database Connection Test', 'error', `❌ Database connection error: ${error}`, { duration, error });
      return false;
    }
  };

  // Test 2: Database Schema Validation
  const testDatabaseSchema = async (): Promise<boolean> => {
    const startTime = Date.now();
    try {
      const response = await fetch('/api/database-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType: 'schema' })
      });
      
      const result = await response.json();
      const duration = Date.now() - startTime;
      
      if (result.success) {
        updateTestResult('Database Schema Validation', 'success', result.message, { duration, ...result.details });
        return true;
      } else {
        updateTestResult('Database Schema Validation', 'error', result.message, { duration, error: result.error });
        return false;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTestResult('Database Schema Validation', 'error', `❌ Schema validation error: ${error}`, { duration, error });
      return false;
    }
  };

  // Test 3: Ethereum Data Loading
  const testEthereumDataLoading = async (): Promise<boolean> => {
    const startTime = Date.now();
    try {
      const response = await fetch('/api/database-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType: 'ethereum-data' })
      });
      
      const result = await response.json();
      const duration = Date.now() - startTime;
      
      if (result.success) {
        updateTestResult('Ethereum Data Loading Test', 'success', result.message, { duration, ...result.details });
        setDataFlowStatus(prev => ({ ...prev, ethereum: 'database' }));
        return true;
      } else {
        updateTestResult('Ethereum Data Loading Test', 'error', result.message, { duration, error: result.error });
        return false;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTestResult('Ethereum Data Loading Test', 'error', `❌ Ethereum data loading error: ${error}`, { duration, error });
      return false;
    }
  };

  // Test 4: PulseChain Data Loading
  const testPulsechainDataLoading = async (): Promise<boolean> => {
    const startTime = Date.now();
    try {
      const response = await fetch('/api/database-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType: 'pulsechain-data' })
      });
      
      const result = await response.json();
      const duration = Date.now() - startTime;
      
      if (result.success) {
        updateTestResult('PulseChain Data Loading Test', 'success', result.message, { duration, ...result.details });
        setDataFlowStatus(prev => ({ ...prev, pulsechain: 'database' }));
        return true;
      } else {
        updateTestResult('PulseChain Data Loading Test', 'error', result.message, { duration, error: result.error });
        return false;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTestResult('PulseChain Data Loading Test', 'error', `❌ PulseChain data loading error: ${error}`, { duration, error });
      return false;
    }
  };

  // Test 5: GraphQL Fallback Test
  const testGraphQLFallback = async (): Promise<boolean> => {
    const startTime = Date.now();
    try {
      const { hexStakingService } = await import('@/services/hexStakingService');
      const { pulsechainHexStakingService } = await import('@/services/pulsechainHexStakingService');
      
      const [ethereumData, pulsechainData] = await Promise.all([
        hexStakingService.getStakingMetrics(),
        pulsechainHexStakingService.getStakingMetrics()
      ]);
      
      const duration = Date.now() - startTime;
      
      if (ethereumData && pulsechainData) {
        updateTestResult('GraphQL Fallback Test', 'success', `✅ GraphQL fallback successful (${duration}ms)`, { 
          duration,
          ethereumStakes: ethereumData.totalActiveStakes,
          pulsechainStakes: pulsechainData.totalActiveStakes
        });
        return true;
      } else {
        updateTestResult('GraphQL Fallback Test', 'error', '❌ GraphQL fallback failed - incomplete data', { duration });
        return false;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTestResult('GraphQL Fallback Test', 'error', `❌ GraphQL fallback error: ${error}`, { duration, error });
      return false;
    }
  };

  // Test 6: Data Flow Transition Test
  const testDataFlowTransition = async (): Promise<boolean> => {
    const startTime = Date.now();
    try {
      // Simulate transition from GraphQL to database
      setDataFlowStatus(prev => ({ ...prev, ethereum: 'transitioning', pulsechain: 'transitioning' }));
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate transition time
      
      // Test database loading after transition using API
      const response = await fetch('/api/database-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType: 'data-flow-transition' })
      });
      
      const result = await response.json();
      const duration = Date.now() - startTime;
      
      if (result.success) {
        setDataFlowStatus(prev => ({ ...prev, ethereum: 'database', pulsechain: 'database' }));
        updateTestResult('Data Flow Transition Test', 'success', result.message, { duration, ...result.details });
        return true;
      } else {
        updateTestResult('Data Flow Transition Test', 'error', result.message, { duration, error: result.error });
        return false;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTestResult('Data Flow Transition Test', 'error', `❌ Data flow transition error: ${error}`, { duration, error });
      return false;
    }
  };

  // Test 7: Error Handling Test
  const testErrorHandling = async (): Promise<boolean> => {
    const startTime = Date.now();
    try {
      // Test with invalid network parameter using API
      const response = await fetch('/api/database-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType: 'invalid-test' }) // This should trigger an error
      });
      
      const result = await response.json();
      const duration = Date.now() - startTime;
      
      if (result.error) {
        // Expected error occurred
        updateTestResult('Error Handling Test', 'success', `✅ Error handling successful (${duration}ms)`, { 
          duration,
          errorType: 'API Error',
          errorMessage: result.error
        });
        return true;
      } else {
        updateTestResult('Error Handling Test', 'error', '❌ Error handling failed - should have thrown error', { duration });
        return false;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTestResult('Error Handling Test', 'success', `✅ Error handling successful (${duration}ms)`, { 
        duration,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      return true;
    }
  };

  // Test 8: Performance Benchmark Test
  const testPerformanceBenchmark = async (): Promise<boolean> => {
    const startTime = Date.now();
    try {
      const response = await fetch('/api/database-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          testType: 'performance-benchmark',
          params: { maxRecords: 1000 }
        })
      });
      
      const result = await response.json();
      const duration = Date.now() - startTime;
      
      if (result.success) {
        updateTestResult('Performance Benchmark Test', 'success', result.message, { duration, ...result.details });
        return true;
      } else {
        updateTestResult('Performance Benchmark Test', 'error', result.message, { duration, error: result.error });
        return false;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTestResult('Performance Benchmark Test', 'error', `❌ Performance benchmark error: ${error}`, { duration, error });
      return false;
    }
  };

  // Run all tests
  const runAllTests = async () => {
    setIsRunningTests(true);
    setTestResults(prev => prev.map(test => ({ ...test, status: 'pending', message: 'Running...' })));
    
    try {
      // Check database status first
      const dbAvailable = await checkDatabaseStatus();
      
      // Run tests sequentially
      await testDatabaseConnection();
      await testDatabaseSchema();
      await testEthereumDataLoading();
      await testPulsechainDataLoading();
      await testGraphQLFallback();
      await testDataFlowTransition();
      await testErrorHandling();
      await testPerformanceBenchmark();
      
      // Collect test data for display
      if (dbAvailable) {
        try {
          const [ethereumResponse, pulsechainResponse] = await Promise.all([
            fetch('/api/database-test', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ testType: 'ethereum-data' })
            }),
            fetch('/api/database-test', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ testType: 'pulsechain-data' })
            })
          ]);
          
          const ethereumResult = await ethereumResponse.json();
          const pulsechainResult = await pulsechainResponse.json();
          
          if (ethereumResult.success && pulsechainResult.success) {
            setTestData({
              ethereum: ethereumResult.details,
              pulsechain: pulsechainResult.details,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.warn('Could not collect test data:', error);
        }
      }
      
    } catch (error) {
      console.error('Test suite failed:', error);
    } finally {
      setIsRunningTests(false);
    }
  };

  // Get test summary
  const getTestSummary = () => {
    const total = testResults.length;
    const passed = testResults.filter(t => t.status === 'success').length;
    const failed = testResults.filter(t => t.status === 'error').length;
    const skipped = testResults.filter(t => t.status === 'skipped').length;
    
    return { total, passed, failed, skipped };
  };

  const summary = getTestSummary();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Database Integration Test Suite
          </h1>
          <p className="text-lg text-gray-300">
            Comprehensive testing of HEX dashboard database integration features
          </p>
        </div>

        {/* Database Status */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Database className="w-6 h-6" />
            Database Status
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${
                databaseStatus === 'checking' ? 'bg-yellow-500 animate-pulse' :
                databaseStatus === 'available' ? 'bg-green-500' :
                'bg-red-500'
              }`}></div>
              <div className="text-sm text-gray-400">Status</div>
              <div className="font-semibold">
                {databaseStatus === 'checking' ? 'Checking...' :
                 databaseStatus === 'available' ? 'Available' :
                 'Unavailable'}
              </div>
            </div>
            
            <div className="text-center">
              <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${
                isDatabaseAvailable ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <div className="text-sm text-gray-400">Availability</div>
              <div className="font-semibold">
                {isDatabaseAvailable ? 'Yes' : 'No'}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-sm text-gray-400">Data Flow</div>
              <div className="flex justify-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${
                  dataFlowStatus.ethereum === 'database' ? 'bg-green-500' :
                  dataFlowStatus.ethereum === 'graphql' ? 'bg-blue-500' :
                  dataFlowStatus.ethereum === 'transitioning' ? 'bg-yellow-500 animate-pulse' :
                  'bg-red-500'
                }`}></div>
                <span className="text-xs">ETH</span>
                <div className={`w-2 h-2 rounded-full ${
                  dataFlowStatus.pulsechain === 'database' ? 'bg-green-500' :
                  dataFlowStatus.pulsechain === 'graphql' ? 'bg-blue-500' :
                  dataFlowStatus.pulsechain === 'transitioning' ? 'bg-yellow-500 animate-pulse' :
                  'bg-red-500'
                }`}></div>
                <span className="text-xs">PLS</span>
              </div>
            </div>
          </div>
        </div>

        {/* Test Controls */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Server className="w-6 h-6" />
              Test Controls
            </h2>
            <button
              onClick={runAllTests}
              disabled={isRunningTests}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-all duration-200 flex items-center gap-2"
            >
              {isRunningTests ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Run All Tests
                </>
              )}
            </button>
          </div>
          
          {/* Test Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">{summary.total}</div>
              <div className="text-sm text-gray-400">Total Tests</div>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <div className="text-2xl font-bold text-green-400">{summary.passed}</div>
              <div className="text-sm text-gray-400">Passed</div>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <div className="text-2xl font-bold text-red-400">{summary.failed}</div>
              <div className="text-sm text-gray-400">Failed</div>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <div className="text-2xl font-bold text-yellow-400">{summary.skipped}</div>
              <div className="text-sm text-gray-400">Skipped</div>
            </div>
          </div>
        </div>

        {/* Test Results */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="w-6 h-6" />
            Test Results
          </h2>
          <div className="space-y-4">
            {testResults.map((test, index) => (
              <div key={index} className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {test.status === 'pending' && <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />}
                    {test.status === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
                    {test.status === 'error' && <XCircle className="w-5 h-5 text-red-400" />}
                    {test.status === 'skipped' && <AlertCircle className="w-5 h-5 text-gray-400" />}
                    <span className="font-semibold">{test.name}</span>
                  </div>
                  <div className={`text-sm px-2 py-1 rounded-full ${
                    test.status === 'success' ? 'bg-green-500/20 text-green-400' :
                    test.status === 'error' ? 'bg-red-500/20 text-red-400' :
                    test.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {test.status.toUpperCase()}
                  </div>
                </div>
                <div className="text-gray-300">{test.message}</div>
                {test.details && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-gray-400 hover:text-white">
                      View Details
                    </summary>
                    <pre className="mt-2 text-xs bg-black/20 p-3 rounded overflow-auto">
                      {JSON.stringify(test.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Test Data Display */}
        {testData && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <Wifi className="w-6 h-6" />
              Test Data Sample
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-3 text-blue-400">Ethereum Data</h3>
                <div className="bg-black/20 p-4 rounded-lg">
                  <div className="text-sm">
                    <div><strong>Total Active Stakes:</strong> {testData.ethereum?.totalActiveStakes || 'N/A'}</div>
                    <div><strong>Total Staked Hearts:</strong> {testData.ethereum?.totalStakedHearts || 'N/A'}</div>
                    <div><strong>Average Stake Length:</strong> {testData.ethereum?.averageStakeLength || 'N/A'} days</div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3 text-purple-400">PulseChain Data</h3>
                <div className="bg-black/20 p-4 rounded-lg">
                  <div className="text-sm">
                    <div><strong>Total Active Stakes:</strong> {testData.pulsechain?.totalActiveStakes || 'N/A'}</div>
                    <div><strong>Total Staked Hearts:</strong> {testData.pulsechain?.totalStakedHearts || 'N/A'}</div>
                    <div><strong>Average Stake Length:</strong> {testData.pulsechain?.averageStakeLength || 'N/A'} days</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 text-center text-sm text-gray-400">
              Last updated: {new Date(testData.timestamp).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DatabaseTestPage;
