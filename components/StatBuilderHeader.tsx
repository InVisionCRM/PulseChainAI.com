'use client';

import React from 'react';

interface StatBuilderHeaderProps {
  onViewToggle?: (view: string) => void;
  currentView?: string;
}

export default function StatBuilderHeader({ 
  onViewToggle, 
  currentView = 'preview' 
}: StatBuilderHeaderProps) {
  return (
    <div className="bg-[var(--app-bg)] backdrop-blur-xl border-b border-[var(--line-strong)] p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left side - Title and Tabs */}
        <div className="flex items-center space-x-6">
          <h1 className="text-xl font-bold text-[var(--text)] flex items-center space-x-2">
            <span>📊</span>
            <span>Stat Builder</span>
          </h1>
          
          {/* View Tabs */}
          <div className="flex space-x-1">
            <button
              onClick={() => onViewToggle?.('preview')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'preview'
                  ? 'bg-[var(--app-bg)] text-[var(--text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => onViewToggle?.('code')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'code'
                  ? 'bg-[var(--app-bg)] text-[var(--text)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
              }`}
            >
              Code
            </button>
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {}}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-[var(--text)] rounded-lg text-sm font-medium transition-colors"
            title="Test Button"
          >
            Test
          </button>
          <button
            className="px-4 py-2 bg-[var(--surface-2)] hover:bg-[var(--surface-2)] text-[var(--text)] rounded-lg text-sm font-medium transition-colors"
            title="Settings"
          >
            ⚙️
          </button>
          <button
            className="px-4 py-2 bg-[var(--surface-2)] hover:bg-[var(--surface-2)] text-[var(--text)] rounded-lg text-sm font-medium transition-colors"
            title="Help"
          >
            ?
          </button>
        </div>
      </div>
    </div>
  );
} 