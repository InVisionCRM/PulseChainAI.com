import React from 'react';
import { ActiveTab, TabConfig } from './types';

export interface GeickoTabNavigationProps {
  /** Currently active tab */
  activeTab: ActiveTab;
  /** Callback when tab is changed */
  onTabChange: (tab: ActiveTab) => void;
  /** Array of tab configurations */
  tabs: TabConfig[];
  /** UI variant (classic or rabby) */
  variant?: 'classic' | 'rabby';
}

/**
 * Tab navigation component for Geicko token analyzer
 * Displays tabs for Chart, Holders, Liquidity, Code, etc.
 */
export default function GeickoTabNavigation({
  activeTab,
  onTabChange,
  tabs,
  variant = 'classic',
}: GeickoTabNavigationProps) {
  const isRabby = variant === 'rabby';

  return (
    <div className="px-2 md:px-3 relative z-30 -mb-1">
      <div className="flex h-8 bg-transparent overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 text-center text-xs font-semibold px-4 py-2 mx-1 rounded-t-lg border-t border-l border-r transition-all duration-200 ${
                isActive
                  ? 'text-white bg-gray-900 border-gray-700 shadow-sm'
                  : 'text-gray-400 bg-gray-800/50 border-gray-700 hover:text-white hover:bg-gray-800/80'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
