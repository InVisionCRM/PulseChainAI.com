'use client';

import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { pulsechainApi } from '@/services';
import { fetchDexScreenerData, search } from '@/services/pulsechainService';
import { Button } from '@/components/ui/stateful-button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { ProgressiveBlur } from '@/components/ui/progressive-blur';

const MAX_SNIPPET_CHARS = 400;

export type NetworkEventLog = {
  id: string;
  url: string;
  method: string;
  status: 'pending' | 'success' | 'error';
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  statusCode?: number;
  requestBody?: string;
  responseSnippet?: string;
  error?: string;
};

type FetchLogEvent =
  | {
      type: 'start';
      fetchId: string;
      method: string;
      url: string;
      timestamp: number;
      requestBodySnippet?: string;
    }
  | {
      type: 'finish';
      fetchId: string;
      method: string;
      url: string;
      timestamp: number;
      statusCode?: number;
      ok: boolean;
      durationMs: number;
      responseSnippet?: string;
      error?: string;
    };

type FetchListener = (event: FetchLogEvent) => void;

declare global {
  interface Window {
    __codexFetchPatched?: boolean;
    __codexFetchListeners?: Set<FetchListener>;
  }
}

const ensureFetchLogger = (): void => {
  if (typeof window === 'undefined' || window.__codexFetchPatched) {
    return;
  }

  const listeners: Set<FetchListener> = new Set();
  window.__codexFetchListeners = listeners;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const [input, init] = args;
    const url = typeof input === 'string' ? input : input.url;
    const method =
      init?.method ||
      (typeof Request !== 'undefined' && input instanceof Request && input.method) ||
      'GET';
    const fetchId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    const requestBodySnippet =
      typeof init?.body === 'string'
        ? init.body.slice(0, MAX_SNIPPET_CHARS)
        : init?.body
        ? '[non-text body]'
        : undefined;
    const startTs = Date.now();

    listeners.forEach((listener) =>
      listener({
        type: 'start',
        fetchId,
        method,
        url,
        timestamp: startTs,
        requestBodySnippet,
      })
    );

    const perfStart = typeof performance !== 'undefined' ? performance.now() : Date.now();

    try {
      const response = await originalFetch(...args);
      let responseSnippet: string | undefined;
      try {
        responseSnippet = (await response.clone().text()).slice(0, MAX_SNIPPET_CHARS);
      } catch {
        responseSnippet = undefined;
      }

      listeners.forEach((listener) =>
        listener({
          type: 'finish',
          fetchId,
          method,
          url,
          timestamp: Date.now(),
          statusCode: response.status,
          ok: response.ok,
          durationMs:
            typeof performance !== 'undefined' ? performance.now() - perfStart : Date.now() - startTs,
          responseSnippet,
        })
      );

      return response;
    } catch (error) {
      listeners.forEach((listener) =>
        listener({
          type: 'finish',
          fetchId,
          method,
          url,
          timestamp: Date.now(),
          ok: false,
          durationMs:
            typeof performance !== 'undefined' ? performance.now() - perfStart : Date.now() - startTs,
          error: (error as Error).message,
        })
      );
      throw error;
    }
  };

  window.__codexFetchPatched = true;
};

const subscribeToFetchLogs = (listener: FetchListener): (() => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }
  ensureFetchLogger();
  window.__codexFetchListeners!.add(listener);
  return () => {
    window.__codexFetchListeners?.delete(listener);
  };
};

type TransferItem = {
  timestamp?: string;
  from?: { hash?: string };
  to?: { hash?: string };
  total?: { value?: string; decimals?: string };
  token?: { address?: string };
};

type HoldersPage = {
  items: Array<{ address: { hash: string }, value: string }>;
  next_page_params?: Record<string, string>;
};

const DEAD_ADDRESS = '0x000000000000000000000000000000000000dead';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const BURN_ADDRESSES = new Set([
  DEAD_ADDRESS,
  ZERO_ADDRESS,
  '0x0000000000000000000000000000000000000000',
  '0x0000000000000000000000000000000000000002',
  '0x0000000000000000000000000000000000000369',
  '0x0000000000000000000000000000000000000dEaD',
]);

const ROUTER_ADDRESSES = new Set([
  '0x165C3410fC91EF562C50559f7d2289fEbed552d9', // PulseX V2
  '0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02', // PulseX V1
  '0x9977e170c9b6e544302e8db0cf01d12d55555289', // Common pair/router
]);

const BRIDGE_ADDRESSES = new Set([
  '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Example bridge
  '0x1111111111111111111111111111111111111111', // Placeholder; extend with real bridge list
]);

const BLUE_CHIP_ADDRESSES = new Set([
  '0xa1077a294dde1b09bb078844df40758a5d0f9a27', // WPLS
  '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', // HEX
  '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07', // USDC
  '0xefd766ccb38eaf1dfd701853bfce31359239f305', // DAI
]);

interface AdminStatsPanelProps {
  initialAddress?: string;
  compact?: boolean;
  variant?: 'default' | 'hero';
  tokenSymbol?: string;
  onRequestChange?: (request: {
    statId: string;
    endpoint: string;
    apiCalls?: Array<{
      endpoint: string;
      method: string;
      description?: string;
    }>;
    events?: NetworkEventLog[];
  } | null) => void;
}

