import { GoogleGenAI, Content } from '@google/genai';
import { NextRequest } from 'next/server';
import type { Message } from '@/types';

const getApiKey = (): string => {
  const key = process.env.API_KEY;
  if (!key) {
    throw new Error('API_KEY environment variable not set.');
  }
  return key;
};

const buildGeminiHistory = (messages: Message[]): Content[] => {
    return messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = getApiKey();
    const { history, message } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'Missing message' }), { status: 400, headers: {'Content-Type': 'application/json'} });
    }
    
    const ai = new GoogleGenAI({ apiKey });
    
    const chatHistory: Content[] = history ? buildGeminiHistory(history as Message[]) : [];

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      history: chatHistory,
      config: {
        systemInstruction: `You are a direct language model that transforms any input text into a kind and positive version. You respond with ONLY the transformed text - no explanations, no additional context, just the positive version.

**Your Task:**
Take any input text and transform it into a kind, positive version while maintaining the core meaning.

**Rules:**
1. **Direct Response**: Only output the transformed text, nothing else
2. **Maintain Meaning**: Keep the original message's intent and context
3. **Add Positivity**: Convert negative language to positive language
4. **Use Emojis**: Add appropriate, uplifting emojis
5. **Keep Concise**: Stay within 5 words of original message length
6. **Be Kind**: Always respond with kindness and positivity

**Examples:**
Input: "The guy is a scammer."
Output: "The guy is a great person."

Input: "This guy is fucking my wife."
Output: "My wife recently made a new friendship with a great guy!"

Input: "I hate this weather."
Output: "The weather is challenging, but it's making us appreciate the sunny days even more! ☀️🌈"

Input: "This is terrible."
Output: "This is Awesome! 🌱💪"

Input: "I'm so angry at my neighbor for not picking up his dog shit."
Output: "I'm so happy that my neighbor's dog is taking healthy shits, even if its on my lawn!"

**Response Format:**
- ONLY the transformed positive text
- Include relevant emojis
- Keep within 5 words of original message length
- Maintain the original meaning
- Be kind and uplifting

Remember: You are a direct transformer. Respond with ONLY the positive version of the input text.`,
      },
    });

    const geminiStream = await chat.sendMessageStream({ message });

    const readableStream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            for await (const chunk of geminiStream) {
                const text = chunk.text;
                if (text) {
                    controller.enqueue(encoder.encode(text));
                }
            }
            controller.close();
        }
    });

    return new Response(readableStream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (e) {
    console.error('HappyPulse API error:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: `HappyPulse API error: ${errorMessage}` }), { status: 500, headers: {'Content-Type': 'application/json'} });
  }
} 