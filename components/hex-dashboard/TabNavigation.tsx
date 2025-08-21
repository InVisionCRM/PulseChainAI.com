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
  // Calculate combined active stakes from both networks
  const combinedActiveStakes = stakingData?.combined?.totalActiveStakes || 0;
  
  return (
    <div className="border-b border-white/10 mb-2 sm:mb-4">
      <nav className="-mb-px flex flex-wrap gap-2 sm:gap-4 md:gap-8">
        <button
          onClick={() => {
            setActiveTab('pulsechain');
            setCurrentPage(1);
          }}
          className={`py-1.5 sm:py-2 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
            activeTab === 'pulsechain'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <span className="hidden sm:inline">PulseChain HEX</span>
          <span className="sm:hidden">PLS</span> ({pulsechainDataLength})
        </button>
        <button
          onClick={() => {
            setActiveTab('ethereum');
            setCurrentPage(1);
          }}
          className={`py-1.5 sm:py-2 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
            activeTab === 'ethereum'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <span className="hidden sm:inline">Ethereum HEX</span>
          <span className="sm:hidden">ETH</span> ({ethereumDataLength})
        </button>
        <button
          onClick={() => {
            setActiveTab('staking');
            setCurrentPage(1);
            if (!stakingData) {
              loadStakingData();
            }
          }}
          className={`py-1.5 sm:py-2 px-2 sm:px-3 border-b-2 font-medium text-xs sm:text-sm flex items-center gap-1 whitespace-nowrap ${
            activeTab === 'staking'
              ? 'border-green-500 text-green-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <Lock className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">HEX Staking</span>
          <span className="sm:hidden">Stakes</span> ({combinedActiveStakes.toLocaleString()})
        </button>
      </nav>
    </div>
  );
};

export default TabNavigation;