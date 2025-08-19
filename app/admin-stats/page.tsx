'use client';

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { pulsechainApi } from '@/services';
import { fetchDexScreenerData, search } from '@/services/pulsechainService';

type TransferItem = {
  timestamp?: string;
  from?: { hash?: string };
  to?: { hash?: string };
  total?: { value?: string; decimals?: string };
};

type HoldersPage = {
  items: Array<{ address: { hash: string }, value: string }>;
  next_page_params?: Record<string, string>;
};

const DEAD_ADDRESS = '0x000000000000000000000000000000000000dead';

export default function AdminStatsPage(): JSX.Element {
  const [tokenAddress, setTokenAddress] = useState<string>('0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e');
  const [searchInput, setSearchInput] = useState<string>('0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e');
  const [searchResults, setSearchResults] = useState<unknown[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, unknown>>({});
  const [statResult, setStatResult] = useState<Record<string, unknown>>({});
  const [busyStat, setBusyStat] = useState<string | null>(null);
  const [currentRequest, setCurrentRequest] = useState<{
    statId: string;
    endpoint: string;
    params: Record<string, any>;
    response: any;
    timestamp: Date;
    duration: number;
  } | null>(null);

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
    }, 300); // 300ms debounce

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
      const data: HoldersPage = await fetchJson(url);
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
      const items: TransferItem[] = Array.isArray(data?.items) ? data.items : [];
      if (items.length === 0) break;

      // Keep only those within 24h
      for (const t of items) {
        const ts = t.timestamp ? new Date(t.timestamp) : null;
        if (!ts) continue;
        if (ts.toISOString() >= cutoff24hIso) {
          out.push(t);
        }
      }

      // If the last item is older than 24h, we can stop
      const lastTs = items[items.length - 1]?.timestamp;
      if (lastTs && new Date(lastTs).toISOString() < cutoff24hIso) break;

      if (!data?.next_page_params) break;
      nextParams = data.next_page_params as Record<string, string>;
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
      const items: TransferItem[] = Array.isArray(data?.items) ? data.items : [];
      if (items.length === 0) break;

      out.push(...items);

      const lastTs = items[items.length - 1]?.timestamp;
      if (lastTs && new Date(lastTs).toISOString() < cutoffIso) {
        console.log(`Stopping fetch, last timestamp (${lastTs}) is older than cutoff (${cutoffIso})`);
        break;
      }

      if (!data?.next_page_params) break;
      nextParams = data.next_page_params as Record<string, string>;
    }

    // Filter out transfers that are older than the cutoff, as the last page might contain them
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
      const items: TransferItem[] = Array.isArray(data?.items) ? data.items : [];
      if (items.length === 0) break;

      out.push(...items);

      if (!data?.next_page_params) break;
      nextParams = data.next_page_params as Record<string, string>;
    }
    return out;
  }, []);

  // DEPRECATED: Local getDex function is replaced by the centralized fetchDexScreenerData

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
  }, [cache.addressCounters, cache.addressInfo, cache.tokenCounters, cache.tokenInfo, pulsechainApi, tokenAddress]);

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
    // Use the centralized fetchDexScreenerData function to ensure consistency with the ai-agent page.
    const dexResult = await fetchDexScreenerData(tokenAddress);
    const dex = dexResult?.raw; // Use the raw response which contains the .pairs array
    setCache(prev => ({ ...prev, dex }));
    return dex;
  }, [cache.dex, tokenAddress]);

  const runTests = useCallback(async () => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      setError('Enter a valid token address');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResults({});
    try {
      const [tokenInfoRes, tokenCountersRes, addressInfoRes] = await Promise.all([
        pulsechainApi.getTokenInfo(tokenAddress),
        pulsechainApi.getTokenCounters(tokenAddress),
        pulsechainApi.getAddressInfo(tokenAddress),
      ]);

      const decimals = Number(tokenInfoRes.data?.decimals ?? 18);
      const totalSupply = Number(tokenInfoRes.data?.total_supply ?? 0);

      // Holders distribution (paginate)
      const holders = await getHoldersPaged(tokenAddress, 200);
      const sortDesc = [...holders].sort((a, b) => Number(b.value) - Number(a.value));
      const sumTop = (n: number) => sortDesc.slice(0, n).reduce((s, x) => s + Number(x.value), 0);
      const pct = (n: number) => (totalSupply ? (sumTop(n) / totalSupply) * 100 : 0);
      const top1Pct = pct(1);
      const top10Pct = pct(10);
      const top20Pct = pct(20);
      const top50Pct = pct(50);
      const onePctThreshold = totalSupply * 0.01;
      const whaleCount1Pct = sortDesc.filter(h => Number(h.value) >= onePctThreshold).length;
      const burnedTotal = sortDesc.find(h => h.hash.toLowerCase() === DEAD_ADDRESS)?.value || '0';

      // 24h transfers
      const transfers24h = await getTransfers24h(tokenAddress, 100);
      const values = transfers24h.map(t => Number(t.total?.value || 0));
      const count24h = transfers24h.length;
      const uniqueSenders24h = new Set(transfers24h.map(t => (t.from?.hash || '').toLowerCase())).size;
      const uniqueReceivers24h = new Set(transfers24h.map(t => (t.to?.hash || '').toLowerCase())).size;
      const avgTransferValue24h = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      const medianTransferValue24h = values.length ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] : 0;
      const burned24h = transfers24h
        .filter(t => (t.to?.hash || '').toLowerCase() === DEAD_ADDRESS)
        .reduce((s, t) => s + Number(t.total?.value || 0), 0);

      // Heuristic minted24h: transfers sent by contract address
      const minted24h = transfers24h
        .filter(t => (t.from?.hash || '').toLowerCase() === tokenAddress.toLowerCase())
        .reduce((s, t) => s + Number(t.total?.value || 0), 0);

      // Compose results
      setResults({
        core: {
          name: tokenInfoRes.data?.name,
          symbol: tokenInfoRes.data?.symbol,
          decimals,
          totalSupply,
          holders: Number(tokenCountersRes.data?.token_holders_count ?? tokenInfoRes.data?.holders ?? 0),
          transfersTotal: Number(tokenCountersRes.data?.transfers_count ?? 0),
          verified: !!addressInfoRes.data?.is_verified,
          creator: null, // creator_address_hash not available in current API
          creationTx: null, // creation_tx_hash not available in current API
        },
        holders: {
          top1Pct,
          top10Pct,
          top20Pct,
          top50Pct,
          whaleCount1Pct,
          burnedTotalRaw: burnedTotal,
          burnedTotalFormatted: decimals ? Number(burnedTotal) / Math.pow(10, decimals) : Number(burnedTotal),
        },
        activity24h: {
          transfers24h: count24h,
          uniqueSenders24h,
          uniqueReceivers24h,
          avgTransferValue24h,
          medianTransferValue24h,
          burned24h,
          minted24h,
        },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [getHoldersPaged, getTransfers24h, tokenAddress]);

  const statCategories: Array<{ title: string; stats: Array<{ id: string; label: string; run: () => Promise<any> }> }> = useMemo(() => {
    return [
      {
        title: 'Token Supply',
        stats: [
          { id: 'totalSupply', label: 'Total Supply', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const raw = Number(tokenInfo?.total_supply ?? 0);
        const decimals = Number(tokenInfo?.decimals ?? 18);
        return {
          raw,
          formatted: formatTokenAmount2(raw, decimals),
          decimals
        };
      } },
          { id: 'holders', label: 'Total Holders', run: async () => {
        const count = Number((await ensureCoreCaches()).tokenCounters?.token_holders_count ?? (await ensureCoreCaches()).tokenInfo?.holders ?? 0);
        return {
          raw: count,
          formatted: formatNumber2(count)
        };
      } },
          { id: 'burnedTotal', label: 'Total Burned', run: async () => {
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
      { id: 'burned24h', label: 'burned24h', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const totalSupply = Number(tokenInfo?.total_supply ?? 0);
        const sum = (await ensureTransfers24h())
          .filter(t => (t.to?.hash || '').toLowerCase() === DEAD_ADDRESS)
          .reduce((s, t) => s + Number(t.total?.value || 0), 0);
        const pct = totalSupply ? (sum / totalSupply) * 100 : 0;
        const decimals = Number(tokenInfo?.decimals ?? 18);
        return { raw: sum, formatted: formatTokenAmount2(sum, decimals), percent: pct, percentFormatted: formatPct2(pct) };
      } },
      { id: 'minted24h', label: 'Minted (24h)', run: async () => {
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
        ]
      },
      {
        title: 'Holder Distribution',
        stats: [
          { id: 'top1Pct', label: 'Top 1% Holdings', run: async () => {
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
      { id: 'top10Pct', label: 'top10Pct', run: async () => {
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
      { id: 'top20Pct', label: 'top20Pct', run: async () => {
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
      { id: 'top50Pct', label: 'top50Pct', run: async () => {
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
      { id: 'whaleCount1Pct', label: 'whaleCount1Pct', run: async () => {
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
      { id: 'top50Holders', label: 'Top 50 Holders', run: async () => {
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
      { id: 'newVsLostHolders7d', label: 'New vs Lost Holders (7d)', run: async () => {
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
      { id: 'giniCoefficient', label: 'Gini Coefficient (Holder Inequality)', run: async () => {
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
      { id: 'avgHolderBalance', label: 'Average Holder Balance', run: async () => {
        const { tokenInfo, tokenCounters } = await ensureCoreCaches();
        const holders = await ensureHolders();
        const dead = holders.find(h => h.hash.toLowerCase() === DEAD_ADDRESS)?.value || '0';
        const circulatingSupply = Number(tokenInfo.total_supply) - Number(dead);
        const holderCount = Number(tokenCounters?.token_holders_count ?? 0);

        if (holderCount === 0) return 0;

        const avgBalance = circulatingSupply / holderCount;
        return formatTokenAmount2(avgBalance, Number(tokenInfo.decimals));
      }},
      { id: 'newVsLostHolders1d', label: 'New vs Lost Holders (1d)', run: async () => {
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
      { id: 'newVsLostHolders30d', label: 'New vs Lost Holders (30d)', run: async () => {
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
      { id: 'newVsLostHolders90d', label: 'New vs Lost Holders (90d)', run: async () => {
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
          { id: 'blueChipPairRatio', label: 'Blue Chip Pair Ratio', run: async () => {
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
      { id: 'diamondHandsScore', label: 'Diamond Hands Score (90/180d)', run: async () => {
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
      { id: 'topHolderBalanceChange7d', label: 'Top 10 Holder Change (7d)', run: async () => {
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
      { id: 'avgBuySellSize24h', label: 'Avg Buy/Sell Size (24h)', run: async () => {
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
      { id: 'contractAgeInDays', label: 'Contract Age (Days)', run: async () => {
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
      { id: 'liquidityConcentration', label: 'Liquidity Concentration', run: async () => {
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
      { id: 'dexDiversityScore', label: 'DEX Diversity Score', run: async () => {
        const dex = await ensureDex();
        const pairs = dex?.pairs || [];
        const dexIds = new Set(pairs.map(p => p.dexId));
        return {
          score: dexIds.size,
          dexs: Array.from(dexIds),
        };
      }},
      { id: 'holderToLiquidityRatio', label: 'Holder-to-Liquidity Ratio', run: async () => {
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
      { id: 'definitiveTotalLiquidity', label: 'Definitive Total Liquidity', run: async () => {
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
      { id: 'liquidityDepth', label: 'Liquidity Depth & Slippage', run: async () => {
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
      { id: 'lp_holder_analysis', label: 'LP Holder Analysis', run: async () => {
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
          { id: 'ownershipStatus', label: 'Ownership Status', run: async () => {
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
        ]
      },
      {
        title: 'On-Chain Activity',
        stats: [
          { id: 'transfersTotal', label: 'Total Transfers', run: async () => {
        const count = Number((await ensureCoreCaches()).tokenCounters?.transfers_count ?? 0);
        return {
          raw: count,
          formatted: formatNumber2(count)
        };
      } },
      { id: 'transfers24h', label: 'transfers24h', run: async () => {
        const count = (await ensureTransfers24h()).length;
        return {
          raw: count,
          formatted: formatNumber2(count)
        };
      } },
      { id: 'uniqueSenders24h', label: 'uniqueSenders24h', run: async () => {
        const count = new Set((await ensureTransfers24h()).map(t => (t.from?.hash || '').toLowerCase())).size;
        return {
          raw: count,
          formatted: formatNumber2(count)
        };
      } },
      { id: 'uniqueReceivers24h', label: 'uniqueReceivers24h', run: async () => {
        const count = new Set((await ensureTransfers24h()).map(t => (t.to?.hash || '').toLowerCase())).size;
        return {
          raw: count,
          formatted: formatNumber2(count)
        };
      } },
      { id: 'avgTransferValue24h', label: 'avgTransferValue24h', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const decimals = Number(tokenInfo?.decimals ?? 18);
        const vals = (await ensureTransfers24h()).map(t => Number(t.total?.value || 0));
        const avg = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
        return {
          raw: avg,
          formatted: formatTokenAmount2(avg, decimals)
        };
      } },
      { id: 'medianTransferValue24h', label: 'medianTransferValue24h', run: async () => {
        const { tokenInfo } = await ensureCoreCaches();
        const decimals = Number(tokenInfo?.decimals ?? 18);
        const vals = (await ensureTransfers24h()).map(t => Number(t.total?.value || 0)).sort((a,b)=>a-b);
        const median = vals.length ? vals[Math.floor(vals.length/2)] : 0;
        return {
          raw: median,
          formatted: formatTokenAmount2(median, decimals)
        };
      } },

      // Price/market (DEXScreener)
      { id: 'priceUsd', label: 'priceUsd', run: async () => (await ensureDex()).pairs?.[0]?.priceUsd },
      { id: 'priceNative', label: 'priceNative', run: async () => (await ensureDex()).pairs?.[0]?.priceNative },
      { id: 'priceChange6h', label: 'priceChange6h', run: async () => (await ensureDex()).pairs?.[0]?.priceChange?.h6 },
      { id: 'priceChange24h', label: 'priceChange24h', run: async () => (await ensureDex()).pairs?.[0]?.priceChange?.h24 },
      { id: 'volume1h', label: 'volume1h', run: async () => (await ensureDex()).pairs?.[0]?.volume?.h1 },
      { id: 'volume6h', label: 'volume6h', run: async () => (await ensureDex()).pairs?.[0]?.volume?.h6 },
      { id: 'volume24h', label: 'volume24h', run: async () => (await ensureDex()).pairs?.[0]?.volume?.h24 },
      { id: 'liquidityUsd', label: 'liquidityUsd', run: async () => {
        const dex = await ensureDex();
        const p = dex?.pairs?.[0];
        const usd = Number(p?.liquidity?.usd || 0);
        const pair = p ? `${p.baseToken?.symbol}/${p.quoteToken?.symbol}` : null;
        return { usd, usdFormatted: formatNumber2(usd), pair };
      } },
      { id: 'totalLiquidityUsd', label: 'Total Liquidity (USD)', run: async () => {
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
      { id: 'totalTokensInLiquidity', label: 'Total Tokens in Liquidity', run: async () => {
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
      { id: 'fdv', label: 'fdv', run: async () => (await ensureDex()).pairs?.[0]?.fdv },
      { id: 'marketCap', label: 'marketCap', run: async () => (await ensureDex()).pairs?.[0]?.marketCap },
      { id: 'trades24hBuys', label: 'trades24hBuys', run: async () => (await ensureDex()).pairs?.[0]?.txns?.h24?.buys },
      { id: 'trades24hSells', label: 'trades24hSells', run: async () => (await ensureDex()).pairs?.[0]?.txns?.h24?.sells },
      { id: 'buySellRatio24h', label: 'buySellRatio24h', run: async () => {
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
      { id: 'pairCount', label: 'pairCount', run: async () => ((await ensureDex()).pairs || []).length },
      { id: 'mainPairDex', label: 'mainPairDex', run: async () => (await ensureDex()).pairs?.[0]?.dexId },
      { id: 'mainPairAddress', label: 'mainPairAddress', run: async () => (await ensureDex()).pairs?.[0]?.pairAddress },

      // All Liquidity Pools
      { id: 'allPools', label: 'All Liquidity Pools', run: async () => {
        const dex = await ensureDex();
        const pairs = dex?.pairs || [];
        // Sort by liquidity
        const sorted = [...pairs].sort((a, b) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0));
        return sorted;
      }},

      // Contract/address
      { id: 'contractVerified', label: 'contractVerified', run: async () => !!(await ensureCoreCaches()).addressInfo?.is_verified },
      { id: 'creatorAddress', label: 'creatorAddress', run: async () => (await ensureCoreCaches()).addressInfo?.creator_address_hash },
      { id: 'creationTxHash', label: 'creationTxHash', run: async () => (await ensureCoreCaches()).addressInfo?.creation_tx_hash },
      { id: 'creationDate', label: 'Creation Date', run: async () => {
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
      { id: 'transactionsCount', label: 'transactionsCount', run: async () => Number((await ensureCoreCaches()).addressCounters?.transactions_count || 0) },
      { id: 'tokenTransfersCount', label: 'tokenTransfersCount', run: async () => Number((await ensureCoreCaches()).addressCounters?.token_transfers_count || 0) },
      { id: 'gasUsageCount', label: 'gasUsageCount', run: async () => Number((await ensureCoreCaches()).addressCounters?.gas_usage_count || 0) },
      { id: 'validationsCount', label: 'Validations Count', run: async () => Number((await ensureCoreCaches()).addressCounters?.validations_count || 0) },
          { id: 'firstPageTxs', label: '1st Page Transactions', run: async () => {
            const data = await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${tokenAddress}/transactions`);
            return data?.items || [];
          }},
          { id: 'firstPageTransfers', label: '1st Page Transfers', run: async () => {
            const data = await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddress}/transfers`);
            return data?.items || [];
          }},
          { id: 'firstPageInternalTxs', label: '1st Page Internal Txs', run: async () => {
            const data = await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${tokenAddress}/internal-transactions`);
            return data?.items || [];
          }},
          { id: 'transactionVelocity', label: 'Transaction Velocity (24h)', run: async () => {
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
          { id: 'address', label: 'Token Address', run: async () => tokenAddress },
      { id: 'symbol', label: 'symbol', run: async () => (await ensureCoreCaches()).tokenInfo?.symbol },
      { id: 'name', label: 'name', run: async () => (await ensureCoreCaches()).tokenInfo?.name },
      { id: 'iconUrl', label: 'Icon URL', run: async () => (await ensureDex()).pairs?.[0]?.info?.imageUrl || (await ensureCoreCaches()).tokenInfo?.icon_url },
          { id: 'abiComplexity', label: 'ABI Complexity Score', run: async () => {
            const { addressInfo } = await ensureCoreCaches();
            const contract = await fetchJson(`https://api.scan.pulsechain.com/api/v2/smart-contracts/${addressInfo.creator_address_hash}`);
            const abi = contract?.abi || [];
            return abi.filter((item: unknown) => (item as { type: string }).type === 'function').length;
          }},
        ]
      }
    ];
  }, [ensureCoreCaches, ensureDex, ensureHolders, ensureTransfers24h, tokenAddress]);

  const runOneStat = useCallback(async (id: string) => {
    const item = statCategories.flatMap(c => c.stats).find(s => s.id === id);
    if (!item) return;
    
    setBusyStat(id);
    const startTime = Date.now();
    
    try {
      // Determine the endpoint type based on the stat ID
      let endpoint = 'Custom Stat Function';
      let params = { statId: id, label: item.label };
      
      if (id.includes('holders') || id.includes('Holders')) {
        endpoint = 'PulseChain Scan API - Holders';
        params = { ...params, endpoint: `/api/v2/tokens/{address}/holders` };
      } else if (id.includes('transfers') || id.includes('Transfers')) {
        endpoint = 'PulseChain Scan API - Transfers';
        params = { ...params, endpoint: `/api/v2/tokens/{address}/transfers` };
      } else if (id.includes('dex') || id.includes('liquidity') || id.includes('Liquidity')) {
        endpoint = 'DexScreener API';
        params = { ...params, endpoint: 'https://api.dexscreener.com/latest/dex/tokens/{address}' };
      } else if (id.includes('token') || id.includes('Token')) {
        endpoint = 'PulseChain Scan API - Token Info';
        params = { ...params, endpoint: `/api/v2/tokens/{address}` };
      } else if (id.includes('address') || id.includes('Address')) {
        endpoint = 'PulseChain Scan API - Address Info';
        params = { ...params, endpoint: `/api/v2/addresses/{address}` };
      }
      
      // Track the request details
      const requestInfo = {
        statId: id,
        endpoint: endpoint,
        params: params,
        response: null,
        timestamp: new Date(),
        duration: 0
      };
      
      setCurrentRequest(requestInfo);
      
      const value = await item.run();
      const duration = Date.now() - startTime;
      
      // Update with response and duration
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
        endpoint: 'Custom Stat Function',
        params: { statId: id, label: item.label, error: (e as Error).message },
        response: errorResponse,
        timestamp: new Date(),
        duration
      });
      
      setStatResult(prev => ({ ...prev, [id]: errorResponse }));
    } finally {
      setBusyStat(null);
    }
  }, [statCategories]);

  const clearOneStat = useCallback((id: string) => {
    setStatResult(prev => {
      const newResults = { ...prev };
      delete newResults[id];
      return newResults;
    });
  }, []);

  const clearCurrentRequest = useCallback(() => {
    setCurrentRequest(null);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Admin Stats Test</h1>
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <label htmlFor="token" className="text-sm text-slate-300">Token Address or Ticker</label>
          <div className="relative">
            <input
              id="token"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
              placeholder="Search by address, ticker, or name..."
            />
            {isSearching && <div className="absolute top-full mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-slate-400">Searching...</div>}
            {searchResults.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg z-10">
                {searchResults.map(item => (
                  <div 
                    key={item.address}
                    className="p-2 hover:bg-slate-700 cursor-pointer text-sm"
                    onClick={() => {
                      setTokenAddress(item.address);
                      setSearchInput(item.address);
                      setSearchResults([]);
                    }}
                  >
                    {item.name} ({item.symbol})
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={runTests}
            disabled={isLoading}
            title="Run derived stats test"
            className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold"
          >
            {isLoading ? 'Running...' : 'Run Tests'}
          </button>
          {error && <div className="text-red-400 text-sm">{error}</div>}
        </div>

        {Object.keys(results).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <h2 className="font-semibold mb-2">Core</h2>
              <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(results.core, null, 2)}</pre>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <h2 className="font-semibold mb-2">Holders</h2>
              <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(results.holders, null, 2)}</pre>
            </div>
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <h2 className="font-semibold mb-2">Activity (24h)</h2>
              <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(results.activity24h, null, 2)}</pre>
            </div>
          </div>
        )}

        {/* Request Display Section */}
        {currentRequest && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg text-white">Current Request Details</h2>
              <button
                onClick={clearCurrentRequest}
                title="Clear request display"
                className="text-xs px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-white"
              >
                Clear
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Request Info */}
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-slate-400 mb-1">Stat ID</div>
                  <div className="text-white font-mono text-sm bg-slate-800 px-2 py-1 rounded">
                    {currentRequest.statId}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-slate-400 mb-1">Endpoint</div>
                  <div className="text-white font-mono text-sm bg-slate-800 px-2 py-1 rounded">
                    {currentRequest.endpoint}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-slate-400 mb-1">Parameters</div>
                  <div className="text-white font-mono text-sm bg-slate-800 px-2 py-1 rounded">
                    <pre className="whitespace-pre-wrap text-xs">
                      {JSON.stringify(currentRequest.params, null, 2)}
                    </pre>
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-slate-400 mb-1">Timestamp</div>
                  <div className="text-white font-mono text-sm bg-slate-800 px-2 py-1 rounded">
                    {currentRequest.timestamp.toLocaleString()}
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-slate-400 mb-1">Duration</div>
                  <div className="text-white font-mono text-sm bg-slate-800 px-2 py-1 rounded">
                    {currentRequest.duration}ms
                  </div>
                </div>
              </div>
              
              {/* Response */}
              <div>
                <div className="text-sm text-slate-400 mb-1">Response</div>
                <div className="text-white font-mono text-sm bg-slate-800 px-2 py-1 rounded max-h-64 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-xs">
                    {JSON.stringify(currentRequest.response, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Per-stat test harness */}
        <div className="space-y-6">
          {statCategories.map(category => (
            <div key={category.title} className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <h2 className="font-semibold mb-3 text-lg">{category.title}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {category.stats.map(sa => (
                  <div key={sa.id} className="border border-slate-800 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-slate-200">{sa.label}</div>
                      <div className="flex items-center gap-1">
                        {sa.id in statResult && (
                          <button
                            onClick={() => clearOneStat(sa.id)}
                            title="Clear result"
                            className="text-xs px-2 py-1 bg-red-800 hover:bg-red-700 rounded"
                          >
                            Clear
                          </button>
                        )}
                        <button
                          onClick={() => runOneStat(sa.id)}
                          disabled={busyStat === sa.id}
                          title={`Test ${sa.label}`}
                          className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded"
                        >
                          {busyStat === sa.id ? 'Running…' : 'Test'}
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-300 break-words">
                      {sa.id in statResult ? (
                        <pre className="whitespace-pre-wrap">{JSON.stringify(statResult[sa.id], null, 2)}</pre>
                      ) : (
                        <span className="text-slate-500">No result yet</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

