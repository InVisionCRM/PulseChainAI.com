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

// Per-tab color config: [activeText, activeBorder, inactiveText, inactiveBg, inactiveBorder, hoverText, hoverBg]
const TAB_COLORS: Record<ActiveTab, {
  active: string;
  inactive: string;
}> = {
  gold:      { active: 'text-amber-400 bg-brand-navy border-amber-500/50',       inactive: 'text-amber-400/80 bg-amber-950/30 border-amber-500/30 hover:text-amber-300 hover:bg-amber-950/50' },
  chart:     { active: 'text-cyan-400 bg-brand-navy border-cyan-500/50',          inactive: 'text-cyan-400/60 bg-cyan-950/20 border-cyan-700/40 hover:text-cyan-300 hover:bg-cyan-950/40' },
  holders:   { active: 'text-violet-400 bg-brand-navy border-violet-500/50',      inactive: 'text-violet-400/60 bg-violet-950/20 border-violet-700/40 hover:text-violet-300 hover:bg-violet-950/40' },
  liquidity: { active: 'text-emerald-400 bg-brand-navy border-emerald-500/50',    inactive: 'text-emerald-400/60 bg-emerald-950/20 border-emerald-700/40 hover:text-emerald-300 hover:bg-emerald-950/40' },
  contract:  { active: 'text-orange-400 bg-brand-navy border-orange-500/50',      inactive: 'text-orange-400/60 bg-orange-950/20 border-orange-700/40 hover:text-orange-300 hover:bg-orange-950/40' },
  switch:    { active: 'text-pink-400 bg-brand-navy border-pink-500/50',          inactive: 'text-pink-400/60 bg-pink-950/20 border-pink-700/40 hover:text-pink-300 hover:bg-pink-950/40' },
  website:   { active: 'text-sky-400 bg-brand-navy border-sky-500/50',            inactive: 'text-sky-400/60 bg-sky-950/20 border-sky-700/40 hover:text-sky-300 hover:bg-sky-950/40' },
  stats:     { active: 'text-yellow-400 bg-brand-navy border-yellow-500/50',      inactive: 'text-yellow-400/60 bg-yellow-950/20 border-yellow-700/40 hover:text-yellow-300 hover:bg-yellow-950/40' },
  audit:     { active: 'text-red-400 bg-brand-navy border-red-500/50',            inactive: 'text-red-400/60 bg-red-950/20 border-red-700/40 hover:text-red-300 hover:bg-red-950/40' },
};

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
          const colors = TAB_COLORS[tab.id] ?? {
            active: 'text-cyan-400 bg-brand-navy border-cyan-500/50',
            inactive: 'text-gray-400 bg-gray-800/50 border-gray-700 hover:text-white hover:bg-gray-800/80',
          };
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 text-center text-xs font-semibold px-4 py-2 mx-1 rounded-t-lg border-t border-l border-r transition-all duration-200 ${
                isActive ? colors.active : colors.inactive
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
