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
    const body = await req.json();
    console.log('Chat API received body:', JSON.stringify(body, null, 2));
    
    const { message, contractData, tokenInfo, dexScreenerData } = body;

    console.log('Extracted data:', {
      hasMessage: !!message,
      hasContractData: !!contractData,
      hasTokenInfo: !!tokenInfo,
      hasDexScreenerData: !!dexScreenerData,
      contractDataKeys: contractData ? Object.keys(contractData) : 'null',
      message: message?.substring(0, 100) + '...'
    });

    if (!message || !contractData) {
      console.log('Validation failed:', { message: !!message, contractData: !!contractData });
      return new Response(JSON.stringify({ error: 'Missing message or contract data' }), { status: 400, headers: {'Content-Type': 'application/json'} });
    }
    
    // Get API key from environment variable like other APIs
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.log('GEMINI_API_KEY environment variable missing');
      return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500, headers: {'Content-Type': 'application/json'} });
    }
    
    const ai = new GoogleGenAI({ apiKey });
    
    // Build contract context from the data
    const contractContext = {
      name: contractData.name || 'Unknown Contract',
      source_code: contractData.source_code || 'No source code available',
      address: contractData.address_hash || contractData.address || 'Unknown address',
      creator: contractData.creator_address_hash || 'Unknown creator',
      token_info: tokenInfo ? {
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        decimals: tokenInfo.decimals,
        total_supply: tokenInfo.total_supply
      } : null,
      dex_data: dexScreenerData ? {
        pairs: dexScreenerData.pairs?.length || 0,
        price: dexScreenerData.pairs?.[0]?.priceUsd || 'Unknown'
      } : null
    };

    console.log('Built contract context:', contractContext);

    // Simple response like AIAgentChat expects
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: message,
      config: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4000,
        systemInstruction: `You are a world-class expert in Solidity and smart contract security. Analyze the provided smart contract source code to answer questions using the AI Smart Contract Response Formatting Guide. The user has loaded the contract named '${contractContext.name}' at address ${contractContext.address}.

\`\`\`solidity
${contractContext.source_code}
\`\`\`

**Contract Context:**
- **Name**: ${contractContext.name}
- **Address**: ${contractContext.address}
- **Creator**: ${contractContext.creator}
${contractContext.token_info ? `- **Token**: ${contractContext.token_info.name} (${contractContext.token_info.symbol}) - ${contractContext.token_info.decimals} decimals` : ''}
${contractContext.dex_data ? `- **DEX Pairs**: ${contractContext.dex_data.pairs} - Current Price: $${contractContext.dex_data.price}` : ''}

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
    
    console.log('Gemini API result structure:', JSON.stringify(result, null, 2));
    
    // Extract response text using the actual Gemini API structure
    let response = '';
    if (result.candidates && result.candidates[0] && result.candidates[0].content) {
      for (const part of result.candidates[0].content.parts) {
        if (part.text) {
          response += part.text;
        }
      }
    }
    
    if (!response) {
      console.error('No response text found in result:', result);
      throw new Error('No response text received from Gemini API');
    }
    
    console.log('Extracted response:', response.substring(0, 200) + '...');

    return new Response(JSON.stringify({ response }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('Chat API error:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: `Chat API error: ${errorMessage}` }), { status: 500, headers: {'Content-Type': 'application/json'} });
  }
}
