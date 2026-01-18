'use client';

import React from 'react';

export default function StickyBanner() {
  return (
    <div className="sticky top-0 z-50 w-full bg-gradient-to-r from-cyan-700/50 to-purple-700/50 text-white shadow-lg">
      <div className="container mx-auto px-4 py-3 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-bold font-poppins">
            PulseChain PLINKO is NOW{' '}
            <a
              href="https://win.morbius.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-500 hover:text-purple-600 underline decoration-2 decoration-purple-600 hover:decoration-cyan-500 transition-all duration-200 font-extrabold"
            >
              LIVE
            </a>
            !
          </p>
        </div>
      </div>
    </div>
  );
}