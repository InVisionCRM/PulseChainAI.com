"use client";

import React, { useState, useEffect } from 'react';
import { LoaderThree } from '@/components/ui/loader';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { pulsechainApi } from '@/services/blockchain/pulsechainApi';
import { dexscreenerApi } from '@/services/blockchain/dexscreenerApi';
import { moralisApi } from '@/services/blockchain/moralisApi';

interface PortfolioToken {
  address: string;
  name: string;
  symbol: string;
  balance: string;
  balanceFormatted: string;
  decimals: number;
  logoURI?: string;
  priceUsd?: string;
  priceChange?: number;
  valueUsd?: string;
}

export interface GeickoPortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  holderAddress: string | null;
}

export default function GeickoPortfolioModal({
  isOpen,
  onClose,
  holderAddress,
}: GeickoPortfolioModalProps) {
  const [portfolio, setPortfolio] = useState<PortfolioToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolio = async (address: string) => {
    setIsLoading(true);
    setError(null);
    setPortfolio([]);

    try {
      // First try PulseChain API for token balances
      const tokenBalancesResponse = await pulsechainApi.getAddressTokenBalances(address);

      if (!tokenBalancesResponse.success || !tokenBalancesResponse.data) {
        throw new Error(tokenBalancesResponse.error || 'Failed to fetch token balances');
      }

      const tokenBalances = tokenBalancesResponse.data;
      const enrichedTokens: PortfolioToken[] = [];

      // Process each token balance
      for (const balance of tokenBalances) {
        try {
          const tokenAddress = balance.token?.address || balance.contractAddress;
          const rawBalance = balance.value || balance.balance || '0';
          const decimals = balance.token?.decimals || balance.decimals || 18;

          // Skip zero balances
          if (parseFloat(rawBalance) === 0) continue;

          // Get token profile from DexScreener
          const profileResponse = await dexscreenerApi.getTokenProfile(tokenAddress);

          let tokenInfo: PortfolioToken = {
            address: tokenAddress,
            name: balance.token?.name || balance.name || 'Unknown Token',
            symbol: balance.token?.symbol || balance.symbol || 'UNKNOWN',
            balance: rawBalance,
            balanceFormatted: Math.floor(parseFloat(rawBalance) / Math.pow(10, decimals)).toLocaleString(),
            decimals,
            logoURI: balance.token?.logoURI || balance.logoURI,
          };

          if (profileResponse.success && profileResponse.data) {
            const profile = profileResponse.data;
            tokenInfo = {
              ...tokenInfo,
              name: profile.tokenInfo?.name || tokenInfo.name,
              symbol: profile.tokenInfo?.symbol || tokenInfo.symbol,
              logoURI: profile.tokenInfo?.logoURI || profile.profile?.logo || tokenInfo.logoURI,
              priceUsd: profile.marketData?.priceUsd?.toString(),
              priceChange: (() => {
                const change = profile.marketData?.priceChange;
                if (change === null || change === undefined) return undefined;
                const parsed = parseFloat(change.toString());
                return isNaN(parsed) ? undefined : parsed;
              })(),
            };

            // Calculate USD value if we have price
            if (tokenInfo.priceUsd) {
              const balanceNum = parseFloat(rawBalance) / Math.pow(10, decimals);
              const priceNum = parseFloat(tokenInfo.priceUsd);
              tokenInfo.valueUsd = (balanceNum * priceNum).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              });
            }
          }

          enrichedTokens.push(tokenInfo);
        } catch (tokenError) {
          console.warn(`Failed to enrich token ${balance.token?.address}:`, tokenError);
          // Still add the token with basic info
          const tokenAddress = balance.token?.address || balance.contractAddress;
          const rawBalance = balance.value || balance.balance || '0';
          const decimals = balance.token?.decimals || balance.decimals || 18;

          if (parseFloat(rawBalance) > 0) {
            enrichedTokens.push({
              address: tokenAddress,
              name: balance.token?.name || balance.name || 'Unknown Token',
              symbol: balance.token?.symbol || balance.symbol || 'UNKNOWN',
              balance: rawBalance,
              balanceFormatted: Math.floor(parseFloat(rawBalance) / Math.pow(10, decimals)).toLocaleString(),
              decimals,
              logoURI: balance.token?.logoURI || balance.logoURI,
            });
          }
        }
      }

      // Sort by USD value (tokens with price first, then by balance)
      enrichedTokens.sort((a, b) => {
        const aValue = a.valueUsd ? parseFloat(a.valueUsd.replace(/,/g, '')) : 0;
        const bValue = b.valueUsd ? parseFloat(b.valueUsd.replace(/,/g, '')) : 0;

        if (aValue > 0 && bValue === 0) return -1;
        if (bValue > 0 && aValue === 0) return 1;

        if (aValue !== bValue) return bValue - aValue;

        // If both have same value or no value, sort by balance
        return parseFloat(b.balance) - parseFloat(a.balance);
      });

      setPortfolio(enrichedTokens);
    } catch (err) {
      console.error('Portfolio fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load portfolio');

      // Try Moralis as fallback
      try {
        if (moralisApi.isAvailable()) {
          const moralisResponse = await moralisApi.getWalletTokenBalances(address);
          if (moralisResponse.success && moralisResponse.data) {
            const moralisTokens = moralisResponse.data.map(balance => ({
              address: balance.token.address,
              name: balance.token.name || 'Unknown Token',
              symbol: balance.token.symbol || 'UNKNOWN',
              balance: balance.value,
              balanceFormatted: Math.floor(parseFloat(balance.value) / Math.pow(10, balance.token.decimals)).toLocaleString(),
              decimals: balance.token.decimals,
              logoURI: balance.token.icon_url,
            }));

            setPortfolio(moralisTokens);
            setError(null); // Clear error since we have fallback data
          }
        }
      } catch (moralisError) {
        console.error('Moralis fallback failed:', moralisError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && holderAddress) {
      fetchPortfolio(holderAddress);
    }
  }, [isOpen, holderAddress]);

  const formatAddress = (address: string) => {
    if (!address) return 'Unknown';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatPrice = (price: string | undefined) => {
    if (!price) return 'N/A';
    const numPrice = parseFloat(price);
    if (numPrice < 0.000001) {
      return `$${numPrice.toExponential(2)}`;
    }
    return `$${numPrice.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    })}`;
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden bg-brand-navy border-white/20">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">
            Portfolio - {holderAddress ? formatAddress(holderAddress) : 'Unknown Address'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <LoaderThree />
                <p className="text-gray-400 text-sm mt-2">Loading portfolio...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center text-red-400">
                <div className="text-2xl mb-2">⚠️</div>
                <div className="text-sm">Error loading portfolio</div>
                <div className="text-xs text-gray-400 mt-1">{error}</div>
              </div>
            </div>
          ) : portfolio.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center text-gray-400">
                <div className="text-2xl mb-2">📊</div>
                <div className="text-sm">No tokens found</div>
                <div className="text-xs mt-1">This address holds no tokens</div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-11 gap-1 px-1 py-2 text-xs font-semibold text-white/60 border-b border-white/10 bg-white/5 rounded">
                <div className="col-span-1 text-left">#</div>
                <div className="col-span-4 text-left">Token</div>
                <div className="col-span-2 text-left">Balance</div>
                <div className="col-span-2 text-left">Price</div>
                <div className="col-span-2 text-left">Value</div>
              </div>

              {/* Token Rows */}
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {portfolio.map((token, index) => (
                  <div
                    key={token.address}
                    className="grid grid-cols-11 gap-4 px-3 py-2 text-sm hover:bg-white/5 rounded transition-colors"
                  >
                    {/* Rank */}
                    <div className="col-span-1 text-white/60 font-medium">{index + 1}</div>

                    {/* Token Info */}
                    <div className="col-span-3 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {token.logoURI ? (
                          <img
                            src={token.logoURI}
                            alt={token.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`w-full h-full flex items-center justify-center text-xs ${token.logoURI ? 'hidden' : ''}`}>
                          {token.symbol.slice(0, 2).toUpperCase()}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-white truncate">{token.name}</div>
                        <div className="text-xs text-white/60 truncate">{token.symbol}</div>
                      </div>
                    </div>

                    {/* Balance */}
                    <div className="col-span-3 text-left text-white font-mono">
                      {token.balanceFormatted}
                    </div>

                    {/* Price */}
                    <div className="col-span-2 text-left text-white font-mono">
                      {formatPrice(token.priceUsd)}
                    </div>

                    {/* Value */}
                    <div className="col-span-2 text-left text-white font-semibold font-mono">
                      {token.valueUsd ? `$${token.valueUsd}` : 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}