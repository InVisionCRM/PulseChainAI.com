'use client';

import React, { useEffect, useState } from 'react';
import HeroTokenAiChat from '@/components/HeroTokenAiChat';

export default function Home(): JSX.Element {
  const [showBetaBanner, setShowBetaBanner] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = window.localStorage.getItem('beta-banner-dismissed');
    if (!dismissed) {
      setShowBetaBanner(true);
    }
  }, []);

  const handleCloseBeta = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('beta-banner-dismissed', '1');
    }
    setShowBetaBanner(false);
  };

  return (
    <div className="w-full">
      {showBetaBanner && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="relative max-w-xl w-full rounded-2xl border border-white/15 bg-white/10 p-6 text-white shadow-2xl">
            <button
              type="button"
              aria-label="Close beta notice"
              onClick={handleCloseBeta}
              className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center border border-white/20 transition"
            >
              <span className="text-lg font-bold">×</span>
            </button>
            <p className="text-lg font-semibold text-purple-200 mb-2">Beta Access Notice</p>
            <p className="text-sm leading-relaxed text-white/90">
              All features on <span className="font-semibold text-purple-300">Morbius.io</span> are currently <span className="font-semibold">FREE TO USE</span> during the BETA stage. In future, premium access will only be available through the use of{" "}
              <a
                href="https://pump.tires/token/0xB7d4eB5fDfE3d4d3B5C16a44A49948c6EC77c6F1"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-purple-300 underline underline-offset-2 hover:text-purple-200"
              >
                Morbius Tokens
              </a>.
            </p>
          </div>
        </div>
      )}
      <div className="min-h-screen relative w-full flex flex-col items-center justify-center">
        <video
          className="absolute inset-0 w-full h-full object-cover z-0"
          autoPlay
          loop
          muted
          playsInline
        >
          <source
            src="https://dvba8d38nfde7nic.public.blob.vercel-storage.com/Video/pulsechain-a2.mp4"
            type="video/mp4"
          />
        </video>
        <div className="absolute inset-0 w-full h-full bg-slate-950/20 z-10 pointer-events-none" />

        <HeroTokenAiChat />
      </div>
    </div>
  );
}
