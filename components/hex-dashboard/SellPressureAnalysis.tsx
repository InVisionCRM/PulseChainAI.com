"use client";
import React, { useState, useMemo } from 'react';
import { TrendingDown, Calendar, Users, DollarSign, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';
import { HexStake } from '@/services/hexStakingService';
import StakerHistoryModal from './StakerHistoryModal';

interface SellPressureAnalysisProps {
  activeStakes: HexStake[];
  currentPrice: number;
  currentHexDay: number;
  network: 'ethereum' | 'pulsechain';
  formatHexAmount: (amount: string | number) => string;
  formatTShareAmount: (amount: string | number) => string;
}

export default function SellPressureAnalysis({ 
  activeStakes, 
  currentPrice, 
  currentHexDay, 
  network,
  formatHexAmount,
  formatTShareAmount 
}: SellPressureAnalysisProps) {
  const [timeWindow, setTimeWindow] = useState<7 | 30 | 90>(30);
  const [showStakesList, setShowStakesList] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof HexStake | 'daysLeft' | 'progress' | 'usdValue' | 'estimatedAPY'; direction: 'asc' | 'desc' }>({ key: 'endDay', direction: 'asc' });
  const [selectedStaker, setSelectedStaker] = useState<string | null>(null);
  const [showStakerModal, setShowStakerModal] = useState(false);

  // Helper function to handle sorting
  const handleSort = (key: keyof HexStake | 'daysLeft' | 'progress' | 'usdValue' | 'estimatedAPY') => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
  };

  // Simple calculation: find stakes ending within the time window
  const stakesEnding = useMemo(() => {
    if (!activeStakes || !currentHexDay) return [];
    
    const filtered = activeStakes
      .filter(stake => {
        const endDay = parseInt(stake.endDay);
        const daysFromNow = endDay - currentHexDay;
        return daysFromNow >= 0 && daysFromNow <= timeWindow;
      });

    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.key) {
        case 'daysLeft':
          aValue = parseInt(a.endDay) - currentHexDay;
          bValue = parseInt(b.endDay) - currentHexDay;
          break;
        case 'progress':
          aValue = a.daysServed && a.stakedDays ? (a.daysServed / parseInt(a.stakedDays)) * 100 : 0;
          bValue = b.daysServed && b.stakedDays ? (b.daysServed / parseInt(b.stakedDays)) * 100 : 0;
          break;
        case 'usdValue':
          aValue = (parseFloat(a.stakedHearts) / 100000000) * currentPrice;
          bValue = (parseFloat(b.stakedHearts) / 100000000) * currentPrice;
          break;
        case 'estimatedAPY':
          // Estimate APY based on current progress and T-Shares
          aValue = a.daysServed && a.stakedDays && a.stakeTShares ? 
            ((parseFloat(a.stakeTShares) / parseFloat(a.stakedHearts)) * 365 * 100) / parseInt(a.stakedDays) : 0;
          bValue = b.daysServed && b.stakedDays && b.stakeTShares ?
            ((parseFloat(b.stakeTShares) / parseFloat(b.stakedHearts)) * 365 * 100) / parseInt(b.stakedDays) : 0;
          break;
        case 'stakedHearts':
        case 'stakeTShares':
        case 'stakeShares':
          aValue = parseFloat(a[sortConfig.key] || '0');
          bValue = parseFloat(b[sortConfig.key] || '0');
          break;
        case 'endDay':
        case 'startDay':
        case 'stakedDays':
        case 'stakeId':
          aValue = parseInt(a[sortConfig.key] || '0');
          bValue = parseInt(b[sortConfig.key] || '0');
          break;
        case 'daysServed':
          aValue = a.daysServed || 0;
          bValue = b.daysServed || 0;
          break;
        case 'timestamp':
          aValue = parseInt(a.timestamp);
          bValue = parseInt(b.timestamp);
          break;
        default:
          aValue = a[sortConfig.key as keyof HexStake];
          bValue = b[sortConfig.key as keyof HexStake];
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [activeStakes, currentHexDay, timeWindow, sortConfig]);

  const totalStakes = stakesEnding.length;

  const networkColor = network === 'ethereum' ? 'blue' : 'purple';
  const networkName = network === 'ethereum' ? 'Ethereum' : 'PulseChain';

  // Helper function to format dates
  const formatDate = (timestamp: string) => {
    const date = new Date(parseInt(timestamp) * 1000);
    return date.toLocaleDateString();
  };

  // Helper functions for calculations
  const calculateUSDValue = (stakedHearts: string): number => {
    return (parseFloat(stakedHearts) / 100000000) * currentPrice;
  };

  const calculateEstimatedAPY = (stake: HexStake): number => {
    if (!stake.daysServed || !stake.stakedDays || !stake.stakeTShares) return 0;
    
    // Simple estimation based on T-Share ratio and time served
    const tShareRatio = parseFloat(stake.stakeTShares) / parseFloat(stake.stakedHearts);
    const dailyYieldRate = (tShareRatio * 365 * 100) / parseInt(stake.stakedDays);
    return dailyYieldRate;
  };

  const handleStakerClick = (stakerAddr: string) => {
    setSelectedStaker(stakerAddr);
    setShowStakerModal(true);
  };

  // Helper function to render sortable header
  const SortableHeader = ({ children, sortKey }: { children: React.ReactNode; sortKey: keyof HexStake | 'daysLeft' | 'progress' | 'usdValue' | 'estimatedAPY' }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th 
        className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-700/50 transition-colors select-none"
        onClick={() => handleSort(sortKey)}
      >
        <div className="flex items-center gap-1">
          {children}
          <div className="flex flex-col">
            <ChevronUp className={`w-3 h-3 ${isActive && sortConfig.direction === 'asc' ? 'text-blue-400' : 'text-gray-400'}`} />
            <ChevronDown className={`w-3 h-3 -mt-1 ${isActive && sortConfig.direction === 'desc' ? 'text-blue-400' : 'text-gray-400'}`} />
          </div>
        </div>
      </th>
    );
  };

  return (
    <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 sm:rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] p-3 sm:p-6 relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div className="flex items-center gap-3 mb-4 sm:mb-0">
          <div className={`w-10 h-10 rounded-full bg-${networkColor}-500/20 flex items-center justify-center`}>
            <TrendingDown className={`w-5 h-5 text-${networkColor}-400`} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">
              {networkName} Stakes Ending Soon
            </h3>
            <p className="text-slate-800 text-sm">
              Stakes ending in the next {timeWindow} days
            </p>
          </div>
        </div>
        
        {/* Time Window Selector */}
        <div className="flex bg-gray-300/50 rounded-lg p-1">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              onClick={() => setTimeWindow(days as 7 | 30 | 90)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                timeWindow === days
                  ? `bg-${networkColor}-600 text-white`
                  : 'text-slate-800 hover:text-slate-600'
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-300/30 rounded-xl p-4 border border-gray-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Users className={`w-4 h-4 text-${networkColor}-700`} />
            <span className="text-slate-800 text-sm font-medium">Stakes Ending</span>
          </div>
          <button
            onClick={() => setShowStakesList(!showStakesList)}
            className={`text-2xl font-bold text-${networkColor}-700 hover:text-${networkColor}-300 cursor-pointer transition-colors`}
          >
            {totalStakes.toLocaleString()}
          </button>
          <p className="text-xs text-slate-800 mt-1">Click to view details</p>
        </div>

        <div className="bg-gray-300/30 rounded-xl p-4 border border-gray-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className={`w-4 h-4 text-${networkColor}-700`} />
            <span className="text-slate-800 text-sm font-medium">Total HEX</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`text-xl font-bold text-${networkColor}-700`}>
              {formatHexAmount(stakesEnding.reduce((sum, stake) => sum + parseFloat(stake.stakedHearts), 0))} HEX
            </div>
            <img 
              src="/HEXagon (1).svg" 
              alt="HEX Logo" 
              className="w-6 h-6"
            />
          </div>
        </div>

        <div className="bg-gray-300/30 rounded-xl p-4 border border-gray-700/50">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className={`w-4 h-4 text-${networkColor}-700`} />
            <span className="text-slate-800 text-sm font-medium">Value (USD)</span>
          </div>
          <div className={`text-xl font-bold text-${networkColor}-700`}>
            ${(stakesEnding.reduce((sum, stake) => {
              const stakedHearts = parseFloat(stake.stakedHearts);
              const stakedHex = stakedHearts / 100000000;
              return sum + (stakedHex * currentPrice);
            }, 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-slate-600 mt-1">
            @ ${currentPrice.toFixed(4)} per HEX
          </div>
        </div>
      </div>

      {/* Stakes List - Only show when clicked */}
      {showStakesList && (
        <div className="mt-6 bg-gray-300/30 rounded-xl border border-gray-700/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700/50">
            <h4 className="text-slate-800 font-medium">Stakes Ending in Next {timeWindow} Days</h4>
          </div>
          
          {stakesEnding.length > 0 ? (
            <div className="overflow-auto max-h-[70vh]">
              <table className="min-w-full divide-y divide-gray-700/50">
                <thead className="bg-slate-900 text-white sticky top-0">
                  <tr>
                    <SortableHeader sortKey="stakeId">Stake ID</SortableHeader>
                    <SortableHeader sortKey="stakerAddr">Staker Address</SortableHeader>
                    <SortableHeader sortKey="stakedHearts">Amount (HEX)</SortableHeader>
                    <SortableHeader sortKey="usdValue">USD Value</SortableHeader>
                    <SortableHeader sortKey="stakeTShares">T-Shares</SortableHeader>
                    <SortableHeader sortKey="estimatedAPY">Est. APY</SortableHeader>
                    <SortableHeader sortKey="stakedDays">Length</SortableHeader>
                    <SortableHeader sortKey="daysServed">Days Served</SortableHeader>
                    <SortableHeader sortKey="progress">Progress</SortableHeader>
                    <SortableHeader sortKey="startDay">Start Day</SortableHeader>
                    <SortableHeader sortKey="endDay">End Day</SortableHeader>
                    <SortableHeader sortKey="daysLeft">Days Left</SortableHeader>
                    <SortableHeader sortKey="timestamp">Started</SortableHeader>
                    <SortableHeader sortKey="transactionHash">Start Transaction</SortableHeader>
                    <SortableHeader sortKey="isAutoStake">Auto Stake</SortableHeader>
            </tr>
          </thead>
                <tbody className="bg-transparent divide-y divide-gray-700/50">
                  {stakesEnding.map((stake) => {
                    const daysLeft = parseInt(stake.endDay) - currentHexDay;
                    const progress = stake.daysServed && stake.stakedDays 
                      ? (stake.daysServed / parseInt(stake.stakedDays)) * 100 
                      : 0;
                    
                    return (
                      <tr key={stake.stakeId} className="hover:bg-white/5">
                        <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-slate-800">
                          {stake.stakeId}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-800 font-mono">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleStakerClick(stake.stakerAddr)}
                              className="text-xs text-blue-500 hover:text-blue-300 underline cursor-pointer transition-colors"
                              title="View staker history"
                            >
                              {stake.stakerAddr.slice(0, 6)}...{stake.stakerAddr.slice(-4)}
                            </button>
                            <button
                              onClick={() => navigator.clipboard.writeText(stake.stakerAddr)}
                              className="text-slate-600 hover:text-slate-400 transition-colors"
                              title="Copy address"
                            >
                              📋
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-green-700 font-semibold">
                          {formatHexAmount(stake.stakedHearts)}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">
                          ${calculateUSDValue(stake.stakedHearts).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-purple-700">
                          {formatTShareAmount(stake.stakeTShares || stake.stakeShares)}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-orange-700 font-semibold">
                          {calculateEstimatedAPY(stake).toFixed(1)}%
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-blue-700">
                          {parseInt(stake.stakedDays).toLocaleString()} days
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-orange-700">
                          {stake.daysServed?.toLocaleString() || 'N/A'} days
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-700 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all ${
                                  progress >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-purple-500 to-blue-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-700">{progress.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-800">
                          Day {stake.startDay}
                  </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-red-700 font-medium">
                          Day {stake.endDay}
                  </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-red-700 font-medium">
                          {daysLeft} days
                  </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-800">
                          {formatDate(stake.timestamp)}
                  </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm">
                          <a
                            href={network === 'ethereum' 
                              ? `https://etherscan.io/tx/${stake.transactionHash}`
                              : `https://scan.pulsechain.com/tx/${stake.transactionHash}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-green-700 hover:text-slate-700 flex items-center gap-1 underline"
                            title={`View start transaction: ${stake.transactionHash}`}
                          >
                            <span>{stake.transactionHash.slice(0, 8)}...</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                  </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-800">
                          <span className={`text-xs px-2 py-1 rounded ${
                            stake.isAutoStake 
                              ? 'bg-green-500/20 text-green-700' 
                              : 'bg-slate-500/20 text-slate-700'
                          }`}>
                            {stake.isAutoStake ? 'Yes' : 'No'}
                          </span>
                  </td>
                </tr>
                    );
                  })}
                  
                  {/* Summary Row */}
                  <tr className="bg-slate-800/20 border-t-2 border-slate-600">
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-bold text-slate-800">
                      TOTAL ({stakesEnding.length})
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-800">
                      {stakesEnding.length} stakes
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-bold text-green-700">
                      {formatHexAmount(stakesEnding.reduce((sum, stake) => sum + parseFloat(stake.stakedHearts), 0))}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                      ${stakesEnding.reduce((sum, stake) => sum + calculateUSDValue(stake.stakedHearts), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-bold text-purple-700">
                      {formatTShareAmount(stakesEnding.reduce((sum, stake) => sum + parseFloat(stake.stakeTShares || stake.stakeShares), 0))}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-800">
                      -
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-800">
                      -
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-800">
                      -
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-800">
                      -
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-800">
                      -
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-800">
                      -
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-800">
                      -
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-800">
                      -
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-800">
                      -
                </td>
              </tr>
          </tbody>
        </table>
      </div>
          ) : (
            <div className="p-8 text-center text-slate-800">
              No stakes ending in the next {timeWindow} days
            </div>
          )}
        </div>
      )}

      {/* Simple Note */}
      <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
        <div className="text-sm text-slate-800">
          <p className="font-medium mb-1">Note:</p>
          <p className="text-slate-800 text-xs">
            Shows stakes that will end in the next {timeWindow} days. Click the number above to see the full list.
          </p>
        </div>
      </div>

      {/* Staker History Modal */}
      {showStakerModal && selectedStaker && (
        <StakerHistoryModal
          isOpen={showStakerModal}
          onClose={() => {
            setShowStakerModal(false);
            setSelectedStaker(null);
          }}
          stakerAddress={selectedStaker}
          network={network}
          currentPrice={currentPrice}
        />
      )}
    </div>
  );
}