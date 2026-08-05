"use client";

// Sidebar entry point for the devlog. Styled to sit in the same column as the
// SidebarLink rows (same padding, radius and hover) even though it opens a
// modal instead of navigating, and carries an unseen dot until it's been read.

import React from 'react';
import { IconSparkles } from '@tabler/icons-react';
import { openDevlog, useDevlogUnseen } from './DevlogModal';

export default function DevlogNavButton({ className }: { className?: string }) {
  const unseen = useDevlogUnseen();
  return (
    <button
      type="button"
      onClick={openDevlog}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[var(--text)] transition-colors hover:bg-[var(--surface)] ${className || ''}`}
    >
      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
        <IconSparkles className="h-5 w-5 text-[var(--text)]" />
        {unseen && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-[var(--app-bg)]" />
        )}
      </span>
      <span className="inline-block whitespace-pre text-xs md:text-sm">What&apos;s New</span>
      {unseen && (
        <span className="ml-auto rounded border border-orange-400/40 bg-orange-400/10 px-1.5 py-px font-mono text-[9px] font-semibold tracking-wider text-orange-300">
          NEW
        </span>
      )}
    </button>
  );
}
