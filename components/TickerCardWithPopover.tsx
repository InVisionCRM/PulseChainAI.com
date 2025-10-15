'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

interface TickerCardProps {
  token: {
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
  };
  onPause?: () => void;
  onResume?: () => void;
}

export function TickerCardWithPopover({ token, onPause, onResume }: TickerCardProps) {
  const router = useRouter();
  const isPositive = token.priceChange24h >= 0;

  const handleClick = () => {
    router.push(`/ai-agent?address=${token.address}`);
  };

  const handleOpenChange = (open: boolean) => {
    console.log(`HoverCard ${token.symbol} opened:`, open);
    if (open) {
      onPause?.();
    } else {
      onResume?.();
    }
  };

  const formatNumber = (num: number | undefined, decimals = 2) => {
    if (num === undefined) return 'N/A';
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(decimals)}`;
  };

  const formatPercent = (num: number | undefined) => {
    if (num === undefined) return 'N/A';
    const isPos = num >= 0;
    return (
      <span style={{ color: isPos ? '#10b981' : '#ef4444' }}>
        {isPos ? '+' : ''}{num.toFixed(2)}%
      </span>
    );
  };

  return (
    <HoverCard openDelay={200} closeDelay={100} onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>
        <div
          onClick={handleClick}
          className="flex items-center gap-2 cursor-pointer hover:bg-white/5 transition-all duration-200 rounded-lg px-3 py-1.5 group"
        >
          <img
            src={`https://dd.dexscreener.com/ds-data/tokens/pulsechain/${token.address}.png?key=6eae20`}
            alt={token.symbol}
            className="w-5 h-5 rounded-full flex-shrink-0 group-hover:scale-110 transition-transform"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <span className="text-sm font-medium text-white/90 whitespace-nowrap">
            {token.symbol} ${token.priceUsd.toFixed(6)}
          </span>
          <span
            className="text-sm font-semibold whitespace-nowrap"
            style={{ color: isPositive ? '#10b981' : '#ef4444' }}
          >
            {isPositive ? '+' : ''}{token.priceChange24h.toFixed(2)}%
          </span>
          <span className="text-white/30 mx-1">•</span>
        </div>
      </HoverCardTrigger>

      <HoverCardContent
        className="w-80 bg-black/98 border-2 border-[#FA4616]/40 shadow-2xl backdrop-blur-xl z-[9999]"
        side="bottom"
        align="center"
      >
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/10">
              <img
                src={`https://dd.dexscreener.com/ds-data/tokens/pulsechain/${token.address}.png?key=6eae20`}
                alt={token.symbol}
                className="w-10 h-10 rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div>
                <div className="text-lg font-bold text-white">{token.symbol}</div>
                <div className="text-xs text-white/50">{token.name}</div>
              </div>
            </div>

            {/* Price Info */}
            <div className="space-y-2 mb-3">
              <div className="flex justify-between items-center">
                <span className="text-white/60 text-sm">Price</span>
                <span className="text-white font-semibold">${token.priceUsd.toFixed(8)}</span>
              </div>
            </div>

            {/* Price Changes */}
            <div className="grid grid-cols-3 gap-2 mb-3 p-2 bg-white/5 rounded-lg">
              <div className="text-center">
                <div className="text-xs text-white/50 mb-1">1h</div>
                <div className="text-sm font-semibold">{formatPercent(token.priceChange1h)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-white/50 mb-1">6h</div>
                <div className="text-sm font-semibold">{formatPercent(token.priceChange6h)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-white/50 mb-1">24h</div>
                <div className="text-sm font-semibold">{formatPercent(token.priceChange24h)}</div>
              </div>
            </div>

            {/* Volume & Liquidity */}
            <div className="space-y-2 mb-3">
              <div className="flex justify-between items-center">
                <span className="text-white/60 text-sm">Volume 24h</span>
                <span className="text-white font-semibold">{formatNumber(token.volume24h, 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/60 text-sm">Liquidity</span>
                <span className="text-white font-semibold">{formatNumber(token.liquidity, 0)}</span>
              </div>
              {token.marketCap && (
                <div className="flex justify-between items-center">
                  <span className="text-white/60 text-sm">Market Cap</span>
                  <span className="text-white font-semibold">{formatNumber(token.marketCap, 0)}</span>
                </div>
              )}
              {token.fdv && (
                <div className="flex justify-between items-center">
                  <span className="text-white/60 text-sm">FDV</span>
                  <span className="text-white font-semibold">{formatNumber(token.fdv, 0)}</span>
                </div>
              )}
            </div>

            {/* Transactions */}
            {token.txCount24h !== undefined && (
              <div className="space-y-2 p-2 bg-white/5 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-white/60 text-sm">Txns 24h</span>
                  <span className="text-white font-semibold">{token.txCount24h}</span>
                </div>
                {token.buys24h !== undefined && token.sells24h !== undefined && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-green-400">Buys: {token.buys24h}</span>
                    <span className="text-red-400">Sells: {token.sells24h}</span>
                  </div>
                )}
              </div>
            )}

          {/* Footer */}
          <div className="mt-3 pt-3 border-t border-white/10 text-center">
            <span className="text-xs text-[#FA4616] font-semibold">
              Click to view details
            </span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
