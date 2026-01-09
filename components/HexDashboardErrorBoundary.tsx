'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class HexDashboardErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('HEX Dashboard AI Agent Error:', error);
    console.error('Error Info:', errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <div className="text-red-800 mb-2 font-medium">Something went wrong with the AI Agent</div>
          <div className="text-red-600 text-sm mb-3">
            {this.state.error.message || 'An unexpected error occurred'}
          </div>
          <button
            onClick={this.resetError}
            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Simple error boundary wrapper for the HEX AI Agent
export const HexAIAgentErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <HexDashboardErrorBoundary>
      {children}
    </HexDashboardErrorBoundary>
  );
};

export default HexDashboardErrorBoundary;

