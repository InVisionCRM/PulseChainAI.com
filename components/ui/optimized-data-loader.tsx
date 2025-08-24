"use client";

import React, { memo } from 'react';

interface OptimizedDataLoaderProps {
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  loadingMessage?: string;
  children: React.ReactNode;
  className?: string;
}

export const OptimizedDataLoader = memo<OptimizedDataLoaderProps>(({ 
  isLoading, 
  error, 
  onRetry, 
  loadingMessage = "Loading data...", 
  children,
  className = ""
}) => {
  if (isLoading) {
    return (
      <div className={`bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 ${className}`}>
        <div className="flex flex-col items-center justify-center py-8">
          <div className="animate-pulse rounded-full h-8 w-8 bg-purple-500/50 mb-3"></div>
          <p className="text-white/80 text-sm">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-500/10 border border-red-500/20 rounded-xl p-6 ${className}`}>
        <div className="flex flex-col items-center justify-center py-8">
          <div className="text-red-400 text-lg mb-2">⚠️</div>
          <p className="text-red-300 text-sm mb-4 text-center">{error}</p>
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
});

OptimizedDataLoader.displayName = 'OptimizedDataLoader';