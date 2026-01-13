'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TickerCardWithPopover } from './TickerCardWithPopover';

// Same priority tokens as TokenTable.tsx
const PRIORITY_TOKENS = [
  '0xB7d4eB5fDfE3d4d3B5C16a44A49948c6EC77c6F1', // #1 - GOLD badge
  '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e', // #2 - GOLD badge
  '0x31Ac295D593877bb77c3fCc19Fbbcea9c4f1c50A', // #3
  '0x33779a40987F729a7DF6cc08B1dAD1a21b58A220', // #4
  '0x9deeaF046e144Fb6304A5ACD2aF142bBfE958030', // #5
  '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39', // #6
  '0xA1077a294dDE1B09bB078844df40758a5D0f9a27', // #7
  '0x2fa878Ab3F87CC1C9737Fc071108F904c0B0C95d', // #8
  '0xc10A4Ed9b4042222d69ff0B374eddd47ed90fC1F', // #9
  '0xC70CF25DFCf5c5e9757002106C096ab72fab299E'  // #10
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
  const [isPaused, setIsPaused] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const fetchPriorityTokenData = async (contractAddress: string): Promise<TokenData | null> => {
    try {
      // #region agent log - hypothesis A: Check fetch attempt
      fetch('http://127.0.0.1:7243/ingest/bf246329-4dd5-4c2c-83a0-9a84d005ba26', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'TopTickerBar.tsx:47',
          message: 'Starting DexScreener fetch',
          data: { contractAddress, url: `https://api.dexscreener.com/latest/dex/search?q=${contractAddress}` },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'A'
        })
      }).catch(() => {});

      // Search for the token on DexScreener
      const searchResponse = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${contractAddress}`);

      // #region agent log - hypothesis A: Check response status
      fetch('http://127.0.0.1:7243/ingest/bf246329-4dd5-4c2c-83a0-9a84d005ba26', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'TopTickerBar.tsx:47',
          message: 'Fetch response received',
          data: { contractAddress, status: searchResponse.status, ok: searchResponse.ok, statusText: searchResponse.statusText },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'A'
        })
      }).catch(() => {});

      const searchData = await searchResponse.json();

      // Find PulseChain pairs that include WPLS
      const wplsPairs = searchData.pairs?.filter((pair: any) => {
        if (pair.chainId !== 'pulsechain') return false;

        const token0Address = pair.baseToken?.address?.toLowerCase();
        const token1Address = pair.quoteToken?.address?.toLowerCase();
        const wplsAddr = '0xA1077a294dDE1B09bB078844df40758a5D0f9a27'.toLowerCase();

        // Check if this pair includes WPLS and matches our target token
        const hasWPLS = token0Address === wplsAddr || token1Address === wplsAddr;
        if (!hasWPLS) return false;

        // Check if the other token matches our search
        const targetAddr = contractAddress.toLowerCase();
        return token0Address === targetAddr || token1Address === targetAddr;
      });

      if (!wplsPairs || wplsPairs.length === 0) {
        console.log(`⚠️ No WPLS pair found for ${contractAddress}`);
        return null;
      }

      // Use the first matching pair
      const pair = wplsPairs[0];

      // Determine which token is the target (not WPLS)
      const isBaseToken = pair.baseToken.address.toLowerCase() === contractAddress.toLowerCase();
      const targetToken = isBaseToken ? pair.baseToken : pair.quoteToken;
      const wplsToken = isBaseToken ? pair.quoteToken : pair.baseToken;

      const tokenData: TokenData = {
        address: targetToken.address,
        symbol: targetToken.symbol,
        name: targetToken.name,
        priceUsd: parseFloat(pair.priceUsd || '0'),
        priceChange24h: parseFloat(pair.priceChange?.h24 || '0'),
        volume24h: parseFloat(pair.volume?.h24 || '0'),
        liquidity: parseFloat(pair.liquidity?.usd || '0'),
        fdv: pair.fdv ? parseFloat(pair.fdv) : undefined,
        marketCap: pair.marketCap ? parseFloat(pair.marketCap) : undefined,
        txCount24h: pair.txns?.h24 ? parseInt(pair.txns.h24) : undefined,
        buys24h: pair.txns?.h24buys ? parseInt(pair.txns.h24buys) : undefined,
        sells24h: pair.txns?.h24sells ? parseInt(pair.txns.h24sells) : undefined,
        dexId: pair.dexId || 'unknown'
      };

      return tokenData;
    } catch (error) {
      // #region agent log - hypothesis A: Log fetch error details
      fetch('http://127.0.0.1:7243/ingest/bf246329-4dd5-4c2c-83a0-9a84d005ba26', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'TopTickerBar.tsx:128',
          message: 'Catch block error details',
          data: {
            contractAddress,
            error: error instanceof Error ? error.message : String(error),
            errorType: error instanceof Error ? error.constructor.name : 'Unknown',
            stack: error instanceof Error ? error.stack : undefined
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'A'
        })
      }).catch(() => {});

      console.error(`❌ Failed to fetch priority token ${contractAddress}:`, error);
      return null;
    }
  };

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        console.log('🎯 Fetching priority token WPLS pairs...');

        // #region agent log - hypothesis B: Check if individual fetches succeed
        const tokenPromises = PRIORITY_TOKENS.map(async (address) => {
          const result = await fetchPriorityTokenData(address);
          fetch('http://127.0.0.1:7243/ingest/bf246329-4dd5-4c2c-83a0-9a84d005ba26', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'TopTickerBar.tsx:139',
              message: 'Individual token fetch result',
              data: { address, result: result ? 'success' : 'null' },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'run1',
              hypothesisId: 'B'
            })
          }).catch(() => {});
          return result;
        });

        const fetchedTokens = (await Promise.all(tokenPromises)).filter(Boolean) as TokenData[];

        // #region agent log - hypothesis B: Check final results
        fetch('http://127.0.0.1:7243/ingest/bf246329-4dd5-4c2c-83a0-9a84d005ba26', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'TopTickerBar.tsx:139',
            message: 'Final fetch results',
            data: { totalTokens: fetchedTokens.length, addresses: fetchedTokens.map(t => t.address) },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'B'
          })
        }).catch(() => {});

        if (fetchedTokens.length > 0) {
          setTokens(fetchedTokens);
          console.log(`✅ Loaded ${fetchedTokens.length} priority tokens`);
        } else {
          console.log('⚠️ No priority tokens found');
        }
      } catch (error) {
        // #region agent log - hypothesis B: Check useEffect error
        fetch('http://127.0.0.1:7243/ingest/bf246329-4dd5-4c2c-83a0-9a84d005ba26', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'TopTickerBar.tsx:162',
            message: 'useEffect error',
            data: { error: error instanceof Error ? error.message : String(error) },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'B'
          })
        }).catch(() => {});

        console.error('❌ Failed to fetch priority tokens:', error);
      }
    };

    fetchTokens();
    // Refresh every 2 minutes
    const interval = setInterval(fetchTokens, 120000);
    return () => clearInterval(interval);
  }, []);

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
      <div className="h-12 flex items-center w-full overflow-hidden relative border-b-2 border-[#FA4616] bg-slate-950/20">
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

