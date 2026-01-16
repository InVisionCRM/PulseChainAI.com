'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AdminStatsPanel from '@/components/AdminStatsPanel';
import TokenAIChat from '@/components/TokenAIChat';
import TokenContractView from '@/components/TokenContractView';
import DexScreenerChart from '@/components/DexScreenerChart';
import LiquidityTab from '@/components/LiquidityTab';
import { LoaderOne, LoaderThree } from "@/components/ui/loader";
import { Copy, Download } from 'lucide-react';
import type { ContractData, TokenInfo, DexScreenerData, SearchResultItem, ContractAuditResult } from '../../types';
import { fetchContract, fetchTokenInfo, fetchDexScreenerData, search } from '../../services/pulsechainService';
import { analyzeContractAudit } from '../../services/contractAuditService';
import ContractAuditPanel from '@/components/ContractAuditPanel';
import {
  normalizeLabel,
  formatChainLabel,
  formatDexLabel,
  formatMarketCapLabel,
  truncateAddress,
  formatLpHolderAddress,
  formatCurrencyCompact,
  formatNumberCompact,
  isBurnAddress,
  formatPercentChange,
  formatDateUTC,
  formatAbbrev,
  formatWebsiteDisplay,
  PUMP_TIRES_CREATOR,
} from '@/components/geicko/utils';
import { pulsechainApiService } from '../../services/pulsechainApiService';
import { dexscreenerApi } from '../../services/blockchain/dexscreenerApi';
import { useToast } from '@/components/ui/toast-provider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GeickoHolderTransfersModal,
  GeickoHoldersTab,
  GeickoSwapTab,
  GeickoWebsiteTab,
  GeickoTabNavigation,
  GeickoOwnershipPanel,
  GeickoMetricsGrid,
  GeickoMarketStatsPanel,
  GeickoRabbyHeader,
  GeickoRabbyActionButtons,
  GeickoRabbyInfoCards,
  GeickoRabbyTransactionsList,
  GeickoToast,
} from '@/components/geicko';
import { MobileSearchBar } from '@/components/MobileSearchBar';
import { DesktopSearchBar } from '@/components/DesktopSearchBar';

function GeickoPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast, updateToast, dismissToast } = useToast();
  const addressFromQuery = searchParams.get('address');
  const tabFromQuery = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState('chart');
  const tokenInfoTab: 'token' = 'token';
  const [apiTokenAddress, setApiTokenAddress] = useState<string>('');
  const [tokenAmount, setTokenAmount] = useState<string>('1');
  const [calculatorCurrency, setCalculatorCurrency] = useState<'usd' | 'wpls'>('usd');
  const [burnedTokens, setBurnedTokens] = useState<{ amount: number; percent: number } | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState<boolean>(false);
  const [holdersCount, setHoldersCount] = useState<number | null>(null);
  const [creationDate, setCreationDate] = useState<string | null>(null);
  const [activeSocialTab, setActiveSocialTab] = useState<string | null>(null);
  const [uiPreset, setUiPreset] = useState<'classic' | 'rabby1'>('classic');
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

  // Copy confirmation toast state
  const [copyToast, setCopyToast] = useState<{ message: string; show: boolean }>({ message: '', show: false });

  // Toast state for tracking active fetches
  const [activeFetches, setActiveFetches] = useState<Map<string, {
    statName: string;
    startTime: Date;
    progress: number;
    completed?: boolean;
    processed?: boolean;
    result?: any;
    duration?: number;
    completedAt?: number;
  }>>(new Map());

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

  // Audit state
  const [auditResult, setAuditResult] = useState<ContractAuditResult | null>(null);
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);

  // Download image function
  const downloadImage = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast('Logo downloaded successfully!', 'success');
    } catch (error) {
      console.error('Failed to download image:', error);
      showToast('Failed to download logo', 'error');
    }
  };

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
    type: 'BUY' | 'SELL' | 'TRANSFER';
    amount: number;
    txHash: string;
    from: string;
    to: string;
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


  // Load token/contract data function - works for both tokens and non-token contracts
  const loadTokenData = useCallback(async (address: string) => {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      setError('Invalid address');
      return;
    }

    setIsLoadingData(true);
    setError(null);

    try {
      // Always fetch contract data first (works for both tokens and non-token contracts)
      // Token-specific data is optional and failures are handled gracefully
      const [contractResult, tokenResult, dexResult, profileResult] = await Promise.allSettled([
        fetchContract(address),
        fetchTokenInfo(address).catch(() => ({ data: null, raw: null })), // Gracefully handle non-token contracts
        fetchDexScreenerData(address).catch(() => ({ data: null, raw: null })), // Gracefully handle non-token contracts
        dexscreenerApi.getTokenProfile(address).catch(() => ({ success: false, data: null })) // Gracefully handle non-token contracts
      ]);

      // Handle contract data - this should always work for any contract
      if (contractResult.status === 'fulfilled') {
        setContractData(contractResult.value.data);
        console.log('Contract data loaded:', contractResult.value.data);
      } else if (contractResult.status === 'rejected') {
        console.error('Failed to fetch contract data:', contractResult.reason);
        // Even if contract fetch fails, set minimal data so contract tab can still function
        setContractData({
          name: 'Contract',
          source_code: '',
          compiler_version: '',
          optimization_enabled: false,
          is_verified: false,
          abi: [],
          creator_address_hash: null,
          creation_tx_hash: null,
        });
      }

      // Handle token info (optional - may be null for non-token contracts)
      if (tokenResult.status === 'fulfilled' && tokenResult.value?.data) {
        setTokenInfo(tokenResult.value.data);
        console.log('Token info loaded:', tokenResult.value.data);
      } else {
        setTokenInfo(null); // Not a token or token info unavailable
      }

      // Handle DexScreener data (optional - may be null for non-token contracts)
      if (dexResult.status === 'fulfilled' && dexResult.value?.data) {
        setDexScreenerData(dexResult.value.data);
        console.log('DexScreener data loaded:', dexResult.value.data);
      } else {
        setDexScreenerData(null); // Not a token or no DEX data
      }

      // Handle profile data (optional)
      if (profileResult.status === 'fulfilled' && profileResult.value.success) {
        setProfileData(profileResult.value.data);
        console.log('Profile data loaded:', profileResult.value.data);
      } else {
        setProfileData(null);
      }

    } catch (e) {
      console.error('Error loading contract/token data:', e);
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  // Load transactions function using PulseChain API
  // Get recent token transfers for trading activity

  const loadTransactions = useCallback(async (address: string) => {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return;
    }

    // Prevent duplicate simultaneous calls
    if (isLoadingTransactions) {
      return;
    }

    setIsLoadingTransactions(true);

    try {
      console.log('Fetching token transfers from PulseChain API for:', address);

      // Get recent token transfers for this token
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const transfersUrl = `${baseUrl}/api/address-transfers?address=${address}&limit=50`;
      const transfersResponse = await fetch(transfersUrl).then(res => res.json());

      if (!transfersResponse || !transfersResponse.items || transfersResponse.items.length === 0) {
        console.log('No token transfers found from PulseChain API');
        setTransactions([]);
        setIsLoadingTransactions(false);
        return;
      }

      console.log(`Loaded ${transfersResponse.items.length} token transfers from PulseChain API`);

      // Get token decimals from PulseScan (no pricing needed for transactions)
      const tokenInfo = await pulsechainApiService.getTokenInfo(address).catch(() => null);
      const decimals = tokenInfo?.decimals ? parseInt(tokenInfo.decimals) : 18;

      console.log(`Using ${decimals} decimals for token transfers`);

      // Process token transfers into transaction format (no USD calculations needed)
      const processedTransactions = transfersResponse.items.map((transfer: any) => {
        const timestamp = transfer.timestamp ? new Date(transfer.timestamp).getTime() : Date.now();
        const amount = transfer.total?.value ? parseFloat(transfer.total.value) / Math.pow(10, decimals) : 0;

        // Determine transaction type based on transfer direction
        // Note: This is simplified - in reality, we'd need more context to determine BUY vs SELL
        let type: 'BUY' | 'SELL' | 'TRANSFER' = 'TRANSFER';

        // Format time
        const txTime = new Date(timestamp);
        const isToday = txTime.toDateString() === new Date().toDateString();
        const timeStr = isToday
          ? txTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
          : txTime.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

        return {
          time: timeStr,
          timestamp,
          type,
          amount,
          from: transfer.from || 'Unknown',
          to: transfer.to || 'Unknown',
          txHash: transfer.transaction_hash || transfer.txHash || `unknown-${timestamp}`
        };
      });

      // Filter out invalid transactions (keep all valid amounts)
      const filteredTransactions = processedTransactions.filter((tx) => {
        return tx.txHash &&
               !tx.txHash.startsWith('unknown-') &&
               tx.amount > 0; // Filter out zero/negative amounts
      });

      // Sort by timestamp (most recent first)
      filteredTransactions.sort((a, b) => b.timestamp - a.timestamp);

      console.log(`✅ Processed ${filteredTransactions.length} PulseChain token transfers`);
      setTransactions(filteredTransactions);
    } catch (error) {
      console.error('Failed to load transactions from PulseChain API:', error);
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
      // Use the same fetchJson approach that works in burned tokens calculation
      const base = 'https://api.scan.pulsechain.com/api/v2';

      const fetchJson = async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      };

      // Fetch top 100 holders from PulseScan API
      const qs = new URLSearchParams({ limit: '100' });
      const data = await fetchJson(`${base}/tokens/${address}/holders?${qs.toString()}`);
      const items: Array<{ address?: { hash?: string }; value?: string }> = Array.isArray(data?.items) ? data.items : [];

      // Process holders data (same logic as burned tokens calculation)
      const processedHolders = items
        .map((h: any) => ({
          address: h.address?.hash || '',
          value: h.value || '0'
        }))
        .filter((item: any) => item.address && item.value);

      setHolders(processedHolders);
    } catch (error) {
      console.error('Failed to load holders:', error);
      setHolders([]);
    } finally {
      setIsLoadingHolders(false);
    }
  }, []);

  // Load token metrics from server-side API
  const loadTokenMetrics = useCallback(async (address: string) => {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return;
    }

    setIsLoadingMetrics(true);

    try {
      const response = await fetch(`/api/token-metrics/${address}`);
      if (!response.ok) throw new Error('Failed to fetch token metrics');

      const metrics = await response.json();

      // Update all metrics state at once
      if (metrics.burnedTokens) {
        setBurnedTokens(metrics.burnedTokens);
      }
      if (metrics.holdersCount !== null) {
        setHoldersCount(metrics.holdersCount);
      }
      if (metrics.creationDate) {
        setCreationDate(metrics.creationDate);
      }
      if (metrics.supplyHeld) {
        setSupplyHeld({ ...metrics.supplyHeld, isLoading: false });
      }
      if (metrics.smartContractHolderShare) {
        setSmartContractHolderShare({ ...metrics.smartContractHolderShare, isLoading: false });
      }
      if (metrics.ownershipData) {
        setOwnershipData({ ...metrics.ownershipData, isLoading: false });
      }
      if (metrics.totalSupply) {
        setTotalSupply(metrics.totalSupply);
      }

      console.log('✅ Token metrics loaded from server in single request');
    } catch (error) {
      console.error('Failed to load token metrics:', error);
      // Set loading states to false on error
      setSupplyHeld(prev => ({ ...prev, isLoading: false }));
      setSmartContractHolderShare(prev => ({ ...prev, isLoading: false }));
      setOwnershipData(prev => ({ ...prev, isLoading: false }));
    } finally {
      setIsLoadingMetrics(false);
    }
  }, []);

  // Run audit analysis when contract data and ownership data are available
  useEffect(() => {
    const runAuditAnalysis = async () => {
      if (!apiTokenAddress || !contractData || ownershipData.isLoading) {
        return;
      }

      // Only run if we have both contract data and ownership data
      if (!contractData.abi || ownershipData.creatorAddress === null) {
        return;
      }

      // Don't run audit if contract is not verified or has no source code
      if (!contractData.is_verified || !contractData.source_code || contractData.source_code.trim() === '') {
        setIsLoadingAudit(false);
        setAuditResult(null);
        return;
      }

      setIsLoadingAudit(true);
      try {
        const result = await analyzeContractAudit(
          apiTokenAddress,
          contractData,
          {
            creatorAddress: ownershipData.creatorAddress,
            ownerAddress: ownershipData.ownerAddress,
            isRenounced: ownershipData.isRenounced,
            renounceTxHash: ownershipData.renounceTxHash,
          }
        );
        setAuditResult(result);
      } catch (error) {
        console.error('Failed to analyze contract audit:', error);
        setAuditResult(null);
      } finally {
        setIsLoadingAudit(false);
      }
    };

    runAuditAnalysis();
  }, [apiTokenAddress, contractData, ownershipData]);

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

  // Toast callback functions for AdminStatsPanel
  const handleFetchStart = useCallback((statId: string, statName: string) => {
    const fetchId = `${statId}_${Date.now()}`;
    setActiveFetches(prev => new Map(prev.set(fetchId, {
      statName: statName || statId,
      startTime: new Date(),
      progress: 0
    })));

    // Close modal automatically when fetch starts
    // setIsStatsModalOpen(false); // Disabled auto-closing when stat is clicked

    // Show toast with initial progress
    showToast({
      id: fetchId,
      title: `Fetching ${statName || statId}`,
      message: 'Analyzing blockchain data...',
      variant: 'loading',
      progress: 0,
      onClick: () => {
        setIsStatsModalOpen(true);
        dismissToast(fetchId);
      }
    });

    // Update progress over time
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 15 + 5; // Random progress between 5-20%
      if (progress >= 90) {
        progress = 90;
        clearInterval(progressInterval); // Stop at 90%, let completion handler finish
        return;
      }

      // Update active fetches state (only if not completed)
      setActiveFetches(prev => {
        const updated = new Map(prev);
        const fetch = updated.get(fetchId);
        if (fetch && !fetch.completed) {
          updated.set(fetchId, { ...fetch, progress });
        }
        return updated;
      });

      // Update toast progress
      updateToast(fetchId, {
        progress: Math.round(progress)
      });
    }, 800);

    // Safety cleanup after 10 seconds max (in case completion never happens)
    setTimeout(() => {
      clearInterval(progressInterval);
      dismissToast(fetchId);
    }, 10000);
  }, [showToast, dismissToast]);

  const handleFetchComplete = useCallback((statId: string, result: any, duration: number) => {
    // Store the completion info for processing in useEffect to avoid setState during render
    setActiveFetches(prev => {
      const updated = new Map(prev);
      for (const [fetchId, fetch] of updated) {
        if (fetchId.startsWith(statId)) {
          updated.set(fetchId, {
            ...fetch,
            completed: true,
            result,
            duration,
            completedAt: Date.now()
          });
          break;
        }
      }
      return updated;
    });
  }, []);

  // Process completed fetches in useEffect to avoid setState during render
  useEffect(() => {
    activeFetches.forEach((fetch, fetchId) => {
      if (fetch.completed && !fetch.processed) {
        // Mark as processed to avoid duplicate processing
        setActiveFetches(prev => {
          const updated = new Map(prev);
          const currentFetch = updated.get(fetchId);
          if (currentFetch) {
            updated.set(fetchId, { ...currentFetch, processed: true });
          }
          return updated;
        });

        // Show success toast first, then dismiss loading toast
        showToast({
          id: `${fetchId}_success`,
          title: `Completed ${fetch.statName}`,
          message: `Fetched in ${fetch.duration}ms`,
          variant: 'success',
          duration: 0, // Don't auto-dismiss - user manually closes
          result: fetch.result, // Pass the full result data
          onClick: () => setIsStatsModalOpen(true)
        });

        // Dismiss loading toast after a brief delay to ensure success toast appears first
        setTimeout(() => {
          dismissToast(fetchId);
        }, 100);

        // Clean up after delay
        setTimeout(() => {
          setActiveFetches(prev => {
            const updated = new Map(prev);
            updated.delete(fetchId);
            return updated;
          });
        }, 3000);
      }
    });
  }, [activeFetches, showToast, dismissToast]);

  const handleFetchError = useCallback((statId: string, error: string) => {
    // Find and remove the active fetch
    setActiveFetches(prev => {
      const updated = new Map(prev);
      for (const [fetchId, fetch] of updated) {
        if (fetchId.startsWith(statId)) {
          updated.delete(fetchId);
          // Show error toast
          showToast({
            id: `${fetchId}_error`,
            title: `Failed ${fetch.statName}`,
            message: error,
            variant: 'error',
            duration: 5000,
            onClick: () => setIsStatsModalOpen(true)
          });
          break;
        }
      }
      return updated;
    });
  }, [showToast]);

  // No-toast callback functions for stats tab (AdminStatsPanel without toast notifications)
  const handleFetchStartNoToast = useCallback((statId: string, statName: string) => {
    const fetchId = `${statId}_${Date.now()}`;
    setActiveFetches(prev => new Map(prev.set(fetchId, {
      statName: statName || statId,
      startTime: new Date(),
      progress: 0
    })));

    // Update progress over time (same as original but without toast)
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 15 + 5; // Random progress between 5-20%
      if (progress >= 90) {
        progress = 90;
        clearInterval(progressInterval); // Stop at 90%, let completion handler finish
        return;
      }

      // Update active fetches state (only if not completed)
      setActiveFetches(prev => {
        const updated = new Map(prev);
        const fetch = updated.get(fetchId);
        if (fetch && !fetch.completed) {
          updated.set(fetchId, { ...fetch, progress: Math.min(progress, 90) });
        }
        return updated;
      });
    }, 200);

    // Store interval for cleanup
    setActiveFetches(prev => {
      const updated = new Map(prev);
      const fetch = updated.get(fetchId);
      if (fetch) {
        updated.set(fetchId, { ...fetch, progressInterval });
      }
      return updated;
    });
  }, []);

  const handleFetchCompleteNoToast = useCallback((statId: string, result: any, duration: number) => {
    // Store the completion info for processing in useEffect to avoid setState during render
    setActiveFetches(prev => {
      const updated = new Map(prev);
      for (const [fetchId, fetch] of updated) {
        if (fetchId.startsWith(statId)) {
          updated.set(fetchId, {
            ...fetch,
            completed: true,
            result,
            duration,
            completedAt: Date.now()
          });
          break;
        }
      }
      return updated;
    });
  }, []);

  const handleFetchErrorNoToast = useCallback((statId: string, error: string) => {
    // Find and remove the active fetch (same logic as original but without toast)
    setActiveFetches(prev => {
      const updated = new Map(prev);
      for (const [fetchId, fetch] of updated) {
        if (fetchId.startsWith(statId)) {
          updated.delete(fetchId);
          break;
        }
      }
      return updated;
    });
  }, []);

  // Load data when token address changes
  useEffect(() => {
    const loadAllData = async () => {
      await loadTokenData(apiTokenAddress);
      // Load metrics from server API (replaces multiple heavy calculations)
      loadTokenMetrics(apiTokenAddress);
      // Load transactions and holders after token data is available
      loadTransactions(apiTokenAddress);
      loadHolders(apiTokenAddress);
    };

    loadAllData();
    setHoldersPage(1); // Reset pagination when address changes
  }, [apiTokenAddress, loadTokenData, loadTokenMetrics, loadTransactions, loadHolders]);

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
    "Bookmark Morbius",
  ];



  // DISABLED: Load top tokens on mount - causing performance issues
  // TODO: Move to lazy loading or separate API endpoint
  // useEffect(() => {
  //   const loadTopTokens = async () => {
  //     try {
  //       // Popular PulseChain token addresses
  //       const popularTokens = [
  //         { address: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', name: 'HEX' },
  //         { address: '0x95B303987A60C71504D99Aa1b13B4DA07b0790ab', name: 'PLSX' },
  //         { address: '0x2fa878Ab3F87CC1C9737Fc071108F904c0B0C95d', name: 'INC' },
  //         { address: '0xefD766cCb38EaF1dfd701853BFCe31359239F305', name: 'DAI' },
  //         { address: '0xA1077a294dDE1B09bB078844df40758a5D0f9a27', name: 'WPLS' },
  //         { address: '0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07', name: 'USDC' },
  //       ];

  //       const tokenDataPromises = popularTokens.map(async (token) => {
  //         try {
  //           const result = await fetchDexScreenerData(token.address);
  //           const data = result?.data;
  //           return {
  //             symbol: token.name,
  //             priceChange: data?.pairs?.[0]?.priceChange?.h24 || 0
  //           };
  //         } catch {
  //           return { symbol: token.name, priceChange: 0 };
  //         }
  //       });

  //       const results = await Promise.all(tokenDataPromises);
  //       setTopTokens(results);
  //     } catch (error) {
  //       console.error('Failed to load top tokens:', error);
  //     }
  //   };

  //   loadTopTokens();
  // }, []);

  // DISABLED: Fetch burned tokens and holders count - NOW HANDLED BY SERVER API
  // This heavy calculation is now done server-side via /api/token-metrics/[address]
  // useEffect(() => {
  //   let cancelled = false;
  //   const base = 'https://api.scan.pulsechain.com/api/v2';
  //   ... (calculation code removed for performance)
  //   load();
  //   return () => { cancelled = true; };
  // }, [apiTokenAddress]);

  // DISABLED: Fetch contract ownership data - NOW HANDLED BY SERVER API
  // This sequential API call chain is now done server-side via /api/token-metrics/[address]
  // useEffect(() => {
  //   ... (ownership calculation removed for performance)
  // }, [apiTokenAddress]);

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

  // DISABLED: Fetch contract age, total pairs, and supply held - NOW HANDLED BY SERVER API
  // This heavy calculation with multiple sequential API calls is now done server-side
  // via /api/token-metrics/[address] endpoint which includes:
  // - Creation date calculation
  // - Total supply fetching
  // - Supply held percentages (top 10/20/50)
  // - Smart contract holder share
  // All of these are now loaded in a single optimized server request with caching
  /*
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

            // Skip contract checking to avoid API issues - set to 0
            const contractCount = 0;
            const contractBalance = 0;

            const percent = 0; // Cannot calculate without contract data

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
  */


  // Handle URL parameters - load token when address is in URL and set tab
  useEffect(() => {
    if (addressFromQuery && /^0x[a-fA-F0-9]{40}$/.test(addressFromQuery)) {
      setApiTokenAddress(addressFromQuery);
    }
    if (tabFromQuery) {
      const validTabs = ['chart', 'holders', 'liquidity', 'contract', 'switch', 'stats', 'website'];
      if (validTabs.includes(tabFromQuery)) {
        setActiveTab(tabFromQuery);
      }
    }
  }, [addressFromQuery, tabFromQuery]);

  // Scroll to top when switch tab becomes active (for mobile swap button)
  useEffect(() => {
    if (activeTab === 'switch' && typeof window !== 'undefined') {
      // Small delay to ensure the component has rendered, then scroll to top
      setTimeout(() => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }, 200);
    }
  }, [activeTab]);

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
  const socialTabs: Array<{ label: string; url: string | null; isDownload?: boolean }> = [
    { label: 'Website', url: websiteLink },
    { label: 'Twitter', url: twitterLink },
    { label: 'Telegram', url: telegramLink },
    { label: 'Download Logo', url: null, isDownload: true },
  ];
  const hasSocialLinks = socialTabs.some((tab) => Boolean(tab.url));
  const addressItems: Array<{ label: string; address: string }> = primaryPair
    ? [
        { label: 'POOL', address: primaryPair.pairAddress },
        { label: (baseSymbol || 'TOKEN').toUpperCase(), address: primaryPair.baseToken?.address || '' },
        { label: (quoteSymbol || 'QUOTE').toUpperCase(), address: primaryPair.quoteToken?.address || '' },
      ].filter((item): item is { label: string; address: string } => Boolean(item.address))
    : [];

  const lpAddressSet = useMemo(
    () =>
      new Set(
        (dexScreenerData?.pairs ?? [])
          .map((pair) => (pair.pairAddress || '').toLowerCase())
          .filter(Boolean),
      ),
    [dexScreenerData?.pairs],
  );

  const holderStats = useMemo(() => {
    const decimals = tokenInfo?.decimals ? Number(tokenInfo.decimals) : 18;
    const totalSupplyRaw = tokenInfo?.total_supply ? Number(tokenInfo.total_supply) : 0;
    const topHolder = holders[0];
    const topBalance = topHolder ? Number(topHolder.value || 0) / Math.pow(10, decimals) : 0;
    const topPct = totalSupplyRaw > 0 && topHolder ? (Number(topHolder.value || 0) / totalSupplyRaw) * 100 : 0;
    const lpCount = holders.filter((h) => lpAddressSet.has((h.address || '').toLowerCase())).length;
    const burnCount = holders.filter((h) => isBurnAddress(h.address)).length;
    const contractCount = holders.filter((h) => h.isContract).length;

    return {
      totalHolders: holdersCount ?? holders.length,
      topBalance,
      topPct,
      lpCount,
      burnCount,
      contractCount,
    };
  }, [holders, holdersCount, lpAddressSet, tokenInfo]);

  const [toast, setToast] = useState<{ message: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

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
      setCopyToast({ message: 'Address copied!', show: true });
      setTimeout(() => setCopyToast({ message: '', show: false }), 2000);
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
    { id: 'holders', label: 'Holders' },
    { id: 'liquidity', label: 'Liquidity' },
    { id: 'contract', label: 'Code' },
    { id: 'switch', label: 'Swap' },
    { id: 'website', label: 'Website' },
    { id: 'stats', label: 'Stats' },
    { id: 'audit', label: 'Audit' },
  ];


  const rabbyActions = [
    {
      label: 'Swap',
      icon: '⇄',
      description: 'Trade instantly',
      onClick: () => setActiveTab('switch'),
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
      label: 'Website',
      icon: '🌐',
      description: 'Official site',
      onClick: () => setActiveTab('website'),
    },
    {
      label: 'Stats',
      icon: '📊',
      description: 'Advanced analytics',
      onClick: () => setActiveTab('stats'),
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
          <GeickoRabbyHeader
            walletAddress={walletAddress}
            primaryPair={primaryPair}
            priceChange={priceChange}
            onCopyAddress={handleCopyAddress}
            onOpenChart={() => setActiveTab('switch')}
          />

          <main className="px-4 sm:px-8 mt-10 pb-12 space-y-5">
            <GeickoRabbyActionButtons onTabChange={setActiveTab} onExternalLink={openExternalLink} />

            <GeickoRabbyInfoCards primaryPair={primaryPair} />

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

            <GeickoRabbyTransactionsList
              transactions={limitedTransactions}
              formatDate={formatDateUTC}
            />
          </main>
        </div>
      {toast && (
        <div className="fixed bottom-4 right-4 z-[1000]">
          <div className="rounded-xl bg-white/10 border border-white/20 backdrop-blur px-4 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.35)] text-white text-sm">
            {toast.message}
          </div>
        </div>
      )}
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-900 text-white font-sans px-2 md:px-3 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-24 left-16 h-64 w-64 bg-gradient-to-br from-blue-700/30 via-cyan-500/10 to-transparent blur-3xl" />
          <div className="absolute top-10 right-0 h-72 w-72 bg-gradient-to-bl from-purple-700/25 via-fuchsia-500/10 to-transparent blur-3xl" />
          <div className="absolute bottom-24 left-1/3 h-56 w-56 bg-gradient-to-tr from-emerald-600/20 via-teal-500/10 to-transparent blur-3xl" />
        </div>
      {/* Header Section */}


      {/* Mobile Token Header - Top of mobile layout */}
      <div className="md:hidden px-0 mb-1">
        {isLoadingData ? (
          <div className="flex items-center justify-center py-4">
            <LoaderThree />
          </div>
        ) : primaryPair ? (
          <div className="px-2 mb-2 pt-2">
            <div className="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden shadow-[0_12px_35px_rgba(0,0,0,0.45)]">
              <div className="relative h-40 border-b border-gray-800/70 bg-slate-900">
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
                {/* Token info overlay */}
                <div className="absolute top-1 left-1 right-1 p-0">
                  <div className="flex justify-between gap-0">
                    <div>
                      <div className="text-lg p-1 font-bold text-white rounded-tl-lg bg-transparent backdrop-blur-md tracking-tight">
                        {baseSymbol} <span className="text-white pb-1 bg-transparent">/</span> {quoteSymbol}
                      </div>
                      <div className="text-xs text-white pb-1 text-left pl-2 bg-transparent backdrop-blur-xs">
                        {tokenNameDisplay}
                      </div>
                    </div>
                    <div className="text-center justify-center">
                      <div className="text-lg p-1 font-semibold text-white rounded-tr-lg bg-transparent backdrop-blur-md">
                        ${formattedPrice}
                      </div>
                      <div className={`text-xs text-center pb-1 justify-center font-semibold p-1 bg-transparent backdrop-blur-md ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {priceChange >= 0 ? '↑' :  '↓'}
                        {Math.abs(priceChange).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>


                <div className="absolute left-4 bottom-3 flex items-center gap-3">
                  {tokenLogoSrc ? (
                    <img
                      src={tokenLogoSrc}
                      alt={`${tokenNameDisplay} logo`}
                      className="w-14 h-14 rounded-full border border-brand-orange/30 bg-brand-navy object-cover"
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
                    <div className="w-10 h-10 rounded-full bg-brand-navy border border-white/10 flex items-center justify-center text-white font-bold">
                      {baseSymbol.charAt(0)}
                    </div>
                  )}
                  <div className="text-sm font-semibold text-white drop-shadow-[0_0_10px_rgba(0,0,0,0.9)] truncate max-w-[220px]">
                    {heroTagline}
                  </div>
                </div>
              </div>
              {hasSocialLinks && (
                <div className="flex divide-x divide-gray-800 bg-gray-900/70">
                  {socialTabs.map((tab) => (
                    <button
                      key={tab.label}
                      type="button"
                      onClick={() => {
                        if (tab.isDownload) {
                          const logoUrl = dexScreenerData?.tokenInfo?.logoURI || dexScreenerData?.pairs?.[0]?.baseToken?.logoURI || dexScreenerData?.pairs?.[0]?.info?.imageUrl;
                          const symbol = dexScreenerData?.tokenInfo?.symbol || dexScreenerData?.pairs?.[0]?.baseToken?.symbol || 'token';
                          if (logoUrl) {
                            downloadImage(logoUrl, `${symbol}-logo.png`);
                          }
                        } else {
                          handleSocialTabClick(tab.label, tab.url);
                        }
                      }}
                      disabled={!tab.url && !tab.isDownload}
                      className={`flex-1 text-center text-xs font-semibold px-3 py-2 transition-colors ${
                        activeSocialTab === tab.label ? 'text-white bg-gray-800' : 'text-gray-400'
                      } ${(tab.url || tab.isDownload) ? 'hover:text-white hover:bg-gray-800/60' : 'opacity-40 cursor-not-allowed'}`}
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

      {/* Mobile Stats - Top of mobile layout */}
      <div className="md:hidden">
        {/* Stats Grid - Same layout as mobile single panel */}
        {dexScreenerData?.pairs?.[0] && (
          <div className="block mb-1 px-1">
            <div className="grid grid-cols-2 gap-1">
              {/* Left Column */}
              <div className="space-y-0.5">
                {/* Contract Address */}
                {apiTokenAddress && (
                  <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 p-3">
                    <div className="flex flex-col space-y-1 items-center">
                      <span className="text-xs text-gray-400 font-medium uppercase tracking-wider text-center">Contract</span>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleCopyAddress(apiTokenAddress)}
                          className="text-blue-400 hover:text-blue-300 font-mono text-xs"
                          title="Copy contract address"
                        >
                          0x...{apiTokenAddress.slice(-4)}
                        </button>
                        <button
                          onClick={() => handleCopyAddress(apiTokenAddress)}
                          className="flex items-center justify-center w-5 h-5 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                          aria-label="Copy contract address"
                          title="Copy contract address"
                        >
                          <Copy className="w-3 h-3 text-blue-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {/* Decimals */}
                <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Decimals</span>
                    <span className="text-xs text-white font-semibold">
                      {totalSupply?.decimals !== undefined ? totalSupply.decimals : <LoaderOne />}
                    </span>
                  </div>
                </div>

                {/* Supply & Token Info */}
                <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 p-3">
                  <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider text-center">Supply Info</div>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 font-medium">Total Supply</span>
                      <span className="text-xs text-white font-semibold">
                        {totalSupply ? (() => {
                          const supply = Number(totalSupply.supply) / Math.pow(10, totalSupply.decimals);
                          return formatAbbrev(supply);
                        })() : <LoaderOne />}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 font-medium">Circ.</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-white font-semibold">
                            {totalSupply ? (() => {
                              const supply = Number(totalSupply.supply) / Math.pow(10, totalSupply.decimals);
                              const burned = burnedTokens?.amount ?? 0;
                              const circulating = Math.max(0, supply - burned);
                              return formatAbbrev(circulating);
                            })() : <LoaderOne />}
                          </span>
                        </TooltipTrigger>
                        {totalSupply && (() => {
                          const supply = Number(totalSupply.supply) / Math.pow(10, totalSupply.decimals);
                          const burned = burnedTokens?.amount ?? 0;
                          const circulating = Math.max(0, supply - burned);
                          return (
                            <TooltipContent>
                              <p>{circulating.toLocaleString()}</p>
                            </TooltipContent>
                          );
                        })()}
                      </Tooltip>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 font-medium">Holders</span>
                      {isLoadingMetrics ? (
                        <Skeleton className="h-4 w-12" />
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-white font-semibold">
                              {holdersCount !== null ? (holdersCount >= 1000 ? `${(holdersCount / 1000).toFixed(1)}k` : holdersCount) : '—'}
                            </span>
                          </TooltipTrigger>
                          {holdersCount !== null && (
                            <TooltipContent>
                              <p>{holdersCount.toLocaleString()}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 font-medium">Age</span>
                      {isLoadingMetrics ? (
                        <Skeleton className="h-4 w-16" />
                      ) : (
                        <span className="text-xs text-white font-semibold">{creationDate || '—'}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Supply Held */}
                <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 p-3">
                  <div className="text-xs text-gray-400 font-medium uppercase tracking-wider text-center">Supply Held</div>
                  {supplyHeld.isLoading ? (
                    <div className="text-center text-gray-500 text-sm">Loading...</div>
                  ) : (
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 font-medium">Top 10</span>
                        <span className="text-xs text-white font-semibold">
                          {supplyHeld.top10 > 0 ? `${Math.round(supplyHeld.top10)}%` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 font-medium">Top 20</span>
                        <span className="text-xs text-white font-semibold">
                          {supplyHeld.top20 > 0 ? `${Math.round(supplyHeld.top20)}%` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 font-medium">Top 50</span>
                        <span className="text-xs text-white font-semibold">
                          {supplyHeld.top50 > 0 ? `${Math.round(supplyHeld.top50)}%` : '—'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Smart Contract Holder Share */}
                <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 p-3">
                  <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider text-center">Supply In Contracts</div>
                  {smartContractHolderShare.isLoading ? (
                    <div className="text-center text-gray-500 text-sm">Loading...</div>
                  ) : (
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 font-medium">Share</span>
                        <span className="text-xs text-white font-semibold">
                          {smartContractHolderShare.percent > 0 ? `${smartContractHolderShare.percent.toFixed(2)}%` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 font-medium">Contracts</span>
                        <span className="text-xs text-white font-semibold">
                          {smartContractHolderShare.contractCount > 0 ? smartContractHolderShare.contractCount : '—'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-0.5">
                {/* Creator */}
                <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 p-3">
                  <div className="flex flex-col space-y-1 items-center">
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wider text-center">Creator</span>
                    <div className="flex items-center justify-center gap-1">
                      {ownershipData.creatorAddress ? (
                        <>
                          <a
                            href={`https://scan.pulsechain.com/address/${ownershipData.creatorAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 font-mono text-xs"
                            title={ownershipData.creatorAddress}
                          >
                            {ownershipData.creatorAddress.slice(0, 6)}...{ownershipData.creatorAddress.slice(-4)}
                          </a>
                          <button
                            onClick={() => handleCopyAddress(ownershipData.creatorAddress!)}
                            className="flex items-center justify-center w-5 h-5 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                            aria-label="Copy creator address"
                            title="Copy creator address"
                          >
                            <Copy className="w-3 h-3 text-blue-400" />
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-white font-semibold">—</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ownership Status */}
                <div className="relative h-16 bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 p-3">
                  <div className="absolute left-1/2 -translate-x-1/2 top-2 text-xs text-gray-400 font-medium uppercase tracking-wider">Ownership</div>
                  {ownershipData.isLoading ? (
                    <div className="text-center text-gray-500 text-sm">Loading...</div>
                  ) : (ownershipData.isRenounced || ownershipData.creatorAddress?.toLowerCase() === PUMP_TIRES_CREATOR.toLowerCase()) ? (
                    <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-center">
                      <div className="text-xs text-green-400 font-semibold">Renounced</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {ownershipData.creatorAddress?.toLowerCase() === PUMP_TIRES_CREATOR.toLowerCase() ? 'Pump.Tires' : 'No Owner'}
                      </div>
                    </div>
                  ) : (
                    <div className="absolute top-6 right-1/2 translate-x-1/2 text-center">
                      <div className="text-xs text-yellow-400 font-semibold">Owner</div>
                      {ownershipData.ownerAddress && (
                        <a
                          href={`https://scan.pulsechain.com/address/${ownershipData.ownerAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 bottom-2hover:text-blue-300 font-mono mt-0.5 inline-block"
                          title={ownershipData.ownerAddress}
                        >
                          0x...{ownershipData.ownerAddress.slice(-6)}
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Liquidity */}
                <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 py-0 px-3 min-h-[60px] flex items-center justify-center">
                  <div className="absolute top-2 right-1/2 translate-x-1/2 text-xs text-gray-400 font-medium uppercase tracking-wider">Liquidity</div>
                  <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-base text-white font-semibold">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          {(() => {
                            const usdLiquidity = Number(dexScreenerData.pairs[0].liquidity?.usd || 0);
                            return usdLiquidity > 0 ? `$${formatAbbrev(usdLiquidity)}` : '—';
                          })()}
                        </span>
                      </TooltipTrigger>
                      {(() => {
                        const usdLiquidity = Number(dexScreenerData.pairs[0].liquidity?.usd || 0);
                        return usdLiquidity > 0 ? (
                          <TooltipContent>
                            <p>${usdLiquidity.toLocaleString()}</p>
                          </TooltipContent>
                        ) : null;
                      })()}
                    </Tooltip>
                  </div>
                </div>

                {/* Liq/MCAP Ratio */}
                <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 py-0 px-3 min-h-[60px] flex items-center justify-center">
                  <div className="absolute top-2 right-1/2 translate-x-1/2 text-xs text-gray-400 font-medium uppercase tracking-wider">Liq/MCAP</div>
                  <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-base text-white font-semibold">
                    {(() => {
                      const liquidity = Number(dexScreenerData.pairs[0].liquidity?.usd || 0);
                      const mcap = dexScreenerData.pairs[0].fdv ? Number(dexScreenerData.pairs[0].fdv) : Number(dexScreenerData.pairs[0].marketCap || 0);
                      const ratio = mcap > 0 ? liquidity / mcap : 0;
                      return ratio > 0 ? `${(ratio * 100).toFixed(1)}%` : '—';
                    })()}
                  </div>
                </div>

                {/* Total Liquidity */}
                <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 py-0 px-3 min-h-[80px] flex items-center justify-center">
                  <div className="absolute top-2 right-1/2 translate-x-1/2 whitespace-nowrap text-xs text-gray-400 font-medium uppercase tracking-wider">Total Liquidity</div>
                  {totalLiquidity.isLoading ? (
                    <div className="text-center text-gray-500 text-sm">Loading...</div>
                  ) : totalLiquidity.usd > 0 ? (
                    <div className="absolute bottom-6 right-1/2 translate-x-1/2 text-base text-white font-semibold">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            ${formatAbbrev(totalLiquidity.usd)}
                          </span>
                        </TooltipTrigger>
                        {totalLiquidity.usd > 0 && (
                          <TooltipContent>
                            <p>${totalLiquidity.usd.toLocaleString()}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </div>
                  ) : (
                    <div className="text-center text-base text-white font-semibold">—</div>
                  )}
                  {totalLiquidity.pairCount > 0 && (
                    <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-xs text-green-400 font-medium">
                      {totalLiquidity.pairCount} {totalLiquidity.pairCount === 1 ? 'Pair' : 'Pairs'}
                    </div>
                  )}
                </div>

                {/* Burned Tokens */}
                <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 py-0 px-3 min-h-[60px] flex items-center justify-center">
                  <div className="absolute top-2 right-1/2 translate-x-1/2 text-xs text-gray-400 font-medium uppercase tracking-wider">Burned</div>
                  {isLoadingMetrics ? (
                    <Skeleton className="h-6 w-16" />
                  ) : burnedTokens ? (
                    <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-base text-white font-semibold">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-base text-white font-semibold">{formatAbbrev(burnedTokens.amount)}</div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{burnedTokens.amount.toLocaleString()}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  ) : (
                    <div className="text-center text-base text-white font-semibold">—</div>
                  )}
                  {burnedTokens && !isLoadingMetrics && (
                    <div className="absolute top-4 right-2 flex items-center justify-center w-8 h-8 rounded-full border-2 border-green-400">
                      <span className="text-[8px] text-green-400 font-semibold">{burnedTokens.percent.toFixed(1)}%</span>
                    </div>
                  )}
                </div>


              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Search Bar */}
      <MobileSearchBar />

      {/* Main Content */}
      <div className="flex flex-col md:flex-row items-start pt-4">
        {/* Left Panel - Chart Section */}
        <div className="w-full md:flex-[3] min-w-0 bg-slate-850">
          {/* Desktop Search Bar - Above left panel only */}
          <div className="hidden md:block mb-2 px-2">
            <DesktopSearchBar />
          </div>


          {/* Bottom Tabs */}
          <GeickoTabNavigation
            activeTab={activeTab}
            tabs={tabOptions}
            variant={isRabbyUI ? 'rabby' : 'classic'}
            onTabChange={setActiveTab}
          />

          {/* Content Tables */}
          <div className="px-2 md:px-3 py-1 min-w-0">
          <div className="bg-gray-900 rounded-t-none border-t-0 border border-gray-800 w-full min-w-0 relative z-20 overflow-x-auto rounded-lg">
              {/* Chart Tab */}
              {activeTab === 'chart' && (
                <div className="min-h-[420px] flex items-center justify-center">
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

              {/* Swap Tab */}
              {activeTab === 'switch' && (
                <div data-switch-tab className="min-h-[600px] w-full">
                  <GeickoSwapTab />
                </div>
              )}

              {/* Website Tab */}
              {activeTab === 'website' && <GeickoWebsiteTab websiteLink={websiteLink} />}

              {/* Stats Tab */}
              {activeTab === 'stats' && (
                <div className="w-full p-4">
                  <AdminStatsPanel
                    initialAddress={apiTokenAddress}
                    onFetchStart={handleFetchStartNoToast}
                    onFetchComplete={handleFetchCompleteNoToast}
                    onFetchError={handleFetchErrorNoToast}
                  />
                </div>
              )}

              {/* Audit Tab */}
              {activeTab === 'audit' && (
                <div className="w-full p-4">
                  <div className="relative">
                    <div className="absolute -top-2 -right-2">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                        BETA
                      </span>
                    </div>
                    <ContractAuditPanel
                      auditResult={auditResult}
                      isLoading={isLoadingAudit}
                      isContractVerified={contractData?.is_verified ?? false}
                      hasSourceCode={contractData?.source_code ? contractData.source_code.trim().length > 0 : false}
                    />
                  </div>
                </div>
              )}

              {/* Holders Tab */}
              {activeTab === 'holders' && (
                <GeickoHoldersTab
                  holders={holders}
                  holderStats={holderStats}
                  holdersPage={holdersPage}
                  holdersPerPage={holdersPerPage}
                  isLoadingHolders={isLoadingHolders}
                  tokenInfo={tokenInfo}
                  lpAddressSet={lpAddressSet}
                  onPageChange={setHoldersPage}
                  onOpenHolderTransfers={handleOpenHolderTransfers}
                />
              )}

              {/* Liquidity Tab */}
              {activeTab === 'liquidity' && (
                <LiquidityTab dexScreenerData={dexScreenerData} isLoading={isLoadingData} />
              )}

              {/* Contract Tab */}
              {activeTab === 'contract' && (
                <div className="flex flex-col h-[calc(160vh-300px)] min-h-[900px]">
                  <div className="flex-shrink-0 border-b border-gray-800">
                    <div className="h-[400px]">
                      <TokenAIChat contractAddress={apiTokenAddress} compact={true} />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto pt-4">
                    <TokenContractView contractAddress={apiTokenAddress} compact={true} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Token Information Tabs */}
          <div className="px-2 md:px-3 py-2 border-t border-gray-800">

            {/* View More Stats Button */}
            {dexScreenerData?.pairs?.[0] && (
              <div className="px-2 md:px-3 pt-3 pb-3">
                <button
                  onClick={() => setIsStatsModalOpen(true)}
                  className="relative w-full overflow-hidden text-xs text-blue-200 hover:text-white font-semibold py-3 rounded-lg border border-cyan-400/40 bg-gradient-to-r from-blue-900/40 via-purple-900/30 to-cyan-900/40 shadow-[0_0_15px_rgba(59,130,246,0.6),0_0_25px_rgba(168,85,247,0.45)] transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.85),0_0_40px_rgba(168,85,247,0.7)]"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-cyan-400/10 via-transparent to-purple-400/10 blur-md" aria-hidden="true" />
                  <span className="pointer-events-none relative">View More Stats →</span>
                  <span className="pointer-events-none absolute -left-10 top-0 h-0.5 w-2/3 bg-gradient-to-r from-transparent via-cyan-300 to-transparent animate-pulse" aria-hidden="true" />
                  <span className="pointer-events-none absolute -right-10 bottom-0 h-0.5 w-2/3 bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-pulse" aria-hidden="true" />
                </button>
              </div>
            )}

            {/* Links Section - Only show for token tab */}
            {tokenInfoTab === 'token' && (profileData?.profile?.websites?.length > 0 || profileData?.profile?.socials?.length > 0) && (
              <div className="mb-3 pt-3">
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
        <div className="w-full md:flex-[1.4] min-w-0 bg-gray-900 md:border-l border-gray-800 mt-2 md:mt-0 overflow-hidden">
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
                          className="w-10 h-10 rounded-full border border-white/20 bg-slate-900/90/30 object-cover"
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
                  </div>
                  {hasSocialLinks && (
                    <div className="flex divide-x divide-gray-800 bg-gray-900/70">
                      {socialTabs.map((tab) => (
                        <button
                          key={tab.label}
                          type="button"
                          onClick={() => {
                            if (tab.isDownload) {
                              const logoUrl = dexScreenerData?.tokenInfo?.logoURI || dexScreenerData?.pairs?.[0]?.baseToken?.logoURI || dexScreenerData?.pairs?.[0]?.info?.imageUrl;
                              const symbol = dexScreenerData?.tokenInfo?.symbol || dexScreenerData?.pairs?.[0]?.baseToken?.symbol || 'token';
                              if (logoUrl) {
                                downloadImage(logoUrl, `${symbol}-logo.png`);
                              }
                            } else {
                              handleSocialTabClick(tab.label, tab.url);
                            }
                          }}
                          disabled={!tab.url && !tab.isDownload}
                          className={`flex-1 text-center text-xs font-semibold px-3 py-2 transition-colors ${
                            activeSocialTab === tab.label ? 'text-white bg-gray-800' : 'text-gray-400'
                          } ${(tab.url || tab.isDownload) ? 'hover:text-white hover:bg-gray-800/60' : 'opacity-40 cursor-not-allowed'}`}
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


            {/* API Catalog - Hidden, now shown in modal */}




            {/* Desktop Stats Cards */}
            <div className="hidden md:block mb-2">
              {/* Stats Grid - Desktop right panel */}
              {dexScreenerData?.pairs?.[0] && (
                <div className="block mb-2 px-0">
                  <div className="grid grid-cols-2 gap-1">
                    {/* Left Column */}
                    <div className="space-y-0.5">
                      {/* Contract Address */}
                      {apiTokenAddress && (
                        <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 p-3">
                          <div className="flex flex-col space-y-1 items-center">
                            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider text-center">Contract</span>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleCopyAddress(apiTokenAddress)}
                                className="text-blue-400 hover:text-blue-300 font-mono text-xs"
                                title="Copy contract address"
                              >
                                0x...{apiTokenAddress.slice(-4)}
                              </button>
                              <button
                                onClick={() => handleCopyAddress(apiTokenAddress)}
                                className="flex items-center justify-center w-5 h-5 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                                aria-label="Copy contract address"
                                title="Copy contract address"
                              >
                                <Copy className="w-3 h-3 text-blue-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Decimals */}
                      <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Decimals</span>
                          <span className="text-xs text-white font-semibold">
                            {totalSupply?.decimals !== undefined ? totalSupply.decimals : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Supply & Token Info */}
                      <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 p-3">
                        <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider text-center">Supply Info</div>
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 font-medium">Total Supply</span>
                            <span className="text-xs text-white font-semibold">
                              {totalSupply ? (() => {
                                const supply = Number(totalSupply.supply) / Math.pow(10, totalSupply.decimals);
                                return formatAbbrev(supply);
                              })() : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 font-medium">Circ.</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-white font-semibold">
                                  {totalSupply ? (() => {
                                    const supply = Number(totalSupply.supply) / Math.pow(10, totalSupply.decimals);
                                    const burned = burnedTokens?.amount ?? 0;
                                    const circulating = Math.max(0, supply - burned);
                                    return formatAbbrev(circulating);
                                  })() : '—'}
                                </span>
                              </TooltipTrigger>
                              {totalSupply && (() => {
                                const supply = Number(totalSupply.supply) / Math.pow(10, totalSupply.decimals);
                                const burned = burnedTokens?.amount ?? 0;
                                const circulating = Math.max(0, supply - burned);
                                return (
                                  <TooltipContent>
                                    <p>{circulating.toLocaleString()}</p>
                                  </TooltipContent>
                                );
                              })()}
                            </Tooltip>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 font-medium">Holders</span>
                            {isLoadingMetrics ? (
                              <Skeleton className="h-4 w-12" />
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs text-white font-semibold">
                                    {holdersCount !== null ? (holdersCount >= 1000 ? `${(holdersCount / 1000).toFixed(1)}k` : holdersCount) : '—'}
                                  </span>
                                </TooltipTrigger>
                                {holdersCount !== null && (
                                  <TooltipContent>
                                    <p>{holdersCount.toLocaleString()}</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 font-medium">Age</span>
                            {isLoadingMetrics ? (
                              <Skeleton className="h-4 w-16" />
                            ) : (
                              <span className="text-xs text-white font-semibold">{creationDate || '—'}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Supply Held */}
                      <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 p-3">
                        <div className="text-xs text-gray-400 font-medium uppercase tracking-wider text-center">Supply Held</div>
                        {supplyHeld.isLoading ? (
                          <div className="text-center text-gray-500 text-sm">Loading...</div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-400 font-medium">Top 10</span>
                              <span className="text-xs text-white font-semibold">
                                {supplyHeld.top10 > 0 ? `${Math.round(supplyHeld.top10)}%` : '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-400 font-medium">Top 20</span>
                              <span className="text-xs text-white font-semibold">
                                {supplyHeld.top20 > 0 ? `${Math.round(supplyHeld.top20)}%` : '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-400 font-medium">Top 50</span>
                              <span className="text-xs text-white font-semibold">
                                {supplyHeld.top50 > 0 ? `${Math.round(supplyHeld.top50)}%` : '—'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Smart Contract Holder Share */}
                      <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 p-3">
                        <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider text-center">Supply In Contracts</div>
                        {smartContractHolderShare.isLoading ? (
                          <div className="text-center text-gray-500 text-sm">Loading...</div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-400 font-medium">Share</span>
                              <span className="text-xs text-white font-semibold">
                                {smartContractHolderShare.percent > 0 ? `${smartContractHolderShare.percent.toFixed(2)}%` : '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-400 font-medium">Contracts</span>
                              <span className="text-xs text-white font-semibold">
                                {smartContractHolderShare.contractCount > 0 ? smartContractHolderShare.contractCount : '—'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Burned Tokens */}
                      <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 py-0 px-3 min-h-[60px] flex items-center justify-center">
                        <div className="absolute top-2 right-1/2 translate-x-1/2 text-xs text-gray-400 font-medium uppercase tracking-wider">Burned</div>
                        {isLoadingMetrics ? (
                          <Skeleton className="h-6 w-16" />
                        ) : burnedTokens ? (
                          <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-base text-white font-semibold">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-base text-white font-semibold">{formatAbbrev(burnedTokens.amount)}</div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{burnedTokens.amount.toLocaleString()}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        ) : (
                          <div className="text-center text-base text-white font-semibold">—</div>
                        )}
                        {burnedTokens && !isLoadingMetrics && (
                          <div className="absolute top-4 right-2 flex items-center justify-center w-8 h-8 rounded-full border-2 border-green-400">
                            <span className="text-[8px] text-green-400 font-semibold">{burnedTokens.percent.toFixed(1)}%</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-0.5">
                      {/* Creator */}
                      <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 p-3">
                        <div className="flex flex-col space-y-1 items-center">
                          <span className="text-xs text-gray-400 font-medium uppercase tracking-wider text-center">Creator</span>
                          <div className="flex items-center justify-center gap-1">
                            {ownershipData.creatorAddress ? (
                              <>
                                <a
                                  href={`https://scan.pulsechain.com/address/${ownershipData.creatorAddress}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 font-mono text-xs"
                                  title={ownershipData.creatorAddress}
                                >
                                  {ownershipData.creatorAddress.slice(0, 6)}...{ownershipData.creatorAddress.slice(-4)}
                                </a>
                                <button
                                  onClick={() => handleCopyAddress(ownershipData.creatorAddress!)}
                                  className="flex items-center justify-center w-5 h-5 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                                  aria-label="Copy creator address"
                                  title="Copy creator address"
                                >
                                  <Copy className="w-3 h-3 text-blue-400" />
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-white font-semibold">—</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Ownership Status */}
                      <div className="relative h-16 bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 p-3">
                        <div className="absolute left-1/2 -translate-x-1/2 top-2 text-xs text-gray-400 font-medium uppercase tracking-wider">Ownership</div>
                        {ownershipData.isLoading ? (
                          <div className="text-center text-gray-500 text-sm">Loading...</div>
                        ) : (ownershipData.isRenounced || ownershipData.creatorAddress?.toLowerCase() === PUMP_TIRES_CREATOR.toLowerCase()) ? (
                          <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-center">
                            <div className="text-xs text-green-400 font-semibold">Renounced</div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {ownershipData.creatorAddress?.toLowerCase() === PUMP_TIRES_CREATOR.toLowerCase() ? 'Pump.Tires' : 'No Owner'}
                            </div>
                          </div>
                        ) : (
                          <div className="absolute top-6 right-1/2 translate-x-1/2 text-center">
                            <div className="text-xs text-yellow-400 font-semibold">Owner</div>
                            {ownershipData.ownerAddress && (
                              <a
                                href={`https://scan.pulsechain.com/address/${ownershipData.ownerAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300 font-mono mt-0.5 inline-block"
                                title={ownershipData.ownerAddress}
                              >
                                0x...{ownershipData.ownerAddress.slice(-6)}
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Price in WPLS */}
                      <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 py-0 px-3 min-h-[60px] flex items-center justify-center">
                        <div className="absolute top-2 right-1/2 translate-x-1/2 whitespace-nowrap text-xs text-gray-400 font-medium uppercase tracking-wider">Price (WPLS)</div>
                        <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-base text-white font-semibold">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                {(() => {
                                  const priceNative = Number(dexScreenerData.pairs[0].priceNative || 0);
                                  return priceNative > 0 ? priceNative.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : '—';
                                })()}
                              </span>
                            </TooltipTrigger>
                            {(() => {
                              const priceNative = Number(dexScreenerData.pairs[0].priceNative || 0);
                              return priceNative > 0 ? (
                                <TooltipContent>
                                  <p>{priceNative}</p>
                                </TooltipContent>
                              ) : null;
                            })()}
                          </Tooltip>
                        </div>
                      </div>

                      {/* Total Volume */}
                      <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 py-0 px-3 min-h-[60px] flex items-center justify-center">
                        <div className="absolute top-2 right-1/2 translate-x-1/2 whitespace-nowrap text-xs text-gray-400 font-medium uppercase tracking-wider">Total Volume</div>
                        <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-base text-white font-semibold">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                {(() => {
                                  const totalVolume = dexScreenerData.pairs.reduce((sum, pair) => sum + Number(pair.volume?.h24 || 0), 0);
                                  return totalVolume > 0 ? `$${formatAbbrev(totalVolume)}` : '—';
                                })()}
                              </span>
                            </TooltipTrigger>
                            {(() => {
                              const totalVolume = dexScreenerData.pairs.reduce((sum, pair) => sum + Number(pair.volume?.h24 || 0), 0);
                              return totalVolume > 0 ? (
                                <TooltipContent>
                                  <p>${totalVolume.toLocaleString()}</p>
                                </TooltipContent>
                              ) : null;
                            })()}
                          </Tooltip>
                        </div>
                      </div>

                      {/* Liquidity */}
                      <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 py-0 px-3 min-h-[60px] flex items-center justify-center">
                        <div className="absolute top-2 right-1/2 translate-x-1/2 text-xs text-gray-400 font-medium uppercase tracking-wider">Liquidity</div>
                        <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-base text-white font-semibold">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                {(() => {
                                  const usdLiquidity = Number(dexScreenerData.pairs[0].liquidity?.usd || 0);
                                  return usdLiquidity > 0 ? `$${formatAbbrev(usdLiquidity)}` : '—';
                                })()}
                              </span>
                            </TooltipTrigger>
                            {(() => {
                              const usdLiquidity = Number(dexScreenerData.pairs[0].liquidity?.usd || 0);
                              return usdLiquidity > 0 ? (
                                <TooltipContent>
                                  <p>${usdLiquidity.toLocaleString()}</p>
                                </TooltipContent>
                              ) : null;
                            })()}
                          </Tooltip>
                        </div>
                      </div>

                      {/* Liq/MCAP Ratio */}
                      <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 py-0 px-3 min-h-[60px] flex items-center justify-center">
                        <div className="absolute top-2 right-1/2 translate-x-1/2 text-xs text-gray-400 font-medium uppercase tracking-wider">Liq/MCAP</div>
                        <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-base text-white font-semibold">
                          {(() => {
                            const liquidity = Number(dexScreenerData.pairs[0].liquidity?.usd || 0);
                            const mcap = dexScreenerData.pairs[0].fdv ? Number(dexScreenerData.pairs[0].fdv) : Number(dexScreenerData.pairs[0].marketCap || 0);
                            const ratio = mcap > 0 ? liquidity / mcap : 0;
                            return ratio > 0 ? `${(ratio * 100).toFixed(1)}%` : '—';
                          })()}
                        </div>
                      </div>

                      {/* Total Liquidity */}
                      <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 py-0 px-3 min-h-[80px] flex items-center justify-center">
                        <div className="absolute top-2 right-1/2 translate-x-1/2 whitespace-nowrap text-xs text-gray-400 font-medium uppercase tracking-wider">Total Liquidity</div>
                        {totalLiquidity.isLoading ? (
                          <div className="text-center text-gray-500 text-sm">Loading...</div>
                        ) : totalLiquidity.usd > 0 ? (
                          <div className="absolute bottom-6 right-1/2 translate-x-1/2 text-base text-white font-semibold">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  ${formatAbbrev(totalLiquidity.usd)}
                                </span>
                              </TooltipTrigger>
                              {totalLiquidity.usd > 0 && (
                                <TooltipContent>
                                  <p>${totalLiquidity.usd.toLocaleString()}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </div>
                        ) : (
                          <div className="text-center text-base text-white font-semibold">—</div>
                        )}
                        {totalLiquidity.pairCount > 0 && (
                          <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-xs text-green-400 font-medium">
                            {totalLiquidity.pairCount} {totalLiquidity.pairCount === 1 ? 'Pair' : 'Pairs'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

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
                        className="w-full bg-slate-900/40 border border-white/10 rounded px-3 py-2 pr-16 text-white text-sm font-semibold focus:outline-none focus:border-orange-500 transition-colors backdrop-blur"
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

                  <div className="bg-slate-900/90/40 border border-white/10 rounded px-3 py-2 mb-2 backdrop-blur">
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
      <GeickoHolderTransfersModal
        isOpen={isHolderTransfersOpen}
        holderAddress={holderTransfersAddress}
        transfers={holderTransfers}
        isLoading={isLoadingHolderTransfers}
        error={holderTransfersError}
        expandedTxs={expandedHolderTxs}
        tokenSymbol={baseSymbol || 'TOKEN'}
        onClose={handleCloseHolderTransfers}
        onToggleExpand={toggleExpandedHolderTx}
      />

      {/* Stats Modal */}
      {isStatsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90/80 backdrop-blur-sm p-4" onClick={() => setIsStatsModalOpen(false)}>
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
              <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-white/5 p-4">
                <AdminStatsPanel
                  initialAddress={apiTokenAddress}
                  compact
                  onFetchStart={handleFetchStart}
                  onFetchComplete={handleFetchComplete}
                  onFetchError={handleFetchError}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Copy confirmation toast */}
      {copyToast.show && (
        <GeickoToast
          message={copyToast.message}
          variant="success"
          onClose={() => setCopyToast({ message: '', show: false })}
        />
      )}
    </>
  );
}

export default function GeickoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
          <LoaderThree />
        </div>
      }
    >
      <GeickoPageContent />
    </Suspense>
  );
}
