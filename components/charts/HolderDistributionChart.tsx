'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface Holder {
  address: string;
  value: string;
  token_id?: string;
}

interface HolderDistributionChartProps {
  holders: Holder[];
  tokenSymbol?: string;
  className?: string;
}

const HolderDistributionChart: React.FC<HolderDistributionChartProps> = ({
  holders,
  tokenSymbol = 'TOKEN',
  className = ''
}) => {
  if (!holders || holders.length === 0) {
    return (
      <div className={`bg-slate-800/30 rounded-lg p-4 border border-slate-700/50 ${className}`}>
        <p className="text-slate-400 text-center">No holder data available</p>
      </div>
    );
  }

  // Calculate distribution buckets
  const values = holders.map(h => parseFloat(h.value));
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  
  // Create distribution buckets
  const buckets = [
    { name: 'Whales', min: maxValue * 0.01, color: 'bg-purple-500' },
    { name: 'Large', min: maxValue * 0.001, color: 'bg-blue-500' },
    { name: 'Medium', min: maxValue * 0.0001, color: 'bg-green-500' },
    { name: 'Small', min: 0, color: 'bg-yellow-500' }
  ];

  const distribution = buckets.map(bucket => {
    const count = values.filter(v => v >= bucket.min).length;
    const percentage = (count / holders.length) * 100;
    return { ...bucket, count, percentage };
  });

  // Top 10 holders
  const topHolders = holders
    .sort((a, b) => parseFloat(b.value) - parseFloat(a.value))
    .slice(0, 20);

  return (
    <div className={`bg-slate-800/30 rounded-lg p-4 border border-slate-700/50 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-4">Holder Distribution - {tokenSymbol}</h3>
      
      {/* Distribution Chart */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Distribution by Size</span>
          <span className="text-sm text-slate-400">{holders.length} total holders</span>
        </div>
        
        <div className="space-y-3">
          {distribution.map((bucket, index) => (
            <motion.div
              key={bucket.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-3"
            >
              <div className="flex items-center gap-2 min-w-16">
                <div className={`w-3 h-3 rounded-full ${bucket.color}`}></div>
                <span className="text-sm text-slate-300">{bucket.name}</span>
              </div>
              
              <div className="flex-1 bg-slate-700 rounded-full h-3 overflow-hidden">
                <motion.div
                  className={`h-full ${bucket.color}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${bucket.percentage}%` }}
                  transition={{ delay: index * 0.1 + 0.2, duration: 0.8 }}
                />
              </div>
              
              <div className="text-right min-w-20">
                <div className="text-sm font-semibold text-white">{bucket.count}</div>
                <div className="text-xs text-slate-400">{bucket.percentage.toFixed(1)}%</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Top Holders Table */}
      <div>
        <h4 className="text-sm font-semibold text-white mb-3">Top 10 Holders</h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {topHolders.map((holder, index) => (
            <motion.div
              key={holder.address}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center justify-between p-2 bg-slate-700/30 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-slate-600 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-white">{index + 1}</span>
                </div>
                <div>
                  <div className="text-sm text-slate-300 font-mono">
                    {holder.address.substring(0, 6)}...{holder.address.substring(holder.address.length - 4)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {parseFloat(holder.value).toLocaleString()} {tokenSymbol}
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm font-semibold text-white">
                  {((parseFloat(holder.value) / maxValue) * 100).toFixed(2)}%
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HolderDistributionChart; 