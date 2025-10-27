import React, { useState } from 'react';
import { Crown, Clock, Target, Zap, Globe, Copy } from 'lucide-react';
import { hexStakingService } from '@/services/hexStakingService';
import { multiNetworkHexStakingService } from '@/services/multiNetworkHexStakingService';
import StakeDetailModal from './StakeDetailModal';
import StakerHistoryModal from './StakerHistoryModal';
import { OptimizedImage } from '@/components/ui/optimized-image';
import type { HexStake } from '@/services/hexStakingService';
import type { MultiNetworkHexStake } from '@/services/multiNetworkHexStakingService';

interface TopStakesVisualProps {
  stakes: (HexStake | MultiNetworkHexStake)[];
  hexPrice?: number; // Current HEX price in USD
}

const TopStakesVisual: React.FC<TopStakesVisualProps> = ({ stakes, hexPrice = 0 }) => {
  const [selectedStake, setSelectedStake] = useState<HexStake | MultiNetworkHexStake | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStakerAddress, setSelectedStakerAddress] = useState<string | null>(null);
  const [selectedStakerNetwork, setSelectedStakerNetwork] = useState<'ethereum' | 'pulsechain'>('ethereum');
  const [isStakerHistoryModalOpen, setIsStakerHistoryModalOpen] = useState<boolean>(false);

  // Helper functions for calculations
  const calculateStakeUSD = (stakedHearts: string): number => {
    const hearts = parseFloat(stakedHearts);
    return (hearts / 100000000) * hexPrice; // Convert hearts to HEX, then to USD
  };

  const calculateExpectedEarnings = (stakedHearts: string, stakedDays: string): number => {
    const hearts = parseFloat(stakedHearts);
    const days = parseInt(stakedDays);
    const hexAmount = hearts / 100000000;
    const baseYield = 0.05; // 5% base yield
    const dayMultiplier = Math.min(days / 365, 2); // Cap at 2x for very long stakes
    return hexAmount * baseYield * dayMultiplier;
  };

  const calculateEarnedSoFar = (stakedHearts: string, daysServed: number, stakedDays: string): number => {
    const hearts = parseFloat(stakedHearts);
    const days = parseInt(stakedDays);
    const hexAmount = hearts / 100000000;
    if (!daysServed || daysServed <= 0) return 0;
    const progressRatio = daysServed / days;
    const expectedEarnings = calculateExpectedEarnings(stakedHearts, stakedDays);
    return expectedEarnings * progressRatio;
  };

  const formatUSD = (amount: number): string => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(2)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(2)}K`;
    } else {
      return `$${amount.toFixed(2)}`;
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here if desired
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleStakeClick = (stake: HexStake | MultiNetworkHexStake) => {
    setSelectedStake(stake);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedStake(null);
  };

  const handleStakerClick = (stakerAddress: string, network: 'ethereum' | 'pulsechain' = 'ethereum') => {
    setSelectedStakerAddress(stakerAddress);
    setSelectedStakerNetwork(network);
    setIsStakerHistoryModalOpen(true);
  };

  const handleStakerHistoryModalClose = () => {
    setIsStakerHistoryModalOpen(false);
    setSelectedStakerAddress(null);
    setSelectedStakerNetwork('ethereum');
  };

  // Use stakes directly since sorting is removed
  const displayStakes = stakes;

  const getProgressColor = (progress: number) => {
    if (progress < 25) return 'from-red-500 to-orange-700';
    if (progress < 50) return 'from-orange-500 to-yellow-700';
    if (progress < 75) return 'from-yellow-500 to-slate-950';
    return 'from-slate-950 to-green-700';
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="w-5 h-5 text-yellow-400" />;
    if (index === 1) return <Crown className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Crown className="w-5 h-5 text-amber-600" />;
    return <span className="text-sm font-bold text-white">#{index + 1}</span>;
  };

  const getStakeStatusColor = (daysLeft: number) => {
    if (daysLeft < 30) return 'text-red-500';
    if (daysLeft < 365) return 'text-yellow-400';
    return 'text-green-700';
  };

  return (
    <div className="bg-gradient-to-b from-slate-900 to-slate-900/90 via-slate-900/90 to-blue-500/30  bg-opacity-50 backdrop-blur-lg border border-white/10 rounded-2xl shadow-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 relative overflow-hidden bg-gradient-to-r from-orange-500 via-red-500 to-slate-950 via-pink-500 to-blue-500">
        {/* Simplified background with CSS gradient instead of heavy image */}
        <div className="absolute inset-0 -z-10 bg-slate-950/10"></div>
        
        <div className="relative z-10">
          <div className="text-left">
            <h4 className="text-xl font-bold text-white">Top 50 Active HEX Stakes</h4>
            <p className="text-sm text-white">Largest current active stakes</p>
          </div>
        </div>
      </div>
      
      <div className="p-6 max-h-[80vh] overflow-y-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {displayStakes.slice(0, 8).map((stake, index) => {
            const progress = stake.daysServed && stake.stakedDays 
              ? (stake.daysServed / parseInt(stake.stakedDays)) * 100 
              : 0;
            
            return (
              <div
                key={stake.id}
                onClick={() => handleStakeClick(stake)}
                className="cursor-pointer group"
              >
                <div className="relative bg-gradient-to-b from-slate-900/60 to-blue-500/10 via-slate-900/50 to-slate-950/25 bg-opacity-50 backdrop-blur border border-slate-800 rounded-xl transition-all duration-300 hover:bg-slate-950/80 hover:border-lime-400/80 hover:scale-105">
                  <div className="p-4">
                    {/* Rank Badge */}
                    <div className="absolute -top-2 -left-2 flex items-center justify-center w-8 h-8 bg-slate-800/10 bg-opacity-50 bg-transparent border border-lime-400 rounded-full">
                      {getRankIcon(index)}
                    </div>

                    {/* Top 3 Glow Effect */}
                    {index < 3 && (
                      <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/5 to-blue-400/5 rounded-xl -z-10" />
                    )}

                    {/* Header - Staker Address */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering the stake detail modal
                            handleStakerClick(stake.stakerAddr, stake.network || 'ethereum');
                          }}
                          className="text-sm text-white font-mono hover:text-blue-400 transition-colors cursor-pointed"
                          title={`${stake.stakerAddr} - Click to view staking history`}
                        >
                          {stake.stakerAddr.slice(0, 4)}...{stake.stakerAddr.slice(-4)}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(stake.stakerAddr);
                          }}
                          className="text-white/60 hover:text-blue-400 transition-colors cursor-pointer"
                          title="Copy address to clipboard"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      
                      {/* Network Badge */}
                      {stake.network && (
                        <div className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${
                          stake.network === 'ethereum' 
                            ? 'bg-blue-500/20 bg-opacity-50 text-slate-950 border border-blue-500/30' 
                            : 'bg-blue-500/20 bg-opacity-50 text-slate-950 border border-blue-500/30'
                        }`}>
                          <Globe className="w-3 h-3" />
                          {stake.network === 'ethereum' ? 'ETH' : 'PLS'}
                        </div>
                      )}
                    </div>

                    {/* Progress Section */}
                    <div className="space-y-3">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-sm text-white mb-1">
                          <span>Progress</span>
                          <span>{progress.toFixed(1)}%</span>
                        </div>
                        <div className="relative w-full bg-white/50 border border-slate-700 border-1 rounded-full h-4 overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r ${getProgressColor(progress)} transition-all duration-1000 ease-out rounded-full relative`}
                            style={{ 
                              width: `${Math.min(100, Math.max(0, progress))}%`,
                            }}
                          >
                            <div className="absolute inset-0 bg-lime-400 rounded-full" />
                          </div>
                        </div>
                      </div>

                      {/* HEX Amount */}
                      <div className="text-center">
                        <div className="text-lg font-bold text-white">
                          {multiNetworkHexStakingService.formatHexAmount(stake.stakedHearts)}
                        </div>
                        <div className="text-sm text-white font-bold">HEX</div>
                        {hexPrice > 0 && (
                          <div className="text-xs font-semibold text-white">
                            {formatUSD(calculateStakeUSD(stake.stakedHearts))}
                          </div>
                        )}
                      </div>

                      {/* Stake Info */}
                      <div className="text-center text-xs text-white/70">
                        <div>Stake #{stake.stakeId}</div>
                        <div>{hexStakingService.formatStakeLength(parseInt(stake.stakedDays))}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Show remaining stakes in a more compact format if there are more than 8 */}
        {displayStakes.length > 8 && (
          <div className="mt-6">
            <div className="text-center mb-4">
              <p className="text-white text-sm">Showing top 8 stakes • Click any stake for full details</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              {displayStakes.slice(8).map((stake, index) => {
                const progress = stake.daysServed && stake.stakedDays 
                  ? (stake.daysServed / parseInt(stake.stakedDays)) * 100 
                  : 0;
                
                return (
                  <div
                    key={stake.id}
                    onClick={() => handleStakeClick(stake)}
                    className="cursor-pointer group"
                  >
                    <div className="bg-gradient-to-b from-slate-900/60 via-slate-900/10 to-slate-950/10 bg-opacity-50 backdrop-blur border border-blue-500/30 border-1 rounded-lg p-3 transition-all duration-300 hover:bg-slate-700/50 hover:border-white/20">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center font-bold gap-5">
                          <div className="text-lg font-bold text-white">#{index + 9}</div>
                          <div className="text-sm text-white font-mono">
                            {stake.stakerAddr.slice(0, 4)}...{stake.stakerAddr.slice(-4)}
                          </div>
                          {stake.network && (
                            <div className={`text-xs px-2 py-1 rounded ${
                              stake.network === 'ethereum' 
                                ? 'bg-blue-500/20 bg-opacity-50 text-slate-950' 
                                : 'bg-blue-500/20 bg-opacity-50 text-slate-950'
                            }`}>
                              {stake.network === 'ethereum' ? 'ETH' : 'PLS'}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-white">
                            {multiNetworkHexStakingService.formatHexAmount(stake.stakedHearts)}
                          </div>
                          <div className="text-xs text-white">{progress.toFixed(1)}%</div>
                        </div>
                      </div>
                      
                      {/* Progress Bar for Compact Stakes */}
                      <div className="w-full">
                        <div className="relative w-full bg-white/20 border border-slate-600 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r ${getProgressColor(progress)} transition-all duration-1000 ease-out rounded-full relative`}
                            style={{ 
                              width: `${Math.min(100, Math.max(0, progress))}%`,
                            }}
                          >
                            <div className="absolute inset-0 bg-lime-400 rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* Bottom Stats Summary */}
      <div className="px-6 py-4 border-t border-white bg-slate-800">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-green-500">
              {hexStakingService.formatHexAmount(
                stakes.reduce((sum, stake) => sum + parseFloat(stake.stakedHearts), 0).toString()
              )}
            </div>
            <div className="text-xs text-white">Total in Top 50</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-500">
              {(stakes.reduce((sum, stake) => sum + (stake.daysServed || 0), 0) / stakes.length).toFixed(0)}
            </div>
            <div className="text-xs text-white">Avg Days Served</div>
          </div>
          <div>
            <div className="text-lg font-bold text-orange-400">
              {hexStakingService.formatStakeLength(
                Math.round(stakes.reduce((sum, stake) => sum + parseInt(stake.stakedDays), 0) / stakes.length)
              )}
            </div>
            <div className="text-xs text-white">Avg Length</div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>

      {/* Stake Detail Modal */}
      <StakeDetailModal
        stake={selectedStake}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        rank={selectedStake ? stakes.findIndex(s => s.id === selectedStake.id) + 1 : undefined}
      />

      {/* Staker History Modal */}
      <StakerHistoryModal
        stakerAddress={selectedStakerAddress}
        isOpen={isStakerHistoryModalOpen}
        onClose={handleStakerHistoryModalClose}
        network={selectedStakerNetwork}
        currentPrice={hexPrice}
      />
    </div>
  );
};

export default TopStakesVisual;