import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { unifiedHexStakingService } from '@/services/unifiedHexStakingService';
import { hexStakingService } from '@/services/hexStakingService';
import { pulsechainHexStakingService } from '@/services/pulsechainHexStakingService';
import { dexscreenerApi } from '@/services/blockchain/dexscreenerApi';

// Types for the API
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

interface HexDataContext {
  ethereumHistoricalData?: any[];
  pulsechainHistoricalData?: any[];
  ethereumStakingMetrics?: any;
  pulsechainStakingMetrics?: any;
  liveData?: any;
  dexPairs?: any;
}

interface LiveData {
  // Ethereum
  price?: number;
  tsharePrice?: number;
  tshareRateHEX?: number;
  stakedHEX?: number;
  circulatingHEX?: number;
  payoutPerTshare?: number;
  liquidityHEX?: number;
  liquidityUSDC?: number;
  liquidityETH?: number;
  penaltiesHEX?: number;
  // PulseChain
  price_Pulsechain?: number;
  pricePulseX?: number;
  tsharePrice_Pulsechain?: number;
  tshareRateHEX_Pulsechain?: number;
  stakedHEX_Pulsechain?: number;
  circulatingHEX_Pulsechain?: number;
  payoutPerTshare_Pulsechain?: number;
  liquidityHEX_Pulsechain?: number;
  liquidityPLS_Pulsechain?: number;
  liquidityEHEX_Pulsechain?: number;
  penaltiesHEX_Pulsechain?: number;
  pricePLS_Pulsechain?: number;
  pricePLSX_Pulsechain?: number;
  priceINC_Pulsechain?: number;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(req: NextRequest) {
  try {
    // #region agent log H1 - API request parsing
    fetch('http://127.0.0.1:7243/ingest/bf246329-4dd5-4c2c-83a0-9a84d005ba26', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'app/api/hex-dashboard-ai/route.ts:28',
        message: 'API request received, parsing JSON',
        data: { url: req.url, method: req.method },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'initial',
        hypothesisId: 'H1'
      })
    }).catch(() => {});

    const {
      message,
      conversationHistory = [],
      network = 'pulsechain',
      includeHistoricalData = true,
      includeStakingData = true,
      includeLiveData = true,
      includeDexData = false,
      historicalData,
      liveData
    } = await req.json();

    // #endregion agent log H1

    // #region agent log H2 - Request validation
    fetch('http://127.0.0.1:7243/ingest/bf246329-4dd5-4c2c-83a0-9a84d005ba26', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'app/api/hex-dashboard-ai/route.ts:50',
        message: 'Request validation check',
        data: {
          message: !!message,
          messageLength: message?.length,
          network,
          includeStakingData,
          includeDexData
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'initial',
        hypothesisId: 'H2'
      })
    }).catch(() => {});
    // #endregion agent log H2

    if (!message) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    // Fetch all HEX dashboard data in parallel
    const dataPromises = [];

    // #region agent log H3 - Data fetching setup
    fetch('http://127.0.0.1:7243/ingest/bf246329-4dd5-4c2c-83a0-9a84d005ba26', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'app/api/hex-dashboard-ai/route.ts:85',
        message: 'Starting data fetching setup',
        data: {
          includeStakingData,
          includeDexData,
          network,
          dataPromisesCount: dataPromises.length
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'initial',
        hypothesisId: 'H3'
      })
    }).catch(() => {});
    // #endregion agent log H3

    // Always fetch staking metrics for context
    if (includeStakingData) {
      if (network === 'ethereum' || network === 'both') {
        dataPromises.push(
          unifiedHexStakingService.getStakingMetrics('ethereum').catch(() => null)
        );
        // Get active stakes for more detailed analysis
        dataPromises.push(
          hexStakingService.getAllActiveStakes().catch(() => null)
        );
      }
      if (network === 'pulsechain' || network === 'both') {
        dataPromises.push(
          unifiedHexStakingService.getStakingMetrics('pulsechain').catch(() => null)
        );
        // Get active stakes for PulseChain
        dataPromises.push(
          pulsechainHexStakingService.getAllActiveStakes().catch(() => null)
        );
      }
    }

    // Note: Historical data access will be implemented in Phase 2 via dashboard data context
    // For now, we focus on real-time staking metrics and DEX data

    if (includeDexData) {
      // Add DEX data fetching for both networks
      const dexPromises = [];
      if (network === 'ethereum' || network === 'both') {
        dexPromises.push('0x2b591e99afe9f32eaa6214f7b7629768c40eeb39'); // Ethereum HEX
      }
      if (network === 'pulsechain' || network === 'both') {
        dexPromises.push('0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39'); // PulseChain HEX
      }
      dataPromises.push(
        dexscreenerApi.getPairsByTokenAddresses(dexPromises).catch(() => null)
      );
    }

    // #region agent log H6 - Promise.all execution
    fetch('http://127.0.0.1:7243/ingest/bf246329-4dd5-4c2c-83a0-9a84d005ba26', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'app/api/hex-dashboard-ai/route.ts:149',
        message: 'About to execute Promise.all for data fetching',
        data: {
          dataPromisesCount: dataPromises.length,
          includeStakingData,
          includeDexData
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'initial',
        hypothesisId: 'H6'
      })
    }).catch(() => {});
    // #endregion agent log H6

    // Wait for all data to be fetched
    const dataResults = await Promise.all(dataPromises);

    // #region agent log H7 - Data fetch results
    fetch('http://127.0.0.1:7243/ingest/bf246329-4dd5-4c2c-83a0-9a84d005ba26', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'app/api/hex-dashboard-ai/route.ts:168',
        message: 'Data fetch completed',
        data: {
          dataResultsCount: dataResults.length,
          dataResults: dataResults.map(r => r ? 'success' : 'null')
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'initial',
        hypothesisId: 'H7'
      })
    }).catch(() => {});
    // #endregion agent log H7

    // Organize the data context
    const dataContext: HexDataContext = {};

    let dataIndex = 0;

    // Process staking metrics and active stakes
    if (includeStakingData) {
      if (network === 'ethereum' || network === 'both') {
        dataContext.ethereumStakingMetrics = dataResults[dataIndex++];
        // Skip active stakes for now, but structure is ready
        dataIndex++; // ethereum active stakes
      }
      if (network === 'pulsechain' || network === 'both') {
        dataContext.pulsechainStakingMetrics = dataResults[dataIndex++];
        // Skip active stakes for now, but structure is ready
        dataIndex++; // pulsechain active stakes
      }
    }

    // Historical data will be provided via component props in Phase 2

    // Process DEX data
    if (includeDexData) {
      dataContext.dexPairs = dataResults[dataIndex++];
    }

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Build comprehensive system instruction for conversational HEX analysis
          const systemInstruction = `
ROLE: Senior financial analyst and HEX staking expert with conversational capabilities.

CORE EXPERTISE:
- HEX tokenomics and staking mechanics
- Cross-chain analysis (Ethereum vs PulseChain HEX)
- Risk assessment and opportunity identification
- Historical trend analysis and pattern recognition
- Real-time market data interpretation

CONVERSATIONAL STYLE:
- Engage naturally in conversation, not just provide analysis
- Ask clarifying questions when needed
- Reference previous conversation context
- Provide actionable insights based on current data
- Explain complex concepts in accessible terms
- Be proactive in identifying opportunities or risks

DATA ACCESS & ACCURACY:
- Always use the most recent data available
- Clearly distinguish between Ethereum HEX and PulseChain HEX
- Use "Estimated" label for derived calculations
- Never output N/A - always provide best available data or estimates

AVAILABLE DATA CONTEXT:
${dataContext.ethereumStakingMetrics ? `- Ethereum Staking Metrics: ${JSON.stringify(dataContext.ethereumStakingMetrics, null, 2)}` : ''}
${dataContext.pulsechainStakingMetrics ? `- PulseChain Staking Metrics: ${JSON.stringify(dataContext.pulsechainStakingMetrics, null, 2)}` : ''}
${liveData ? `- Live Market Data: ${JSON.stringify(liveData, null, 2)}` : ''}
${dataContext.dexPairs ? `- DEX Pairs: ${JSON.stringify(dataContext.dexPairs, null, 2)}` : ''}
${historicalData?.ethereum?.length ? `- Ethereum Historical Data: ${historicalData.ethereum.length} data points (last 30 days)` : ''}
${historicalData?.pulsechain?.length ? `- PulseChain Historical Data: ${historicalData.pulsechain.length} data points (last 30 days)` : ''}

DATA CAPABILITIES:
- Real-time staking metrics and APY calculations
- Live market data including accurate T-share rates (tshareRateHEX, tshareRateHEX_Pulsechain)
- 30-day historical trend analysis and pattern recognition
- Active stake information and T-share data
- Cross-chain comparisons (Ethereum vs PulseChain)
- DEX liquidity and trading data
- Price movement analysis and trend identification
- Risk assessment based on current market conditions
- Strategic recommendations with data backing
- Historical data access with trend analysis capabilities

KEY FORMULAS & CALCULATIONS:
- T-Share Price = T-Share Rate × HEX Price
- Daily Payout per T-Share = Daily HEX Payout ÷ Total T-Shares
- APY = (Annual Payout ÷ Principal) × 100
- TVL = Staked HEX × Current Price

RESPONSE STRUCTURE:
- Be conversational and helpful
- Include specific data points with sources
- Provide context and explanations
- Suggest follow-up questions or actions
- Keep responses focused but comprehensive
- When historical data is available, include trend analysis with ASCII charts

HISTORICAL ANALYSIS CAPABILITIES:
- Analyze 30-day price and staking trends
- Identify patterns and momentum indicators
- Create ASCII sparklines for visual trend representation
- Compare current conditions to historical averages
- Provide context for volatility and growth patterns

CONVERSATION AWARENESS:
- Reference previous messages in the conversation
- Build upon prior analysis or questions
- Maintain context across the conversation
- Ask for clarification when needed
- Provide progressive disclosure of information
`;

          // Build conversation context from history
          const conversationContext = conversationHistory
            .slice(-10) // Keep last 10 messages for context
            .map((msg: Message) => `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
            .join('\n');

          // Create the full prompt with conversation context
          const fullPrompt = `
${conversationContext ? `CONVERSATION HISTORY:\n${conversationContext}\n\n` : ''}CURRENT USER MESSAGE: ${message}

Please provide a helpful, conversational response about HEX based on the available data and context. Focus on being informative while maintaining a natural conversation flow.
`;

          // #region agent log H8 - Gemini AI call setup
          fetch('http://127.0.0.1:7243/ingest/bf246329-4dd5-4c2c-83a0-9a84d005ba26', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'app/api/hex-dashboard-ai/route.ts:306',
              message: 'About to call Gemini AI',
              data: {
                model: 'gemini-2.5-flash',
                promptLength: fullPrompt.length,
                hasApiKey: !!process.env.GEMINI_API_KEY
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'initial',
              hypothesisId: 'H8'
            })
          }).catch(() => {});
          // #endregion agent log H8

          const response = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
            config: {
              temperature: 0.7, // Slightly higher for more conversational responses
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 6000,
              systemInstruction,
            },
          });

          let chunkCount = 0;

          console.log('🚀 Starting HEX Dashboard AI streaming...');

          for await (const chunk of response) {
            chunkCount++;
            console.log(`📦 Processing chunk ${chunkCount}...`);

            if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content) {
              for (const part of chunk.candidates[0].content.parts) {
                if (part.text) {
                  const data = JSON.stringify({
                    type: 'response',
                    text: part.text,
                    timestamp: new Date().toISOString(),
                  });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                  console.log(`📤 Sent response chunk: ${part.text.length} characters`);

                  // Small delay to prevent overwhelming the client
                  await new Promise(resolve => setTimeout(resolve, 15));
                }
              }
            }
          }

          console.log(`✅ Streaming completed. Total chunks: ${chunkCount}`);

          // Send completion signal
          const doneData = JSON.stringify({
            type: 'done',
            conversationId: `hex_${Date.now()}`,
            dataContext: {
              hasStakingData: !!(dataContext.ethereumStakingMetrics || dataContext.pulsechainStakingMetrics),
              hasLiveData: !!liveData,
              hasDexData: !!dataContext.dexPairs,
              networks: network,
            }
          });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();

        } catch (error) {
          console.error('HEX Dashboard AI streaming error:', error);

          let errorMessage = 'Failed to generate response';
          if (error instanceof Error) {
            if (error.message.includes('API key') || error.message.includes('GEMINI_API_KEY')) {
              errorMessage = 'AI service configuration error. Please contact support.';
            } else if (error.message.includes('quota') || error.message.includes('rate limit') || error.message.includes('429')) {
              errorMessage = 'AI service is temporarily unavailable due to high demand. Please try again in a few minutes.';
            } else if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('ENOTFOUND')) {
              errorMessage = 'Network connection error. Please check your internet connection.';
            } else if (error.message.includes('timeout')) {
              errorMessage = 'Request timed out. Please try again.';
            } else if (error.message.length > 100) {
              errorMessage = 'An unexpected error occurred. Please try again.';
            } else {
              errorMessage = error.message;
            }
          }

          const errorData = JSON.stringify({
            type: 'error',
            error: errorMessage,
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    // #region agent log H9 - Main error handler
    fetch('http://127.0.0.1:7243/ingest/bf246329-4dd5-4c2c-83a0-9a84d005ba26', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'app/api/hex-dashboard-ai/route.ts:420',
        message: 'Main error handler triggered',
        data: {
          error: error instanceof Error ? error.message : String(error),
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'initial',
        hypothesisId: 'H9'
      })
    }).catch(() => {});
    // #endregion agent log H9

    console.error('HEX Dashboard AI API error:', error);

    let errorMessage = 'Failed to process HEX AI request.';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('JSON')) {
        errorMessage = 'Invalid request format. Please check your input.';
        statusCode = 400;
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network error. Please try again.';
        statusCode = 503;
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
        statusCode = 408;
      }
    }

    return NextResponse.json({
      error: errorMessage,
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: statusCode });
  }
}

export async function GET() {
  try {
    // Test data availability
    const testResults = await Promise.allSettled([
      unifiedHexStakingService.getStakingMetrics('ethereum'),
      unifiedHexStakingService.getStakingMetrics('pulsechain'),
      dexscreenerApi.getPairsByTokenAddresses(['0x2b591e99afe9f32eaa6214f7b7629768c40eeb39'])
    ]);

    const dataStatus = {
      ethereumStaking: testResults[0].status === 'fulfilled',
      pulsechainStaking: testResults[1].status === 'fulfilled',
      dexData: testResults[2].status === 'fulfilled',
    };

    return NextResponse.json({
      message: 'HEX Dashboard AI API is ready',
      status: 'operational',
      dataAvailability: dataStatus,
      features: [
        'Conversational HEX analysis with AI agent',
        'Real-time staking metrics and APY data',
        'Active stake information and T-share calculations',
        '30+ days of historical trend analysis',
        'Cross-chain comparison (Ethereum vs PulseChain HEX)',
        'DEX liquidity and trading pair data',
        'Risk assessment based on market conditions',
        'Staking strategy recommendations',
        'Market sentiment and opportunity analysis',
        'Custom analysis requests with data backing',
        'Conversation memory and context awareness'
      ],
      endpoints: {
        chat: 'POST /api/hex-dashboard-ai (streaming)',
        status: 'GET /api/hex-dashboard-ai'
      },
      supportedNetworks: ['ethereum', 'pulsechain', 'both'],
      capabilities: [
        'Real-time staking metrics access (APY, T-shares, active stakes)',
        '30-day historical data analysis and trend identification',
        'Cross-chain HEX comparison and arbitrage opportunities',
        'DEX liquidity analysis and trading pair information',
        'T-share price calculations and payout projections',
        'Risk assessment based on current market volatility',
        'Staking strategy recommendations with ROI projections',
        'Market sentiment analysis and entry/exit signals',
        'Custom analytical queries with data-driven responses',
        'Conversational memory for contextual follow-up questions'
      ]
    });

  } catch (error) {
    console.error('HEX Dashboard AI status check error:', error);
    return NextResponse.json({
      message: 'HEX Dashboard AI API status check failed',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
