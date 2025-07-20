import { useState, useEffect } from 'react';

const API_KEY_STORAGE_KEY = 'pulsechain_ai_gemini_api_key';

export const useApiKey = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load API key from session storage on mount
    const storedApiKey = sessionStorage.getItem(API_KEY_STORAGE_KEY);
    setApiKey(storedApiKey);
    setIsLoading(false);
  }, []);

  const saveApiKey = (key: string) => {
    if (key.trim()) {
      sessionStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
      setApiKey(key.trim());
    } else {
      clearApiKey();
    }
  };

  const clearApiKey = () => {
    sessionStorage.removeItem(API_KEY_STORAGE_KEY);
    setApiKey(null);
  };

  const getApiKey = (): string | null => {
    return apiKey;
  };

  const hasApiKey = (): boolean => {
    return apiKey !== null && apiKey.trim().length > 0;
  };

  return {
    apiKey,
    isLoading,
    saveApiKey,
    clearApiKey,
    getApiKey,
    hasApiKey,
  };
}; 