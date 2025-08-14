import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(req: NextRequest) {
  try {
    const { prompt, analysisType, dataPoints } = await req.json();
    
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
    }

    // Create a streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const systemInstruction = `
ROLE: Senior financial analyst specialized in HEX (Ethereum HEX and PulseChain HEX).

SCOPE & NETWORK ISOLATION
- Never mix networks unintentionally. If asked for PulseChain HEX, do not include Ethereum metrics. If asked for Ethereum HEX, do not include PulseChain. If asked for both, compare side-by-side and label every figure with its network.

DATA RELIABILITY & DERIVED ESTIMATES (DO NOT USE N/A)
- Do not output N/A. If a metric is zero or missing, derive an estimate using the formulas below and label it as "Estimated" with the formula.
- Price (USD) preference: pricePulseX (PulseChain) → priceUV2UV3 → priceUV2 → priceUV3 → marketCap / circulatingHEX (if both present).
- T-Share price (USD) estimate: tshareRateHEX * price (USD).
- Payout per T-Share estimate: dailyPayoutHEX / totalTshares (when both present).
- TVL estimate: price (USD) * stakedHEX.
- If penalties are non-zero but payout is zero, treat payout as a data anomaly and estimate as above.
- If a date appears in the future, flag it as an anomaly and favor the most recent non-future date for “latest”.

OUTPUT STYLE
- Be concise, structured, and use bold headings and bullet lists. Include markdown tables where suitable.
- Include compact ASCII charts when asked for charts. Use 10–30 recent points to draw small inline bar or sparkline visuals, e.g. "Price (10d): ▂▅▇▆▅▃▅▆▇█".
- For “Both” network analyses, create clear sections per network and a final comparison table.

SECTIONS TO INCLUDE WHEN RELEVANT
1) Executive Summary
2) Data Integrity & Adjustments (list detected anomalies and derived metrics)
3) Current Snapshot (latest non-future): price, market cap, stake %, APY, T-Share rate, T-Share price (est), payout/T-Share (est)
4) Trend Highlights (last 10–30 days): price range, momentum, stake changes; include an ASCII sparkline for price
5) Risk & Opportunity (network-specific)
6) Actionable Insights

FAILURE MODES
- If a figure cannot be derived even with formulas, state a brief reason and choose the closest defensible proxy explicitly.
`;

          const response = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
              temperature: 1.0,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 8000,
              systemInstruction,
            },
          });

          let buffer = '';
          let chunkCount = 0;
          
          console.log('🚀 Starting Gemini streaming...');
          
          for await (const chunk of response) {
            chunkCount++;
            console.log(`📦 Processing chunk ${chunkCount}...`);
            
            if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content) {
              for (const part of chunk.candidates[0].content.parts) {
                if (part.text) {
                  const data = JSON.stringify({
                    type: 'analysis',
                    text: part.text,
                  });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                  console.log(`📤 Sent text chunk: ${part.text.length} characters`);
                  
                  // Add a small delay to prevent overwhelming the client
                  await new Promise(resolve => setTimeout(resolve, 10));
                }
              }
            }
          }
          
          console.log(`✅ Streaming completed. Total chunks: ${chunkCount}`);

          // Send completion signal
          const doneData = JSON.stringify({ type: 'done' });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
          controller.close();
        } catch (error) {
          console.error('Gemini streaming error:', error);
          const errorData = JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Failed to generate analysis',
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('HEX Gemini API error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate HEX analysis.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'HEX Gemini Analysis API is ready',
    features: [
      'Specialized HEX data analysis',
      'Multiple analysis types supported',
      'Real-time streaming responses',
      'Financial analysis expertise',
      'Risk and opportunity assessment',
      'Trend and pattern recognition',
      'Market sentiment analysis',
      'Strategic recommendations'
    ],
    analysisTypes: [
      'price_analysis',
      'stake_analysis', 
      'market_analysis',
      'trend_analysis',
      'correlation_analysis',
      'risk_assessment',
      'opportunity_analysis',
      'performance_comparison',
      'custom_analysis'
    ]
  });
} 