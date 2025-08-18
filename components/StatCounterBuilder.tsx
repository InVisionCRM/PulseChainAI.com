'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import NewMultiTokenPreview from './NewMultiTokenPreview';
import StatBuilderHeader from './StatBuilderHeader';
import CodeGenerationModal from './CodeGenerationModal';
import { pulsechainApi, fetchDexScreenerData } from '@/services';

// Types
export interface TokenData {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply?: string;
  price?: number;
  marketCap?: number;
  volume24h?: number;
  liquidity?: number;
  lpCount?: number;
  holders?: number;
  // DEXScreener specific fields
  dexScreenerData?: {
    price: number;
    priceChange24h: number;
    marketCap: number;
    volume24h: number;
    liquidity: number;
    lpCount: number;
    pairs: Array<{
      dexId: string;
      pairAddress: string;
      baseToken: { symbol: string; address: string };
      quoteToken: { symbol: string; address: string };
      priceUsd: string;
      priceNative: string;
      volume: { h24: number };
      liquidity: { usd: number };
    }>;
    info?: {
      imageUrl?: string;
      header?: string;
      openGraph?: string;
      websites?: Array<{
        label: string;
        url: string;
      }>;
      socials?: Array<{
        type: string;
        url: string;
      }>;
    };
  };
}

export interface StatConfig {
  id: string;
  name: string;
  label: string;
  description?: string;
  enabled: boolean;
  format: 'number' | 'currency' | 'percentage' | 'address' | 'text';
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

export interface TokenCard {
  id: string;
  token: TokenData | null;
  stats: StatConfig[];
  customization: Record<string, unknown>;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface StatCounterConfig {
  tokens: TokenCard[];
  globalCustomization: Record<string, unknown>;
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

export default function StatCounterBuilder() {
  const [config, setConfig] = useState<StatCounterConfig>({
    tokens: [],
    globalCustomization: {}
  });
  const [statResults, setStatResults] = useState<Record<string, Record<string, unknown>>>({});
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'preview' | 'code'>('preview');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TokenSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);

      try {
        const searchResultsResp = await pulsechainApi.search(query.trim());
        const searchResults = searchResultsResp.data?.items || [];
        
        const tokenResults: TokenSearchResult[] = searchResults
          .filter((result: unknown) => {
            const typedResult = result as { type?: string };
            return typedResult.type === 'token';
          })
          .map((result: unknown) => {
            const typedResult = result as { 
              address?: string | number; 
              name?: string; 
              symbol?: string; 
              icon_url?: string; 
            };
            return {
              address: typeof typedResult.address === 'string' ? typedResult.address : String(typedResult.address),
              name: typedResult.name || '',
              symbol: typedResult.symbol || '',
              decimals: 18,
              totalSupply: undefined,
              type: 'ERC20',
              price: undefined,
              marketCap: undefined,
              volume24h: undefined,
              holders: undefined,
              icon_url: typedResult.icon_url || undefined,
            };
          });
        
        setSearchResults(tokenResults);
      } catch (error) {
        console.error('Token search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    []
  );

  React.useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  // Token card management functions
  const handleAddToken = async (token: TokenSearchResult) => {
    setIsSearching(true);

    try {
      // Use the same API logic as AI agent page
      const [tokenInfoResult, dexScreenerResult] = await Promise.all([
        pulsechainApi.getTokenInfo(token.address),
        fetchDexScreenerData(token.address)
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
        const tokenInfo = tokenInfoResult.data as any;
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
      const newCard: TokenCard = {
        id: `token-${Date.now()}`,
        token: detailedToken,
        stats: [],
        customization: {},
        position: { x: 50, y: 50 },
        size: { width: 400, height: 300 }
      };
      
      setConfig(prev => ({
        ...prev,
        tokens: [...prev.tokens, newCard]
      }));
      
      setSearchQuery('');
      setShowResults(false);
    } catch (error) {
      console.error('Token selection error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const updateTokenCard = (cardId: string, updates: Partial<TokenCard>) => {
    setConfig(prev => ({
      ...prev,
      tokens: prev.tokens.map(card => 
        card.id === cardId ? { ...card, ...updates } : card
      )
    }));
  };

  const deleteTokenCard = (cardId: string) => {
    setConfig(prev => ({
      ...prev,
      tokens: prev.tokens.filter(card => card.id !== cardId)
    }));
    setSelectedCardId(null);
  };

  const updateStatResults = (cardId: string, results: Record<string, unknown>) => {
    setStatResults(prev => ({
      ...prev,
      [cardId]: results
    }));
  };

  const getSelectedCard = () => {
    return config.tokens.find(card => card.id === selectedCardId) || null;
  };

  const handleViewToggle = (view: string) => {
    setCurrentView(view as 'preview' | 'code');
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
    setTimeout(() => {
      setShowResults(false);
    }, 200);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <StatBuilderHeader
        onViewToggle={handleViewToggle}
        currentView={currentView}
      />

      {/* Main Content */}
      <div className="flex-1 relative overflow-hidden">
        {currentView === 'preview' ? (
          /* Preview View */
          <div className="h-full">
            <NewMultiTokenPreview
              config={config}
              statResults={statResults}
              onTokenCardUpdate={updateTokenCard}
              onTokenCardDelete={deleteTokenCard}
              onCardSelect={setSelectedCardId}
              onStatResultsUpdate={updateStatResults}
            />
          </div>
        ) : (
          /* Code View */
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">💻</div>
              <h2 className="text-xl font-semibold mb-4 text-blue-400">
                Code Generation
              </h2>
              <p className="text-gray-300 mb-6">
                Generate embeddable code for your dashboard
              </p>
              <button
                onClick={() => setCodeModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Generate Code
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search Bar at Bottom */}
      <div className="p-4 bg-black/80 backdrop-blur-xl border-t border-white/20">
        <div className="max-w-2xl mx-auto relative">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              placeholder="Search for tokens to add to your dashboard..."
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-300"
              disabled={isSearching}
            />
            
            {/* Loading Indicator */}
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500/50 border-t-white"></div>
              </div>
            )}
          </div>

          {/* Search Results Dropdown (Upwards) */}
          <AnimatePresence>
            {showResults && searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute z-50 w-full bottom-full mb-2 bg-black/90 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl max-h-80 overflow-y-auto"
              >
                {searchResults.map((token, index) => (
                  <motion.div
                    key={token.address}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 hover:bg-white/10 cursor-pointer border-b border-white/10 last:border-b-0 transition-all duration-200"
                    onClick={() => {
                      handleAddToken(token);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-1">
                          <span className="font-semibold text-white">{token.name}</span>
                          <span className="text-sm text-gray-300">({token.symbol})</span>
                        </div>
                        <div className="text-sm text-blue-400 font-mono">
                          {token.address.length > 20 
                            ? `${token.address.slice(0, 8)}...${token.address.slice(-8)}`
                            : token.address
                          }
                        </div>
                      </div>
                      <div 
                        className="ml-4 bg-blue-600 hover:bg-blue-700 hover:scale-110 text-white p-3 rounded-lg transition-all duration-200 z-50 relative cursor-pointer border-2 border-blue-400"
                        style={{ 
                          pointerEvents: 'auto',
                          transform: 'translateZ(0)',
                          position: 'relative',
                          zIndex: 999
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToken(token);
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Code Generation Modal */}
      <CodeGenerationModal
        open={codeModalOpen}
        onClose={() => setCodeModalOpen(false)}
        config={config}
        statResults={statResults}
      />
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