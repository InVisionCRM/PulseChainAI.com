import React from 'react';
import { ActiveTab } from './types';

export interface RabbyAction {
  label: string;
  icon: string;
  description: string;
  onClick: () => void;
}

export interface GeickoRabbyActionButtonsProps {
  /** Callback when tab change is requested */
  onTabChange: (tab: ActiveTab) => void;
  /** Callback for opening external links */
  onExternalLink: (url: string) => void;
}

/**
 * Rabby-style action buttons grid for Geicko
 * Quick access buttons for Swap, Holders, Code, Website, Stats, Bridge
 */
export default function GeickoRabbyActionButtons({
  onTabChange,
  onExternalLink,
}: GeickoRabbyActionButtonsProps) {
  const rabbyActions: RabbyAction[] = [
    {
      label: 'Swap',
      icon: '⇄',
      description: 'Trade instantly',
      onClick: () => onTabChange('switch'),
    },
    {
      label: 'Holders',
      icon: '👥',
      description: 'Top wallets',
      onClick: () => onTabChange('holders'),
    },
    {
      label: 'Code',
      icon: '{ }',
      description: 'Contract view',
      onClick: () => onTabChange('contract'),
    },
    {
      label: 'Website',
      icon: '🌐',
      description: 'Official site',
      onClick: () => onTabChange('website'),
    },
    {
      label: 'Stats',
      icon: '📊',
      description: 'Advanced analytics',
      onClick: () => onTabChange('stats'),
    },
    {
      label: 'Bridge',
      icon: '🌉',
      description: 'PulseChain hub',
      onClick: () => onExternalLink('https://bridge.pulsechain.com/'),
    },
  ];

  return (
    <main className="px-4 sm:px-8 -mt-10 pb-12 space-y-5">
      <section className="bg-white rounded-[28px] shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {rabbyActions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className="flex items-center gap-3 rounded-2xl border border-slate-100 px-3 py-3 text-left hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
            >
              <span className="text-lg text-indigo-500">{action.icon}</span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{action.label}</p>
                <p className="text-xs text-slate-500">{action.description}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
