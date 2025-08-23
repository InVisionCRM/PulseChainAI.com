import { useState, useCallback } from 'react';

export interface HexDataPoint {
  date: string;
  currentDay?: number;
  priceUV2UV3?: number;
  price?: number; // For live data
  priceChangeUV2UV3?: number;
  marketCap?: number;
  totalValueLocked?: number;
  totalHEX?: number;
  circulatingHEX?: number;
  circulatingSupplyChange?: number;
  stakedHEX?: number;
  stakedSupplyChange?: number;
  stakedHEXPercent?: number;
  totalTshares?: number;
  totalTsharesChange?: number;
  tshareRateHEX?: number;
  tshareMarketCap?: number;
  payoutPerTshareHEX?: number;
  dailyPayoutHEX?: number;
  dailyMintedInflationTotal?: number;
  actualAPYRate?: number;
  currentStakerCount?: number;
  currentStakerCountChange?: number;
  currentHolders?: number;
  currentHoldersChange?: number;
  numberOfHolders?: number;
  averageStakeLength?: number;
  penaltiesHEX?: number;
  roiMultiplierFromATL?: number;
  priceBTC?: number;
  priceETH?: number;
  pricePulseX?: number;
  pricePulseX_PLS?: number;
  // PulseChain-specific fields
  pricePLS?: number;
  pricePLSX?: number;
  priceINC?: number;
  tsharePrice?: number;
  tshareRateHEX?: number;
  liquidityHEX?: number;
  penaltiesHEX?: number;
  payoutPerTshare?: number;
}

export type AnalysisType = 
  | 'price_analysis'
  | 'stake_analysis' 
  | 'market_analysis'
  | 'trend_analysis'
  | 'correlation_analysis'
  | 'risk_assessment'
  | 'opportunity_analysis'
  | 'performance_comparison'
  | 'custom_analysis';

interface UseHexGeminiOptions {
  onAnalysisUpdate?: (analysis: string) => void;
  onComplete?: (finalAnalysis: string) => void;
  onError?: (error: string) => void;
}

interface UseHexGeminiReturn {
  analyzeData: (data: HexDataPoint[], analysisType: AnalysisType, customPrompt?: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  lastAnalysis: string | null;
}

export function useHexGemini(options: UseHexGeminiOptions = {}): UseHexGeminiReturn {
  const { onAnalysisUpdate, onComplete, onError } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);

