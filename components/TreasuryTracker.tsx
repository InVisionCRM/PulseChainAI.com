"use client";

import React, { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const ETHERSCAN_API_KEY = "5NIDMGWB2UYP7S88YWVR65JMB5ZVPD5W9U";

// -----------------------------
// In-memory API response cache
// -----------------------------
type CachedEntry = { timestamp: number; data: any };
const API_CACHE: Map<string, CachedEntry> = (globalThis as any).__TREASURY_API_CACHE__ || new Map<string, CachedEntry>();
(globalThis as any).__TREASURY_API_CACHE__ = API_CACHE;

const getCached = (key: string, ttlMs: number): any | null => {
  const entry = API_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) {
    API_CACHE.delete(key);
    return null;
  }
  return entry.data;
};

const setCached = (key: string, data: any) => {
  API_CACHE.set(key, { timestamp: Date.now(), data });
};

const getCacheTimestamp = (key: string): number | null => {
  const entry = API_CACHE.get(key);
  return entry ? entry.timestamp : null;
};

const TREASURY_ADDRESSES: string[] = [
  "0xB17c443c89B0c18e53B6E25aE55297e122B30E5c",
  "0xbFc9C5878245fb9FE49c688a9c554cBA1FAE71fA",
  "0x20fCB7b4E103EC482645E15715c8a2E7a437FBD6",
  "0xB628441794Cd41484BE092B3b5f4b2f7271eb60",
  "0x7bE74346Dc745EA110358810924C9088BC76Db59",
  "0x1a73652bFAdc26C632aE21F52AacbCBdb396d659",
  "0xc0658166531c5618e605566eaa97697047fCF559",
  "0xB727d70c04520FA68aE5802859487317496b4F99",
  "0x04652660148bfA25F660A1a78a3401821f5B541e",
  "0xa99682f323379F788Bc4F004CF0a135ff1e22bD7",
  "0x7C90b72Da9344980bF31B20c4b4ab31f026bC54e",
  "0xe6F9aA98e85c703B37e8d9AfEaf2f464750E063",
  "0x63f97aD9fA0d4e8ca5Bb2F21334366806f802547",
  "0xc83DEeAD548E132Cd1a0464D02e2DE128BA75f9b",
  "0xb928a97E5Ecd27C668cc370939C8f62f93DE54fa",
  "0x33cF90c54b777018CB5d7f7f6f30e73235a61c78",
  "0xF8086ee4A78Ab88640EAFB107aE7BC9Ac64C35EC",
  "0x4BB20207BAA8688904F0C35147F19B61ddc16FD0",
  "0xc2301960fFEA687f169E803826f457Bc0263E39c",
  "0xb8691E71F40aB9A6abbdeCe20fABC8C7521Cd43",
  "0xaB203F75546C0f2905D71351f0436eFEFA440daC",
  "0x1B7BAa734C00298b9429b518D621753Bb0fefF2",
  "0xc3B7f26d6C64024D5269DB60cEFCC3807ef31C1f",
  "0x13c808Af0281c18a89e8438317c66Db9645E8662",
  "0x9320249FD87CD011Acf1E3b269180B74cDD3519E",
  "0x0083d744c0949AD9091f236f332F7b17e69c03ee",
  "0x0e8Eb2232Fc3fB0c10756cD65D7052987D6316f4",
  "0xFE19b054F7B0cb7F4c051372AB2bD799472583CC",
  "0x293bf003350f068698036d63eEec322B7F437eEE",
];

const fetchJson = async (url: string, cacheMode: RequestCache = "default"): Promise<any> => {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: cacheMode,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (err) {
    // Retry with minimal request to avoid any CORS/preflight issues
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
};

const fetchETHPrice = async (): Promise<number> => {
  try {
    const key = "price_eth_usd";
    const cached = getCached(key, 60 * 1000);
    if (cached) return cached as number;
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { cache: "force-cache" }
    );
    if (response.ok) {
      const data = await response.json();
      const price = data.ethereum?.usd || 0;
      setCached(key, price);
      return price;
    }
  } catch {}
  try {
    const key2 = "price_eth_usd_dexscreener";
    const cached2 = getCached(key2, 60 * 1000);
    if (cached2) return cached2 as number;
    const res = await fetch(
      "https://api.dexscreener.com/latest/dex/tokens/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      { cache: "force-cache" }
    );
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.pairs) && json.pairs.length > 0) {
        const pair = json.pairs.find(
          (p: any) => p.priceUsd && parseFloat(p.priceUsd) > 1000 && parseFloat(p.priceUsd) < 10000
        );
        if (pair) {
          const price = parseFloat(pair.priceUsd);
          setCached(key2, price);
          return price;
        }
      }
    }
  } catch {}
  return 3000;
};

const fetchMultiWalletBalances = async (
  addresses: string[]
): Promise<Record<string, number>> => {
  const chunkSize = 20;
  const chunks: string[][] = [];
  for (let i = 0; i < addresses.length; i += chunkSize) {
    chunks.push(addresses.slice(i, i + chunkSize));
  }
  const results: Record<string, number> = {};
  for (const chunk of chunks) {
    const addressParam = chunk.join(",");
    const url = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=balancemulti&address=${addressParam}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
    try {
      const cacheKey = `balancemulti_${addressParam}`;
      const cached = getCached(cacheKey, 2 * 60 * 1000);
      const data = cached ?? (await fetchJson(url, "force-cache"));
      if (!cached) setCached(cacheKey, data);
      if (data && data.status === "1" && Array.isArray(data.result)) {
        for (const item of data.result) {
          const acct: string = (item.account || item.address || "").toLowerCase();
          const wei: string = item.balance || "0";
          const eth = parseFloat(wei) / Math.pow(10, 18);
          results[acct] = eth;
        }
      }
    } catch {}
  }
  return results;
};

const fetchTransactions = async (address: string, page: number = 1): Promise<{ transactions: any[], total: number, hasMore: boolean }> => {
  try {
    const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=${page}&offset=25&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
    const cacheKey = `txlist_${address}_${page}`;
    const cached = getCached(cacheKey, 2 * 60 * 1000);
    const data = cached ?? (await fetchJson(url, "force-cache"));
    if (!cached) setCached(cacheKey, data);
    if (data && data.status === "1" && Array.isArray(data.result)) {
      const hasMore = data.result.length === 25;
      return { transactions: data.result, total: data.result.length, hasMore };
    }
  } catch (error) {
    console.error('Error in fetchTransactions:', error);
  }
  return { transactions: [], total: 0, hasMore: false };
};

