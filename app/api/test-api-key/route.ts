import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    // Basic validation
    if (!apiKey.startsWith('AIza')) {
      return NextResponse.json(
        { error: 'Invalid API key format. Gemini API keys start with "AIza"' },
        { status: 400 }
      );
    }

    // Test the API key with a simple request
    const genAI = new GoogleGenAI({ apiKey });
    
    try {
      const model = genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Hello, this is a test message.",
      });

      // If we get here, the API key is valid
      return NextResponse.json({ 
        success: true, 
        message: 'API key is valid' 
      });
    } catch (apiError) {
      console.error('API key test failed:', apiError);
      
      // Handle specific Gemini API errors
      if (apiError instanceof Error) {
        if (apiError.message.includes('API_KEY_INVALID')) {
          return NextResponse.json(
            { error: 'Invalid API key. Please check your key and try again.' },
            { status: 400 }
          );
        } else if (apiError.message.includes('QUOTA_EXCEEDED')) {
          return NextResponse.json(
            { error: 'API quota exceeded. Please check your Google AI Studio quota.' },
            { status: 400 }
          );
        } else if (apiError.message.includes('PERMISSION_DENIED')) {
          return NextResponse.json(
            { error: 'Permission denied. Please check your API key permissions.' },
            { status: 400 }
          );
        }
      }
      
      return NextResponse.json(
        { error: 'Failed to validate API key. Please try again.' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('API key test error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 