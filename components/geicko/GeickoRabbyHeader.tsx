import React from 'react';
import { Copy } from 'lucide-react';
import { formatPercentChange, formatCurrencyCompact } from './utils';

export interface GeickoRabbyHeaderProps {
  /** Wallet/token address */
  walletAddress: string;
  /** Primary trading pair data */
  primaryPair: any;
  /** Price change percentage (24h) */
  priceChange: number;
  /** Callback when copy address button is clicked */
  onCopyAddress: (address: string) => void;
  /** Callback when chart button is clicked */
  onOpenChart: () => void;
}

/**
 * Rabby wallet-style header for Geicko
 * Displays portfolio price, sparkline chart, liquidity and volume
 */
export default function GeickoRabbyHeader({
  walletAddress,
  primaryPair,
  priceChange,
  onCopyAddress,
  onOpenChart,
}: GeickoRabbyHeaderProps) {
  const displayAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '0x—';

  const heroPrice = Number(primaryPair?.priceUsd || 0);
  const heroPriceDisplay = heroPrice
    ? `$${heroPrice.toFixed(heroPrice >= 1 ? 2 : 4)}`
    : '$0.0000';
  const heroChangeDisplay = formatPercentChange(priceChange);
  const heroVolumeDisplay = formatCurrencyCompact(primaryPair?.volume?.h24);
  const heroLiquidityDisplay = formatCurrencyCompact(primaryPair?.liquidity?.usd);
  const sparklinePath = 'M0 80 C80 20 160 110 240 50 C320 90 400 30 480 70';

  return (
    <div className="min-h-screen bg-[#eef2ff] text-[#0f172a]">
      <header className="bg-[#1c2cf8] text-white px-4 py-5 sm:px-8 sm:py-7 shadow-[0_20px_60px_rgba(28,44,248,0.35)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-lg font-semibold">
              <span role="img" aria-label="ledger">
                👛
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide">Ledger 1</p>
              <button
                onClick={() => onCopyAddress(walletAddress)}
                className="text-xs text-white/70 hover:text-white transition-colors inline-flex items-center gap-1"
              >
                {displayAddress}
                <span className="text-white/60">⧉</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Settings button - commented out */}
            {/* <button
              className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-lg"
              title="Settings"
            >
              ⚙️
            </button> */}
          </div>
        </div>

        {/* Portfolio Card */}
        <div className="relative mt-6 rounded-[24px] bg-[#2334ff] border border-white/15 p-5 shadow-[0_15px_40px_rgba(15,15,40,0.35)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/70">Portfolio</p>
              <p className="text-4xl font-black tracking-tight mt-1">{heroPriceDisplay}</p>
              <p
                className={`text-sm font-semibold ${
                  priceChange >= 0 ? 'text-emerald-200' : 'text-rose-200'
                }`}
              >
                {heroChangeDisplay}
              </p>
            </div>
            <button
              onClick={onOpenChart}
              className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center"
              title="Open chart"
            >
              →
            </button>
          </div>

          {/* Sparkline Chart */}
          <div className="mt-5 h-24 rounded-3xl bg-white/5 border border-white/10 overflow-hidden">
            <svg viewBox="0 0 500 120" className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="rabbyLine" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8bf7ff" />
                  <stop offset="100%" stopColor="#4de88d" />
                </linearGradient>
              </defs>
              <path
                d={sparklinePath}
                fill="none"
                stroke="url(#rabbyLine)"
                strokeWidth="8"
                strokeLinecap="round"
                opacity="0.9"
              />
            </svg>
          </div>

          {/* Liquidity and Volume Stats */}
          <div className="mt-5 grid grid-cols-2 gap-3 text-xs text-white/80">
            <div className="rounded-2xl bg-white/10 px-3 py-2 flex items-center justify-between">
              <span>Liquidity</span>
              <span className="font-semibold text-white">{heroLiquidityDisplay}</span>
            </div>
            <div className="rounded-2xl bg-white/10 px-3 py-2 flex items-center justify-between">
              <span>Volume 24h</span>
              <span className="font-semibold text-white">{heroVolumeDisplay}</span>
            </div>
          </div>

          {/* Copy Address Button */}
          {walletAddress && (
            <button
              onClick={() => onCopyAddress(walletAddress)}
              className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition-colors bg-[#2334ff]/50 backdrop-blur-sm px-2 py-1 rounded-lg"
              title="Copy contract address"
            >
              <span className="font-mono">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
              <Copy className="w-3.5 h-3.5 text-blue-400" />
            </button>
          )}
        </div>
      </header>
    </div>
  );
}
