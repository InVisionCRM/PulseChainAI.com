import React from 'react';
import { X } from 'lucide-react';
import { multiNetworkHexStakingService } from '@/services/multiNetworkHexStakingService';
import type { HexStake, MultiNetworkHexStake } from '@/services/hexStakingService';

interface StakeDetailModalProps {
  stake: HexStake | MultiNetworkHexStake | null;
  isOpen: boolean;
  onClose: () => void;
  rank?: number;
}

const StakeDetailModal: React.FC<StakeDetailModalProps> = ({
  stake,
  isOpen,
  onClose,
  rank,
}) => {
  if (!isOpen || !stake) {
    return null;
  }

  const progress = stake.daysServed && stake.stakedDays 
    ? (stake.daysServed / parseInt(stake.stakedDays)) * 100 
    : 0;

  const formatDate = (timestamp: string) => {
    return new Date(parseInt(timestamp) * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  };

  const startDate = formatDate(stake.timestamp);
  const estimatedEndDate = stake.endDay && stake.startDay 
    ? new Date(Date.now() + (parseInt(stake.endDay) - parseInt(stake.startDay)) * 24 * 60 * 60 * 1000).toLocaleDateString()
    : 'N/A';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--app-bg)] backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-[var(--panel)] border border-[var(--line)] rounded-xl shadow-xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-[var(--panel)] border-b border-[var(--line)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {rank && (
                <div className="px-3 py-1 bg-[var(--app-bg)] text-green-500 text-lg font-bold rounded">
                  #{rank}
                </div>
              )}
              <h2 className="text-xl font-bold text-[var(--text)]">
                HEX Stake #{stake.stakeId}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text)] transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text)]">Progress</span>
              <span className="text-[var(--text)] font-semibold">{progress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-[var(--surface-2)] rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              />
            </div>
          </div>

          {/* Basic Info */}
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-[var(--text)]">Stake ID:</span>
              <span className="text-[var(--text)] font-mono">{stake.stakeId}</span>
            </div>
            <div className="flex justify-left items-center gap-1">
              <span className="text-[var(--text)]">Staker Address:</span>
              <span className="text-[var(--text)] font-mono text-sm">{stake.stakerAddr}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text)]">Network:</span>
              <span className="text-[var(--text)]">{stake.network === 'ethereum' ? 'Ethereum' : 'PulseChain'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text)]">Status:</span>
              <span className="text-green-400 font-semibold">Active</span>
            </div>
          </div>

          {/* Staking Details */}
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-[var(--text)]">Staked HEX:</span>
              <span className="text-[var(--text)] font-semibold">
                {multiNetworkHexStakingService.formatHexAmount(stake.stakedHearts)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text)]">T-Shares:</span>
              <span className="text-[var(--text)]">
                {multiNetworkHexStakingService.formatTShareAmount(stake.stakeTShares || stake.stakeShares)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text)]">Stake Length:</span>
              <span className="text-[var(--text)]">
                {multiNetworkHexStakingService.formatStakeLength(parseInt(stake.stakedDays))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text)]">Auto Stake:</span>
              <span className="text-[var(--text)]">{stake.isAutoStake ? 'Yes' : 'No'}</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-[var(--text)]">Start Day:</span>
              <span className="text-[var(--text)]">{stake.startDay}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text)]">End Day:</span>
              <span className="text-[var(--text)]">{stake.endDay}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text)]">Started:</span>
              <span className="text-[var(--text)] text-sm">{startDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text)]">Est. End:</span>
              <span className="text-[var(--text)] text-sm">{estimatedEndDate}</span>
            </div>
          </div>

          {/* Progress Details */}
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-[var(--text)]">Days Served:</span>
              <span className="text-[var(--text)]">{stake.daysServed?.toLocaleString() || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text)]">Days Remaining:</span>
              <span className="text-[var(--text)]">{stake.daysLeft?.toLocaleString() || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text)]">Total Days:</span>
              <span className="text-[var(--text)]">{stake.stakedDays}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default StakeDetailModal;