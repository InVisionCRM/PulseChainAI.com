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
    <div className="px-2 md:px-3 pt-4s pb-4 mt-4 relative z-30">
      {isRabby ? (
        // Rabby UI Style
        <div className="flex flex-wrap gap-2 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isCodeTab = tab.id === 'contract';
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`text-lg transition-all duration-200 ${
                  isActive
                    ? isCodeTab
                      ? 'text-xl font-semibold border-b-[3px] border-purple-500 text-purple-500'
                      : 'text-xl font-semibold border-b-[3px] border-purple-500 text-purple-500'
                    : 'text-white/75 hover:text-purple-500 font-semibold'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : (
        // Classic UI Style
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isCodeTab = tab.id === 'contract';
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`text-lg transition-all duration-200 ${
                  isActive
                    ? isCodeTab
                      ? 'text-xl font-semibold border-b-[3px] border-purple-500 text-purple-500'
                      : 'text-xl font-semibold border-b-[3px] border-purple-500 text-purple-500'
                    : 'text-white/75 hover:text-purple-500'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
