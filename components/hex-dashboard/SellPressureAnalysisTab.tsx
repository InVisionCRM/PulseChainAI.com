"use client";
import React, { useState } from 'react';
import { TrendingDown } from 'lucide-react';
import Image from 'next/image';
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
    <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 sm:rounded-2xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] overflow-hidden">
      {/* Header with Network Tabs */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-white/10">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
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
          <div className="flex bg-white/10 rounded-lg p-1 border border-white/20">
            <button
              onClick={() => setActiveNetwork('ethereum')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                activeNetwork === 'ethereum'
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                  : 'text-slate-800 hover:text-slate-600 hover:bg-white/20'
              }`}
            >
              <Image src="/ethlogo.svg" alt="Ethereum" width={16} height={16} className="w-4 h-4" />
              Ethereum HEX
            </button>
            <button
              onClick={() => setActiveNetwork('pulsechain')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                activeNetwork === 'pulsechain'
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25'
                  : 'text-slate-800 hover:text-slate-600 hover:bg-white/20'
              }`}
            >
              <Image src="/LogoVector.svg" alt="PulseChain" width={16} height={16} className="w-4 h-4" />
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
            formatHexAmount={(amount: string | number) => hexStakingService.formatHexAmount(String(amount))}
            formatTShareAmount={(amount: string | number) => hexStakingService.formatTShareAmount(String(amount))}
          />
        ) : (
          <SellPressureAnalysis
            activeStakes={pulsechainActiveStakes}
            currentPrice={pulsechainPrice}
            currentHexDay={pulsechainHexDay}
            network="pulsechain"
            formatHexAmount={(amount: string | number) => pulsechainHexStakingService.formatHexAmount(String(amount))}
            formatTShareAmount={(amount: string | number) => pulsechainHexStakingService.formatTShareAmount(String(amount))}
          />
        )}
      </div>
    </div>
  );
}
