'use client';

import React, { useEffect, useState } from 'react';
import HeroTokenAiChat from '@/components/Home/HeroTokenAiChat';
import TokenTable from '@/components/TokenTable';
import { IconChevronDown } from '@tabler/icons-react';


export default function Home(): JSX.Element {
  useEffect(() => {
    // Handle hash-based scrolling (e.g., from mobile nav)
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash) {
        const element = document.querySelector(hash);
        if (element) {
          // Small delay to ensure page is fully loaded
          setTimeout(() => {
            element.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }, 100);
        }
      }
    }
  }, []);

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="min-h-screen relative w-full flex flex-col items-center justify-center overflow-hidden">
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
        <div className="absolute inset-0 w-full h-full z-10 pointer-events-none" />

        <HeroTokenAiChat />

        {/* Scroll Indicator */}
        <div className="absolute bottom-[100px] h-32 p-0.5 transform left-1/2 -translate-x-1/2 translate-y-1/2 z-20 flex flex-col items-center">
          <span className="text-white text-md font-poppins font-bold mb-0.5 tracking-wide justify-center">SCROLL DOWN</span>
          <IconChevronDown className="h-6 w-6 text-white/80 justify-center animate-bounce" />
        </div>
      </section>

      {/* Token Table Section */}
      <section id="tokentable" className="relative z-20 w-full bg-black py-10">
        <TokenTable />
      </section>
    </div>
  );
}
