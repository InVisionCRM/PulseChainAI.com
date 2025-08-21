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
    <div className="flex flex-col sm:flex-row gap-2">
      <button
        onClick={fetchData}
        disabled={isLoading}
        className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-bold py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg flex items-center gap-2 text-xs sm:text-sm"
      >
        <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${isLoading ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline">Refresh Data</span>
        <span className="sm:hidden">Refresh</span>
      </button>
      <button
        onClick={() => setShowGeminiAnalysis(!showGeminiAnalysis)}
        className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg flex items-center gap-2 text-xs sm:text-sm"
      >
        <Brain className="w-3 h-3 sm:w-4 sm:h-4" />
        <span className="hidden sm:inline">{showGeminiAnalysis ? 'Hide' : 'Show'} AI Analysis</span>
        <span className="sm:hidden">AI</span>
      </button>
      <button
        onClick={() => {
          setShowDexPairs(true);
          void loadDexPairs();
        }}
        className="bg-white/10 hover:bg-white/20 text-white font-bold py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg border border-white/20 text-xs sm:text-sm"
        title="View PulseChain HEX liquidity pairs (DexScreener)"
      >
        <span className="hidden sm:inline">View HEX Pairs (PLS)</span>
        <span className="sm:hidden">Pairs</span>
      </button>
    </div>
  );
};

export default DashboardActions;