"use client";

import React from 'react';
import { motion } from "framer-motion";
import { WobbleCard } from '@/components/ui/wobble-card';

interface WobbleCardsDemoProps {
  showTutorial: boolean;
  onClose: () => void;
}

export default function WobbleCardsDemo({ showTutorial, onClose }: WobbleCardsDemoProps) {
  if (!showTutorial) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.8, delay: 0.5 }}
      className="absolute bottom-0 left-0 right-0 z-30 w-full h-1/2"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-7xl mx-auto w-full h-full px-4 pb-8">
        <WobbleCard
          containerClassName="col-span-1 md:col-span-2 h-full bg-black/20 backdrop-blur-xl border border-white/10 min-h-[200px] shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
          className=""
        >
          <div className="max-w-xs">
            <h2 className="text-left text-balance text-base md:text-xl lg:text-2xl font-semibold tracking-[-0.015em] text-white">
              AI Contract Analyzer powers PulseChain analysis
            </h2>
            <p className="mt-4 text-left text-base/6 text-neutral-200">
              Search any PulseChain contract by address or token name. Get instant AI analysis, source code review, creator info, and comprehensive blockchain insights.
            </p>
          </div>
          <div className="absolute -right-4 lg:-right-[40%] -bottom-10 flex items-center justify-center">
            <div className="w-24 h-24 bg-purple-600/20 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-purple-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
          </div>
        </WobbleCard>
        
        <WobbleCard containerClassName="col-span-1 min-h-[200px] bg-black/20 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <h2 className="max-w-80 text-left text-balance text-base md:text-xl lg:text-2xl font-semibold tracking-[-0.015em] text-white">
            Smart Contract Intelligence
          </h2>
          <p className="mt-4 max-w-[26rem] text-left text-base/6 text-neutral-200">
            Advanced AI analysis of contract functions, security patterns, and potential risks. Understand complex smart contracts instantly.
          </p>
        </WobbleCard>
        
        <WobbleCard containerClassName="col-span-1 md:col-span-3 bg-black/20 backdrop-blur-xl border border-white/10 min-h-[200px] shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="max-w-sm">
            <h2 className="max-w-sm md:max-w-lg text-left text-balance text-base md:text-xl lg:text-2xl font-semibold tracking-[-0.015em] text-white">
              Ready to analyze your first contract?
            </h2>
            <p className="mt-4 max-w-[26rem] text-left text-base/6 text-neutral-200">
              Enter a contract address or search by token name above to get started with comprehensive blockchain analysis powered by AI.
            </p>
            <button
              onClick={onClose}
              className="mt-6 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors duration-200"
            >
              Get Started →
            </button>
          </div>
          <div className="absolute -right-10 md:-right-[40%] lg:-right-[20%] -bottom-10 flex items-center justify-center">
            <div className="w-32 h-32 bg-purple-600/20 rounded-full flex items-center justify-center">
              <svg className="w-16 h-16 text-purple-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            </div>
          </div>
        </WobbleCard>
      </div>
    </motion.div>
  );
} 