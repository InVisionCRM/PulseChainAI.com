'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import DexScreenerChart from '@/components/DexScreenerChart';
import { LoaderOne, LoaderThree } from "@/components/ui/loader";
import { Copy, Download, Info, ChevronDown } from 'lucide-react';
import type { ContractData, TokenInfo, DexScreenerData, SearchResultItem, ContractAuditResult } from '../../types';
import { fetchContract, fetchTokenInfo, fetchDexScreenerData, search } from '@/services';
import { analyzeContractAudit } from '../../services/contractAuditService';
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
  GeickoHolderModal,
  GeickoHoldersTab,
  GeickoSwapTab,
  GeickoWebsiteTab,
  GeickoTabNavigation,
  GeickoOwnershipPanel,
  GeickoMetricsGrid,
  GeickoMarketStatsPanel,
  GeickoPerformancePanel,
  GeickoLiquidityPanel,
  GeickoPressurePanel,
  GeickoTradesTab,
  GeickoForensicsTab,
  GeickoTokenLeaguesPanel,
  GeickoHolderGrowthPanel,
  GeickoBridgeFlowsTab,
  GeickoToast,
  type OwnershipData,
} from '@/components/geicko';
import { DesktopSearchBar } from '@/components/DesktopSearchBar';
import GeickoPairModal from '@/components/geicko/GeickoPairModal';
import { pulsechainAddressUrl } from '@/lib/pulsechainExplorer';
import { AddToGroupButton } from '@/components/portfolio/AddToGroupButton';
import dynamic from 'next/dynamic';

// The bubble map pulls in d3-force and only renders inside the Holders tab, so
// load it on demand instead of in the page's initial bundle.
const BubbleMap = dynamic(
  () => import('@/components/portfolio/BubbleMap').then((m) => m.BubbleMap),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-[460px] place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm text-[var(--text-faint)]">
        Loading bubble map…
      </div>
    ),
  },
);

// These tab panels are only mounted when their tab/modal is opened, and several
// pull heavy deps (syntax highlighter, markdown, audit logic). Loading them on
// demand keeps the initial /geicko bundle lean.
const TabLoading = () => (
  <div className="grid h-48 place-items-center text-sm text-[var(--text-faint)]">Loading…</div>
);
const AdminStatsPanel = dynamic(() => import('@/components/AdminStatsPanel'), { loading: TabLoading });
const TokenAIChat = dynamic(() => import('@/components/TokenAIChat'), { ssr: false, loading: TabLoading });
const TokenContractView = dynamic(() => import('@/components/TokenContractView'), { ssr: false, loading: TabLoading });
const LiquidityTab = dynamic(() => import('@/components/LiquidityTab'), { loading: TabLoading });
const ContractAuditPanel = dynamic(() => import('@/components/ContractAuditPanel'), { ssr: false, loading: TabLoading });

// "pulsex-v2" → "PulseX V2", "9mm" → "9mm", "9inch" → "9inch", etc.
const prettyDex = (dexId?: string | null): string => {
  if (!dexId) return '';
  const known: Record<string, string> = {
    pulsex: 'PulseX',
    'pulsex-v1': 'PulseX V1',
    'pulsex-v2': 'PulseX V2',
    '9mm': '9mm',
    '9inch': '9inch',
    uniswap: 'Uniswap',
    'uniswap-v2': 'Uniswap V2',
    'uniswap-v3': 'Uniswap V3',
  };
  const key = dexId.toLowerCase();
  if (known[key]) return known[key];
  return key
    .replace(/-/g, ' ')
    .replace(/\bv(\d)/gi, 'V$1')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

function ContractHolderTooltipRow({
  holder,
}: {
  holder: { address: string; percent: number; type: 'LP' | 'Contract' };
}) {
  const [copied, setCopied] = useState(false);
  const copyOne = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(holder.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }, [holder.address]);
  return (
    <li className="text-xs font-mono text-[var(--text-muted)] space-y-0.5 border-b border-[var(--line)] pb-1.5 last:border-0">
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--text-muted)]">{truncateAddress(holder.address)}</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            copyOne();
          }}
          className="shrink-0 p-0.5 rounded text-cyan-400 hover:text-cyan-300"
          aria-label="Copy address"
          title="Copy address"
        >
          {copied ? (
            <span className="text-[10px]">Copied</span>
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
      <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
        {holder.type} · {holder.percent.toFixed(2)}% of supply
      </div>
    </li>
  );
}

function GeickoPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast, updateToast, dismissToast } = useToast();
  const addressFromQuery = searchParams.get('address');
  const tabFromQuery = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'gold' | 'chart' | 'trades' | 'forensics' | 'holders' | 'bridge' | 'liquidity' | 'contract' | 'switch' | 'website' | 'stats' | 'audit'>('chart');
  const tokenInfoTab: 'token' = 'token';
  const [apiTokenAddress, setApiTokenAddress] = useState<string>('');
  const [goldBadgeAddresses, setGoldBadgeAddresses] = useState<string[]>([]);
  const [goldProfile, setGoldProfile] = useState<{ description: string | null; logo_url: string | null; custom_links: { label: string; url: string }[] } | null>(null);
  const [goldLogoFallback, setGoldLogoFallback] = useState<string | null>(null);
  const [goldLogoCustomFailed, setGoldLogoCustomFailed] = useState(false);
  const [tokenAmount, setTokenAmount] = useState<string>('1');
  const [calculatorCurrency, setCalculatorCurrency] = useState<'usd' | 'wpls'>('usd');
  const [burnedTokens, setBurnedTokens] = useState<{ amount: number; percent: number } | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState<boolean>(false);
  const [holdersCount, setHoldersCount] = useState<number | null>(null);
  const [creationDate, setCreationDate] = useState<string | null>(null);
  const [activeSocialTab, setActiveSocialTab] = useState<string | null>(null);
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

  // Ownership state (OwnershipData from API includes creationTxTo, isPumpTiresToken)
  const [ownershipData, setOwnershipData] = useState<OwnershipData>({
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
    contractAddresses?: string[];
    contractHolders?: Array<{ address: string; value: string; percent: number; type: 'LP' | 'Contract' }>;
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
  // Liquidity pairs for the Liquidity tab, sourced from GeckoTerminal (cleaner
  // than DexScreener) via /api/geicko/pools.
  const [geckoPools, setGeckoPools] = useState<DexScreenerData | null>(null);
  const [selectedPairAddress, setSelectedPairAddress] = useState<string | null>(null);
  const [pairModalOpen, setPairModalOpen] = useState(false);
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


  // Load token/contract data function - works for both tokens and non-token contracts
  const loadTokenData = useCallback(async (address: string) => {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      setError('Invalid address');
      return;
    }

    setIsLoadingData(true);
    setError(null);

    // The shared API client declares timeouts but never wires them to an
    // AbortController, so a stalled upstream (Blockscout/DexScreener) leaves a
    // fetch pending forever — which would hang Promise.allSettled below and pin
    // isLoadingData=true, spinning the chart/stat tabs endlessly. Guard each
    // call with a hard timeout so the load always settles and the UI resolves
    // to real data or an empty state instead of an infinite spinner.
    const withTimeout = <T,>(p: Promise<T>, ms = 20000): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error('request timed out')), ms),
        ),
      ]);

    try {
      // Always fetch contract data first (works for both tokens and non-token contracts)
      // Token-specific data is optional and failures are handled gracefully
      const [contractResult, tokenResult, dexResult, profileResult] = await Promise.allSettled([
        withTimeout(fetchContract(address)),
        withTimeout(fetchTokenInfo(address)).catch(() => ({ data: null, raw: null })), // Gracefully handle non-token contracts
        withTimeout(fetchDexScreenerData(address)).catch(() => ({ data: null, raw: null })), // Gracefully handle non-token contracts
        withTimeout(dexscreenerApi.getTokenProfile(address)).catch(() => ({ success: false, data: null })) // Gracefully handle non-token contracts
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
      // Route through our server endpoint, NOT a browser-direct Blockscout call:
      // (1) server-to-server avoids the CORS failure that made this tab empty in
      // production, and (2) the endpoint falls back to on-chain Transfer-log
      // reconstruction via the RPC pool when the flaky PulseChain explorer is
      // down — so holders still load instead of showing "no holders".
      const res = await fetch(
        `/api/geicko/holders?token=${address}&network=pulsechain`,
      );
      const data = res.ok ? await res.json() : null;
      const items: Array<{ address?: string; value?: string; isContract?: boolean }> =
        Array.isArray(data?.holders) ? data.holders : [];

      const processedHolders = items
        .map((h) => ({
          address: (h.address || '').toLowerCase(),
          value: h.value || '0',
          isContract: !!h.isContract,
        }))
        .filter((item) => item.address && item.value !== '0');

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
    setOwnershipData(prev => ({ ...prev, isLoading: true }));

    // Fetch the fast "core" fields (Holders, supply, supply-held, burned) and
    // the slow "ownership" branch (on-chain owner() RPC walk) as two separate
    // requests in parallel. Core renders as soon as it lands instead of
    // waiting on the flaky RPC pool, so Holders is snappy again.
    const coreRequest = (async () => {
      try {
        const response = await fetch(`/api/token-metrics/${address}?scope=core`);
        if (!response.ok) throw new Error('Failed to fetch token metrics');

        const metrics = await response.json();

        if (metrics.burnedTokens) {
          setBurnedTokens(metrics.burnedTokens);
        }
        if (metrics.holdersCount !== null && metrics.holdersCount !== undefined) {
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
        if (metrics.totalSupply) {
          setTotalSupply(metrics.totalSupply);
        }
      } catch (error) {
        console.error('Failed to load core token metrics:', error);
        setSupplyHeld(prev => ({ ...prev, isLoading: false }));
        setSmartContractHolderShare(prev => ({ ...prev, isLoading: false }));
      } finally {
        setIsLoadingMetrics(false);
      }
    })();

    const ownershipRequest = (async () => {
      try {
        const response = await fetch(`/api/token-metrics/${address}?scope=ownership`);
        if (!response.ok) throw new Error('Failed to fetch ownership data');

        const { ownershipData } = await response.json();
        if (ownershipData) {
          setOwnershipData({ ...ownershipData, isLoading: false });
        } else {
          setOwnershipData(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Failed to load ownership data:', error);
        setOwnershipData(prev => ({ ...prev, isLoading: false }));
      }
    })();

    await Promise.all([coreRequest, ownershipRequest]);
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

  const handleOpenHolderTransfers = useCallback((address: string) => {
    setHolderTransfersAddress(address);
    setIsHolderTransfersOpen(true);
  }, []);

  const handleCloseHolderTransfers = useCallback(() => {
    setIsHolderTransfersOpen(false);
    setHolderTransfersAddress(null);
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


  // Fetch GOLD badge list once
  useEffect(() => {
    fetch('/api/gold-badges')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d?.addresses)) setGoldBadgeAddresses(d.addresses); })
      .catch(() => {});
  }, []);

  // Handle URL parameters - load token when address is in URL and set tab
  useEffect(() => {
    if (addressFromQuery && /^0x[a-fA-F0-9]{40}$/.test(addressFromQuery)) {
      setApiTokenAddress(addressFromQuery);
    }
    if (tabFromQuery) {
      const validTabs = ['gold', 'chart', 'trades', 'forensics', 'holders', 'bridge', 'liquidity', 'contract', 'switch', 'stats', 'website', 'audit'];
      if (validTabs.includes(tabFromQuery)) {
        setActiveTab(tabFromQuery as typeof activeTab);
      }
    }
  }, [addressFromQuery, tabFromQuery]);

  // Default to GOLD tab when first viewing a GOLD token (no tab in URL), only if user hasn't switched tab yet
  const lastAddressForGoldDefault = useRef<string | null>(null);
  useEffect(() => {
    if (!apiTokenAddress || !goldBadgeAddresses.length || tabFromQuery) return;
    const isGold = goldBadgeAddresses.some((a) => a.toLowerCase() === apiTokenAddress.toLowerCase());
    if (isGold && lastAddressForGoldDefault.current !== apiTokenAddress && activeTab === 'chart') {
      lastAddressForGoldDefault.current = apiTokenAddress;
      setActiveTab('gold');
    }
    if (!isGold) lastAddressForGoldDefault.current = null;
  }, [apiTokenAddress, goldBadgeAddresses, tabFromQuery, activeTab]);

  // Fetch token profile when token is set (so custom logo shows in header and GOLD tab)
  useEffect(() => {
    if (!apiTokenAddress) {
      setGoldProfile(null);
      setGoldLogoFallback(null);
      setGoldLogoCustomFailed(false);
      return;
    }
    setGoldProfile(null);
    setGoldLogoFallback(null);
    setGoldLogoCustomFailed(false);
    fetch(`/api/token-profile?address=${encodeURIComponent(apiTokenAddress)}`)
      .then((r) => r.json())
      .then((d) => setGoldProfile({ description: d.description ?? null, logo_url: d.logo_url ?? null, custom_links: Array.isArray(d.custom_links) ? d.custom_links : [] }))
      .catch(() => setGoldProfile({ description: null, logo_url: null, custom_links: [] }));
  }, [apiTokenAddress]);

  // DexScreener logo fallback when GOLD tab has no custom logo
  useEffect(() => {
    if (activeTab !== 'gold' || !apiTokenAddress || !goldProfile) return;
    if (goldProfile.logo_url) return;
    fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(apiTokenAddress)}`)
      .then((r) => r.json())
      .then((d) => {
        const pairs = d?.pairs ?? [];
        const wplsAddr = '0xA1077a294dDE1B09bB078844df40758a5D0f9a27'.toLowerCase();
        const wplsPair = pairs.find((p: { chainId?: string; baseToken?: { address?: string }; quoteToken?: { address?: string } }) => {
          if (p.chainId !== 'pulsechain') return false;
          const base = (p.baseToken?.address ?? '').toLowerCase();
          const quote = (p.quoteToken?.address ?? '').toLowerCase();
          return base === wplsAddr || quote === wplsAddr;
        });
        const pair = wplsPair ?? pairs.find((p: { chainId?: string }) => p.chainId === 'pulsechain') ?? pairs[0];
        if (!pair) return;
        const base = pair.baseToken?.address?.toLowerCase();
        const addr = apiTokenAddress.toLowerCase();
        const token = base === addr ? pair.baseToken : pair.quoteToken;
        const url = token?.logoURI || pair.info?.imageUrl;
        if (url) setGoldLogoFallback(url);
      })
      .catch(() => {});
  }, [activeTab, apiTokenAddress, goldProfile]);

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
    window.localStorage.removeItem('geicko-ui-preset');
  }, []);

  // Prefer WPLS pair so price/liquidity reflect Token/WPLS, not another quote (e.g. USDC)
  const WPLS_ADDRESS = '0xA1077a294dDE1B09bB078844df40758a5D0f9a27';
  const primaryPair = useMemo(() => {
    // DexScreener first (it carries tokenInfo/logo extras), GeckoTerminal as the
    // fallback so the header still renders when DexScreener fails or lags.
    const pairs = (dexScreenerData?.pairs?.length ? dexScreenerData.pairs : geckoPools?.pairs) ?? [];
    if (pairs.length === 0) return null;
    const wpls = WPLS_ADDRESS.toLowerCase();
    const wplsPairs = pairs.filter((p: { baseToken?: { address?: string }; quoteToken?: { address?: string } }) => {
      const base = (p.baseToken?.address ?? '').toLowerCase();
      const quote = (p.quoteToken?.address ?? '').toLowerCase();
      return base === wpls || quote === wpls;
    });
    if (wplsPairs.length > 0) {
      const byLiquidity = [...wplsPairs].sort((a: any, b: any) => Number(b?.liquidity?.usd ?? 0) - Number(a?.liquidity?.usd ?? 0));
      return byLiquidity[0] ?? null;
    }
    return pairs[0] ?? null;
  }, [dexScreenerData?.pairs, geckoPools]);

  // Pair list for the pair picker. GeckoTerminal (via /api/geicko/pools) covers
  // every PulseChain DEX and finds pools DexScreener misses, so prefer it once
  // loaded; DexScreener's list is only the fallback while it loads.
  const selectorPairs = useMemo(() => {
    const gt = geckoPools?.pairs ?? [];
    return gt.length ? gt : (dexScreenerData?.pairs ?? []);
  }, [geckoPools, dexScreenerData?.pairs]);

  // Display pair: user-selected or primary (WPLS preferred). Used for price, chart, liquidity display.
  // A selection can come from the GeckoTerminal list, so resolve against both sources.
  const displayPair = useMemo(() => {
    if (!selectedPairAddress) return primaryPair;
    const pairs = [...(geckoPools?.pairs ?? []), ...(dexScreenerData?.pairs ?? [])];
    const found = pairs.find(
      (p: { pairAddress?: string }) => (p.pairAddress || '').toLowerCase() === selectedPairAddress.toLowerCase(),
    );
    return found ?? primaryPair;
  }, [selectedPairAddress, primaryPair, geckoPools, dexScreenerData?.pairs]);

  // Reset selected pair when token changes or when primary pair loads (so default is primary)
  useEffect(() => {
    if (!apiTokenAddress) {
      setSelectedPairAddress(null);
      return;
    }
    if (!primaryPair?.pairAddress) return;
    const pairs = [...(geckoPools?.pairs ?? []), ...(dexScreenerData?.pairs ?? [])];
    const currentInList = selectedPairAddress && pairs.some(
      (p: { pairAddress?: string }) => (p.pairAddress || '').toLowerCase() === selectedPairAddress.toLowerCase(),
    );
    if (!currentInList) setSelectedPairAddress(primaryPair.pairAddress);
  }, [apiTokenAddress, primaryPair?.pairAddress, geckoPools, dexScreenerData?.pairs, selectedPairAddress]);

  // Load liquidity pairs from GeckoTerminal for the Liquidity tab (cleaner and
  // more complete than DexScreener's pair list).
  useEffect(() => {
    if (!apiTokenAddress) { setGeckoPools(null); return; }
    let alive = true;
    const net = displayPair?.chainId || 'pulsechain';
    fetch(`/api/geicko/pools?network=${net}&token=${apiTokenAddress}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d || !Array.isArray(d.pairs)) return;
        setGeckoPools({ pairs: d.pairs, totalPairs: d.totalPairs, wplsPairs: d.wplsPairs });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [apiTokenAddress, displayPair?.chainId]);

  // Use primaryPair when displayPair not yet set (e.g. before effect runs) so mobile/header always show content when we have pair data
  const effectivePair = displayPair ?? primaryPair;

  const websiteCandidates = [
    ...(profileData?.profile?.websites || []),
    ...(profileData?.profile?.cmsLinks || []),
    ...(primaryPair?.info?.websites || []),
  ] as Array<{ label?: string; url?: string }>;

  const socialSources = [
    ...(profileData?.profile?.socials || []),
    ...(primaryPair?.info?.socials || []),
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

  const baseSymbol = displayPair?.baseToken?.symbol || dexScreenerData?.tokenInfo?.symbol || tokenInfo?.symbol || 'Token';
  const quoteSymbol = displayPair?.quoteToken?.symbol || 'WPLS';
  const tokenNameDisplay = dexScreenerData?.tokenInfo?.name || tokenInfo?.name || displayPair?.baseToken?.name || 'Token';
  // Custom uploaded logo (GOLD admin) takes precedence, then DexScreener
  const tokenLogoSrc =
    goldProfile?.logo_url ||
    profileData?.profile?.logo ||
    profileData?.profile?.iconImageUrl ||
    dexScreenerData?.tokenInfo?.logoURI ||
    displayPair?.baseToken?.logoURI ||
    displayPair?.info?.imageUrl ||
    '';
  // Banner header first; if none, use logo (including custom); if no logo, use default
  const headerImageUrl = profileData?.profile?.headerImageUrl || displayPair?.info?.imageUrl || tokenLogoSrc || '/app-pics/clean.png';
  const isPumpTiresToken =
    ownershipData.isPumpTiresToken === true ||
    ownershipData.creatorAddress?.toLowerCase() === PUMP_TIRES_CREATOR.toLowerCase() ||
    ownershipData.creationTxTo?.toLowerCase() === PUMP_TIRES_CREATOR.toLowerCase();
  const priceUsd = Number(displayPair?.priceUsd || 0);
  const priceChange = Number(displayPair?.priceChange?.h24 || 0);
  const formattedPrice = priceUsd >= 1 ? priceUsd.toFixed(4) : priceUsd.toFixed(6);
  const marketCapValue = Number(displayPair?.marketCap ?? displayPair?.fdv ?? 0);
  const formattedMarketCap = formatMarketCapLabel(marketCapValue);
  const heroTagline = formatWebsiteDisplay(websiteLink) || profileData?.profile?.header || displayPair?.info?.header || tokenNameDisplay;
  const socialTabs: Array<{ label: string; url: string | null; isDownload?: boolean }> = [
    { label: 'Website', url: websiteLink },
    { label: 'Twitter', url: twitterLink },
    { label: 'Telegram', url: telegramLink },
    { label: 'Download Logo', url: null, isDownload: true },
  ];
  const hasSocialLinks = socialTabs.some((tab) => Boolean(tab.url));
  const addressItems: Array<{ label: string; address: string }> = displayPair
    ? [
        { label: 'POOL', address: displayPair.pairAddress },
        { label: (baseSymbol || 'TOKEN').toUpperCase(), address: displayPair.baseToken?.address || '' },
        { label: (quoteSymbol || 'QUOTE').toUpperCase(), address: displayPair.quoteToken?.address || '' },
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

  const isGoldToken = Boolean(apiTokenAddress && goldBadgeAddresses.some((a) => a.toLowerCase() === apiTokenAddress.toLowerCase()));
  const tabOptions: Array<{ id: typeof activeTab; label: string }> = [
    ...(isGoldToken ? [{ id: 'gold' as const, label: 'GOLD' }] : []),
    { id: 'chart', label: 'Chart' },
    { id: 'trades', label: 'Trades' },
    { id: 'forensics', label: 'Forensics' },
    { id: 'holders', label: 'Holders' },
    { id: 'bridge', label: 'Bridge' },
    { id: 'liquidity', label: 'Liquidity' },
    { id: 'contract', label: 'Code' },
    { id: 'switch', label: 'Swap' },
    { id: 'website', label: 'Website' },
    { id: 'stats', label: 'Stats' },
    { id: 'audit', label: 'Audit' },
  ];


  return (
    <>
      <div className="isolate min-h-screen bg-gradient-to-br from-[var(--panel)] via-[var(--surface-2)] to-[var(--panel)] text-[var(--text)] font-sans px-2 md:px-3 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-24 left-16 h-72 w-72 bg-gradient-to-br from-[var(--surface-2)] via-[var(--panel)] to-transparent blur-3xl" />
          <div className="absolute bottom-24 right-1/4 h-64 w-64 bg-gradient-to-tr from-brand-orange/10 via-transparent to-transparent blur-3xl" />
        </div>
      {/* Header Section */}


      {/* Mobile Token Header - Top of mobile layout */}
      <div className="md:hidden px-0 mb-1">
        {isLoadingData ? (
          <div className="flex items-center justify-center py-4">
            <LoaderThree />
          </div>
        ) : effectivePair ? (
          <div className="px-2 mb-2 pt-2">
            <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl overflow-hidden shadow-[0_12px_35px_rgba(0,0,0,0.45)]">
              <div className="relative h-40 border-b border-[var(--line)] bg-[var(--panel)]">
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
                {isPumpTiresToken && (
                  <div className="absolute top-2 left-2 z-10">
                    <a
                      href="https://pump.tires"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--surface-2)] backdrop-blur border border-[var(--line)] text-[var(--text)] text-xs font-semibold tracking-wide hover:bg-[var(--surface-3)] hover:border-[var(--line-strong)] transition-all"
                    >
                      <span aria-hidden>🛞</span>
                      <span>Pump.Tires</span>
                    </a>
                  </div>
                )}
                {/* Token info overlay */}
                <div className="absolute top-1 left-1 right-1 p-0">
                  <div className="flex justify-between gap-0">
                    <div>
                      {selectorPairs.length > 1 ? (
                        <button
                          type="button"
                          aria-label="Select trading pair"
                          onClick={() => setPairModalOpen(true)}
                          className="inline-flex max-w-[190px] items-center gap-1 rounded-tl-lg border border-[var(--line-strong)] bg-[var(--surface-2)] px-2 py-0.5 text-xl font-bold tracking-tight text-[var(--text)] backdrop-blur-md transition-colors hover:bg-[var(--surface-3)] focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
                        >
                          <span className="truncate">
                            {(displayPair?.baseToken?.symbol ?? baseSymbol)}{' '}
                            <span className="text-[var(--text-faint)]">/</span>{' '}
                            {(displayPair?.quoteToken?.symbol ?? quoteSymbol)}
                          </span>
                          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                        </button>
                      ) : (
                        <div className="text-lg p-1 font-bold text-[var(--text)] rounded-tl-lg bg-transparent backdrop-blur-md tracking-tight">
                          {(effectivePair?.baseToken?.symbol ?? baseSymbol)} <span className="text-[var(--text)] pb-1 bg-transparent">/</span> {(effectivePair?.quoteToken?.symbol ?? quoteSymbol)}
                        </div>
                      )}
                      <div className="text-xs text-[var(--text)] pb-1 text-left pl-2 bg-transparent backdrop-blur-xs">
                        {tokenNameDisplay}
                      </div>
                    </div>
                    <div className="text-center justify-center">
                      <div className="text-lg p-1 font-semibold text-[var(--text)] rounded-tr-lg bg-transparent backdrop-blur-md">
                        ${((): string => {
                          const p = Number(effectivePair?.priceUsd || 0);
                          return p >= 1 ? p.toFixed(4) : p.toFixed(6);
                        })()}
                      </div>
                      <div className={`text-xs text-center pb-1 justify-center font-semibold p-1 bg-transparent backdrop-blur-md ${Number(effectivePair?.priceChange?.h24 ?? 0) >= 0 ? 'text-[var(--up)]' : 'text-red-400'}`}>
                        {Number(effectivePair?.priceChange?.h24 ?? 0) >= 0 ? '↑' : '↓'}
                        {Math.abs(Number(effectivePair?.priceChange?.h24 ?? 0)).toFixed(2)}%
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
                    <div className="w-10 h-10 rounded-full bg-brand-navy border border-[var(--line)] flex items-center justify-center text-[var(--text)] font-bold">
                      {baseSymbol.charAt(0)}
                    </div>
                  )}
                  <div className="text-sm font-semibold text-[var(--text)] drop-shadow-[0_0_10px_rgba(0,0,0,0.9)] truncate max-w-[220px]">
                    {heroTagline}
                  </div>
                </div>
              </div>
              {hasSocialLinks && (
                <div className="flex divide-x divide-gray-800 bg-[var(--panel)]">
                  {socialTabs.map((tab) => (
                    <button
                      key={tab.label}
                      type="button"
                      onClick={() => {
                        if (tab.isDownload) {
                          const logoUrl = dexScreenerData?.tokenInfo?.logoURI || displayPair?.baseToken?.logoURI || displayPair?.info?.imageUrl;
                          const symbol = dexScreenerData?.tokenInfo?.symbol || displayPair?.baseToken?.symbol || 'token';
                          if (logoUrl) {
                            downloadImage(logoUrl, `${symbol}-logo.png`);
                          }
                        } else {
                          handleSocialTabClick(tab.label, tab.url);
                        }
                      }}
                      disabled={!tab.url && !tab.isDownload}
                      className={`flex-1 text-center text-xs font-semibold px-3 py-2 transition-colors ${
                        activeSocialTab === tab.label ? 'text-[var(--text)] bg-[var(--panel)]' : 'text-[var(--text-muted)]'
                      } ${(tab.url || tab.isDownload) ? 'hover:text-[var(--text)] hover:bg-[var(--panel)]' : 'opacity-40 cursor-not-allowed'}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-xs text-[var(--text-muted)] py-4 text-center">No token data available</div>
        )}
      </div>

      {/* Mobile Stats - Top of mobile layout */}
      <div className="md:hidden">
        {/* Stats Grid - Same layout as mobile single panel */}
        {effectivePair && (
          <div className="block mb-1 px-1">
            <div className="grid grid-cols-2 gap-1">
              {/* Left Column */}
              <div className="space-y-0.5">
                {/* Contract Address */}
                {apiTokenAddress && (
                  <div className="bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-blue-500/[0.04] rounded-lg shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15),inset_2px_2px_4px_rgba(0,0,0,0.3)] p-3">
                    <div className="flex flex-col space-y-1 items-center">
                      <span className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider text-center">Contract</span>
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
                          className="flex items-center justify-center w-5 h-5 rounded bg-[var(--surface)] border border-[var(--line)] hover:bg-[var(--surface-2)] transition-colors"
                          aria-label="Copy contract address"
                          title="Copy contract address"
                        >
                          <Copy className="w-3 h-3 text-blue-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                {/* Creator */}
                <div className="bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-blue-500/[0.04] rounded-lg shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15),inset_2px_2px_4px_rgba(0,0,0,0.3)] p-3">
                  <div className="flex flex-col space-y-1 items-center">
                    <span className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider text-center">Creator</span>
                    <div className="flex items-center justify-center gap-1">
                      {ownershipData.creatorAddress ? (
                        <>
                          <a
                            href={`https://scan.mypinata.cloud/ipfs/bafybeienxyoyrhn5tswclvd3gdjy5mtkkwmu37aqtml6onbf7xnb3o22pe/#/address/${ownershipData.creatorAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 font-mono text-xs"
                            title={ownershipData.creatorAddress}
                          >
                            {ownershipData.creatorAddress.slice(0, 6)}...{ownershipData.creatorAddress.slice(-4)}
                          </a>
                          <button
                            onClick={() => handleCopyAddress(ownershipData.creatorAddress!)}
                            className="flex items-center justify-center w-5 h-5 rounded bg-[var(--surface)] border border-[var(--line)] hover:bg-[var(--surface-2)] transition-colors"
                            aria-label="Copy creator address"
                            title="Copy creator address"
                          >
                            <Copy className="w-3 h-3 text-blue-400" />
                          </button>
                          <AddToGroupButton
                            address={ownershipData.creatorAddress}
                            source="creator"
                            chain="pulsechain"
                            context={{ tokenName: tokenInfo?.name, tokenSymbol: tokenInfo?.symbol }}
                            size={13}
                          />
                        </>
                      ) : (
                        <span className="text-xs text-[var(--text)] font-semibold">—</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ownership Status */}
                <div className="bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-blue-500/[0.04] rounded-lg shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15),inset_2px_2px_4px_rgba(0,0,0,0.3)] p-3">
                  <div className="text-xs text-[var(--text-muted)] mb-2 font-medium uppercase tracking-wider text-center">Ownership</div>
                  {ownershipData.isLoading ? (
                    <div className="text-center text-[var(--text-muted)] text-sm">Loading...</div>
                  ) : (ownershipData.isRenounced || ownershipData.creatorAddress?.toLowerCase() === PUMP_TIRES_CREATOR.toLowerCase()) ? (
                    <div className="text-center">
                      <div className="text-xs text-[var(--up)] font-semibold">Renounced</div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        {ownershipData.creatorAddress?.toLowerCase() === PUMP_TIRES_CREATOR.toLowerCase() ? 'Pump.Tires' : 'No Owner'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="text-xs text-yellow-400 font-semibold">Owner</div>
                      {(() => {
                        const addr = ownershipData.ownerAddress || ownershipData.creatorAddress;
                        return addr ? (
                          <span className="inline-flex items-center gap-1 mt-0.5">
                            <a
                              href={`https://scan.mypinata.cloud/ipfs/bafybeienxyoyrhn5tswclvd3gdjy5mtkkwmu37aqtml6onbf7xnb3o22pe/#/address/${addr}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 font-mono inline-block"
                              title={addr}
                            >
                              0x...{addr.slice(-6)}
                            </a>
                            <AddToGroupButton
                              address={addr}
                              source="owner"
                              chain="pulsechain"
                              context={{ tokenName: tokenInfo?.name, tokenSymbol: tokenInfo?.symbol }}
                              size={12}
                            />
                          </span>
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>

                {/* Decimals */}
                <div className="bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-blue-500/[0.04] rounded-lg shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15),inset_2px_2px_4px_rgba(0,0,0,0.3)] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">Decimals</span>
                    <span className="text-xs text-[var(--text)] font-semibold">
                      {totalSupply?.decimals !== undefined ? totalSupply.decimals : <LoaderOne />}
                    </span>
                  </div>
                </div>

                {/* Supply & Token Info */}
                <div className="bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-blue-500/[0.04] rounded-lg shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15),inset_2px_2px_4px_rgba(0,0,0,0.3)] p-3">
                  <div className="text-xs text-[var(--text-muted)] mb-2 font-medium uppercase tracking-wider text-center">Supply Info</div>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--text-muted)] font-medium">Total Supply</span>
                      <span className="text-xs text-[var(--text)] font-semibold">
                        {totalSupply ? (() => {
                          const supply = Number(totalSupply.supply) / Math.pow(10, totalSupply.decimals);
                          return formatAbbrev(supply);
                        })() : <LoaderOne />}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--text-muted)] font-medium">Circ.</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-[var(--text)] font-semibold">
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
                      <span className="text-xs text-[var(--text-muted)] font-medium">Holders</span>
                      {isLoadingMetrics ? (
                        <Skeleton className="h-4 w-12" />
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-[var(--text)] font-semibold">
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
                      <span className="text-xs text-[var(--text-muted)] font-medium">Age</span>
                      {isLoadingMetrics ? (
                        <Skeleton className="h-4 w-16" />
                      ) : (
                        <span className="text-xs text-[var(--text)] font-semibold">{creationDate || '—'}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Supply Held */}
                <div className="bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-blue-500/[0.04] rounded-lg shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15),inset_2px_2px_4px_rgba(0,0,0,0.3)] p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider text-center flex-1">Supply Held</div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-cyan-400 hover:text-cyan-300 p-0.5 rounded shrink-0"
                          aria-label="What Supply Held excludes"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[240px]">
                        <p className="text-xs">
                          Excludes burn addresses (e.g. …dead, …0000) and smart contract addresses (e.g. LPs, routers). Only EOA wallets in the top 50 are counted.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {supplyHeld.isLoading ? (
                    <div className="text-center text-[var(--text-muted)] text-sm">Loading...</div>
                  ) : (
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--text-muted)] font-medium">Top 10</span>
                        <span className="text-xs text-[var(--text)] font-semibold">
                          {supplyHeld.top10 > 0 ? `${Math.round(supplyHeld.top10)}%` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--text-muted)] font-medium">Top 20</span>
                        <span className="text-xs text-[var(--text)] font-semibold">
                          {supplyHeld.top20 > 0 ? `${Math.round(supplyHeld.top20)}%` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--text-muted)] font-medium">Top 50</span>
                        <span className="text-xs text-[var(--text)] font-semibold">
                          {supplyHeld.top50 > 0 ? `${Math.round(supplyHeld.top50)}%` : '—'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Smart Contract Holder Share */}
                <div className="bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-blue-500/[0.04] rounded-lg shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15),inset_2px_2px_4px_rgba(0,0,0,0.3)] p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider text-center flex-1">Supply In Contracts</div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-cyan-400 hover:text-cyan-300 p-0.5 rounded shrink-0"
                          aria-label="Addresses counted as contracts"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[340px] p-2">
                        <div className="space-y-1.5">
                          <p className="text-xs text-[var(--text-muted)] font-medium">Addresses counted (top 50):</p>
                          {smartContractHolderShare.contractHolders?.length ? (
                            <>
                              <ul className="space-y-0 max-h-48 overflow-y-auto">
                                {smartContractHolderShare.contractHolders.map((h) => (
                                  <ContractHolderTooltipRow key={h.address} holder={h} />
                                ))}
                              </ul>
                            </>
                          ) : smartContractHolderShare.contractAddresses?.length ? (
                            <>
                              <ul className="text-xs font-mono text-[var(--text-muted)] space-y-0.5 max-h-40 overflow-y-auto">
                                {smartContractHolderShare.contractAddresses.map((addr: string) => (
                                  <li key={addr} className="text-[var(--text-muted)]">
                                    {truncateAddress(addr)}
                                  </li>
                                ))}
                              </ul>
                            </>
                          ) : (
                            <p className="text-[10px] text-[var(--text-muted)]">No contract holders in top 50.</p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {smartContractHolderShare.isLoading ? (
                    <div className="text-center text-[var(--text-muted)] text-sm">Loading...</div>
                  ) : (
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--text-muted)] font-medium">Share</span>
                        <span className="text-xs text-[var(--text)] font-semibold">
                          {smartContractHolderShare.percent > 0 ? `${smartContractHolderShare.percent.toFixed(2)}%` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--text-muted)] font-medium">Contracts</span>
                        <span className="text-xs text-[var(--text)] font-semibold">
                          {smartContractHolderShare.contractCount > 0 ? smartContractHolderShare.contractCount : '—'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-0.5">
                {/* Liquidity */}
                <div className="bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-blue-500/[0.04] rounded-lg shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15),inset_2px_2px_4px_rgba(0,0,0,0.3)] p-3">
                  <div className="text-xs text-[var(--text-muted)] mb-2 font-medium uppercase tracking-wider text-center">Liquidity</div>
                  <div className="text-center text-base text-[var(--text)] font-semibold">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          {(() => {
                            const p = displayPair ?? effectivePair;
                            const usdLiquidity = Number(p?.liquidity?.usd || 0);
                            return usdLiquidity > 0 ? `$${formatAbbrev(usdLiquidity)}` : '—';
                          })()}
                        </span>
                      </TooltipTrigger>
                      {(() => {
                        const p = displayPair ?? effectivePair;
                        const usdLiquidity = Number(p?.liquidity?.usd || 0);
                        return usdLiquidity > 0 ? (
                          <TooltipContent>
                            <p>${usdLiquidity.toLocaleString()}</p>
                          </TooltipContent>
                        ) : null;
                      })()}
                    </Tooltip>
                  </div>
                </div>

                {/* Market Cap */}
                <div className="bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-blue-500/[0.04] rounded-lg shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15),inset_2px_2px_4px_rgba(0,0,0,0.3)] p-3">
                  <div className="text-xs text-[var(--text-muted)] mb-2 font-medium uppercase tracking-wider text-center">Market Cap</div>
                  <div className="text-center text-base text-[var(--text)] font-semibold">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          {(() => {
                            const p = displayPair ?? effectivePair;
                            const mcap = p?.fdv ? Number(p.fdv) : Number(p?.marketCap || 0);
                            return mcap > 0 ? `$${formatAbbrev(mcap)}` : '—';
                          })()}
                        </span>
                      </TooltipTrigger>
                      {(() => {
                        const p = displayPair ?? effectivePair;
                        const mcap = p?.fdv ? Number(p.fdv) : Number(p?.marketCap || 0);
                        return mcap > 0 ? (
                          <TooltipContent>
                            <p>${mcap.toLocaleString()}</p>
                          </TooltipContent>
                        ) : null;
                      })()}
                    </Tooltip>
                  </div>
                </div>

                {/* Liq/MCAP Ratio */}
                <div className="bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-blue-500/[0.04] rounded-lg shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15),inset_2px_2px_4px_rgba(0,0,0,0.3)] p-3">
                  <div className="text-xs text-[var(--text-muted)] mb-2 font-medium uppercase tracking-wider text-center">Liq/MCAP</div>
                  <div className="text-center text-base text-[var(--text)] font-semibold">
                    {(() => {
                      const p = displayPair ?? effectivePair;
                      const liquidity = Number(p?.liquidity?.usd || 0);
                      const mcap = p?.fdv ? Number(p.fdv) : Number(p?.marketCap || 0);
                      const ratio = mcap > 0 ? liquidity / mcap : 0;
                      return ratio > 0 ? `${(ratio * 100).toFixed(1)}%` : '—';
                    })()}
                  </div>
                </div>

                {/* Total Liquidity */}
                <div className="bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-blue-500/[0.04] rounded-lg shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15),inset_2px_2px_4px_rgba(0,0,0,0.3)] p-3">
                  <div className="text-xs text-[var(--text-muted)] mb-2 font-medium uppercase tracking-wider text-center">Total Liquidity</div>
                  {totalLiquidity.isLoading ? (
                    <div className="text-center text-[var(--text-muted)] text-sm">Loading...</div>
                  ) : (
                    <div className="text-center text-base text-[var(--text)] font-semibold">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            {totalLiquidity.usd > 0 ? `$${formatAbbrev(totalLiquidity.usd)}` : '—'}
                          </span>
                        </TooltipTrigger>
                        {totalLiquidity.usd > 0 && (
                          <TooltipContent>
                            <p>${totalLiquidity.usd.toLocaleString()}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </div>
                  )}
                  {totalLiquidity.pairCount > 0 && (
                    <div className="text-center text-xs text-[var(--up)] font-medium mt-0.5">
                      {totalLiquidity.pairCount} {totalLiquidity.pairCount === 1 ? 'Pair' : 'Pairs'}
                    </div>
                  )}
                </div>

                {/* Burned Tokens */}
                <div className="bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-blue-500/[0.04] rounded-lg shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15),inset_2px_2px_4px_rgba(0,0,0,0.3)] p-3">
                  <div className="text-xs text-[var(--text-muted)] mb-2 font-medium uppercase tracking-wider text-center">Burned</div>
                  {isLoadingMetrics ? (
                    <div className="flex justify-center"><Skeleton className="h-6 w-16" /></div>
                  ) : burnedTokens ? (
                    <div className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-base text-[var(--text)] font-semibold">{formatAbbrev(burnedTokens.amount)}</div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{burnedTokens.amount.toLocaleString()}</p>
                        </TooltipContent>
                      </Tooltip>
                      <div className="text-xs text-[var(--up)] font-medium mt-0.5">{burnedTokens.percent.toFixed(1)}% of supply</div>
                    </div>
                  ) : (
                    <div className="text-center text-base text-[var(--text)] font-semibold">—</div>
                  )}
                </div>


              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex flex-col md:flex-row md:items-stretch md:h-[calc(100vh-100px)] md:min-h-[760px] pt-4">
        {/* Left Panel - Chart Section */}
        <div className="w-full md:flex-[3] min-w-0 bg-slate-850 flex flex-col md:h-full md:min-h-0">
          {/* Desktop Search Bar - Above left panel only */}
          <div className="hidden md:block mb-2 px-2">
            <DesktopSearchBar />
          </div>


          {/* Price Performance — above the tabbed container, not inside it */}
          {apiTokenAddress && (
            <div className="px-2 md:px-3">
              <GeickoPerformancePanel
                network={displayPair?.chainId}
                token={apiTokenAddress}
                pool={displayPair?.pairAddress}
                price={priceUsd}
              />
            </div>
          )}

          {/* Bottom Tabs */}
          <GeickoTabNavigation
            activeTab={activeTab}
            tabs={tabOptions}
            onTabChange={setActiveTab}
          />

          {/* Content Tables */}
          <div className="px-2 md:px-3 py-1 min-w-0 flex-1 min-h-0 flex flex-col">
          <div className="bg-[var(--panel)] rounded-t-none border-t-0 border border-[var(--line)] w-full min-w-0 relative z-20 overflow-auto rounded-lg flex-1 min-h-0">
              {/* GOLD Tab */}
              {activeTab === 'gold' && isGoldToken && (
                <div className="min-h-[360px] p-4 md:p-6 border border-amber-500/30 bg-gradient-to-b from-amber-100/70 to-transparent dark:from-amber-950/20 rounded-b-lg">
                  {goldProfile === null ? (
                    <div className="flex items-center justify-center py-12">
                      <LoaderThree />
                      <span className="text-amber-700 dark:text-amber-200/80 text-sm ml-2">Loading GOLD profile…</span>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {(goldProfile.logo_url || goldLogoFallback) && (
                        <div className="flex justify-center">
                          <img
                            src={(goldProfile.logo_url && !goldLogoCustomFailed) ? goldProfile.logo_url : (goldLogoFallback || '')}
                            alt=""
                            className="w-20 h-20 rounded-full object-cover border-2 border-amber-500/50 shadow-lg"
                            onError={() => {
                              if (goldProfile.logo_url && !goldLogoFallback) {
                                setGoldLogoCustomFailed(true);
                                fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(apiTokenAddress)}`)
                                  .then((r) => r.json())
                                  .then((d) => {
                                    const pairs = d?.pairs ?? [];
                                    const pc = pairs.find((p: { chainId?: string }) => p.chainId === 'pulsechain');
                                    const pair = pc || pairs[0];
                                    if (!pair) return;
                                    const base = pair.baseToken?.address?.toLowerCase();
                                    const addr = apiTokenAddress.toLowerCase();
                                    const token = base === addr ? pair.baseToken : pair.quoteToken;
                                    const url = token?.logoURI || pair.info?.imageUrl;
                                    if (url) setGoldLogoFallback(url);
                                  })
                                  .catch(() => {});
                              }
                            }}
                          />
                        </div>
                      )}
                      {goldProfile.description && (
                        <p className="text-amber-900 dark:text-amber-100/90 text-sm md:text-base leading-relaxed max-w-2xl mx-auto text-center whitespace-pre-wrap">{goldProfile.description}</p>
                      )}
                      {goldProfile.custom_links && goldProfile.custom_links.length > 0 && (
                        <div className="flex flex-wrap gap-2 justify-center">
                          {goldProfile.custom_links.map((link, i) => (
                            <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/40 text-sm font-medium hover:bg-amber-500/30 transition-colors">
                              {link.label || link.url}
                            </a>
                          ))}
                        </div>
                      )}
                      {/* CTA */}
                      <div className="mt-6 pt-6 border-t border-amber-500/20 text-center">
                        <p className="text-amber-800 dark:text-amber-200/90 text-xs md:text-sm max-w-xl mx-auto mb-4">
                          You think your token deserves to be GOLD Verified by MORBIUS? Get it today along with your token&apos;s own custom games table on Morbius.io! Limited promotion.
                        </p>
                        <a
                          href="https://morbius.io/marketing"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="gold-btn-shimmer inline-flex items-center justify-center px-6 py-3 rounded-xl font-bold text-amber-950 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 border border-amber-300/80 shadow-lg hover:opacity-95 transition-opacity"
                        >
                          Let&apos;s GO!
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Chart Tab */}
              {activeTab === 'chart' && (
                <div className="h-full min-h-[520px] flex flex-col gap-2 p-2 md:p-3">
                  {apiTokenAddress && (
                    <GeickoPressurePanel
                      network={displayPair?.chainId}
                      token={apiTokenAddress}
                    />
                  )}
                  <div className="flex-1 min-h-[420px] flex flex-col">
                    {isLoadingData ? (
                      <div className="flex-1 flex items-center justify-center min-h-[360px]">
                        <div className="text-center">
                          <LoaderThree />
                          <p className="text-[var(--text-muted)] text-xs mt-2">Loading chart...</p>
                        </div>
                      </div>
                    ) : displayPair?.pairAddress ? (
                      <div className="w-full flex-1 min-h-[420px]">
                        <DexScreenerChart pairAddress={displayPair.pairAddress} />
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-center text-[var(--text-muted)] min-h-[360px]">
                        <div className="text-xs">No chart data available</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Trades Tab — recent buys/sells + top traders */}
              {activeTab === 'trades' && apiTokenAddress && (
                <GeickoTradesTab
                  network={displayPair?.chainId}
                  token={apiTokenAddress}
                  symbol={baseSymbol}
                />
              )}

              {/* Forensics Tab — creator trace + first buyers/snipers */}
              {activeTab === 'forensics' && apiTokenAddress && (
                <GeickoForensicsTab
                  network={displayPair?.chainId}
                  token={apiTokenAddress}
                  symbol={baseSymbol}
                />
              )}

              {/* Swap Tab */}
              {activeTab === 'switch' && (
                <div data-switch-tab className="h-full min-h-[600px] w-full">
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
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase bg-brand-orange/15 text-brand-orange border border-brand-orange/30">
                        Beta
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

              {/* Bridge Inflows & Outflows Tab */}
              {activeTab === 'bridge' && apiTokenAddress && (
                <div className="w-full p-2 md:p-3">
                  <GeickoBridgeFlowsTab token={apiTokenAddress} priceUsd={priceUsd} />
                </div>
              )}

              {/* Holders Tab */}
              {activeTab === 'holders' && (
                <div className="space-y-3">
                  {apiTokenAddress && (
                    <GeickoHolderGrowthPanel token={apiTokenAddress} />
                  )}
                  {apiTokenAddress && (
                    <GeickoTokenLeaguesPanel token={apiTokenAddress} totalSupply={totalSupply} priceUsd={priceUsd} symbol={baseSymbol} />
                  )}
                  {apiTokenAddress && (
                    <BubbleMap
                      token={apiTokenAddress}
                      chain="pulsechain"
                      symbol={tokenInfo?.symbol}
                    />
                  )}
                  <GeickoHoldersTab
                  holders={holders}
                  holderStats={holderStats}
                  holdersPage={holdersPage}
                  holdersPerPage={holdersPerPage}
                  isLoadingHolders={isLoadingHolders}
                  tokenInfo={tokenInfo}
                  lpAddressSet={lpAddressSet}
                  onPageChange={setHoldersPage}
                  onViewHolder={handleOpenHolderTransfers}
                />
                </div>
              )}

              {/* Liquidity Tab — all liquidity UI lives here. Pairs from GeckoTerminal. */}
              {activeTab === 'liquidity' && (
                <div className="p-2 md:p-3">
                  {apiTokenAddress && (
                    <GeickoLiquidityPanel
                      network={displayPair?.chainId}
                      token={apiTokenAddress}
                    />
                  )}
                  <LiquidityTab dexScreenerData={geckoPools ?? dexScreenerData} isLoading={isLoadingData} />
                </div>
              )}

              {/* Contract Tab */}
              {activeTab === 'contract' && (
                <div className="flex flex-col h-[calc(160vh-300px)] min-h-[900px]">
                  <div className="flex-shrink-0 border-b border-[var(--line)]">
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
          <div className="px-2 md:px-3 py-2 border-t border-[var(--line)]">

            {/* View More Stats Button */}
            {displayPair && (
              <div className="px-2 md:px-3 pt-3 pb-3">
                <button
                  onClick={() => setIsStatsModalOpen(true)}
                  className="relative w-full overflow-hidden text-xs text-blue-200 hover:text-[var(--text)] font-semibold py-3 rounded-lg border border-cyan-400/40 bg-gradient-to-r from-blue-900/40 via-purple-900/30 to-cyan-900/40 shadow-[0_0_15px_rgba(59,130,246,0.6),0_0_25px_rgba(168,85,247,0.45)] transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.85),0_0_40px_rgba(168,85,247,0.7)]"
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
                        className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-2)] text-[var(--text)] text-xs sm:text-sm font-semibold rounded-full border border-[var(--line-strong)] backdrop-blur-lg shadow-[0_8px_25px_rgba(0,0,0,0.2)] hover:bg-[var(--surface-2)] transition-colors"
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
                          className="flex items-center gap-2 px-3 py-2 bg-[var(--surface-2)] text-[var(--text)] text-xs sm:text-sm font-semibold rounded-full border border-[var(--line-strong)] backdrop-blur-lg shadow-[0_8px_25px_rgba(0,0,0,0.2)] hover:bg-[var(--surface-2)] transition-colors"
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
                <h2 className="text-sm font-semibold text-[var(--text)] mb-2">Quick Audit</h2>

                {(() => {
                  const quickAudit = profileData?.quickAudit;
                  return (
                    <>
                      {/* Contract Information */}
                      <div className="grid grid-cols-1 gap-2 mb-2">
                        <div className="bg-[var(--panel)] rounded p-2">
                          <div className="text-xs text-[var(--text-muted)] mb-1">Contract Info</div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-[var(--text-muted)]">Name:</span>
                              <span className="text-[var(--text)] font-mono text-xs truncate ml-2">{quickAudit.contractName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[var(--text-muted)]">Creator:</span>
                              <span className="text-[var(--text)] font-mono text-xs">{quickAudit.contractCreator ? `${quickAudit.contractCreator.slice(0, 6)}...${quickAudit.contractCreator.slice(-4)}` : 'Unknown'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[var(--text-muted)]">Owner:</span>
                              <span className={`font-mono text-xs ${quickAudit.contractRenounced ? 'text-[var(--up)]' : 'text-red-400'}`}>
                                {quickAudit.contractRenounced ? 'Renounced' : (quickAudit.contractOwner ? `${quickAudit.contractOwner.slice(0, 6)}...${quickAudit.contractOwner.slice(-4)}` : 'Unknown')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-[var(--panel)] rounded p-2">
                          <div className="text-xs text-[var(--text-muted)] mb-1">Security</div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-[var(--text-muted)]">Proxy:</span>
                              <span className={quickAudit.isProxy ? 'text-red-400' : 'text-[var(--up)]'}>
                                {quickAudit.isProxy ? 'Yes' : 'No'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[var(--text-muted)]">External Risk:</span>
                              <span className={quickAudit.hasExternalContractRisk ? 'text-red-400' : 'text-[var(--up)]'}>
                                {quickAudit.hasExternalContractRisk ? 'Yes' : 'No'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[var(--text-muted)]">Suspicious:</span>
                              <span className={quickAudit.hasSuspiciousFunctions ? 'text-red-400' : 'text-[var(--up)]'}>
                                {quickAudit.hasSuspiciousFunctions ? 'Yes' : 'No'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Capabilities Grid */}
                      <div className="bg-[var(--panel)] rounded p-2 mb-2">
                        <div className="text-xs text-[var(--text-muted)] mb-2">Capabilities</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">Mint:</span>
                            <span className={quickAudit.canMint ? 'text-red-400' : 'text-[var(--up)]'}>
                              {quickAudit.canMint ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">Burn:</span>
                            <span className={quickAudit.canBurn ? 'text-yellow-400' : 'text-[var(--up)]'}>
                              {quickAudit.canBurn ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">Blacklist:</span>
                            <span className={quickAudit.canBlacklist ? 'text-red-400' : 'text-[var(--up)]'}>
                              {quickAudit.canBlacklist ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">Pause:</span>
                            <span className={quickAudit.canPauseTrading ? 'text-red-400' : 'text-[var(--up)]'}>
                              {quickAudit.canPauseTrading ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">Fees:</span>
                            <span className={quickAudit.canUpdateFees ? 'text-red-400' : 'text-[var(--up)]'}>
                              {quickAudit.canUpdateFees ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">Max Wallet:</span>
                            <span className={quickAudit.canUpdateMaxWallet ? 'text-red-400' : 'text-[var(--up)]'}>
                              {quickAudit.canUpdateMaxWallet ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">Max TX:</span>
                            <span className={quickAudit.canUpdateMaxTx ? 'text-red-400' : 'text-[var(--up)]'}>
                              {quickAudit.canUpdateMaxTx ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">Cooldown:</span>
                            <span className={quickAudit.hasCooldown ? 'text-yellow-400' : 'text-[var(--up)]'}>
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
        <div className="w-full md:flex-[1.4] min-w-0 bg-[var(--panel)] md:border-l border-[var(--line)] mt-2 md:mt-0 md:h-full md:min-h-0 md:overflow-y-auto md:pt-3">
          {/* Token Header - Hidden on mobile, shown on desktop */}
          <div className="hidden md:block px-0 mb-1">
            {isLoadingData ? (
              <div className="flex items-center justify-center py-4">
                <LoaderThree />
              </div>
            ) : effectivePair ? (
              <div className="px-2 mb-2 pt-0">
                <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl overflow-hidden shadow-[0_12px_35px_rgba(0,0,0,0.45)]">
                  <div className="px-4 pt-2 pb-3 border-b border-[var(--line)]">
                    <div className="mt-0 flex items-end justify-between gap-4">
                      <div>
                        {selectorPairs.length > 1 ? (
                          <button
                            type="button"
                            aria-label="Select trading pair"
                            onClick={() => setPairModalOpen(true)}
                            className="inline-flex max-w-[240px] items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-2xl font-bold tracking-tight text-[var(--text)] transition-colors hover:bg-[var(--surface-2)] focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                          >
                            <span className="truncate">
                              {(displayPair?.baseToken?.symbol ?? baseSymbol)}{' '}
                              <span className="text-[var(--text-muted)]">/</span>{' '}
                              {(displayPair?.quoteToken?.symbol ?? quoteSymbol)}
                            </span>
                            <ChevronDown className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />
                          </button>
                        ) : (
                          <div className="text-2xl font-bold text-[var(--text)] tracking-tight">
                            {(effectivePair?.baseToken?.symbol ?? baseSymbol)} <span className="text-[var(--text-muted)]">/</span> {(effectivePair?.quoteToken?.symbol ?? quoteSymbol)}
                          </div>
                        )}
                        <div className="text-xs text-[var(--text-muted)] mt-1 truncate">
                          {tokenNameDisplay}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-semibold text-[var(--text)]">
                          ${((): string => {
                            const p = Number(effectivePair?.priceUsd || 0);
                            return p >= 1 ? p.toFixed(4) : p.toFixed(6);
                          })()}
                        </div>
                        <div className={`text-xs font-semibold ${Number(effectivePair?.priceChange?.h24 ?? 0) >= 0 ? 'text-[var(--up)]' : 'text-red-400'}`}>
                          {Number(effectivePair?.priceChange?.h24 ?? 0) >= 0 ? '↑' : '↓'}
                          {Math.abs(Number(effectivePair?.priceChange?.h24 ?? 0)).toFixed(2)}%
                        </div>


                  </div>
                </div>
              </div>
                  <div className="relative h-44 border-b border-[var(--line)] bg-gradient-to-r from-[var(--panel)] via-[var(--surface-2)] to-black">
                    {headerImageUrl ? (
                      <img
                        src={headerImageUrl}
                        alt={`${tokenNameDisplay} header`}
                        className="w-full h-full object-cover object-top"
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
                    {isPumpTiresToken && (
                      <div className="absolute top-2 left-2 z-10">
                        <a
                          href="https://pump.tires"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--surface-2)] backdrop-blur border border-[var(--line)] text-[var(--text)] text-xs font-semibold tracking-wide hover:bg-[var(--surface-3)] hover:border-[var(--line-strong)] transition-all"
                        >
                          <span aria-hidden>🛞</span>
                          <span>Pump.Tires</span>
                        </a>
                      </div>
                    )}
                    <div className="absolute left-4 bottom-3 flex items-center gap-3">
                      {tokenLogoSrc ? (
                        <img
                          src={tokenLogoSrc}
                          alt={`${tokenNameDisplay} logo`}
                          className="w-10 h-10 rounded-full border border-[var(--line-strong)] bg-[var(--panel)] object-cover"
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
                        <div className="w-10 h-10 rounded-full bg-[var(--panel)] border border-[var(--line)] flex items-center justify-center text-[var(--text)] font-bold">
                          {baseSymbol.charAt(0)}
                        </div>
                      )}
                      <div className="text-sm font-semibold text-[var(--text)] drop-shadow-[0_0_10px_rgba(0,0,0,0.9)] truncate max-w-[220px]">
                        {heroTagline}
                      </div>
                    </div>
                  </div>
                  {hasSocialLinks && (
                    <div className="flex divide-x divide-gray-800 bg-[var(--panel)]">
                      {socialTabs.map((tab) => (
                        <button
                          key={tab.label}
                          type="button"
                          onClick={() => {
                            if (tab.isDownload) {
                              const logoUrl = dexScreenerData?.tokenInfo?.logoURI || displayPair?.baseToken?.logoURI || displayPair?.info?.imageUrl;
                              const symbol = dexScreenerData?.tokenInfo?.symbol || displayPair?.baseToken?.symbol || 'token';
                              if (logoUrl) {
                                downloadImage(logoUrl, `${symbol}-logo.png`);
                              }
                            } else {
                              handleSocialTabClick(tab.label, tab.url);
                            }
                          }}
                          disabled={!tab.url && !tab.isDownload}
                          className={`flex-1 text-center text-xs font-semibold px-3 py-2 transition-colors ${
                            activeSocialTab === tab.label ? 'text-[var(--text)] bg-[var(--panel)]' : 'text-[var(--text-muted)]'
                          } ${(tab.url || tab.isDownload) ? 'hover:text-[var(--text)] hover:bg-[var(--panel)]' : 'opacity-40 cursor-not-allowed'}`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-[var(--text-muted)] py-4 text-center">No token data available</div>
            )}
          </div>


            {/* API Catalog - Hidden, now shown in modal */}




            {/* Desktop Stats Cards */}
            <div className="hidden md:block mb-2">
              {/* Stats Grid - Desktop right panel */}
              {displayPair && (
                <div className="block mb-2 px-0">
                  <div className="grid grid-cols-2 gap-1">
                    {/* Left Column */}
                    <div className="space-y-0.5">
                      {/* Contract Address */}
                      {apiTokenAddress && (
                        <div className="bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-blue-500/[0.04] rounded-lg shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15),inset_2px_2px_4px_rgba(0,0,0,0.3)] p-3">
                          <div className="flex flex-col space-y-1 items-center">
                            <span className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider text-center">Contract</span>
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
                                className="flex items-center justify-center w-5 h-5 rounded bg-[var(--surface)] border border-[var(--line)] hover:bg-[var(--surface-2)] transition-colors"
                                aria-label="Copy contract address"
                                title="Copy contract address"
                              >
                                <Copy className="w-3 h-3 text-blue-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Creator */}
                      <div className="bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-blue-500/[0.04] rounded-lg shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15),inset_2px_2px_4px_rgba(0,0,0,0.3)] p-3">
                        <div className="flex flex-col space-y-1 items-center">
                          <span className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider text-center">Creator</span>
                          <div className="flex items-center justify-center gap-1">
                            {ownershipData.creatorAddress ? (
                              <>
                                <a
                                  href={`https://scan.mypinata.cloud/ipfs/bafybeienxyoyrhn5tswclvd3gdjy5mtkkwmu37aqtml6onbf7xnb3o22pe/#/address/${ownershipData.creatorAddress}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 font-mono text-xs"
                                  title={ownershipData.creatorAddress}
                                >
                                  {ownershipData.creatorAddress.slice(0, 6)}...{ownershipData.creatorAddress.slice(-4)}
                                </a>
                                <button
                                  onClick={() => handleCopyAddress(ownershipData.creatorAddress!)}
                                  className="flex items-center justify-center w-5 h-5 rounded bg-[var(--surface)] border border-[var(--line)] hover:bg-[var(--surface-2)] transition-colors"
                                  aria-label="Copy creator address"
                                  title="Copy creator address"
                                >
                                  <Copy className="w-3 h-3 text-blue-400" />
                                </button>
                                <AddToGroupButton
                                  address={ownershipData.creatorAddress}
                                  source="creator"
                                  chain="pulsechain"
                                  context={{ tokenName: tokenInfo?.name, tokenSymbol: tokenInfo?.symbol }}
                                  size={13}
                                />
                              </>
                            ) : (
                              <span className="text-xs text-[var(--text)] font-semibold">—</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Ownership Status */}
                      <div className="relative h-16 bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-blue-500/[0.04] rounded-lg shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15),inset_2px_2px_4px_rgba(0,0,0,0.3)] p-3">
                        <div className="absolute left-1/2 -translate-x-1/2 top-2 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">Ownership</div>
                        {ownershipData.isLoading ? (
                          <div className="text-center text-[var(--text-muted)] text-sm">Loading...</div>
                        ) : (ownershipData.isRenounced || ownershipData.creatorAddress?.toLowerCase() === PUMP_TIRES_CREATOR.toLowerCase()) ? (
                          <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-center">
                            <div className="text-xs text-[var(--up)] font-semibold">Renounced</div>
                            <div className="text-xs text-[var(--text-muted)] mt-0.5">
                              {ownershipData.creatorAddress?.toLowerCase() === PUMP_TIRES_CREATOR.toLowerCase() ? 'Pump.Tires' : 'No Owner'}
                            </div>
                          </div>
                        ) : (
                          <div className="absolute top-6 right-1/2 translate-x-1/2 text-center">
                            <div className="text-xs text-yellow-400 font-semibold">Owner</div>
                            {(() => {
                              const addr = ownershipData.ownerAddress || ownershipData.creatorAddress;
                              return addr ? (
                                <span className="inline-flex items-center gap-1 mt-0.5">
                                  <a
                                    href={`https://scan.mypinata.cloud/ipfs/bafybeienxyoyrhn5tswclvd3gdjy5mtkkwmu37aqtml6onbf7xnb3o22pe/#/address/${addr}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-400 hover:text-blue-300 font-mono inline-block"
                                    title={addr}
                                  >
                                    0x...{addr.slice(-6)}
                                  </a>
                                  <AddToGroupButton
                                    address={addr}
                                    source="owner"
                                    chain="pulsechain"
                                    context={{ tokenName: tokenInfo?.name, tokenSymbol: tokenInfo?.symbol }}
                                    size={12}
                                  />
                                </span>
                              ) : null;
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Decimals */}
                      <div className="bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-blue-500/[0.04] rounded-lg shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15),inset_2px_2px_4px_rgba(0,0,0,0.3)] p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">Decimals</span>
                          <span className="text-xs text-[var(--text)] font-semibold">
                            {totalSupply?.decimals !== undefined ? totalSupply.decimals : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Supply & Token Info */}
                      <div className="bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-blue-500/[0.04] rounded-lg shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15),inset_2px_2px_4px_rgba(0,0,0,0.3)] p-3">
                        <div className="text-xs text-[var(--text-muted)] mb-2 font-medium uppercase tracking-wider text-center">Supply Info</div>
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[var(--text-muted)] font-medium">Total Supply</span>
                            <span className="text-xs text-[var(--text)] font-semibold">
                              {totalSupply ? (() => {
                                const supply = Number(totalSupply.supply) / Math.pow(10, totalSupply.decimals);
                                return formatAbbrev(supply);
                              })() : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[var(--text-muted)] font-medium">Circ.</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-[var(--text)] font-semibold">
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
                            <span className="text-xs text-[var(--text-muted)] font-medium">Holders</span>
                            {isLoadingMetrics ? (
                              <Skeleton className="h-4 w-12" />
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs text-[var(--text)] font-semibold">
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
                            <span className="text-xs text-[var(--text-muted)] font-medium">Age</span>
                            {isLoadingMetrics ? (
                              <Skeleton className="h-4 w-16" />
                            ) : (
                              <span className="text-xs text-[var(--text)] font-semibold">{creationDate || '—'}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Supply Held */}
                      <div className="bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-blue-500/[0.04] rounded-lg shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15),inset_2px_2px_4px_rgba(0,0,0,0.3)] p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider text-center flex-1">Supply Held</div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="text-cyan-400 hover:text-cyan-300 p-0.5 rounded shrink-0"
                                aria-label="What Supply Held excludes"
                              >
                                <Info className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-[240px]">
                              <p className="text-xs">
                                Excludes burn addresses (e.g. …dead, …0000) and smart contract addresses (e.g. LPs, routers). Only EOA wallets in the top 50 are counted.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        {supplyHeld.isLoading ? (
                          <div className="text-center text-[var(--text-muted)] text-sm">Loading...</div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-[var(--text-muted)] font-medium">Top 10</span>
                              <span className="text-xs text-[var(--text)] font-semibold">
                                {supplyHeld.top10 > 0 ? `${Math.round(supplyHeld.top10)}%` : '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-[var(--text-muted)] font-medium">Top 20</span>
                              <span className="text-xs text-[var(--text)] font-semibold">
                                {supplyHeld.top20 > 0 ? `${Math.round(supplyHeld.top20)}%` : '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-[var(--text-muted)] font-medium">Top 50</span>
                              <span className="text-xs text-[var(--text)] font-semibold">
                                {supplyHeld.top50 > 0 ? `${Math.round(supplyHeld.top50)}%` : '—'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Smart Contract Holder Share */}
                      <div className="bg-gradient-to-br from-cyan-500/[0.04] via-transparent to-blue-500/[0.04] rounded-lg shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15),inset_2px_2px_4px_rgba(0,0,0,0.3)] p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider text-center flex-1">Supply In Contracts</div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="text-cyan-400 hover:text-cyan-300 p-0.5 rounded shrink-0"
                                aria-label="Addresses counted as contracts"
                              >
                                <Info className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-[340px] p-2">
                              <div className="space-y-1.5">
                                <p className="text-xs text-[var(--text-muted)] font-medium">Addresses counted (top 50):</p>
                                {smartContractHolderShare.contractHolders?.length ? (
                                  <>
                                    <ul className="space-y-0 max-h-48 overflow-y-auto">
                                      {smartContractHolderShare.contractHolders.map((h) => (
                                        <ContractHolderTooltipRow key={h.address} holder={h} />
                                      ))}
                                    </ul>
                                  </>
                                ) : smartContractHolderShare.contractAddresses?.length ? (
                                  <>
                                    <ul className="text-xs font-mono text-[var(--text-muted)] space-y-0.5 max-h-40 overflow-y-auto">
                                      {smartContractHolderShare.contractAddresses.map((addr: string) => (
                                        <li key={addr} className="text-[var(--text-muted)]">
                                          {truncateAddress(addr)}
                                        </li>
                                      ))}
                                    </ul>
                                  </>
                                ) : (
                                  <p className="text-[10px] text-[var(--text-muted)]">No contract holders in top 50.</p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        {smartContractHolderShare.isLoading ? (
                          <div className="text-center text-[var(--text-muted)] text-sm">Loading...</div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-[var(--text-muted)] font-medium">Share</span>
                              <span className="text-xs text-[var(--text)] font-semibold">
                                {smartContractHolderShare.percent > 0 ? `${smartContractHolderShare.percent.toFixed(2)}%` : '—'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-[var(--text-muted)] font-medium">Contracts</span>
                              <span className="text-xs text-[var(--text)] font-semibold">
                                {smartContractHolderShare.contractCount > 0 ? smartContractHolderShare.contractCount : '—'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-0.5">
                      {/* Price in WPLS */}
                      <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-[var(--line-soft)] py-0 px-3 min-h-[60px] flex items-center justify-center">
                        <div className="absolute top-2 right-1/2 translate-x-1/2 whitespace-nowrap text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">Price (WPLS)</div>
                        <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-base text-[var(--text)] font-semibold">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                {(() => {
                                  const priceNative = Number(displayPair.priceNative || 0);
                                  return priceNative > 0 ? priceNative.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : '—';
                                })()}
                              </span>
                            </TooltipTrigger>
                            {(() => {
                              const priceNative = Number(displayPair.priceNative || 0);
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
                      <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-[var(--line-soft)] py-0 px-3 min-h-[60px] flex items-center justify-center">
                        <div className="absolute top-2 right-1/2 translate-x-1/2 whitespace-nowrap text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">Total Volume</div>
                        <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-base text-[var(--text)] font-semibold">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                {(() => {
                                  const pairs = dexScreenerData?.pairs ?? [];
                                  const totalVolume = pairs.reduce((sum, pair) => sum + Number(pair.volume?.h24 || 0), 0);
                                  return totalVolume > 0 ? `$${formatAbbrev(totalVolume)}` : '—';
                                })()}
                              </span>
                            </TooltipTrigger>
                            {(() => {
                              const pairs = dexScreenerData?.pairs ?? [];
                              const totalVolume = pairs.reduce((sum, pair) => sum + Number(pair.volume?.h24 || 0), 0);
                              return totalVolume > 0 ? (
                                <TooltipContent>
                                  <p>${totalVolume.toLocaleString()}</p>
                                </TooltipContent>
                              ) : null;
                            })()}
                          </Tooltip>
                        </div>
                      </div>

                      {/* Liquidity (for the selected pair) */}
                      <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-[var(--line-soft)] py-0 px-3 min-h-[60px] flex items-center justify-center">
                        <div className="absolute top-2 right-1/2 translate-x-1/2 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">Liquidity</div>
                        <div className="absolute bottom-1.5 right-1/2 translate-x-1/2 flex flex-col items-center leading-tight">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-base text-[var(--text)] font-semibold">
                                {(() => {
                                  const usdLiquidity = Number(displayPair.liquidity?.usd || 0);
                                  return usdLiquidity > 0 ? `$${formatAbbrev(usdLiquidity)}` : '—';
                                })()}
                              </span>
                            </TooltipTrigger>
                            {(() => {
                              const usdLiquidity = Number(displayPair.liquidity?.usd || 0);
                              return usdLiquidity > 0 ? (
                                <TooltipContent>
                                  <p>${usdLiquidity.toLocaleString()}</p>
                                </TooltipContent>
                              ) : null;
                            })()}
                          </Tooltip>
                          {displayPair.dexId && (
                            <a
                              href={pulsechainAddressUrl(displayPair.pairAddress || '')}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View this LP on the explorer"
                              className="max-w-[110px] truncate text-[9px] font-medium uppercase tracking-wide text-[var(--text-faint)] hover:text-[var(--text)]"
                            >
                              {prettyDex(displayPair.dexId)}
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Market Cap */}
                      <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-[var(--line-soft)] py-0 px-3 min-h-[60px] flex items-center justify-center">
                        <div className="absolute top-2 right-1/2 translate-x-1/2 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider whitespace-nowrap">Market Cap</div>
                        <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-base text-[var(--text)] font-semibold">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                {(() => {
                                  const mcap = displayPair.fdv ? Number(displayPair.fdv) : Number(displayPair.marketCap || 0);
                                  return mcap > 0 ? `$${formatAbbrev(mcap)}` : '—';
                                })()}
                              </span>
                            </TooltipTrigger>
                            {(() => {
                              const mcap = displayPair.fdv ? Number(displayPair.fdv) : Number(displayPair.marketCap || 0);
                              return mcap > 0 ? (
                                <TooltipContent>
                                  <p>${mcap.toLocaleString()}</p>
                                </TooltipContent>
                              ) : null;
                            })()}
                          </Tooltip>
                        </div>
                      </div>

                      {/* Liq/MCAP Ratio */}
                      <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-[var(--line-soft)] py-0 px-3 min-h-[60px] flex items-center justify-center">
                        <div className="absolute top-2 right-1/2 translate-x-1/2 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">Liq/MCAP</div>
                        <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-base text-[var(--text)] font-semibold">
                          {(() => {
                            const liquidity = Number(displayPair.liquidity?.usd || 0);
                            const mcap = displayPair.fdv ? Number(displayPair.fdv) : Number(displayPair.marketCap || 0);
                            const ratio = mcap > 0 ? liquidity / mcap : 0;
                            return ratio > 0 ? `${(ratio * 100).toFixed(1)}%` : '—';
                          })()}
                        </div>
                      </div>

                      {/* Total Liquidity */}
                      <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-[var(--line-soft)] py-0 px-3 min-h-[80px] flex items-center justify-center">
                        <div className="absolute top-2 right-1/2 translate-x-1/2 whitespace-nowrap text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">Total Liquidity</div>
                        {totalLiquidity.isLoading ? (
                          <div className="text-center text-[var(--text-muted)] text-sm">Loading...</div>
                        ) : totalLiquidity.usd > 0 ? (
                          <div className="absolute bottom-6 right-1/2 translate-x-1/2 text-base text-[var(--text)] font-semibold">
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
                          <div className="text-center text-base text-[var(--text)] font-semibold">—</div>
                        )}
                        {totalLiquidity.pairCount > 0 && (
                          <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-xs text-[var(--up)] font-medium">
                            {totalLiquidity.pairCount} {totalLiquidity.pairCount === 1 ? 'Pair' : 'Pairs'}
                          </div>
                        )}
                      </div>

                      {/* Burned Tokens */}
                      <div className="relative bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-[var(--line-soft)] py-0 px-3 min-h-[60px] flex items-center justify-center">
                        <div className="absolute top-2 right-1/2 translate-x-1/2 text-xs text-[var(--text-muted)] font-medium uppercase tracking-wider">Burned</div>
                        {isLoadingMetrics ? (
                          <Skeleton className="h-6 w-16" />
                        ) : burnedTokens ? (
                          <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-base text-[var(--text)] font-semibold">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-base text-[var(--text)] font-semibold">{formatAbbrev(burnedTokens.amount)}</div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{burnedTokens.amount.toLocaleString()}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        ) : (
                          <div className="text-center text-base text-[var(--text)] font-semibold">—</div>
                        )}
                        {burnedTokens && !isLoadingMetrics && (
                          <div className="absolute top-4 right-2 flex items-center justify-center w-8 h-8 rounded-full border-2 border-green-400">
                            <span className="text-[8px] text-[var(--up)] font-semibold">{burnedTokens.percent.toFixed(1)}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Token Amount Calculator */}
            {displayPair && (
              <div className="mb-2">
                <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] backdrop-blur-md p-2 shadow-[0_10px_35px_rgba(0,0,0,0.35)]">
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
                        className="w-full bg-[var(--panel)] border border-[var(--line)] rounded px-3 py-2 pr-16 text-[var(--text)] text-sm font-semibold focus:outline-none focus:border-orange-500 transition-colors backdrop-blur"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-xs font-medium pointer-events-none">
                        {displayPair.baseToken?.symbol || 'TOKEN'}
                      </div>
                    </div>
                    <div className="flex items-center justify-center my-1">
                      <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </div>
                  </div>

                  <div className="bg-[var(--panel)] border border-[var(--line)] rounded px-3 py-2 mb-2 backdrop-blur">
                    <div className="text-lg font-bold text-[var(--text)] flex items-center justify-between">
                      {(() => {
                        const amount = Number(tokenAmount) || 0;
                        const priceUsd = Number(displayPair.priceUsd || 0);
                        const priceNative = Number(displayPair.priceNative || 0);
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
                              <span className="text-[var(--text-muted)] text-sm ml-2">WPLS</span>
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
                          ? 'text-[var(--up)]'
                          : 'text-[var(--text-muted)]'
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
                          ? 'text-[var(--up)]'
                          : 'text-[var(--text-muted)]'
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
              <div className="text-xs text-center text-[var(--text-faint)] mb-1">Advertise Here</div>
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

      {/* Holder Modal (Portfolio / Transactions / Stakes) */}
      <GeickoHolderModal
        isOpen={isHolderTransfersOpen}
        holderAddress={holderTransfersAddress}
        tokenAddress={apiTokenAddress}
        tokenPriceUsd={priceUsd || null}
        onClose={handleCloseHolderTransfers}
      />

      <GeickoPairModal
        isOpen={pairModalOpen}
        pairs={selectorPairs}
        selectedPairAddress={displayPair?.pairAddress ?? selectedPairAddress}
        onSelect={(addr) => setSelectedPairAddress(addr)}
        onClose={() => setPairModalOpen(false)}
      />

      {/* Stats Modal */}
      {isStatsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--panel)] backdrop-blur-sm p-4" onClick={() => setIsStatsModalOpen(false)}>
          <div className="relative w-full max-w-6xl max-h-[90vh] bg-gradient-to-br from-[var(--panel)] via-[var(--surface-2)] to-[var(--panel)] rounded-xl shadow-2xl border border-[var(--line)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[var(--panel)] via-[var(--surface-2)] to-[var(--panel)] backdrop-blur-sm border-b border-[var(--line)]">
              <h2 className="text-base font-semibold text-[var(--text)] uppercase tracking-wider">Advanced Stats</h2>
              <button
                onClick={() => setIsStatsModalOpen(false)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] rounded-lg transition-all"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-70px)] p-4 bg-[var(--panel)]">
              <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] border border-[var(--line-soft)] p-4">
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
        <div className="min-h-screen bg-[var(--panel)] text-[var(--text)] flex items-center justify-center">
          <LoaderThree />
        </div>
      }
    >
      <GeickoPageContent />
    </Suspense>
  );
}
