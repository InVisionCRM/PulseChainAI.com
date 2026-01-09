import React, { useEffect } from 'react';

export interface GeickoToastProps {
  /** Toast message to display */
  message: string;
  /** Optional callback when toast closes */
  onClose?: () => void;
  /** Auto-dismiss duration in milliseconds (default: 2000) */
  duration?: number;
  /** Position of toast */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'bottom-center';
  /** Visual variant */
  variant?: 'default' | 'success' | 'error' | 'warning';
}

/**
 * Toast notification component for temporary feedback messages
 * Used for copy confirmations and other quick feedback
 */
export default function GeickoToast({
  message,
  onClose,
  duration = 2000,
  position = 'bottom-right',
  variant = 'default',
}: GeickoToastProps) {
  // Auto-dismiss after duration
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  // Variant styles
  const variantClasses = {
    default: 'bg-white/10 border-white/20 text-white',
    success: 'bg-green-500/20 border-green-400/30 text-green-100',
    error: 'bg-red-500/20 border-red-400/30 text-red-100',
    warning: 'bg-amber-500/20 border-amber-400/30 text-amber-100',
  };

  return (
    <div className={`fixed ${positionClasses[position]} z-[1000] animate-in fade-in slide-in-from-bottom-2`}>
      <div
        className={`
          rounded-xl ${variantClasses[variant]}
          border backdrop-blur px-4 py-2
          shadow-[0_10px_30px_rgba(0,0,0,0.35)]
          text-sm font-medium
          transition-all
        `}
      >
        {message}
      </div>
    </div>
  );
}
