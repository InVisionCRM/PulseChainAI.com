import { GoogleGenAI } from '@google/genai';
import { NextRequest } from 'next/server';

// Helper function to attempt API call with fallback
async function generateWithFallback(message: string, contractContext: any) {
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

      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [{ text: message }]
        }],
        config: {
          temperature: 0.5,
          topK: 10,
          topP: 0.25,
          maxOutputTokens: 4000,
          systemInstruction: `You are a world-class expert in Solidity and smart contract analyzing. You are an expert and breaking things down into simple terms for the user. Analyze the provided smart contract source code to answer questions using the AI Smart Contract Response Formatting Guide. .The user has loaded the contract named '${contractContext.name}' at address ${contractContext.address}.

\`\`\`solidity
${contractContext.source_code}
\`\`\`

Contract Context:
- Name: ${contractContext.name}
- Address: ${contractContext.address}
- Creator: ${contractContext.creator}
${contractContext.token_info ? `- Token: ${contractContext.token_info.name} (${contractContext.token_info.symbol}) - ${contractContext.token_info.decimals} decimals` : ''}
${contractContext.dex_data ? `- DEX Pairs: ${contractContext.dex_data.pairs} - Current Price: $${contractContext.dex_data.price}` : ''}

AI Smart Contract Response Formatting Guide:

## Universal Formatting Rules for AI Responses

### 1. Use Section Headings
- Use ## for major response sections
- Use ### for subsections
- Always use descriptive headers

### 2. Use Bullet Points for Lists
- Use - for unordered lists
- Group related items by purpose or category
- Always explain what and why

### 3. Use Numbered Lists for Steps or Ordered Logic
- Use 1., 2., etc.
- Ideal for initialization, call sequence, setup flows

### 4. DO NOT USE BOLD OR ITALIC FORMATTING
- Never use asterisks for bold or italic text
- Keep all text plain and readable
- Emphasis should come from structure and word choice, not formatting

### 5. Use Tables for Compact Overviews
- Especially useful for summarizing dependencies or role mappings

### 6. Use Code Blocks for Code Snippets
- Use backticks (\`\`\`) to enclose code
- Preferred for function signatures, events, or examples

### 7. Use Emojis for Visual Anchoring (Optional)
- Helps organize sections at a glance
- Suggested: ✅, 🔧, 🔍, ⚠️, 📊, 📜
- Keep them minimal and relevant

### 8. Use Horizontal Rules (---) to Separate Major Sections
- Improves visual hierarchy in longer responses

### 9. TAXES: When prompted about taxes, always respond with the exact tax in terms of percentage and include exact percentage of any sort of tax that is applied in contract. For example: 5% tax total on buys and sells - 2% to buy and burn, 1% to a wallet address {wallet address} and 2% to liquidity {liquidity pair}. If you get 5000 out of 100000, simply respond with 5%. Always list taxes in order of Buy/Sell/Transfer. If tax is split between different distributions, list each one. If taxes are different between buys and sells, list each one. If taxes are different between buys and sells and transfers, list each one.
- Use clear and concise language. The users who are prompting you are not coders.
- List how taxes are split between buys, sells, and transfers (liquidty, staking, burning, etc.)
- When asked anything about tax, start response with the exact tax amounts currently set. It should be in bullet points and broken down precisely. Never be vague about taxes. You must list all current tax values and their exact values in percentages.

CRITICAL: Keep responses CONCISE and in human readable language. Aim for 2-4 sentences max for simple questions, 1-2 paragraphs for complex analysis.

Response Structure:
1. Direct answer (1-2 sentences)
2. Key points (bullet list, max 3-4 items)
3. Code example (if relevant, keep minimal)
4. Hashtags for categorization

Hashtag Categories:
- #security - Security vulnerabilities or concerns
- #gas - Gas optimization opportunities
- #accessibility - User interface or access control
- #complexity - Code complexity or maintainability
- #functionality - Core contract features
- #interaction - How to interact with functions

Keep responses focused, actionable, and easy to scan.`,
        },
      });

      console.log(`Success with ${keyLabel} API key`);
      return result;

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

    // Use fallback function to generate content
    const result = await generateWithFallback(message, contractContext);

    console.log('Gemini API result received');

    // Extract response text using the correct Gemini API structure
    const response = result.text;

    if (!response) {
      console.error('No response text found in result');
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
