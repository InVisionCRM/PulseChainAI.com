'use client';

import React, { useState } from 'react';
import { IconX } from '@tabler/icons-react';

export default function StickyBanner() {
  const [isClosed, setIsClosed] = useState(false);

  if (isClosed) return null;

  return (
    <div className="sticky top-0 z-50 w-full bg-black/25 text-white backdrop-blur-sm">
      <div className="mx-auto flex w-full items-center justify-between gap-2 px-3 py-2 md:px-4">
        <p className="font-poppins font-bold text-[11px] md:text-sm text-center flex-1">
          Poker and Multiplayer BlackJack are now live on Morbius.io! Click{' '}
          <a
            href="https://win.morbius.io"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-cyan-300 transition-colors"
          >
            HERE
          </a>{' '}
          to Play Now!
        </p>
        <button
          type="button"
          onClick={() => setIsClosed(true)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close banner"
          title="Close banner"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}