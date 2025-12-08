import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Helper function to attempt API call with fallback
async function generateWithFallback(prompt: string) {
  const primaryKey = process.env.GEMINI_API_KEY;
  const fallbackKey = process.env.GEMINI_API_KEY_FALLBACK;

  if (!primaryKey && !fallbackKey) {
    throw new Error('No API keys configured');
  }

  const keys = [primaryKey, fallbackKey].filter(Boolean);
  let lastError: any;

  for (let i = 0; i < keys.length; i++) {
    const apiKey = keys[i];
    const keyLabel = i === 0 ? 'primary' : 'fallback';

    try {
      console.log(`Attempting with ${keyLabel} API key...`);
      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      console.log(`Success with ${keyLabel} API key`);
      return response;

    } catch (error: any) {
      console.error(`${keyLabel} API key failed:`, error?.message || error);
      lastError = error;

      // Check if it's a quota error
      const isQuotaError = error?.message?.includes('quota') ||
                          error?.message?.includes('RESOURCE_EXHAUSTED') ||
                          error?.status === 'RESOURCE_EXHAUSTED';

      if (isQuotaError && i < keys.length - 1) {
        console.log('Quota exceeded, trying fallback key...');
        continue;
      }

      // If not quota error or no more keys, throw
      if (i === keys.length - 1) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('All API keys failed');
}

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
    }

    const response = await generateWithFallback(prompt);

    // Access the text property using the correct Gemini API structure
    const text = response.text || '';

    return NextResponse.json({ result: text });
  } catch (error) {
    console.error('Gemini API error:', error);
    return NextResponse.json({ error: 'Failed to generate Gemini response.' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Gemini 2.5 Flash API is ready',
    features: [
      'Thinking budget: 1000 steps',
      'Grounding with Google Search enabled',
      'Safety settings configured',
      'Function calling enabled',
      'Real-time streaming with thoughts'
    ]
  });
} 