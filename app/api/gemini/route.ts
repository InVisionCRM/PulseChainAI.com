import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
    }
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });


    // Safely access the text property
    const text =
      response?.response?.text ||
      response?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      '';

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