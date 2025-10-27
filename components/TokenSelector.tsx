'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TokenData } from './StatCounterBuilder';
import { pulsechainApi, dexscreenerApi } from '@/services';

interface TokenSelectorProps {
  selectedToken: TokenData | null;
  onTokenSelect: (token: TokenData | null) => void;
  onError: (error: string | null) => void;
  isLoading: boolean;
}

interface TokenSearchResult {
  address: string;
  name: string;
  symbol: string;
  decimals?: number;
  totalSupply?: string;
  price?: number;
  marketCap?: number;
  volume24h?: number;
  holders?: number;
  type: string;
  icon_url?: string;
}

export default function TokenSelector({ 
  selectedToken, 
  onTokenSelect, 
  onError, 
  isLoading 
}: TokenSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TokenSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);

  // Debounced search function using PulseChain API
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        setSearchSuggestions([]);
        return;
      }

      setIsSearching(true);
      onError(null);
      setSearchSuggestions([]);

      try {
        // Use PulseChain search function for real-time results
        const searchResp = await pulsechainApi.search(query.trim());
        const searchResults = searchResp.data?.items || [];
        
        // Filter for tokens only and convert to our format
        
        const tokenResults: TokenSearchResult[] = searchResults
          .filter(result => result.type === 'token')
          .map(result => ({
            address: typeof result.address === 'string' ? result.address : String(result.address),
            name: result.name || '',
            symbol: result.symbol || '',
            decimals: 18,
            totalSupply: undefined,
            type: 'ERC20',
            price: undefined,
            marketCap: undefined,
            volume24h: undefined,
            holders: undefined,
            icon_url: result.icon_url || undefined,
          }));
        
        if (tokenResults.length > 0) {
          setSearchResults(tokenResults);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error('Token search error:', error);
        onError('Failed to search tokens. Please try again.');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [onError]
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  const handleTokenSelect = async (token: TokenSearchResult) => {
    setIsSearching(true);
    onError(null);

    try {
      // Use the same API logic as AI agent page
      const [tokenInfoResult, dexScreenerResult] = await Promise.all([
        pulsechainApi.getTokenInfo(token.address),
        dexscreenerApi.getTokenData(token.address)
      ]);
      
      let detailedToken: TokenData = {
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals || 18,
        totalSupply: undefined,
        price: undefined,
        marketCap: undefined,
        volume24h: undefined,
        liquidity: undefined,
        lpCount: undefined,
        holders: undefined,
      };

      // Add token info if available
      if (tokenInfoResult?.data) {
        const tokenInfo = tokenInfoResult.data as { 
          total_supply?: string; 
          holders?: number; 
          holders_count?: number; 
        };
        detailedToken = {
          ...detailedToken,
          totalSupply: tokenInfo.total_supply,
          holders: tokenInfo.holders || tokenInfo.holders_count,
        };
      }

      // Add DEXScreener data if available
      if (dexScreenerResult?.data) {
        const dexData = dexScreenerResult.data;
        if (dexData.pairs && dexData.pairs.length > 0) {
          const mainPair = dexData.pairs[0];
          detailedToken = {
            ...detailedToken,
            price: parseFloat(mainPair.priceUsd),
            marketCap: dexData.marketCap,
            volume24h: mainPair.volume?.h24 || 0,
            liquidity: mainPair.liquidity?.usd || 0,
            lpCount: dexData.pairs.length,
            dexScreenerData: {
              ...dexData,
              info: dexData.info // Include the info field with images, socials, etc.
            },
          };
        }
      }
      
      onTokenSelect(detailedToken);
      setSearchQuery(token.name);
      setShowResults(false);
    } catch (error) {
      console.error('Token selection error:', error);
      onError('Failed to fetch token details. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowResults(true);
    
    if (!value.trim()) {
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const handleInputFocus = () => {
    if (searchResults.length > 0) {
      setShowResults(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding results to allow for clicks
    setTimeout(() => {
      setShowResults(false);
    }, 200);
  };



  const clearSelection = () => {
    onTokenSelect(null);
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder="Search for a token by name, symbol, or address..."
          className="w-full bg-white border border-gray-300 rounded-2xl px-8 py-6 text-slate-950 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-lg font-medium transition-all duration-300 hover:bg-gray-50"
          disabled={isLoading || isSearching}
        />
        
        {/* Loading Indicator */}
        {(isLoading || isSearching) && (
          <div className="absolute right-6 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-lime-500/50 border-t-blue-500"></div>
          </div>
        )}

        {/* Clear Button */}
        {selectedToken && (
          <button
            onClick={clearSelection}
            className="absolute right-6 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors duration-200 p-2 rounded-full hover:bg-white/10"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search Tips */}
      {!selectedToken && (
        <div className="mt-4 p-4 bg-transparent border border-white/20 rounded-xl">
          <p className="text-sm text-gray-300 font-medium">💡 Try searching for: "PSSH" or "Superstake" or the contract address</p>
        </div>
      )}

      {/* Search Results */}
      <AnimatePresence>
        {showResults && searchResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-4 bg-transparent border border-white/20 rounded-2xl shadow-2xl max-h-96 overflow-y-auto"
          >
            {searchResults.map((token, index) => (
              <motion.div
                key={token.address}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-6 hover:bg-white/5 cursor-pointer border-b border-white/10 last:border-b-0 transition-all duration-200"
                onClick={() => handleTokenSelect(token)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="font-bold text-white text-xl">{token.name}</span>
                      <span className="text-base text-gray-300 font-medium">({token.symbol})</span>
                    </div>
                    <div className="text-lg text-blue-400 font-mono font-semibold">
                      {token.address.length > 20 
                        ? `${token.address.slice(0, 8)}...${token.address.slice(-8)}`
                        : token.address
                      }
                    </div>
                  </div>
                  {token.price && (
                    <div className="text-right">
                      <div className="text-lg font-semibold text-white">${token.price.toFixed(6)}</div>
                      {token.marketCap && (
                        <div className="text-sm text-gray-300">
                          ${(token.marketCap / 1000000).toFixed(2)}M
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Token Display */}
      {selectedToken && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-8 bg-transparent border border-green-500/30 rounded-2xl"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="mb-3">
                <h4 className="font-bold text-white text-2xl">{selectedToken.name}</h4>
                <p className="text-xl text-gray-300 font-medium">{selectedToken.symbol}</p>
              </div>
              <p className="text-xl text-blue-400 font-mono font-semibold">
                {selectedToken.address.length > 20 
                  ? `${selectedToken.address.slice(0, 8)}...${selectedToken.address.slice(-8)}`
                  : selectedToken.address
                }
              </p>
            </div>
            <div className="text-right">
              {selectedToken.price && (
                <div className="text-2xl font-bold text-white">
                  ${selectedToken.price.toFixed(6)}
                </div>
              )}
              {selectedToken.holders && (
                <div className="text-lg text-gray-300 font-medium">
                  {selectedToken.holders.toLocaleString()} holders
                </div>
              )}
              {selectedToken.marketCap && (
                <div className="text-sm text-gray-400 mt-1">
                  ${(selectedToken.marketCap / 1000000).toFixed(2)}M market cap
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Debounce utility function
function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
} 