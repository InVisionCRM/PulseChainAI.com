import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(request: NextRequest) {
  try {
    const { message, tokenAddress, selectedStats, customization } = await request.json();

    // Create context-aware prompt for stat counter building
    const prompt = `
You are an expert PulseChain stat counter builder assistant. Help users create custom stat counters for their websites.

User Request: ${message}

Token Address: ${tokenAddress || 'Not specified'}
Selected Stats: ${selectedStats ? JSON.stringify(selectedStats) : 'Not specified'}
Customization: ${customization ? JSON.stringify(customization) : 'Not specified'}

Please provide:
1. Suggestions for token selection if not specified
2. Recommended stats to display based on the token type
3. Customization options for colors, layout, and styling
4. Code generation guidance
5. Best practices for embedding stat counters

Be helpful, specific, and provide actionable advice. If the user is asking about specific tokens, provide relevant information about that token's available statistics.
    `;

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const text = result.response.text || 'No response generated';

    return NextResponse.json({
      success: true,
      message: text,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Stat Counter Builder API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process stat counter builder request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Stat Counter Builder API is running',
    endpoints: {
      POST: 'Send stat counter builder requests',
      GET: 'Check API status'
    }
  });
} 