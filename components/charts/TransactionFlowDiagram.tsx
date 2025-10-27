'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface Transfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: string;
  token_symbol?: string;
}

interface TransactionFlowDiagramProps {
  transfers: Transfer[];
  tokenSymbol?: string;
  className?: string;
}

const TransactionFlowDiagram: React.FC<TransactionFlowDiagramProps> = ({
  transfers,
  tokenSymbol = 'TOKEN',
  className = ''
}) => {
  if (!transfers || transfers.length === 0) {
    return (
      <div className={`bg-slate-800/30 rounded-lg p-4 border border-slate-700/50 ${className}`}>
        <p className="text-slate-400 text-center">No transaction data available</p>
      </div>
    );
  }

  // Group transfers by time periods
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;

  const recentTransfers = transfers.filter(t => {
    const transferTime = new Date(t.timestamp).getTime();
    return (now - transferTime) <= oneWeek;
  });

  // Calculate flow statistics
  const totalVolume = transfers.reduce((sum, t) => sum + parseFloat(t.value), 0);
  const uniqueAddresses = new Set([
    ...transfers.map(t => t.from),
    ...transfers.map(t => t.to)
  ]);

  // Group by large transfers (whale movements)
  const whaleThreshold = totalVolume * 0.01; // 1% of total volume
  const whaleTransfers = transfers.filter(t => parseFloat(t.value) >= whaleThreshold);

  // Calculate flow direction
  const inflows = transfers.filter(t => t.to !== '0x0000000000000000000000000000000000000000');
  const outflows = transfers.filter(t => t.from !== '0x0000000000000000000000000000000000000000');

  return (
    <div className={`bg-slate-800/30 rounded-lg p-4 border border-slate-700/50 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-4">Transaction Flow - {tokenSymbol}</h3>
      
      {/* Flow Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-700/30 rounded-lg p-3 text-center"
        >
          <div className="text-2xl font-bold text-blue-400">{transfers.length}</div>
          <div className="text-xs text-slate-400">Total Transfers</div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-700/30 rounded-lg p-3 text-center"
        >
          <div className="text-2xl font-bold text-green-400">
            {totalVolume.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400">Total Volume</div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-700/30 rounded-lg p-3 text-center"
        >
          <div className="text-2xl font-bold text-blue-400">{uniqueAddresses.size}</div>
          <div className="text-xs text-slate-400">Unique Addresses</div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-slate-700/30 rounded-lg p-3 text-center"
        >
          <div className="text-2xl font-bold text-yellow-400">{whaleTransfers.length}</div>
          <div className="text-xs text-slate-400">Whale Moves</div>
        </motion.div>
      </div>

      {/* Flow Direction Chart */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-white mb-3">Flow Direction</h4>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400">Inflows</span>
              <span className="text-xs text-green-400">{inflows.length}</span>
            </div>
            <div className="bg-slate-700 rounded-full h-2">
              <motion.div
                className="bg-green-500 h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(inflows.length / transfers.length) * 100}%` }}
                transition={{ delay: 0.5, duration: 0.8 }}
              />
            </div>
          </div>
          
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400">Outflows</span>
              <span className="text-xs text-red-400">{outflows.length}</span>
            </div>
            <div className="bg-slate-700 rounded-full h-2">
              <motion.div
                className="bg-red-500 h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(outflows.length / transfers.length) * 100}%` }}
                transition={{ delay: 0.6, duration: 0.8 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Whale Movements */}
      <div>
        <h4 className="text-sm font-semibold text-white mb-3">Recent Whale Movements</h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {whaleTransfers.slice(0, 16).map((transfer, index) => (
            <motion.div
              key={transfer.hash}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-3 p-2 bg-slate-700/30 rounded-lg"
            >
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-slate-950 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-slate-400">From:</span>
                  <span className="text-xs text-slate-300 font-mono">
                    {transfer.from.substring(0, 6)}...{transfer.from.substring(transfer.from.length - 4)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">To:</span>
                  <span className="text-xs text-slate-300 font-mono">
                    {transfer.to.substring(0, 6)}...{transfer.to.substring(transfer.to.length - 4)}
                  </span>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm font-semibold text-white">
                  {parseFloat(transfer.value).toLocaleString()} {tokenSymbol}
                </div>
                <div className="text-xs text-slate-400">
                  {new Date(transfer.timestamp).toLocaleDateString()}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TransactionFlowDiagram; 