const fetchTokenTransfers = async (address: string, page: number = 1): Promise<{ transfers: any[], total: number, hasMore: boolean }> => {
  try {
    // Temporarily bypass blob storage until environment is configured
    const url = `https://api.etherscan.io/api?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&page=${page}&offset=25&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
    const cacheKey = `tokentx_${address}_${page}`;
    const cached = getCached(cacheKey, 2 * 60 * 1000);
    const data = cached ?? (await fetchJson(url, "force-cache"));
    if (!cached) setCached(cacheKey, data);
    if (data && data.status === "1" && Array.isArray(data.result)) {
      const hasMore = data.result.length === 25;
      return { transfers: data.result, total: data.result.length, hasMore };
    }
  } catch {}
  return { transfers: [], total: 0, hasMore: false };
};

const fetchInternalTransactions = async (address: string, page: number = 1): Promise<{ internalTransactions: any[], total: number, hasMore: boolean }> => {
  try {
    const url = `https://api.etherscan.io/api?module=account&action=txlistinternal&address=${address}&startblock=0&endblock=99999999&page=${page}&offset=25&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
    const cacheKey = `txlistinternal_${address}_${page}`;
    const cached = getCached(cacheKey, 2 * 60 * 1000);
    const data = cached ?? (await fetchJson(url, "force-cache"));
    if (!cached) setCached(cacheKey, data);
    
    if (data && data.status === "1" && Array.isArray(data.result)) {
      const hasMore = data.result.length === 25;
      return { internalTransactions: data.result, total: data.result.length, hasMore };
    } else if (data && data.status === "0") {
      const altUrl = `https://api.etherscan.io/api?module=account&action=txlistinternal&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
      const altCacheKey = `txlistinternal_alt_${address}`;
      const cachedAlt = getCached(altCacheKey, 2 * 60 * 1000);
      const altData = cachedAlt ?? (await fetchJson(altUrl, "force-cache"));
      if (!cachedAlt) setCached(altCacheKey, altData);
      
      if (altData && altData.status === "1" && Array.isArray(altData.result)) {
        const hasMore = altData.result.length === 25;
        return { internalTransactions: altData.result.slice(0, 25), total: altData.result.length, hasMore };
      }
    }
  } catch (error) {
    console.error('Error fetching internal transactions:', error);
  }
  return { internalTransactions: [], total: 0, hasMore: false };
};

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(parseInt(timestamp) * 1000);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

const formatETHValue = (value: string): string => {
  const eth = parseFloat(value) / Math.pow(10, 18);
  return eth.toFixed(4);
};

const truncateAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Known contract addresses and their names
const KNOWN_CONTRACTS: Record<string, string> = {
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2 Router',
  '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3 Router',
  '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9': 'Aave Lending Pool',
  '0xba12222222228d8ba445958a75a0704d566bf2c8': 'Balancer Vault',
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff': '0x Protocol',
  '0x1111111254fb6c44bac0bed2854e76f90643097d': '1inch Router',
  '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0': 'Wrapped Staked ETH',
  '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': 'Lido Staked ETH',
  '0xae78736cd615f374d3085123a210448e74fc6393': 'Rocket Pool ETH',
  '0x5f98805a4e8be255a32880fdec7f6728c6568ba0': 'LUSD Stablecoin',
  '0x6b175474e89094c44da98b954eedeac495271d0f': 'DAI Stablecoin',
  '0xa0b86a33e6441b8c4b8c0c8c0c8c0c8c0c8c0c8': 'CoW Protocol',
  '0x9008d19f58aabd9ed0d60971565aa8510560ab41': 'CoW Protocol: GPv2Settlement',
};

const getContractName = (address: string): string | null => {
  return KNOWN_CONTRACTS[address.toLowerCase()] || null;
};

// Get accurate transaction count for an address
const getTransactionCount = async (address: string): Promise<number> => {
  try {
    const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
    const data = await fetchJson(url);
    if (data && data.status === "1") {
      // Etherscan returns total count in the message field when using offset=1
      const message = data.message;
      if (message && message.includes('OK')) {
        // Try to extract count from message or use result length
        return data.result?.length || 0;
      }
    }
  } catch {}
  return 0;
};

interface TreasuryEntry {
  address: string;
  balance: number;
  transactions?: any[];
  transfers?: any[];
  internalTransactions?: any[];
  transactionTotal?: number;
  transferTotal?: number;
  internalTotal?: number;
  transactionPage?: number;
  transferPage?: number;
  internalPage?: number;
  transactionHasMore?: boolean;
  transferHasMore?: boolean;
  internalHasMore?: boolean;
  transactionTotalPages?: number;
  transferTotalPages?: number;
  internalTotalPages?: number;
  transactionLastPageSize?: number;
  transferLastPageSize?: number;
  internalLastPageSize?: number;
  transactionUpdatedAt?: number;
  transferUpdatedAt?: number;
  internalUpdatedAt?: number;
}

const TreasuryTracker: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [totalEth, setTotalEth] = useState<number>(0);
  const [totalUsd, setTotalUsd] = useState<number>(0);
  const [treasuryData, setTreasuryData] = useState<TreasuryEntry[]>([]);
  const [loadingAddressData, setLoadingAddressData] = useState<Record<string, boolean>>({});
  const [currentPages, setCurrentPages] = useState<Record<string, { transactions: number, transfers: number, internal: number }>>({});
  const [expandedAddress, setExpandedAddress] = useState<string | undefined>(undefined);
  const [addressTabs, setAddressTabs] = useState<Record<string, string>>({});
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [detailType, setDetailType] = useState<'transactions' | 'transfers' | 'internal' | null>(null);
  const [detailData, setDetailData] = useState<any>(null);

  const loadAddressData = async (address: string, page: number = 1, type: 'transactions' | 'transfers' | 'internal' = 'transactions') => {
    const existingEntry = treasuryData.find(entry => entry.address === address);
    
    // Initialize page tracking for this address if not exists
    if (!currentPages[address]) {
      setCurrentPages(prev => ({ ...prev, [address]: { transactions: 1, transfers: 1, internal: 1 } }));
    }
    
    setLoadingAddressData(prev => ({ ...prev, [address]: true }));
    
    try {
      let data:
        | { transactions: any[]; total: number; hasMore: boolean }
        | { transfers: any[]; total: number; hasMore: boolean }
        | { internalTransactions: any[]; total: number; hasMore: boolean };
      if (type === 'transactions') {
        const transactionData = await fetchTransactions(address, page);
        setTreasuryData(prev => prev.map(entry => 
          entry.address === address 
            ? {
                ...entry,
                transactions: transactionData.transactions,
                transactionTotal: transactionData.total,
                transactionPage: page,
                transactionHasMore: transactionData.hasMore,
              }
            : entry
        ));
        setCurrentPages(prev => ({ ...prev, [address]: { ...prev[address], transactions: page } }));
      } else if (type === 'transfers') {
        const transferData = await fetchTokenTransfers(address, page);
        setTreasuryData(prev => prev.map(entry => 
          entry.address === address 
            ? {
                ...entry,
                transfers: transferData.transfers,
                transferTotal: transferData.total,
                transferPage: page,
                transferHasMore: transferData.hasMore,
              }
            : entry
        ));
        setCurrentPages(prev => ({ ...prev, [address]: { ...prev[address], transfers: page } }));
      } else if (type === 'internal') {
        const internalData = await fetchInternalTransactions(address, page);
        setTreasuryData(prev => prev.map(entry => 
          entry.address === address 
            ? {
                ...entry,
                internalTransactions: internalData.internalTransactions,
                internalTotal: internalData.total,
                internalPage: page,
                internalHasMore: internalData.hasMore,
              }
            : entry
        ));
        setCurrentPages(prev => ({ ...prev, [address]: { ...prev[address], internal: page } }));
      }
    } catch (e) {
      console.error(`Failed to load data for ${address}:`, e);
    } finally {
      setLoadingAddressData(prev => ({ ...prev, [address]: false }));
    }
  };

  // Efficient total pages calculation (exponential search + binary search)
  const calculateTotalPages = async (address: string, type: 'transactions' | 'transfers' | 'internal'): Promise<number> => {
    const pageFetch = async (p: number): Promise<number> => {
      if (type === 'transactions') {
        const r = await fetchTransactions(address, p);
        return r.transactions.length;
      }
      if (type === 'transfers') {
        const r = await fetchTokenTransfers(address, p);
        return r.transfers.length;
      }
      const r = await fetchInternalTransactions(address, p);
      return r.internalTransactions.length;
    };

    let lo = 1;
    let hi = 1;
    let len = await pageFetch(1);
    if (len === 0) return 0;
    if (len < 25) return 1;
    // Exponential search to find upper bound
    for (let k = 1; k < 12; k++) { // up to 4096 pages (~102k items) hard cap
      hi = 1 << k;
      try {
        len = await pageFetch(hi);
      } catch {
        break;
      }
      if (len === 0) break;
      lo = hi; // last non-empty page
    }
    // hi could still be non-empty; set a soft cap if needed
    if (len > 0) {
      // try next page to confirm emptiness
      const tryNext = await pageFetch(hi + 1).catch(() => 0);
      if (tryNext > 0) {
        // give up precise count; cap at hi + 1
        return hi + 1;
      }
    }
    // Binary search between lo+1 and hi to find last non-empty
    let left = Math.max(2, lo + 1);
    let right = Math.max(hi, left);
    let lastNonEmpty = lo;
    let lastSize = 25;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const mlen = await pageFetch(mid).catch(() => 0);
      if (mlen > 0) {
        lastNonEmpty = mid;
        lastSize = mlen;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    // store lastSize alongside pages by updating state outside
    return Math.max(1, lastNonEmpty);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [price, balancesMap] = await Promise.all([
          fetchETHPrice(),
          fetchMultiWalletBalances(TREASURY_ADDRESSES),
        ]);
        const sumEth = Object.values(balancesMap).reduce(
          (sum: number, v: number) => sum + (typeof v === "number" ? v : 0),
          0
        );
        
        // Create treasury data array with individual address balances
        const treasuryEntries: TreasuryEntry[] = TREASURY_ADDRESSES.map(address => ({
          address,
          balance: balancesMap[address.toLowerCase()] || 0
        }));
        
        setEthPrice(price);
        setTotalEth(sumEth);
        setTotalUsd(sumEth * price);
        setTreasuryData(treasuryEntries);
      } catch (e) {
        setError("Failed to load treasury balances");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // -----------------------------
  // Persist UI state in localStorage
  // -----------------------------
  useEffect(() => {
    try {
      const pagesRaw = localStorage.getItem('tt_pages');
      const tabsRaw = localStorage.getItem('tt_tabs');
      const exp = localStorage.getItem('tt_expanded');
      if (pagesRaw) setCurrentPages(JSON.parse(pagesRaw));
      if (tabsRaw) setAddressTabs(JSON.parse(tabsRaw));
      if (exp) setExpandedAddress(exp || undefined);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('tt_pages', JSON.stringify(currentPages));
    } catch {}
  }, [currentPages]);

  useEffect(() => {
    try {
      localStorage.setItem('tt_tabs', JSON.stringify(addressTabs));
    } catch {}
  }, [addressTabs]);

  useEffect(() => {
    try {
      localStorage.setItem('tt_expanded', expandedAddress || '');
    } catch {}
  }, [expandedAddress]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <div className="text-gray-700 text-lg font-medium">Loading Treasury…</div>
          <div className="text-gray-500 text-sm mt-1">Fetching balances</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header - DeBank style */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="text-xl font-bold text-gray-900">
                <span className="text-purple-600">Pulse</span>RH
              </div>
              <nav className="hidden md:flex space-x-6">
                <a href="#" className="text-gray-700 hover:text-purple-600 font-medium">Overview</a>
                <a href="#" className="text-gray-700 hover:text-purple-600 font-medium">Treasury</a>
                <a href="#" className="text-gray-700 hover:text-purple-600 font-medium">Addresses</a>
                <a href="#" className="text-gray-700 hover:text-purple-600 font-medium">Activity</a>
                <a href="#" className="text-gray-700 hover:text-purple-600 font-medium">More</a>
              </nav>
            </div>
            
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Profile-like hero */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-8 mb-8 border border-purple-100">
          <div className="flex items-start justify-between">
            {/* Profile Info */}
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  TT
                </div>
                <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-yellow-900 text-xs px-2 py-0.5 rounded-full font-bold">
                  VIP
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl font-bold text-gray-900">Treasury Tracker</h1>
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">ETH</Badge>
                </div>
                <p className="text-gray-600 text-sm">PulseChain Sacrifice Treasury Overview</p>
              </div>
            </div>
            {/* Totals */}
            <div className="text-right">
              <div className="text-4xl font-bold text-gray-900">${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              <div className="text-gray-600 text-sm">{totalEth.toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH</div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-6 mt-8 pt-6 border-t border-purple-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">Ξ</div>
              <div>
                <div className="text-gray-500 text-sm">ETH Price</div>
                <div className="text-lg font-bold text-gray-900">${ethPrice.toLocaleString()}</div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-700 font-bold">$</div>
              <div>
                <div className="text-gray-500 text-sm">Total USD</div>
                <div className="text-lg font-bold text-gray-900">${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs - Treasury only */}
        <Tabs defaultValue="treasury" className="w-full">
          <TabsList className="bg-white border border-gray-200 rounded-lg p-1 mb-8 h-12">
            <TabsTrigger value="treasury" className="data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700 px-6 py-2 rounded-md font-medium">
              Treasury
            </TabsTrigger>
          </TabsList>

        <TabsContent value="treasury">
            {/* Overview Section - Massive ETH Display */}
            <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <h3 className="text-lg font-semibold text-gray-900">Overview</h3>
              </div>
                              <div className="p-12 text-center">
                  <div className="text-8xl font-bold text-gray-900 mb-4 flex items-center justify-center gap-6">
                    <img src="/ethlogo.svg" alt="Ethereum" className="w-20 h-20" />
                    {Math.floor(totalEth).toLocaleString()} ETH
                  </div>
                  <div className="text-4xl text-gray-600">
                    ${Math.floor(totalUsd).toLocaleString()}
                  </div>
                </div>
              {error && (
                <div className="px-6 pb-6 text-sm text-red-600">{error}</div>
              )}
            </Card>

            {/* Addresses Section */}
            <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <h3 className="text-lg font-semibold text-gray-900">All Addresses</h3>
              </div>
              <div className="p-6">
                <Accordion type="single" collapsible className="space-y-4" value={expandedAddress} onValueChange={(v) => setExpandedAddress(v)}>
                  {treasuryData.map((entry, index) => {
                    const ethAmount = Math.floor(entry.balance);
                    const usdValue = Math.floor(entry.balance * ethPrice);
                    return (
                      <AccordionItem key={entry.address} value={entry.address} className="border border-gray-200 rounded-lg">
                        <AccordionTrigger 
                          className="px-4 py-4 hover:no-underline"
                          onClick={async () => {
                            if (!entry.transactions || !entry.transfers || !entry.internalTransactions) {
                              await Promise.all([
                                loadAddressData(entry.address, 1, 'transactions'),
                                loadAddressData(entry.address, 1, 'transfers'),
                                loadAddressData(entry.address, 1, 'internal')
                              ]);
                            }
                          }}
                        >
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center space-x-4">
                              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                {index + 1}
                              </div>
                              <div className="font-mono text-sm text-gray-700">{entry.address}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <img src="/ethlogo.svg" alt="Ethereum" className="w-6 h-6" />
                                {ethAmount.toLocaleString()} ETH
                              </div>
                              <div className="text-gray-600">
                                ${usdValue.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <div className="pt-4 border-t border-gray-200">
                            <Tabs value={addressTabs[entry.address] || 'overview'} onValueChange={(v) => setAddressTabs(prev => ({ ...prev, [entry.address]: v }))} className="w-full">
                              <TabsList className="bg-gray-100 border border-gray-200 rounded-lg p-1 mb-4 h-10">
                                <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 px-4 py-2 rounded-md text-sm font-medium">
                                  Overview
                                </TabsTrigger>
                                <TabsTrigger value="transactions" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 px-4 py-2 rounded-md text-sm font-medium">
                                  Transactions
                                </TabsTrigger>
                                <TabsTrigger value="internal" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 px-4 py-2 rounded-md text-sm font-medium">
                                  Internal
                                </TabsTrigger>
                                <TabsTrigger value="transfers" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 px-4 py-2 rounded-md text-sm font-medium">
                                  Transfers
                                </TabsTrigger>
                                <TabsTrigger value="actions" className="data-[state=active]:bg-white data-[state=active]:text-gray-900 px-4 py-2 rounded-md text-sm font-medium">
                                  Actions
                                </TabsTrigger>
                              </TabsList>
                              
                              <TabsContent value="overview" className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <div className="text-gray-500 text-sm">ETH Balance</div>
                                    <div className="text-2xl font-bold text-gray-900">{ethAmount.toLocaleString()} ETH</div>
                                  </div>
                                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                    <div className="text-gray-500 text-sm">USD Value</div>
                                    <div className="text-2xl font-bold text-gray-900">${usdValue.toLocaleString()}</div>
                                  </div>
                                </div>
                              </TabsContent>
                              
                              <TabsContent value="transactions" className="space-y-4">
                                {loadingAddressData[entry.address] ? (
                                  <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    <span className="ml-3 text-gray-600">Loading transactions...</span>
                                  </div>
                                ) : entry.transactions && entry.transactions.length > 0 ? (
                                  <div>
                                    <div className="flex items-center justify-between mb-4">
                                      <div className="text-sm text-gray-600">
                                        Showing page {(currentPages[entry.address]?.transactions || 1)} of {entry.transactionTotalPages || '…'} · Items {(currentPages[entry.address]?.transactions || 1) > 1 ? ((currentPages[entry.address]?.transactions || 1) - 1) * 25 + 1 : 1} - {((currentPages[entry.address]?.transactions || 1) - 1) * 25 + (entry.transactions?.length || 0)}
                                      </div>
                                      <div className="flex items-center gap-3">
                                        {entry.transactionUpdatedAt && (
                                          <span className="text-xs text-gray-500">Last updated {new Date(entry.transactionUpdatedAt).toLocaleTimeString()}</span>
                                        )}
                                        <Button 
                                          size="sm"
                                          variant="outline"
                                          onClick={() => window.open(`https://etherscan.io/address/${entry.address}#transactions`, '_blank')}
                                          className="text-xs"
                                        >
                                          View All on Etherscan
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                      <div className="overflow-x-auto">
                                        <table className="w-full">
                                          <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Block</th>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction Hash</th>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                            </tr>
                                          </thead>
                                          <tbody className="bg-white divide-y divide-gray-200">
                                            {entry.transactions.map((tx) => {
                                              const isIncoming = tx.to.toLowerCase() === entry.address.toLowerCase();
                                              const ethValue = formatETHValue(tx.value);
                                              const fromContractName = getContractName(tx.from);
                                              const toContractName = getContractName(tx.to);
                                              return (
                                                <tr
                                                  key={tx.hash}
                                                  className="hover:bg-gray-50 cursor-pointer"
                                                  onClick={() => { setDetailType('transactions'); setDetailData(tx); setDetailOpen(true); }}
                                                >
                                                  <td className="px-4 py-3 text-sm text-gray-900">{tx.blockNumber}</td>
                                                  <td className="px-4 py-3 text-sm text-gray-600">{formatTimestamp(tx.timeStamp)}</td>
                                                  <td className="px-4 py-3 text-sm">
                                                    <div className="flex items-center space-x-2">
                                                      <span className="text-green-500">✓</span>
                                                      <span className="font-mono text-gray-900">{truncateAddress(tx.hash)}</span>
                                                      <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => navigator.clipboard.writeText(tx.hash)}
                                                        className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                                                      >
                                                        📋
                                                      </Button>
                                                    </div>
                                                  </td>
                                                  <td className="px-4 py-3 text-sm text-gray-600">{tx.input === '0x' ? 'Transfer' : 'Contract'}</td>
                                                  <td className="px-4 py-3 text-sm">
                                                    <div className="flex flex-col">
                                                      <div className="flex items-center space-x-2">
                                                        <span className="font-mono text-gray-900">{truncateAddress(tx.from)}</span>
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          onClick={() => navigator.clipboard.writeText(tx.from)}
                                                          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                                                        >
                                                          📋
                                                        </Button>
                                                      </div>
                                                      {fromContractName && (
                                                        <div className="text-xs text-blue-600 font-medium mt-1">
                                                          {fromContractName}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </td>
                                                  <td className="px-4 py-3 text-sm">
                                                    <div className="flex flex-col">
                                                      <div className="flex items-center space-x-2">
                                                        <span className="text-gray-400 mr-1">→</span>
                                                        <span className="font-mono text-gray-900">{truncateAddress(tx.to)}</span>
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          onClick={() => navigator.clipboard.writeText(tx.to)}
                                                          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                                                        >
                                                          📋
                                                        </Button>
                                                      </div>
                                                      {toContractName && (
                                                        <div className="text-xs text-blue-600 font-medium mt-1">
                                                          {toContractName}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </td>
                                                  <td className="px-4 py-3 text-sm">
                                                    <div className={`font-medium ${isIncoming ? 'text-green-600' : 'text-red-600'}`}>
                                                      {isIncoming ? '+' : '-'}{ethValue} ETH
                                                    </div>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                    {/* Pagination */}
                                    <div className="flex items-center justify-center mt-6">
                                      <div className="flex items-center space-x-2 bg-white border border-gray-200 rounded-lg p-1">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => loadAddressData(entry.address, 1, 'transactions')}
                                          disabled={currentPages[entry.address]?.transactions === 1}
                                          className={`text-xs px-3 py-1 ${currentPages[entry.address]?.transactions === 1 ? 'text-gray-400' : 'text-gray-600 hover:text-gray-900'}`}
                                        >
                                          First
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => loadAddressData(entry.address, Math.max(1, (currentPages[entry.address]?.transactions || 1) - 1), 'transactions')}
                                          disabled={currentPages[entry.address]?.transactions === 1}
                                          className={`text-xs px-3 py-1 ${currentPages[entry.address]?.transactions === 1 ? 'text-gray-400' : 'text-gray-600 hover:text-gray-900'}`}
                                        >
                                          &lt;
                                        </Button>
                                        <div className="text-sm text-gray-600 px-4 py-1">
                                          Page {currentPages[entry.address]?.transactions || 1} of {entry.transactionTotalPages || '…'}
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => loadAddressData(entry.address, (currentPages[entry.address]?.transactions || 1) + 1, 'transactions')}
                                          disabled={!entry.transactionHasMore}
                                          className={`text-xs px-3 py-1 ${!entry.transactionHasMore ? 'text-gray-400' : 'text-blue-600 hover:text-blue-700'}`}
                                        >
                                          &gt;
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => entry.transactionTotalPages ? loadAddressData(entry.address, entry.transactionTotalPages, 'transactions') : undefined}
                                          disabled={!entry.transactionTotalPages || (currentPages[entry.address]?.transactions || 1) >= (entry.transactionTotalPages || 1)}
                                          className={`text-xs px-3 py-1 ${!entry.transactionTotalPages || (currentPages[entry.address]?.transactions || 1) >= (entry.transactionTotalPages || 1) ? 'text-gray-400' : 'text-blue-600 hover:text-blue-700'}`}
                                        >
                                          Last
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center py-8 text-gray-500">
                                    <div className="text-4xl mb-2">📝</div>
                                    <div className="text-sm">No transactions found</div>
                                  </div>
                                )}
                              </TabsContent>
                              
                              <TabsContent value="internal" className="space-y-4">
                                {/* Debug info */}
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-xs text-yellow-800">
                                  <strong>Debug:</strong> Address: {entry.address} | 
                                  Internal Transactions: {entry.internalTransactions ? entry.internalTransactions.length : 'undefined'} | 
                                  Loading: {loadingAddressData[entry.address] ? 'true' : 'false'}
                                  <Button 
                                    onClick={() => loadAddressData(entry.address, 1, 'internal')}
                                    size="sm"
                                    variant="outline"
                                    className="ml-2 text-xs"
                                  >
                                    🔄 Refresh Internal
                                  </Button>
                                </div>
                                
                                {loadingAddressData[entry.address] ? (
                                  <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    <span className="ml-3 text-gray-600">Loading internal transactions...</span>
                                  </div>
                                ) : entry.internalTransactions && entry.internalTransactions.length > 0 ? (
                                  <div>
                                    <div className="flex items-center justify-between mb-4">
                                      <div className="text-sm text-gray-600">
                                        Showing page {(currentPages[entry.address]?.internal || 1)} of {entry.internalTotalPages || '…'} · Items {(currentPages[entry.address]?.internal || 1) > 1 ? ((currentPages[entry.address]?.internal || 1) - 1) * 25 + 1 : 1} - {((currentPages[entry.address]?.internal || 1) - 1) * 25 + (entry.internalTransactions?.length || 0)}
                                      </div>
                                      <div className="flex items-center gap-3">
                                        {entry.internalUpdatedAt && (
                                          <span className="text-xs text-gray-500">Last updated {new Date(entry.internalUpdatedAt).toLocaleTimeString()}</span>
                                        )}
                                        <Button 
                                          size="sm"
                                          variant="outline"
                                          onClick={() => window.open(`https://etherscan.io/address/${entry.address}#internaltx`, '_blank')}
                                          className="text-xs"
                                        >
                                          View All on Etherscan
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                      <div className="overflow-x-auto">
                                        <table className="w-full">
                                          <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Block</th>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent Transaction Hash</th>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                            </tr>
                                          </thead>
                                          <tbody className="bg-white divide-y divide-gray-200">
                                            {entry.internalTransactions.map((tx) => {
                                              const isIncoming = tx.to.toLowerCase() === entry.address.toLowerCase();
                                              const ethValue = formatETHValue(tx.value);
                                              const fromContractName = getContractName(tx.from);
                                              const toContractName = getContractName(tx.to);
                                              return (
                                                <tr
                                                  key={tx.hash}
                                                  className="hover:bg-gray-50 cursor-pointer"
                                                  onClick={() => { setDetailType('internal'); setDetailData(tx); setDetailOpen(true); }}
                                                >
                                                  <td className="px-4 py-3 text-sm text-gray-900">{tx.blockNumber}</td>
                                                  <td className="px-4 py-3 text-sm text-gray-600">{formatTimestamp(tx.timeStamp)}</td>
                                                  <td className="px-4 py-3 text-sm">
                                                    <div className="flex items-center space-x-2">
                                                      <span className="text-green-500">✓</span>
                                                      <span className="font-mono text-gray-900">{truncateAddress(tx.hash)}</span>
                                                      <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => navigator.clipboard.writeText(tx.hash)}
                                                        className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                                                      >
                                                        📋
                                                      </Button>
                                                    </div>
                                                  </td>
                                                  <td className="px-4 py-3 text-sm text-gray-600">{tx.type}</td>
                                                  <td className="px-4 py-3 text-sm">
                                                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                      {tx.traceId ? 'Transfer' : 'Call'}
                                                    </div>
                                                  </td>
                                                  <td className="px-4 py-3 text-sm">
                                                    <div className="flex flex-col">
                                                      <div className="flex items-center space-x-2">
                                                        <span className="font-mono text-gray-900">{truncateAddress(tx.from)}</span>
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          onClick={() => navigator.clipboard.writeText(tx.from)}
                                                          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                                                        >
                                                          📋
                                                        </Button>
                                                      </div>
                                                      {fromContractName && (
                                                        <div className="text-xs text-blue-600 font-medium mt-1">
                                                          {fromContractName}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </td>
                                                  <td className="px-4 py-3 text-sm">
                                                    <div className="flex flex-col">
                                                      <div className="flex items-center space-x-2">
                                                        <span className="text-gray-400 mr-1">→</span>
                                                        <span className="font-mono text-gray-900">{truncateAddress(tx.to)}</span>
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          onClick={() => navigator.clipboard.writeText(tx.to)}
                                                          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                                                        >
                                                          📋
                                                        </Button>
                                                      </div>
                                                      {toContractName && (
                                                        <div className="text-xs text-blue-600 font-medium mt-1">
                                                          {toContractName}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </td>
                                                  <td className="px-4 py-3 text-sm">
                                                    <div className={`font-medium ${isIncoming ? 'text-green-600' : 'text-red-600'}`}>
                                                      {isIncoming ? '+' : '-'}{ethValue} ETH
                                                    </div>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                    {/* Pagination */}
                                    <div className="flex items-center justify-center mt-6">
                                      <div className="flex items-center space-x-2 bg-white border border-gray-200 rounded-lg p-1">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => loadAddressData(entry.address, 1, 'internal')}
                                          disabled={currentPages[entry.address]?.internal === 1}
                                          className={`text-xs px-3 py-1 ${currentPages[entry.address]?.internal === 1 ? 'text-gray-400' : 'text-gray-600 hover:text-gray-900'}`}
                                        >
                                          First
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => loadAddressData(entry.address, Math.max(1, (currentPages[entry.address]?.internal || 1) - 1), 'internal')}
                                          disabled={currentPages[entry.address]?.internal === 1}
                                          className={`text-xs px-3 py-1 ${currentPages[entry.address]?.internal === 1 ? 'text-gray-400' : 'text-gray-600 hover:text-gray-900'}`}
                                        >
                                          &lt;
                                        </Button>
                                        <div className="text-sm text-gray-600 px-4 py-1">
                                          Page {currentPages[entry.address]?.internal || 1} of {entry.internalTotalPages || (entry.internalHasMore ? '…' : currentPages[entry.address]?.internal || 1)}
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => loadAddressData(entry.address, (currentPages[entry.address]?.internal || 1) + 1, 'internal')}
                                          disabled={!entry.internalHasMore}
                                          className={`text-xs px-3 py-1 ${!entry.internalHasMore ? 'text-gray-400' : 'text-blue-600 hover:text-blue-700'}`}
                                        >
                                          &gt;
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => entry.internalTotalPages ? loadAddressData(entry.address, entry.internalTotalPages, 'internal') : undefined}
                                          disabled={!entry.internalTotalPages || (currentPages[entry.address]?.internal || 1) >= (entry.internalTotalPages || 1)}
                                          className={`text-xs px-3 py-1 ${!entry.internalTotalPages || (currentPages[entry.address]?.internal || 1) >= (entry.internalTotalPages || 1) ? 'text-gray-400' : 'text-blue-700'}`}
                                        >
                                          Last
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center py-8 text-gray-500">
                                    <div className="text-4xl mb-2">🔄</div>
                                    <div className="text-sm">No internal transactions found</div>
                                  </div>
                                )}
                              </TabsContent>
                              
                              <TabsContent value="transfers" className="space-y-4">
                                {loadingAddressData[entry.address] ? (
                                  <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                    <span className="ml-3 text-gray-600">Loading transfers...</span>
                                  </div>
                                ) : entry.transfers && entry.transfers.length > 0 ? (
                                  <div>
                                    <div className="flex items-center justify-between mb-4">
                                      <div className="text-sm text-gray-600">
                                        Showing page {(currentPages[entry.address]?.transfers || 1)} of {entry.transferTotalPages || '…'} · Items {(currentPages[entry.address]?.transfers || 1) > 1 ? ((currentPages[entry.address]?.transfers || 1) - 1) * 25 + 1 : 1} - {((currentPages[entry.address]?.transfers || 1) - 1) * 25 + (entry.transfers?.length || 0)}
                                      </div>
                                      <div className="flex items-center gap-3">
                                        {entry.transferUpdatedAt && (
                                          <span className="text-xs text-gray-500">Last updated {new Date(entry.transferUpdatedAt).toLocaleTimeString()}</span>
                                        )}
                                        <Button 
                                          size="sm"
                                          variant="outline"
                                          onClick={() => window.open(`https://etherscan.io/address/${entry.address}#tokentxns`, '_blank')}
                                          className="text-xs"
                                        >
                                          View All on Etherscan
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                                      <div className="overflow-x-auto">
                                        <table className="w-full">
                                          <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Block</th>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Age</th>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction Hash</th>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token</th>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                            </tr>
                                          </thead>
                                          <tbody className="bg-white divide-y divide-gray-200">
                                            {entry.transfers.map((transfer) => {
                                              const isIncoming = transfer.to.toLowerCase() === entry.address.toLowerCase();
                                              const tokenValue = parseFloat(transfer.value) / Math.pow(10, parseInt(transfer.tokenDecimal));
                                              const fromContractName = getContractName(transfer.from);
                                              const toContractName = getContractName(transfer.to);
                                              return (
                                                <tr
                                                  key={transfer.hash}
                                                  className="hover:bg-gray-50 cursor-pointer"
                                                  onClick={() => { setDetailType('transfers'); setDetailData(transfer); setDetailOpen(true); }}
                                                >
                                                  <td className="px-4 py-3 text-sm text-gray-900">{transfer.blockNumber}</td>
                                                  <td className="px-4 py-3 text-sm text-gray-600">{formatTimestamp(transfer.timeStamp)}</td>
                                                  <td className="px-4 py-3 text-sm">
                                                    <div className="flex items-center space-x-2">
                                                      <span className="text-green-500">✓</span>
                                                      <span className="font-mono text-gray-900">{truncateAddress(transfer.hash)}</span>
                                                      <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => navigator.clipboard.writeText(transfer.hash)}
                                                        className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                                                      >
                                                        📋
                                                      </Button>
                                                    </div>
                                                  </td>
                                                  <td className="px-4 py-3 text-sm">
                                                    <div>
                                                      <div className="font-medium text-gray-900">{transfer.tokenName || 'Unknown Token'}</div>
                                                      <div className="text-xs text-gray-500">{transfer.tokenSymbol}</div>
                                                    </div>
                                                  </td>
                                                  <td className="px-4 py-3 text-sm">
                                                    <div className="flex flex-col">
                                                      <div className="flex items-center space-x-2">
                                                        <span className="font-mono text-gray-900">{truncateAddress(transfer.from)}</span>
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          onClick={() => navigator.clipboard.writeText(transfer.from)}
                                                          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                                                        >
                                                          📋
                                                        </Button>
                                                      </div>
                                                      {fromContractName && (
                                                        <div className="text-xs text-blue-600 font-medium mt-1">
                                                          {fromContractName}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </td>
                                                  <td className="px-4 py-3 text-sm">
                                                    <div className="flex flex-col">
                                                      <div className="flex items-center space-x-2">
                                                        <span className="text-gray-400 mr-1">→</span>
                                                        <span className="font-mono text-gray-900">{truncateAddress(transfer.to)}</span>
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          onClick={() => navigator.clipboard.writeText(transfer.to)}
                                                          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                                                        >
                                                          📋
                                                        </Button>
                                                      </div>
                                                      {toContractName && (
                                                        <div className="text-xs text-blue-600 font-medium mt-1">
                                                          {toContractName}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </td>
                                                  <td className="px-4 py-3 text-sm">
                                                    <div className={`font-medium ${isIncoming ? 'text-green-600' : 'text-red-600'}`}>
                                                      {isIncoming ? '+' : '-'}{tokenValue.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                                    </div>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                    {/* Pagination */}
                                    <div className="flex items-center justify-center mt-6">
                                      <div className="flex items-center space-x-2 bg-white border border-gray-200 rounded-lg p-1">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => loadAddressData(entry.address, 1, 'transfers')}
                                          disabled={currentPages[entry.address]?.transfers === 1}
                                          className={`text-xs px-3 py-1 ${currentPages[entry.address]?.transfers === 1 ? 'text-gray-400' : 'text-gray-600 hover:text-gray-900'}`}
                                        >
                                          First
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => loadAddressData(entry.address, Math.max(1, (currentPages[entry.address]?.transfers || 1) - 1), 'transfers')}
                                          disabled={currentPages[entry.address]?.transfers === 1}
                                          className={`text-xs px-3 py-1 ${currentPages[entry.address]?.transfers === 1 ? 'text-gray-400' : 'text-gray-600 hover:text-gray-900'}`}
                                        >
                                          &lt;
                                        </Button>
                                        <div className="text-sm text-gray-600 px-4 py-1">
                                          Page {currentPages[entry.address]?.transfers || 1} of {entry.transferTotalPages || (entry.transferHasMore ? '…' : currentPages[entry.address]?.transfers || 1)}
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => loadAddressData(entry.address, (currentPages[entry.address]?.transfers || 1) + 1, 'transfers')}
                                          disabled={!entry.transferHasMore}
                                          className={`text-xs px-3 py-1 ${!entry.transferHasMore ? 'text-gray-400' : 'text-blue-600 hover:text-blue-700'}`}
                                        >
                                          &gt;
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => entry.transferTotalPages ? loadAddressData(entry.address, entry.transferTotalPages, 'transfers') : undefined}
                                          disabled={!entry.transferTotalPages || (currentPages[entry.address]?.transfers || 1) >= (entry.transferTotalPages || 1)}
                                          className={`text-xs px-3 py-1 ${!entry.transferTotalPages || (currentPages[entry.address]?.transfers || 1) >= (entry.transferTotalPages || 1) ? 'text-gray-400' : 'text-blue-600 hover:text-blue-700'}`}
                                        >
                                          Last
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center py-8 text-gray-500">
                                    <div className="text-4xl mb-2">🔄</div>
                                    <div className="text-sm">No token transfers found</div>
                                  </div>
                                )}
                              </TabsContent>
                              
                              <TabsContent value="actions" className="space-y-4">
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                  <div className="text-gray-500 text-sm mb-2">Debug Actions</div>
                                  <div className="space-y-2">
                                    <Button 
                                      onClick={() => {
                                        console.log('Testing Etherscan API...');
                                        fetchTransactions(entry.address, 1).then(result => {
                                          console.log('Test result:', result);
                                        });
                                      }}
                                      variant="outline" 
                                      size="sm"
                                    >
                                      🔄 Test Etherscan API
                                    </Button>
                                    <Button 
                                      onClick={() => {
                                        console.log('Current treasury data for this address:', entry);
                                      }}
                                      variant="outline" 
                                      size="sm"
                                    >
                                      📊 Show Current Data
                                    </Button>
                                  </div>
                                </div>
                              </TabsContent>
                            </Tabs>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Disclaimer */}
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 p-6 rounded-xl text-amber-800 mt-8">
          <p className="text-sm leading-relaxed">
            <strong>Disclaimer:</strong> This page estimates treasury balances from public sources and may not be 100% accurate.
          </p>
        </div>
        {/* Detail Dialog (inside root container to keep single JSX root) */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden">
            <DialogHeader className="border-b border-gray-200 px-6 py-4">
              <DialogTitle className="text-lg font-semibold text-gray-900">
                {detailType === 'transactions' && 'Transaction Details'}
                {detailType === 'internal' && 'Internal Transaction Details'}
                {detailType === 'transfers' && 'Token Transfer Details'}
              </DialogTitle>
            </DialogHeader>
            <div className="px-6 py-5 bg-white">
              {detailData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {detailData.blockNumber && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="text-xs text-gray-500">Block</div>
                      <div className="text-sm font-mono text-gray-900">{detailData.blockNumber}</div>
                    </div>
                  )}
                  {detailData.timeStamp && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="text-xs text-gray-500">Age</div>
                      <div className="text-sm text-gray-900">{formatTimestamp(detailData.timeStamp)}</div>
                    </div>
                  )}
                  {detailData.hash && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 md:col-span-2">
                      <div className="text-xs text-gray-500">Hash</div>
                      <div className="flex items-center justify-between">
                        <a href={`https://etherscan.io/tx/${detailData.hash}`} target="_blank" rel="noreferrer" className="text-sm font-mono text-blue-600 hover:underline break-all">
                          {detailData.hash}
                        </a>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => navigator.clipboard.writeText(detailData.hash)}>📋</Button>
                      </div>
                    </div>
                  )}
                  {detailData.from && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="text-xs text-gray-500">From</div>
                      <div className="flex items-center justify-between">
                        <a href={`https://etherscan.io/address/${detailData.from}`} target="_blank" rel="noreferrer" className="text-sm font-mono text-blue-600 hover:underline break-all">
                          {detailData.from}
                        </a>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => navigator.clipboard.writeText(detailData.from)}>📋</Button>
                      </div>
                    </div>
                  )}
                  {detailData.to && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="text-xs text-gray-500">To</div>
                      <div className="flex items-center justify-between">
                        <a href={`https://etherscan.io/address/${detailData.to}`} target="_blank" rel="noreferrer" className="text-sm font-mono text-blue-600 hover:underline break-all">
                          {detailData.to}
                        </a>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => navigator.clipboard.writeText(detailData.to)}>📋</Button>
                      </div>
                    </div>
                  )}
                  {detailType !== 'transfers' && detailData.value && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="text-xs text-gray-500">Value</div>
                      <div className="text-sm text-gray-900">{formatETHValue(detailData.value)} ETH</div>
                    </div>
                  )}
                  {detailType === 'transfers' && (
                    <>
                      {detailData.tokenName && (
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="text-xs text-gray-500">Token</div>
                          <div className="text-sm text-gray-900">{detailData.tokenName} ({detailData.tokenSymbol})</div>
                        </div>
                      )}
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="text-xs text-gray-500">Amount</div>
                        <div className="text-sm text-gray-900">
                          {(parseFloat(detailData.value) / Math.pow(10, parseInt(detailData.tokenDecimal))).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                        </div>
                      </div>
                    </>
                  )}
                  {detailData.gas && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="text-xs text-gray-500">Gas</div>
                      <div className="text-sm text-gray-900">{detailData.gas}</div>
                    </div>
                  )}
                  {detailData.gasPrice && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="text-xs text-gray-500">Gas Price (wei)</div>
                      <div className="text-sm text-gray-900">{detailData.gasPrice}</div>
                    </div>
                  )}
                  {detailData.gasUsed && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="text-xs text-gray-500">Gas Used</div>
                      <div className="text-sm text-gray-900">{detailData.gasUsed}</div>
                    </div>
                  )}
                  {detailData.functionName && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 md:col-span-2">
                      <div className="text-xs text-gray-500">Function</div>
                      <div className="text-sm text-gray-900 break-all">{detailData.functionName}</div>
                    </div>
                  )}
                  {detailData.input && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 md:col-span-2">
                      <div className="text-xs text-gray-500">Input</div>
                      <div className="text-xs font-mono text-gray-800 break-all max-h-60 overflow-auto">
                        {detailData.input}
                      </div>
                    </div>
                  )}
                  {detailType === 'internal' && detailData.type && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="text-xs text-gray-500">Type</div>
                      <div className="text-sm text-gray-900">{detailData.type}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-600">No data</div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default TreasuryTracker;

