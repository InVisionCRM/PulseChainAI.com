'use client';

import React, { useEffect, useState } from 'react';
import HeroTokenAiChat from '@/components/HeroTokenAiChat';


export default function Home(): JSX.Element {
  return (
    <div className="w-full">
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
