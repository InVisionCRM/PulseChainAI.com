'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMoralis } from '@/lib/hooks/useMoralis';
import { moralisService } from '@/services/moralisService';

export default function TestMoralisPage() {
  const [testResults, setTestResults] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const { isInitialized, isLoading, error } = useMoralis();

  const runTests = async () => {
    if (!isInitialized) {
      return;
    }

    setIsTesting(true);
    setTestResults(null);

    try {
      const results = {
        search: null,
        tokenMetadata: null,
        nativeBalance: null,
      };

      // Test token search
      try {
        results.search = await moralisService.searchTokens('SHIB');
      } catch (error) {
        results.search = { error: error instanceof Error ? error.message : 'Unknown error' };
      }

      // Test token metadata
      try {
        results.tokenMetadata = await moralisService.getTokenMetadata('0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE');
      } catch (error) {
        results.tokenMetadata = { error: error instanceof Error ? error.message : 'Unknown error' };
      }

      // Test native balance
      try {
        results.nativeBalance = await moralisService.getNativeBalance('0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE');
      } catch (error) {
        results.nativeBalance = { error: error instanceof Error ? error.message : 'Unknown error' };
      }

      setTestResults(results);
    } catch (error) {
      setTestResults({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-4xl font-bold text-white mb-4">Moralis Integration Test</h1>
          <p className="text-gray-300 text-lg">
            Test the Moralis SDK integration with PulseChain
          </p>
        </motion.div>

        {/* Status Display */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 rounded-lg p-6 border border-white/10"
        >
          <h2 className="text-xl font-semibold text-white mb-4">Moralis Status</h2>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isInitialized ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-white">
                Status: {isInitialized ? 'Initialized' : 'Not Initialized'}
              </span>
            </div>
            {isLoading && (
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-yellow-300">Loading...</span>
              </div>
            )}
            {error && (
              <div className="text-red-300 text-sm">{error}</div>
            )}
          </div>
        </motion.div>

        {/* Test Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 rounded-lg p-6 border border-white/10"
        >
          <h2 className="text-xl font-semibold text-white mb-4">Test Controls</h2>
          <div className="space-y-4">
            <button
              onClick={runTests}
              disabled={isTesting || !isInitialized}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
            >
              {isTesting ? 'Running Tests...' : 'Run Moralis Tests'}
            </button>
          </div>
        </motion.div>

        {/* Test Results */}
        {testResults && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/5 rounded-lg p-6 border border-white/10"
          >
            <h2 className="text-xl font-semibold text-white mb-4">Test Results</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-white mb-2">Token Search</h3>
                <pre className="bg-black/20 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto">
                  {JSON.stringify(testResults.search, null, 2)}
                </pre>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-white mb-2">Token Metadata</h3>
                <pre className="bg-black/20 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto">
                  {JSON.stringify(testResults.tokenMetadata, null, 2)}
                </pre>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-white mb-2">Native Balance</h3>
                <pre className="bg-black/20 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto">
                  {JSON.stringify(testResults.nativeBalance, null, 2)}
                </pre>
              </div>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
} 