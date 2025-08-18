import React from 'react';
import { Lock } from 'lucide-react';
import type { TabNavigationProps } from './types';

const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  setActiveTab,
  setCurrentPage,
  ethereumDataLength,
  pulsechainDataLength,
  stakingData,
  loadStakingData,
}) => {
  return (
    <div className="border-b border-white/10 mb-4">
      <nav className="-mb-px flex space-x-8">
        <button
          onClick={() => {
            setActiveTab('pulsechain');
            setCurrentPage(1);
          }}
          className={`py-2 px-1 border-b-2 font-medium text-sm ${
            activeTab === 'pulsechain'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          PulseChain HEX ({pulsechainDataLength} days)
        </button>
        <button
          onClick={() => {
            setActiveTab('ethereum');
            setCurrentPage(1);
          }}
          className={`py-2 px-1 border-b-2 font-medium text-sm ${
            activeTab === 'ethereum'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          Ethereum HEX ({ethereumDataLength} days)
        </button>
        <button
          onClick={() => {
            setActiveTab('staking');
            setCurrentPage(1);
            if (!stakingData) {
              loadStakingData();
            }
          }}
          className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
            activeTab === 'staking'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <Lock className="w-4 h-4" />
          HEX Staking ({stakingData?.totalActiveStakes || '...'} active)
        </button>
      </nav>
    </div>
  );
};

export default TabNavigation;