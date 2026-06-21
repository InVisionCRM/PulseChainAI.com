"use client";
import React, { useState } from 'react';
import { TrendingDown, Coins, Zap } from 'lucide-react';
import SellPressureAnalysis from './SellPressureAnalysis';
import { hexStakingService } from '@/services/hexStakingService';
import { pulsechainHexStakingService } from '@/services/pulsechainHexStakingService';
import type { HexStake } from '@/services/hexStakingService';

interface SellPressureAnalysisTabProps {
  ethereumActiveStakes: HexStake[];
  pulsechainActiveStakes: HexStake[];
  ethereumPrice: number;
  pulsechainPrice: number;
  ethereumHexDay: number;
  pulsechainHexDay: number;
  isLoadingEthereum: boolean;
  isLoadingPulsechain: boolean;
}

export default function SellPressureAnalysisTab({
  ethereumActiveStakes,
  pulsechainActiveStakes,
  ethereumPrice,
  pulsechainPrice,
  ethereumHexDay,
  pulsechainHexDay,
  isLoadingEthereum,
  isLoadingPulsechain
}: SellPressureAnalysisTabProps) {
  const [activeNetwork, setActiveNetwork] = useState<'ethereum' | 'pulsechain'>('ethereum');

  return (
    <div className="w-full bg-[var(--surface)] backdrop-blur-xl border border-[var(--line)] sm:rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
      {/* Header with Network Tabs */}
      <div className="bg-gradient-to-r from-blue-500/10 to-blue-500/10 border-b border-[var(--line)]">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/20 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-slate-800" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Stakes Ending Soon</h3>
              <p className="text-slate-800 text-sm">Analyze stakes ending in the next few days</p>
            </div>
          </div>
        </div>

        {/* Network Selection Tabs */}
        <div className="flex px-6 pb-4">
          <div className="flex bg-[var(--surface-2)] rounded-lg p-1 border border-[var(--line-strong)]">
            <button
              onClick={() => setActiveNetwork('ethereum')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                activeNetwork === 'ethereum'
                  ? 'bg-blue-500 text-[var(--text)] shadow-lg shadow-blue-500/25'
                  : 'text-slate-800 hover:text-slate-600 hover:bg-[var(--surface-3)]'
              }`}
            >
              <Coins className="w-4 h-4" />
              Ethereum HEX
            </button>
            <button
              onClick={() => setActiveNetwork('pulsechain')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                activeNetwork === 'pulsechain'
                  ? 'bg-blue-500 text-[var(--text)] shadow-lg shadow-blue-500/25'
                  : 'text-slate-800 hover:text-slate-600 hover:bg-[var(--surface-3)]'
              }`}
            >
              <Zap className="w-4 h-4" />
              PulseChain HEX
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6">
        {activeNetwork === 'ethereum' ? (
          <SellPressureAnalysis
            activeStakes={ethereumActiveStakes}
            currentPrice={ethereumPrice}
            currentHexDay={ethereumHexDay}
            network="ethereum"
            formatHexAmount={hexStakingService.formatHexAmount}
          />
        ) : (
          <SellPressureAnalysis
            activeStakes={pulsechainActiveStakes}
            currentPrice={pulsechainPrice}
            currentHexDay={pulsechainHexDay}
            network="pulsechain"
            formatHexAmount={pulsechainHexStakingService.formatHexAmount}
          />
        )}
      </div>
    </div>
  );
}
