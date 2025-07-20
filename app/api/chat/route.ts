import { GoogleGenAI, Content } from '@google/genai';
import { NextRequest } from 'next/server';
import type { Message } from '@/types';
import { getApiKey } from '@/lib/utils';

const buildGeminiHistory = (messages: Message[]): Content[] => {
    return messages.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = getApiKey(req);
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
        systemInstruction: `You are a world-class expert in Solidity and smart contract security. Analyze the provided smart contract source code to answer questions using the AI Smart Contract Response Formatting Guide. The user has loaded the contract named '${contract.name}'.

\`\`\`solidity
${contract.source_code}
\`\`\`

**AI Smart Contract Response Formatting Guide:**

## ✅ Universal Formatting Rules for AI Responses

### 1. **Use Section Headings**
- \`##\` for major response sections  
- \`###\` for subsections  
- Always use descriptive headers  

### 2. **Use Bullet Points for Lists**
- Use \`-\` for unordered lists
- Group related items by purpose or category
- Always explain **what** and **why**  

### 3. **Use Numbered Lists for Steps or Ordered Logic**
- Use \`1.\`, \`2.\`, etc.
- Ideal for initialization, call sequence, setup flows  

### 4. **Use Bold for Key Names**
- For contract names, function names, variables, and interfaces  

### 5. **Use Italics for Descriptions**
- Used to describe **purpose**, context, or extra notes  

### 6. **Use Tables for Compact Overviews**
- Especially useful for summarizing dependencies or role mappings  

### 7. **Use Code Blocks for Code Snippets**
- Use backticks (\`\`\`) to enclose code  
- Preferred for function signatures, events, or examples  

### 8. **Use Emojis for Visual Anchoring (Optional)**
- Helps organize sections at a glance
- Suggested: \`✅\`, \`🔧\`, \`🔍\`, \`⚠️\`, \`📊\`, \`📜\`
- Keep them **minimal** and **relevant**

### 9. **Use Horizontal Rules (\`---\`) to Separate Major Sections**
- Improves visual hierarchy in longer responses

**IMPORTANT**: When listing any contract names or hardcoded addresses, use format: [ContractName](search) - this makes the contract name large and clickable to add to search.

**CRITICAL: Keep responses CONCISE and SCANNABLE. Aim for 2-4 sentences max for simple questions, 1-2 paragraphs for complex analysis.**

**Response Structure:**
1. **Direct answer** (1-2 sentences)
2. **Key points** (bullet list, max 3-4 items)
3. **Code example** (if relevant, keep minimal)
4. **Hashtags** for categorization

**Hashtag Categories:**
- #security - Security vulnerabilities or concerns
- #gas - Gas optimization opportunities
- #accessibility - User interface or access control
- #complexity - Code complexity or maintainability
- #functionality - Core contract features
- #interaction - How to interact with functions

Keep responses focused, actionable, and easy to scan.`,
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
