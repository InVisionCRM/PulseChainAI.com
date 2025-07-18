import { GoogleGenAI, Type } from '@google/genai';
import { NextResponse } from 'next/server';
import type { AbiItem } from '../../../types';

const getApiKey = (): string => {
  const key = process.env.API_KEY;
  if (!key) {
    throw new Error('API_KEY environment variable not set.');
  }
  return key;
};

export async function POST(request: Request) {
  try {
    const apiKey = getApiKey();
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
    const prompt = `Analyze the following smart contract's ABI functions. For each function, provide a concise, one-sentence explanation of its purpose from an end-user's perspective.
    Contract Source Code (for context, truncated):
    \`\`\`solidity
    ${sourceCode.substring(0, 30000)} 
    \`\`\`
    Functions to analyze:
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

    const parsed = JSON.parse(response.text);
    return NextResponse.json(parsed);

  } catch (e) {
    console.error('AI analysis API error:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred';
    return NextResponse.json({ error: `AI analysis failed: ${errorMessage}` }, { status: 500 });
  }
}
