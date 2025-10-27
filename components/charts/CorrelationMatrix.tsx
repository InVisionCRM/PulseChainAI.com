'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface TokenData {
  symbol: string;
  address: string;
  holders: Array<{ address: string; value: string }>;
  marketCap?: number;
  volume?: number;
}

interface CorrelationMatrixProps {
  tokens: TokenData[];
  className?: string;
}

const CorrelationMatrix: React.FC<CorrelationMatrixProps> = ({
  tokens,
  className = ''
}) => {
  if (!tokens || tokens.length < 2) {
    return (
      <div className={`bg-slate-800/30 rounded-lg p-4 border border-slate-700/50 ${className}`}>
        <p className="text-slate-400 text-center">Need at least 2 tokens for correlation analysis</p>
      </div>
    );
  }

  // Calculate holder overlap correlations
  const calculateCorrelation = (token1: TokenData, token2: TokenData): number => {
    const holders1 = new Set(token1.holders.map(h => h.address));
    const holders2 = new Set(token2.holders.map(h => h.address));
    
    const intersection = new Set([...holders1].filter(x => holders2.has(x)));
    const union = new Set([...holders1, ...holders2]);
    
    return intersection.size / union.size;
  };

  // Calculate all correlations
  const correlations: Array<{ token1: string; token2: string; correlation: number }> = [];
  
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const correlation = calculateCorrelation(tokens[i], tokens[j]);
      correlations.push({
        token1: tokens[i].symbol,
        token2: tokens[j].symbol,
        correlation
      });
    }
  }

  // Sort by correlation strength
  correlations.sort((a, b) => b.correlation - a.correlation);

  // Calculate average correlation
  const avgCorrelation = correlations.reduce((sum, c) => sum + c.correlation, 0) / correlations.length;

  // Get correlation strength label and color
  const getCorrelationInfo = (correlation: number) => {
    if (correlation >= 0.7) return { label: 'Strong', color: 'text-green-400', bgColor: 'bg-green-500' };
    if (correlation >= 0.4) return { label: 'Moderate', color: 'text-yellow-400', bgColor: 'bg-yellow-500' };
    if (correlation >= 0.2) return { label: 'Weak', color: 'text-orange-400', bgColor: 'bg-orange-500' };
    return { label: 'None', color: 'text-red-400', bgColor: 'bg-red-500' };
  };

  return (
    <div className={`bg-slate-800/30 rounded-lg p-4 border border-slate-700/50 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-4">Token Correlation Matrix</h3>
      
      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-700/30 rounded-lg p-3 text-center"
        >
          <div className="text-2xl font-bold text-blue-400">{tokens.length}</div>
          <div className="text-xs text-slate-400">Tokens Analyzed</div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-700/30 rounded-lg p-3 text-center"
        >
          <div className="text-2xl font-bold text-blue-400">{correlations.length}</div>
          <div className="text-xs text-slate-400">Correlations</div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-700/30 rounded-lg p-3 text-center"
        >
          <div className="text-2xl font-bold text-green-400">{(avgCorrelation * 100).toFixed(1)}%</div>
          <div className="text-xs text-slate-400">Avg Correlation</div>
        </motion.div>
      </div>

      {/* Correlation Matrix Grid */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-white mb-3">Correlation Matrix</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {correlations.map((correlation, index) => {
            const info = getCorrelationInfo(correlation.correlation);
            return (
              <motion.div
                key={`${correlation.token1}-${correlation.token2}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-semibold text-white">{correlation.token1}</span>
                  </div>
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-semibold text-white">{correlation.token2}</span>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-sm font-bold ${info.color}`}>
                    {(correlation.correlation * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-slate-400">{info.label}</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Correlation Strength Legend */}
      <div>
        <h4 className="text-sm font-semibold text-white mb-3">Correlation Strength</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Strong', min: 0.7, color: 'text-green-400', bgColor: 'bg-green-500' },
            { label: 'Moderate', min: 0.4, color: 'text-yellow-400', bgColor: 'bg-yellow-500' },
            { label: 'Weak', min: 0.2, color: 'text-orange-400', bgColor: 'bg-orange-500' },
            { label: 'None', min: 0, color: 'text-red-400', bgColor: 'bg-red-500' }
          ].map((level, index) => (
            <motion.div
              key={level.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-2"
            >
              <div className={`w-3 h-3 rounded-full ${level.bgColor}`}></div>
              <div>
                <div className={`text-sm font-semibold ${level.color}`}>{level.label}</div>
                <div className="text-xs text-slate-400">≥{(level.min * 100).toFixed(0)}%</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Insights */}
      {correlations.length > 0 && (
        <div className="mt-6 p-3 bg-slate-700/20 rounded-lg border border-slate-600/30">
          <h4 className="text-sm font-semibold text-white mb-2">Key Insights</h4>
          <div className="space-y-1 text-xs text-slate-300">
            <div>• Highest correlation: {correlations[0].token1} ↔ {correlations[0].token2} ({(correlations[0].correlation * 100).toFixed(1)}%)</div>
            <div>• Lowest correlation: {correlations[correlations.length - 1].token1} ↔ {correlations[correlations.length - 1].token2} ({(correlations[correlations.length - 1].correlation * 100).toFixed(1)}%)</div>
            <div>• {correlations.filter(c => c.correlation >= 0.7).length} strong correlations detected</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorrelationMatrix; 