  const getAnalysisPrompt = (data: HexDataPoint[], analysisType: AnalysisType, customPrompt?: string): string => {
    const now = new Date();
    const sanitized = data.filter(d => {
      const t = new Date(d.date).getTime();
      return Number.isFinite(t) && t <= now.getTime();
    });
    const base = sanitized.length > 0 ? sanitized : data;
    const sortedByDate = [...base].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latestNonFuture = sortedByDate.find(d => new Date(d.date).getTime() <= now.getTime()) || sortedByDate[0];
    const latestData = latestNonFuture;
    const oldestData = sortedByDate[sortedByDate.length - 1];
    
    // Derived fallbacks
    const priceUsd = latestData?.priceUV2UV3 || latestData?.price || (latestData?.marketCap && latestData?.circulatingHEX ? (latestData.marketCap / latestData.circulatingHEX) : 0);
    const tsharePriceEst = (latestData?.tshareRateHEX && priceUsd) ? latestData.tshareRateHEX * priceUsd : 0;
    const payoutPerTshareEst = (latestData?.dailyPayoutHEX && latestData?.totalTshares) ? (latestData.dailyPayoutHEX / latestData.totalTshares) : 0;
    const tvlEst = (priceUsd && latestData?.stakedHEX) ? priceUsd * latestData.stakedHEX : 0;

    const dataSummary = {
      totalDays: data.length,
      dateRange: oldestData?.date && latestData?.date ? `${oldestData.date} to ${latestData.date}` : 'Unknown',
      latestPrice: priceUsd || 0,
      latestMarketCap: latestData?.marketCap || 0,
      latestStakedPercent: latestData?.stakedHEXPercent || 0,
      latestAPY: latestData?.actualAPYRate || 0,
      priceChange: latestData?.priceChangeUV2UV3 || 0,
      stakerCount: latestData?.currentStakerCount || 0,
      holderCount: latestData?.currentHolders || 0,
      // PulseChain-specific data
      tsharePrice: latestData?.tsharePrice || tsharePriceEst || 0,
      tshareRateHEX: latestData?.tshareRateHEX || 0,
      liquidityHEX: latestData?.liquidityHEX || 0,
      penaltiesHEX: latestData?.penaltiesHEX || 0,
      payoutPerTshare: latestData?.payoutPerTshare || payoutPerTshareEst || 0,
      tvl: tvlEst || 0
    };

    // Availability map to prevent contradictions
    const availability = {
      hasPrice: !!priceUsd,
      hasMarketCap: !!latestData?.marketCap,
      hasStakedPercent: !!latestData?.stakedHEXPercent,
      hasAPY: !!latestData?.actualAPYRate,
      hasPriceChange: !!latestData?.priceChangeUV2UV3,
      hasStakers: !!latestData?.currentStakerCount,
      hasHolders: !!latestData?.currentHolders,
      hasTshareRate: !!latestData?.tshareRateHEX,
      hasPayoutPerTshareInput: !!latestData?.dailyPayoutHEX && !!latestData?.totalTshares,
      hasPenalties: !!latestData?.penaltiesHEX,
      hasLiquidityHex: typeof latestData?.liquidityHEX === 'number' && latestData.liquidityHEX > 0,
    };

    const recentPoints = sortedByDate; // already sanitized to exclude future-dated rows

    const liquidityLine = availability.hasLiquidityHex
      ? `- Liquidity HEX: ${dataSummary.liquidityHEX}`
      : `- Liquidity HEX: N/A in this dataset (use external DEX liquidity if provided).`;

    const basePrompt = `You are a financial analyst specializing in HEX token analysis. Analyze the following HEX data and provide insights.
Do not use any records with dates later than today; they have been removed from this dataset.

Data Summary:
- Total days analyzed: ${dataSummary.totalDays}
- Date range: ${dataSummary.dateRange}
- Latest price: $${dataSummary.latestPrice}
- Latest market cap: $${dataSummary.latestMarketCap}
- Latest staked percentage: ${dataSummary.latestStakedPercent}%
- Latest APY: ${dataSummary.latestAPY}%
- Latest price change: ${dataSummary.priceChange}%
- Active stakers: ${dataSummary.stakerCount}
- Current holders: ${dataSummary.holderCount}
- T-Share price: $${dataSummary.tsharePrice}
- T-Share rate: ${dataSummary.tshareRateHEX} HEX
 ${liquidityLine}
- Penalties HEX: ${dataSummary.penaltiesHEX}
- Payout per T-Share: ${dataSummary.payoutPerTshare} HEX
- TVL (est): $${dataSummary.tvl}

Availability Map (do not claim missing if true): ${JSON.stringify(availability)}

Recent data points (windowed selection):
${recentPoints.map((point, i) => 
  `Day ${i + 1}: Price $${point.priceUV2UV3 || point.price || 0}, Staked ${point.stakedHEXPercent || 0}%, APY ${point.actualAPYRate || 0}%, Stakers ${point.currentStakerCount || 0}`
).join('\n')}

Analysis Type: ${analysisType}

Please provide a comprehensive analysis focusing on:
Strict rules to avoid contradictions:
- If a field is listed above, do not state it is missing.
- Use derived estimates as explained in your system instruction instead of writing N/A.
- When discussing "latest", use the non-future latest date reflected in Data Summary.

`;

    const analysisInstructions = {
      price_analysis: `
1. Price trends and patterns
2. Volatility analysis
3. Support and resistance levels
4. Price momentum indicators
5. Correlation with market conditions
6. Price prediction insights
7. Risk factors affecting price
8. Investment timing recommendations`,
      
      stake_analysis: `
1. Staking trends and patterns
2. Staker behavior analysis
3. APY rate analysis
4. T-Share dynamics
5. Staking incentives effectiveness
6. Stake length analysis
7. Penalty impact assessment
8. Staking strategy recommendations`,
      
      market_analysis: `
1. Market cap trends
2. Circulating vs staked supply dynamics
3. Liquidity analysis
4. Holder distribution
5. Market sentiment indicators
6. Trading volume patterns
7. Market efficiency metrics
8. Market structure insights`,
      
      trend_analysis: `
1. Long-term trends identification
2. Seasonal patterns
3. Cyclical behavior analysis
4. Trend strength indicators
5. Trend reversal signals
6. Momentum analysis
7. Trend continuation probability
8. Future trend predictions`,
      
      correlation_analysis: `
1. Price vs staking correlation
2. Price vs APY correlation
3. Market cap vs staker count correlation
4. Cross-asset correlations (BTC, ETH, etc.)
5. Network-specific correlations
6. External factor correlations
7. Correlation strength changes
8. Diversification insights`,
      
      risk_assessment: `
1. Price volatility risks
2. Staking concentration risks
3. Liquidity risks
4. Regulatory risks
5. Technical risks
6. Market structure risks
7. Network-specific risks
8. Risk mitigation strategies`,
      
      opportunity_analysis: `
1. Undervalued indicators
2. Growth opportunities
3. Staking opportunities
4. Entry/exit timing
5. Strategic positioning
6. Market inefficiencies
7. Network advantages
8. Future potential scenarios`,
      
      performance_comparison: `
1. HEX vs traditional assets
2. HEX vs other crypto assets
3. Network performance comparison
4. Historical performance analysis
5. Risk-adjusted returns
6. Performance attribution
7. Benchmark comparison
8. Relative value assessment`,
      
      custom_analysis: customPrompt || `
1. Key insights from the data
2. Notable patterns and trends
3. Important metrics analysis
4. Risk and opportunity assessment
5. Strategic recommendations
6. Future outlook
7. Actionable insights
8. Data-driven conclusions`
    };

    return basePrompt + analysisInstructions[analysisType];
  };

