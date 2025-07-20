import { GoogleGenAI, Type } from '@google/genai';
import { NextResponse } from 'next/server';
import type { AbiItem } from '@/types';
import { getApiKey } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const apiKey = getApiKey(request);
    const { abi, sourceCode } = await request.json();

    if (!abi || !sourceCode) {
      return NextResponse.json({ error: 'Missing ABI or source code' }, { status: 400 });
    }

    const functionsToExplain = (abi as AbiItem[]).filter(item => item.type === 'function' && item.name);
    if (functionsToExplain.length === 0) {
      return NextResponse.json({ functions: [] });
    }
    
    const simplifiedFunctions = functionsToExplain.map(({name, inputs, stateMutability}) => ({name, inputs: inputs.map(i => i.type), stateMutability}));

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Analyze the following smart contract's ABI functions using the AI Smart Contract Response Formatting Guide.

Contract Source Code (for context, truncated):
\`\`\`solidity
${sourceCode.substring(0, 30000)} 
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

For each function in the ABI, provide a concise explanation following this formatting guide:
${JSON.stringify(simplifiedFunctions)}
`;
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    functions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                explanation: { type: Type.STRING }
                            },
                            required: ['name', 'explanation']
                        }
                    }
                }
            },
        },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('No response text received from AI model');
    }
    const parsed = JSON.parse(responseText);
    return NextResponse.json(parsed);

  } catch (e) {
    console.error('AI analysis API error:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
    return NextResponse.json({ error: `AI analysis failed: ${errorMessage}` }, { status: 500 });
  }
}
