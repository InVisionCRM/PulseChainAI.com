"use client";
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Brain, TrendingUp, BarChart3, Target, AlertTriangle, Zap, Activity, Search, MessageSquare } from 'lucide-react';
import { useHexGemini, type AnalysisType, type HexDataPoint } from '@/lib/hooks/useHexGemini';
import { dexscreenerApi } from '@/services/blockchain/dexscreenerApi';

interface HexGeminiAnalysisProps {
  dataEth?: HexDataPoint[];
  dataPls?: HexDataPoint[];
  defaultNetwork?: 'ethereum' | 'pulsechain';
  defaultTimeframe?: '30d' | '90d' | '180d' | '365d' | 'all';
  concise?: boolean;
  dexTokenAddressEth?: string; // optional: HEX on Ethereum
  dexTokenAddressPls?: string; // optional: HEX on PulseChain
}

const analysisTypes: { type: AnalysisType; label: string; icon: React.ReactNode; description: string }[] = [
  {
    type: 'price_analysis',
    label: 'Price Analysis',
    icon: <TrendingUp className="w-5 h-5" />,
    description: 'Analyze price trends, volatility, and momentum indicators'
  },
  {
    type: 'stake_analysis',
    label: 'Staking Analysis',
    icon: <Target className="w-5 h-5" />,
    description: 'Examine staking trends, APY rates, and T-Share dynamics'
  },
  {
    type: 'market_analysis',
    label: 'Market Analysis',
    icon: <BarChart3 className="w-5 h-5" />,
    description: 'Analyze market cap, supply dynamics, and holder distribution'
  },
  {
    type: 'trend_analysis',
    label: 'Trend Analysis',
    icon: <Activity className="w-5 h-5" />,
    description: 'Identify long-term trends, patterns, and cyclical behavior'
  },
  {
    type: 'correlation_analysis',
    label: 'Correlation Analysis',
    icon: <Search className="w-5 h-5" />,
    description: 'Study relationships between price, staking, and external factors'
  },
  {
    type: 'risk_assessment',
    label: 'Risk Assessment',
    icon: <AlertTriangle className="w-5 h-5" />,
    description: 'Evaluate volatility, concentration, and market structure risks'
  },
  {
    type: 'opportunity_analysis',
    label: 'Opportunity Analysis',
    icon: <Zap className="w-5 h-5" />,
    description: 'Identify undervalued indicators and growth opportunities'
  },
  {
    type: 'performance_comparison',
    label: 'Performance Comparison',
    icon: <MessageSquare className="w-5 h-5" />,
    description: 'Compare HEX performance against other assets and benchmarks'
  }
];

