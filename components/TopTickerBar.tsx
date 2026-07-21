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

// Chains the ticker can show. Keep this list the single source of truth so
// adding another EVM later is one entry, not a rewrite.
type TickerChain = 'pulsechain' | 'robinhood';
const TICKER_CHAINS: { key: TickerChain; name: string; logo: string }[] = [
  { key: 'pulsechain', name: 'PulseChain', logo: '/LogoVector.svg' },
  { key: 'robinhood', name: 'Robinhood', logo: '/robinhood-logo.svg' },
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

// GeckoTerminal-backed screener row → the ticker's TokenData shape. Used for
// every non-PulseChain chain (PulseChain keeps its curated gold-badge feed).
function rowToTokenData(r: any): TokenData {
  return {
    address: r.baseAddress,
    symbol: r.baseSymbol ?? '???',
    name: r.baseName ?? r.baseSymbol ?? 'Unknown',
    priceUsd: Number(r.priceUsd || 0),
    priceChange24h: Number(r.chg?.h24 ?? 0),
    priceChange6h: r.chg?.h6 != null ? Number(r.chg.h6) : undefined,
    priceChange1h: r.chg?.h1 != null ? Number(r.chg.h1) : undefined,
    volume24h: Number(r.vol?.h24 ?? 0),
    volume6h: r.vol?.h6 != null ? Number(r.vol.h6) : undefined,
    liquidity: Number(r.liquidityUsd ?? 0),
    marketCap: r.marketCap != null ? Number(r.marketCap) : undefined,
    txCount24h: r.txns?.h24 != null ? Number(r.txns.h24) : undefined,
    dexId: r.dexId ?? 'unknown',
  };
}

// Far-left chain picker that overlays the ticker. Logo-only on mobile, logo +
// name on desktop.
function ChainDropdown({ chain, onChange }: { chain: TickerChain; onChange: (c: TickerChain) => void }) {
  const [open, setOpen] = useState(false);
  const active = TICKER_CHAINS.find((c) => c.key === chain) ?? TICKER_CHAINS[0];
  return (
    <div className="relative h-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Chain: ${active.name}`}
        className="flex h-full items-center gap-1.5 border-r border-[var(--line)] bg-[var(--app-bg)] px-2.5 sm:px-3 text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={active.logo} alt="" className="h-5 w-5 shrink-0 rounded-full object-contain" />
        <span className="hidden sm:inline text-sm font-semibold whitespace-nowrap">{active.name}</span>
        <svg className={`h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <>
          {/* click-away layer */}
          <div className="fixed inset-0 z-[30]" onClick={() => setOpen(false)} />
          <ul
            role="listbox"
            className="absolute left-0 top-full z-[31] mt-0.5 w-44 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--app-bg)] shadow-2xl"
          >
            {TICKER_CHAINS.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.key === chain}
                  onClick={() => {
                    onChange(c.key);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface)] ${
                    c.key === chain ? 'text-[#FA4616]' : 'text-[var(--text)]'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.logo} alt="" className="h-5 w-5 shrink-0 rounded-full object-contain" />
                  <span className="font-medium">{c.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function TopTickerBar() {
  const [chain, setChain] = useState<TickerChain>('pulsechain');
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [priorityAddresses, setPriorityAddresses] = useState<string[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Order from API matches admin GOLD badge list (Save order in admin updates
  // this). PulseChain only — other chains use their top-by-volume universe.
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

  // Fetch the active chain's tokens. PulseChain uses the curated gold-badge
  // feed (/api/portfolio/ticker-pairs); every other chain uses the live
  // GeckoTerminal screener universe (/api/screener/live) mapped into the same
  // TokenData shape TickerCardWithPopover already consumes.
  const fetchTokens = useCallback(async () => {
    if (chain !== 'pulsechain') {
      try {
        const res = await fetch(`/api/screener/live?chain=${chain}&tab=top&window=h24`);
        if (!res.ok) return;
        const data = await res.json();
        const rows: any[] = Array.isArray(data?.rows) ? data.rows : [];
        const mapped = rows.filter((r) => r?.baseAddress).slice(0, 30).map(rowToTokenData);
        if (mapped.length > 0) {
          setTokens(mapped);
          setHasLoaded(true);
        }
      } catch (error) {
        console.error('❌ Failed to fetch ticker tokens:', error);
      }
      return;
    }

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
      if (fetched.length > 0) {
        setTokens(fetched);
        setHasLoaded(true);
      }
    } catch (error) {
      console.error('❌ Failed to fetch priority tokens:', error);
    }
  }, [chain, priorityAddresses]);

  // Clear the old chain's cards immediately on switch so we never show a
  // cross-chain mix while the new feed loads.
  useEffect(() => {
    setTokens([]);
  }, [chain]);

  // Initial load; the interval (visibility-aware) is owned by usePollingEffect.
  useEffect(() => { void fetchTokens(); }, [fetchTokens]);
  usePollingEffect(() => void fetchTokens(), 120000);

  const handlePause = () => setIsPaused(true);
  const handleResume = () => setIsPaused(false);

  // Keep the bar (and its chain dropdown) mounted once anything has loaded, so
  // switching chains doesn't make the whole bar vanish mid-fetch.
  if (!hasLoaded && tokens.length === 0) {
    return null;
  }

  // Duplicate tokens for seamless infinite scroll
  const duplicatedTokens = [...tokens, ...tokens, ...tokens];

  return (
    <div className="relative">
      <div className="h-12 flex items-center w-full overflow-hidden relative border-b-2 border-[#FA4616] bg-[var(--app-bg)]">
        <div
          ref={scrollerRef}
          className="flex gap-1 animate-scroll-ticker pl-24 sm:pl-40"
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
            chain={chain}
            onPause={handlePause}
            onResume={handleResume}
          />
        ))}
        </div>

        {/* Chain picker — pinned far-left, overlaying the ticker. */}
        <div className="absolute left-0 top-0 z-20 h-full">
          <ChainDropdown chain={chain} onChange={setChain} />
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
