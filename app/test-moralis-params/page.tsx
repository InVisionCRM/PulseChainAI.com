'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { useMoralis } from '@/lib/hooks/useMoralis';
import Moralis from 'moralis';

export default function TestMoralisParamsPage() {
  const [testResults, setTestResults] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const { isInitialized, isLoading, error } = useMoralis();

  const testMoralisParams = async () => {
    if (!isInitialized) {
      return;
    }

    setIsTesting(true);
    setTestResults(null);

    try {
      const results = {
        getTokenMetadata: null,
        getTokenPrice: null,
        getTokenStats: null,
      };

      // Test getTokenMetadata with different parameter names
      try {
        console.log('Testing getTokenMetadata with addresses parameter...');
        const metadataResponse = await Moralis.EvmApi.token.getTokenMetadata({
          addresses: ['0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE'],
          chain: '0x171',
        });
        results.getTokenMetadata = { success: true, data: metadataResponse.result };
      } catch (error) {
        results.getTokenMetadata = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }

      // Test getTokenPrice
      try {
        console.log('Testing getTokenPrice...');
        const priceResponse = await Moralis.EvmApi.token.getTokenPrice({
          address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
          chain: '0x171',
        });
        results.getTokenPrice = { success: true, data: priceResponse.result };
      } catch (error) {
        results.getTokenPrice = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }

      // Test getTokenStats
      try {
        console.log('Testing getTokenStats...');
        const statsResponse = await Moralis.EvmApi.token.getTokenStats({
          address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
          chain: '0x171',
        });
        results.getTokenStats = { success: true, data: statsResponse.result };
      } catch (error) {
        results.getTokenStats = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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
          <h1 className="text-4xl font-bold text-white mb-4">Moralis API Parameters Test</h1>
          <p className="text-gray-300 text-lg">
            Test the correct parameter names for Moralis API calls
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
              onClick={testMoralisParams}
              disabled={isTesting || !isInitialized}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors"
            >
              {isTesting ? 'Testing...' : 'Test Moralis API Parameters'}
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
                <h3 className="text-lg font-medium text-white mb-2">getTokenMetadata</h3>
                <pre className="bg-black/20 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto">
                  {JSON.stringify(testResults.getTokenMetadata, null, 2)}
                </pre>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-white mb-2">getTokenPrice</h3>
                <pre className="bg-black/20 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto">
                  {JSON.stringify(testResults.getTokenPrice, null, 2)}
                </pre>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-white mb-2">getTokenStats</h3>
                <pre className="bg-black/20 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto">
                  {JSON.stringify(testResults.getTokenStats, null, 2)}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
} 