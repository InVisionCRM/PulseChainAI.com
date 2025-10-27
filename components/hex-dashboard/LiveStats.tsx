import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { LiveStatsProps } from './types';

// Utility functions for formatting
const formatNumber = (num: unknown, decimals = 2, showFullNumber = false) => {
  if (num === null || num === undefined) return 'N/A';
  const number = Number(num);
  if (isNaN(number)) return 'N/A';
  
  const validDecimals = Math.max(0, Math.min(20, Math.floor(decimals || 2)));
  
  if (showFullNumber || Math.abs(number) < 1000) {
    return number.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: validDecimals
    });
  }
  
  if (Math.abs(number) >= 1e12) return (number / 1e12).toFixed(validDecimals) + 'T';
  if (Math.abs(number) >= 1e9) return (number / 1e9).toFixed(validDecimals) + 'B';
  if (Math.abs(number) >= 1e6) return (number / 1e6).toFixed(validDecimals) + 'M';
  if (Math.abs(number) >= 1e3) return (number / 1e3).toFixed(validDecimals) + 'K';
  return number.toFixed(validDecimals);
};

const formatCurrency = (num: unknown, decimals = 6) => {
  if (num === null || num === undefined) return 'N/A';
  const number = Number(num);
  if (isNaN(number)) return 'N/A';
  
  const validDecimals = Math.max(0, Math.min(20, Math.floor(decimals || 2)));
  
  if (Math.abs(number) >= 1e12) return '$' + (number / 1e12).toFixed(2) + 'T';
  if (Math.abs(number) >= 1e9) return '$' + (number / 1e9).toFixed(2) + 'B';
  if (Math.abs(number) >= 1e6) return '$' + (number / 1e6).toFixed(2) + 'M';
  if (Math.abs(number) >= 1e3) return '$' + (number / 1e3).toFixed(2) + 'K';
  
  return '$' + number.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: validDecimals
  });
};

const formatHEX = (num: unknown, decimals = 0) => {
  if (num === null || num === undefined) return 'N/A';
  return formatNumber(num, decimals) + ' HEX';
};

const formatPrice = (num: unknown, decimals = 8) => {
  if (num === null || num === undefined) return 'N/A';
  const number = Number(num);
  if (isNaN(number)) return 'N/A';
  
  const validDecimals = Math.max(0, Math.min(20, Math.floor(decimals || 8)));
  
  if (Math.abs(number) < 0.000001) return '$' + number.toExponential(2);
  return '$' + number.toFixed(validDecimals);
};

