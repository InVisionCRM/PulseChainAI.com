'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TickerCardWithPopover } from './TickerCardWithPopover';
import { usePollingEffect } from '@/hooks/usePollingEffect';

const GOLD_BADGES_FALLBACK = [
  '0xB7d4eB5fDfE3d4d3B5C16a44A49948c6EC77c6F1',
  '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e',
  '0xCA35638A3fdDD02fEC597D8c1681198C06b23F58',
  '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39',
  '0x8CDaf3d630Da9E1450832924D5701CC0500E9cfC',
  '0x95B303987A60C71504D99Aa1b13B4DA07b0790ab',
  '0xA1077a294dDE1B09bB078844df40758a5D0f9a27',
  '0x2fa878Ab3F87CC1C9737Fc071108F904c0B0C95d',
  '0xc10A4Ed9b4042222d69ff0B374eddd47ed90fC1F',
  '0x33779a40987F729a7DF6cc08B1dAD1a21b58A220',
];

interface TokenData {
  address: string;
  symbol: string;
  name: string;
  priceUsd: number;
  priceChange24h: number;
  priceChange6h?: number;
  priceChange1h?: number;
  volume24h: number;
  volume6h?: number;
  liquidity: number;
  fdv?: number;
  marketCap?: number;
  txCount24h?: number;
  buys24h?: number;
  sells24h?: number;
  dexId: string;
}

export function TopTickerBar() {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [priorityAddresses, setPriorityAddresses] = useState<string[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Order from API matches admin GOLD badge list (Save order in admin updates this)
  useEffect(() => {
    fetch('/api/gold-badges')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.addresses) && d.addresses.length > 0) {
          setPriorityAddresses(d.addresses);
        } else {
          setPriorityAddresses(GOLD_BADGES_FALLBACK);
        }
      })
      .catch(() => setPriorityAddresses(GOLD_BADGES_FALLBACK));
  }, []);

  // Single server-proxied call replaces the previous fan-out of browser
  // fetches to api.dexscreener.com. Direct browser calls were silently
  // hitting Cloudflare's HTML challenge (no real User-Agent) and
  // resolving to null for every token, which is why the ticker bar
  // had been rendering nothing. The server route filters to PulseChain
  // pairs that include WPLS and returns the exact same shape this
  // component (and TickerCardWithPopover) already consume.
  const fetchTokens = useCallback(async () => {
    const list = priorityAddresses.length > 0 ? priorityAddresses : GOLD_BADGES_FALLBACK;
    if (list.length === 0) return;
    try {
      const res = await fetch('/api/portfolio/ticker-pairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: list }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const fetched: TokenData[] = Array.isArray(data?.tokens) ? data.tokens : [];
      if (fetched.length > 0) setTokens(fetched);
    } catch (error) {
      console.error('❌ Failed to fetch priority tokens:', error);
    }
  }, [priorityAddresses]);

  // Initial load; the interval (visibility-aware) is owned by usePollingEffect.
  useEffect(() => { void fetchTokens(); }, [fetchTokens]);
  usePollingEffect(() => void fetchTokens(), 120000);

  const handlePause = () => {
    console.log('🔴 Pausing ticker animation');
    setIsPaused(true);
  };
  const handleResume = () => {
    console.log('🟢 Resuming ticker animation');
    setIsPaused(false);
  };

  if (tokens.length === 0) {
    return null;
  }

  // Duplicate tokens for seamless infinite scroll
  const duplicatedTokens = [...tokens, ...tokens, ...tokens];

  return (
    <div className="relative">
      <div className="h-12 flex items-center w-full overflow-hidden relative border-b-2 border-[#FA4616] bg-[var(--app-bg)]">
        <div
          ref={scrollerRef}
          className="flex gap-1 animate-scroll-ticker"
          style={{
            maskImage: 'linear-gradient(to right, transparent, white 10%, white 90%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, white 10%, white 90%, transparent)',
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
        >
        {duplicatedTokens.map((token, idx) => (
          <TickerCardWithPopover
            key={`${token.address}-${idx}`}
            token={token}
            onPause={handlePause}
            onResume={handleResume}
          />
        ))}
        </div>
      </div>
      {/* Shadow effect under the ticker bar */}
      <div className="absolute top-full left-0 right-0 h-4 pointer-events-none" style={{ 
        background: 'linear-gradient(to bottom, rgb(0, 0, 0), transparent)',
        zIndex: 10
      }} />
    </div>
  );
}