export default function AdminStatsPanel({
  initialAddress = '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e',
  compact = false,
  variant = 'default',
  tokenSymbol,
  onRequestChange,
}: AdminStatsPanelProps): JSX.Element {
  const [tokenAddress, setTokenAddress] = useState<string>(initialAddress);
  const [searchInput, setSearchInput] = useState<string>(initialAddress);

  // Update when initialAddress prop changes
  useEffect(() => {
    setTokenAddress(initialAddress);
    setSearchInput(initialAddress);
  }, [initialAddress]);

  const [searchResults, setSearchResults] = useState<unknown[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statResult, setStatResult] = useState<Record<string, unknown>>({});
  const [busyStat, setBusyStat] = useState<string | null>(null);
  const [networkEvents, setNetworkEvents] = useState<NetworkEventLog[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const requestSessionMapRef = useRef<Map<string, string>>(new Map());
  const networkListRef = useRef<HTMLDivElement | null>(null);
  const [currentRequest, setCurrentRequest] = useState<{
    statId: string;
    endpoint: string;
    params: Record<string, any>;
    response: any;
    timestamp: Date;
    duration: number;
    apiCalls?: Array<{
      endpoint: string;
      method: string;
      description: string;
    }>;
  } | null>(null);
  const [selectedStat, setSelectedStat] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [showAllEndpoints, setShowAllEndpoints] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [pulsechainDropdownOpen, setPulsechainDropdownOpen] = useState<boolean>(false);
  const pulsechainDropdownRef = useRef<HTMLDivElement>(null);

  // Close PulseChain dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pulsechainDropdownRef.current && !pulsechainDropdownRef.current.contains(event.target as Node)) {
        setPulsechainDropdownOpen(false);
      }
    };

    if (pulsechainDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [pulsechainDropdownOpen]);

  useEffect(() => {
    if (networkEvents.length === 0) return;
    if (networkListRef.current) {
      networkListRef.current.scrollTo({
        top: networkListRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [networkEvents]);

  const handleFetchEvent = useCallback((event: FetchLogEvent) => {
    if (event.type === 'start') {
      const activeSession = sessionIdRef.current;
      if (!activeSession) return;
      requestSessionMapRef.current.set(event.fetchId, activeSession);
      setNetworkEvents((prev) => [
        ...prev,
        {
          id: event.fetchId,
          method: event.method,
          url: event.url,
          status: 'pending',
          startedAt: new Date(event.timestamp).toISOString(),
          requestBody: event.requestBodySnippet,
        },
      ]);
    } else {
      if (!requestSessionMapRef.current.has(event.fetchId)) return;
      requestSessionMapRef.current.delete(event.fetchId);
      setNetworkEvents((prev) =>
        prev.map((entry) =>
          entry.id === event.fetchId
            ? {
                ...entry,
                status: event.ok ? 'success' : 'error',
                statusCode: event.statusCode,
                endedAt: new Date(event.timestamp).toISOString(),
                durationMs: event.durationMs,
                responseSnippet: event.responseSnippet ?? entry.responseSnippet,
                error: event.error,
              }
            : entry
        )
      );
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    return subscribeToFetchLogs(handleFetchEvent);
  }, [handleFetchEvent]);

  const startNetworkSession = useCallback(() => {
    const newSession =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    sessionIdRef.current = newSession;
    requestSessionMapRef.current.clear();
    setNetworkEvents([]);
  }, []);

  const stopNetworkSession = useCallback(() => {
    sessionIdRef.current = null;
    requestSessionMapRef.current.clear();
  }, []);

  useEffect(() => {
    if (!onRequestChange) return;
    if (!currentRequest) {
      onRequestChange(null);
      return;
    }
    onRequestChange({
      statId: currentRequest.statId,
      endpoint: currentRequest.endpoint,
      apiCalls: currentRequest.apiCalls,
      events: networkEvents,
    });
  }, [currentRequest, networkEvents, onRequestChange]);

  // simple in-memory caches to avoid refetching per-stat
  const [cache, setCache] = useState<{
    tokenInfo?: unknown;
    tokenCounters?: unknown;
    addressInfo?: unknown;
    addressCounters?: unknown;
    holders?: Array<{ hash: string; value: string }>;
    transfers24h?: TransferItem[];
    dex?: unknown;
  }>({});

  // Load a new token and reset dependent state
  const handleLoadNewToken = useCallback((addr: string) => {
    const next = addr.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(next)) return;
    setTokenAddress(next);
    setSearchInput(next);
    setSearchResults([]);
    setStatResult({});
    setBusyStat(null);
    setCurrentRequest(null);
    setNetworkEvents([]);
    requestSessionMapRef.current.clear();
    sessionIdRef.current = null;
    setSelectedStat('');
    setActiveCategory('');
    setCache({});
    setError(null);
    setShowAllEndpoints(false);
  }, []);

  // Debounced search effect
  useEffect(() => {
    const query = searchInput.trim();
    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(query);

    if (query.length < 2 || isAddress) {
      setSearchResults([]);
      return;
    }

    const handler = setTimeout(async () => {
      setIsSearching(true);
      const results = await search(query);
      setSearchResults(results);
      setIsSearching(false);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchInput]);

  const cutoff24hIso = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - 24);
    return d.toISOString();
  }, []);

  const fetchJson = async (url: string, options?: { method?: string }): Promise<unknown> => {
    const res = await fetch(url, { 
      method: options?.method || 'GET',
      headers: { Accept: 'application/json' } 
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  // formatting helpers
  const formatNumber2 = (value: number): string => {
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  };
  const formatPct2 = (value: number): string => `${Number(value).toFixed(2)}%`;
  const formatTokenAmount2 = (raw: number, decimals: number): string => {
    const v = decimals ? raw / Math.pow(10, decimals) : raw;
    return formatNumber2(v);
  };

  const getHoldersPaged = useCallback(async (address: string, maxPages = 50): Promise<Array<{ hash: string; value: string }>> => {
    const base = 'https://api.scan.pulsechain.com/api/v2';
    const limit = 50;
    const pageItems: Array<{ hash: string; value: string }> = [];
    let nextParams: Record<string, string> | undefined = undefined;

    for (let i = 0; i < maxPages; i += 1) {
      const qs = new URLSearchParams({ limit: String(limit) });
      if (nextParams) {
        Object.entries(nextParams).forEach(([k, v]) => qs.set(k, String(v)));
      }
      const url = `${base}/tokens/${address}/holders?${qs.toString()}`;
      const data: HoldersPage = await fetchJson(url) as HoldersPage;
      const items = Array.isArray(data?.items) ? data.items : [];
      for (const it of items) pageItems.push({ hash: it.address?.hash, value: it.value });

      if (!data?.next_page_params) break;
      nextParams = data.next_page_params as Record<string, string>;
    }
    return pageItems;
  }, []);

  const getTransfers24h = useCallback(async (address: string, maxPages = 50): Promise<TransferItem[]> => {
    const base = 'https://api.scan.pulsechain.com/api/v2';
    const limit = 200;
    const out: TransferItem[] = [];
    let nextParams: Record<string, string> | undefined = undefined;

    for (let i = 0; i < maxPages; i += 1) {
      const qs = new URLSearchParams({ limit: String(limit) });
      if (nextParams) {
        Object.entries(nextParams).forEach(([k, v]) => qs.set(k, String(v)));
      }
      const url = `${base}/tokens/${address}/transfers?${qs.toString()}`;
      const data = await fetchJson(url);
      const items: TransferItem[] = Array.isArray((data as any)?.items) ? (data as any).items : [];
      if (items.length === 0) break;

      for (const t of items) {
        const ts = t.timestamp ? new Date(t.timestamp) : null;
        if (!ts) continue;
        if (ts.toISOString() >= cutoff24hIso) {
          out.push(t);
        }
      }

      const lastTs = items[items.length - 1]?.timestamp;
      if (lastTs && new Date(lastTs).toISOString() < cutoff24hIso) break;

      if (!(data as any)?.next_page_params) break;
      nextParams = (data as any).next_page_params as Record<string, string>;
    }
    return out;
  }, [cutoff24hIso]);

  const getTransfersLastNDays = useCallback(async (address: string, days: number, maxPages = 200): Promise<TransferItem[]> => {
    const base = 'https://api.scan.pulsechain.com/api/v2';
    const limit = 200;
    const out: TransferItem[] = [];
    let nextParams: Record<string, string> | undefined = undefined;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffIso = cutoffDate.toISOString();

    for (let i = 0; i < maxPages; i += 1) {
      const qs = new URLSearchParams({ limit: String(limit) });
      if (nextParams) {
        Object.entries(nextParams).forEach(([k, v]) => qs.set(k, String(v)));
      }
      const url = `${base}/tokens/${address}/transfers?${qs.toString()}`;
      const data = await fetchJson(url);
      const items: TransferItem[] = Array.isArray((data as any)?.items) ? (data as any).items : [];
      if (items.length === 0) break;

      out.push(...items);

      const lastTs = items[items.length - 1]?.timestamp;
      if (lastTs && new Date(lastTs).toISOString() < cutoffIso) {
        break;
      }

      if (!(data as any)?.next_page_params) break;
      nextParams = (data as any).next_page_params as Record<string, string>;
    }

    return out.filter(t => t.timestamp && new Date(t.timestamp).toISOString() >= cutoffIso);
  }, []);

  const getTokenInfoByAddress = useCallback(async (address: string): Promise<any> => {
    const base = 'https://api.scan.pulsechain.com/api/v2';
    return fetchJson(`${base}/tokens/${address}`);
  }, [fetchJson]);

  const getWalletTokenTransfers = useCallback(async (address: string, maxPages = 200): Promise<TransferItem[]> => {
    const base = 'https://api.scan.pulsechain.com/api/v2';
    const limit = 200;
    const out: TransferItem[] = [];
    let nextParams: Record<string, string> | undefined = undefined;

    for (let i = 0; i < maxPages; i += 1) {
      const qs = new URLSearchParams({ limit: String(limit) });
      if (nextParams) {
        Object.entries(nextParams).forEach(([k, v]) => qs.set(k, String(v)));
      }
      const url = `${base}/addresses/${address}/token-transfers?${qs.toString()}`;
      const data = await fetchJson(url);
      const items: TransferItem[] = Array.isArray((data as any)?.items) ? (data as any).items : [];
      if (items.length === 0) break;

      out.push(...items);

      if (!(data as any)?.next_page_params) break;
      nextParams = (data as any).next_page_params as Record<string, string>;
    }
    return out;
  }, []);

  const ensureCoreCaches = useCallback(async () => {
    const [tokenInfoRes, tokenCountersRes, addressInfoRes, addressCountersRes] = await Promise.all([
      cache.tokenInfo ? Promise.resolve({ data: cache.tokenInfo }) : pulsechainApi.getTokenInfo(tokenAddress),
      cache.tokenCounters ? Promise.resolve({ data: cache.tokenCounters }) : pulsechainApi.getTokenCounters(tokenAddress),
      cache.addressInfo ? Promise.resolve({ data: cache.addressInfo }) : pulsechainApi.getAddressInfo(tokenAddress),
      cache.addressCounters ? Promise.resolve({ data: cache.addressCounters }) : pulsechainApi.getAddressCounters(tokenAddress),
    ]);
    setCache(prev => ({
      ...prev,
      tokenInfo: tokenInfoRes.data,
      tokenCounters: tokenCountersRes.data,
      addressInfo: addressInfoRes.data,
      addressCounters: addressCountersRes.data,
    }));
    return {
      tokenInfo: tokenInfoRes.data,
      tokenCounters: tokenCountersRes.data,
      addressInfo: addressInfoRes.data,
      addressCounters: addressCountersRes.data,
    };
  }, [cache.addressCounters, cache.addressInfo, cache.tokenCounters, cache.tokenInfo, tokenAddress]);

  const ensureHolders = useCallback(async () => {
    if (cache.holders) return cache.holders;
    const holders = await getHoldersPaged(tokenAddress, 200);
    setCache(prev => ({ ...prev, holders }));
    return holders;
  }, [cache.holders, getHoldersPaged, tokenAddress]);

  const ensureTransfers24h = useCallback(async () => {
    if (cache.transfers24h) return cache.transfers24h;
    const transfers = await getTransfers24h(tokenAddress, 100);
    setCache(prev => ({ ...prev, transfers24h: transfers }));
    return transfers;
  }, [cache.transfers24h, getTransfers24h, tokenAddress]);

  const ensureDex = useCallback(async () => {
    if (cache.dex) return cache.dex;
    const dexResult = await fetchDexScreenerData(tokenAddress);
    const dex = dexResult?.raw;
    setCache(prev => ({ ...prev, dex }));
    return dex;
  }, [cache.dex, tokenAddress]);

  const getMainPair = useCallback(async () => {
    const dex = await ensureDex();
    return (dex?.pairs || [])[0] || null;
  }, [ensureDex]);

  const calcSlippagePct = (reserveIn: number, reserveOut: number, tradeIn: number): number => {
    if (reserveIn <= 0 || reserveOut <= 0 || tradeIn <= 0) return 0;
    const k = reserveIn * reserveOut;
    const newReserveIn = reserveIn + tradeIn;
    const newReserveOut = k / newReserveIn;
    const outAmount = reserveOut - newReserveOut;
    const priceBefore = reserveOut / reserveIn;
    const priceAfter = newReserveOut / newReserveIn;
    const impact = ((priceAfter - priceBefore) / priceBefore) * 100;
    return isFinite(impact) ? impact : 0;
  };

  const computePearson = (x: number[], y: number[]): number | null => {
    if (x.length !== y.length || x.length < 2) return null;
    const n = x.length;
    const meanX = x.reduce((s, v) => s + v, 0) / n;
    const meanY = y.reduce((s, v) => s + v, 0) / n;
    let num = 0;
    let denomX = 0;
    let denomY = 0;
    for (let i = 0; i < n; i += 1) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      num += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }
    if (denomX === 0 || denomY === 0) return null;
    return num / Math.sqrt(denomX * denomY);
  };

  const derivePriceVolumePoints = useCallback(async () => {
    const pair = await getMainPair();
    if (!pair) return { prices: [], volumes: [] };
    // Approximate hourly series using h1/h6/h24 slices.
    const priceNow = Number(pair.priceUsd || 0);
    const vol24 = Number(pair.volume?.h24 || 0);
    const vol6 = Number(pair.volume?.h6 || 0);
    const vol1 = Number(pair.volume?.h1 || 0);
    const change24 = Number(pair.priceChange?.h24 || 0) / 100;
    const change6 = Number(pair.priceChange?.h6 || change24) / 100;
    const change1 = Number(pair.priceChange?.h1 || change6) / 100;

    const price24 = priceNow / (1 + change24 || 1);
    const price6 = priceNow / (1 + change6 || 1);
    const price1 = priceNow / (1 + change1 || 1);

    return {
      prices: [price24, price6, price1, priceNow].filter(v => Number.isFinite(v) && v > 0),
      volumes: [vol24, vol6, vol1].filter(v => Number.isFinite(v) && v > 0),
    };
  }, [getMainPair]);

  const computeLogReturns = (series: number[]): number[] => {
    const out: number[] = [];
    for (let i = 1; i < series.length; i += 1) {
      if (series[i - 1] > 0 && series[i] > 0) {
        out.push(Math.log(series[i] / series[i - 1]));
      }
    }
    return out;
  };

  const hoursSince = (iso?: string): number | null => {
    if (!iso) return null;
    const ts = new Date(iso).getTime();
    if (Number.isNaN(ts)) return null;
    const diff = Date.now() - ts;
    return diff / (1000 * 60 * 60);
  };

  const groupByDay = (ts: string | undefined): string | null => {
    if (!ts) return null;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  };

  const statCategories: Array<{ title: string; stats: Array<{ id: string; label: string; description: string; run: () => Promise<any> }> }> = useMemo(() => {
    return [
      {
        title: 'Token Supply',
        stats: [
          { id: 'totalSupply', label: 'Total Supply', description: 'Total number of tokens in circulation', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const raw = Number(tokenInfo?.total_supply ?? 0);
        const decimals = Number(tokenInfo?.decimals ?? 18);
        return {
          raw,
          formatted: formatTokenAmount2(raw, decimals),
          decimals
        };
      } },
          { id: 'holders', label: 'Total Holders', description: 'Number of unique wallet addresses holding this token', run: async () => {
        const count = Number((await ensureCoreCaches()).tokenCounters?.token_holders_count ?? (await ensureCoreCaches()).tokenInfo?.holders ?? 0);
        return {
          raw: count,
          formatted: formatNumber2(count)
        };
      } },
          { id: 'burnedTotal', label: 'Total Burned', description: 'Total tokens sent to burn address (dead wallet)', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const decimals = Number(tokenInfo?.decimals ?? 18);
        const holders = await ensureHolders();
        const dead = holders.find(h => h.hash.toLowerCase() === DEAD_ADDRESS)?.value || '0';
        const rawNum = Number(dead);
        const totalSupply = Number(tokenInfo?.total_supply ?? 0);
        const pct = totalSupply ? (rawNum / totalSupply) * 100 : 0;
        return {
          raw: rawNum,
          formatted: formatTokenAmount2(rawNum, decimals),
          percent: pct,
          percentFormatted: formatPct2(pct),
        };
      } },
      { id: 'burned24h', label: 'Burned (24h)', description: 'Tokens burned in the last 24 hours', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const totalSupply = Number(tokenInfo?.total_supply ?? 0);
        const sum = (await ensureTransfers24h())
          .filter(t => (t.to?.hash || '').toLowerCase() === DEAD_ADDRESS)
          .reduce((s, t) => s + Number(t.total?.value || 0), 0);
        const pct = totalSupply ? (sum / totalSupply) * 100 : 0;
        const decimals = Number(tokenInfo?.decimals ?? 18);
        return { raw: sum, formatted: formatTokenAmount2(sum, decimals), percent: pct, percentFormatted: formatPct2(pct) };
      } },
      { id: 'minted24h', label: 'Minted (24h)', description: 'New tokens created in the last 24 hours', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const decimals = Number(tokenInfo?.decimals ?? 18);
        const sum = (await ensureTransfers24h())
          .filter(t => (t.from?.hash || '').toLowerCase() === tokenAddress.toLowerCase())
          .reduce((s, t) => s + Number(t.total?.value || 0), 0);
        return {
          raw: sum,
          formatted: formatTokenAmount2(sum, decimals)
        };
      } },
      { id: 'circulatingExBurn', label: 'Circulating Supply (ex-burn)', description: 'Total supply minus balances held by burn addresses', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const decimals = Number(tokenInfo?.decimals ?? 18);
        const holders = await ensureHolders();
        const burnBalance = holders
          .filter(h => BURN_ADDRESSES.has(h.hash?.toLowerCase?.()))
          .reduce((s, h) => s + Number(h.value || 0), 0);
        const supply = Number(tokenInfo?.total_supply ?? 0);
        const circulating = supply - burnBalance;
        return {
          raw: circulating,
          formatted: formatTokenAmount2(circulating, decimals),
          burnFormatted: formatTokenAmount2(burnBalance, decimals),
        };
      } },
        ]
      },
      {
        title: 'Holder Distribution',
        stats: [
          { id: 'top1Pct', label: 'Top 1% Holdings', description: 'Percentage of supply held by top holder', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const total = Number(tokenInfo?.total_supply ?? 0);
        const holders = await ensureHolders();
        const sum = holders.sort((a,b)=>Number(b.value)-Number(a.value)).slice(0,1).reduce((s,x)=>s+Number(x.value),0);
        const pct = total ? (sum/total)*100 : 0;
        return {
          raw: pct,
          formatted: formatPct2(pct),
          sum,
          total
        };
      } },
      { id: 'top10Pct', label: 'Top 10 Holdings', description: 'Percentage of supply held by top 10 holders', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const total = Number(tokenInfo?.total_supply ?? 0);
        const holders = await ensureHolders();
        const sum = holders.sort((a,b)=>Number(b.value)-Number(a.value)).slice(0,10).reduce((s,x)=>s+Number(x.value),0);
        const pct = total ? (sum/total)*100 : 0;
        return {
          raw: pct,
          formatted: formatPct2(pct),
          sum,
          total
        };
      } },
      { id: 'top20Pct', label: 'Top 20 Holdings', description: 'Percentage of supply held by top 20 holders', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const total = Number(tokenInfo?.total_supply ?? 0);
        const holders = await ensureHolders();
        const sum = holders.sort((a,b)=>Number(b.value)-Number(a.value)).slice(0,20).reduce((s,x)=>s+Number(x.value),0);
        const pct = total ? (sum/total)*100 : 0;
        return {
          raw: pct,
          formatted: formatPct2(pct),
          sum,
          total
        };
      } },
      { id: 'top50Pct', label: 'Top 50 Holdings', description: 'Percentage of supply held by top 50 holders', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const total = Number(tokenInfo?.total_supply ?? 0);
        const holders = await ensureHolders();
        const sum = holders.sort((a,b)=>Number(b.value)-Number(a.value)).slice(0,50).reduce((s,x)=>s+Number(x.value),0);
        const pct = total ? (sum/total)*100 : 0;
        return {
          raw: pct,
          formatted: formatPct2(pct),
          sum,
          total
        };
      } },
      { id: 'whaleCount1Pct', label: 'Whale Count (>1%)', description: 'Number of wallets holding more than 1% of supply', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const total = Number(tokenInfo?.total_supply ?? 0);
        const threshold = total * 0.01;
        const holders = await ensureHolders();
        const count = holders.filter(h => Number(h.value) >= threshold).length;
        return {
          raw: count,
          formatted: formatNumber2(count),
          threshold: formatTokenAmount2(threshold, Number(tokenInfo?.decimals ?? 18))
        };
      } },
      { id: 'top50Holders', label: 'Top 50 Holders', description: 'Detailed list of top 50 token holders with balances', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const totalSupply = Number(tokenInfo?.total_supply ?? 0);
        const decimals = Number(tokenInfo?.decimals ?? 18);
        const holders = await ensureHolders();

        const sortedHolders = [...holders].sort((a, b) => Number(b.value) - Number(a.value));
        const top50 = sortedHolders.slice(0, 50);

        return top50.map((holder, index) => {
          const balance = Number(holder.value);
          const percentage = totalSupply > 0 ? (balance / totalSupply) * 100 : 0;
          return {
            rank: index + 1,
            address: holder.hash,
            balanceRaw: holder.value,
            balanceFormatted: formatTokenAmount2(balance, decimals),
            percentage: `${percentage.toFixed(4)}%`,
          };
        });
      }},
      { id: 'newVsLostHolders7d', label: 'New vs Lost Holders (7d)', description: 'Holder growth/decline over the last 7 days', run: async () => {
        const transfers = await getTransfersLastNDays(tokenAddress, 7);
        if (transfers.length === 0) {
          return { newHolders: 0, lostHolders: 0, netChange: 0 };
        }

        const involvedAddresses = new Set<string>();
        transfers.forEach(t => {
          if (t.from?.hash) involvedAddresses.add(t.from.hash.toLowerCase());
          if (t.to?.hash) involvedAddresses.add(t.to.hash.toLowerCase());
        });

        // This is a simplified approach. A full implementation would require fetching historical balances.
        // For this test, we will identify new holders as those who only received tokens and lost holders as those who only sent.

        const receivedOnly = new Set<string>();
        const sentOnly = new Set<string>();

        involvedAddresses.forEach(addr => {
          const sentTx = transfers.some(t => t.from?.hash?.toLowerCase() === addr);
          const receivedTx = transfers.some(t => t.to?.hash?.toLowerCase() === addr);

          if (receivedTx && !sentTx) {
            receivedOnly.add(addr);
          }
          if (sentTx && !receivedTx) {
            sentOnly.add(addr);
          }
        });

        return {
          newHolders: receivedOnly.size,
          lostHolders: sentOnly.size,
          netChange: receivedOnly.size - sentOnly.size,
        };
      }},
      { id: 'giniCoefficient', label: 'Gini Coefficient', description: 'Measures wealth inequality among holders (0=equal, 1=unequal)', run: async () => {
        const holders = await ensureHolders();
        if (holders.length < 2) return 0;

        const values = holders.map(h => Number(h.value)).sort((a, b) => a - b);
        const n = values.length;
        const sumOfDifferences = values.reduce((sum, value, index) => {
          return sum + (2 * (index + 1) - n - 1) * value;
        }, 0);
        const totalValue = values.reduce((sum, value) => sum + value, 0);

        if (totalValue === 0) return 0;

        return sumOfDifferences / (n * totalValue);
      }},
      { id: 'avgHolderBalance', label: 'Average Holder Balance', description: 'Average token balance per holder wallet', run: async () => {
        const { tokenInfo, tokenCounters } = await ensureCoreCaches();
        const holders = await ensureHolders();
        const dead = holders.find(h => h.hash.toLowerCase() === DEAD_ADDRESS)?.value || '0';
        const circulatingSupply = Number(tokenInfo.total_supply) - Number(dead);
        const holderCount = Number(tokenCounters?.token_holders_count ?? 0);

        if (holderCount === 0) return 0;

        const avgBalance = circulatingSupply / holderCount;
        return formatTokenAmount2(avgBalance, Number(tokenInfo.decimals));
      }},
      { id: 'medianHolderBalance', label: 'Median Holder Balance (Top 200)', description: 'Median balance among the top 200 holders', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const decimals = Number(tokenInfo?.decimals ?? 18);
        const holders = await ensureHolders();
        const top = holders.sort((a, b) => Number(b.value) - Number(a.value)).slice(0, 200);
        const values = top.map(h => Number(h.value)).sort((a, b) => a - b);
        const mid = values.length ? values[Math.floor(values.length / 2)] : 0;
        return {
          raw: mid,
          formatted: formatTokenAmount2(mid, decimals),
          sampleSize: values.length,
        };
      }},
      { id: 'holderTierCounts', label: 'Holder Tier Counts', description: 'Addresses holding ≥1%, ≥0.1%, and ≥0.01% of supply', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const total = Number(tokenInfo?.total_supply ?? 0);
        if (!total) return { onePct: 0, pointOnePct: 0, pointZeroOnePct: 0 };
        const thresholds = {
          onePct: total * 0.01,
          pointOnePct: total * 0.001,
          pointZeroOnePct: total * 0.0001,
        };
        const holders = await ensureHolders();
        const counts = {
          onePct: holders.filter(h => Number(h.value) >= thresholds.onePct).length,
          pointOnePct: holders.filter(h => Number(h.value) >= thresholds.pointOnePct).length,
          pointZeroOnePct: holders.filter(h => Number(h.value) >= thresholds.pointZeroOnePct).length,
        };
        return counts;
      }},
      { id: 'smartContractHolderShare', label: 'Smart-Contract Holder Share', description: 'Percent of top 20 holders that are smart contracts', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const decimals = Number(tokenInfo?.decimals ?? 18);
        const holders = await ensureHolders();
        const top20 = holders.sort((a, b) => Number(b.value) - Number(a.value)).slice(0, 20);
        const results = await Promise.allSettled(
          top20.map(h => pulsechainApi.getAddressInfo(h.hash).catch(() => null))
        );
        let contractCount = 0;
        let contractBalance = 0;
        results.forEach((res, idx) => {
          if (res.status === 'fulfilled' && res.value?.data?.is_contract) {
            contractCount += 1;
            contractBalance += Number(top20[idx].value || 0);
          }
        });
        const total = Number(tokenInfo?.total_supply ?? 0);
        const pct = total ? (contractBalance / total) * 100 : 0;
        return {
          contracts: contractCount,
          percentSupply: formatPct2(pct),
          balanceFormatted: formatTokenAmount2(contractBalance, decimals),
        };
      }},
      { id: 'routerHolderShare', label: 'Router/DEX Holder Share', description: 'Percent of supply held by known router or pair addresses', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const total = Number(tokenInfo?.total_supply ?? 0);
        const holders = await ensureHolders();
        const dex = await ensureDex();
        const pairAddresses = new Set((dex?.pairs || []).map((p: any) => p?.pairAddress?.toLowerCase?.()).filter(Boolean));
        let sum = 0;
        holders.forEach(h => {
          const addr = h.hash?.toLowerCase?.();
          if (addr && (ROUTER_ADDRESSES.has(addr) || pairAddresses.has(addr))) {
            sum += Number(h.value || 0);
          }
        });
        const pct = total ? (sum / total) * 100 : 0;
        const decimals = Number(tokenInfo?.decimals ?? 18);
        return {
          percent: formatPct2(pct),
          balanceFormatted: formatTokenAmount2(sum, decimals),
        };
      }},
      { id: 'bridgeExposure', label: 'Bridge Exposure', description: 'Supply percentage held by official bridge addresses', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const total = Number(tokenInfo?.total_supply ?? 0);
        const holders = await ensureHolders();
        const bridgeBalance = holders
          .filter(h => BRIDGE_ADDRESSES.has(h.hash?.toLowerCase?.()))
          .reduce((s, h) => s + Number(h.value || 0), 0);
        const pct = total ? (bridgeBalance / total) * 100 : 0;
        const decimals = Number(tokenInfo?.decimals ?? 18);
        return {
          percent: formatPct2(pct),
          balanceFormatted: formatTokenAmount2(bridgeBalance, decimals),
        };
      }},
      { id: 'holderChurn7d', label: 'Holder Churn (7d)', description: 'New + lost holders as a share of current holders', run: async () => {
        const transfers = await getTransfersLastNDays(tokenAddress, 7);
        const holders = await ensureHolders();
        const currentHolderSet = new Set(holders.map(h => h.hash?.toLowerCase?.()));
        const received = new Set<string>();
        const sent = new Set<string>();
        transfers.forEach(t => {
          if (t.to?.hash) received.add(t.to.hash.toLowerCase());
          if (t.from?.hash) sent.add(t.from.hash.toLowerCase());
        });
        const newHolders = Array.from(received).filter(addr => !currentHolderSet.has(addr)).length;
        const lostHolders = Array.from(sent).filter(addr => !received.has(addr)).length;
        const denom = currentHolderSet.size || 1;
        return {
          churnRate: formatPct2(((newHolders + lostHolders) / denom) * 100),
          newHolders,
          lostHolders,
          current: currentHolderSet.size,
        };
      }},
      { id: 'dormantSupply30d', label: 'Dormant Supply (30d)', description: 'Balance held by wallets absent from transfers in the last 30 days', run: async () => {
        const transfers = await getTransfersLastNDays(tokenAddress, 30);
        const active = new Set<string>();
        transfers.forEach(t => {
          if (t.from?.hash) active.add(t.from.hash.toLowerCase());
          if (t.to?.hash) active.add(t.to.hash.toLowerCase());
        });
        const { tokenInfo } = await ensureCoreCaches();
        const decimals = Number(tokenInfo?.decimals ?? 18);
        const holders = await ensureHolders();
        const dormant = holders.filter(h => !active.has(h.hash?.toLowerCase?.()));
        const dormantSum = dormant.reduce((s, h) => s + Number(h.value || 0), 0);
        const total = Number(tokenInfo?.total_supply ?? 0);
        const pct = total ? (dormantSum / total) * 100 : 0;
        return {
          percent: formatPct2(pct),
          balanceFormatted: formatTokenAmount2(dormantSum, decimals),
        };
      }},
      { id: 'stickyHolders90d', label: 'Sticky Holders 90d', description: 'Percent of top 100 holders who never sold in the last 90 days', run: async () => {
        const transfers = await getTransfersLastNDays(tokenAddress, 90);
        const senders = new Set(transfers.map(t => t.from?.hash?.toLowerCase?.()).filter(Boolean) as string[]);
        const holders = await ensureHolders();
        const top100 = holders.sort((a, b) => Number(b.value) - Number(a.value)).slice(0, 100);
        const { tokenInfo } = await ensureCoreCaches();
        const decimals = Number(tokenInfo?.decimals ?? 18);
        const safeBalances = top100
          .filter(h => !senders.has(h.hash?.toLowerCase?.()))
          .reduce((s, h) => s + Number(h.value || 0), 0);
        const total = Number(tokenInfo?.total_supply ?? 0);
        const pct = total ? (safeBalances / total) * 100 : 0;
        return {
          percent: formatPct2(pct),
          balanceFormatted: formatTokenAmount2(safeBalances, decimals),
          top100Safe: top100.filter(h => !senders.has(h.hash?.toLowerCase?.())).length,
        };
      }},
      { id: 'newVsLostHolders1d', label: 'New vs Lost Holders (1d)', description: 'Holder growth/decline in the last 24 hours', run: async () => {
        const transfers = await getTransfersLastNDays(tokenAddress, 1);
        if (transfers.length === 0) return { newHolders: 0, lostHolders: 0, netChange: 0 };
        const involvedAddresses = new Set<string>();
        transfers.forEach(t => {
          if (t.from?.hash) involvedAddresses.add(t.from.hash.toLowerCase());
          if (t.to?.hash) involvedAddresses.add(t.to.hash.toLowerCase());
        });
        const receivedOnly = new Set<string>();
        const sentOnly = new Set<string>();
        involvedAddresses.forEach(addr => {
          const sentTx = transfers.some(t => t.from?.hash?.toLowerCase() === addr);
          const receivedTx = transfers.some(t => t.to?.hash?.toLowerCase() === addr);
          if (receivedTx && !sentTx) receivedOnly.add(addr);
          if (sentTx && !receivedTx) sentOnly.add(addr);
        });
        return { newHolders: receivedOnly.size, lostHolders: sentOnly.size, netChange: receivedOnly.size - sentOnly.size };
      }},
      { id: 'newVsLostHolders30d', label: 'New vs Lost Holders (30d)', description: 'Holder growth/decline over the last 30 days', run: async () => {
        const transfers = await getTransfersLastNDays(tokenAddress, 30);
        if (transfers.length === 0) return { newHolders: 0, lostHolders: 0, netChange: 0 };
        const involvedAddresses = new Set<string>();
        transfers.forEach(t => {
          if (t.from?.hash) involvedAddresses.add(t.from.hash.toLowerCase());
          if (t.to?.hash) involvedAddresses.add(t.to.hash.toLowerCase());
        });
        const receivedOnly = new Set<string>();
        const sentOnly = new Set<string>();
        involvedAddresses.forEach(addr => {
          const sentTx = transfers.some(t => t.from?.hash?.toLowerCase() === addr);
          const receivedTx = transfers.some(t => t.to?.hash?.toLowerCase() === addr);
          if (receivedTx && !sentTx) receivedOnly.add(addr);
          if (sentTx && !receivedTx) sentOnly.add(addr);
        });
        return { newHolders: receivedOnly.size, lostHolders: sentOnly.size, netChange: receivedOnly.size - sentOnly.size };
      }},
      { id: 'newVsLostHolders90d', label: 'New vs Lost Holders (90d)', description: 'Holder growth/decline over the last 90 days', run: async () => {
        const transfers = await getTransfersLastNDays(tokenAddress, 90);
        if (transfers.length === 0) return { newHolders: 0, lostHolders: 0, netChange: 0 };
        const involvedAddresses = new Set<string>();
        transfers.forEach(t => {
          if (t.from?.hash) involvedAddresses.add(t.from.hash.toLowerCase());
          if (t.to?.hash) involvedAddresses.add(t.to.hash.toLowerCase());
        });
        const receivedOnly = new Set<string>();
        const sentOnly = new Set<string>();
        involvedAddresses.forEach(addr => {
          const sentTx = transfers.some(t => t.from?.hash?.toLowerCase() === addr);
          const receivedTx = transfers.some(t => t.to?.hash?.toLowerCase() === addr);
          if (receivedTx && !sentTx) receivedOnly.add(addr);
          if (sentTx && !receivedTx) sentOnly.add(addr);
        });
        return { newHolders: receivedOnly.size, lostHolders: sentOnly.size, netChange: receivedOnly.size - sentOnly.size };
      }},
        ]
      },
      {
        title: 'Market & Liquidity',
        stats: [
          { id: 'blueChipPairRatio', label: 'Blue Chip Pair Ratio', description: 'Percentage of liquidity paired with major tokens (WPLS, HEX, USDC, DAI)', run: async () => {
        const BLUE_CHIP_ADDRESSES = new Set([
          '0xa1077a294dde1b09bb078844df40758a5d0f9a27', // WPLS
          '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', // HEX
          '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07', // USDC
          '0xefd766ccb38eaf1dfd701853bfce31359239f305', // DAI
        ]);
        const dex = await ensureDex();
        const pairs = dex?.pairs || [];
        if (pairs.length === 0) return { ratio: 0, totalLiquidity: 0, blueChipLiquidity: 0 };

        let totalLiquidity = 0;
        let blueChipLiquidity = 0;

        for (const pair of pairs) {
          const liquidityUsd = Number(pair.liquidity?.usd || 0);
          totalLiquidity += liquidityUsd;
          if (BLUE_CHIP_ADDRESSES.has(pair.quoteToken.address.toLowerCase())) {
            blueChipLiquidity += liquidityUsd;
          }
        }

        const ratio = totalLiquidity > 0 ? (blueChipLiquidity / totalLiquidity) * 100 : 0;
        return {
          ratio: formatPct2(ratio),
          totalLiquidity: formatNumber2(totalLiquidity),
          blueChipLiquidity: formatNumber2(blueChipLiquidity),
        };
      }},
      { id: 'diamondHandsScore', label: 'Diamond Hands Score', description: 'Percentage of holders who haven\'t sold in 90/180 days', run: async () => {
        const transfers180d = await getTransfersLastNDays(tokenAddress, 180);
        const activeWallets180d = new Set(transfers180d.map(t => t.from?.hash?.toLowerCase()));

        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const transfers90d = transfers180d.filter(t => new Date(t.timestamp!) > ninetyDaysAgo);
        const activeWallets90d = new Set(transfers90d.map(t => t.from?.hash?.toLowerCase()));

        const allHolders = await ensureHolders();
        const { tokenInfo } = await ensureCoreCaches();
        const totalSupply = Number(tokenInfo?.total_supply ?? 0);

        let unmoved90d = 0;
        let unmoved180d = 0;

        for (const holder of allHolders) {
          const addr = holder.hash.toLowerCase();
          if (!activeWallets90d.has(addr)) {
            unmoved90d += Number(holder.value);
          }
          if (!activeWallets180d.has(addr)) {
            unmoved180d += Number(holder.value);
          }
        }

        const score90d = totalSupply > 0 ? (unmoved90d / totalSupply) * 100 : 0;
        const score180d = totalSupply > 0 ? (unmoved180d / totalSupply) * 100 : 0;

        return {
          score90d: formatPct2(score90d),
          score180d: formatPct2(score180d),
        };
      }},
      { id: 'topHolderBalanceChange7d', label: 'Top 10 Holder Change (7d)', description: 'Balance changes of top 10 holders over 7 days', run: async () => {
        const allHolders = await ensureHolders();
        const top10Addresses = allHolders.sort((a,b) => Number(b.value) - Number(a.value)).slice(0, 10).map(h => h.hash.toLowerCase());
        const transfers = await getTransfersLastNDays(tokenAddress, 7);
        
        const changes: Record<string, number> = {};
        top10Addresses.forEach(addr => { changes[addr] = 0; });

        for (const t of transfers) {
          const from = t.from?.hash?.toLowerCase();
          const to = t.to?.hash?.toLowerCase();
          const value = Number(t.total?.value || 0);

          if (from && top10Addresses.includes(from)) {
            changes[from] -= value;
          }
          if (to && top10Addresses.includes(to)) {
            changes[to] += value;
          }
        }
        const { tokenInfo } = await ensureCoreCaches();
        const decimals = Number(tokenInfo?.decimals ?? 18);

        return Object.entries(changes).map(([address, netChange]) => ({
          address,
          netChangeFormatted: formatTokenAmount2(netChange, decimals),
          netChangeRaw: netChange,
        }));
      }},
      { id: 'avgBuySellSize24h', label: 'Avg Buy/Sell Size (24h)', description: 'Average USD size of buys and sells over the last 24h based on Dex volume/txn mix', run: async () => {
        const dex = await ensureDex();
        const pairs = dex?.pairs || [];
        if (pairs.length === 0) return { avgBuy: 0, avgSell: 0 };

        const totalVolume = pairs.reduce((sum: number, p) => sum + Number(p.volume?.h24 || 0), 0);
        const totalBuys = pairs.reduce((sum: number, p) => sum + Number(p.txns?.h24?.buys || 0), 0);
        const totalSells = pairs.reduce((sum: number, p) => sum + Number(p.txns?.h24?.sells || 0), 0);

        // Cannot determine buy/sell volume, so we approximate by ratio
        const totalTrades = totalBuys + totalSells;
        if (totalTrades === 0) return { avgBuy: 0, avgSell: 0 };

        const buyRatio = totalBuys / totalTrades;
        const sellRatio = totalSells / totalTrades;

        const avgBuy = totalBuys > 0 ? (totalVolume * buyRatio) / totalBuys : 0;
        const avgSell = totalSells > 0 ? (totalVolume * sellRatio) / totalSells : 0;

        return {
          avgBuyUSD: formatNumber2(avgBuy),
          avgSellUSD: formatNumber2(avgSell),
        };
      }},
      { id: 'contractAgeInDays', label: 'Contract Age (Days)', description: 'Days since the contract creation transaction was mined', run: async () => {
        const { addressInfo } = await ensureCoreCaches();
        const txHash = addressInfo?.creation_tx_hash;
        if (!txHash) return 'N/A';

        const txDetails = await fetchJson(`https://api.scan.pulsechain.com/api/v2/transactions/${txHash}`);
        const timestamp = txDetails?.timestamp;
        if (!timestamp) return 'Not found';

        const creationDate = new Date(timestamp);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - creationDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
      }},
      { id: 'liquidityConcentration', label: 'Liquidity Concentration', description: 'Share of total liquidity held by the largest pool versus all pools combined', run: async () => {
        const dex = await ensureDex();
        const pairs = dex?.pairs || [];
        if (pairs.length < 2) return { concentration: '100%', topPoolLiquidity: 'N/A', totalLiquidity: 'N/A' };

        const sortedPairs = [...pairs].sort((a, b) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0));
        const totalLiquidity = sortedPairs.reduce((sum, p) => sum + Number(p.liquidity?.usd || 0), 0);
        const topPoolLiquidity = Number(sortedPairs[0].liquidity?.usd || 0);

        const concentration = totalLiquidity > 0 ? (topPoolLiquidity / totalLiquidity) * 100 : 0;

        return {
          concentration: formatPct2(concentration),
          topPoolLiquidity: formatNumber2(topPoolLiquidity),
          totalLiquidity: formatNumber2(totalLiquidity),
        };
      }},
      { id: 'dexDiversityScore', label: 'DEX Diversity Score', description: 'How widely liquidity is distributed across different DEXes for this token', run: async () => {
        const dex = await ensureDex();
        const pairs = dex?.pairs || [];
        const dexIds = new Set(pairs.map(p => p.dexId));
        return {
          score: dexIds.size,
          dexs: Array.from(dexIds),
        };
      }},
      { id: 'holderToLiquidityRatio', label: 'Holder-to-Liquidity Ratio', description: 'Compares holder count to total liquidity to gauge depth per wallet', run: async () => {
        const { tokenCounters } = await ensureCoreCaches();
        const holders = Number(tokenCounters?.token_holders_count ?? 0);

        const dex = await ensureDex();
        const pairs = dex?.pairs || [];
        const totalLiquidity = pairs.reduce((sum, p) => sum + Number(p.liquidity?.usd || 0), 0);

        const ratio = totalLiquidity > 0 ? holders / totalLiquidity : Infinity;

        return {
          ratio: ratio === Infinity ? 'Infinity' : formatNumber2(ratio),
          holders,
          totalLiquidityUSD: formatNumber2(totalLiquidity),
        };
      }},
      { id: 'definitiveTotalLiquidity', label: 'Definitive Total Liquidity', description: 'Consolidated USD and token liquidity across all known pools', run: async () => {
        // Step 1: Fetch logs from PulseChain Scan API to find all pair creation events.
        const logs = await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddress}/logs`);
        const pairAddresses = (logs?.items || []).map((log: unknown) => (log as { address?: { hash: string } })?.address?.hash).filter(Boolean);

        if (pairAddresses.length === 0) {
          return { totalLiquidity: 0, pairCount: 0, failedPairs: 0 };
        }

        // Step 2: Fetch stats for each pair from DexScreener
        const pairPromises = pairAddresses.map((pairAddr: string) => 
          fetchJson(`https://api.dexscreener.com/latest/dex/pairs/${pairAddr}`)
        );

        const results = await Promise.allSettled(pairPromises);

        let totalLiquidity = 0;
        let failedPairs = 0;
        results.forEach(result => {
          if (result.status === 'fulfilled' && result.value.pairs) {
            totalLiquidity += Number(result.value.pairs[0]?.liquidity?.usd || 0);
          } else {
            failedPairs++;
          }
        });

        return {
          totalLiquidity: formatNumber2(totalLiquidity),
          pairCount: pairAddresses.length,
          successfulPairs: pairAddresses.length - failedPairs,
          failedPairs,
        };
      }},
      { id: 'liquidityDepth', label: 'Liquidity Depth & Slippage', description: 'Estimates slippage for preset trade sizes using pool reserves', run: async () => {
        const dex = await ensureDex();
        const pairs = dex?.pairs || [];

        if (pairs.length === 0) return { error: 'No liquidity pools found.' };

        const calculateSlippage = (reservesA: number, reservesB: number, tradeSizeUSD: number, priceA: number) => {
          if (priceA === 0) return Infinity;
          const tradeSizeA = tradeSizeUSD / priceA;
          const k = reservesA * reservesB;
          if (k === 0) return Infinity;
          const newReservesA = reservesA + tradeSizeA;
          const newReservesB = k / newReservesA;
          const amountOutB = reservesB - newReservesB;
          const newPriceB = (newReservesA / newReservesB) * priceA;
          const oldPriceB = (reservesA / reservesB) * priceA;
          const slippage = ((newPriceB - oldPriceB) / oldPriceB) * 100;
          return slippage;
        };

        const dexGroups = pairs.reduce((acc: Record<string, unknown>, pair: unknown) => {
          const dexId = pair.dexId;
          if (!acc[dexId]) {
            acc[dexId] = { totalLiquidity: 0, pairs: [] };
          }
          acc[dexId].totalLiquidity += Number(pair.liquidity?.usd || 0);
          acc[dexId].pairs.push(pair);
          return acc;
        }, {});

        const sortedDexes = Object.entries(dexGroups).sort(([, a], [, b]) => (b as { totalLiquidity: number }).totalLiquidity - (a as { totalLiquidity: number }).totalLiquidity);

        return sortedDexes.map(([dexId, dexData]) => {
          const virtualReserves = (dexData as { pairs: unknown[] }).pairs.reduce((acc: { base: number; quote: number }, p: unknown) => {
            acc.base += Number(p.liquidity?.base || 0);
            acc.quote += Number(p.liquidity?.quote || 0);
            return acc;
          }, { base: 0, quote: 0 });

          const price = dexData.pairs[0] ? Number(dexData.pairs[0].priceUsd) : 0;

          return {
            dex: dexId,
            totalLiquidity: formatNumber2(dexData.totalLiquidity),
            pairCount: dexData.pairs.length,
            slippage_50: formatPct2(calculateSlippage(virtualReserves.base, virtualReserves.quote, 50, price)),
            slippage_500: formatPct2(calculateSlippage(virtualReserves.base, virtualReserves.quote, 500, price)),
            slippage_1k: formatPct2(calculateSlippage(virtualReserves.base, virtualReserves.quote, 1000, price)),
            slippage_10k: formatPct2(calculateSlippage(virtualReserves.base, virtualReserves.quote, 10000, price)),
            slippage_50k: formatPct2(calculateSlippage(virtualReserves.base, virtualReserves.quote, 50000, price)),
          };
        });
      }},
      { id: 'lp_holder_analysis', label: 'LP Holder Analysis', description: 'Lists the largest LP token holders with their supply share and mint details', run: async () => {
        const BURN_ADDRESSES = new Set([
          DEAD_ADDRESS,
          '0x0000000000000000000000000000000000000000',
          '0x0000000000000000000000000000000000000369',
        ]);

        const dex = await ensureDex();
        const pairs = (dex?.pairs || []).sort((a:any, b:any) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0)).slice(0, 5);
        const { addressInfo } = await ensureCoreCaches();
        const creatorAddress = addressInfo?.creator_address_hash?.toLowerCase();

        if (pairs.length === 0) return { error: 'No liquidity pools found.' };

        const analysisPromises = pairs.map(async (pair: unknown) => {
          const lpAddress = pair.pairAddress;
          const lpTotalSupply = Number(pair.liquidity.base) + Number(pair.liquidity.quote); // A simplification
          const holders = await getHoldersPaged(lpAddress);

          if (holders.length === 0) {
            return `${pair.baseToken.symbol}/${pair.quoteToken.symbol}: No holder data available.`;
          }

          const topHolderAddress = holders[0].hash.toLowerCase();
          const isBurned = BURN_ADDRESSES.has(topHolderAddress);

          const burned = holders.find(h => BURN_ADDRESSES.has(h.hash.toLowerCase()));
          const creatorOwned = holders.find(h => h.hash.toLowerCase() === creatorAddress);

          const burnedPct = lpTotalSupply > 0 ? (Number(burned?.value || 0) / lpTotalSupply) * 100 : 0;
          const creatorPct = lpTotalSupply > 0 ? (Number(creatorOwned?.value || 0) / lpTotalSupply) * 100 : 0;

          return `${isBurned ? '🔥 ' : ''}${pair.baseToken.symbol}/${pair.quoteToken.symbol} | Liq: ${formatNumber2(pair.liquidity.usd)} | Burned: ${formatPct2(burnedPct)} | Creator: ${formatPct2(creatorPct)}`;
        });

        return Promise.all(analysisPromises);
      }},
      { id: 'crossDexPriceSpread', label: 'Cross-DEX Price Spread', description: 'Difference between best and worst price across all pairs', run: async () => {
        const dex = await ensureDex();
        const prices = (dex?.pairs || []).map((p: any) => Number(p?.priceUsd || 0)).filter(v => v > 0);
        if (prices.length < 2) return { spreadPct: '0%', best: null, worst: null };
        const best = Math.max(...prices);
        const worst = Math.min(...prices);
        const spread = ((best - worst) / worst) * 100;
        return { spreadPct: formatPct2(spread), best, worst };
      }},
      { id: 'stablecoinLiquidityShare', label: 'Stablecoin Liquidity Share', description: 'Liquidity paired with USDC/DAI as a percent of total', run: async () => {
        const dex = await ensureDex();
        const pairs = dex?.pairs || [];
        const stableAddrs = new Set([
          '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07',
          '0xefd766ccb38eaf1dfd701853bfce31359239f305',
        ]);
        const total = pairs.reduce((s: number, p: any) => s + Number(p?.liquidity?.usd || 0), 0);
        const stable = pairs
          .filter((p: any) => stableAddrs.has(p?.quoteToken?.address?.toLowerCase?.()))
          .reduce((s: number, p: any) => s + Number(p?.liquidity?.usd || 0), 0);
        const pct = total ? (stable / total) * 100 : 0;
        return { percent: formatPct2(pct), total: formatNumber2(total), stable: formatNumber2(stable) };
      }},
      { id: 'intradayVolumeSkew', label: 'Intra-day Volume Skew', description: 'volume.h6 divided by volume.h24 for the main pair', run: async () => {
        const pair = await getMainPair();
        const h6 = Number(pair?.volume?.h6 || 0);
        const h24 = Number(pair?.volume?.h24 || 0);
        const skew = h24 ? h6 / h24 : 0;
        return { skew: formatNumber2(skew), h6, h24 };
      }},
      { id: 'avgTradeSize5m', label: 'Avg Trade Size (5m)', description: 'Average trade size in the last 5 minutes on the main pair', run: async () => {
        const pair = await getMainPair();
        const volume = Number(pair?.volume?.m5 || 0);
        const buys = Number(pair?.txns?.m5?.buys || 0);
        const sells = Number(pair?.txns?.m5?.sells || 0);
        const trades = buys + sells;
        const avg = trades ? volume / trades : 0;
        return { avgUSD: formatNumber2(avg), trades };
      }},
      { id: 'perDexSlippage500', label: 'Per-DEX Slippage @ $500', description: 'Estimated slippage for a $500 buy across each DEX grouping', run: async () => {
        const dex = await ensureDex();
        const pairs = dex?.pairs || [];
        const groups = pairs.reduce((acc: Record<string, any>, p: any) => {
          const id = p.dexId;
          if (!acc[id]) acc[id] = { base: 0, quote: 0, samplePrice: Number(p.priceUsd || 0) };
          acc[id].base += Number(p.liquidity?.base || 0);
          acc[id].quote += Number(p.liquidity?.quote || 0);
          if (!acc[id].samplePrice) acc[id].samplePrice = Number(p.priceUsd || 0);
          return acc;
        }, {});
        return Object.entries(groups).map(([dexId, data]) => {
          const price = data.samplePrice || 0;
          const tradeIn = price ? 500 / price : 0;
          const slippage = calcSlippagePct(data.base, data.quote, tradeIn);
          return { dex: dexId, slippage: formatPct2(slippage) };
        });
      }},
      { id: 'priceImpactLadderPerPool', label: 'Price Impact Ladder per Pool', description: 'Slippage estimates at $1k/$5k/$10k per pool', run: async () => {
        const dex = await ensureDex();
        const pairs = dex?.pairs || [];
        const trades = [1000, 5000, 10000];
        return pairs.map((p: any) => {
          const price = Number(p?.priceUsd || 0);
          const baseRes = Number(p?.liquidity?.base || 0);
          const quoteRes = Number(p?.liquidity?.quote || 0);
          const ladder = trades.map(size => {
            const tradeIn = price ? size / price : 0;
            const slip = calcSlippagePct(baseRes, quoteRes, tradeIn);
            return { size, slippage: formatPct2(slip) };
          });
          return { pair: `${p.baseToken?.symbol}/${p.quoteToken?.symbol}`, pairAddress: p.pairAddress, ladder };
        });
      }},
      { id: 'largestHolderExitStress', label: 'Largest-Holder Exit Stress Test', description: 'Estimated price impact if top holder sells 50% into main pool', run: async () => {
        const holders = await ensureHolders();
        const { tokenInfo } = await ensureCoreCaches();
        const decimals = Number(tokenInfo?.decimals ?? 18);
        const top = holders.sort((a, b) => Number(b.value) - Number(a.value))[0];
        const pair = await getMainPair();
        if (!top || !pair) return { error: 'Missing data' };
        const baseRes = Number(pair?.liquidity?.base || 0);
        const quoteRes = Number(pair?.liquidity?.quote || 0);
        const holderTokens = Number(top.value || 0) / Math.pow(10, decimals);
        const tradeIn = holderTokens * 0.5;
        const slippage = calcSlippagePct(baseRes, quoteRes, tradeIn);
        return { holder: top.hash, tradeTokens: tradeIn, slippage: formatPct2(slippage) };
      }},
      { id: 'lpTop3Concentration', label: 'LP Top3 Concentration', description: 'Percent of LP token supply owned by the top 3 holders of the main pool', run: async () => {
        const pair = await getMainPair();
        if (!pair) return { error: 'No main pool' };
        const lpAddress = pair.pairAddress;
        const lpInfo = await getTokenInfoByAddress(lpAddress);
        const totalSupply = Number(lpInfo?.total_supply || 0);
        const decimals = Number(lpInfo?.decimals ?? 18);
        const holders = await getHoldersPaged(lpAddress, 10);
        const top3 = holders.sort((a, b) => Number(b.value) - Number(a.value)).slice(0, 3);
        const sum = top3.reduce((s, h) => s + Number(h.value || 0), 0);
        const pct = totalSupply ? (sum / totalSupply) * 100 : 0;
        return { percent: formatPct2(pct), balanceFormatted: formatTokenAmount2(sum, decimals) };
      }},
      { id: 'lpLockDurationHint', label: 'LP Lock Duration Hint', description: 'Hours since last LP transfer to a burn address', run: async () => {
        const pair = await getMainPair();
        if (!pair) return { error: 'No main pool' };
        const lpAddress = pair.pairAddress;
        const transfers = await getTransfersLastNDays(lpAddress, 365, 20);
        const burnTransfer = transfers.find(t => BURN_ADDRESSES.has(t.to?.hash?.toLowerCase?.() || ''));
        const hrs = burnTransfer?.timestamp ? hoursSince(burnTransfer.timestamp) : null;
        return { hoursSinceBurn: hrs ? Number(hrs.toFixed(1)) : null };
      }},
      { id: 'lpUnlockRiskScore', label: 'LP Unlock Risk Score', description: 'Heuristic risk score based on LP concentration and recent non-burn movements', run: async () => {
        const pair = await getMainPair();
        if (!pair) return { error: 'No main pool' };
        const lpAddress = pair.pairAddress;
        const lpInfo = await getTokenInfoByAddress(lpAddress);
        const totalSupply = Number(lpInfo?.total_supply || 0);
        const holders = await getHoldersPaged(lpAddress, 20);
        const topHolder = holders.sort((a, b) => Number(b.value) - Number(a.value))[0];
        const topPct = totalSupply ? (Number(topHolder?.value || 0) / totalSupply) * 100 : 0;
        const transfers = await getTransfersLastNDays(lpAddress, 30, 30);
        const recentNonBurn = transfers.some(t => {
          const to = t.to?.hash?.toLowerCase?.();
          return to && !BURN_ADDRESSES.has(to);
        });
        const score = Math.min(100, topPct + (recentNonBurn ? 30 : 0));
        return { score: Math.round(score), topHolderPct: formatPct2(topPct), recentNonBurn };
      }},
      { id: 'liquidityMigrationTracker', label: 'Liquidity Migration Tracker', description: 'Timeline of pair creations/removals using token logs and Dex data', run: async () => {
        const logs = await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddress}/logs`);
        const items: any[] = Array.isArray((logs as any)?.items) ? (logs as any).items : [];
        const dex = await ensureDex();
        const pairsByAddr = new Map<string, any>();
        (dex?.pairs || []).forEach((p: any) => pairsByAddr.set(p.pairAddress?.toLowerCase?.(), p));
        return items.slice(0, 50).map((log: any) => {
          const addr = log?.address?.hash?.toLowerCase?.();
          const pair = addr ? pairsByAddr.get(addr) : null;
          return {
            address: addr,
            timestamp: log.timestamp,
            event: log.event_name || 'log',
            liquidityUsd: pair ? pair.liquidity?.usd : null,
          };
        });
      }},
      { id: 'priceVolumeCorrelation7d', label: 'Price/Volume Correlation 7d', description: 'Pearson r using coarse hourly buckets over ~24h/6h/1h slices', run: async () => {
        const points = await derivePriceVolumePoints();
        const prices = points.prices;
        const vols = points.volumes.slice(-prices.length);
        const r = computePearson(prices.slice(0, vols.length), vols);
        return { r };
      }},
      { id: 'realizedVolatility24h', label: 'Realized Volatility 24h', description: 'Sqrt variance of log returns based on derived price points', run: async () => {
        const { prices } = await derivePriceVolumePoints();
        const logs = computeLogReturns(prices);
        if (!logs.length) return { vol: 0 };
        const mean = logs.reduce((s, v) => s + v, 0) / logs.length;
        const variance = logs.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / logs.length;
        const vol = Math.sqrt(variance);
        return { vol: Number(vol.toFixed(4)) };
      }},
        ]
      },
      {
        title: 'Initial Distribution & Creator Analysis',
        stats: [
          { id: 'creatorInitialSupply', label: "Creator's Initial Supply", run: async () => {
            const { addressInfo, tokenInfo } = await ensureCoreCaches();
            const txHash = addressInfo?.creation_tx_hash;
            if (!txHash) return { error: 'No creation hash found' };

            const tx = await fetchJson(`https://api.scan.pulsechain.com/api/v2/transactions/${txHash}`);
            const creator = tx?.from?.hash;
            const token = tokenInfo?.address;
            const mintTransfer = tx?.token_transfers?.find((t: unknown) => (t as { from: { hash: string }; to: { hash: string }; token: { address: string } }).from.hash === '0x0000000000000000000000000000000000000000' && (t as { from: { hash: string }; to: { hash: string }; token: { address: string } }).to.hash === creator && (t as { from: { hash: string }; to: { hash: string }; token: { address: string } }).token.address === token);

            if (!mintTransfer) return { error: 'No initial mint transfer found to creator.' };

            const initialSupply = Number(mintTransfer.total.value);
            const totalSupply = Number(tokenInfo?.total_supply);
            const percentage = totalSupply > 0 ? (initialSupply / totalSupply) * 100 : 0;

            return {
              creator,
              initialSupply: formatTokenAmount2(initialSupply, Number(tokenInfo.decimals)),
              percentageOfTotal: formatPct2(percentage),
            };
          }},
          { id: 'creatorFirst5Outbound', label: "Creator's First 5 Outbound Txs", run: async () => {
            const { addressInfo } = await ensureCoreCaches();
            const creatorAddress = addressInfo?.creator_address_hash;
            if (!creatorAddress) return { error: 'No creator address found' };

            const txs = await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${creatorAddress}/transactions`);
            const outboundTxs = (txs?.items || []).filter((tx: unknown) => (tx as { from: { hash: string } }).from.hash.toLowerCase() === creatorAddress.toLowerCase());
            
            return outboundTxs.slice(0, 5).map((tx: unknown) => ({
              hash: tx.hash,
              to: tx.to?.hash,
              value: formatTokenAmount2(Number(tx.value), 18) + ' PLS',
              method: tx.method,
            }));
          }},
          { id: 'creatorCurrentBalance', label: "Creator's Current Balance", run: async () => {
            const { addressInfo, tokenInfo } = await ensureCoreCaches();
            const creatorAddress = addressInfo?.creator_address_hash;
            if (!creatorAddress) return { error: 'No creator address found' };

            const balanceData = await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${creatorAddress}/token-balances?token=${tokenAddress}`);
            const tokenBalance = (balanceData || []).find((b: unknown) => (b as { token: { address: string } }).token.address.toLowerCase() === tokenAddress.toLowerCase());

            return {
              balance: tokenBalance ? formatTokenAmount2(Number(tokenBalance.value), Number(tokenInfo.decimals)) : '0',
            };
          }},
          { id: 'creatorNetflow30d', label: 'Creator Netflow (30d)', description: 'Inbound vs outbound token totals for creator over 30 days', run: async () => {
            const { addressInfo, tokenInfo } = await ensureCoreCaches();
            const creatorAddress = addressInfo?.creator_address_hash;
            if (!creatorAddress) return { error: 'No creator address found' };
            const transfers = await getWalletTokenTransfers(creatorAddress, 100);
            const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
            let inbound = 0;
            let outbound = 0;
            transfers.forEach(t => {
              const ts = t.timestamp ? new Date(t.timestamp).getTime() : 0;
              if (!ts || ts < cutoff) return;
              const val = Number(t.total?.value || 0);
              if (t.to?.hash?.toLowerCase?.() === creatorAddress.toLowerCase()) inbound += val;
              if (t.from?.hash?.toLowerCase?.() === creatorAddress.toLowerCase()) outbound += val;
            });
            const decimals = Number(tokenInfo?.decimals ?? 18);
            return {
              inbound: formatTokenAmount2(inbound, decimals),
              outbound: formatTokenAmount2(outbound, decimals),
              net: formatTokenAmount2(inbound - outbound, decimals),
            };
          }},
          { id: 'teamClusterShare', label: 'Team Cluster Share', description: 'Supply held by creator + first 5 outbound recipients', run: async () => {
            const { addressInfo, tokenInfo } = await ensureCoreCaches();
            const creatorAddress = addressInfo?.creator_address_hash;
            if (!creatorAddress) return { error: 'No creator address found' };
            const txs = await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${creatorAddress}/transactions`);
            const outbound = (txs?.items || []).filter((tx: any) => tx?.from?.hash?.toLowerCase?.() === creatorAddress.toLowerCase());
            const firstRecipients = Array.from(new Set(outbound.map((tx: any) => tx.to?.hash?.toLowerCase?.()).filter(Boolean))).slice(0, 5);
            const holders = await ensureHolders();
            const teamSet = new Set([creatorAddress.toLowerCase(), ...firstRecipients]);
            const teamBalance = holders.filter(h => teamSet.has(h.hash?.toLowerCase?.())).reduce((s, h) => s + Number(h.value || 0), 0);
            const total = Number(tokenInfo?.total_supply ?? 0);
            const pct = total ? (teamBalance / total) * 100 : 0;
            const decimals = Number(tokenInfo?.decimals ?? 18);
            return {
              percent: formatPct2(pct),
              balanceFormatted: formatTokenAmount2(teamBalance, decimals),
              members: Array.from(teamSet),
            };
          }},
          { id: 'ownershipStatus', label: 'Ownership Status', description: 'Summarizes whether ownership is renounced plus owner metadata', run: async () => {
            const { addressInfo } = await ensureCoreCaches();
            const creatorAddress = addressInfo?.creator_address_hash;
            if (!creatorAddress) return { error: 'No creator address found' };

            const txs = await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${creatorAddress}/transactions`);
            const renouncedTx = (txs?.items || []).find((tx: unknown) => (tx as { method?: string }).method?.toLowerCase() === 'renounceownership');

            if (renouncedTx) {
              return { status: 'Renounced', transaction: renouncedTx.hash };
            }
            return { status: 'Not Renounced' };
          }},
          { id: 'ownershipTransferHistoryCount', label: 'Ownership Transfer History Count', description: 'Number of ownership transfer style calls on the contract', run: async () => {
            const txs = await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${tokenAddress}/transactions`);
            const count = (txs?.items || []).filter((tx: any) => (tx.method || '').toLowerCase().includes('ownership')).length;
            return count;
          }},
          { id: 'creatorTokenHistory', label: "Creator's Full Token History", run: async () => {
            const { addressInfo, tokenInfo } = await ensureCoreCaches();
            const creatorAddress = addressInfo?.creator_address_hash;
            if (!creatorAddress) return { error: 'No creator address found' };

            const allCreatorTransfers = await getWalletTokenTransfers(creatorAddress);
            const relevantTransfers = allCreatorTransfers.filter(t => t.token?.address?.toLowerCase() === tokenAddress.toLowerCase());

            return relevantTransfers.map(t => ({
              timestamp: t.timestamp,
              direction: t.from.hash.toLowerCase() === creatorAddress.toLowerCase() ? 'OUT' : 'IN',
              counterparty: t.from.hash.toLowerCase() === creatorAddress.toLowerCase() ? t.to.hash : t.from.hash,
              value: formatTokenAmount2(Number(t.total.value), Number(tokenInfo.decimals)),
            }));
          }},
          { id: 'creatorCrossTokenFootprint', label: 'Creator Cross-Token Footprint', description: 'Number of other tokens the creator has deployed or interacted with', run: async () => {
            const { addressInfo } = await ensureCoreCaches();
            const creatorAddress = addressInfo?.creator_address_hash;
            if (!creatorAddress) return { error: 'No creator address found' };
            const txs = await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${creatorAddress}/transactions`);
            const items: any[] = Array.isArray(txs?.items) ? txs.items : [];
            const touchedTokens = new Set<string>();
            let creations = 0;
            items.forEach(tx => {
              if ((tx.method || '').toLowerCase().includes('create')) creations += 1;
              (tx.token_transfers || []).forEach((tr: any) => {
                const addr = tr.token?.address?.toLowerCase?.();
                if (addr && addr !== tokenAddress.toLowerCase()) touchedTokens.add(addr);
              });
            });
            return { otherTokens: touchedTokens.size, creations };
          }},
        ]
      },
      {
        title: 'Cross-Token & Time Series',
        stats: [
          { id: 'crossTokenHolderOverlap', label: 'Cross-Token Holder Overlap', description: 'Overlap counts with HEX, WPLS, and DAI top holders', run: async () => {
            const tokens = [
              { id: 'HEX', address: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39' },
              { id: 'WPLS', address: '0xA1077a294dDE1B09bB078844df40758a5D0f9a27' },
              { id: 'DAI', address: '0xefD766cCb38EaF1dfd701853BFCe31359239F305' },
            ];
            const targetHolders = new Set((await ensureHolders()).map(h => h.hash?.toLowerCase?.()));
            const overlaps: Record<string, number> = {};
            for (const t of tokens) {
              const list = await getHoldersPaged(t.address, 5);
              const count = list.filter(h => targetHolders.has(h.hash?.toLowerCase?.())).length;
              overlaps[t.id] = count;
            }
            return overlaps;
          }},
          { id: 'holderRetentionCohorts', label: 'Holder Retention Cohorts (30/60/90d)', description: 'Addresses still holding after first receiving within each window', run: async () => {
            const transfers = await getTransfersLastNDays(tokenAddress, 90);
            const holders = await ensureHolders();
            const current = new Set(holders.map(h => h.hash?.toLowerCase?.()));
            const firstReceive: Record<string, number> = {};
            transfers.forEach(t => {
              const to = t.to?.hash?.toLowerCase?.();
              const ts = t.timestamp ? new Date(t.timestamp).getTime() : null;
              if (!to || !ts) return;
              if (!(to in firstReceive)) firstReceive[to] = ts;
            });
            const now = Date.now();
            const cohorts = { d30: 0, d60: 0, d90: 0 };
            Object.entries(firstReceive).forEach(([addr, ts]) => {
              if (!current.has(addr)) return;
              const ageDays = (now - ts) / (1000 * 60 * 60 * 24);
              if (ageDays <= 30) cohorts.d30 += 1;
              if (ageDays <= 60) cohorts.d60 += 1;
              if (ageDays <= 90) cohorts.d90 += 1;
            });
            return cohorts;
          }},
          { id: 'dailyHolderDelta30d', label: 'Daily Holder Delta (30d)', description: 'Per-day new vs lost holder counts', run: async () => {
            const transfers = await getTransfersLastNDays(tokenAddress, 30);
            const byDay: Record<string, { new: Set<string>; lost: Set<string> }> = {};
            const lastSend: Record<string, string> = {};
            const firstReceive: Record<string, string> = {};
            transfers.forEach(t => {
              const day = groupByDay(t.timestamp);
              if (!day) return;
              if (!byDay[day]) byDay[day] = { new: new Set(), lost: new Set() };
              const to = t.to?.hash?.toLowerCase?.();
              const from = t.from?.hash?.toLowerCase?.();
              if (to && !firstReceive[to]) firstReceive[to] = day;
              if (from) lastSend[from] = day;
            });
            Object.entries(firstReceive).forEach(([addr, day]) => {
              byDay[day]?.new.add(addr);
            });
            Object.entries(lastSend).forEach(([addr, day]) => {
              byDay[day]?.lost.add(addr);
            });
            return Object.entries(byDay)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([day, data]) => ({ day, new: data.new.size, lost: data.lost.size, net: data.new.size - data.lost.size }));
          }},
          { id: 'dailyBurnMintSeries30d', label: 'Daily Burn/Mint Series (30d)', description: 'Per-day totals sent to burn address or minted from zero', run: async () => {
            const transfers = await getTransfersLastNDays(tokenAddress, 30);
            const { tokenInfo } = await ensureCoreCaches();
            const decimals = Number(tokenInfo?.decimals ?? 18);
            const series: Record<string, { burned: number; minted: number }> = {};
            transfers.forEach(t => {
              const day = groupByDay(t.timestamp);
              if (!day) return;
              if (!series[day]) series[day] = { burned: 0, minted: 0 };
              const val = Number(t.total?.value || 0);
              const to = t.to?.hash?.toLowerCase?.();
              const from = t.from?.hash?.toLowerCase?.();
              if (to && BURN_ADDRESSES.has(to)) series[day].burned += val;
              if (from && from === ZERO_ADDRESS.toLowerCase()) series[day].minted += val;
            });
            return Object.entries(series)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([day, data]) => ({
                day,
                burned: formatTokenAmount2(data.burned, decimals),
                minted: formatTokenAmount2(data.minted, decimals),
              }));
          }},
        ]
      },
      {
        title: 'On-Chain Activity',
        stats: [
          { id: 'transfersTotal', label: 'Total Transfers', description: 'Cumulative number of token transfers recorded on-chain', run: async () => {
        const count = Number((await ensureCoreCaches()).tokenCounters?.transfers_count ?? 0);
        return {
          raw: count,
          formatted: formatNumber2(count)
        };
      } },
      { id: 'transfers24h', label: 'transfers24h', description: 'Number of token transfers observed in the last 24 hours', run: async () => {
        const count = (await ensureTransfers24h()).length;
        return {
          raw: count,
          formatted: formatNumber2(count)
        };
      } },
      { id: 'uniqueSenders24h', label: 'uniqueSenders24h', description: 'Distinct addresses that sent tokens in the last 24 hours', run: async () => {
        const count = new Set((await ensureTransfers24h()).map(t => (t.from?.hash || '').toLowerCase())).size;
        return {
          raw: count,
          formatted: formatNumber2(count)
        };
      } },
      { id: 'uniqueReceivers24h', label: 'uniqueReceivers24h', description: 'Distinct addresses that received tokens in the last 24 hours', run: async () => {
        const count = new Set((await ensureTransfers24h()).map(t => (t.to?.hash || '').toLowerCase())).size;
        return {
          raw: count,
          formatted: formatNumber2(count)
        };
      } },
      { id: 'avgTransferValue24h', label: 'avgTransferValue24h', description: 'Average transfer amount (raw token units) over the last 24 hours', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const decimals = Number(tokenInfo?.decimals ?? 18);
        const vals = (await ensureTransfers24h()).map(t => Number(t.total?.value || 0));
        const avg = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
        return {
          raw: avg,
          formatted: formatTokenAmount2(avg, decimals)
        };
      } },
      { id: 'medianTransferValue24h', label: 'medianTransferValue24h', description: 'Median transfer amount over the last 24 hours', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const decimals = Number(tokenInfo?.decimals ?? 18);
        const vals = (await ensureTransfers24h()).map(t => Number(t.total?.value || 0)).sort((a,b)=>a-b);
        const median = vals.length ? vals[Math.floor(vals.length/2)] : 0;
        return {
          raw: median,
          formatted: formatTokenAmount2(median, decimals)
        };
      } },
      { id: 'activeWallets24h', label: 'Active Wallets 24h', description: 'Unique senders and receivers in the last 24 hours', run: async () => {
        const transfers = await ensureTransfers24h();
        const active = new Set<string>();
        transfers.forEach(t => {
          if (t.from?.hash) active.add(t.from.hash.toLowerCase());
          if (t.to?.hash) active.add(t.to.hash.toLowerCase());
        });
        return { count: active.size };
      }},
      { id: 'transferVolume24hTokens', label: 'Transfer Volume 24h (tokens)', description: 'Total token units moved in last 24h', run: async () => {
        const transfers = await ensureTransfers24h();
        const { tokenInfo } = await ensureCoreCaches();
        const decimals = Number(tokenInfo?.decimals ?? 18);
        const total = transfers.reduce((s, t) => s + Number(t.total?.value || 0), 0);
        return { raw: total, formatted: formatTokenAmount2(total, decimals) };
      }},
      { id: 'transferVolume24hUsd', label: 'Transfer Volume 24h (USD)', description: 'Token transfer volume converted using current price', run: async () => {
        const transfers = await ensureTransfers24h();
        const pair = await getMainPair();
        const price = Number(pair?.priceUsd || 0);
        const { tokenInfo } = await ensureCoreCaches();
        const decimals = Number(tokenInfo?.decimals ?? pair?.baseToken?.decimals ?? 18);
        const totalRaw = transfers.reduce((s, t) => s + Number(t.total?.value || 0), 0);
        const usd = price ? (totalRaw / Math.pow(10, decimals)) * price : 0;
        return { usd: formatNumber2(usd) };
      }},
      { id: 'whaleNetflow24h', label: 'Whale Netflow 24h', description: 'Net token change for current top 10 holders over 24h', run: async () => {
        const holders = await ensureHolders();
        const top10 = holders.sort((a, b) => Number(b.value) - Number(a.value)).slice(0, 10).map(h => h.hash.toLowerCase());
        const transfers = await ensureTransfers24h();
        const changes: Record<string, number> = {};
        top10.forEach(addr => { changes[addr] = 0; });
        transfers.forEach(t => {
          const from = t.from?.hash?.toLowerCase();
          const to = t.to?.hash?.toLowerCase();
          const val = Number(t.total?.value || 0);
          if (from && top10.includes(from)) changes[from] -= val;
          if (to && top10.includes(to)) changes[to] += val;
        });
        return changes;
      }},
      { id: 'meanTimeToSell', label: 'Mean Time-to-Sell (30d)', description: 'Average hours between first receive and first send per wallet in last 30 days', run: async () => {
        const transfers = await getTransfersLastNDays(tokenAddress, 30, 50);
        const firstIn: Record<string, number> = {};
        const firstOut: Record<string, number> = {};
        transfers.forEach(t => {
          const ts = t.timestamp ? new Date(t.timestamp).getTime() : null;
          if (!ts) return;
          const to = t.to?.hash?.toLowerCase?.();
          const from = t.from?.hash?.toLowerCase?.();
          if (to && !(to in firstIn)) firstIn[to] = ts;
          if (from && !(from in firstOut)) firstOut[from] = ts;
        });
        const diffs: number[] = [];
        Object.keys(firstOut).forEach(addr => {
          if (firstIn[addr]) {
            const diffMs = firstOut[addr] - firstIn[addr];
            if (diffMs > 0) diffs.push(diffMs / (1000 * 60 * 60));
          }
        });
        const avg = diffs.length ? diffs.reduce((s, v) => s + v, 0) / diffs.length : 0;
        return { hours: Number(avg.toFixed(2)), sample: diffs.length };
      }},
      { id: 'washTradingHeuristic', label: 'Wash-Trading Heuristic', description: '% of 24h volume from quick ping-pong transfers between the same pair of addresses', run: async () => {
        const transfers = await ensureTransfers24h();
        transfers.sort((a, b) => new Date(a.timestamp || '').getTime() - new Date(b.timestamp || '').getTime());
        const { tokenInfo } = await ensureCoreCaches();
        const decimals = Number(tokenInfo?.decimals ?? 18);
        let pingPongVolume = 0;
        let totalVolume = 0;
        const lastByPair = new Map<string, { ts: number; dir: string }>();
        for (const t of transfers) {
          const ts = t.timestamp ? new Date(t.timestamp).getTime() : 0;
          const from = t.from?.hash?.toLowerCase?.() || '';
          const to = t.to?.hash?.toLowerCase?.() || '';
          const key = `${from}->${to}`;
          const rev = `${to}->${from}`;
          const value = Number(t.total?.value || 0);
          totalVolume += value;
          const last = lastByPair.get(rev);
          if (last && ts - last.ts <= 60_000) {
            pingPongVolume += value;
          }
          lastByPair.set(key, { ts, dir: key });
        }
        const pct = totalVolume ? (pingPongVolume / totalVolume) * 100 : 0;
        return {
          percent: formatPct2(pct),
          pingPongFormatted: formatTokenAmount2(pingPongVolume, decimals),
        };
      }},
      { id: 'sandwichBurstRate', label: 'Sandwich/Bot Burst Rate', description: 'Count of sub-5s bursts of 3+ transfers from the same sender in 24h', run: async () => {
        const transfers = await ensureTransfers24h();
        const grouped: Record<string, number[]> = {};
        transfers.forEach(t => {
          const from = t.from?.hash?.toLowerCase?.();
          const ts = t.timestamp ? new Date(t.timestamp).getTime() : null;
          if (!from || ts === null) return;
          if (!grouped[from]) grouped[from] = [];
          grouped[from].push(ts);
        });
        let bursts = 0;
        Object.values(grouped).forEach(times => {
          times.sort((a, b) => a - b);
          for (let i = 0; i < times.length - 2; i += 1) {
            if (times[i + 2] - times[i] <= 5000) bursts += 1;
          }
        });
        return { bursts };
      }},
      { id: 'toxicFlowRate', label: 'Toxic Flow Rate', description: 'Sell share of 24h trades', run: async () => {
        const pair = await getMainPair();
        const buys = Number(pair?.txns?.h24?.buys || 0);
        const sells = Number(pair?.txns?.h24?.sells || 0);
        const total = buys + sells;
        const pct = total ? (sells / total) * 100 : 0;
        return { percent: formatPct2(pct), buys, sells };
      }},
      { id: 'gasSpent100tx', label: 'Gas Spent (last 100 tx)', description: 'Sum of gas_used * gas_price over the first page of transactions', run: async () => {
        const data = await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${tokenAddress}/transactions`);
        const items: any[] = Array.isArray((data as any)?.items) ? (data as any).items.slice(0, 100) : [];
        const total = items.reduce((s, tx) => s + Number(tx.gas_used || 0) * Number(tx.gas_price || 0), 0);
        return { raw: total, formatted: total.toLocaleString() };
      }},

      // Price/market (DEXScreener)
      { id: 'priceUsd', label: 'priceUsd', description: 'Latest USD price reported by the leading Dex pair', run: async () => (await ensureDex()).pairs?.[0]?.priceUsd },
      { id: 'priceNative', label: 'priceNative', description: 'Price denominated in native PLS from the main pair', run: async () => (await ensureDex()).pairs?.[0]?.priceNative },
      { id: 'priceChange6h', label: 'priceChange6h', description: 'Percent price change during the last 6 hours', run: async () => (await ensureDex()).pairs?.[0]?.priceChange?.h6 },
      { id: 'priceChange24h', label: 'priceChange24h', description: 'Percent price change during the last 24 hours', run: async () => (await ensureDex()).pairs?.[0]?.priceChange?.h24 },
      { id: 'volume1h', label: 'volume1h', description: 'Trading volume generated in the past 1 hour', run: async () => (await ensureDex()).pairs?.[0]?.volume?.h1 },
      { id: 'volume6h', label: 'volume6h', description: 'Trading volume generated in the past 6 hours', run: async () => (await ensureDex()).pairs?.[0]?.volume?.h6 },
      { id: 'volume24h', label: 'volume24h', description: 'Trading volume generated in the past 24 hours', run: async () => (await ensureDex()).pairs?.[0]?.volume?.h24 },
      { id: 'liquidityUsd', label: 'liquidityUsd', description: 'Current USD liquidity for the primary Dex pair', run: async () => {
        const dex = await ensureDex();
        const p = dex?.pairs?.[0];
        const usd = Number(p?.liquidity?.usd || 0);
        const pair = p ? `${p.baseToken?.symbol}/${p.quoteToken?.symbol}` : null;
        return { usd, usdFormatted: formatNumber2(usd), pair };
      } },
      { id: 'totalLiquidityUsd', label: 'Total Liquidity (USD)', description: 'Sum of USD liquidity across every discovered pair', run: async () => {
        const dex = await ensureDex();
        const pairs = dex?.pairs || [];
        const totalUsd = pairs.reduce((s: number, x: unknown) => s + Number((x as { liquidity?: { usd?: string | number } })?.liquidity?.usd || 0), 0);
        
        // Calculate breakdown of both sides
        const pairDetails = pairs.map((p: unknown) => {
          const baseUsd = Number(p?.liquidity?.base || 0) * Number(p?.priceUsd || 0);
          const quoteUsd = Number(p?.liquidity?.usd || 0) - baseUsd; // Remaining is quote token USD
          
          return {
            pair: `${p.baseToken?.symbol}/${p.quoteToken?.symbol}`,
            totalUsd: Number(p?.liquidity?.usd || 0),
            totalUsdFormatted: formatNumber2(Number(p?.liquidity?.usd || 0)),
            baseUsd: baseUsd,
            baseUsdFormatted: formatNumber2(baseUsd),
            quoteUsd: quoteUsd,
            quoteUsdFormatted: formatNumber2(quoteUsd),
            baseAmount: Number(p?.liquidity?.base || 0),
            quoteAmount: Number(p?.liquidity?.quote || 0)
          };
        });
        
        return { 
          totalUsd, 
          totalUsdFormatted: formatNumber2(totalUsd),
          pairDetails,
          pairCount: pairs.length
        };
      } },
      { id: 'totalTokensInLiquidity', label: 'Total Tokens in Liquidity', description: 'Breakdown of base and quote token balances locked in liquidity', run: async () => {
        const dex = await ensureDex();
        const { tokenInfo } = await ensureCoreCaches();
        const decimals = Number(tokenInfo?.decimals ?? 18);
        const pairs = dex?.pairs || [];
        const totalBase = pairs.reduce((s: number, x: unknown) => s + Number((x as { liquidity?: { base?: string | number } })?.liquidity?.base || 0), 0);
        const totalQuote = pairs.reduce((s: number, x: unknown) => s + Number((x as { liquidity?: { quote?: string | number } })?.liquidity?.quote || 0), 0);
        const pairDetails = pairs.map((p: unknown) => ({
          pair: `${p.baseToken?.symbol}/${p.quoteToken?.symbol}`,
          base: Number(p?.liquidity?.base || 0),
          baseFormatted: formatTokenAmount2(Number(p?.liquidity?.base || 0), decimals),
          quote: Number(p?.liquidity?.quote || 0),
          quoteFormatted: formatNumber2(Number(p?.liquidity?.quote || 0))
        }));
        return { 
          totalBase, 
          totalBaseFormatted: formatTokenAmount2(totalBase, decimals),
          totalQuote,
          totalQuoteFormatted: formatNumber2(totalQuote),
          pairDetails,
          pairCount: pairs.length
        };
      } },
      { id: 'fdv', label: 'fdv', description: 'Fully diluted valuation derived from Dex data', run: async () => (await ensureDex()).pairs?.[0]?.fdv },
      { id: 'marketCap', label: 'marketCap', description: 'Reported market capitalization from DexScreener', run: async () => (await ensureDex()).pairs?.[0]?.marketCap },
      { id: 'trades24hBuys', label: 'trades24hBuys', description: 'Number of buy-side transactions over the last 24 hours', run: async () => (await ensureDex()).pairs?.[0]?.txns?.h24?.buys },
      { id: 'trades24hSells', label: 'trades24hSells', description: 'Number of sell-side transactions over the last 24 hours', run: async () => (await ensureDex()).pairs?.[0]?.txns?.h24?.sells },
      { id: 'buySellRatio24h', label: 'buySellRatio24h', description: 'Buy versus sell ratio computed from 24h trade counts', run: async () => {
        const p = (await ensureDex()).pairs?.[0];
        const b = Number(p?.txns?.h24?.buys || 0);
        const s = Number(p?.txns?.h24?.sells || 0);
        const ratio = s === 0 ? (b > 0 ? Infinity : 0) : b / s;
        return {
          raw: ratio,
          formatted: ratio === Infinity ? '∞' : formatNumber2(ratio),
          buys: b,
          sells: s
        };
      } },
      { id: 'pairCount', label: 'pairCount', description: 'How many Dex pairs were returned for this token', run: async () => ((await ensureDex()).pairs || []).length },
      { id: 'mainPairDex', label: 'mainPairDex', description: 'Name of the DEX hosting the primary liquidity pair', run: async () => (await ensureDex()).pairs?.[0]?.dexId },
      { id: 'mainPairAddress', label: 'mainPairAddress', description: 'Contract address of the leading liquidity pair', run: async () => (await ensureDex()).pairs?.[0]?.pairAddress },

      // All Liquidity Pools
      { id: 'allPools', label: 'All Liquidity Pools', description: 'Detailed table of all pools with liquidity and volume stats', run: async () => {
        const dex = await ensureDex();
        const pairs = dex?.pairs || [];
        // Sort by liquidity
        const sorted = [...pairs].sort((a, b) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0));
        return sorted;
      }},

      // Contract/address
      { id: 'contractVerified', label: 'contractVerified', description: 'Indicates whether the contract is verified on PulseScan', run: async () => !!(await ensureCoreCaches()).addressInfo?.is_verified },
      { id: 'creatorAddress', label: 'creatorAddress', description: 'Address that deployed the contract per PulseScan', run: async () => (await ensureCoreCaches()).addressInfo?.creator_address_hash },
      { id: 'creationTxHash', label: 'creationTxHash', description: 'Hash of the deployment transaction', run: async () => (await ensureCoreCaches()).addressInfo?.creation_tx_hash },
      { id: 'creationDate', label: 'Creation Date', description: 'UTC date the contract was deployed', run: async () => {
        const { addressInfo } = await ensureCoreCaches();
        const txHash = addressInfo?.creation_tx_hash;
        if (!txHash) return 'N/A';

        const txDetails = await fetchJson(`https://api.scan.pulsechain.com/api/v2/transactions/${txHash}`);
        const timestamp = txDetails?.timestamp;

        if (!timestamp) return 'Not found';

        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');

        return `${year}-${month}-${day}`;
      }},
      { id: 'transactionsCount', label: 'transactionsCount', description: 'Total on-chain transactions associated with this address', run: async () => Number((await ensureCoreCaches()).addressCounters?.transactions_count || 0) },
      { id: 'tokenTransfersCount', label: 'tokenTransfersCount', description: 'Total token transfer entries counted on PulseScan', run: async () => Number((await ensureCoreCaches()).addressCounters?.token_transfers_count || 0) },
      { id: 'gasUsageCount', label: 'gasUsageCount', description: 'Number of gas usage records tied to the address', run: async () => Number((await ensureCoreCaches()).addressCounters?.gas_usage_count || 0) },
      { id: 'validationsCount', label: 'Validations Count', description: 'Validator/validation count attributed to the address', run: async () => Number((await ensureCoreCaches()).addressCounters?.validations_count || 0) },
          { id: 'firstPageTxs', label: '1st Page Transactions', description: 'Raw payload of the first page of transactions from the API', run: async () => {
            const data = await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${tokenAddress}/transactions`);
            return data?.items || [];
          }},
          { id: 'firstPageTransfers', label: '1st Page Transfers', description: 'Raw payload of the first page of token transfers', run: async () => {
            const data = await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddress}/transfers`);
            return data?.items || [];
          }},
          { id: 'firstPageInternalTxs', label: '1st Page Internal Txs', description: 'Raw payload of the first page of internal transactions', run: async () => {
            const data = await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${tokenAddress}/internal-transactions`);
            return data?.items || [];
          }},
          { id: 'transactionVelocity', label: 'Transaction Velocity (24h)', description: 'Velocity metric measuring transfer volume vs circulating supply over 24h', run: async () => {
            const transfers = await ensureTransfers24h();
            const { tokenInfo } = await ensureCoreCaches();
            const holders = await ensureHolders();
            const dead = holders.find(h => h.hash.toLowerCase() === DEAD_ADDRESS)?.value || '0';
            const circulatingSupply = Number(tokenInfo.total_supply) - Number(dead);

            if (circulatingSupply === 0) return 0;

            const transferVolume = transfers.reduce((sum, t) => sum + Number(t.total.value), 0);
            const velocity = transferVolume / circulatingSupply;
            return formatPct2(velocity * 100);
          }},
        ]
      },
      {
        title: 'Contract Metadata',
        stats: [
          { id: 'address', label: 'Token Address', description: 'Currently selected token address for the panel', run: async () => tokenAddress },
      { id: 'symbol', label: 'symbol', description: 'Token symbol fetched from token metadata', run: async () => (await ensureCoreCaches()).tokenInfo?.symbol },
      { id: 'name', label: 'name', description: 'Token name fetched from token metadata', run: async () => (await ensureCoreCaches()).tokenInfo?.name },
      { id: 'iconUrl', label: 'Icon URL', description: 'Primary icon/logo URL when available', run: async () => (await ensureDex()).pairs?.[0]?.info?.imageUrl || (await ensureCoreCaches()).tokenInfo?.icon_url },
          { id: 'abiComplexity', label: 'ABI Complexity Score', description: 'Count of ABI functions as a quick complexity proxy', run: async () => {
            const { addressInfo } = await ensureCoreCaches();
            const contract = await fetchJson(`https://api.scan.pulsechain.com/api/v2/smart-contracts/${addressInfo.creator_address_hash}`);
            const abi = contract?.abi || [];
            return abi.filter((item: unknown) => (item as { type: string }).type === 'function').length;
          }},
        ]
      }
    ];
  }, [ensureCoreCaches, ensureDex, ensureHolders, ensureTransfers24h, tokenAddress]);

  const pulsechainStats = useMemo(() => {
    return [
      // Search & Discovery
          { id: 'search', label: 'Search', description: 'Search for addresses, tokens, contracts', run: async () => {
            const query = customInputs.searchQuery || '';
            if (!query) return { error: 'Search query is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/search?q=${encodeURIComponent(query)}`);
          }},
          { id: 'checkSearchRedirect', label: 'Check Search Redirect', description: 'Check if search query redirects to a specific page', run: async () => {
            const query = customInputs.searchQuery || '';
            if (!query) return { error: 'Search query is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/search/check-redirect?q=${encodeURIComponent(query)}`);
          }},
          // Global Lists
          { id: 'transactionsList', label: 'Transactions List', description: 'List all transactions (paginated)', run: async () => {
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/transactions?page=${page}&limit=${limit}`);
          }},
          { id: 'blocksList', label: 'Blocks List', description: 'List all blocks (paginated)', run: async () => {
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/blocks?page=${page}&limit=${limit}`);
          }},
          { id: 'tokenTransfersList', label: 'Token Transfers List', description: 'List all token transfers (paginated)', run: async () => {
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '1000';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/token-transfers?page=${page}&limit=${limit}`);
          }},
          { id: 'internalTransactionsList', label: 'Internal Transactions List', description: 'List all internal transactions (paginated)', run: async () => {
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/internal-transactions?page=${page}&limit=${limit}`);
          }},
          { id: 'addressesList', label: 'Addresses List', description: 'List native coin holders (paginated)', run: async () => {
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses?page=${page}&limit=${limit}`);
          }},
          // Main Page Data
          { id: 'mainPageTransactions', label: 'Main Page Transactions', description: 'Recent transactions for main page', run: async () => {
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/main-page/transactions?page=${page}&limit=${limit}`);
          }},
          { id: 'mainPageBlocks', label: 'Main Page Blocks', description: 'Recent blocks for main page', run: async () => {
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/main-page/blocks?page=${page}&limit=${limit}`);
          }},
          { id: 'indexingStatus', label: 'Indexing Status', description: 'Blockchain indexing status', run: async () => {
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/main-page/indexing-status`);
          }},
          // Stats & Charts
          { id: 'stats', label: 'Blockchain Stats', description: 'Overall blockchain statistics', run: async () => {
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/stats`);
          }},
          { id: 'transactionChart', label: 'Transaction Chart', description: 'Transaction count chart data', run: async () => {
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/stats/charts/transactions`);
          }},
          { id: 'marketChart', label: 'Market Chart', description: 'Market cap/price chart data', run: async () => {
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/stats/charts/market`);
          }},
          // Transactions
          { id: 'transactionDetails', label: 'Transaction Details', description: 'Get transaction details', run: async () => {
            const txHash = customInputs.transactionHash || '';
            if (!txHash) return { error: 'Transaction hash is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/transactions/${txHash}`);
          }},
          { id: 'transactionTokenTransfers', label: 'Transaction Token Transfers', description: 'Token transfers in transaction', run: async () => {
            const txHash = customInputs.transactionHash || '';
            if (!txHash) return { error: 'Transaction hash is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/transactions/${txHash}/token-transfers`);
          }},
          { id: 'transactionInternalTransactions', label: 'Transaction Internal Transactions', description: 'Internal transactions in transaction', run: async () => {
            const txHash = customInputs.transactionHash || '';
            if (!txHash) return { error: 'Transaction hash is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/transactions/${txHash}/internal-transactions`);
          }},
          { id: 'transactionLogs', label: 'Transaction Logs', description: 'Event logs from transaction', run: async () => {
            const txHash = customInputs.transactionHash || '';
            if (!txHash) return { error: 'Transaction hash is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/transactions/${txHash}/logs`);
          }},
          { id: 'transactionRawTrace', label: 'Transaction Raw Trace', description: 'Raw execution trace', run: async () => {
            const txHash = customInputs.transactionHash || '';
            if (!txHash) return { error: 'Transaction hash is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/transactions/${txHash}/raw-trace`);
          }},
          { id: 'transactionStateChanges', label: 'Transaction State Changes', description: 'State changes from transaction', run: async () => {
            const txHash = customInputs.transactionHash || '';
            if (!txHash) return { error: 'Transaction hash is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/transactions/${txHash}/state-changes`);
          }},
          { id: 'transactionSummary', label: 'Transaction Summary', description: 'Human-readable transaction summary', run: async () => {
            const txHash = customInputs.transactionHash || '';
            if (!txHash) return { error: 'Transaction hash is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/transactions/${txHash}/summary`);
          }},
          // Blocks
          { id: 'blockDetails', label: 'Block Details', description: 'Get block details', run: async () => {
            const blockNumberOrHash = customInputs.blockNumberOrHash || '';
            if (!blockNumberOrHash) return { error: 'Block number or hash is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/blocks/${blockNumberOrHash}`);
          }},
          { id: 'blockTransactions', label: 'Block Transactions', description: 'Transactions in block', run: async () => {
            const blockNumberOrHash = customInputs.blockNumberOrHash || '';
            if (!blockNumberOrHash) return { error: 'Block number or hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/blocks/${blockNumberOrHash}/transactions?page=${page}&limit=${limit}`);
          }},
          { id: 'blockWithdrawals', label: 'Block Withdrawals', description: 'Withdrawals in block', run: async () => {
            const blockNumberOrHash = customInputs.blockNumberOrHash || '';
            if (!blockNumberOrHash) return { error: 'Block number or hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/blocks/${blockNumberOrHash}/withdrawals?page=${page}&limit=${limit}`);
          }},
          // Addresses
          { id: 'addressInfo', label: 'Address Info', description: 'Get address information', run: async () => {
            const addressHash = customInputs.addressHash || tokenAddress;
            if (!addressHash) return { error: 'Address hash is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}`);
          }},
          { id: 'addressCounters', label: 'Address Counters', description: 'Address transaction/transfer counts', run: async () => {
            const addressHash = customInputs.addressHash || tokenAddress;
            if (!addressHash) return { error: 'Address hash is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/counters`);
          }},
          { id: 'addressTransactions', label: 'Address Transactions', description: 'Address transactions (paginated)', run: async () => {
            const addressHash = customInputs.addressHash || tokenAddress;
            if (!addressHash) return { error: 'Address hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '1000';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/transactions?page=${page}&limit=${limit}`);
          }},
          { id: 'addressTokenTransfers', label: 'Address Token Transfers', description: 'Token transfers for address (paginated)', run: async () => {
            const addressHash = customInputs.addressHash || tokenAddress;
            if (!addressHash) return { error: 'Address hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '1000';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/token-transfers?page=${page}&limit=${limit}`);
          }},
          { id: 'addressInternalTransactions', label: 'Address Internal Transactions', description: 'Internal transactions for address', run: async () => {
            const addressHash = customInputs.addressHash || tokenAddress;
            if (!addressHash) return { error: 'Address hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '1000';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/internal-transactions?page=${page}&limit=${limit}`);
          }},
          { id: 'addressLogs', label: 'Address Logs', description: 'Event logs for address', run: async () => {
            const addressHash = customInputs.addressHash || tokenAddress;
            if (!addressHash) return { error: 'Address hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/logs?page=${page}&limit=${limit}`);
          }},
          { id: 'addressBlocksValidated', label: 'Address Blocks Validated', description: 'Blocks validated by address (validators)', run: async () => {
            const addressHash = customInputs.addressHash || tokenAddress;
            if (!addressHash) return { error: 'Address hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/blocks-validated?page=${page}&limit=${limit}`);
          }},
          { id: 'addressTokenBalances', label: 'Address Token Balances', description: 'Token balances for address', run: async () => {
            const addressHash = customInputs.addressHash || tokenAddress;
            if (!addressHash) return { error: 'Address hash is required' };
            const token = customInputs.tokenAddress || '';
            const url = token 
              ? `https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/token-balances?token=${token}`
              : `https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/token-balances`;
            return await fetchJson(url);
          }},
          { id: 'addressTokens', label: 'Address Tokens', description: 'Token balances (paginated)', run: async () => {
            const addressHash = customInputs.addressHash || tokenAddress;
            if (!addressHash) return { error: 'Address hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '2000';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/tokens?page=${page}&limit=${limit}`);
          }},
          { id: 'addressCoinBalanceHistory', label: 'Address Coin Balance History', description: 'Native coin balance history', run: async () => {
            const addressHash = customInputs.addressHash || tokenAddress;
            if (!addressHash) return { error: 'Address hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/coin-balance-history?page=${page}&limit=${limit}`);
          }},
          { id: 'addressCoinBalanceHistoryByDay', label: 'Address Coin Balance History By Day', description: 'Daily coin balance history', run: async () => {
            const addressHash = customInputs.addressHash || tokenAddress;
            if (!addressHash) return { error: 'Address hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/coin-balance-history-by-day?page=${page}&limit=${limit}`);
          }},
          { id: 'addressWithdrawals', label: 'Address Withdrawals', description: 'Withdrawals for address', run: async () => {
            const addressHash = customInputs.addressHash || tokenAddress;
            if (!addressHash) return { error: 'Address hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/withdrawals?page=${page}&limit=${limit}`);
          }},
          { id: 'addressNFT', label: 'Address NFT', description: 'NFT instances owned by address', run: async () => {
            const addressHash = customInputs.addressHash || tokenAddress;
            if (!addressHash) return { error: 'Address hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/nft?page=${page}&limit=${limit}`);
          }},
          { id: 'addressNFTCollections', label: 'Address NFT Collections', description: 'NFT collections for address', run: async () => {
            const addressHash = customInputs.addressHash || tokenAddress;
            if (!addressHash) return { error: 'Address hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/nft/collections?page=${page}&limit=${limit}`);
          }},
          // Tokens
          { id: 'tokensList', label: 'Tokens List', description: 'List all tokens (paginated)', run: async () => {
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens?page=${page}&limit=${limit}`);
          }},
          { id: 'tokenInfoDetailed', label: 'Token Info Detailed', description: 'Get token information (detailed)', run: async () => {
            const tokenAddr = customInputs.tokenAddress || tokenAddress;
            if (!tokenAddr) return { error: 'Token address is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddr}`);
          }},
          { id: 'tokenTransfers', label: 'Token Transfers', description: 'Token transfers (paginated)', run: async () => {
            const tokenAddr = customInputs.tokenAddress || tokenAddress;
            if (!tokenAddr) return { error: 'Token address is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '1000';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddr}/transfers?page=${page}&limit=${limit}`);
          }},
          { id: 'tokenHolders', label: 'Token Holders', description: 'Token holders (paginated)', run: async () => {
            const tokenAddr = customInputs.tokenAddress || tokenAddress;
            if (!tokenAddr) return { error: 'Token address is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '2000';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddr}/holders?page=${page}&limit=${limit}`);
          }},
          { id: 'tokenCounters', label: 'Token Counters', description: 'Token holder/transfer counts', run: async () => {
            const tokenAddr = customInputs.tokenAddress || tokenAddress;
            if (!tokenAddr) return { error: 'Token address is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddr}/counters`);
          }},
          { id: 'tokenLogs', label: 'Token Logs', description: 'Event logs for token', run: async () => {
            const tokenAddr = customInputs.tokenAddress || tokenAddress;
            if (!tokenAddr) return { error: 'Token address is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddr}/logs`);
          }},
          { id: 'tokenInstances', label: 'Token Instances', description: 'NFT instances (for NFT tokens)', run: async () => {
            const tokenAddr = customInputs.tokenAddress || tokenAddress;
            if (!tokenAddr) return { error: 'Token address is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddr}/instances?page=${page}&limit=${limit}`);
          }},
          { id: 'tokenInstanceById', label: 'Token Instance By ID', description: 'Specific NFT instance', run: async () => {
            const tokenAddr = customInputs.tokenAddress || tokenAddress;
            const instanceId = customInputs.instanceId || '';
            if (!tokenAddr) return { error: 'Token address is required' };
            if (!instanceId) return { error: 'Instance ID is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddr}/instances/${instanceId}`);
          }},
          { id: 'tokenInstanceTransfers', label: 'Token Instance Transfers', description: 'Transfers for NFT instance', run: async () => {
            const tokenAddr = customInputs.tokenAddress || tokenAddress;
            const instanceId = customInputs.instanceId || '';
            if (!tokenAddr) return { error: 'Token address is required' };
            if (!instanceId) return { error: 'Instance ID is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddr}/instances/${instanceId}/transfers`);
          }},
          { id: 'tokenInstanceHolders', label: 'Token Instance Holders', description: 'Holders of NFT instance', run: async () => {
            const tokenAddr = customInputs.tokenAddress || tokenAddress;
            const instanceId = customInputs.instanceId || '';
            if (!tokenAddr) return { error: 'Token address is required' };
            if (!instanceId) return { error: 'Instance ID is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddr}/instances/${instanceId}/holders`);
          }},
          { id: 'tokenInstanceTransfersCount', label: 'Token Instance Transfers Count', description: 'Transfer count for NFT instance', run: async () => {
            const tokenAddr = customInputs.tokenAddress || tokenAddress;
            const instanceId = customInputs.instanceId || '';
            if (!tokenAddr) return { error: 'Token address is required' };
            if (!instanceId) return { error: 'Instance ID is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddr}/instances/${instanceId}/transfers-count`);
          }},
          { id: 'refetchTokenInstanceMetadata', label: 'Refetch Token Instance Metadata', description: 'Refetch NFT metadata', run: async () => {
            const tokenAddr = customInputs.tokenAddress || tokenAddress;
            const instanceId = customInputs.instanceId || '';
            if (!tokenAddr) return { error: 'Token address is required' };
            if (!instanceId) return { error: 'Instance ID is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddr}/instances/${instanceId}/refetch-metadata`, { method: 'PATCH' });
          }},
          // Smart Contracts
          { id: 'smartContractsList', label: 'Smart Contracts List', description: 'List verified smart contracts (paginated)', run: async () => {
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/smart-contracts?page=${page}&limit=${limit}`);
          }},
          { id: 'smartContractsCounters', label: 'Smart Contracts Counters', description: 'Smart contract statistics', run: async () => {
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/smart-contracts/counters`);
          }},
          { id: 'smartContractDetails', label: 'Smart Contract Details', description: 'Get smart contract details (source code, ABI, etc.)', run: async () => {
            const contractAddress = customInputs.contractAddress || '';
            if (!contractAddress) return { error: 'Contract address is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/smart-contracts/${contractAddress}`);
          }},
          // Configuration
          { id: 'jsonRpcUrl', label: 'JSON-RPC URL', description: 'Get JSON-RPC endpoint URL', run: async () => {
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/config/json-rpc-url`);
          }},
          // Proxy/Account Abstraction
      { id: 'accountAbstractionStatus', label: 'Account Abstraction Status', description: 'Account abstraction status', run: async () => {
        return await fetchJson(`https://api.scan.pulsechain.com/api/v2/proxy/account-abstraction/status`);
      }},
    ];
  }, [tokenAddress, customInputs]);

  const flatStatList = useMemo(
    () => [...statCategories.flatMap(category => category.stats), ...pulsechainStats],
    [statCategories, pulsechainStats]
  );

  const selectedStatMeta = useMemo(
    () => flatStatList.find(stat => stat.id === selectedStat) ?? null,
    [flatStatList, selectedStat]
  );

  const selectedStatCategory = useMemo(() => {
    if (!selectedStatMeta) return null;
    return (
      statCategories.find(category =>
        category.stats.some(stat => stat.id === selectedStatMeta.id)
      ) ?? null
    );
  }, [statCategories, selectedStatMeta]);

  const resolvedCategoryTitle = useMemo(() => {
    if (activeCategory) return activeCategory;
    return statCategories[0]?.title ?? '';
  }, [activeCategory, statCategories]);

  const activeStats = useMemo(() => {
    if (!resolvedCategoryTitle) return [];
    const category = statCategories.find(item => item.title === resolvedCategoryTitle);
    return category ? category.stats : [];
  }, [resolvedCategoryTitle, statCategories]);

  useEffect(() => {
    if (statCategories.length === 0) return;
    if (!activeCategory) {
      setActiveCategory(statCategories[0].title);
      return;
    }
    if (!statCategories.some(category => category.title === activeCategory)) {
      setActiveCategory(statCategories[0].title);
    }
  }, [statCategories, activeCategory]);

  useEffect(() => {
    if (!selectedStatCategory) return;
    if (selectedStatCategory.title !== activeCategory) {
      setActiveCategory(selectedStatCategory.title);
    }
  }, [selectedStatCategory, activeCategory]);

  const handleCategorySelect = useCallback(
    (nextCategory: string) => {
      setActiveCategory(nextCategory);
      const category = statCategories.find(item => item.title === nextCategory);
      if (!category) return;
      const containsSelected = category.stats.some(stat => stat.id === selectedStat);
      if (!containsSelected) {
        setSelectedStat('');
      }
    },
    [statCategories, selectedStat]
  );

  const runOneStat = useCallback(async (id: string) => {
    const item = flatStatList.find(stat => stat.id === id);
    if (!item) return;

    startNetworkSession();
    setBusyStat(id);
    const startTime = Date.now();

    let derivedApiCalls: Array<{ endpoint: string; method: string; description: string }> | undefined;
    try {
      let endpoint = 'Multiple API Calls';
      let params = { statId: id, label: item.label };
      let apiCalls: Array<{ endpoint: string; method: string; description: string }> | undefined;

      if (id.includes('holders') || id.includes('Holders')) {
        endpoint = `https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddress}/holders`;
      } else if (id.includes('transfers') || id.includes('Transfers')) {
        endpoint = `https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddress}/transfers`;
      } else if (
        id.includes('dex') ||
        id.includes('liquidity') ||
        id.includes('Liquidity') ||
        id.includes('price') ||
        id.includes('Price') ||
        id.includes('volume') ||
        id.includes('Volume')
      ) {
        endpoint = `https://api.dexscreener.com/latest/dex/tokens/pulsechain/${tokenAddress}`;
      } else if (id === 'totalSupply' || id === 'symbol' || id === 'name' || id === 'iconUrl') {
        endpoint = `https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddress}`;
      } else if (
        id.includes('creator') ||
        id.includes('Creator') ||
        id.includes('contract') ||
        id.includes('Contract')
      ) {
        endpoint = `https://api.scan.pulsechain.com/api/v2/addresses/${tokenAddress}`;
      }

      if (endpoint === 'Multiple API Calls') {
        apiCalls = [];

        if (
          [
            'burnedTotal',
            'burned24h',
            'top1Pct',
            'top10Pct',
            'top20Pct',
            'top50Pct',
            'whaleCount1Pct',
            'top50Holders',
            'avgHolderBalance',
          ].includes(id)
        ) {
          apiCalls.push(
            {
              endpoint: `https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddress}`,
              method: 'GET',
              description: 'Get token info (supply, decimals)',
            },
            {
              endpoint: `https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddress}/holders`,
              method: 'GET',
              description: 'Get token holders (paginated)',
            }
          );
        }

        if (id === 'burned24h' || id === 'minted24h' || id.includes('newVsLostHolders')) {
          apiCalls.push({
            endpoint: `https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddress}/transfers`,
            method: 'GET',
            description: 'Get token transfers (time filtered)',
          });
        }

        if (
          id.includes('blueChip') ||
          id.includes('diamond') ||
          id.includes('liquidity') ||
          id.includes('Liquidity') ||
          id.includes('avgBuySell')
        ) {
          apiCalls.push({
            endpoint: `https://api.dexscreener.com/latest/dex/tokens/pulsechain/${tokenAddress}`,
            method: 'GET',
            description: 'Get Dex data (pairs, liquidity, volume)',
          });
        }

        if (
          id.includes('creator') ||
          id === 'contractAgeInDays' ||
          id === 'ownershipStatus' ||
          id.includes('contract')
        ) {
          apiCalls.push(
            {
              endpoint: `https://api.scan.pulsechain.com/api/v2/addresses/${tokenAddress}`,
              method: 'GET',
              description: 'Get contract address info',
            },
            {
              endpoint: `https://api.scan.pulsechain.com/api/v2/transactions/{txHash}`,
              method: 'GET',
              description: 'Get creation transaction details',
            }
          );
        }

        if (apiCalls.length === 0) {
          apiCalls = [
            {
              endpoint: `https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddress}`,
              method: 'GET',
              description: 'Get token information',
            },
            {
              endpoint: `https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddress}/holders`,
              method: 'GET',
              description: 'Get token holders',
            },
            {
              endpoint: `https://api.dexscreener.com/latest/dex/tokens/pulsechain/${tokenAddress}`,
              method: 'GET',
              description: 'Get Dex data',
            },
          ];
        }
      } else if (endpoint) {
        apiCalls = [
          {
            endpoint,
            method: 'GET',
            description: item.label || 'Fetch stat data',
          },
        ];
      }

      derivedApiCalls = apiCalls;

      const requestInfo = {
        statId: id,
        endpoint: endpoint,
        params: params,
        response: null,
        timestamp: new Date(),
        duration: 0,
        apiCalls,
      };

      setCurrentRequest(requestInfo);

      const value = await item.run();
      const duration = Date.now() - startTime;

      setCurrentRequest({
        ...requestInfo,
        response: value,
        duration
      });

      setStatResult(prev => ({ ...prev, [id]: value }));
    } catch (e) {
      const duration = Date.now() - startTime;
      const errorResponse = { error: (e as Error).message };

      setCurrentRequest({
        statId: id,
        endpoint: 'Multiple API Calls',
        params: { statId: id, label: item.label, error: (e as Error).message },
        response: errorResponse,
        timestamp: new Date(),
        duration,
        apiCalls: derivedApiCalls,
      });

      setStatResult(prev => ({ ...prev, [id]: errorResponse }));
    } finally {
      setBusyStat(null);
      stopNetworkSession();
      setNetworkEvents([]);
    }
  }, [flatStatList, tokenAddress, startNetworkSession, stopNetworkSession]);

  const clearCurrentRequest = useCallback(() => {
    setCurrentRequest(null);
    setNetworkEvents([]);
    requestSessionMapRef.current.clear();
    sessionIdRef.current = null;
  }, []);

  const handleTestStat = useCallback(() => {
    if (selectedStat) {
      runOneStat(selectedStat);
    }
  }, [selectedStat, runOneStat]);

  const statLabelText = tokenSymbol ? `Get Any Stat on ${tokenSymbol}` : 'Select Stat';
  const actionText = variant === 'hero' ? 'Get Stat' : 'Test';

  // Determine which inputs are needed for the selected stat
  const getRequiredInputs = useCallback((statId: string): Array<{ key: string; label: string; placeholder: string }> => {
    const inputs: Array<{ key: string; label: string; placeholder: string }> = [];
    
    if (statId === 'search' || statId === 'checkSearchRedirect') {
      inputs.push({ key: 'searchQuery', label: 'Search Query', placeholder: 'Enter search query...' });
    }
    
    if (statId.startsWith('transaction')) {
      inputs.push({ key: 'transactionHash', label: 'Transaction Hash', placeholder: '0x...' });
    }
    
    if (statId.startsWith('block')) {
      inputs.push({ key: 'blockNumberOrHash', label: 'Block Number or Hash', placeholder: '12345 or 0x...' });
    }
    
    if (statId.startsWith('address') || statId === 'addressInfo' || statId === 'addressCounters' || 
        statId === 'addressTransactions' || statId === 'addressTokenTransfers' || 
        statId === 'addressInternalTransactions' || statId === 'addressLogs' || 
        statId === 'addressBlocksValidated' || statId === 'addressTokenBalances' || 
        statId === 'addressTokens' || statId === 'addressCoinBalanceHistory' || 
        statId === 'addressCoinBalanceHistoryByDay' || statId === 'addressWithdrawals' || 
        statId === 'addressNFT' || statId === 'addressNFTCollections') {
      inputs.push({ key: 'addressHash', label: 'Address Hash', placeholder: '0x... (defaults to token address)' });
    }
    
    if (statId === 'addressTokenBalances') {
      inputs.push({ key: 'tokenAddress', label: 'Token Address (optional)', placeholder: 'Filter by token address...' });
    }
    
    if (statId.startsWith('token') && statId !== 'tokensList' && statId !== 'tokenInfoDetailed' && 
        statId !== 'tokenTransfers' && statId !== 'tokenHolders' && statId !== 'tokenCounters' && 
        statId !== 'tokenLogs' && statId !== 'tokenInstances') {
      inputs.push({ key: 'tokenAddress', label: 'Token Address', placeholder: '0x... (defaults to token address)' });
    }
    
    if (statId.includes('Instance') && statId !== 'tokenInstances') {
      inputs.push({ key: 'instanceId', label: 'Instance ID', placeholder: 'NFT instance ID...' });
    }
    
    if (statId === 'smartContractDetails') {
      inputs.push({ key: 'contractAddress', label: 'Contract Address', placeholder: '0x...' });
    }
    
    // Add pagination inputs for list endpoints
    if (statId.includes('List') || statId.includes('Transactions') || statId.includes('Transfers') || 
        statId.includes('Holders') || statId.includes('Instances') || statId.includes('Blocks') || 
        statId.includes('Withdrawals') || statId.includes('NFT') || statId.includes('Tokens') ||
        statId.includes('Logs') || statId.includes('History')) {
      inputs.push({ key: 'page', label: 'Page', placeholder: '1' });
      inputs.push({ key: 'limit', label: 'Limit', placeholder: '100' });
    }
    
    return inputs;
  }, []);

  const requiredInputs = useMemo(() => {
    if (!selectedStat) return [];
    return getRequiredInputs(selectedStat);
  }, [selectedStat, getRequiredInputs]);

  return (
    <div className={`${compact ? 'text-xs' : 'text-sm'} space-y-3`}>
      {/* Token Address Search */}
      {variant === 'default' && (
        <div className="space-y-2">
          <label htmlFor="token" className="text-white block">Token Address</label>
          <div className="relative flex items-center gap-2">
            <input
              id="token"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={`w-full bg-black/60 backdrop-blur border border-gray-700 rounded px-2 text-white ${compact ? 'py-1 text-xs' : 'py-2 text-sm'}`}
              placeholder="Search by address..."
            />
            <button
              type="button"
              onClick={() => handleLoadNewToken(searchInput)}
              className={`shrink-0 px-3 rounded bg-purple-700 hover:bg-purple-800 text-white ${compact ? 'py-1 text-xs' : 'py-2 text-sm'}`}
            >
              Load
            </button>
            {isSearching && <div className="absolute top-full mt-1 w-full bg-black/50 backdrop-blur border border-gray-700 rounded p-2 text-white">Searching...</div>}
            {searchResults.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-black/50 backdrop-blur border border-gray-700 rounded z-10">
                {searchResults.map((item: any) => (
                  <div
                    key={item.address}
                    className="p-2 hover:bg-gray-900 cursor-pointer text-white"
                    onClick={() => handleLoadNewToken(item.address)}
                  >
                    {item.name} ({item.symbol})
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PulseChain Stats Dropdown */}
      <div className="space-y-2">
        <label className="text-white block text-sm">PulseChain Stats</label>
        <div className="relative" ref={pulsechainDropdownRef}>
          <button
            onClick={() => setPulsechainDropdownOpen(!pulsechainDropdownOpen)}
            className={`w-full bg-black/60 backdrop-blur border border-gray-700 rounded px-4 text-left text-white flex items-center justify-between ${
              compact ? 'py-2 text-xs' : 'py-3 text-sm'
            }`}
          >
            <span>Select PulseChain API Endpoint</span>
            <span className={`transition-transform ${pulsechainDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {pulsechainDropdownOpen && (
            <div className="absolute z-[100] w-full mt-1 bg-black/60 backdrop-blur border border-gray-700 rounded max-h-60 overflow-y-auto">
              {pulsechainStats.map(stat => (
                <button
                  key={stat.id}
                  onClick={() => {
                    setSelectedStat(stat.id);
                    setPulsechainDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 border-b border-gray-700 last:border-b-0 hover:bg-gray-900 transition-colors ${
                    selectedStat === stat.id ? 'bg-gray-900 text-white' : 'text-white'
                  }`}
                >
                  <div className={`${compact ? 'text-xs' : 'text-sm'} font-semibold`}>{stat.label}</div>
                  {stat.description && (
                    <div className={`${compact ? 'text-[10px]' : 'text-xs'} text-white/70 mt-0.5`}>{stat.description}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stat Selector */}
      <div className="space-y-3">
        <label className="text-white block text-sm lg:text-base">{statLabelText}</label>

        {statCategories.length > 0 && (
          <div className="hidden md:flex flex-col gap-4" aria-label="Stat selector">
            <div className="w-full space-y-3 overflow-hidden">
              <div className="relative">
                <div className="flex w-full items-center gap-2 rounded-lg border border-white/15 bg-black/80 backdrop-blur p-1 text-white overflow-x-auto scrollbar-hide">
                  {statCategories.map(category => (
                    <button
                      key={category.title}
                      onClick={() => handleCategorySelect(category.title)}
                      className={`whitespace-nowrap rounded-full border font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
                        compact ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'
                      } ${
                        resolvedCategoryTitle === category.title
                          ? 'border-purple-700 bg-purple-700 text-white shadow-[0_10px_40px_rgba(126,34,206,0.3)]'
                          : 'border-transparent text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {category.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="focus-visible:outline-none focus-visible:ring-0">
                <div className="rounded-lg border border-gray-700/70 bg-black/80 backdrop-blur">
                  {statCategories
                    .find(category => category.title === resolvedCategoryTitle)
                    ?.stats.length ? (
                      <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                        {statCategories
                          .find(category => category.title === resolvedCategoryTitle)
                          ?.stats.map(stat => {
                            const isActive = selectedStat === stat.id;
                            return (
                              <button
                                key={stat.id}
                                type="button"
                                onClick={() => setSelectedStat(stat.id)}
                                className={`text-left rounded-xl border px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-700 focus-visible:ring-offset-2 focus-visible:ring-offset-black/50 ${
                                  isActive
                                    ? 'border-purple-700 bg-purple-700 text-white shadow-[0_0_25px_rgba(126,34,206,0.4)]'
                                    : 'border-gray-700/70 bg-black/70 backdrop-blur text-white hover:border-purple-700/40 hover:bg-gray-900/70'
                                }`}
                                aria-pressed={isActive}
                              >
                                <p className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>
                                  {stat.label}
                                </p>
                                {stat.description && (
                                  <p className={`${compact ? 'text-[10px]' : 'text-xs'} text-white/70 mt-1 line-clamp-2`}>
                                    {stat.description}
                                  </p>
                                )}
                              </button>
                            );
                          })}
                      </div>
                    ) : (
                      <span className={`${compact ? 'text-[11px]' : 'text-sm'} block p-4 text-white/70`}>
                        No stats available.
                      </span>
                    )}
                </div>
              </div>
            </div>

            {selectedStatMeta?.description && (
              <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-white/70`}>
                {selectedStatMeta.description}
              </p>
            )}
          </div>
        )}

        {/* Mobile Drawer */}
        <div className="md:hidden">
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerTrigger asChild>
              <button
                className={`w-full bg-black/60 backdrop-blur border border-gray-700 rounded-full px-4 text-left text-white ${
                  compact ? 'py-2 text-xs' : 'py-3 text-sm'
                }`}
              >
                {selectedStat ? selectedStatMeta?.label ?? statLabelText : statLabelText}
              </button>
            </DrawerTrigger>
            <DrawerContent className="bg-black/50 backdrop-blur border-gray-700">
              <DrawerHeader className="flex flex-row items-center justify-between">
                <DrawerTitle className="text-white">Select Stat</DrawerTitle>
                <Button
                  onClick={() => {
                    handleTestStat();
                    setDrawerOpen(false);
                  }}
                  disabled={!selectedStat || busyStat === selectedStat}
                  className={`px-4 bg-purple-700 hover:bg-purple-800 hover:ring-purple-700 disabled:opacity-50 disabled:cursor-not-allowed ${compact ? 'py-1 text-xs' : 'py-2 text-sm'}`}
                >
                  {busyStat === selectedStat ? 'Testing...' : actionText}
                </Button>
              </DrawerHeader>
              <div className="relative">
                <div className="max-h-[60vh] overflow-y-auto px-4 pb-32">
                  {/* PulseChain Stats Section */}
                  <div className="mb-4">
                    <div className="bg-black/50 backdrop-blur text-white font-semibold px-3 py-2 rounded-t">
                      PulseChain Stats
                    </div>
                    <div className="bg-black/50 backdrop-blur rounded-b">
                      {pulsechainStats.map(stat => (
                        <button
                          key={stat.id}
                          onClick={() => {
                            setSelectedStat(stat.id);
                            setDrawerOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 border-b border-gray-700 last:border-b-0 hover:bg-gray-900 transition-colors ${
                            selectedStat === stat.id ? 'bg-gray-900 text-white' : 'text-white'
                          }`}
                        >
                          <div>{stat.label}</div>
                          {stat.description && (
                            <div className="text-xs text-white/70 mt-0.5">{stat.description}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  {statCategories.map(category => (
                    <div key={category.title} className="mb-4">
                      <div className="bg-black/50 backdrop-blur text-white font-semibold px-3 py-2 rounded-t">
                        {category.title}
                      </div>
                      <div className="bg-black/50 backdrop-blur rounded-b">
                        {category.stats.map(stat => (
                          <button
                            key={stat.id}
                            onClick={() => {
                              setSelectedStat(stat.id);
                              setDrawerOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 border-b border-gray-700 last:border-b-0 hover:bg-gray-900 transition-colors ${
                              selectedStat === stat.id ? 'bg-gray-900 text-white' : 'text-white'
                            }`}
                          >
                            <div>{stat.label}</div>
                            {stat.description && (
                              <div className="text-xs text-white/70 mt-0.5">{stat.description}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <ProgressiveBlur position="bottom" height="25%" className="pointer-events-none" />
              </div>
            </DrawerContent>
          </Drawer>
        </div>

        {selectedStatMeta?.description && (
          <p className={`md:hidden ${compact ? 'text-[11px]' : 'text-xs'} text-white/70`}>
            {selectedStatMeta.description}
          </p>
        )}
      </div>

      {/* Custom Input Fields */}
      {requiredInputs.length > 0 && (
        <div className="space-y-2">
          <label className="text-white block text-sm">Required Parameters</label>
          <div className="space-y-2">
            {requiredInputs.map((input) => (
              <div key={input.key} className="space-y-1">
                <label htmlFor={input.key} className="text-white/80 text-xs block">
                  {input.label}
                </label>
                <input
                  id={input.key}
                  type="text"
                  value={customInputs[input.key] || ''}
                  onChange={(e) => setCustomInputs(prev => ({ ...prev, [input.key]: e.target.value }))}
                  className={`w-full bg-black/60 backdrop-blur border border-gray-700 rounded px-2 text-white ${compact ? 'py-1 text-xs' : 'py-2 text-sm'}`}
                  placeholder={input.placeholder}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test Button - Desktop Only */}
      <div className="hidden md:block">
        <Button
          onClick={handleTestStat}
          disabled={!selectedStat || busyStat === selectedStat}
          className={`px-4 bg-purple-700 hover:bg-purple-800 hover:ring-purple-700 disabled:opacity-50 disabled:cursor-not-allowed ${compact ? 'py-1 text-xs' : 'py-2 text-sm'}`}
        >
          {busyStat === selectedStat ? 'Testing...' : actionText}
        </Button>
      </div>

      {/* Current Request Details */}
      {currentRequest && (
        <div className="pt-3 border-t border-gray-700 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Results</h3>
            <button
              onClick={clearCurrentRequest}
              className="text-xs px-2 py-1 bg-red-800 hover:bg-red-700 rounded text-white"
            >
              Clear
            </button>
          </div>

          <div className="space-y-4">
            {networkEvents.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-white">Network Activity</div>
                  <div className="text-[10px] text-white/70 italic">Click 📋 to copy</div>
                </div>
                <div className="relative rounded-2xl border border-white/5 bg-black/50 backdrop-blur w-full overflow-hidden">
                  <div
                    ref={networkListRef}
                    className="space-y-2 max-h-36 overflow-y-auto p-3 pr-4 text-[11px] w-full"
                  >
                    {networkEvents.map((event) => {
                      const statusColor =
                        event.status === 'success'
                          ? 'text-emerald-300'
                          : event.status === 'error'
                          ? 'text-red-300'
                          : 'text-amber-200';
                      const started = event.startedAt
                        ? new Date(event.startedAt).toLocaleTimeString(undefined, { hour12: false })
                        : '';
                      const duration =
                        typeof event.durationMs === 'number'
                          ? `${Math.round(event.durationMs)}ms`
                          : null;
                      return (
                        <div
                          key={event.id}
                          className="rounded-lg border border-white/10 bg-black/50 backdrop-blur p-2 text-white/80 space-y-1 break-words max-w-full group"
                        >
                          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest">
                            <span>{event.method}</span>
                            <span className={`font-semibold ${statusColor}`}>
                              {event.status === 'pending'
                                ? 'Pending'
                                : event.status === 'success'
                                ? 'Success'
                                : 'Error'}
                            </span>
                          </div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-[10px] text-gray-300 break-all whitespace-pre-wrap flex-1">
                              {event.url}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(event.url);
                                // Show brief feedback
                                const btn = e.currentTarget;
                                const originalText = btn.textContent;
                                btn.textContent = '✓';
                                btn.classList.add('text-green-400');
                                setTimeout(() => {
                                  btn.textContent = originalText;
                                  btn.classList.remove('text-green-400');
                                }, 1000);
                              }}
                              className="md:opacity-0 md:group-hover:opacity-100 transition-opacity text-[10px] px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white flex-shrink-0"
                              title="Copy endpoint"
                            >
                              📋
                            </button>
                          </div>
                          <div className="text-[10px] text-gray-500 flex flex-wrap gap-3">
                            {started && <span>{started}</span>}
                            {duration && <span>{duration}</span>}
                            {event.statusCode && <span>Status {event.statusCode}</span>}
                          </div>
                          {event.requestBody && (
                            <div className="text-[10px] text-gray-400 break-all whitespace-pre-wrap">
                              Req: {event.requestBody}
                            </div>
                          )}
                          {event.responseSnippet && (
                            <div className="text-[10px] text-gray-400 break-all whitespace-pre-wrap">
                              Res: {event.responseSnippet}
                            </div>
                          )}
                          {event.error && (
                            <div className="text-[10px] text-red-400 break-all whitespace-pre-wrap">
                              Error: {event.error}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <ProgressiveBlur position="both" height="15%" blurLevels={[0.5,1.5,2.5]} className="pointer-events-none" />
                </div>
              </div>
            )}

            {!busyStat && (
              <div>
                <div className="text-gray-400 mb-1">Response</div>
                <div className="text-white font-mono bg-gray-800/80 px-3 py-3 rounded max-h-64 overflow-y-auto w-full md:w-[85%]">
                  <pre className="whitespace-pre-wrap text-xs">
                    {JSON.stringify(currentRequest.response, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
