'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TickerCardWithPopover } from './TickerCardWithPopover';

interface TokenData {
  address: string;
  symbol: string;
  name: string;
  priceUsd: number;
  priceChange24h: number;
  priceChange6h?: number;
  priceChange1h?: number;
  volume24h: number;
  volume6h?: number;
  liquidity: number;
  fdv?: number;
  marketCap?: number;
  txCount24h?: number;
  buys24h?: number;
  sells24h?: number;
  dexId: string;
}

export function TopTickerBar() {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        console.log('🎯 Fetching specific WPLS pairs...');
        const response = await fetch('/api/specific-wpls-pairs');

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('✅ API response:', { success: data.success, count: data.count });

        if (data.success && data.tokens && data.tokens.length > 0) {
          setTokens(data.tokens);
          console.log(`✅ Loaded ${data.tokens.length} WPLS pairs`);
        } else {
          console.log('⚠️ No WPLS pairs found in response');
        }
      } catch (error) {
        console.error('❌ Failed to fetch WPLS pairs:', error);
      }
    };

    fetchTokens();
    // Refresh every 2 minutes
    const interval = setInterval(fetchTokens, 120000);
    return () => clearInterval(interval);
  }, []);

  const handlePause = () => {
    console.log('🔴 Pausing ticker animation');
    setIsPaused(true);
  };
  const handleResume = () => {
    console.log('🟢 Resuming ticker animation');
    setIsPaused(false);
  };

  if (tokens.length === 0) {
    return null;
  }

  // Duplicate tokens for seamless infinite scroll
  const duplicatedTokens = [...tokens, ...tokens, ...tokens];

  return (
    <div className="relative">
      <div className="h-12 flex items-center w-full overflow-hidden relative border-b-2 border-[#FA4616] bg-black/20">
        <div
          ref={scrollerRef}
          className="flex gap-1 animate-scroll-ticker"
          style={{
            maskImage: 'linear-gradient(to right, transparent, white 10%, white 90%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, white 10%, white 90%, transparent)',
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
        >
        {duplicatedTokens.map((token, idx) => (
          <TickerCardWithPopover
            key={`${token.address}-${idx}`}
            token={token}
            onPause={handlePause}
            onResume={handleResume}
          />
        ))}
        </div>
      </div>
      {/* Shadow effect under the ticker bar */}
      <div className="absolute top-full left-0 right-0 h-4 pointer-events-none" style={{ 
        background: 'linear-gradient(to bottom, rgb(0, 0, 0), transparent)',
        zIndex: 10
      }} />
    </div>
  );
}

