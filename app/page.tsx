'use client';

import React, { useEffect, useState } from 'react';
import HeroTokenAiChat from '@/components/Home/HeroTokenAiChat';
import TokenTable from '@/components/TokenTable';


export default function Home(): JSX.Element {
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
      </section>

      {/* Token Table Section */}
      <section className="relative z-20 w-full bg-black py-5">
        <TokenTable />
      </section>
    </div>
  );
}