const HexGeminiAnalysis: React.FC<HexGeminiAnalysisProps> = ({ dataEth = [], dataPls = [], defaultNetwork = 'pulsechain', defaultTimeframe = '90d', concise = true, dexTokenAddressEth, dexTokenAddressPls }) => {
  const [network, setNetwork] = useState<'ethereum' | 'pulsechain' | 'both'>(defaultNetwork);
  // Do not blend datasets; pick strictly based on network selection
  const baseData = network === 'ethereum' ? dataEth : dataPls;
  const [timeframe, setTimeframe] = useState<'30d' | '90d' | '180d' | '365d' | 'all'>(defaultTimeframe);
  const [forceConcise, setForceConcise] = useState<boolean>(!!concise);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisType | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCustomAnalysis, setShowCustomAnalysis] = useState(false);
  const [displayAnalysis, setDisplayAnalysis] = useState('');
  const [expanded, setExpanded] = useState<boolean>(false);
  const [analysisHistory, setAnalysisHistory] = useState<Array<{
    type: AnalysisType;
    analysis: string;
    timestamp: string;
    network: string;
  }>>([]);
  const [dexLiquidityUsd, setDexLiquidityUsd] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState<'all' | 'days'>('all');
  const [customDaysInput, setCustomDaysInput] = useState<string>('');
  
  // Use ref to track if analysis is in progress to prevent re-render interruptions
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
      console.log('✅ Analysis completed, updating history...');
      isAnalysisInProgress.current = false;
      setDisplayAnalysis(finalAnalysis);
      if (selectedAnalysis) {
        setAnalysisHistory(prev => [{
          type: selectedAnalysis,
          analysis: finalAnalysis,
          timestamp: new Date().toLocaleString(),
          network
        }, ...prev.slice(0, 9)]); // Keep last 10 analyses
      }
      // Keep currentAnalysis visible after completion via displayAnalysis
    },
    onError: (error) => {
      console.error('❌ Analysis error:', error);
    }
  });

  // Fetch DexScreener liquidity when a token address is provided
  useEffect(() => {
    const loadDex = async () => {
      try {
        const addr = network === 'ethereum' ? dexTokenAddressEth : network === 'pulsechain' ? dexTokenAddressPls : undefined;
        if (!addr) {
          setDexLiquidityUsd(null);
          return;
        }
        const res = await dexscreenerApi.getTokenData(addr);
        if (res.success && res.data) {
          type PairLike = { liquidity?: { usd?: number }; liquidityUsd?: number };
          const raw: unknown = (res.data as unknown);
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
            setDexLiquidityUsd(total > 0 ? total : null);
          } else {
            setDexLiquidityUsd(null);
          }
        } else {
          setDexLiquidityUsd(null);
        }
      } catch {
        setDexLiquidityUsd(null);
      }
    };
    void loadDex();
  }, [network, dexTokenAddressEth, dexTokenAddressPls]);

  // Filter data by timeframe
  const filteredData: HexDataPoint[] = React.useMemo(() => {
    if (timeframe === 'all') return baseData;
    // Use range relative to the most recent available record to avoid gaps due to missing days
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

  const handleAnalysis = async (analysisType: AnalysisType) => {
    if (!filteredData || filteredData.length === 0) {
      alert('No data available for analysis');
      return;
    }

    if (isAnalysisInProgress.current) {
      console.log('⚠️ Analysis already in progress, ignoring request');
      return;
    }
    
    // Check if analysis is already in progress in localStorage
    if (localStorage.getItem('hex-analysis-in-progress') === 'true') {
      console.log('⚠️ Analysis already in progress (from localStorage), ignoring request');
      return;
    }

    console.log('🔍 Starting analysis with data:', {
      dataLength: filteredData.length,
      firstRecord: filteredData[0],
      analysisType
    });

    isAnalysisInProgress.current = true;
    setSelectedAnalysis(analysisType);
    clearError();
    
    try {
      const networkDirective =
        network === 'both'
          ? 'Network scope: Analyze BOTH PulseChain HEX and Ethereum HEX, compare and contrast when relevant.'
          : `Network scope: Analyze ONLY ${network === 'pulsechain' ? 'PulseChain HEX' : 'Ethereum HEX'}.`;
      const dataQualityDirective =
        'Data quality rules: Treat 0 or null values for price, T-Share price, payout per T-Share, and liquidity as missing data (N/A) unless corroborated by multiple fields. Prefer the latest NON-future date. If any metric appears as 0 but others indicate activity (e.g., penalties exist), flag as data anomaly and proceed using available non-zero proxies (e.g., pricePulseX for PulseChain USD price, or marketCap/circulatingHEX). Do not state "$0" as a definitive current price; use "N/A or data anomaly" instead.';
      const timeframeDirective = `Timeframe: Focus strictly on the last ${timeframe} window. Where helpful, compare against the previous equal window.`;
      const externalDex = dexLiquidityUsd !== null ? `External DEX liquidity (USD): ${dexLiquidityUsd}. If internal Liquidity HEX is 0 or missing, use this as market liquidity proxy. Do not infer zero liquidity if this value is positive.` : '';
      const combinedPrompt = [networkDirective, dataQualityDirective, timeframeDirective, externalDex, conciseDirectives, showCustomAnalysis ? customPrompt : ''].filter(Boolean).join('\n\n');

      await analyzeData(selectedData, analysisType, combinedPrompt);
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      isAnalysisInProgress.current = false;
    }
  };

  const handleCustomAnalysis = async () => {
    if (!customPrompt.trim()) {
      alert('Please enter a custom analysis prompt');
      return;
    }

    setSelectedAnalysis('custom_analysis');
    clearError();
    
    try {
      const networkDirective =
        network === 'both'
          ? 'Network scope: Analyze BOTH PulseChain HEX and Ethereum HEX, compare and contrast when relevant.'
          : `Network scope: Analyze ONLY ${network === 'pulsechain' ? 'PulseChain HEX' : 'Ethereum HEX'}.`;
      const dataQualityDirective =
        'Data quality rules: Treat 0 or null values for price, T-Share price, payout per T-Share, and liquidity as missing data (N/A) unless corroborated by multiple fields. Prefer the latest NON-future date. If any metric appears as 0 but others indicate activity (e.g., penalties exist), flag as data anomaly and proceed using available non-zero proxies (e.g., pricePulseX for PulseChain USD price, or marketCap/circulatingHEX). Do not state "$0" as a definitive current price; use "N/A or data anomaly" instead.';
      const timeframeDirective = `Timeframe: Focus strictly on the last ${timeframe} window. Where helpful, compare against the previous equal window.`;
      const externalDex = dexLiquidityUsd !== null ? `External DEX liquidity (USD): ${dexLiquidityUsd}. If internal Liquidity HEX is 0 or missing, use this as market liquidity proxy. Do not infer zero liquidity if this value is positive.` : '';
      const combinedPrompt = [networkDirective, dataQualityDirective, timeframeDirective, externalDex, conciseDirectives, customPrompt].filter(Boolean).join('\n\n');
      await analyzeData(selectedData, 'custom_analysis', combinedPrompt);
    } catch (err) {
      console.error('Custom analysis failed:', err);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl p-[1px] bg-gradient-to-br from-white/10 via-white/5 to-white/10 shadow-[0_0_40px_-15px_rgba(168,85,247,0.45)]">
      <div className="relative bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)]">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-purple-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -right-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="flex items-center gap-3 mb-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-white/20 blur-md" />
            <Brain className="relative w-7 h-7 text-purple-200 drop-shadow-[0_0_10px_rgba(168,85,247,0.6)]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">AI-Powered HEX Analysis</h3>
            <p className="text-sm text-slate-400">Insights powered by Gemini — tailored for HEX</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="hex-analysis-network" className="text-xs text-slate-400">Network:</label>
            <select
              id="hex-analysis-network"
              value={network}
              onChange={(e)=> setNetwork(e.target.value as 'ethereum' | 'pulsechain' | 'both')}
              className="text-sm bg-white/5 border border-white/10 text-white rounded-lg px-2 py-1 transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500/60"
            >
              <option value="pulsechain">PulseChain HEX</option>
              <option value="ethereum">Ethereum HEX</option>
            </select>
            <label htmlFor="hex-timeframe" className="text-xs text-slate-400 ml-3">Window:</label>
            <select
              id="hex-timeframe"
              value={timeframe}
              onChange={(e)=> setTimeframe(e.target.value as '30d' | '90d' | '180d' | '365d' | 'all')}
              className="text-sm bg-white/5 border border-white/10 text-white rounded-lg px-2 py-1 transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500/60"
            >
              <option value="30d">30d</option>
              <option value="90d">90d</option>
              <option value="180d">180d</option>
              <option value="365d">365d</option>
              <option value="all">All</option>
            </select>
            <label htmlFor="hex-concise" className="text-xs text-slate-400 ml-3">Concise</label>
            <input
              id="hex-concise"
              type="checkbox"
              className="h-4 w-4 accent-purple-500"
              checked={forceConcise}
              onChange={(e)=> setForceConcise(e.target.checked)}
            />
          </div>
        </div>

      {/* Analysis Type Selection */}
        <div className="mb-6">
          <h4 className="text-md font-semibold text-white mb-3">Choose Analysis Type</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {analysisTypes.map((analysis) => (
              <button
                key={analysis.type}
                onClick={() => handleAnalysis(analysis.type)}
                disabled={isLoading}
                className={`group relative p-4 rounded-xl border text-left transition-all duration-300 ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:translate-y-[-2px]'
                } ${
                  selectedAnalysis === analysis.type
                    ? 'border-purple-500/80 bg-gradient-to-br from-purple-900/40 to-slate-800/40 shadow-[0_0_25px_-10px_rgba(168,85,247,0.8)]'
                    : 'border-slate-600/70 bg-slate-800/40 hover:border-purple-400/70 hover:shadow-[0_0_20px_-12px_rgba(168,85,247,0.7)]'
                }`}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl bg-gradient-to-br from-purple-500/10 via-fuchsia-500/10 to-cyan-500/10" />
                <div className="relative flex items-center gap-2 mb-2">
                  <span className="text-purple-300 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]">{analysis.icon}</span>
                  <span className="font-semibold text-white">{analysis.label}</span>
                </div>
                <p className="relative text-xs text-slate-300">{analysis.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Datapoint Selection */}
        <div className="mb-4">
          <h5 className="text-sm font-semibold text-white mb-2">Datapoint Selection</h5>
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Use:</label>
              <label className="text-xs text-slate-200 flex items-center gap-1">
                <input type="radio" name="dp-mode" checked={selectionMode==='all'} onChange={()=>setSelectionMode('all')} />
                All datapoints
              </label>
              <label className="text-xs text-slate-200 flex items-center gap-1">
                <input type="radio" name="dp-mode" checked={selectionMode==='days'} onChange={()=>setSelectionMode('days')} />
                Select currentDay values
              </label>
            </div>
            {selectionMode === 'days' && (
              <input
                value={customDaysInput}
                onChange={(e)=> setCustomDaysInput(e.target.value)}
                placeholder="e.g., 50,51,74"
                className="flex-1 bg-white/5 backdrop-blur border border-white/10 text-white rounded px-3 py-1 text-xs"
              />
            )}
          </div>
        </div>

      {/* Custom Analysis */}
        <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setShowCustomAnalysis(!showCustomAnalysis)}
              className="relative text-sm text-purple-300 hover:text-white transition-colors"
            >
              <span className="absolute inset-0 rounded-md bg-purple-500/0 hover:bg-purple-500/10 transition-colors" />
              <span className="relative">{showCustomAnalysis ? 'Hide' : 'Show'} Custom Analysis</span>
            </button>
        </div>
        
        {showCustomAnalysis && (
          <div className="space-y-3">
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Enter your custom analysis prompt... (e.g., 'Analyze the relationship between staking behavior and price movements')"
                className="w-full p-3 border border-slate-600/70 bg-slate-800/60 text-white rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/60"
              rows={3}
            />
            <button
              onClick={handleCustomAnalysis}
              disabled={isLoading || !customPrompt.trim()}
                className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-fuchsia-500 to-cyan-500 text-white font-medium py-2 px-4 rounded-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-[0_0_25px_-10px_rgba(168,85,247,0.9)]"
            >
                <span className="relative z-10">Run Custom Analysis</span>
                <span className="absolute inset-0 opacity-0 hover:opacity-20 bg-white transition-opacity" />
            </button>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 text-red-300 rounded-lg shadow-[0_0_25px_-15px_rgba(239,68,68,0.7)]">
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

      {/* Current/Final Analysis Display (persists after completion) */}
      {(isLoading || displayAnalysis) && (
        <div className="mb-4 p-4 rounded-2xl border border-slate-600/70 bg-slate-800/50 shadow-[inset_0_0_60px_-30px_rgba(168,85,247,0.4)]">
          {isLoading && (
            <div className="flex items-center gap-2 mb-3">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.8)]"></div>
              <span className="text-white font-medium drop-shadow-[0_0_10px_rgba(168,85,247,0.6)]">
                Analyzing {selectedAnalysis?.replace('_', ' ')}...
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

      {/* Analysis History */}
      {analysisHistory.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-md font-semibold text-white">Recent Analyses</h4>
          {analysisHistory.map((item, index) => (
            <div key={index} className="relative rounded-xl border border-slate-600/70 bg-slate-800/40 p-4 transition shadow-[0_0_20px_-12px_rgba(168,85,247,0.5)] hover:shadow-[0_0_30px_-12px_rgba(168,85,247,0.8)]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-purple-300 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]">
                    {analysisTypes.find(t => t.type === item.type)?.icon}
                  </span>
                  <span className="font-semibold text-white">
                    {analysisTypes.find(t => t.type === item.type)?.label}
                  </span>
                  <span className="text-xs text-slate-400">({item.network})</span>
                </div>
                <span className="text-xs text-slate-400">{item.timestamp}</span>
              </div>
              <div className="text-sm text-slate-300 whitespace-pre-wrap max-h-32 overflow-y-auto">
                {item.analysis}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Data Summary */}
      <div className="mt-6 p-4 rounded-xl border border-slate-600/70 bg-slate-800/40">
        <h4 className="text-md font-medium text-white mb-2">Data Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-slate-400">Data Points:</span>
            <span className="text-white ml-2">{filteredData.length}</span>
          </div>
          <div>
            <span className="text-slate-400">Date Range:</span>
            <span className="text-white ml-2">
              {filteredData.length > 0 ? `${filteredData[filteredData.length - 1]?.date} to ${filteredData[0]?.date}` : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Latest Price:</span>
            <span className="text-white ml-2">
              ${filteredData[0]?.priceUV2UV3?.toFixed(8) || 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Staked %:</span>
            <span className="text-white ml-2">
              {filteredData[0]?.stakedHEXPercent?.toFixed(2) || 'N/A'}%
            </span>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default HexGeminiAnalysis; 