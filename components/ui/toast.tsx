'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { getResponseFormatter } from '@/lib/toast-formatters';
import { ChevronUp } from 'lucide-react';

export type ToastVariant = 'loading' | 'success' | 'error' | 'info';

export interface ToastProps {
  id: string;
  title: string;
  message: string;
  variant?: ToastVariant;
  progress?: number; // 0-100 for loading state
  duration?: number; // Auto-dismiss duration in ms
  onClick?: () => void;
  onDismiss?: () => void;
  result?: any; // Full result data for expandable content
  className?: string;
}

export function Toast({
  id,
  title,
  message,
  variant = 'info',
  progress,
  duration = 5000,
  onClick,
  onDismiss,
  result,
  className
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if content is expandable (arrays or objects with multiple properties)
  const hasExpandableContent = result &&
    (Array.isArray(result) && result.length > 0) ||
    (typeof result === 'object' && result !== null && Object.keys(result).length > 1);

  useEffect(() => {
    // Trigger slide-in animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (variant !== 'loading' && duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [variant, duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss?.();
    }, 300); // Match animation duration
  };

  const handleClick = () => {
    // If there's expandable content, toggle expansion
    if (hasExpandableContent) {
      setIsExpanded(!isExpanded);
    } else if (onClick) {
      // If no expandable content, call onClick
      onClick();
      handleDismiss();
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          icon: '✓',
          iconColor: 'text-green-500',
          progressColor: 'bg-green-500'
        };
      case 'error':
        return {
          icon: '⚠',
          iconColor: 'text-red-500',
          progressColor: 'bg-red-500'
        };
      case 'loading':
        return {
          icon: '⟳',
          iconColor: 'text-blue-500',
          progressColor: 'bg-blue-500'
        };
      default:
        return {
          icon: 'ℹ',
          iconColor: 'text-blue-500',
          progressColor: 'bg-blue-500'
        };
    }
  };

  const { icon, iconColor, progressColor } = getVariantStyles();

  return (
    <div
      onClick={handleClick}
      className={cn(
        // Base styles - Apple-inspired design
        "relative bg-white/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl shadow-black/10 transition-all duration-300 ease-out cursor-pointer",
        // Positioning and animation
        "transform translate-x-full opacity-0",
        isVisible && !isExiting && "translate-x-0 opacity-100",
        isExiting && "translate-x-full opacity-0 scale-95",
        // Size based on expansion
        isExpanded ? "w-96 max-h-96" : "w-80",
        // Hover effects
        "hover:shadow-2xl hover:shadow-black/15 hover:scale-[1.02] hover:bg-white/98",
        className
      )}
    >
      {/* Animated Chevron Icons */}
      {hasExpandableContent && (
        <div className="flex justify-center gap-1 py-2 px-4 border-b border-gray-200">
          {[0, 1, 2].map((index) => (
            <ChevronUp
              key={index}
              className="w-3 h-3 text-black animate-ping"
              style={{
                animationDelay: `${index * 0.2}s`,
                animationDuration: '1s'
              }}
            />
          ))}
        </div>
      )}

      {/* Header Section - Always visible */}
      <div className="flex items-start gap-3 p-4 pb-2">
        {/* Icon */}
        <div className={cn(
          "flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-gray-50 transition-transform group-hover:scale-110",
          variant === 'loading' && "animate-spin"
        )}>
          <span className={cn("text-sm font-medium", iconColor)}>
            {icon}
          </span>
        </div>

        {/* Header Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-gray-900">
                {title}
              </h4>
              <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                {message}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1">
              {/* Dismiss button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismiss();
                }}
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-black bg-purple-200/30 backdrop-blur-sm border border-purple-300/50 rounded-full transition-all duration-200 hover:bg-purple-300/40 hover:scale-110 shadow-sm"
                aria-label="Dismiss notification"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Progress bar for loading state */}
          {variant === 'loading' && (
            <div className="mt-3">
              <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300 ease-out",
                    progressColor,
                    progress !== undefined ? "transition-all duration-300" : "animate-pulse"
                  )}
                  style={{
                    width: progress !== undefined ? `${Math.max(5, progress)}%` : '30%'
                  }}
                />
              </div>
            </div>
          )}

          {/* Success/Error progress bar animation */}
          {(variant === 'success' || variant === 'error') && (
            <div className="mt-3">
              <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full animate-pulse",
                    progressColor
                  )}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expandable Content Area */}
      {isExpanded && result && (
        <div className="border-t border-gray-200">
          <div className="p-4 pt-3 max-h-64 overflow-y-auto">
            {getResponseFormatter(result)(result)}
          </div>
        </div>
      )}
    </div>
  );
}


