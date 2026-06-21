'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TokenData, StatConfig } from './StatCounterBuilder';

interface TokenCardProps {
  token: TokenData;
  stats: StatConfig[];
  statResults?: Record<string, unknown>;
  onAddStats: () => void;
  onDelete?: () => void;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

export default function TokenCard({ 
  token, 
  stats, 
  statResults = {},
  onAddStats, 
  onDelete, 
  isSelected = false,
  onClick,
  className = ''
}: TokenCardProps) {
  const hasStats = stats.length > 0;

  const formatStatValue = (stat: StatConfig, value: unknown) => {
    if (value === null || value === undefined) {
      return 'Loading...';
    }

    switch (stat.format) {
      case 'currency':
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(numValue)) return 'N/A';
        const formatted = numValue.toLocaleString('en-US', {
          minimumFractionDigits: stat.decimals || 2,
          maximumFractionDigits: stat.decimals || 2
        });
        return `${stat.prefix || '$'}${formatted}`;
      
      case 'percentage':
        const percentValue = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(percentValue)) return 'N/A';
        return `${percentValue.toFixed(2)}%`;
      
      case 'number':
        const numberValue = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(numberValue)) return 'N/A';
        return numberValue.toLocaleString();
      
      case 'address':
        if (typeof value === 'string' && value.length > 20) {
          return `${value.slice(0, 8)}...${value.slice(-8)}`;
        }
        return value || 'N/A';
      
      case 'text':
      default:
        return value || 'N/A';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative bg-gradient-to-br from-[var(--panel)] to-[var(--panel)] backdrop-blur-xl border border-[var(--line-strong)] rounded-xl shadow-xl overflow-hidden ${className} ${
        isSelected ? 'ring-2 ring-blue-500/50' : ''
      }`}
      onClick={onClick}
    >
      {/* Card Header */}
      <div className="p-4 border-b border-[var(--line)]">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              {/* Token Image from DexScreener */}
              {token.dexScreenerData?.info?.imageUrl ? (
                <img 
                  src={token.dexScreenerData.info.imageUrl} 
                  alt={`${token.name} logo`}
                  className="w-8 h-8 rounded-lg object-cover"
                  onError={(e) => {
                    // Hide image if it fails to load
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <span className="text-[var(--text)] font-bold text-sm">
                    {token.symbol?.charAt(0) || 'T'}
                  </span>
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-[var(--text)]">{token.name}</h3>
                <p className="text-sm text-[var(--text-muted)]">{token.symbol}</p>
                {/* Token description from DexScreener */}
                {token.dexScreenerData?.info?.header && (
                  <p className="text-xs text-[var(--text-muted)] mt-1 truncate">
                    {token.dexScreenerData.info.header}
                  </p>
                )}
              </div>
            </div>
          </div>
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-[var(--text-muted)] hover:text-red-400 transition-colors p-1"
              title="Delete card"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className="p-6">
        {hasStats ? (
          /* Display Stats */
          <div className="space-y-3">
            {stats.map((stat) => (
              <div key={stat.id} className="flex justify-between items-center">
                <span className="text-sm text-[var(--text-muted)]">{stat.label}</span>
                <span className="text-sm font-medium text-[var(--text)]">
                  {formatStatValue(stat, statResults[stat.id])}
                </span>
              </div>
            ))}
          </div>
        ) : (
          /* Add Stats Button */
          <div className="flex flex-col items-center justify-center py-8">
            <div className="text-4xl mb-4">📊</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddStats();
              }}
              className="bg-[var(--app-bg)] hover:bg-[var(--app-bg)] active:bg-[var(--app-bg)] text-[var(--text)] px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Stats</span>
            </button>
          </div>
        )}
      </div>

      {/* Token Address (small) */}
      <div className="px-4 pb-3">
        <p className="text-xs text-[var(--text-muted)] font-mono">
          {token.address.length > 20 
            ? `${token.address.slice(0, 8)}...${token.address.slice(-8)}`
            : token.address
          }
        </p>
      </div>
    </motion.div>
  );
} 