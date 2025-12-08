'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AdminStatsPanel from '@/components/AdminStatsPanel';
import TokenAIChat from '@/components/TokenAIChat';
import TokenContractView from '@/components/TokenContractView';
import DexScreenerChart from '@/components/DexScreenerChart';
import LiquidityTab from '@/components/LiquidityTab';
import { LoaderThree } from "@/components/ui/loader";
import { Copy } from 'lucide-react';
import type { ContractData, TokenInfo, DexScreenerData, SearchResultItem } from '../../types';
import { fetchContract, fetchTokenInfo, fetchDexScreenerData, search } from '../../services/pulsechainService';
import { pulsechainApiService } from '../../services/pulsechainApiService';
import { dexscreenerApi } from '../../services/blockchain/dexscreenerApi';

const normalizeLabel = (value?: string | null) => {
  if (!value) return '';
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatChainLabel = (value?: string | null) => {
  if (!value) return 'PulseChain';
  const normalized = value.toLowerCase();
  if (normalized === 'pulsechain') return 'PulseChain';
  return normalizeLabel(value);
};

const formatDexLabel = (value?: string | null) => {
  if (!value) return 'PulseX';
  const normalized = value.toLowerCase();
  if (normalized.includes('pulsex')) {
    if (normalized.includes('v3')) return 'PulseX V3';
    if (normalized.includes('v2')) return 'PulseX V2';
    return 'PulseX';
  }
  return normalizeLabel(value);
};

// Pump.Tires creator address
const PUMP_TIRES_CREATOR = '0x6538A83a81d855B965983161AF6a83e616D16fD5';

const formatWebsiteDisplay = (url?: string | null) => {
  if (!url) return '';
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.replace(/\/$/, '') : '';
    return `${host}${path}`;
  } catch {
    return url.replace(/^https?:\/\//, '');
  }
};

const formatMarketCapLabel = (value?: number) => {
  if (!value || !Number.isFinite(value) || value <= 0) return 'MCAP N/A';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B MCAP`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M MCAP`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k MCAP`;
  return `$${Math.round(value).toLocaleString()} MCAP`;
};

const truncateAddress = (value: string) => `${value.slice(0, 6)}...${value.slice(-4)}`;
const formatLpHolderAddress = (value?: string) => (value ? `...${value.slice(-4)}` : 'Unknown');

const formatCurrencyCompact = (value?: number | null, options: Intl.NumberFormatOptions = {}) => {
  if (!Number.isFinite(value ?? NaN)) return '—';
  const num = Number(value);
  if (Math.abs(num) >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(num) >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toLocaleString('en-US', { maximumFractionDigits: 2, ...options })}`;
};

const formatNumberCompact = (value?: number | null) => {
  if (!Number.isFinite(value ?? NaN)) return '—';
  const num = Number(value);
  if (Math.abs(num) >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
};

const formatPercentChange = (value?: number | null) => {
  if (!Number.isFinite(value ?? NaN)) return '0.00%';
  const num = Number(value);
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
};

const formatDateUTC = (value: string | number | Date) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function GeickoPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const addressFromQuery = searchParams.get('address');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState('chart');
  const tokenInfoTab: 'token' = 'token';
  const [apiTokenAddress, setApiTokenAddress] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[] | null>(null);
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [tokenAmount, setTokenAmount] = useState<string>('1');
  const [calculatorCurrency, setCalculatorCurrency] = useState<'usd' | 'wpls'>('usd');
  const [burnedTokens, setBurnedTokens] = useState<{ amount: number; percent: number } | null>(null);
  const [holdersCount, setHoldersCount] = useState<number | null>(null);
  const [creationDate, setCreationDate] = useState<string | null>(null);
  const [activeSocialTab, setActiveSocialTab] = useState<string | null>(null);
  const [uiPreset, setUiPreset] = useState<'classic' | 'rabby1'>('classic');
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

  // Ownership state
  const [ownershipData, setOwnershipData] = useState<{
    creatorAddress: string | null;
    ownerAddress: string | null;
    isRenounced: boolean;
    renounceTxHash: string | null;
    isLoading: boolean;
  }>({
    creatorAddress: null,
    ownerAddress: null,
    isRenounced: false,
    renounceTxHash: null,
    isLoading: false,
  });

  // Additional metrics state
  const [totalSupply, setTotalSupply] = useState<{ supply: string; decimals: number } | null>(null);
  const [supplyHeld, setSupplyHeld] = useState<{
    top10: number;
    top20: number;
    top50: number;
    isLoading: boolean;
  }>({
    top10: 0,
    top20: 0,
    top50: 0,
    isLoading: false,
  });
  const [smartContractHolderShare, setSmartContractHolderShare] = useState<{
    percent: number;
    contractCount: number;
    isLoading: boolean;
  }>({
    percent: 0,
    contractCount: 0,
    isLoading: false,
  });
  const [totalLiquidity, setTotalLiquidity] = useState<{
    usd: number;
    pairCount: number;
    isLoading: boolean;
  }>({
    usd: 0,
    pairCount: 0,
    isLoading: false,
  });

  // Data state
  const [contractData, setContractData] = useState<ContractData | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [dexScreenerData, setDexScreenerData] = useState<DexScreenerData | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [topTokens, setTopTokens] = useState<Array<{symbol: string; priceChange: number}>>([]);
  const [transactions, setTransactions] = useState<Array<{
    time: string;
    timestamp: number;
    type: 'BUY' | 'SELL';
    priceNative: number;
    priceUsd: number;
    amount: number;
    txHash: string;
    from: string;
    valueUsd: number;
  }>>([]);

  // Loading state
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Holders state
  const [holders, setHolders] = useState<Array<{ address: string; value: string; isContract?: boolean; isVerified?: boolean }>>([]);
  const [isLoadingHolders, setIsLoadingHolders] = useState<boolean>(false);
  const [holdersPage, setHoldersPage] = useState<number>(1);
  const holdersPerPage = 25;
  const [isHolderTransfersOpen, setIsHolderTransfersOpen] = useState(false);
  const [holderTransfersAddress, setHolderTransfersAddress] = useState<string | null>(null);
  const [holderTransfers, setHolderTransfers] = useState<
    Array<{
      txHash: string;
      timestamp: string | null;
      from: string;
      to: string;
      amount: number;
      direction: 'Buy' | 'Sell' | 'Transfer';
    }>
  >([]);
  const [isLoadingHolderTransfers, setIsLoadingHolderTransfers] = useState(false);
  const [holderTransfersError, setHolderTransfersError] = useState<string | null>(null);
  const [expandedHolderTxs, setExpandedHolderTxs] = useState<Set<string>>(new Set());


  // Load token data function
  const loadTokenData = useCallback(async (address: string) => {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      setError('Invalid token address');
      return;
    }

    setIsLoadingData(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [contractResult, tokenResult, dexResult, profileResult] = await Promise.allSettled([
        fetchContract(address),
        fetchTokenInfo(address),
        fetchDexScreenerData(address),
        dexscreenerApi.getTokenProfile(address)
      ]);

      // Handle contract data
      if (contractResult.status === 'fulfilled') {
        setContractData(contractResult.value.data);
        console.log('Contract data loaded:', contractResult.value.data);
      } else if (contractResult.status === 'rejected') {
        console.error('Failed to fetch contract data:', contractResult.reason);
      }

      // Handle token info
      if (tokenResult.status === 'fulfilled') {
        setTokenInfo(tokenResult.value?.data || null);
        console.log('Token info loaded:', tokenResult.value?.data);
      } else if (tokenResult.status === 'rejected') {
        console.error('Failed to fetch token info:', tokenResult.reason);
      }

      // Handle DexScreener data
      if (dexResult.status === 'fulfilled') {
        setDexScreenerData(dexResult.value.data);
        console.log('DexScreener data loaded:', dexResult.value.data);
      } else if (dexResult.status === 'rejected') {
        console.error('Failed to fetch DexScreener data:', dexResult.reason);
      }

      // Handle profile data
      if (profileResult.status === 'fulfilled') {
        if (profileResult.value.success) {
          setProfileData(profileResult.value.data);
          console.log('Profile data loaded:', profileResult.value.data);
        } else {
          console.error('Failed to fetch profile data:', profileResult.value.error);
        }
      } else if (profileResult.status === 'rejected') {
        console.error('Failed to fetch profile data:', profileResult.reason);
      }

    } catch (e) {
      console.error('Error loading token data:', e);
      setError(e instanceof Error ? e.message : 'Failed to load token data');
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  // Load transactions function
  const loadTransactions = useCallback(async (address: string) => {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return;
    }

    setIsLoadingTransactions(true);

    try {
      // Fetch real token transfers from PulseScan API (100 max)
      const transfersResponse = await pulsechainApiService.getTokenTransfers(address, 1, 100);

      // Handle different response formats
      const transfers: any[] = Array.isArray(transfersResponse)
        ? transfersResponse
        : (transfersResponse as any)?.items || [];

      if (transfers.length === 0) {
        console.log('No transfers found for token');
        setTransactions([]);
        setIsLoadingTransactions(false);
        return;
      }

      console.log(`Loaded ${transfers.length} transactions from PulseScan v2`);

      // Get current price data for calculation
      const dexDataResult = await fetchDexScreenerData(address);
      const dexData = dexDataResult?.data;
      const currentPriceUsd = Number(dexData?.pairs?.[0]?.priceUsd || 0);
      const currentPriceNative = Number(dexData?.pairs?.[0]?.priceNative || 0);

      // Get decimals from the first transfer or fallback
      const decimals = transfers[0]?.total?.decimals
        ? Number(transfers[0].total.decimals)
        : transfers[0]?.token?.decimals
        ? Number(transfers[0].token.decimals)
        : 18;

      console.log(`Using ${decimals} decimals from PulseScan API response`);

      // Process transfers into transaction format
      const processedTransactions = transfers.map((transfer: any) => {
        const txTime = new Date(transfer.timestamp);
        const now = new Date();
        const isToday = txTime.toDateString() === now.toDateString();

        // Format time with date if not today
        const timeStr = isToday
          ? txTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
          : txTime.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

        // Calculate amount from total.value (PulseScan v2 format)
        const rawValue = transfer.total?.value || transfer.value || '0';
        const amount = Number(rawValue) / Math.pow(10, decimals);

        // Safely get address string from PulseScan v2 object format
        const getAddressString = (addr: any): string => {
          if (typeof addr === 'string') return addr;
          if (addr?.hash) return addr.hash;
          return '';
        };

        // Common DEX router addresses on PulseChain
        const knownDexRouters = [
          '0x165C3410fC91EF562C50559f7d2289fEbed552d9', // PulseX Router V2
          '0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02', // PulseX Router V1
          '0x9977e170c9b6e544302e8db0cf01d12d55555289', // Common pair
        ];

        const fromAddress = getAddressString(transfer.from);
        const toAddress = getAddressString(transfer.to);

        const isDexRouter = (addr: string) => {
          if (!addr) return false;
          return knownDexRouters.some(router =>
            addr.toLowerCase() === router.toLowerCase()
          );
        };

        // Determine BUY or SELL: TO router = SELL, FROM router = BUY
        let type: 'BUY' | 'SELL' = 'BUY';
        if (isDexRouter(toAddress)) {
          type = 'SELL';
        } else if (isDexRouter(fromAddress)) {
          type = 'BUY';
        }

        const valueUsd = amount * currentPriceUsd;

        return {
          time: timeStr,
          timestamp: txTime.getTime(),
          type: type,
          priceNative: currentPriceNative,
          priceUsd: currentPriceUsd,
          amount: amount,
          txHash: transfer.tx_hash || transfer.transaction_hash || '',
          from: fromAddress,
          valueUsd
        };
      });

      // Sort by timestamp (most recent first)
      processedTransactions.sort((a, b) => b.timestamp - a.timestamp);

      console.log(`Processed ${processedTransactions.length} transactions successfully`);
      setTransactions(processedTransactions);
    } catch (error) {
      console.error('Failed to load transactions:', error);
      setTransactions([]);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, []);

  // Load holders function
  const loadHolders = useCallback(async (address: string) => {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return;
    }

    setIsLoadingHolders(true);

    try {
      // Fetch top 100 holders from PulseScan API
      const res = await pulsechainApiService.getTokenHolders(address, 1, 100);
      const resData: any = res;

      // Parse response structure
      let items: Array<{ address: string; value: string }> = [];
      const rawData = Array.isArray(resData) ? resData
                    : resData.data && Array.isArray(resData.data) ? resData.data
                    : resData.items && Array.isArray(resData.items) ? resData.items
                    : [];

      items = rawData
        .map((h: any) => ({
          address: h.address?.hash || h.address || '',
          value: h.value || '0'
        }))
        .filter((item: any) => item.address && item.value);

      // Only fetch contract info for top 5 holders to reduce API calls
      const top5Addresses = items.slice(0, 5).map(h => h.address);
      const contractChecks = await Promise.allSettled(
        top5Addresses.map(addr => pulsechainApiService.getAddressInfo(addr))
      );

      // Map contract info to holders
      const itemsWithContractInfo = items.map((item, idx) => {
        if (idx < 5) {
          const checkResult = contractChecks[idx];
          if (checkResult.status === 'fulfilled' && checkResult.value) {
            return {
              ...item,
              isContract: checkResult.value.is_contract,
              isVerified: checkResult.value.is_verified
            };
          }
        }
        return item;
      });

      setHolders(itemsWithContractInfo);
    } catch (error) {
      console.error('Failed to load holders:', error);
      setHolders([]);
    } finally {
      setIsLoadingHolders(false);
    }
  }, []);

  const loadHolderTransfers = useCallback(
    async (holderAddress: string) => {
      if (!holderAddress || !apiTokenAddress) return;

      const holderLower = holderAddress.toLowerCase();
      const tokenLower = apiTokenAddress.toLowerCase();
      setIsLoadingHolderTransfers(true);
      setHolderTransfers([]);
      setHolderTransfersError(null);
      try {
        const base = 'https://api.scan.pulsechain.com/api/v2';
        const limit = 150;
        const collected: any[] = [];
        let nextParams: Record<string, string> | undefined;

        for (let i = 0; i < 3; i += 1) {
          const qs = new URLSearchParams({ limit: String(limit) });
          if (nextParams) {
            Object.entries(nextParams).forEach(([k, v]) => qs.set(k, String(v)));
          }
          const res = await fetch(`${base}/addresses/${holderAddress}/token-transfers?${qs.toString()}`, {
            headers: { Accept: 'application/json' },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
          collected.push(...items);
          if (data?.next_page_params) {
            nextParams = data.next_page_params as Record<string, string>;
          } else {
            break;
          }
        }

        const decimals = tokenInfo?.decimals ? Number(tokenInfo.decimals) : 18;
        const mapped = collected
          .filter((item) => (item?.token?.address || item?.token?.hash || '').toLowerCase() === tokenLower)
          .map((item) => {
            const txHash = item?.tx_hash || item?.transaction_hash || item?.hash || '';
            const from = item?.from?.hash || item?.from || '';
            const to = item?.to?.hash || item?.to || '';
            const rawValue = item?.total?.value || item?.value || '0';
            const amount = Number(rawValue) / Math.pow(10, item?.total?.decimals ? Number(item.total.decimals) : decimals);
            const ts = item?.timestamp || item?.block_signed_at || null;
            let direction: 'Buy' | 'Sell' | 'Transfer' = 'Transfer';
            if (from?.toLowerCase() === holderLower) direction = 'Sell';
            else if (to?.toLowerCase() === holderLower) direction = 'Buy';

            return {
              txHash,
              timestamp: ts,
              from,
              to,
              amount,
              direction,
            };
          })
          .filter((item) => item.txHash);

        setHolderTransfers(mapped);
      } catch (error) {
        console.error('Failed to load holder transfers:', error);
        setHolderTransfersError('Failed to load transfers for this holder.');
      } finally {
        setIsLoadingHolderTransfers(false);
      }
    },
    [apiTokenAddress, tokenInfo?.decimals]
  );

  // Load data when token address changes
  useEffect(() => {
    const loadAllData = async () => {
      await loadTokenData(apiTokenAddress);
      // Load transactions and holders after token data is available
      loadTransactions(apiTokenAddress);
      loadHolders(apiTokenAddress);
    };

    loadAllData();
    setHoldersPage(1); // Reset pagination when address changes
  }, [apiTokenAddress, loadTokenData, loadTransactions, loadHolders]);

  const handleOpenHolderTransfers = useCallback(
    (address: string) => {
      setHolderTransfersAddress(address);
      setIsHolderTransfersOpen(true);
      setExpandedHolderTxs(new Set());
      loadHolderTransfers(address);
    },
    [loadHolderTransfers]
  );

  const handleCloseHolderTransfers = useCallback(() => {
    setIsHolderTransfersOpen(false);
    setHolderTransfers([]);
    setHolderTransfersAddress(null);
    setHolderTransfersError(null);
  }, []);

  const toggleExpandedHolderTx = useCallback((hash: string) => {
    setExpandedHolderTxs((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) {
        next.delete(hash);
      } else {
        next.add(hash);
      }
      return next;
    });
  }, []);

  // Search placeholders
  const searchPlaceholders = [
    "Search Any PulseChain Ticker",
    "Search By Name, Ticker, or Address",
    "Search for HEX...or HEX!",
    "Search for PulseChain or PLS!",
    "Try SuperStake or PSSH",
    "Bringing AI To PulseChain",
    "Bookmark Morbius",
  ];

  // Handle search with name, ticker, or address
  useEffect(() => {
    if (searchInput.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      setShowSearchResults(false);
      return;
    }

    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(searchInput);
    if (isAddress) {
      setSearchResults([]);
      setIsSearching(false);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await search(searchInput);
        setSearchResults(results.slice(0, 10));
        setSearchError(null);
        setShowSearchResults(true);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
        setSearchError(error instanceof Error ? error.message : 'Search failed');
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleSelectSearchResult = (item: SearchResultItem) => {
    setApiTokenAddress(item.address);
    setSearchInput(item.address);
    setSearchResults([]);
    setShowSearchResults(false);
    setError(null);
    router.push(`/geicko?address=${encodeURIComponent(item.address)}`);
  };

  // Handle search submission (for direct address input)
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    const trimmedInput = searchInput.trim();

    // Validate Ethereum address format (0x followed by 40 hex characters)
    if (trimmedInput && /^0x[a-fA-F0-9]{40}$/.test(trimmedInput)) {
      setApiTokenAddress(trimmedInput);
      setError(null);
      setSearchResults([]);
      setShowSearchResults(false);
      router.push(`/geicko?address=${encodeURIComponent(trimmedInput)}`);
    } else if (trimmedInput && searchResults && searchResults.length > 0) {
      // If there are search results, select the first one
      handleSelectSearchResult(searchResults[0]);
    } else if (trimmedInput) {
      setError('Invalid token address. Please enter a valid Ethereum address (0x...)');
    }
  }, [searchInput, searchResults]);

  // Load top tokens on mount
  useEffect(() => {
    const loadTopTokens = async () => {
      try {
        // Popular PulseChain token addresses
        const popularTokens = [
          { address: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', name: 'HEX' },
          { address: '0x95B303987A60C71504D99Aa1b13B4DA07b0790ab', name: 'PLSX' },
          { address: '0x2fa878Ab3F87CC1C9737Fc071108F904c0B0C95d', name: 'INC' },
          { address: '0xefD766cCb38EaF1dfd701853BFCe31359239F305', name: 'DAI' },
          { address: '0xA1077a294dDE1B09bB078844df40758a5D0f9a27', name: 'WPLS' },
          { address: '0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07', name: 'USDC' },
        ];

        const tokenDataPromises = popularTokens.map(async (token) => {
          try {
            const result = await fetchDexScreenerData(token.address);
            const data = result?.data;
            return {
              symbol: token.name,
              priceChange: data?.pairs?.[0]?.priceChange?.h24 || 0
            };
          } catch {
            return { symbol: token.name, priceChange: 0 };
          }
        });

        const results = await Promise.all(tokenDataPromises);
        setTopTokens(results);
      } catch (error) {
        console.error('Failed to load top tokens:', error);
      }
    };

    loadTopTokens();
  }, []);

  // Fetch burned tokens and holders count
  useEffect(() => {
    let cancelled = false;
    const base = 'https://api.scan.pulsechain.com/api/v2';

    const isBurnAddress = (addr: string): boolean => {
      const lower = (addr || '').toLowerCase();
      return (
        lower.endsWith('dead') ||
        lower.endsWith('0000') ||
        lower.endsWith('0369') ||
        lower.endsWith('000369')
      );
    };

    const fetchJson = async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    };

    const load = async () => {
      try {
        if (!apiTokenAddress) return;
        const tokenInfo = await fetchJson(`${base}/tokens/${apiTokenAddress}`);
        const decimals = Number(tokenInfo?.decimals ?? 18);
        const totalSupply = Number(tokenInfo?.total_supply ?? 0);

        // Get holders count from first page response
        const firstPageUrl = `${base}/tokens/${apiTokenAddress}/holders?limit=50`;
        const firstPage = await fetchJson(firstPageUrl);

        // Extract total holders from the token metadata in the response
        const totalHolders = firstPage?.items?.[0]?.token?.holders
          ? Number(firstPage.items[0].token.holders)
          : 0;

        // Paginate through holders to calculate burned tokens
        const limit = 50;
        let nextParams: Record<string, string> | undefined = undefined;
        let deadValueRaw = 0;

        for (let i = 0; i < 10; i += 1) {
          const qs = new URLSearchParams({ limit: String(limit) });
          if (nextParams) Object.entries(nextParams).forEach(([k, v]) => qs.set(k, String(v)));
          const data = await fetchJson(`${base}/tokens/${apiTokenAddress}/holders?${qs.toString()}`);
          const items: Array<{ address?: { hash?: string }; value?: string }> = Array.isArray(data?.items) ? data.items : [];

          // Calculate burned tokens
          const burnedOnPage = items.reduce((sum, it) => sum + (isBurnAddress(it.address?.hash || '') ? Number(it.value || '0') : 0), 0);
          deadValueRaw += burnedOnPage;

          if (!data?.next_page_params) break;
          nextParams = data.next_page_params as Record<string, string>;
        }

        const burnedAmount = decimals ? deadValueRaw / Math.pow(10, decimals) : deadValueRaw;
        const burnedPct = totalSupply > 0 ? (deadValueRaw / totalSupply) * 100 : 0;

        if (!cancelled) {
          setBurnedTokens({ amount: burnedAmount, percent: burnedPct });
          setHoldersCount(totalHolders);
        }
      } catch (error) {
        console.error('Failed to fetch burned tokens and holders:', error);
        if (!cancelled) {
          setBurnedTokens(null);
          setHoldersCount(null);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [apiTokenAddress]);

  // Fetch contract ownership data
  useEffect(() => {
    let cancelled = false;
    const base = 'https://api.scan.pulsechain.com/api/v2';

    const fetchJson = async (url: string) => {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    };

    const loadOwnership = async () => {
      try {
        if (!apiTokenAddress) return;

        setOwnershipData(prev => ({ ...prev, isLoading: true }));

        let creatorAddress: string | null = null;
        let creationTxHash: string | null = null;
        let ownerAddress: string | null = null;
        let isRenounced = false;
        let renounceTxHash: string | null = null;

        // Fetch address info to get creator and creation tx
        try {
          const addressInfo = await fetchJson(`${base}/addresses/${apiTokenAddress}`);
          creatorAddress = addressInfo?.creator_address_hash || null;
          creationTxHash = addressInfo?.creation_tx_hash || null;
        } catch (error) {
          console.error('Failed to fetch address info:', error);
        }

        if (creationTxHash) {
          // Fetch creation transaction to get owner (from address)
          try {
            const creationTx = await fetchJson(`${base}/transactions/${creationTxHash}`);
            ownerAddress = creationTx?.from?.hash || creationTx?.from || null;
          } catch (error) {
            console.error('Failed to fetch creation transaction:', error);
          }
        }

        // Check if ownership was renounced by checking creator's transactions
        if (creatorAddress) {
          try {
            const creatorTxs = await fetchJson(`${base}/addresses/${creatorAddress}/transactions?limit=100`);
            const renounceTx = (creatorTxs?.items || []).find((tx: any) =>
              (tx?.method || '').toLowerCase() === 'renounceownership'
            );

            if (renounceTx) {
              isRenounced = true;
              renounceTxHash = renounceTx.hash || null;
            }
          } catch (error) {
            console.error('Failed to check renounce status:', error);
          }
        }

        if (!cancelled) {
          setOwnershipData({
            creatorAddress,
            ownerAddress: ownerAddress || creatorAddress,
            isRenounced,
            renounceTxHash,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error('Failed to fetch ownership data:', error);
        if (!cancelled) {
          setOwnershipData(prev => ({ ...prev, isLoading: false }));
        }
      }
    };

    loadOwnership();
    return () => { cancelled = true; };
  }, [apiTokenAddress]);

  // Fetch total liquidity (USD) from all pairs
  useEffect(() => {
    let cancelled = false;

    const loadTotalLiquidity = async () => {
      if (!dexScreenerData?.pairs || dexScreenerData.pairs.length === 0) {
        if (!cancelled) {
          setTotalLiquidity({
            usd: 0,
            pairCount: 0,
            isLoading: false,
          });
        }
        return;
      }

      try {
        setTotalLiquidity(prev => ({ ...prev, isLoading: true }));
        
        // Sum of USD liquidity across every discovered pair (same as admin panel)
        const pairs = dexScreenerData.pairs || [];
        const totalUsd = pairs.reduce((sum: number, pair: any) => {
          return sum + Number(pair?.liquidity?.usd || 0);
        }, 0);

        if (!cancelled) {
          setTotalLiquidity({
            usd: totalUsd,
            pairCount: pairs.length,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error('Failed to calculate total liquidity:', error);
        if (!cancelled) {
          setTotalLiquidity(prev => ({ ...prev, isLoading: false }));
        }
      }
    };

    loadTotalLiquidity();
    return () => { cancelled = true; };
  }, [dexScreenerData]);

  // Fetch contract age, total pairs, and supply held
  useEffect(() => {
    let cancelled = false;
    const base = 'https://api.scan.pulsechain.com/api/v2';

    const fetchJson = async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    };

    const loadMetrics = async () => {
      try {
        if (!apiTokenAddress) return;
        setCreationDate(null);

        // Fetch contract age and creation date
        try {
          const addressInfo = await fetchJson(`${base}/addresses/${apiTokenAddress}`);
          const creationTxHash = addressInfo?.creation_tx_hash;
          
          if (creationTxHash) {
            const creationTx = await fetchJson(`${base}/transactions/${creationTxHash}`);
            const timestamp = creationTx?.timestamp || creationTx?.block_timestamp;
            
            if (timestamp) {
              const creationDate = new Date(timestamp);
              const creationDateStr = `${creationDate.getUTCFullYear()}-${String(creationDate.getUTCMonth() + 1).padStart(2, '0')}-${String(creationDate.getUTCDate()).padStart(2, '0')}`;
              
              if (!cancelled) {
                setCreationDate(creationDateStr);
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch contract age:', error);
        }

        // Fetch total supply
        try {
          const tokenInfo = await fetchJson(`${base}/tokens/${apiTokenAddress}`);
          const supply = tokenInfo?.total_supply || null;
          const decimals = Number(tokenInfo?.decimals || 18);
          if (supply && !cancelled) {
            setTotalSupply({ supply, decimals });
          }
        } catch (error) {
          console.error('Failed to fetch total supply:', error);
        }

        // Fetch supply held by top holders
        try {
          setSupplyHeld(prev => ({ ...prev, isLoading: true }));
          
          const tokenInfo = await fetchJson(`${base}/tokens/${apiTokenAddress}`);
          const totalSupply = Number(tokenInfo?.total_supply || 0);
          const decimals = Number(tokenInfo?.decimals || 18);

          if (totalSupply > 0) {
            // Fetch top 50 holders
            const holdersResponse = await fetchJson(`${base}/tokens/${apiTokenAddress}/holders?limit=50`);
            const holders = Array.isArray(holdersResponse?.items) ? holdersResponse.items : [];

            // Calculate supply held by top 10, 20, and 50
            const top10Value = holders.slice(0, 10).reduce((sum: number, h: any) => sum + Number(h.value || 0), 0);
            const top20Value = holders.slice(0, 20).reduce((sum: number, h: any) => sum + Number(h.value || 0), 0);
            const top50Value = holders.slice(0, 50).reduce((sum: number, h: any) => sum + Number(h.value || 0), 0);

            const top10Percent = (top10Value / totalSupply) * 100;
            const top20Percent = (top20Value / totalSupply) * 100;
            const top50Percent = (top50Value / totalSupply) * 100;

            if (!cancelled) {
              setSupplyHeld({
                top10: top10Percent,
                top20: top20Percent,
                top50: top50Percent,
                isLoading: false,
              });
            }
          } else {
            if (!cancelled) {
              setSupplyHeld(prev => ({ ...prev, isLoading: false }));
            }
          }
        } catch (error) {
          console.error('Failed to fetch supply held:', error);
          if (!cancelled) {
            setSupplyHeld(prev => ({ ...prev, isLoading: false }));
          }
        }

        // Fetch smart contract holder share
        try {
          setSmartContractHolderShare(prev => ({ ...prev, isLoading: true }));
          
          const tokenInfo = await fetchJson(`${base}/tokens/${apiTokenAddress}`);
          const totalSupply = Number(tokenInfo?.total_supply || 0);
          
          if (totalSupply > 0) {
            // Fetch top 20 holders
            const holdersResponse = await fetchJson(`${base}/tokens/${apiTokenAddress}/holders?limit=20`);
            const holders = Array.isArray(holdersResponse?.items) ? holdersResponse.items : [];
            const top20 = holders.slice(0, 20);

            // Check which holders are smart contracts
            const contractChecks = await Promise.allSettled(
              top20.map((h: any) => {
                const address = h.address?.hash || h.address || '';
                return address ? pulsechainApiService.getAddressInfo(address) : Promise.resolve(null);
              })
            );

            let contractCount = 0;
            let contractBalance = 0;
            contractChecks.forEach((res, idx) => {
              if (res.status === 'fulfilled' && res.value?.is_contract) {
                contractCount += 1;
                contractBalance += Number(top20[idx]?.value || 0);
              }
            });

            const percent = totalSupply > 0 ? (contractBalance / totalSupply) * 100 : 0;

            if (!cancelled) {
              setSmartContractHolderShare({
                percent,
                contractCount,
                isLoading: false,
              });
            }
          } else {
            if (!cancelled) {
              setSmartContractHolderShare(prev => ({ ...prev, isLoading: false }));
            }
          }
        } catch (error) {
          console.error('Failed to fetch smart contract holder share:', error);
          if (!cancelled) {
            setSmartContractHolderShare(prev => ({ ...prev, isLoading: false }));
          }
        }
      } catch (error) {
        console.error('Failed to load metrics:', error);
      }
    };

    loadMetrics();
    return () => { cancelled = true; };
  }, [apiTokenAddress]);

  const formatAbbrev = (value: number): string => {
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}b`;
    if (abs >= 1_000_000) {
      const millions = abs / 1_000_000;
      // If millions >= 1000, show as billions instead
      if (millions >= 1000) return `${sign}${(millions / 1000).toFixed(1)}b`;
      return `${sign}${millions.toFixed(1)}m`;
    }
    if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}k`;
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  };

  // Handle sidebar search button click
  useEffect(() => {
    const handleOpenSearch = () => {
      searchInputRef.current?.focus();
    };
    window.addEventListener('openAICodeSearch', handleOpenSearch);
    return () => window.removeEventListener('openAICodeSearch', handleOpenSearch);
  }, []);

  // Handle URL parameters - load token when address is in URL
  useEffect(() => {
    if (addressFromQuery && /^0x[a-fA-F0-9]{40}$/.test(addressFromQuery)) {
      setApiTokenAddress(addressFromQuery);
      setSearchInput(addressFromQuery);
    }
  }, [addressFromQuery]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('geicko-ui-preset');
    if (stored === 'rabby1' || stored === 'classic') {
      setUiPreset(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('geicko-ui-preset', uiPreset);
  }, [uiPreset]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleCustomPresetChange = (event: Event) => {
      const customEvent = event as CustomEvent<'classic' | 'rabby1'>;
      const preset = customEvent.detail;
      if (preset === 'classic' || preset === 'rabby1') {
        setUiPreset(preset);
      }
    };

    const handleStoragePresetChange = (event: StorageEvent) => {
      if (event.key === 'geicko-ui-preset' && (event.newValue === 'classic' || event.newValue === 'rabby1')) {
        setUiPreset(event.newValue);
      }
    };

    window.addEventListener('geicko-ui-preset-change', handleCustomPresetChange as EventListener);
    window.addEventListener('storage', handleStoragePresetChange);

    return () => {
      window.removeEventListener('geicko-ui-preset-change', handleCustomPresetChange as EventListener);
      window.removeEventListener('storage', handleStoragePresetChange);
    };
  }, []);

  const websiteCandidates = [
    ...(profileData?.profile?.websites || []),
    ...(profileData?.profile?.cmsLinks || []),
    ...(dexScreenerData?.pairs?.[0]?.info?.websites || []),
  ] as Array<{ label?: string; url?: string }>;

  const socialSources = [
    ...(profileData?.profile?.socials || []),
    ...(dexScreenerData?.pairs?.[0]?.info?.socials || []),
  ] as Array<{ type?: string; label?: string; url?: string }>;

  const uniqueWebsites: Array<{ label?: string; url?: string }> = useMemo(() => {
    const map = new Map<string, { label?: string; url?: string }>();
    websiteCandidates.forEach((link) => {
      if (link?.url) {
        map.set(link.url.toLowerCase(), { label: link.label, url: link.url });
      }
    });
    return Array.from(map.values());
  }, [websiteCandidates]);

  const uniqueSocials: Array<{ type?: string; label?: string; url?: string }> = useMemo(() => {
    const map = new Map<string, { type?: string; label?: string; url?: string }>();
    socialSources.forEach((link) => {
      if (link?.url) {
        map.set(link.url.toLowerCase(), { type: link.type, label: link.label, url: link.url });
      }
    });
    return Array.from(map.values());
  }, [socialSources]);

  const websiteLink = uniqueWebsites[0]?.url || null;

  const findSocialLink = (keywords: string[]): string | null => {
    const lowered = keywords.map((keyword) => keyword.toLowerCase());
    const match = uniqueSocials.find((source) => {
      const values = [
        (source?.type || '').toLowerCase(),
        (source?.label || '').toLowerCase(),
        (source?.url || '').toLowerCase(),
      ];
      return values.some((value) => lowered.some((keyword) => value.includes(keyword)));
    });
    return match?.url || null;
  };

  const twitterLink = findSocialLink(['twitter', 'x.com']);
  const telegramLink = findSocialLink(['telegram', 't.me']);

  useEffect(() => {
    if (activeSocialTab === 'Website' && !websiteLink) {
      if (twitterLink) {
        setActiveSocialTab('Twitter');
        return;
      }
      if (telegramLink) {
        setActiveSocialTab('Telegram');
        return;
      }
      if (activeSocialTab !== null) {
        setActiveSocialTab(null);
      }
      return;
    }
    if (activeSocialTab === 'Twitter' && !twitterLink) {
      if (telegramLink) {
        setActiveSocialTab('Telegram');
        return;
      }
      if (websiteLink) {
        setActiveSocialTab('Website');
        return;
      }
      if (activeSocialTab !== null) {
        setActiveSocialTab(null);
      }
      return;
    }
    if (activeSocialTab === 'Telegram' && !telegramLink) {
      if (websiteLink) {
        setActiveSocialTab('Website');
        return;
      }
      if (twitterLink) {
        setActiveSocialTab('Twitter');
        return;
      }
      if (activeSocialTab !== null) {
        setActiveSocialTab(null);
      }
      return;
    }
    if (!activeSocialTab) {
      if (websiteLink) {
        setActiveSocialTab('Website');
      } else if (twitterLink) {
        setActiveSocialTab('Twitter');
      } else if (telegramLink) {
        setActiveSocialTab('Telegram');
      } else if (activeSocialTab !== null) {
        setActiveSocialTab(null);
      }
    }
  }, [websiteLink, twitterLink, telegramLink, activeSocialTab]);

  const isRabbyUI = uiPreset === 'rabby1';
  const primaryPair = dexScreenerData?.pairs?.[0] || null;
  const baseSymbol = primaryPair?.baseToken?.symbol || dexScreenerData?.tokenInfo?.symbol || tokenInfo?.symbol || 'Token';
  const quoteSymbol = primaryPair?.quoteToken?.symbol || 'WPLS';
  const tokenNameDisplay = dexScreenerData?.tokenInfo?.name || tokenInfo?.name || primaryPair?.baseToken?.name || 'Token';
  const headerImageUrl = profileData?.profile?.headerImageUrl || primaryPair?.info?.imageUrl || '/app-pics/clean.png';
  const tokenLogoSrc =
    profileData?.profile?.logo ||
    profileData?.profile?.iconImageUrl ||
    dexScreenerData?.tokenInfo?.logoURI ||
    primaryPair?.baseToken?.logoURI ||
    primaryPair?.info?.imageUrl ||
    '';
  const priceUsd = Number(primaryPair?.priceUsd || 0);
  const priceChange = Number(primaryPair?.priceChange?.h24 || 0);
  const formattedPrice = priceUsd >= 1 ? priceUsd.toFixed(4) : priceUsd.toFixed(6);
  const marketCapValue = Number(primaryPair?.marketCap ?? primaryPair?.fdv ?? 0);
  const formattedMarketCap = formatMarketCapLabel(marketCapValue);
  const heroTagline = formatWebsiteDisplay(websiteLink) || profileData?.profile?.header || primaryPair?.info?.header || tokenNameDisplay;
  const socialTabs: Array<{ label: string; url: string | null }> = [
    { label: 'Website', url: websiteLink },
    { label: 'Twitter', url: twitterLink },
    { label: 'Telegram', url: telegramLink },
  ];
  const hasSocialLinks = socialTabs.some((tab) => Boolean(tab.url));
  const addressItems: Array<{ label: string; address: string }> = primaryPair
    ? [
        { label: 'POOL', address: primaryPair.pairAddress },
        { label: (baseSymbol || 'TOKEN').toUpperCase(), address: primaryPair.baseToken?.address || '' },
        { label: (quoteSymbol || 'QUOTE').toUpperCase(), address: primaryPair.quoteToken?.address || '' },
      ].filter((item): item is { label: string; address: string } => Boolean(item.address))
    : [];

  const handleSocialTabClick = useCallback((label: string, url?: string | null) => {
    if (!url) return;
    setActiveSocialTab(label);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const handleCopyAddress = useCallback((value?: string) => {
    if (!value) return;
    if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(value);
    }
  }, []);

  const openExternalLink = useCallback((url: string) => {
    if (typeof window === 'undefined') return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const openPortfolioSettings = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('open-portfolio-settings', '1');
    }
    router.push('/portfolio');
  }, [router]);

  const tabOptions: Array<{ id: typeof activeTab; label: string }> = [
    { id: 'chart', label: 'Chart' },
    { id: 'transactions', label: 'Txns' },
    { id: 'holders', label: 'Holders' },
    { id: 'liquidity', label: 'Liquidity' },
    { id: 'contract', label: 'Code' },
    { id: 'switch', label: 'Switch' },
  ];


  const rabbyActions = [
    {
      label: 'Swap',
      icon: '⇄',
      description: 'Trade instantly',
      onClick: () => setActiveTab('switch'),
    },
    {
      label: 'Transactions',
      icon: '🕒',
      description: 'Latest activity',
      onClick: () => setActiveTab('transactions'),
    },
    {
      label: 'Holders',
      icon: '👥',
      description: 'Top wallets',
      onClick: () => setActiveTab('holders'),
    },
    {
      label: 'Code',
      icon: '{ }',
      description: 'Contract view',
      onClick: () => setActiveTab('contract'),
    },
    {
      label: 'Bridge',
      icon: '🌉',
      description: 'PulseChain hub',
      onClick: () => openExternalLink('https://bridge.pulsechain.com/'),
    },
    // {
    //   label: 'Settings',
    //   icon: '⚙️',
    //   description: 'Personalize UI',
    //   onClick: openPortfolioSettings,
    // },
  ];

  if (isRabbyUI) {
    const walletAddress = apiTokenAddress;
    const displayAddress = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : '0x—';
    const heroPrice = Number(primaryPair?.priceUsd || 0);
    const heroPriceDisplay = heroPrice ? `$${heroPrice.toFixed(heroPrice >= 1 ? 2 : 4)}` : '$0.0000';
    const heroChangeDisplay = formatPercentChange(priceChange);
    const heroVolumeDisplay = formatCurrencyCompact(primaryPair?.volume?.h24);
    const heroLiquidityDisplay = formatCurrencyCompact(primaryPair?.liquidity?.usd);
    const limitedTransactions = transactions.slice(0, 4);
    const sparklinePath = 'M0 80 C80 20 160 110 240 50 C320 90 400 30 480 70';

    return (
      <>
        <div className="min-h-screen bg-[#eef2ff] text-[#0f172a]">
          <header className="bg-[#1c2cf8] text-white px-4 py-5 sm:px-8 sm:py-7 shadow-[0_20px_60px_rgba(28,44,248,0.35)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-lg font-semibold">
                  <span role="img" aria-label="ledger">👛</span>
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-wide">Ledger 1</p>
                  <button
                    onClick={() => handleCopyAddress(walletAddress)}
                    className="text-xs text-white/70 hover:text-white transition-colors inline-flex items-center gap-1"
                  >
                    {displayAddress}
                    <span className="text-white/60">⧉</span>
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* <button
                  onClick={openPortfolioSettings}
                  className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-lg"
                  title="Settings"
                >
                  ⚙️
                </button> */}
                <button
                  onClick={() => setActiveTab('transactions')}
                  className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-lg"
                  title="History"
                >
                  ⟳
                </button>
              </div>
            </div>

            <div className="relative mt-6 rounded-[24px] bg-[#2334ff] border border-white/15 p-5 shadow-[0_15px_40px_rgba(15,15,40,0.35)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/70">Portfolio</p>
                  <p className="text-4xl font-black tracking-tight mt-1">{heroPriceDisplay}</p>
                  <p className={`text-sm font-semibold ${priceChange >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
                    {heroChangeDisplay}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('switch')}
                  className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center"
                  title="Open chart"
                >
                  →
                </button>
              </div>
              <div className="mt-5 h-24 rounded-3xl bg-white/5 border border-white/10 overflow-hidden">
                <svg viewBox="0 0 500 120" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="rabbyLine" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#8bf7ff" />
                      <stop offset="100%" stopColor="#4de88d" />
                    </linearGradient>
                  </defs>
                  <path
                    d={sparklinePath}
                    fill="none"
                    stroke="url(#rabbyLine)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    opacity="0.9"
                  />
                </svg>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-xs text-white/80">
                <div className="rounded-2xl bg-white/10 px-3 py-2 flex items-center justify-between">
                  <span>Liquidity</span>
                  <span className="font-semibold text-white">{heroLiquidityDisplay}</span>
                </div>
                <div className="rounded-2xl bg-white/10 px-3 py-2 flex items-center justify-between">
                  <span>Volume 24h</span>
                  <span className="font-semibold text-white">{heroVolumeDisplay}</span>
                </div>
              </div>
              {apiTokenAddress && (
                <button
                  onClick={() => handleCopyAddress(apiTokenAddress)}
                  className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition-colors bg-[#2334ff]/50 backdrop-blur-sm px-2 py-1 rounded-lg"
                  title="Copy contract address"
                >
                  <span className="font-mono">{apiTokenAddress.slice(0, 6)}...{apiTokenAddress.slice(-4)}</span>
                  <Copy className="w-3.5 h-3.5 text-blue-400" />
                </button>
              )}
            </div>
          </header>

          <main className="px-4 sm:px-8 -mt-10 pb-12 space-y-5">
            <section className="bg-white rounded-[28px] shadow-[0_20px_60px_rgba(15,23,42,0.08)] p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {rabbyActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={action.onClick}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 px-3 py-3 text-left hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
                  >
                    <span className="text-lg text-indigo-500">{action.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{action.label}</p>
                      <p className="text-xs text-slate-500">{action.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-[0_12px_40px_rgba(15,23,42,0.08)] px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-semibold">
                  $
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">PLS price</p>
                  <p className="text-base font-semibold text-slate-900">{heroPriceDisplay}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-semibold">
                  ⛽
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">Gas</p>
                  <p className="text-base font-semibold text-slate-900">
                    {(Math.max(0.001, (primaryPair?.txns?.m5?.buys || 0) / 1000) + 0.0028).toFixed(4)} Gwei
                  </p>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-[0_12px_40px_rgba(15,23,42,0.08)] px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500">📦</div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">No Dapp found</p>
                  <p className="text-xs text-slate-500">Connect a dapp to get started.</p>
                </div>
              </div>
              <button
                onClick={() => router.push('/apps')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Explore →
              </button>
            </section>

            <section className="bg-white rounded-2xl shadow-[0_18px_50px_rgba(15,23,42,0.08)] px-4 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Recent Transactions</h3>
                <button
                  onClick={() => setActiveTab('transactions')}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  View all
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {limitedTransactions.length > 0 ? (
                  limitedTransactions.map((tx, idx) => (
                    <div key={`${tx.txHash}-${idx}`} className="flex items-center justify-between rounded-2xl border border-slate-100 px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{tx.type.toUpperCase()}</p>
                        <p className="text-xs text-slate-500">{formatDateUTC(tx.timestamp)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          ${tx.valueUsd?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || '—'}
                        </p>
                        <a
                          href={`https://scan.pulsechain.box/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-500 hover:text-indigo-700"
                        >
                          View →
                        </a>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500">
                    No transactions yet. Perform a swap to see history here.
                  </div>
                )}
              </div>
            </section>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-black via-[#0b0b14] to-black text-white font-sans px-2 md:px-3 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-16 h-64 w-64 bg-gradient-to-br from-blue-700/30 via-cyan-500/10 to-transparent blur-3xl" />
          <div className="absolute top-10 right-0 h-72 w-72 bg-gradient-to-bl from-purple-700/25 via-fuchsia-500/10 to-transparent blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 h-56 w-56 bg-gradient-to-tr from-emerald-600/20 via-teal-500/10 to-transparent blur-3xl" />
        </div>
      {/* Header Section */}
      <header className="relative bg-gray-900 border-b border-gray-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-2 md:px-3 py-2 gap-2">
          {/* Title with Logo */}
          <div className="flex items-center gap-2">
            <img
              src="/LogoVector.svg"
              alt="Morbius Logo"
              className="w-6 h-6"
            />
            <h1 className="text-white text-lg font-semibold">
              <span className="text-xl sm:text-2xl font-bold text-purple-700">Morbius</span>{' '}
              Token Analyzer
            </h1>
          </div>

          {/* Get Morbius Button - Absolute positioned */}
          <a
            href="https://pump.tires/token/0xB7d4eB5fDfE3d4d3B5C16a44A49948c6EC77c6F1"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-1/2 -translate-y-1/2 right-2 px-2.5 py-1 bg-purple-700/40 backdrop-blur hover:bg-purple-700/50 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap z-10"
          >
            Get Morbius
          </a>

        </div>
      </header>

      {/* Mobile Token Header - Top Position */}
      <div className="sm:hidden px-2 mb-2 mt-0">
        {isLoadingData ? (
          <div className="flex items-center justify-center py-4">
            <LoaderThree />
          </div>
        ) : dexScreenerData?.pairs?.[0] ? (
          <div className="relative flex gap-2 min-h-[140px] pt-0 rounded-lg overflow-hidden">
            {/* Left side: Token info */}
            <div className="flex-1 min-w-0">
              {/* Ticker and Name */}
              <div className="absolute z-10 left-0 top-0 text-left mb-0">
                <div className="bg-black/10 backdrop-blur-lg rounded-xs p-2">
                  <div className="text-md font-bold text-white">
                    {dexScreenerData?.tokenInfo?.symbol || dexScreenerData.pairs[0].baseToken?.symbol} / {dexScreenerData.pairs[0].quoteToken?.symbol}
                  </div>
                  <div className="text-xs text-gray-400">
                    {dexScreenerData?.tokenInfo?.name || tokenInfo?.name || dexScreenerData.pairs[0].baseToken?.name || 'Token'}
                  </div>
                </div>
              </div>

              {/* Token Logo - Centered below ticker/name */}
              <div className="absolute z-20 left-6 bottom-0 bg-black/30 backdrop-blur-xs rounded-full p-2 mb-1">
                {(dexScreenerData?.tokenInfo?.logoURI || dexScreenerData?.pairs?.[0]?.baseToken?.logoURI || dexScreenerData?.pairs?.[0]?.info?.imageUrl) ? (
                  <img
                    src={dexScreenerData?.tokenInfo?.logoURI || dexScreenerData?.pairs?.[0]?.baseToken?.logoURI || dexScreenerData?.pairs?.[0]?.info?.imageUrl}
                    alt={`${dexScreenerData?.tokenInfo?.symbol || dexScreenerData.pairs[0].baseToken?.symbol} logo`}
                    className="w-16 h-16 rounded-full bg-gray-950"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center ${(dexScreenerData?.tokenInfo?.logoURI || dexScreenerData?.pairs?.[0]?.baseToken?.logoURI || dexScreenerData?.pairs?.[0]?.info?.imageUrl) ? 'hidden' : ''}`}>
                  <span className="text-white font-bold text-xl">
                    {dexScreenerData?.tokenInfo?.symbol?.charAt(0) || dexScreenerData.pairs[0].baseToken?.symbol?.charAt(0) || 'T'}
                  </span>
                </div>
              </div>

              {/* Current Price */}
              <div className="absolute right-4 top-2">
                <div className="text-xl font-bold text-white">
                  ${Number(dexScreenerData.pairs[0].priceUsd || 0).toFixed(6)}
                </div>
                <div className={`text-md ${(dexScreenerData.pairs[0].priceChange?.h24 || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(dexScreenerData.pairs[0].priceChange?.h24 || 0) >= 0 ? '↑' : '↓'}
                  {Math.abs(dexScreenerData.pairs[0].priceChange?.h24 || 0).toFixed(2)}%
                </div>
                <div className="text-lg font-bold text-gray-300">
                  {dexScreenerData.pairs[0].marketCap
                    ? (() => {
                        const marketCap = Number(dexScreenerData.pairs[0].marketCap);
                        if (marketCap >= 1000000) {
                          return `${(marketCap / 1000000).toFixed(2)}M MCAP`;
                        } else {
                          const rounded = Math.round(marketCap / 1000) * 1000;
                          return `$${(rounded / 1000).toFixed(0)}k MCAP`;
                        }
                      })()
                    : 'MCAP N/A'}
                </div>
              </div>
            </div>

            {/* Background - Zoomed Logo with Overlay */}
            <div className="absolute inset-0 w-full h-full overflow-hidden -z-10">
              {(dexScreenerData?.tokenInfo?.logoURI || dexScreenerData?.pairs?.[0]?.baseToken?.logoURI || dexScreenerData?.pairs?.[0]?.info?.imageUrl) ? (
                <>
                  <img
                    src={dexScreenerData?.tokenInfo?.logoURI || dexScreenerData?.pairs?.[0]?.baseToken?.logoURI || dexScreenerData?.pairs?.[0]?.info?.imageUrl}
                    alt="Background Logo"
                    className="w-full h-full object-cover blur-xl scale-150 opacity-50"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/70" />
                </>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" />
              )}
            </div>
            {apiTokenAddress && (
              <button
                onClick={() => handleCopyAddress(apiTokenAddress)}
                className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition-colors bg-black/30 backdrop-blur-sm px-2 py-1 rounded-lg"
                title="Copy contract address"
              >
                <span className="font-mono">{apiTokenAddress.slice(0, 6)}...{apiTokenAddress.slice(-4)}</span>
                <Copy className="w-3.5 h-3.5 text-blue-400" />
              </button>
            )}
          </div>
        ) : (
          <div className="text-xs text-gray-400 py-4">No token data available</div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex flex-col md:flex-row items-start">
        {/* Left Panel - Chart Section */}
        <div className="w-full md:flex-[3] min-w-0 bg-black">

          {/* Token Stats - Mobile Only (Above Chart) */}
          <div className="sm:hidden px-2 mb-3 bg-gradient-to-br from-black via-[#0b0b14] to-black -mx-2 px-2">
            <div className="grid grid-cols-2 gap-3">
              {/* Left Column */}
              <div className="space-y-3">
                {/* Social Icons */}
                {(() => {
                  const websiteLink = profileData?.profile?.websites?.[0];
                  const twitterLink = profileData?.profile?.socials?.find((s: any) => s.type === 'twitter');
                  const discordLink = profileData?.profile?.socials?.find((s: any) => s.type === 'discord');
                  const telegramLink = profileData?.profile?.socials?.find((s: any) => s.type === 'telegram');
                  const scanLink = apiTokenAddress ? `https://scan.pulsechain.box/token/${apiTokenAddress}` : null;

                  if (!websiteLink && !twitterLink && !discordLink && !telegramLink && !scanLink) return null;

                  return (
                    <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Socials</div>
                      <div className="grid grid-cols-5 gap-2">
                        {websiteLink && (
                          <a
                            href={websiteLink.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg p-2.5 transition-all"
                            title="Website"
                          >
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                          </a>
                        )}
                        {twitterLink && (
                          <a
                            href={twitterLink.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg p-2.5 transition-all"
                            title="X.com"
                          >
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                            </svg>
                          </a>
                        )}
                        {telegramLink && (
                          <a
                            href={telegramLink.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg p-2.5 transition-all"
                            title="Telegram"
                          >
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                            </svg>
                          </a>
                        )}
                        {discordLink && (
                          <a
                            href={discordLink.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg p-2.5 transition-all"
                            title="Discord"
                          >
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                            </svg>
                          </a>
                        )}
                        {scanLink && (
                          <a
                            href={scanLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg p-2.5 transition-all"
                            title="View on PulseChain Explorer"
                          >
                            <span className="text-sm text-white">.box</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {dexScreenerData?.pairs?.[0] && (
                  <>
                    {/* Supply & Token Info */}
                    <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Supply Info</div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400 font-medium">Total Supply</span>
                          <span className="text-sm text-white font-semibold">
                            {totalSupply ? (() => {
                              const supply = Number(totalSupply.supply) / Math.pow(10, totalSupply.decimals);
                              return formatAbbrev(supply);
                            })() : '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400 font-medium">Circulating</span>
                          <span className="text-sm text-white font-semibold">
                            {totalSupply ? (() => {
                              const supply = Number(totalSupply.supply) / Math.pow(10, totalSupply.decimals);
                              const burned = burnedTokens?.amount ?? 0;
                              const circulating = Math.max(0, supply - burned);
                              return formatAbbrev(circulating);
                            })() : '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400 font-medium">Holders</span>
                          <span className="text-sm text-white font-semibold">
                            {holdersCount !== null ? (holdersCount >= 1000 ? `${(holdersCount / 1000).toFixed(1)}k` : holdersCount) : '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400 font-medium">Creation Date</span>
                          <span className="text-sm text-white font-semibold">{creationDate || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Supply Held */}
                    <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Supply Held</div>
                      {supplyHeld.isLoading ? (
                        <div className="text-center text-gray-500 text-sm">Loading...</div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 font-medium">Top 10</span>
                            <span className="text-sm text-white font-semibold">
                              {supplyHeld.top10 > 0 ? `${Math.round(supplyHeld.top10)}%` : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 font-medium">Top 20</span>
                            <span className="text-sm text-white font-semibold">
                              {supplyHeld.top20 > 0 ? `${Math.round(supplyHeld.top20)}%` : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 font-medium">Top 50</span>
                            <span className="text-sm text-white font-semibold">
                              {supplyHeld.top50 > 0 ? `${Math.round(supplyHeld.top50)}%` : '—'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Smart Contract Holder Share */}
                    <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Smart Contract Holder Share</div>
                      {smartContractHolderShare.isLoading ? (
                        <div className="text-center text-gray-500 text-sm">Loading...</div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 font-medium">Share</span>
                            <span className="text-sm text-white font-semibold">
                              {smartContractHolderShare.percent > 0 ? `${smartContractHolderShare.percent.toFixed(2)}%` : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 font-medium">Contracts</span>
                            <span className="text-sm text-white font-semibold">
                              {smartContractHolderShare.contractCount > 0 ? smartContractHolderShare.contractCount : '—'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Right Column */}
              <div className="space-y-3">
                {dexScreenerData?.pairs?.[0] && (
                  <>
                    {/* Ownership Status */}
                    <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Ownership</div>
                      {ownershipData.isLoading ? (
                        <div className="text-center text-gray-500 text-sm">Loading...</div>
                      ) : (ownershipData.isRenounced || ownershipData.creatorAddress?.toLowerCase() === PUMP_TIRES_CREATOR.toLowerCase()) ? (
                        <div className="text-center">
                          <div className="text-base text-green-400 font-semibold">Renounced ✓</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {ownershipData.creatorAddress?.toLowerCase() === PUMP_TIRES_CREATOR.toLowerCase() ? 'Pump.Tires' : 'No Owner'}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="text-base text-red-400 font-semibold">Not Renounced</div>
                          {ownershipData.ownerAddress && (
                            <a
                              href={`https://scan.pulsechain.box/address/${ownershipData.ownerAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 font-mono mt-0.5 inline-block"
                              title={ownershipData.ownerAddress}
                            >
                              ...{ownershipData.ownerAddress.slice(-6)}
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Creator Address */}
                    {ownershipData.creatorAddress && (
                      <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Creator</div>
                        <div className="text-center">
                          {ownershipData.creatorAddress.toLowerCase() === PUMP_TIRES_CREATOR.toLowerCase() ? (
                            <a
                              href={`https://pump.tires/token/${apiTokenAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                              title="View on Pump.Tires"
                            >
                              Pump.Tires
                            </a>
                          ) : (
                            <a
                              href={`https://scan.pulsechain.box/address/${ownershipData.creatorAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 font-mono"
                              title={ownershipData.creatorAddress}
                            >
                              {ownershipData.creatorAddress.slice(0, 6)}...{ownershipData.creatorAddress.slice(-4)}
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Liquidity */}
                    <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg py-0 px-3 min-h-[60px] flex items-center justify-center">
                      <div className="absolute top-2 left-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Liquidity</div>
                      <div className="text-center text-base text-white font-semibold">
                        {(() => {
                          const usdLiquidity = Number(dexScreenerData.pairs[0].liquidity?.usd || 0);
                          return usdLiquidity > 0 ? `$${formatAbbrev(usdLiquidity)}` : '—';
                        })()}
                      </div>
                    </div>

                    {/* Liq/MCAP Ratio */}
                    <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg py-0 px-3 min-h-[60px] flex items-center justify-center">
                      <div className="absolute top-2 left-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Liq/MCAP</div>
                      <div className="text-center text-base text-white font-semibold">
                        {(() => {
                          const liquidity = Number(dexScreenerData.pairs[0].liquidity?.usd || 0);
                          const marketCap = Number(dexScreenerData.pairs[0].marketCap || 0);
                          if (marketCap > 0) {
                            const ratio = (liquidity / marketCap) * 100;
                            return `${ratio.toFixed(2)}%`;
                          }
                          return '—';
                        })()}
                      </div>
                    </div>

                    {/* Total Liquidity */}
                    <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg py-0 px-3 min-h-[80px] flex items-center justify-center">
                      <div className="absolute top-2 left-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Total Liquidity</div>
                      {totalLiquidity.isLoading ? (
                        <div className="text-center text-gray-500 text-sm">Loading...</div>
                      ) : (
                        <div className="text-center text-base text-white font-semibold">
                          {totalLiquidity.usd > 0 ? `$${formatAbbrev(totalLiquidity.usd)}` : '—'}
                        </div>
                      )}
                      {totalLiquidity.pairCount > 0 && (
                        <div className="absolute top-2 right-3 text-xs text-gray-400 font-medium">
                          {totalLiquidity.pairCount} {totalLiquidity.pairCount === 1 ? 'Pair' : 'Pairs'}
                        </div>
                      )}
                    </div>

                    {/* Burned Tokens */}
                    <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg py-0 px-3 min-h-[60px] flex items-center justify-center">
                      <div className="absolute top-2 left-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Burned</div>
                      {burnedTokens ? (
                        <div className="text-center">
                          <div className="text-base text-white font-semibold">{formatAbbrev(burnedTokens.amount)}</div>
                        </div>
                      ) : (
                        <div className="text-center text-base text-white font-semibold">—</div>
                      )}
                      {burnedTokens && (
                        <div className="absolute top-4 right-2 flex items-center justify-center w-9 h-9 rounded-full border-2 border-green-400">
                          <span className="text-[10px] text-green-400 font-semibold">{burnedTokens.percent.toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* More Info Button */}
            {dexScreenerData?.pairs?.[0] && (
              <div className="mt-6">
                <button
                  onClick={() => setIsStatsModalOpen(true)}
                  className="relative w-full overflow-hidden text-xs text-blue-200 hover:text-white font-semibold py-2 rounded-lg border border-cyan-400/40 bg-gradient-to-r from-blue-900/40 via-purple-900/30 to-cyan-900/40 shadow-[0_0_15px_rgba(59,130,246,0.6),0_0_25px_rgba(168,85,247,0.45)] transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.85),0_0_40px_rgba(168,85,247,0.7)]"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-cyan-400/10 via-transparent to-purple-400/10 blur-md" aria-hidden="true" />
                  <span className="pointer-events-none relative">View More Stats →</span>
                  <span className="pointer-events-none absolute -left-10 top-0 h-0.5 w-2/3 bg-gradient-to-r from-transparent via-cyan-300 to-transparent animate-pulse" aria-hidden="true" />
                  <span className="pointer-events-none absolute -right-10 bottom-0 h-0.5 w-2/3 bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-pulse" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          {/* Bottom Tabs */}
          <div className="px-2 md:px-3 pt-4 pb-3 mt-4 relative z-30">
            {isRabbyUI ? (
              <div className="flex flex-wrap gap-2 overflow-x-auto bg-gray-950/70 border border-white/5 rounded-2xl px-2 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.6)] scrollbar-hide">
                {tabOptions.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const accent = tab.id === 'chart'
                    ? 'from-blue-500 to-cyan-500'
                    : tab.id === 'transactions'
                    ? 'from-violet-500 to-pink-500'
                    : tab.id === 'holders'
                      ? 'from-emerald-400 to-teal-500'
                        : tab.id === 'contract'
                          ? 'from-slate-300 to-slate-500'
                          : 'from-lime-400 to-emerald-500';
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative flex items-center px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors duration-200 ${
                        isActive
                          ? 'text-white border-white/30 bg-white/5 shadow-[0_0_15px_rgba(255,255,255,0.12)]'
                          : 'text-slate-400 border-transparent hover:border-white/10 hover:bg-white/5'
                      }`}
                    >
                      {tab.label}
                      {isActive && (
                        <span
                          className={`absolute inset-x-2 -bottom-1 h-0.5 rounded-full bg-gradient-to-r ${accent}`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 overflow-x-auto text-[11px] sm:text-xs scrollbar-hide">
                {tabOptions.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const accent = tab.id === 'chart'
                    ? 'from-blue-500/70 to-cyan-500/80'
                    : tab.id === 'transactions'
                    ? 'from-violet-500/70 to-indigo-500/80'
                    : tab.id === 'holders'
                      ? 'from-emerald-400/70 to-teal-500/80'
                    : tab.id === 'contract'
                      ? 'from-slate-300/70 to-slate-500/80'
                      : 'from-lime-400/70 to-emerald-500/80';
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center px-3 py-1.5 rounded-full border transition-all duration-200 ${
                        isActive
                          ? `text-white border-white/40 bg-gradient-to-r ${accent} shadow-[0_0_25px_rgba(255,255,255,0.25)]`
                          : 'text-slate-300 border-white/10 bg-white/5 hover:border-white/30 hover:text-white'
                      }`}
                    >
                      <span className="font-semibold tracking-wide uppercase">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Content Tables */}
          <div className="px-2 md:px-3 py-1 min-w-0">
            <div className="bg-gray-900 rounded border border-gray-800 h-[400px] sm:h-[450px] md:h-[500px] lg:h-[550px] xl:h-[600px] overflow-y-auto overflow-x-auto min-w-0 relative z-20">
              {/* Chart Tab */}
              {activeTab === 'chart' && (
                <div className="h-full flex items-center justify-center">
                  {isLoadingData ? (
                    <div className="text-center">
                      <LoaderThree />
                      <p className="text-gray-400 text-xs mt-2">Loading chart...</p>
                    </div>
                  ) : dexScreenerData?.pairs?.[0]?.pairAddress ? (
                    <div className="w-full h-full">
                      <DexScreenerChart pairAddress={dexScreenerData.pairs[0].pairAddress} />
                    </div>
                  ) : (
                    <div className="text-center text-gray-500">
                      <div className="text-xs mb-1"></div>
                      <div className="text-xs">No chart data available</div>
                    </div>
                  )}
                </div>
              )}

              {/* Switch Tab - Only visible on mobile */}
              {activeTab === 'switch' && (
                <div className="h-full flex items-center justify-center p-4">
                  <iframe
                    src={`https://switch.win/widget?network=pulsechain&background_color=000000&font_color=ffffff&secondary_font_color=7a7a7a&border_color=01e401&backdrop_color=transparent&from=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&to=${dexScreenerData?.pairs?.[0]?.baseToken?.address || apiTokenAddress}`}
                    allow="clipboard-read; clipboard-write"
                    width="100%"
                    height="100%"
                    className="border-0 rounded"
                    title="Token Swap Interface"
                  />
                </div>
              )}

              {/* Transactions Tab */}
              {activeTab === 'transactions' && (
                <>
                  {/* Table Header */}
                  <div className="flex items-center px-2 py-1 border-b border-gray-700 text-xs text-gray-300">
                    <div className="flex-[2] min-w-[80px]">Time</div>
                    <div className="flex-[1] min-w-[50px]">Type</div>
                    <div className="flex-[1.5] min-w-[60px]">Amount</div>
                    <div className="flex-[1.5] min-w-[60px]">Price USD</div>
                    <div className="flex-[1.5] min-w-[70px]">Value USD</div>
                    <div className="flex-[2] min-w-[80px]">From</div>
                    <div className="flex-[0.8] min-w-[40px] text-center">Tx</div>
                  </div>

                  {/* Table Rows */}
                  <div className="divide-y divide-gray-700">
                    {isLoadingTransactions ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="text-center">
                          <LoaderThree />
                          <p className="text-gray-400 text-xs mt-2">Loading transactions...</p>
                        </div>
                      </div>
                    ) : transactions.length > 0 ? (
                      transactions.map((tx, index) => (
                        <div key={index} className="flex items-center px-2 py-1 text-xs hover:bg-gray-800/50 transition-colors">
                          <div className="flex-[2] min-w-[80px] text-white text-[10px] truncate">{tx.time}</div>
                          <div className={`flex-[1] min-w-[50px] ${tx.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                            {tx.type}
                          </div>
                          <div className={`flex-[1.5] min-w-[60px] truncate ${tx.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                            {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </div>
                          <div className={`flex-[1.5] min-w-[60px] truncate ${tx.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                            ${tx.priceUsd.toFixed(6)}
                          </div>
                          <div className={`flex-[1.5] min-w-[70px] truncate ${tx.type === 'BUY' ? 'text-green-300' : 'text-red-300'} font-semibold`}>
                            ${tx.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </div>
                          <div className="flex-[2] min-w-[80px] truncate">
                            <a
                              href={`https://scan.pulsechain.box/address/${tx.from}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 font-mono text-[10px]"
                              title={`View address: ${tx.from}`}
                            >
                              {tx.from ? `${tx.from.slice(0, 6)}...${tx.from.slice(-4)}` : 'Unknown'}
                            </a>
                          </div>
                          <div className="flex-[0.8] min-w-[40px] flex justify-center">
                            <a
                              href={`https://scan.pulsechain.box/tx/${tx.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center p-1 hover:bg-gray-700 rounded transition-colors"
                              title="View transaction on PulseScan"
                            >
                              <svg className="w-3 h-3 text-gray-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-center py-8">
                        <div className="text-center text-gray-400">
                          <div className="text-xl mb-1">📊</div>
                          <div className="text-xs">No transactions available</div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Holders Tab */}
              {activeTab === 'holders' && (
                <>
                  {isLoadingHolders ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <LoaderThree />
                        <p className="text-gray-400 text-xs mt-2">Loading holders...</p>
                      </div>
                    </div>
                  ) : holders.length > 0 ? (
                    <>
                      {/* Table Header */}
                      <div className="flex items-center px-2 py-1 border-b border-gray-700 text-xs text-gray-300">
                        <div className="flex-[0.8] min-w-[40px]">#</div>
                        <div className="flex-[3] min-w-[120px]">Address</div>
                        <div className="flex-[2] min-w-[80px]">Balance</div>
                        <div className="flex-[1.5] min-w-[70px]">% Total</div>
                      </div>

                      {/* Table Rows */}
                      <div className="divide-y divide-gray-700">
                        {(() => {
                          const decimals = tokenInfo?.decimals ? Number(tokenInfo.decimals) : 18;
                          const totalSupply = tokenInfo?.total_supply ? Number(tokenInfo.total_supply) : 0;

                          const startIndex = (holdersPage - 1) * holdersPerPage;
                          const endIndex = startIndex + holdersPerPage;
                          const currentPageHolders = holders.slice(startIndex, endIndex);

                          return currentPageHolders.map((holder, i) => {
                            const globalIndex = startIndex + i + 1;
                            const balance = Number(holder.value) / Math.pow(10, decimals);
                            const percentage = totalSupply > 0 ? (Number(holder.value) / totalSupply) * 100 : 0;
                            const formattedAddress = holder.address ? `${holder.address.slice(0, 10)}...${holder.address.slice(-6)}` : 'Unknown';

                            return (
                              <div key={holder.address || i} className="flex items-center px-2 py-1 text-xs hover:bg-gray-800/50 transition-colors">
                                <div className="flex-[0.8] min-w-[40px] text-white">{globalIndex}</div>
                                <div className="flex-[3] min-w-[120px] flex items-center gap-1 truncate">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenHolderTransfers(holder.address)}
                                    className="text-blue-400 hover:underline cursor-pointer font-mono truncate text-left"
                                  >
                                    {formattedAddress}
                                  </button>
                                  {holder.isContract && (
                                    <span className="px-1 py-0.5 text-xs bg-purple-900/30 text-purple-300 rounded border border-purple-700/30 whitespace-nowrap">
                                      {holder.isVerified ? '✓ Contract' : 'Contract'}
                                    </span>
                                  )}
                                </div>
                                <div className="flex-[2] min-w-[80px] text-white truncate">{balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                                <div className="flex-[1.5] min-w-[70px] text-green-400">{percentage.toFixed(4)}%</div>
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* Pagination Controls */}
                      {holders.length > holdersPerPage && (
                        <div className="flex items-center justify-between px-2 py-2 border-t border-gray-700">
                          <div className="text-xs text-gray-400">
                            Showing {((holdersPage - 1) * holdersPerPage) + 1}-{Math.min(holdersPage * holdersPerPage, holders.length)} of {holders.length}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setHoldersPage(prev => Math.max(1, prev - 1))}
                              disabled={holdersPage === 1}
                              className="px-2 py-0.5 text-xs bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded border border-gray-700 transition-colors"
                            >
                              Prev
                            </button>

                            {/* Page numbers */}
                            {(() => {
                              const totalPages = Math.ceil(holders.length / holdersPerPage);
                              return Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                  pageNum = i + 1;
                                } else if (holdersPage <= 3) {
                                  pageNum = i + 1;
                                } else if (holdersPage >= totalPages - 2) {
                                  pageNum = totalPages - 4 + i;
                                } else {
                                  pageNum = holdersPage - 2 + i;
                                }

                                return (
                                  <button
                                    key={pageNum}
                                    onClick={() => setHoldersPage(pageNum)}
                                    className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                                      holdersPage === pageNum
                                        ? 'bg-gray-700 text-white border-gray-500'
                                        : 'bg-gray-800 hover:bg-gray-700 text-white border-gray-700'
                                    }`}
                                  >
                                    {pageNum}
                                  </button>
                                );
                              });
                            })()}

                            <button
                              onClick={() => setHoldersPage(prev => Math.min(Math.ceil(holders.length / holdersPerPage), prev + 1))}
                              disabled={holdersPage === Math.ceil(holders.length / holdersPerPage)}
                              className="px-2 py-0.5 text-xs bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded border border-gray-700 transition-colors"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center text-gray-400">
                        <div className="text-xl mb-1">👥</div>
                        <div className="text-xs">No holders found</div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Liquidity Tab */}
              {activeTab === 'liquidity' && (
                <LiquidityTab dexScreenerData={dexScreenerData} isLoading={isLoadingData} />
              )}

              {/* Contract Tab */}
              {activeTab === 'contract' && (
                <div>
                  <TokenContractView contractAddress={apiTokenAddress} compact={true} />
                </div>
              )}
            </div>
          </div>

          {/* Token Information Tabs */}
          <div className="px-2 md:px-3 py-2 border-t border-gray-800">

            {/* Links Section - Only show for token tab */}
            {tokenInfoTab === 'token' && (profileData?.profile?.websites?.length > 0 || profileData?.profile?.socials?.length > 0) && (
              <div className="mb-3">
                <div className="text-sm font-semibold text-white mb-2 text-center">Links</div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {/* Websites */}
                    {uniqueWebsites.map((website, index) => (
                      <a
                        key={`website-${index}`}
                        href={website.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-slate-700/60 text-white text-xs sm:text-sm font-semibold rounded-full border border-white/30 backdrop-blur-lg shadow-[0_8px_25px_rgba(0,0,0,0.2)] hover:bg-slate-600/70 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <span>{website.label || 'Website'}</span>
                      </a>
                    ))}

                    {/* Socials */}
                    {uniqueSocials.map((social, index) => {
                      const getIcon = (type: string | undefined) => {
                        if (type === 'twitter') {
                          return (
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                            </svg>
                          );
                        }
                        if (type === 'telegram') {
                          return (
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.692-1.653-1.123-2.678-1.799-1.185-.781-.417-1.21.258-1.911.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                            </svg>
                          );
                        }
                        if (type === 'discord') {
                          return (
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                            </svg>
                          );
                        }
                        return null;
                      };

                      return (
                        <a
                          key={`social-${index}`}
                          href={social.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-slate-700/60 text-white text-xs sm:text-sm font-semibold rounded-full border border-white/30 backdrop-blur-lg shadow-[0_8px_25px_rgba(0,0,0,0.2)] hover:bg-slate-600/70 transition-colors"
                        >
                          {getIcon(social.type)}
                          <span className="capitalize">{social.type ?? 'Link'}</span>
                        </a>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Ask AI */}
            <div className="mb-3 px-0">
              <div className="bg-gray-800 rounded-lg p-2 border border-gray-700/60 min-h-[600px] h-[600px] flex">
                <TokenAIChat contractAddress={apiTokenAddress} compact className="flex-1 h-full" />
              </div>
            </div>

            {/* Quick Audit Section */}
            {tokenInfoTab === 'token' && profileData?.quickAudit && (
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-white mb-2">Quick Audit</h2>

                {(() => {
                  const quickAudit = profileData?.quickAudit;
                  return (
                    <>
                      {/* Contract Information */}
                      <div className="grid grid-cols-1 gap-2 mb-2">
                        <div className="bg-gray-800 rounded p-2">
                          <div className="text-xs text-gray-400 mb-1">Contract Info</div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Name:</span>
                              <span className="text-white font-mono text-xs truncate ml-2">{quickAudit.contractName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Creator:</span>
                              <span className="text-white font-mono text-xs">{quickAudit.contractCreator ? `${quickAudit.contractCreator.slice(0, 6)}...${quickAudit.contractCreator.slice(-4)}` : 'Unknown'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Owner:</span>
                              <span className={`font-mono text-xs ${quickAudit.contractRenounced ? 'text-green-400' : 'text-red-400'}`}>
                                {quickAudit.contractRenounced ? 'Renounced' : (quickAudit.contractOwner ? `${quickAudit.contractOwner.slice(0, 6)}...${quickAudit.contractOwner.slice(-4)}` : 'Unknown')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gray-800 rounded p-2">
                          <div className="text-xs text-gray-400 mb-1">Security</div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Proxy:</span>
                              <span className={quickAudit.isProxy ? 'text-red-400' : 'text-green-400'}>
                                {quickAudit.isProxy ? 'Yes' : 'No'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">External Risk:</span>
                              <span className={quickAudit.hasExternalContractRisk ? 'text-red-400' : 'text-green-400'}>
                                {quickAudit.hasExternalContractRisk ? 'Yes' : 'No'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Suspicious:</span>
                              <span className={quickAudit.hasSuspiciousFunctions ? 'text-red-400' : 'text-green-400'}>
                                {quickAudit.hasSuspiciousFunctions ? 'Yes' : 'No'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Capabilities Grid */}
                      <div className="bg-gray-800 rounded p-2 mb-2">
                        <div className="text-xs text-gray-400 mb-2">Capabilities</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Mint:</span>
                            <span className={quickAudit.canMint ? 'text-red-400' : 'text-green-400'}>
                              {quickAudit.canMint ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Burn:</span>
                            <span className={quickAudit.canBurn ? 'text-yellow-400' : 'text-green-400'}>
                              {quickAudit.canBurn ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Blacklist:</span>
                            <span className={quickAudit.canBlacklist ? 'text-red-400' : 'text-green-400'}>
                              {quickAudit.canBlacklist ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Pause:</span>
                            <span className={quickAudit.canPauseTrading ? 'text-red-400' : 'text-green-400'}>
                              {quickAudit.canPauseTrading ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Fees:</span>
                            <span className={quickAudit.canUpdateFees ? 'text-red-400' : 'text-green-400'}>
                              {quickAudit.canUpdateFees ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Max Wallet:</span>
                            <span className={quickAudit.canUpdateMaxWallet ? 'text-red-400' : 'text-green-400'}>
                              {quickAudit.canUpdateMaxWallet ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Max TX:</span>
                            <span className={quickAudit.canUpdateMaxTx ? 'text-red-400' : 'text-green-400'}>
                              {quickAudit.canUpdateMaxTx ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400">Cooldown:</span>
                            <span className={quickAudit.hasCooldown ? 'text-yellow-400' : 'text-green-400'}>
                              {quickAudit.hasCooldown ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Token Info */}
        <div className="w-full md:flex-[2] min-w-0 bg-gray-900 md:border-l border-gray-800 mt-2 md:mt-0 overflow-hidden">
          {/* Token Header - Hidden on mobile, shown on desktop */}
          <div className="hidden md:block px-0 mb-1">
            {isLoadingData ? (
              <div className="flex items-center justify-center py-4">
                <LoaderThree />
              </div>
            ) : primaryPair ? (
              <div className="px-2 mb-2 pt-0">
                <div className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden shadow-[0_12px_35px_rgba(0,0,0,0.45)]">
                  <div className="px-4 pt-2 pb-3 border-b border-gray-800/70">
                    <div className="mt-0 flex items-end justify-between gap-4">
                      <div>
                        <div className="text-2xl font-bold text-white tracking-tight">
                          {baseSymbol} <span className="text-gray-500">/</span> {quoteSymbol}
                        </div>
                        <div className="text-xs text-gray-400 mt-1 truncate">
                          {tokenNameDisplay}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-semibold text-white">
                          ${formattedPrice}
                        </div>
                        <div className={`text-xs font-semibold ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {priceChange >= 0 ? '↑' : '↓'}
                          {Math.abs(priceChange).toFixed(2)}%
                        </div>
                        <div className="text-[11px] text-gray-400 mt-1">
                          {formattedMarketCap}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="relative h-40 border-b border-gray-800/70 bg-gradient-to-r from-gray-900 via-gray-800 to-black">
                    {headerImageUrl ? (
                      <img
                        src={headerImageUrl}
                        alt={`${tokenNameDisplay} header`}
                        className="w-full h-full object-cover"
                        data-fallback="false"
                        onError={(e) => {
                          if (e.currentTarget.dataset.fallback === 'true') return;
                          e.currentTarget.dataset.fallback = 'true';
                          e.currentTarget.src = '/app-pics/clean.png';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute left-4 bottom-3 flex items-center gap-3">
                      {tokenLogoSrc ? (
                        <img
                          src={tokenLogoSrc}
                          alt={`${tokenNameDisplay} logo`}
                          className="w-10 h-10 rounded-full border border-white/20 bg-black/30 object-cover"
                          data-fallback="false"
                          onError={(e) => {
                            if (e.currentTarget.dataset.fallback === 'true') {
                              e.currentTarget.style.display = 'none';
                              return;
                            }
                            e.currentTarget.dataset.fallback = 'true';
                            e.currentTarget.src = '/LogoVector.svg';
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-900/80 border border-white/10 flex items-center justify-center text-white font-bold">
                          {baseSymbol.charAt(0)}
                        </div>
                      )}
                      <div className="text-sm font-semibold text-white drop-shadow-[0_0_10px_rgba(0,0,0,0.9)] truncate max-w-[220px]">
                        {heroTagline}
                      </div>
                    </div>
                    {apiTokenAddress && (
                      <button
                        onClick={() => handleCopyAddress(apiTokenAddress)}
                        className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition-colors bg-black/30 backdrop-blur-sm px-2 py-1 rounded-lg"
                        title="Copy contract address"
                      >
                        <span className="font-mono">{apiTokenAddress.slice(0, 6)}...{apiTokenAddress.slice(-4)}</span>
                        <Copy className="w-3.5 h-3.5 text-blue-400" />
                      </button>
                    )}
                  </div>
                  {hasSocialLinks && (
                    <div className="flex divide-x divide-gray-800 bg-gray-900/70">
                      {socialTabs.map((tab) => (
                        <button
                          key={tab.label}
                          type="button"
                          onClick={() => handleSocialTabClick(tab.label, tab.url)}
                          disabled={!tab.url}
                          className={`flex-1 text-center text-xs font-semibold px-3 py-2 transition-colors ${
                            activeSocialTab === tab.label ? 'text-white bg-gray-800' : 'text-gray-400'
                          } ${tab.url ? 'hover:text-white hover:bg-gray-800/60' : 'opacity-40 cursor-not-allowed'}`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-400 py-4 text-center">No token data available</div>
            )}
          </div>
            {/* Stats Grid - Same layout as mobile single panel */}
            {dexScreenerData?.pairs?.[0] && (
              <div className="hidden md:block mb-2 px-2">
                <div className="grid grid-cols-2 gap-3">
                  {/* Left Column */}
                  <div className="space-y-3">
                    {/* Supply & Token Info */}
                    <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Supply Info</div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400 font-medium">Total Supply</span>
                          <span className="text-sm text-white font-semibold">
                            {totalSupply ? (() => {
                              const supply = Number(totalSupply.supply) / Math.pow(10, totalSupply.decimals);
                              return formatAbbrev(supply);
                            })() : '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400 font-medium">Circulating</span>
                          <span className="text-sm text-white font-semibold">
                            {totalSupply ? (() => {
                              const supply = Number(totalSupply.supply) / Math.pow(10, totalSupply.decimals);
                              const burned = burnedTokens?.amount ?? 0;
                              const circulating = Math.max(0, supply - burned);
                              return formatAbbrev(circulating);
                            })() : '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400 font-medium">Holders</span>
                          <span className="text-sm text-white font-semibold">
                            {holdersCount !== null ? (holdersCount >= 1000 ? `${(holdersCount / 1000).toFixed(1)}k` : holdersCount) : '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400 font-medium">Creation Date</span>
                          <span className="text-sm text-white font-semibold">{creationDate || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Supply Held */}
                    <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Supply Held</div>
                      {supplyHeld.isLoading ? (
                        <div className="text-center text-gray-500 text-sm">Loading...</div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 font-medium">Top 10</span>
                            <span className="text-sm text-white font-semibold">
                              {supplyHeld.top10 > 0 ? `${Math.round(supplyHeld.top10)}%` : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 font-medium">Top 20</span>
                            <span className="text-sm text-white font-semibold">
                              {supplyHeld.top20 > 0 ? `${Math.round(supplyHeld.top20)}%` : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 font-medium">Top 50</span>
                            <span className="text-sm text-white font-semibold">
                              {supplyHeld.top50 > 0 ? `${Math.round(supplyHeld.top50)}%` : '—'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Smart Contract Holder Share */}
                    <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Smart Contract Holder Share</div>
                      {smartContractHolderShare.isLoading ? (
                        <div className="text-center text-gray-500 text-sm">Loading...</div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 font-medium">Share</span>
                            <span className="text-sm text-white font-semibold">
                              {smartContractHolderShare.percent > 0 ? `${smartContractHolderShare.percent.toFixed(2)}%` : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 font-medium">Contracts</span>
                            <span className="text-sm text-white font-semibold">
                              {smartContractHolderShare.contractCount > 0 ? smartContractHolderShare.contractCount : '—'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-3">
                    {/* Ownership Status */}
                    <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Ownership</div>
                      {ownershipData.isLoading ? (
                        <div className="text-center text-gray-500 text-sm">Loading...</div>
                      ) : (ownershipData.isRenounced || ownershipData.creatorAddress?.toLowerCase() === PUMP_TIRES_CREATOR.toLowerCase()) ? (
                        <div className="text-center">
                          <div className="text-base text-green-400 font-semibold">Renounced ✓</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {ownershipData.creatorAddress?.toLowerCase() === PUMP_TIRES_CREATOR.toLowerCase() ? 'Pump.Tires' : 'No Owner'}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="text-base text-red-400 font-semibold">Not Renounced</div>
                          {ownershipData.ownerAddress && (
                            <a
                              href={`https://scan.pulsechain.box/address/${ownershipData.ownerAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 font-mono mt-0.5 inline-block"
                              title={ownershipData.ownerAddress}
                            >
                              ...{ownershipData.ownerAddress.slice(-6)}
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Creator Address */}
                    {ownershipData.creatorAddress && (
                      <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">Creator</div>
                        <div className="text-center">
                          {ownershipData.creatorAddress.toLowerCase() === PUMP_TIRES_CREATOR.toLowerCase() ? (
                            <a
                              href={`https://pump.tires/token/${apiTokenAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                              title="View on Pump.Tires"
                            >
                              Pump.Tires
                            </a>
                          ) : (
                            <a
                              href={`https://scan.pulsechain.box/address/${ownershipData.creatorAddress}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 font-mono"
                              title={ownershipData.creatorAddress}
                            >
                              {ownershipData.creatorAddress.slice(0, 6)}...{ownershipData.creatorAddress.slice(-4)}
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Liquidity */}
                    <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg py-0 px-3 min-h-[60px] flex items-center justify-center">
                      <div className="absolute top-2 left-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Liquidity</div>
                      <div className="text-center text-base text-white font-semibold">
                        {(() => {
                          const usdLiquidity = Number(dexScreenerData.pairs[0].liquidity?.usd || 0);
                          return usdLiquidity > 0 ? `$${formatAbbrev(usdLiquidity)}` : '—';
                        })()}
                      </div>
                    </div>

                    {/* Liq/MCAP Ratio */}
                    <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg py-0 px-3 min-h-[60px] flex items-center justify-center">
                      <div className="absolute top-2 left-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Liq/MCAP</div>
                      <div className="text-center text-base text-white font-semibold">
                        {(() => {
                          const liquidity = Number(dexScreenerData.pairs[0].liquidity?.usd || 0);
                          const marketCap = Number(dexScreenerData.pairs[0].marketCap || 0);
                          if (marketCap > 0) {
                            const ratio = (liquidity / marketCap) * 100;
                            return `${ratio.toFixed(2)}%`;
                          }
                          return '—';
                        })()}
                      </div>
                    </div>

                    {/* Total Liquidity */}
                    <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg py-0 px-3 min-h-[80px] flex items-center justify-center">
                      <div className="absolute top-2 left-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Total Liquidity</div>
                      {totalLiquidity.isLoading ? (
                        <div className="text-center text-gray-500 text-sm">Loading...</div>
                      ) : (
                        <div className="text-center text-base text-white font-semibold">
                          {totalLiquidity.usd > 0 ? `$${formatAbbrev(totalLiquidity.usd)}` : '—'}
                        </div>
                      )}
                      {totalLiquidity.pairCount > 0 && (
                        <div className="absolute top-2 right-3 text-xs text-gray-400 font-medium">
                          {totalLiquidity.pairCount} {totalLiquidity.pairCount === 1 ? 'Pair' : 'Pairs'}
                        </div>
                      )}
                    </div>

                    {/* Burned Tokens */}
                    <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg py-0 px-3 min-h-[60px] flex items-center justify-center">
                      <div className="absolute top-2 left-3 text-xs text-gray-400 font-medium uppercase tracking-wider">Burned</div>
                      {burnedTokens ? (
                        <div className="text-center">
                          <div className="text-base text-white font-semibold">{formatAbbrev(burnedTokens.amount)}</div>
                        </div>
                      ) : (
                        <div className="text-center text-base text-white font-semibold">—</div>
                      )}
                      {burnedTokens && (
                        <div className="absolute top-4 right-2 flex items-center justify-center w-9 h-9 rounded-full border-2 border-green-400">
                          <span className="text-[10px] text-green-400 font-semibold">{burnedTokens.percent.toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* API Catalog - Hidden, now shown in modal */}

            {/* Token Amount Calculator */}
            {dexScreenerData?.pairs?.[0] && (
              <div className="mb-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-2 shadow-[0_10px_35px_rgba(0,0,0,0.35)]">
                  <div className="mb-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={tokenAmount}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9.]/g, '');
                          setTokenAmount(value);
                        }}
                        placeholder="1"
                        className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 pr-16 text-white text-sm font-semibold focus:outline-none focus:border-orange-500 transition-colors backdrop-blur"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium pointer-events-none">
                        {dexScreenerData.pairs[0].baseToken?.symbol || 'TOKEN'}
                      </div>
                    </div>
                    <div className="flex items-center justify-center my-1">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </div>
                  </div>

                  <div className="bg-black/40 border border-white/10 rounded px-3 py-2 mb-2 backdrop-blur">
                    <div className="text-lg font-bold text-white flex items-center justify-between">
                      {(() => {
                        const amount = Number(tokenAmount) || 0;
                        const priceUsd = Number(dexScreenerData.pairs[0].priceUsd || 0);
                        const priceNative = Number(dexScreenerData.pairs[0].priceNative || 0);
                        const totalUsd = amount * priceUsd;
                        const totalWpls = amount * priceNative;

                        if (calculatorCurrency === 'usd') {
                          return (
                            <>
                              <span>$</span>
                              <span className="flex-1 text-right">{totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                            </>
                          );
                        } else {
                          return (
                            <>
                              <span className="flex-1">{totalWpls.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                              <span className="text-gray-400 text-sm ml-2">WPLS</span>
                            </>
                          );
                        }
                      })()}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setCalculatorCurrency('usd')}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                        calculatorCurrency === 'usd'
                          ? 'text-green-400'
                          : 'text-gray-500'
                      }`}
                    >
                      {calculatorCurrency === 'usd' && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      USD
                    </button>
                    <button
                      onClick={() => setCalculatorCurrency('wpls')}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                        calculatorCurrency === 'wpls'
                          ? 'text-green-400'
                          : 'text-gray-500'
                      }`}
                    >
                      {calculatorCurrency === 'wpls' && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      WPLS
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Addresses Section */}

            {/* Wallet Ad */}
            <div className="mb-2 px-0">
              <div className="text-xs text-center text-white/50 mb-1">Advertise Here</div>
              <a
                href="https://internetmoney.io"
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <img
                  src="/wallet.jpeg"
                  alt="InternetMoney.io - Your Gateway to PulseChain"
                  className="w-full rounded cursor-pointer hover:opacity-90 transition-opacity shadow-lg"
                />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Holder Transfers Modal */}
      {isHolderTransfersOpen && holderTransfersAddress && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={handleCloseHolderTransfers}
        >
          <div
            className="relative w-full max-w-5xl max-h-[90vh] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl shadow-2xl border border-gray-700 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-700 bg-gray-900/80 backdrop-blur">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Holder activity</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-mono text-white">{truncateAddress(holderTransfersAddress)}</span>
                  <a
                    href={`https://scan.pulsechain.box/address/${holderTransfersAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 text-xs hover:underline"
                  >
                    View on Explorer
                  </a>
                </div>
              </div>
              <button
                onClick={handleCloseHolderTransfers}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Close holder transfers"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)] bg-gray-900">
              {isLoadingHolderTransfers ? (
                <div className="flex items-center justify-center py-10 text-gray-400 gap-3">
                  <LoaderThree />
                  <span className="text-sm">Loading transfers...</span>
                </div>
              ) : holderTransfersError ? (
                <div className="text-center text-sm text-red-400 py-6">{holderTransfersError}</div>
              ) : holderTransfers.length === 0 ? (
                <div className="text-center text-sm text-gray-400 py-6">No transfers found for this holder.</div>
              ) : (
                <div className="space-y-3">
                  {holderTransfers.map((tx) => {
                    const isExpanded = expandedHolderTxs.has(tx.txHash);
                    const badgeClasses =
                      tx.direction === 'Buy'
                        ? 'bg-green-900/40 text-green-300 border-green-700/50'
                        : tx.direction === 'Sell'
                        ? 'bg-red-900/40 text-red-300 border-red-700/50'
                        : 'bg-blue-900/30 text-blue-200 border-blue-700/40';

                    return (
                      <div key={tx.txHash} className="rounded-lg border border-gray-700 bg-gray-800/70 p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] px-2 py-1 rounded-full border ${badgeClasses}`}>
                              {tx.direction}
                            </span>
                            <span className="text-white font-semibold">
                              {tx.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {baseSymbol || 'TOKEN'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>{tx.timestamp ? formatDateUTC(tx.timestamp) : '—'}</span>
                            <a
                              href={`https://scan.pulsechain.box/tx/${tx.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline"
                            >
                              Explorer
                            </a>
                            <button
                              type="button"
                              onClick={() => toggleExpandedHolderTx(tx.txHash)}
                              className="text-blue-300 hover:text-white transition-colors"
                            >
                              {isExpanded ? 'Hide details' : 'Details'}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-200">
                            <div className="bg-black/30 border border-gray-700 rounded-lg p-2">
                              <p className="text-gray-400">From</p>
                              <a
                                href={`https://scan.pulsechain.box/address/${tx.from}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-300 hover:underline break-all"
                              >
                                {tx.from || '—'}
                              </a>
                            </div>
                            <div className="bg-black/30 border border-gray-700 rounded-lg p-2">
                              <p className="text-gray-400">To</p>
                              <a
                                href={`https://scan.pulsechain.box/address/${tx.to}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-300 hover:underline break-all"
                              >
                                {tx.to || '—'}
                              </a>
                            </div>
                            <div className="bg-black/30 border border-gray-700 rounded-lg p-2">
                              <p className="text-gray-400">Transaction</p>
                              <a
                                href={`https://scan.pulsechain.box/tx/${tx.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-300 hover:underline break-all"
                              >
                                {tx.txHash}
                              </a>
                            </div>
                            <div className="bg-black/30 border border-gray-700 rounded-lg p-2">
                              <p className="text-gray-400">Direction</p>
                              <p className="text-white font-semibold">{tx.direction}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {isStatsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setIsStatsModalOpen(false)}>
          <div className="relative w-full max-w-6xl max-h-[90vh] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl shadow-2xl border border-gray-700 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-gradient-to-r from-gray-800/95 via-gray-800/90 to-gray-800/95 backdrop-blur-sm border-b border-gray-700">
              <h2 className="text-base font-semibold text-white uppercase tracking-wider">Advanced Stats</h2>
              <button
                onClick={() => setIsStatsModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-70px)] p-4 bg-gray-900">
              <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-4">
                <AdminStatsPanel key={apiTokenAddress} initialAddress={apiTokenAddress} compact />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function GeickoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <LoaderThree />
        </div>
      }
    >
      <GeickoPageContent />
    </Suspense>
  );
}
