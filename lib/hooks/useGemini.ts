import { useState, useCallback } from 'react';

interface UseGeminiOptions {
  includeThoughts?: boolean;
  onThoughtUpdate?: (thought: string) => void;
  onAnswerUpdate?: (answer: string) => void;
  onComplete?: (finalThoughts: string, finalAnswer: string) => void;
}

interface UseGeminiReturn {
  generate: (prompt: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useGemini(options: UseGeminiOptions = {}): UseGeminiReturn {
  const { 
    includeThoughts = false, 
    onThoughtUpdate, 
    onAnswerUpdate, 
    onComplete 
  } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (prompt: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          includeThoughts,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate content');
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let thoughts = '';
      let answer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                switch (data.type) {
                  case 'thought':
                    thoughts += data.text;
                    onThoughtUpdate?.(thoughts);
                    break;
                  case 'answer':
                    answer += data.text;
                    onAnswerUpdate?.(answer);
                    break;
                  case 'content':
                    answer += data.text;
                    onAnswerUpdate?.(answer);
                    break;
                  case 'done':
                    onComplete?.(thoughts, answer);
                    return;
                  case 'error':
                    throw new Error(data.error);
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE data:', line, parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [includeThoughts, onThoughtUpdate, onAnswerUpdate, onComplete]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    generate,
    isLoading,
    error,
    clearError,
  };
} 