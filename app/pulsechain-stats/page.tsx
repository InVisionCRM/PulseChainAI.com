'use client';

import React from 'react';
import PulseChainStats from '@/components/PulseChainStats';
import { BackgroundGradient } from '@/components/ui/background-gradient';

export default function PulseChainStatsPage(): JSX.Element {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <BackgroundGradient />

      <div className="relative z-10 container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              PulseChain API Explorer
            </h1>
            <p className="text-lg text-white/70">
              Explore and test PulseChain blockchain API endpoints
            </p>
          </div>

          {/* Main Panel */}
          <div className="rounded-3xl border border-white/15 bg-white/5 backdrop-blur-2xl p-6 md:p-8 shadow-2xl">
            <PulseChainStats />
          </div>
        </div>
      </div>
    </div>
  );
}
