'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Toast, ToastProps } from './toast';

interface ToastContextType {
  showToast: (toast: Omit<ToastProps, 'onDismiss'>) => void;
  updateToast: (id: string, updates: Partial<Omit<ToastProps, 'id' | 'onDismiss'>>) => void;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const showToast = useCallback((toast: Omit<ToastProps, 'onDismiss'>) => {
    const newToast: ToastProps = {
      ...toast,
      onDismiss: () => dismissToast(toast.id),
    };

    setToasts(prev => {
      // Remove existing toast with same ID if it exists
      const filtered = prev.filter(t => t.id !== toast.id);
      // Add new toast at the end (will appear at bottom)
      return [...filtered, newToast];
    });
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Omit<ToastProps, 'id' | 'onDismiss'>>) => {
    setToasts(prev => prev.map(toast =>
      toast.id === id ? { ...toast, ...updates } : toast
    ));
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const value = {
    showToast,
    updateToast,
    dismissToast,
    clearAllToasts,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast Container - Apple-style bottom-right positioning */}
      <div className="fixed bottom-6 right-6 z-[1000] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            className="pointer-events-auto"
            style={{
              // Stagger animation for multiple toasts
              animationDelay: `${index * 100}ms`,
            }}
          >
            <Toast {...toast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
