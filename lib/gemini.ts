import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

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

export async function generateGeminiResponse(prompt: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.response.text || 'No response generated';
  } catch (error) {
    console.error('Error generating Gemini response:', error);
    return 'Sorry, I encountered an error while processing your request. Please try again.';
  }
} 