const LiveStats: React.FC<LiveStatsProps> = ({ 
  liveData, 
  activeTab, 
  isLoading,
}) => {
  const handleRefresh = () => {
    window.location.reload();
  };

  if (!liveData) {
    return (
      <div className="mb-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-400 rounded-full animate-spin"></div>
            Loading Live Stats...
          </h3>
          <div className="text-sm text-slate-400">
            Fetching latest HEX data...
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="text-center bg-white/5 backdrop-blur rounded-lg p-3 border border-white/10 animate-pulse">
              <div className="h-8 bg-white/10 rounded mb-2"></div>
              <div className="h-4 bg-white/5 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 sm:mb-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
        <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 mb-2 sm:mb-0">
          <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-400 rounded-full animate-pulse"></div>
          <span className="hidden sm:inline">Live {activeTab === 'ethereum' ? 'Ethereum' : 'PulseChain'} HEX Stats</span>
          <span className="sm:hidden">Live {activeTab === 'ethereum' ? 'ETH' : 'PLS'} Stats</span>
        </h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="text-xs sm:text-sm text-slate-400">
            <span className="hidden sm:inline">Last updated: {new Date().toLocaleTimeString()}</span>
            <span className="sm:hidden">{new Date().toLocaleTimeString()}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-2 sm:px-3 py-1 bg-slate-950 hover:bg-slate-950 text-white text-xs sm:text-sm rounded-lg transition-colors self-start sm:self-auto"
          >
            <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>
      
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="text-center bg-white/5 backdrop-blur rounded-lg p-2 sm:p-3 border border-white/10">
          <div className="text-lg sm:text-2xl font-bold text-green-400">
            {activeTab === 'ethereum' 
              ? formatPrice(liveData.price, 8)
              : formatPrice(liveData.price_Pulsechain || liveData.pricePulseX, 8)
            }
          </div>
          <div className="text-xs sm:text-sm text-slate-400">
            <span className="hidden sm:inline">HEX Price</span>
            <span className="sm:hidden">Price</span>
          </div>
        </div>
        <div className="text-center bg-white/5 backdrop-blur rounded-lg p-2 sm:p-3 border border-white/10">
          <div className="text-lg sm:text-2xl font-bold text-blue-400">
            {activeTab === 'ethereum' 
              ? formatPrice(liveData.tsharePrice, 2)
              : formatPrice(liveData.tsharePrice_Pulsechain, 2)
            }
          </div>
          <div className="text-xs sm:text-sm text-slate-400">
            <span className="hidden sm:inline">T-Share Price</span>
            <span className="sm:hidden">T-Share</span>
          </div>
        </div>
        <div className="text-center bg-white/5 backdrop-blur rounded-lg p-2 sm:p-3 border border-white/10">
          <div className="text-lg sm:text-2xl font-bold text-orange-400">
            {activeTab === 'ethereum' 
              ? formatNumber(liveData.tshareRateHEX, 1)
              : formatNumber(liveData.tshareRateHEX_Pulsechain, 1)
            }
          </div>
          <div className="text-xs sm:text-sm text-slate-400">
            <span className="hidden sm:inline">T-Share Rate (HEX)</span>
            <span className="sm:hidden">T-Rate</span>
          </div>
        </div>
        <div className="text-center bg-white/5 backdrop-blur rounded-lg p-2 sm:p-3 border border-white/10">
          <div className="text-lg sm:text-2xl font-bold text-blue-400">
            {activeTab === 'ethereum' 
              ? formatHEX(liveData.stakedHEX)
              : formatHEX(liveData.stakedHEX_Pulsechain)
            }
          </div>
          <div className="text-xs sm:text-sm text-slate-400">
            <span className="hidden sm:inline">Staked HEX</span>
            <span className="sm:hidden">Staked</span>
          </div>
        </div>
        <div className="text-center bg-slate-700/50 rounded-lg p-2 sm:p-3 border border-slate-600">
          <div className="text-lg sm:text-2xl font-bold text-cyan-400">
            {activeTab === 'ethereum' 
              ? formatHEX(liveData.circulatingHEX)
              : formatHEX(liveData.circulatingHEX_Pulsechain)
            }
          </div>
          <div className="text-xs sm:text-sm text-slate-400">
            <span className="hidden sm:inline">Circulating HEX</span>
            <span className="sm:hidden">Circulating</span>
          </div>
        </div>
        <div className="text-center bg-white/5 backdrop-blur rounded-lg p-2 sm:p-3 border border-white/10">
          <div className="text-lg sm:text-2xl font-bold text-yellow-400">
            {activeTab === 'ethereum' 
              ? formatNumber(liveData.payoutPerTshare, 6)
              : formatNumber(liveData.payoutPerTshare_Pulsechain, 6)
            }
          </div>
          <div className="text-xs sm:text-sm text-slate-400">
            <span className="hidden sm:inline">Payout/T-Share</span>
            <span className="sm:hidden">Payout</span>
          </div>
        </div>
      </div>

      {/* Network-Specific Liquidity Metrics */}
      <div className="border-t border-white/10 pt-3 sm:pt-4">
        <h4 className="text-sm sm:text-md font-semibold text-white mb-2 sm:mb-3">
          <span className="hidden sm:inline">💧 Liquidity Metrics ({activeTab === 'ethereum' ? 'Ethereum' : 'PulseChain'})</span>
          <span className="sm:hidden">💧 Liquidity ({activeTab === 'ethereum' ? 'ETH' : 'PLS'})</span>
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div className="text-center bg-white/5 backdrop-blur rounded-lg p-2 border border-white/10">
            <div className="text-sm sm:text-lg font-bold text-green-300">
              {activeTab === 'ethereum' 
                ? formatHEX(liveData.liquidityHEX)
                : formatHEX(liveData.liquidityHEX_Pulsechain)
              }
            </div>
            <div className="text-xs text-slate-400">
              <span className="hidden sm:inline">Liquidity HEX</span>
              <span className="sm:hidden">Liq HEX</span>
            </div>
          </div>
          <div className="text-center bg-white/5 backdrop-blur rounded-lg p-2 border border-white/10">
            <div className="text-sm sm:text-lg font-bold text-blue-300">
              {activeTab === 'ethereum' 
                ? formatCurrency(liveData.liquidityUSDC, 0)
                : formatNumber(liveData.liquidityPLS_Pulsechain, 0)
              }
            </div>
            <div className="text-xs text-slate-400">
              <span className="hidden sm:inline">{activeTab === 'ethereum' ? 'Liquidity USDC' : 'Liquidity PLS'}</span>
              <span className="sm:hidden">{activeTab === 'ethereum' ? 'USDC' : 'PLS'}</span>
            </div>
          </div>
          <div className="text-center bg-white/5 backdrop-blur rounded-lg p-2 border border-white/10">
            <div className="text-sm sm:text-lg font-bold text-blue-300">
              {activeTab === 'ethereum' 
                ? formatNumber(liveData.liquidityETH, 0)
                : formatNumber(liveData.liquidityEHEX_Pulsechain, 0)
              }
            </div>
            <div className="text-xs text-slate-400">
              <span className="hidden sm:inline">{activeTab === 'ethereum' ? 'Liquidity ETH' : 'Liquidity EHEX'}</span>
              <span className="sm:hidden">{activeTab === 'ethereum' ? 'ETH' : 'EHEX'}</span>
            </div>
          </div>
          <div className="text-center bg-white/5 backdrop-blur rounded-lg p-2 border border-white/10">
            <div className="text-sm sm:text-lg font-bold text-red-300">
              {activeTab === 'ethereum' 
                ? formatHEX(liveData.penaltiesHEX)
                : formatHEX(liveData.penaltiesHEX_Pulsechain)
              }
            </div>
            <div className="text-xs text-slate-400">
              <span className="hidden sm:inline">Penalties HEX</span>
              <span className="sm:hidden">Penalties</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveStats;