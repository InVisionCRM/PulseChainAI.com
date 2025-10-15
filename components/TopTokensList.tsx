'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';

interface Token {
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

export function TopTokensList() {
  const router = useRouter();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTopTokens = async () => {
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
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopTokens();
    // Refresh every 2 minutes
    const interval = setInterval(fetchTopTokens, 120000);
    return () => clearInterval(interval);
  }, []);

  const handleTokenClick = (address: string) => {
    router.push(`/ai-agent?address=${address}`);
  };

  const formatNumber = (num: number, decimals = 2) => {
    if (num >= 1000000000) return `$${(num / 1000000000).toFixed(2)}B`;
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(decimals)}`;
  };

  const formatPrice = (price: number) => {
    if (price >= 1) return `$${price.toFixed(4)}`;
    if (price >= 0.01) return `$${price.toFixed(6)}`;
    return `$${price.toFixed(8)}`;
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'from-yellow-400 to-yellow-600';
    if (rank === 2) return 'from-gray-300 to-gray-500';
    if (rank === 3) return 'from-orange-400 to-orange-600';
    return 'from-blue-500 to-purple-600';
  };

  if (isLoading) {
    return (
      <div className="w-full py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FA4616]"></div>
            <p className="mt-4 text-white/60">Loading top tokens...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-16 relative" style={{ backgroundColor: '#0C2340' }}>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#FA4616]/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Top <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FA4616] to-orange-400">15</span> Tokens
            </h2>
            <p className="text-white/60 text-lg">
              Our Favorite Tokens On PulseChain
            </p>
          </motion.div>
        </div>

        {/* Tokens Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tokens.map((token, index) => {
            const isPositive = token.priceChange24h >= 0;
            const buyPressure = (token.buys24h / (token.buys24h + token.sells24h)) * 100;

            return (
              <motion.div
                key={token.address}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                onClick={() => handleTokenClick(token.address)}
                className="group relative cursor-pointer"
              >
                {/* Card */}
                <div className="relative bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden transition-all duration-300 hover:border-[#FA4616]/50 hover:shadow-xl hover:shadow-[#FA4616]/20 hover:-translate-y-1">
                  {/* Rank Badge */}
                  <div className="absolute top-4 left-4 z-10">
                    <div className={`bg-gradient-to-r ${getRankBadgeColor(token.rank)} text-white font-bold px-3 py-1 rounded-full text-sm shadow-lg`}>
                      #{token.rank}
                    </div>
                  </div>

                  {/* Glow effect on hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#FA4616]/0 via-[#FA4616]/0 to-[#FA4616]/0 group-hover:from-[#FA4616]/5 group-hover:via-[#FA4616]/10 group-hover:to-[#FA4616]/5 transition-all duration-500"></div>

                  <div className="relative p-6">
                    {/* Token Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <img
                          src={`https://dd.dexscreener.com/ds-data/tokens/pulsechain/${token.address}.png?key=6eae20`}
                          alt={token.symbol}
                          className="w-12 h-12 rounded-full border-2 border-white/20 group-hover:border-[#FA4616]/50 transition-colors"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23FA4616" width="100" height="100"/><text x="50" y="50" font-size="40" text-anchor="middle" dy=".3em" fill="white">?</text></svg>';
                          }}
                        />
                        <div>
                          <h3 className="text-xl font-bold text-white group-hover:text-[#FA4616] transition-colors">
                            {token.symbol}
                          </h3>
                          <p className="text-xs text-white/40 truncate max-w-[120px]">
                            {token.name}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mb-4">
                      <div className="text-2xl font-bold text-white mb-1">
                        {formatPrice(token.priceUsd)}
                      </div>
                      <div className={`inline-flex items-center gap-1 text-sm font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        <span>{isPositive ? '↗' : '↘'}</span>
                        <span>{isPositive ? '+' : ''}{token.priceChange24h.toFixed(2)}%</span>
                        <span className="text-white/40 text-xs ml-1">24h</span>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-white/50 text-sm">Volume</span>
                        <span className="text-white font-semibold text-sm">
                          {formatNumber(token.volume24h, 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/50 text-sm">Liquidity</span>
                        <span className="text-white font-semibold text-sm">
                          {formatNumber(token.liquidity, 0)}
                        </span>
                      </div>
                      {token.marketCap && (
                        <div className="flex justify-between items-center">
                          <span className="text-white/50 text-sm">Market Cap</span>
                          <span className="text-white font-semibold text-sm">
                            {formatNumber(token.marketCap, 0)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Buy Pressure Bar */}
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white/50 text-xs">Buy Pressure</span>
                        <span className="text-white font-semibold text-xs">
                          {buyPressure.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
                          style={{ width: `${buyPressure}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between mt-2 text-xs">
                        <span className="text-green-400">{token.buys24h} buys</span>
                        <span className="text-red-400">{token.sells24h} sells</span>
                      </div>
                    </div>

                    {/* Hover CTA */}
                    <div className="mt-4 pt-4 border-t border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="text-center text-[#FA4616] text-sm font-semibold">
                        Click to view details →
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Refresh Info */}
        <div className="text-center mt-12">
          <p className="text-white/40 text-sm">
            Auto-refreshes every 3 minutes • Data from DexScreener
          </p>
        </div>
      </div>
    </div>
  );
}
