import React from 'react';
import { Copy } from 'lucide-react';
import { LoaderThree } from '@/components/ui/loader';
import { DexScreenerData, TokenInfo } from './types';
import { formatMarketCapLabel } from './utils';

export interface GeickoMobileTokenHeaderProps {
  /** DexScreener data with pairs and token info */
  dexScreenerData: DexScreenerData | null;
  /** Token info from API */
  tokenInfo: TokenInfo | null;
  /** Token contract address */
  apiTokenAddress: string;
  /** Is data currently loading */
  isLoadingData: boolean;
  /** Callback when copy address button is clicked */
  onCopyAddress: (address: string) => void;
}

/**
 * Mobile token header component for Geicko
 * Displays token logo, ticker, price, market cap on mobile devices
 */
export default function GeickoMobileTokenHeader({
  dexScreenerData,
  tokenInfo,
  apiTokenAddress,
  isLoadingData,
  onCopyAddress,
}: GeickoMobileTokenHeaderProps) {
  const primaryPair = dexScreenerData?.pairs?.[0];

  return (
    <div className="sm:hidden px-2 mb-2 mt-0">
      {isLoadingData ? (
        <div className="flex items-center justify-center py-4">
          <LoaderThree />
        </div>
      ) : primaryPair ? (
        <div className="relative flex gap-2 min-h-[140px] pt-0 rounded-lg overflow-hidden">
          {/* Left side: Token info */}
          <div className="flex-1 min-w-0">
            {/* Ticker and Name */}
            <div className="absolute z-10 left-0 top-0 text-left mb-0">
              <div className="bg-slate-900/90 backdrop-blur-lg rounded-xs p-2">
                <div className="text-md font-bold text-white">
                  {dexScreenerData?.tokenInfo?.symbol || primaryPair.baseToken?.symbol} /{' '}
                  {primaryPair.quoteToken?.symbol}
                </div>
                <div className="text-xs text-gray-400">
                  {dexScreenerData?.tokenInfo?.name ||
                    tokenInfo?.name ||
                    primaryPair.baseToken?.name ||
                    'Token'}
                </div>
              </div>
            </div>

            {/* Token Logo - Centered below ticker/name */}
            <div className="absolute z-20 left-6 bottom-0 bg-slate-900/90/30 backdrop-blur-xs rounded-full p-2 mb-1">
              {(dexScreenerData?.tokenInfo?.logoURI ||
                primaryPair?.baseToken?.logoURI ||
                primaryPair?.info?.imageUrl) ? (
                <img
                  src={
                    dexScreenerData?.tokenInfo?.logoURI ||
                    primaryPair?.baseToken?.logoURI ||
                    primaryPair?.info?.imageUrl
                  }
                  alt={`${dexScreenerData?.tokenInfo?.symbol || primaryPair.baseToken?.symbol} logo`}
                  className="w-16 h-16 rounded-full bg-gray-950"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div
                className={`w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center ${
                  dexScreenerData?.tokenInfo?.logoURI ||
                  primaryPair?.baseToken?.logoURI ||
                  primaryPair?.info?.imageUrl
                    ? 'hidden'
                    : ''
                }`}
              >
                <span className="text-white font-bold text-xl">
                  {dexScreenerData?.tokenInfo?.symbol?.charAt(0) ||
                    primaryPair.baseToken?.symbol?.charAt(0) ||
                    'T'}
                </span>
              </div>
            </div>

            {/* Current Price */}
            <div className="absolute right-4 top-2">
              <div className="text-xl font-bold text-white">
                ${Number(primaryPair.priceUsd || 0).toFixed(6)}
              </div>
              <div
                className={`text-md ${
                  (primaryPair.priceChange?.h24 || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {(primaryPair.priceChange?.h24 || 0) >= 0 ? '↑' : '↓'}
                {Math.abs(primaryPair.priceChange?.h24 || 0).toFixed(2)}%
              </div>
              <div className="text-lg font-bold text-gray-300">
                {formatMarketCapLabel(primaryPair.marketCap)}
              </div>
            </div>
          </div>

          {/* Background - Zoomed Logo with Overlay */}
          <div className="absolute inset-0 w-full h-full overflow-hidden -z-10">
            {(dexScreenerData?.tokenInfo?.logoURI ||
              primaryPair?.baseToken?.logoURI ||
              primaryPair?.info?.imageUrl) ? (
              <>
                <img
                  src={
                    dexScreenerData?.tokenInfo?.logoURI ||
                    primaryPair?.baseToken?.logoURI ||
                    primaryPair?.info?.imageUrl
                  }
                  alt="Background Logo"
                  className="w-full h-full object-cover blur-xl scale-150 opacity-50"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="absolute inset-0 bg-slate-900/90/70" />
              </>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" />
            )}
          </div>

          {/* Copy Address Button */}
          {apiTokenAddress && (
            <button
              onClick={() => onCopyAddress(apiTokenAddress)}
              className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition-colors bg-slate-900/90/30 backdrop-blur-sm px-2 py-1 rounded-lg"
              title="Copy contract address"
            >
              <span className="font-mono">
                {apiTokenAddress.slice(0, 6)}...{apiTokenAddress.slice(-4)}
              </span>
              <Copy className="w-3.5 h-3.5 text-blue-400" />
            </button>
          )}
        </div>
      ) : (
        <div className="text-xs text-gray-400 py-4">No token data available</div>
      )}
    </div>
  );
}
