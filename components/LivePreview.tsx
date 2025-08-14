'use client';

import { motion } from 'motion/react';
import { StatCounterConfig } from './StatCounterBuilder';

interface LivePreviewProps {
  config: StatCounterConfig;
  statResults: Record<string, unknown>;
}

export default function LivePreview({ config, statResults }: LivePreviewProps) {

  if (!config.token) {
    return (
      <div className="rounded-lg p-4 border text-center bg-gray-800 text-white">
        <div className="text-6xl mb-4">📊</div>
        <h2 className="text-xl font-semibold mb-4 text-blue-400">
          Live Preview
        </h2>
        <p className="mb-6 text-gray-300">
          Select a token to see your stat counter preview
        </p>
        <div className="rounded-lg p-4 bg-gray-700">
          <p className="text-sm text-gray-300">
            Open the sidebar to start building your stat counter
          </p>
        </div>
      </div>
    );
  }

  const enabledStats = config.stats.filter(stat => stat.enabled);
  
  if (enabledStats.length === 0) {
    return (
      <div className="rounded-lg p-4 border border-gray-600 bg-gray-800 text-white text-center">
        <div className="text-6xl mb-4">⚙️</div>
        <h2 className="text-xl font-semibold mb-4 text-blue-400">
          Configure Stats
        </h2>
        <p className="mb-6 text-gray-300">
          Select which statistics to display for {config.token.symbol}
        </p>
        <div className="rounded-lg p-4 border border-gray-600 bg-gray-700">
          <p className="text-sm text-gray-300">
            Choose stats in the sidebar to see them here
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg p-4 border bg-gray-800 text-white"
    >
      {/* Token Header */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold mb-2 text-blue-400">
          {config.token.name} ({config.token.symbol})
        </h2>
        <p className="text-sm text-gray-300">
          {config.token.address.slice(0, 6)}...{config.token.address.slice(-4)}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {enabledStats.map((stat, index) => (
          <motion.div
            key={stat.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="rounded-lg p-4 border bg-gray-700 text-center"
          >
            <div className="text-center">
              <h3 className="text-sm font-medium mb-2 text-gray-300">
                {stat.label}
              </h3>
              <div className="text-lg font-bold text-blue-400">
                {getStatDisplayValue(stat, config, statResults)}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Last Updated */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-400">
          Last updated: {new Date().toLocaleTimeString()}
        </p>
      </div>
    </motion.div>
  );
}

function getStatDisplayValue(stat: StatConfig, config: StatCounterConfig, statResults: Record<string, unknown>): string {
  // Use real data from statResults if available
  const result = statResults[stat.id];
  if (result && result.formattedValue) {
    return result.formattedValue;
  }
  
  // Fallback to placeholder values
  switch (stat.id) {
    case 'holders':
      return '1,234';
    case 'burnedTokensDead':
      return '5,678';
    case 'burnedTokens369':
      return '9,012';
    case 'tokensBurned':
      return '14,690';
    case 'price':
      return '$0.001234';
    case 'marketCap':
      return '$123,456';
    default:
      return 'N/A';
  }
} 