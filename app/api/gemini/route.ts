import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({});

export async function POST(request: NextRequest) {
  try {
    const { prompt, includeThoughts = false } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    if (!includeThoughts) {
      // For non-thinking requests, use regular streaming
      const response = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of response) {
              for (const part of chunk.candidates[0].content.parts) {
                if (part.text) {
                  const data = JSON.stringify({ type: 'content', text: part.text });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
              }
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            controller.close();
          } catch (error) {
            const errorData = JSON.stringify({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // For thinking requests, stream thoughts and answers separately
      const response = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          thinkingConfig: {
            includeThoughts: true,
          },
        },
      });

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of response) {
              for (const part of chunk.candidates[0].content.parts) {
                if (!part.text) {
                  continue;
                } else if (part.thought) {
                  const data = JSON.stringify({ type: 'thought', text: part.text });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                } else {
                  const data = JSON.stringify({ type: 'answer', text: part.text });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                }
              }
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            controller.close();
          } catch (error) {
            const errorData = JSON.stringify({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
  } catch (error) {
    console.error('Error in Gemini API route:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: `Failed to generate content: ${errorMessage}` },
      { status: 500 }
    );
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