'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import TokenSelector from './TokenSelector';
import StatSelector from './StatSelector';
import CodeGenerator from './CodeGenerator';
import { StatCounterConfig, TokenData, StatConfig } from './StatCounterBuilder';

interface SidebarBuilderProps {
  onConfigChange: (config: StatCounterConfig) => void;
  onStatResultsChange: (results: Record<string, any>) => void;
}

export default function SidebarBuilder({ onConfigChange, onStatResultsChange }: SidebarBuilderProps) {
  const [config, setConfig] = useState<StatCounterConfig>({
    token: null,
    stats: [],
  });

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [moralisLoading, setMoralisLoading] = useState(false);
  const [moralisError, setMoralisError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Simulate initialization
    const timer = setTimeout(() => {
      setIsInitialized(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    onConfigChange(config);
  }, [config, onConfigChange]);

  const updateToken = (token: TokenData | null) => {
    setConfig(prev => ({ ...prev, token }));
  };

  const updateStats = (stats: StatConfig[]) => {
    setConfig(prev => ({ ...prev, stats }));
  };



  if (!isInitialized) {
    return (
      <div className="space-y-4">
        <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="w-4 h-4 border-2 border-blue-300 border-t-slate-950 rounded-full animate-spin"></div>
            <p className="text-blue-300 text-sm">
              Initializing builder...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Token Selection */}
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">Token Selection</h3>
        <TokenSelector
          selectedToken={config.token}
          onTokenSelect={updateToken}
          onError={setError}
          isLoading={isLoading || moralisLoading}
        />
      </div>

      {/* Statistics Selection */}
      {config.token && (
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Statistics</h3>
          <StatSelector
            token={config.token}
            onStatsChange={updateStats}
            onStatResultsChange={onStatResultsChange}
            onError={setError}
          />
        </div>
      )}

      {/* Code Generator */}
      {config.token && config.stats.some(stat => stat.enabled) && (
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Code Generator</h3>
          <CodeGenerator
            config={config}
            onError={setError}
          />
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
} 