import React from 'react';
import LoadingSpinner from './icons/LoadingSpinner';

interface MobileOptimizedLoaderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'spinner' | 'dots' | 'pulse';
}

const MobileOptimizedLoader: React.FC<MobileOptimizedLoaderProps> = ({ 
  message = 'Loading...', 
  size = 'md',
  variant = 'spinner' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const messageClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const renderLoader = () => {
    switch (variant) {
      case 'dots':
        return (
          <div className="flex space-x-1">
            <div className={`${sizeClasses[size]} bg-purple-500 rounded-full animate-bounce`} style={{ animationDelay: '0ms' }}></div>
            <div className={`${sizeClasses[size]} bg-purple-500 rounded-full animate-bounce`} style={{ animationDelay: '150ms' }}></div>
            <div className={`${sizeClasses[size]} bg-purple-500 rounded-full animate-bounce`} style={{ animationDelay: '300ms' }}></div>
          </div>
        );
      case 'pulse':
        return (
          <div className={`${sizeClasses[size]} bg-purple-500 rounded-full animate-pulse`}></div>
        );
      default:
        return <LoadingSpinner className={sizeClasses[size]} />;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 space-y-3">
      <div className="loading-optimized">
        {renderLoader()}
      </div>
      {message && (
        <p className={`text-slate-400 ${messageClasses[size]} text-center`}>
          {message}
        </p>
      )}
    </div>
  );
};

export default MobileOptimizedLoader; 