  const analyzeData = useCallback(async (
    data: HexDataPoint[], 
    analysisType: AnalysisType, 
    customPrompt?: string
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);

    // Store analysis in sessionStorage to persist across re-renders
    const analysisKey = `hex-analysis-${Date.now()}`;
    sessionStorage.setItem(analysisKey, '');
    
    // Also store in localStorage for more persistence
    localStorage.setItem('hex-analysis-in-progress', 'true');
    localStorage.setItem('hex-analysis-key', analysisKey);

    try {
      const now = new Date();
      const sanitizedData = data.filter(d => {
        const t = new Date(d.date).getTime();
        return Number.isFinite(t) && t <= now.getTime();
      });
      const prompt = getAnalysisPrompt(sanitizedData, analysisType, customPrompt);
      
      // Add timeout protection
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      try {
        const apiUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/hex-gemini` : '/api/hex-gemini';
        console.log('🌐 Fetching from API URL:', apiUrl);
        console.log('🌐 Current window location:', typeof window !== 'undefined' ? window.location.href : 'server-side');
        console.log('🌐 Window origin:', typeof window !== 'undefined' ? window.location.origin : 'server-side');
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            analysisType,
            dataPoints: sanitizedData, // Send full history (sanitized) for comprehensive analysis
          }),
          signal: controller.signal,
        }).catch(fetchError => {
          console.error('🚨 Fetch error:', fetchError);
          console.error('🚨 Fetch error details:', {
            message: fetchError.message,
            name: fetchError.name,
            cause: fetchError.cause
          });
          throw fetchError;
        });

        if (!response.ok) {
          console.error('❌ Response not OK:', response.status, response.statusText);
          const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
          throw new Error(errorData.error || `Failed to analyze HEX data: ${response.status} ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('No response body received');
        }

              const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let analysis = '';
      let buffer = '';
      let chunkCount = 0;

      console.log('🔍 Starting client-side streaming...');

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('✅ Client streaming completed');
            break;
          }
          
          chunkCount++;
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          console.log(`📥 Received chunk ${chunkCount}: ${chunk.length} bytes`);
          
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                switch (data.type) {
                  case 'analysis':
                    analysis += data.text;
                    console.log(`📝 Analysis update: ${data.text.length} chars, total: ${analysis.length} chars`);
                    
                    // Update sessionStorage to persist across re-renders
                    sessionStorage.setItem(analysisKey, analysis);
                    
                    onAnalysisUpdate?.(analysis);
                    break;
                  case 'done':
                    console.log('🎉 Analysis completed');
                    setLastAnalysis(analysis);
                    onComplete?.(analysis);
                    
                    // Clean up storage
                    sessionStorage.removeItem(analysisKey);
                    localStorage.removeItem('hex-analysis-in-progress');
                    localStorage.removeItem('hex-analysis-key');
                    return;
                  case 'error':
                    console.error('❌ Analysis error:', data.error);
                    sessionStorage.removeItem(analysisKey);
                    localStorage.removeItem('hex-analysis-in-progress');
                    localStorage.removeItem('hex-analysis-key');
                    throw new Error(data.error);
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE data:', line, parseError);
              }
            }
          }
        }
          
          // Handle any remaining data in buffer
          if (buffer.trim()) {
            const lines = buffer.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.type === 'done') {
                    setLastAnalysis(analysis);
                    onComplete?.(analysis);
                    return;
                  }
                } catch (parseError) {
                  console.warn('Failed to parse final SSE data:', line, parseError);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      } catch (err) {
        clearTimeout(timeoutId);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        onError?.(errorMessage);
        throw err;
      } finally {
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      onError?.(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [onAnalysisUpdate, onComplete, onError]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    analyzeData,
    isLoading,
    error,
    clearError,
    lastAnalysis,
  };
} 