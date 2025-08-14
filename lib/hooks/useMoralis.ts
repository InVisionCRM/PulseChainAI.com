import { useState, useEffect, useCallback } from 'react';
import { initializeMoralis, moralisService } from '@/services/moralisService';

// Integrated Moralis API key
const INTEGRATED_MORALIS_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjYzOWU4ZWMwLTJkM2ItNDgwYS04MWY5LTdiMDM3OTYxZjIyYSIsIm9yZ0lkIjoiNDMyMTk3IiwidXNlcklkIjoiNDQ0NTc3IiwidHlwZUlkIjoiZWY3YmEyYjMtMTMyYS00MWI0LWEyMDgtYTUwNGEzMjk5NDMzIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3Mzk4NTgyMDYsImV4cCI6NDg5NTYxODIwNn0.iSuHF229Nk_9yiiqDxyyGM0MB6DEG09gLa2oFWYf5us';

export interface UseMoralisReturn {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  reset: () => void;
}

export function useMoralis(): UseMoralisReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await initializeMoralis(INTEGRATED_MORALIS_API_KEY);
      moralisService.setInitialized(true);
      setIsInitialized(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize Moralis';
      setError(errorMessage);
      setIsInitialized(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsInitialized(false);
    setIsLoading(false);
    setError(null);
    moralisService.setInitialized(false);
  }, []);

  // Auto-initialize Moralis on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  return {
    isInitialized,
    isLoading,
    error,
    initialize,
    reset,
  };
} 