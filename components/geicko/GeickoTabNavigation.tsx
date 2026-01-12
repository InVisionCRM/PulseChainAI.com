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
    <div className="px-2 md:px-3 pt-2 pb-1 mt-4 relative z-30">
      <div className="flex h-6 divide-x divide-white bg-theme-navy overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 text-center text-xs font-semibold px-3 py-2 transition-colors ${
                isActive ? 'text-green-500 bg-theme-navy' : 'text-gray-400'
              } hover:text-white hover:bg-gray-800/60`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
