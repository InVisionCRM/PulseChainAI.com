'use client';

import { useEffect, useState } from 'react';
import { InfiniteMovingCards } from '@/components/ui/infinite-moving-cards';

interface TrendingToken {
  address: string;
  symbol: string;
  name: string;
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  pairAddress: string;
}

export function TrendingTokensScroll({ onTokenClick }: { onTokenClick?: (address: string) => void }) {
  const [tokens, setTokens] = useState<TrendingToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTrendingTokens = async () => {
      try {
        const response = await fetch('/api/pulsechain-trending?limit=20&minLiquidity=1000&minVolume=50');
        const data = await response.json();

        if (data.success && data.tokens) {
          setTokens(data.tokens);
        }
      } catch (error) {
        console.error('Error fetching trending tokens:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrendingTokens();

    // Refresh every 2 minutes
    const interval = setInterval(fetchTrendingTokens, 120000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="w-full h-12 flex items-center justify-center">
        <div className="animate-pulse text-white/60 text-sm">Loading trending tokens...</div>
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div className="w-full h-12 flex items-center justify-center">
        <div className="text-white/60 text-sm">No trending tokens found</div>
      </div>
    );
  }

  // Format tokens for InfiniteMovingCards
  const formattedTokens = tokens.map(token => {
    const priceChange = token.priceChange24h;
    const isPositive = priceChange >= 0;

    return {
      quote: `${token.symbol} $${token.priceUsd.toFixed(6)}`,
      name: token.name,
      logo: `https://dd.dexscreener.com/ds-data/tokens/pulsechain/${token.address}.png?key=6eae20`,
      changeColor: isPositive ? '#10b981' : '#ef4444',
      changeText: `${isPositive ? '+' : ''}${priceChange.toFixed(2)}%`,
      tokenAddress: token.address,
    };
  });

  return (
    <div className="w-full">
      <InfiniteMovingCards
        items={formattedTokens}
        direction="left"
        speed="fast"
        pauseOnHover={true}
        onItemClick={onTokenClick}
        className="py-1"
      />
    </div>
  );
}
