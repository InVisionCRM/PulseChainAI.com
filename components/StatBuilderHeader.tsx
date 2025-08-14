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
    <div className="bg-black/80 backdrop-blur-xl border-b border-white/20 p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left side - Title and Tabs */}
        <div className="flex items-center space-x-6">
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <span>📊</span>
            <span>Stat Builder</span>
          </h1>
          
          {/* View Tabs */}
          <div className="flex space-x-1">
            <button
              onClick={() => onViewToggle?.('preview')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'preview'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => onViewToggle?.('code')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'code'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
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
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            title="Test Button"
          >
            Test
          </button>
          <button
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
            title="Settings"
          >
            ⚙️
          </button>
          <button
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
            title="Help"
          >
            ?
          </button>
        </div>
      </div>
    </div>
  );
} 