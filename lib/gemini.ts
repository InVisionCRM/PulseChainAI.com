import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({});

export async function generateWithThoughts(prompt: string): Promise<{ thoughts: string; answer: string }> {
  let thoughts = "";
  let answer = "";

  const response = await ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      thinkingConfig: {
        includeThoughts: true,
      },
    },
  });

  for await (const chunk of response) {
    for (const part of chunk.candidates[0].content.parts) {
      if (!part.text) {
        continue;
      } else if (part.thought) {
        thoughts = thoughts + part.text;
      } else {
        answer = answer + part.text;
      }
    }
  }

  return { thoughts, answer };
} 