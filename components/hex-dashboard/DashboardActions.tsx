import React from 'react';
import { RefreshCw, Brain } from 'lucide-react';
import type { DashboardActionsProps } from './types';

const DashboardActions: React.FC<DashboardActionsProps> = ({
  fetchData,
  isLoading,
  showGeminiAnalysis,
  setShowGeminiAnalysis,
  setShowDexPairs,
  loadDexPairs,
}) => {
  return (
    <div className="flex gap-2">
      <button
        onClick={fetchData}
        disabled={isLoading}
        className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"
      >
        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        Refresh Data
      </button>
      <button
        onClick={() => setShowGeminiAnalysis(!showGeminiAnalysis)}
        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2"
      >
        <Brain className="w-4 h-4" />
        {showGeminiAnalysis ? 'Hide' : 'Show'} AI Analysis
      </button>
      <button
        onClick={() => {
          setShowDexPairs(true);
          void loadDexPairs();
        }}
        className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded-lg border border-white/20"
        title="View PulseChain HEX liquidity pairs (DexScreener)"
      >
        View HEX Pairs (PLS)
      </button>
    </div>
  );
};

export default DashboardActions;