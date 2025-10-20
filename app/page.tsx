'use client';

import { Highlight } from "@/components/ui/hero-highlight";
import AIAgentsSection from "@/components/AIAgentsSection";
import LoaderThreeSection from "@/components/LoaderThreeSection";
import ColourfulText from "@/components/ui/colourful-text";
import { TopTokensList } from "@/components/TopTokensList";
import { ThreeDMarquee } from "@/components/ui/3d-marquee";
import Link from "next/link";
import { PlaceholdersAndVanishInput } from '@/components/ui/placeholders-and-vanish-input';
import { Button as StatefulButton } from '@/components/ui/stateful-button';
import { useRouter } from 'next/navigation';
import React from 'react';
import { search } from '@/services/pulsechainService';

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = React.useState<string>('');
  const [isSearching, setIsSearching] = React.useState<boolean>(false);
  const [results, setResults] = React.useState<Array<any>>([]);
  const [show, setShow] = React.useState<boolean>(false);
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  const placeholders = [
    "Search Any PulseChain Ticker",
    "Search By Name, Ticker, or Address",
    "Search for HEX...or HEX!",
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/ai-agent?address=${query.trim()}`);
  };
  
  const performSearch = React.useCallback((searchQuery: string) => {
    if (searchQuery.trim().length >= 2) {
      setIsSearching(true);
      search(searchQuery).then((r) => { 
        setResults(r); 
        setIsSearching(false); 
      });
    } else {
      setResults([]);
      setIsSearching(false);
    }
  }, []);
  
  const appPicsImages = Array(25).fill("/LogoVector.svg");

  return (
    <div className="w-full">
      <div
        className="min-h-screen relative w-full flex flex-col items-center justify-center"
      >

        <video
          className="absolute inset-0 w-full h-full object-cover z-0"
          autoPlay
          loop
          muted={true}
          playsInline
        >
          <source src="https://dvba8d38nfde7nic.public.blob.vercel-storage.com/hexx.mp4" type="video/mp4" />
        </video>
        
        {/* Black overlay */}
        <div className="absolute inset-0 w-full h-full bg-black/50 z-10 pointer-events-none" />

        {/* <div className="relative z-30 text-center">
          <div className="flex flex-col items-center mb-6">
            <div className="relative inline-block px-6 py-3 rounded-lg" style={{ backgroundColor: '#0C2340' }}>
              <span className="text-5xl md:text-7xl lg:text-8xl font-bold" style={{ color: '#FA4616' }}>
                PULSECHAIN
              </span>
              <div className="absolute inset-0 bg-white opacity-10 rounded-lg"></div>
            </div>
            <div className="bg-white z-10 rounded inline-block -mt-[15px] overflow-hidden relative" style={{ boxShadow: "0 -4px 8px 2px rgba(0, 0, 0, 0.8)" }}>
              <div className="text-4xl md:text-6xl lg:text-7xl font-bold text-black">
                AI
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-400">
            Made by <Link href="https://superstake.win" target="_blank" className="text-blue-400 hover:text-blue-300 transition-colors">SuperStake.Win</Link>
          </p>
        </div> */}
        {/* Search bar centered in hero */}
        <div className="absolute top-10 left-1/2 transform -translate-x-1/2 z-30 w-full flex justify-center">
          <div className="relative w-96 lg:w-[40rem] xl:w-[48rem]">
            <PlaceholdersAndVanishInput
              placeholders={placeholders}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                setShow(!!v.trim());
                
                // Clear previous timeout
                if (searchTimeoutRef.current) {
                  clearTimeout(searchTimeoutRef.current);
                }
                
                // Set new timeout for debounced search
                if (v.trim().length >= 2) {
                  setIsSearching(true);
                  searchTimeoutRef.current = setTimeout(() => {
                    performSearch(v);
                  }, 300); // 300ms debounce
                } else {
                  setResults([]);
                  setIsSearching(false);
                }
              }}
              onSubmit={handleSubmit}
            />
            {show && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-black/50 backdrop-blur-lg border border-white/50 rounded-lg shadow-2xl z-[9999] max-h-80 overflow-y-auto">
                <div className="relative z-10">
                  {isSearching && (
                    <div className="p-3 text-white text-md">Searching...</div>
                  )}
                  {!isSearching && results.map((item) => (
                    <div
                      key={item.address}
                      className="p-3 hover:bg-slate-700/50 transition-colors cursor-pointer rounded"
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${item.name || item.symbol || 'token'} info`}
                      onClick={() => router.push(`/ai-agent?address=${item.address}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          router.push(`/ai-agent?address=${item.address}`);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <img src={'/LogoVector.svg'} alt={`${item.name} logo`} className="w-8 h-8 rounded-full bg-slate-700" />
                        <div className="overflow-hidden flex-1">
                          <div className="font-semibold text-white truncate">{item.name} {item.symbol && `(${item.symbol})`}</div>
                          <div className="text-xs text-slate-400 capitalize">{item.type}</div>
                          <div className="text-xs text-slate-500 font-mono truncate">{item.address}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <StatefulButton onClick={(e) => { e.stopPropagation(); router.push(`/ai-agent?address=${item.address}`); }} className="min-w-0 w-auto px-2 py-0.5 text-xs bg-slate-700 hover:ring-slate-700 opacity-100" skipLoader={true}>Info</StatefulButton>
                        <StatefulButton onClick={(e) => { e.stopPropagation(); router.push(`/ai-agent?address=${item.address}`); }} className="min-w-0 w-auto px-2 py-0.5 text-xs bg-orange-600 hover:ring-orange-600 opacity-100" skipLoader={true}>Ask AI</StatefulButton>
                        <StatefulButton onClick={(e) => { e.stopPropagation(); router.push(`/admin-stats?address=${item.address}`); }} className="min-w-0 w-auto px-2 py-0.5 text-xs bg-purple-700 hover:ring-purple-700 opacity-100" skipLoader={true}>API</StatefulButton>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* <TopTokensList /> */}
      {/* <AIAgentsSection /> */}
      {/* <LoaderThreeSection /> */}
      
      {/* ElevenLabs Convai AI Help Agent */}
      {/* <elevenlabs-convai agent-id="C25KqdgQbXZXGwa1OJcC"></elevenlabs-convai>
      <script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async type="javascript"></script> */}
    </div>
  );
}
