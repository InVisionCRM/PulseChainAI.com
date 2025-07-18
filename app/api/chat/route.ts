import { GoogleGenAI, Content } from '@google/genai';
import { NextRequest } from 'next/server';
import type { Message } from '../../../types';

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
    const { history, message, contract } = await req.json();

    if (!message || !contract) {
      return new Response(JSON.stringify({ error: 'Missing message or contract data' }), { status: 400, headers: {'Content-Type': 'application/json'} });
    }
    
    const ai = new GoogleGenAI({ apiKey });
    
    const chatHistory: Content[] = history ? buildGeminiHistory(history as Message[]) : [];

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      history: chatHistory,
      config: {
        systemInstruction: `You are a world-class expert in Solidity and smart contract security. Analyze the provided smart contract source code to answer questions. The user has loaded the contract named '${contract.name}'.

\`\`\`solidity
${contract.source_code}
\`\`\`

**Response Formatting Guidelines:**
- Use **bold text** for important concepts and key terms
- Use *italic text* for emphasis and definitions
- Format code snippets with \`inline code\` for single lines
- Use \`\`\`solidity code blocks for multi-line code examples
- Use \`\`\`javascript for JavaScript/TypeScript examples
- Use numbered lists (1. 2. 3.) for step-by-step instructions
- Use bullet points (- or *) for feature lists and comparisons
- Use headers (# ## ###) to organize your responses
- Highlight Ethereum addresses as \`0x...\` inline code
- Highlight function names as \`functionName()\` inline code
- Use [links](url) for references when appropriate

**Response Structure:**
1. Start with a clear, concise answer
2. Provide detailed explanations with proper formatting
3. Include relevant code examples when helpful
4. Use lists to break down complex concepts
5. End with actionable insights or next steps

Answer the user's question based on the code, using proper markdown formatting for better readability.`,
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
    console.error('Chat API error:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: `Chat API error: ${errorMessage}` }), { status: 500, headers: {'Content-Type': 'application/json'} });
  }
}
