import React from 'react';
import { ActiveTab } from './types';

/**
 * Generic in its tab id so pages outside geicko can share the bar rather than
 * grow a second one that drifts from it. `T` defaults to geicko's own union, so
 * every existing call site is unchanged.
 */
export interface GeickoTabNavigationProps<T extends string = ActiveTab> {
  /** Currently active tab */
  activeTab: T;
  /** Callback when tab is changed */
  onTabChange: (tab: T) => void;
  /** Array of tab configurations — `TabConfig[]` satisfies this for geicko. */
  tabs: readonly { id: T; label: string }[];
  /**
   * `stretch` (default) shares the row out evenly, which suits geicko's short
   * one-word labels. `scroll` sizes each tab to its label and lets the row
   * scroll instead — needed once a label is a phrase, or it wraps and clips.
   */
  fit?: 'stretch' | 'scroll';
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
export default function GeickoTabNavigation<T extends string = ActiveTab>({
  activeTab,
  onTabChange,
  tabs,
  fit = 'stretch',
}: GeickoTabNavigationProps<T>) {
  return (
    <div className="px-2 md:px-3 relative z-30 -mb-1">
      <div className="flex h-8 bg-transparent overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`text-center text-xs font-semibold tracking-wide px-4 py-2 mx-1 rounded-t-lg border-t border-l border-r backdrop-blur-sm transition-all duration-200 ${
                fit === 'scroll' ? 'flex-none whitespace-nowrap sm:flex-1' : 'flex-1'
              } ${isActive ? TAB_ACTIVE : TAB_INACTIVE}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
