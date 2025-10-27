'use client';

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { pulsechainApi } from '@/services';
import { fetchDexScreenerData, search } from '@/services/pulsechainService';
import { Button } from '@/components/ui/stateful-button';
import { LoaderWithPercent } from '@/components/ui/loader-with-percent';
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { ProgressiveBlur } from '@/components/ui/progressive-blur';
import { BackgroundGradient } from '@/components/ui/background-gradient';

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

interface AdminStatsPanelProps {
  initialAddress?: string;
  compact?: boolean;
}

export default function AdminStatsPanel({ initialAddress = '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e', compact = false }: AdminStatsPanelProps): JSX.Element {
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
    setSelectedStat('');
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

  const fetchJson = async (url: string): Promise<unknown> => {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
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

  const statCategories: Array<{ title: string; stats: Array<{ id: string; label: string; description: string; run: () => Promise<any> }> }> = useMemo(() => {
    return [
      {
        title: 'Token Supply',
        stats: [
          { id: 'totalSupply', label: 'Total Supply', description: 'Total number of tokens in circulation', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const raw = Number((tokenInfo as any)?.total_supply ?? 0);
        const decimals = Number((tokenInfo as any)?.decimals ?? 18);
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
        const decimals = Number((tokenInfo as any)?.decimals ?? 18);
        const holders = await ensureHolders();
        const dead = holders.find(h => h.hash.toLowerCase() === DEAD_ADDRESS)?.value || '0';
        const rawNum = Number(dead);
        const totalSupply = Number((tokenInfo as any)?.total_supply ?? 0);
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
        const totalSupply = Number((tokenInfo as any)?.total_supply ?? 0);
        const sum = (await ensureTransfers24h())
          .filter(t => (t.to?.hash || '').toLowerCase() === DEAD_ADDRESS)
          .reduce((s, t) => s + Number(t.total?.value || 0), 0);
        const pct = totalSupply ? (sum / totalSupply) * 100 : 0;
        const decimals = Number((tokenInfo as any)?.decimals ?? 18);
        return { raw: sum, formatted: formatTokenAmount2(sum, decimals), percent: pct, percentFormatted: formatPct2(pct) };
      } },
      { id: 'minted24h', label: 'Minted (24h)', description: 'New tokens created in the last 24 hours', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const decimals = Number((tokenInfo as any)?.decimals ?? 18);
        const sum = (await ensureTransfers24h())
          .filter(t => (t.from?.hash || '').toLowerCase() === tokenAddress.toLowerCase())
          .reduce((s, t) => s + Number(t.total?.value || 0), 0);
        return {
          raw: sum,
          formatted: formatTokenAmount2(sum, decimals)
        };
      } },
        ]
      },
      {
        title: 'Holder Distribution',
        stats: [
          { id: 'top1Pct', label: 'Top 1% Holdings', description: 'Percentage of supply held by top holder', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const total = Number((tokenInfo as any)?.total_supply ?? 0);
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
        const total = Number((tokenInfo as any)?.total_supply ?? 0);
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
      { id: 'whaleCount1Pct', label: 'Whale Count (>1%)', description: 'Number of wallets holding more than 1% of supply', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const total = Number((tokenInfo as any)?.total_supply ?? 0);
        const threshold = total * 0.01;
        const holders = await ensureHolders();
        const count = holders.filter(h => Number(h.value) >= threshold).length;
        return {
          raw: count,
          formatted: formatNumber2(count),
          threshold: formatTokenAmount2(threshold, Number((tokenInfo as any)?.decimals ?? 18))
        };
      } },
        ]
      },
      {
        title: 'Market & Liquidity',
        stats: [
          { id: 'liquidityUsd', label: 'liquidityUsd', description: 'Primary pair liquidity in USD', run: async () => {
        const dex = await ensureDex();
        const p = (dex as any)?.pairs?.[0];
        const usd = Number(p?.liquidity?.usd || 0);
        const pair = p ? `${p.baseToken?.symbol}/${p.quoteToken?.symbol}` : null;
        return { usd, usdFormatted: formatNumber2(usd), pair };
      } },
      { id: 'totalLiquidityUsd', label: 'Total Liquidity (USD)', description: 'Sum of all liquidity pairs', run: async () => {
        const dex = await ensureDex();
        const pairs = (dex as any)?.pairs || [];
        const totalUsd = pairs.reduce((s: number, x: any) => s + Number(x?.liquidity?.usd || 0), 0);

        const pairDetails = pairs.map((p: any) => {
          const baseUsd = Number(p?.liquidity?.base || 0) * Number(p?.priceUsd || 0);
          const quoteUsd = Number(p?.liquidity?.usd || 0) - baseUsd;

          return {
            pair: `${p.baseToken?.symbol}/${p.quoteToken?.symbol}`,
            totalUsd: Number(p?.liquidity?.usd || 0),
            totalUsdFormatted: formatNumber2(Number(p?.liquidity?.usd || 0)),
          };
        });

        return {
          totalUsd,
          totalUsdFormatted: formatNumber2(totalUsd),
          pairDetails,
          pairCount: pairs.length
        };
      } },
        ]
      },
      {
        title: 'On-Chain Activity',
        stats: [
          { id: 'transfers24h', label: 'transfers24h', description: 'Number of transfers in last 24h', run: async () => {
        const count = (await ensureTransfers24h()).length;
        return {
          raw: count,
          formatted: formatNumber2(count)
        };
      } },
      { id: 'priceUsd', label: 'priceUsd', description: 'Current USD price', run: async () => (await ensureDex()).pairs?.[0]?.priceUsd },
      { id: 'volume24h', label: 'volume24h', description: '24h trading volume', run: async () => (await ensureDex()).pairs?.[0]?.volume?.h24 },
        ]
      },
    ];
  }, [ensureCoreCaches, ensureDex, ensureHolders, ensureTransfers24h, tokenAddress]);

  const runOneStat = useCallback(async (id: string) => {
    const item = statCategories.flatMap(c => c.stats).find(s => s.id === id);
    if (!item) return;

    setBusyStat(id);
    const startTime = Date.now();

    try {
      let endpoint = 'Multiple API Calls';
      let params = { statId: id, label: item.label };
      let apiCalls: Array<{ endpoint: string; method: string; description: string }> | undefined;

      if (id.includes('holders') || id.includes('Holders')) {
        endpoint = `https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddress}/holders`;
      } else if (id.includes('transfers') || id.includes('Transfers')) {
        endpoint = `https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddress}/transfers`;
      } else if (id.includes('dex') || id.includes('liquidity') || id.includes('Liquidity') || id.includes('price') || id.includes('Price') || id.includes('volume') || id.includes('Volume')) {
        endpoint = `https://api.dexscreener.com/latest/dex/tokens/pulsechain/${tokenAddress}`;
      } else if (id === 'totalSupply' || id === 'symbol' || id === 'name') {
        endpoint = `https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddress}`;
      }

      const requestInfo = {
        statId: id,
        endpoint: endpoint,
        params: params,
        response: null,
        timestamp: new Date(),
        duration: 0,
        apiCalls
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
        duration
      });

      setStatResult(prev => ({ ...prev, [id]: errorResponse }));
    } finally {
      setBusyStat(null);
    }
  }, [statCategories, tokenAddress]);

  const clearCurrentRequest = useCallback(() => {
    setCurrentRequest(null);
  }, []);

  const handleTestStat = useCallback(() => {
    if (selectedStat) {
      runOneStat(selectedStat);
    }
  }, [selectedStat, runOneStat]);

  return (
    <div className={`${compact ? 'text-xs' : 'text-sm'} space-y-3`}>
      {/* Token Address Search */}
      <div className="space-y-2">
        <label htmlFor="token" className="text-gray-400 block">Token Address</label>
        <div className="relative flex items-center gap-2">
          <input
            id="token"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={`w-full bg-gray-800 border border-gray-700 rounded px-2 ${compact ? 'py-1 text-xs' : 'py-2 text-sm'}`}
            placeholder="Search by address..."
          />
          <button
            type="button"
            onClick={() => handleLoadNewToken(searchInput)}
            className={`shrink-0 px-3 rounded bg-orange-600 hover:bg-orange-700 text-white ${compact ? 'py-1 text-xs' : 'py-2 text-sm'}`}
          >
            Load
          </button>
          {isSearching && <div className="absolute top-full mt-1 w-full bg-gray-800 border border-gray-700 rounded p-2 text-gray-400">Searching...</div>}
          {searchResults.length > 0 && (
            <div className="absolute top-full mt-1 w-full bg-gray-800 border border-gray-700 rounded z-10">
              {searchResults.map((item: any) => (
                <div
                  key={item.address}
                  className="p-2 hover:bg-gray-700 cursor-pointer"
                  onClick={() => handleLoadNewToken(item.address)}
                >
                  {item.name} ({item.symbol})
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stat Selector */}
      <div className="space-y-2">
        <label className="text-gray-400 block">Select Stat</label>
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger asChild>
            <button className={`w-full bg-gray-800 border border-gray-700 rounded px-2 text-left ${compact ? 'py-1 text-xs' : 'py-2 text-sm'}`}>
              {selectedStat
                ? statCategories.flatMap(c => c.stats).find(s => s.id === selectedStat)?.label
                : 'Select a stat...'}
            </button>
          </DrawerTrigger>
          <DrawerContent className="bg-gray-900 border-gray-700">
            <DrawerHeader>
              <DrawerTitle className="text-white">Select Stat</DrawerTitle>
            </DrawerHeader>
            <div className="relative">
              <div className="max-h-[60vh] overflow-y-auto px-4 pb-32">
                {statCategories.map(category => (
                  <div key={category.title} className="mb-4">
                    <div className="bg-gray-800/60 text-white font-semibold px-3 py-2 rounded-t">
                      {category.title}
                    </div>
                    <div className="bg-gray-800 rounded-b">
                      {category.stats.map(stat => (
                        <button
                          key={stat.id}
                          onClick={() => {
                            setSelectedStat(stat.id);
                            setDrawerOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 border-b border-gray-700 last:border-b-0 hover:bg-gray-700 transition-colors ${
                            selectedStat === stat.id ? 'bg-gray-700 text-white' : 'text-gray-400'
                          }`}
                        >
                          <div>{stat.label}</div>
                          {stat.description && (
                            <div className="text-xs text-gray-500 mt-0.5">{stat.description}</div>
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

      {/* Test Button */}
      <Button
        onClick={handleTestStat}
        disabled={!selectedStat || busyStat === selectedStat}
        className={`px-4 bg-orange-600 hover:ring-orange-600 disabled:opacity-50 disabled:cursor-not-allowed ${compact ? 'py-1 text-xs' : 'py-2 text-sm'}`}
      >
        {busyStat === selectedStat ? 'Testing...' : 'Test'}
      </Button>

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

          <div className="space-y-2">
            <div>
              <div className="text-gray-400 mb-1">Stat ID</div>
              <div className="text-white font-mono bg-gray-800 px-2 py-1 rounded text-xs">
                {currentRequest.statId}
              </div>
            </div>

            <div>
              <div className="text-gray-400 mb-1">Endpoint</div>
              <div className="flex items-start gap-2">
                <div className="text-white font-mono bg-gray-800 px-2 py-1 rounded flex-1 break-all text-xs">
                  {currentRequest.endpoint}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(currentRequest.endpoint)}
                  className="text-xs px-2 py-1 bg-orange-600 hover:bg-orange-700 rounded whitespace-nowrap"
                >
                  Copy
                </button>
              </div>
            </div>

            <div>
              <div className="text-gray-400 mb-1">Response</div>
              <div className="text-white font-mono bg-gray-800 px-2 py-2 rounded max-h-64 overflow-y-auto">
                {busyStat ? (
                  <div className="flex flex-col items-center justify-center py-4">
                    <LoaderWithPercent label="Loading" />
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-xs">
                    {JSON.stringify(currentRequest.response, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
