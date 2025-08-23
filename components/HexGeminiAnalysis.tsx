"use client";
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AlertTriangle } from 'lucide-react';
import { useHexGemini, type AnalysisType, type HexDataPoint } from '@/lib/hooks/useHexGemini';
import { dexscreenerApi } from '@/services/blockchain/dexscreenerApi';

interface HexGeminiAnalysisProps {
  dataEth?: HexDataPoint[];
  dataPls?: HexDataPoint[];
  defaultNetwork?: 'ethereum' | 'pulsechain';
  defaultTimeframe?: '30d' | '90d' | '180d' | '365d' | 'all';
  concise?: boolean;
  dexTokenAddressEth?: string;
  dexTokenAddressPls?: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const HexGeminiAnalysis: React.FC<HexGeminiAnalysisProps> = ({ 
  dataEth = [], 
  dataPls = [], 
  defaultNetwork = 'pulsechain', 
  defaultTimeframe = 'all', 
  concise = true, 
  dexTokenAddressEth, 
  dexTokenAddressPls 
}) => {
  const [network, setNetwork] = useState<'ethereum' | 'pulsechain' | 'both'>(defaultNetwork);
  const baseData = network === 'ethereum' ? dataEth : network === 'pulsechain' ? dataPls : [...dataEth, ...dataPls];
  const [timeframe, setTimeframe] = useState<'30d' | '90d' | '180d' | '365d' | 'all'>(defaultTimeframe);
  const [forceConcise, setForceConcise] = useState<boolean>(!!concise);
  const [customPrompt, setCustomPrompt] = useState('');
  const [displayAnalysis, setDisplayAnalysis] = useState('');
  const [expanded, setExpanded] = useState<boolean>(false);
  const [dexLiquidityUsd, setDexLiquidityUsd] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState<'all' | 'days'>('all');
  const [customDaysInput, setCustomDaysInput] = useState<string>('');
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  
  const isAnalysisInProgress = useRef(false);
  
  // Check for existing analysis in sessionStorage on mount
  useEffect(() => {
    const sessionKeys = Object.keys(sessionStorage);
    const analysisKeys = sessionKeys.filter(key => key.startsWith('hex-analysis-'));
    
    if (analysisKeys.length > 0) {
      const latestKey = analysisKeys.sort().pop();
      if (latestKey) {
        const existingAnalysis = sessionStorage.getItem(latestKey);
        if (existingAnalysis && existingAnalysis.length > 0) {
          console.log('🔄 Recovering analysis from sessionStorage:', existingAnalysis.length, 'chars');
          setDisplayAnalysis(existingAnalysis);
        }
      }
    }
  }, []);

  const { analyzeData, isLoading, error, clearError } = useHexGemini({
    onAnalysisUpdate: (analysis) => {
      console.log('🔄 Updating analysis display...');
      setDisplayAnalysis(analysis);
    },
    onComplete: (finalAnalysis) => {
      console.log('✅ Analysis completed');
      console.log('📝 Final analysis content:', finalAnalysis);
      console.log('📏 Analysis length:', finalAnalysis ? finalAnalysis.length : 0);
      isAnalysisInProgress.current = false;
      setDisplayAnalysis(finalAnalysis);
      
      // Add to conversation history
      setConversationHistory(prev => [...prev, {
        role: 'assistant',
        content: finalAnalysis,
        timestamp: new Date()
      }]);
    },
    onError: (error) => {
      console.error('❌ Analysis error:', error);
    }
  });

  // Fetch DexScreener liquidity when a token address is provided
  useEffect(() => {
    const loadDex = async () => {
      try {
        let totalLiquidity = 0;
        
        if (network === 'ethereum' && dexTokenAddressEth) {
          const res = await dexscreenerApi.getTokenData(dexTokenAddressEth);
          if (res.success && res.data) {
            const liquidity = extractLiquidity(res.data);
            if (liquidity) totalLiquidity += liquidity;
          }
        }
        
        if (network === 'pulsechain' && dexTokenAddressPls) {
          const res = await dexscreenerApi.getTokenData(dexTokenAddressPls);
          if (res.success && res.data) {
            const liquidity = extractLiquidity(res.data);
            if (liquidity) totalLiquidity += liquidity;
          }
        }
        
        if (network === 'both') {
          if (dexTokenAddressEth) {
            const res = await dexscreenerApi.getTokenData(dexTokenAddressEth);
            if (res.success && res.data) {
              const liquidity = extractLiquidity(res.data);
              if (liquidity) totalLiquidity += liquidity;
            }
          }
          if (dexTokenAddressPls) {
            const res = await dexscreenerApi.getTokenData(dexTokenAddressPls);
            if (res.success && res.data) {
              const liquidity = extractLiquidity(res.data);
              if (liquidity) totalLiquidity += liquidity;
            }
          }
        }
        
        setDexLiquidityUsd(totalLiquidity > 0 ? totalLiquidity : null);
      } catch {
        setDexLiquidityUsd(null);
      }
    };
    
    const extractLiquidity = (data: unknown): number | null => {
      type PairLike = { liquidity?: { usd?: number }; liquidityUsd?: number };
      const raw = data as unknown;
      const maybePairsA = (raw as { pairs?: PairLike[] }).pairs;
      const maybePairsB = (raw as { data?: PairLike[] }).data;
      const pairs: PairLike[] = Array.isArray(maybePairsA) ? maybePairsA
        : Array.isArray(maybePairsB) ? maybePairsB
        : [];
      
      if (Array.isArray(pairs) && pairs.length > 0) {
        const total = pairs.reduce((sum: number, p: PairLike) => {
          const liq = (p && p.liquidity && typeof p.liquidity.usd === 'number') ? p.liquidity.usd
            : (typeof p?.liquidityUsd === 'number' ? p.liquidityUsd : 0);
          const val = Number.isFinite(liq) ? liq : 0;
          return sum + val;
        }, 0);
        return total > 0 ? total : null;
      }
      return null;
    };
    
    void loadDex();
  }, [network, dexTokenAddressEth, dexTokenAddressPls]);

  // Filter data by timeframe
  const filteredData: HexDataPoint[] = React.useMemo(() => {
    if (timeframe === 'all') return baseData;
    if (baseData.length === 0) return baseData;
    const latestTs = new Date(baseData[0].date).getTime();
    const daysMap = { '30d': 30, '90d': 90, '180d': 180, '365d': 365 } as const;
    const cutoff = latestTs - daysMap[timeframe as keyof typeof daysMap] * 24 * 60 * 60 * 1000;
    return baseData.filter(d => new Date(d.date).getTime() >= cutoff);
  }, [baseData, timeframe]);

  // Output constraints for concise, actionable answers
  const conciseDirectives = React.useMemo(() => (
    forceConcise
      ? 'Output format: Use bullet list (max 8 bullets), one line per bullet. Each bullet must include concrete numbers (value and % delta vs start of window). Avoid introductions and conclusions. End with one single-sentence takeaway.'
      : ''
  ), [forceConcise]);

  // Compute selected datapoints from filteredData
  const selectedData: HexDataPoint[] = React.useMemo(() => {
    if (selectionMode === 'all') return filteredData;
    const set = new Set<number>(
      customDaysInput
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(n => Number(n))
        .filter(n => Number.isFinite(n))
    );
    if (set.size === 0) return filteredData;
    return filteredData.filter(d => typeof d.currentDay === 'number' && set.has(d.currentDay as number));
  }, [filteredData, selectionMode, customDaysInput]);

  const handleCustomAnalysis = async () => {
    if (!customPrompt.trim()) {
      alert('Please enter a custom analysis prompt');
      return;
    }

    if (isAnalysisInProgress.current) {
      console.log('⚠️ Analysis already in progress, ignoring request');
      return;
    }
    
    if (localStorage.getItem('hex-analysis-in-progress') === 'true') {
      console.log('⚠️ Analysis already in progress (from localStorage), ignoring request');
      return;
    }

    console.log('🔍 Starting custom analysis with data:', {
      dataLength: filteredData.length,
      firstRecord: filteredData[0]
    });

    isAnalysisInProgress.current = true;
    clearError();
    
    // Add user message to conversation history
    setConversationHistory(prev => [...prev, {
      role: 'user',
      content: customPrompt,
      timestamp: new Date()
    }]);
    
    try {
      const networkDirective = network === 'both' 
        ? 'Network scope: Analyze BOTH PulseChain HEX and Ethereum HEX, compare and contrast when relevant.'
        : `Network scope: Analyze ONLY ${network === 'pulsechain' ? 'PulseChain HEX' : 'Ethereum HEX'}.`;
      const dataQualityDirective =
        'Data quality rules: Treat 0 or null values for price, T-Share price, payout per T-Share, and liquidity as missing data (N/A) unless corroborated by multiple fields. Prefer the latest NON-future date. If any metric appears as 0 but others indicate activity (e.g., penalties exist), flag as data anomaly and proceed using available non-zero proxies (e.g., pricePulseX for PulseChain USD price, or marketCap/circulatingHEX). Do not state "$0" as a definitive current price; use "N/A or data anomaly" instead.';
      const timeframeDirective = `Timeframe: Focus strictly on the last ${timeframe} window. Where helpful, compare against the previous equal window.`;
      const externalDex = dexLiquidityUsd !== null ? `External DEX liquidity (USD): ${dexLiquidityUsd}. If internal Liquidity HEX is 0 or missing, use this as market liquidity proxy. Do not infer zero liquidity if this value is positive.` : '';
      
      // Include conversation context for continuous conversation
      const conversationContext = conversationHistory.length > 0 
        ? `\n\nConversation Context: This is part of an ongoing conversation. Previous user questions: ${conversationHistory.filter(m => m.role === 'user').slice(-3).map(m => m.content).join('; ')}. Previous AI responses: ${conversationHistory.filter(m => m.role === 'assistant').slice(-2).map(m => m.content.substring(0, 200) + '...').join('; ')}.`
        : '';
      
      const combinedPrompt = [networkDirective, dataQualityDirective, timeframeDirective, externalDex, conciseDirectives, conversationContext, customPrompt].filter(Boolean).join('\n\n');

      await analyzeData(selectedData, 'custom_analysis', combinedPrompt);
    } catch (err) {
      console.error('Custom analysis failed:', err);
    } finally {
      isAnalysisInProgress.current = false;
    }
  };

  // Get background image based on network selection
  const getBackgroundImage = () => {
    switch (network) {
      case 'ethereum':
        return '/app-pics/eth-banner.png';
      case 'pulsechain':
        return '/app-pics/clean.png';
      case 'both':
        return '/app-pics/hex-pulse-staking.jpg';
      default:
        return '/app-pics/clean.png';
    }
  };

  // Get background image alt text based on network selection
  const getBackgroundAlt = () => {
    switch (network) {
      case 'ethereum':
        return 'Ethereum HEX Analysis Background';
      case 'pulsechain':
        return 'PulseChain HEX Analysis Background';
      case 'both':
        return 'Both Networks HEX Analysis Background - Hexagonal Portal Journey';
      default:
        return 'PulseChain HEX Analysis Background';
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl p-[1px] bg-gradient-to-br from-white/10 via-white/5 to-white/10 shadow-[0_0_40px_-15px_rgba(168,85,247,0.45)]">
      <div className="relative bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]">
        {/* Dynamic Background Image */}
        <div className="absolute inset-0 -z-10">
          <img 
            src={getBackgroundImage()}
            alt={getBackgroundAlt()}
            className="w-full h-full object-cover opacity-40"
            onError={(e) => {
              console.error('Failed to load background image:', e);
              console.error('Image path attempted:', getBackgroundImage());
              e.currentTarget.style.display = 'none';
            }}
            onLoad={(e) => {
              console.log('Background image loaded successfully:', getBackgroundImage());
              console.log('Image dimensions:', e.currentTarget.naturalWidth, 'x', e.currentTarget.naturalHeight);
            }}
            style={{ 
              display: 'block',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
          />
          {/* Black overlay for better text contrast */}
          <div className="absolute inset-0 bg-black/50"></div>
        </div>

        {/* Ambient glow */}
        <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-purple-600/210 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-2xl" />

        {/* Network Selection */}
        <div className="mb-2 flex items-center gap-3 relative z-10">
          <label htmlFor="hex-analysis-network" className="text-sm text-white font-medium">Network:</label>
          <select
            id="hex-analysis-network"
            value={network}
            onChange={(e)=> setNetwork(e.target.value as 'ethereum' | 'pulsechain' | 'both')}
            className="text-sm bg-white/40 border border-white/20 text-black rounded-lg px-3 py-1 transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500/60"
          >
            <option value="pulsechain">PulseChain HEX</option>
            <option value="ethereum">Ethereum HEX</option>
            <option value="both">Both Networks</option>
          </select>
        </div>

        {/* Custom Analysis Input */}
        <div className="mb-2 relative z-10">
          <div className="space-y-3">
            <div className="relative">
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Ask anything about HEX data..."
                className="w-full p-3 pr-20 border border-white/20 bg-white/50 text-slate-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/60 placeholder-slate-800/80 font-bold"
                rows={3}
              />
              <button
                onClick={handleCustomAnalysis}
                disabled={isLoading || !customPrompt.trim()}
                className="absolute right-2 top-2 bg-black text-white border border-cyan-500 font-medium py-1.5 px-3 rounded-md transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-gray-800 text-sm"
              >
                {isLoading ? '...' : 'Ask AI'}
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 text-red-300 rounded-lg shadow-[0_0_25px_-15px_rgba(239,68,68,0.7)] relative z-10">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">Analysis Error</span>
            </div>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={clearError}
              className="text-xs text-red-300 hover:text-white mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Analysis Display */}
        {(isLoading || displayAnalysis) && (
          <div className="mb-4 p-4 rounded-2xl border border-white/20 bg-white/10 shadow-[inset_0_0_60px_-30px_rgba(168,85,247,0.4)] relative z-10">
            {isLoading && (
              <div className="flex items-center gap-2 mb-3">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.8)]"></div>
                <span className="text-white font-medium drop-shadow-[0_0_10px_rgba(168,85,247,0.6)]">
                  Analyzing your question...
                </span>
              </div>
            )}
            {displayAnalysis && (
              <>
                <div className="prose prose-invert max-w-none prose-headings:font-bold prose-p:leading-relaxed prose-ul:my-2 prose-li:my-0.5 prose-strong:font-bold text-white/90 prose-strong:text-white">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {expanded ? displayAnalysis : (() => {
                      const lines = displayAnalysis.split('\n');
                      const maxLines = 12;
                      if (lines.length <= maxLines) return displayAnalysis;
                      return lines.slice(0, maxLines).join('\n') + '\n\n…';
                    })()}
                  </ReactMarkdown>
                </div>
                {displayAnalysis.split('\n').length > 12 && (
                  <div className="mt-2">
                    <button
                      onClick={() => setExpanded(e => !e)}
                      className="text-xs text-purple-300 hover:text-white"
                    >
                      {expanded ? 'Show less' : 'Show more'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Debug Info - Remove this after fixing */}
        <div className="mt-4 p-2 bg-blue-900/20 border border-blue-500/30 rounded text-xs text-blue-300 relative z-10">
          <div>Debug: isLoading={isLoading.toString()}</div>
          <div>Debug: displayAnalysis length={displayAnalysis ? displayAnalysis.length : 0}</div>
          <div>Debug: displayAnalysis preview={displayAnalysis ? displayAnalysis.substring(0, 100) + '...' : 'None'}</div>
          <button 
            onClick={async () => {
              try {
                console.log('🧪 Testing API connection...');
                const testResponse = await fetch('/api/hex-gemini', {
                  method: 'GET'
                });
                console.log('🧪 Test response status:', testResponse.status);
                const testData = await testResponse.json();
                console.log('🧪 Test response data:', testData);
              } catch (testError) {
                console.error('🧪 Test API error:', testError);
              }
            }}
            className="mt-2 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
          >
            Test API Connection
          </button>
        </div>

        {/* Conversation History Indicator */}
        {conversationHistory.length > 0 && (
          <div className="mt-4 text-xs text-white/60 relative z-10">
            💬 Continuous conversation: {conversationHistory.length} messages exchanged
          </div>
        )}
      </div>
    </div>
  );
};

export default HexGeminiAnalysis; 