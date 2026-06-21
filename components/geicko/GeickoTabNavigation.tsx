import React from 'react';
import { ActiveTab, TabConfig } from './types';

export interface GeickoTabNavigationProps {
  /** Currently active tab */
  activeTab: ActiveTab;
  /** Callback when tab is changed */
  onTabChange: (tab: ActiveTab) => void;
  /** Array of tab configurations */
  tabs: TabConfig[];
}

// Unified brand-pure palette: every tab uses the same neutral surface +
// brand-orange active state, matching the Portfolio page.
const TAB_ACTIVE =
  'text-brand-orange bg-[var(--surface)] border-brand-orange/40 shadow-[inset_0_0_0_1px_rgba(250,70,22,0.18)]';
const TAB_INACTIVE =
  'text-[var(--text-muted)] bg-[var(--surface)] border-[var(--line)] hover:text-[var(--text)] hover:bg-[var(--surface)] hover:border-[var(--line)]';

/**
 * Tab navigation component for Geicko token analyzer
 * Displays tabs for Chart, Holders, Liquidity, Code, etc.
 */
export default function GeickoTabNavigation({
  activeTab,
  onTabChange,
  tabs,
}: GeickoTabNavigationProps) {
  return (
    <div className="px-2 md:px-3 relative z-30 -mb-1">
      <div className="flex h-8 bg-transparent overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 text-center text-xs font-semibold tracking-wide px-4 py-2 mx-1 rounded-t-lg border-t border-l border-r backdrop-blur-sm transition-all duration-200 ${
                isActive ? TAB_ACTIVE : TAB_INACTIVE
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
