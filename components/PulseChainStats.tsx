'use client';

import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
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
        const clonedResponse = response.clone();
        const text = await clonedResponse.text();
        responseSnippet = text.slice(0, MAX_SNIPPET_CHARS);
      } catch {
        responseSnippet = undefined;
      }
      const perfEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const durationMs = perfEnd - perfStart;

      listeners.forEach((listener) =>
        listener({
          type: 'finish',
          fetchId,
          method,
          url,
          timestamp: Date.now(),
          statusCode: response.status,
          ok: response.ok,
          durationMs,
          responseSnippet,
        })
      );

      return response;
    } catch (error: unknown) {
      const perfEnd = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const durationMs = perfEnd - perfStart;

      listeners.forEach((listener) =>
        listener({
          type: 'finish',
          fetchId,
          method,
          url,
          timestamp: Date.now(),
          ok: false,
          durationMs,
          error: error instanceof Error ? error.message : String(error),
        })
      );

      throw error;
    }
  };

  window.__codexFetchPatched = true;
};

const useFetchLogger = () => {
  const [logs, setLogs] = useState<NetworkEventLog[]>([]);

  useEffect(() => {
    ensureFetchLogger();
    if (!window.__codexFetchListeners) return;

    const listener: FetchListener = (event) => {
      setLogs((currentLogs) => {
        if (event.type === 'start') {
          const newLog: NetworkEventLog = {
            id: event.fetchId,
            url: event.url,
            method: event.method,
            status: 'pending',
            startedAt: new Date(event.timestamp).toISOString(),
            requestBody: event.requestBodySnippet,
          };
          return [newLog, ...currentLogs];
        } else {
          const existingIndex = currentLogs.findIndex((log) => log.id === event.fetchId);
          if (existingIndex === -1) {
            const newLog: NetworkEventLog = {
              id: event.fetchId,
              url: event.url,
              method: event.method,
              status: event.ok ? 'success' : 'error',
              startedAt: new Date(event.timestamp).toISOString(),
              endedAt: new Date(event.timestamp).toISOString(),
              durationMs: event.durationMs,
              statusCode: event.statusCode,
              responseSnippet: event.responseSnippet,
              error: event.error,
            };
            return [newLog, ...currentLogs];
          } else {
            const updated = [...currentLogs];
            updated[existingIndex] = {
              ...updated[existingIndex],
              status: event.ok ? 'success' : 'error',
              endedAt: new Date(event.timestamp).toISOString(),
              durationMs: event.durationMs,
              statusCode: event.statusCode,
              responseSnippet: event.responseSnippet,
              error: event.error,
            };
            return updated;
          }
        }
      });
    };

    window.__codexFetchListeners.add(listener);

    return () => {
      window.__codexFetchListeners?.delete(listener);
    };
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  return { logs, clearLogs };
};

const fetchJson = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.json();
};

const formatNumber2 = (val: number | string | null | undefined): string => {
  if (val === null || val === undefined) return '0';
  const num = Number(val);
  if (isNaN(num)) return String(val);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export type PulseChainStatsProps = {
  compact?: boolean;
};

export default function PulseChainStats({ compact = false }: PulseChainStatsProps): JSX.Element {
  const { logs, clearLogs } = useFetchLogger();
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [selectedStat, setSelectedStat] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [pulsechainDropdownOpen, setPulsechainDropdownOpen] = useState<boolean>(false);
  const pulsechainDropdownRef = useRef<HTMLDivElement>(null);
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

  // Close PulseChain dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pulsechainDropdownRef.current && !pulsechainDropdownRef.current.contains(event.target as Node)) {
        setPulsechainDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
            const addressHash = customInputs.addressHash || '';
            if (!addressHash) return { error: 'Address hash is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}`);
          }},
          { id: 'addressCounters', label: 'Address Counters', description: 'Address transaction/transfer counts', run: async () => {
            const addressHash = customInputs.addressHash || '';
            if (!addressHash) return { error: 'Address hash is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/counters`);
          }},
          { id: 'addressTransactions', label: 'Address Transactions', description: 'Address transactions (paginated)', run: async () => {
            const addressHash = customInputs.addressHash || '';
            if (!addressHash) return { error: 'Address hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '1000';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/transactions?page=${page}&limit=${limit}`);
          }},
          { id: 'addressTokenTransfers', label: 'Address Token Transfers', description: 'Token transfers for address (paginated)', run: async () => {
            const addressHash = customInputs.addressHash || '';
            if (!addressHash) return { error: 'Address hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '1000';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/token-transfers?page=${page}&limit=${limit}`);
          }},
          { id: 'addressInternalTransactions', label: 'Address Internal Transactions', description: 'Internal transactions for address', run: async () => {
            const addressHash = customInputs.addressHash || '';
            if (!addressHash) return { error: 'Address hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '1000';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/internal-transactions?page=${page}&limit=${limit}`);
          }},
          { id: 'addressLogs', label: 'Address Logs', description: 'Event logs for address', run: async () => {
            const addressHash = customInputs.addressHash || '';
            if (!addressHash) return { error: 'Address hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/logs?page=${page}&limit=${limit}`);
          }},
          { id: 'addressBlocksValidated', label: 'Address Blocks Validated', description: 'Blocks validated by address (validators)', run: async () => {
            const addressHash = customInputs.addressHash || '';
            if (!addressHash) return { error: 'Address hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/blocks-validated?page=${page}&limit=${limit}`);
          }},
          { id: 'addressTokenBalances', label: 'Address Token Balances', description: 'Token balances for address', run: async () => {
            const addressHash = customInputs.addressHash || '';
            if (!addressHash) return { error: 'Address hash is required' };
            const token = customInputs.tokenAddress || '';
            const url = token
              ? `https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/token-balances?token=${token}`
              : `https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/token-balances`;
            return await fetchJson(url);
          }},
          { id: 'addressTokens', label: 'Address Tokens', description: 'Token balances (paginated)', run: async () => {
            const addressHash = customInputs.addressHash || '';
            if (!addressHash) return { error: 'Address hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '2000';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/tokens?page=${page}&limit=${limit}`);
          }},
          { id: 'addressCoinBalanceHistory', label: 'Address Coin Balance History', description: 'Native coin balance history', run: async () => {
            const addressHash = customInputs.addressHash || '';
            if (!addressHash) return { error: 'Address hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/coin-balance-history?page=${page}&limit=${limit}`);
          }},
          { id: 'addressCoinBalanceHistoryByDay', label: 'Address Coin Balance History By Day', description: 'Daily coin balance history', run: async () => {
            const addressHash = customInputs.addressHash || '';
            if (!addressHash) return { error: 'Address hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/coin-balance-history-by-day?page=${page}&limit=${limit}`);
          }},
          { id: 'addressWithdrawals', label: 'Address Withdrawals', description: 'Withdrawals for address', run: async () => {
            const addressHash = customInputs.addressHash || '';
            if (!addressHash) return { error: 'Address hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/withdrawals?page=${page}&limit=${limit}`);
          }},
          { id: 'addressNFT', label: 'Address NFT', description: 'NFT instances owned by address', run: async () => {
            const addressHash = customInputs.addressHash || '';
            if (!addressHash) return { error: 'Address hash is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/addresses/${addressHash}/nft?page=${page}&limit=${limit}`);
          }},
          { id: 'addressNFTCollections', label: 'Address NFT Collections', description: 'NFT collections for address', run: async () => {
            const addressHash = customInputs.addressHash || '';
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
            const tokenAddr = customInputs.tokenAddress || '';
            if (!tokenAddr) return { error: 'Token address is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddr}`);
          }},
          { id: 'tokenTransfers', label: 'Token Transfers', description: 'Token transfers (paginated)', run: async () => {
            const tokenAddr = customInputs.tokenAddress || '';
            if (!tokenAddr) return { error: 'Token address is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '1000';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddr}/transfers?page=${page}&limit=${limit}`);
          }},
          { id: 'tokenHolders', label: 'Token Holders', description: 'Token holders (paginated)', run: async () => {
            const tokenAddr = customInputs.tokenAddress || '';
            if (!tokenAddr) return { error: 'Token address is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '2000';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddr}/holders?page=${page}&limit=${limit}`);
          }},
          { id: 'tokenCounters', label: 'Token Counters', description: 'Token holder/transfer counts', run: async () => {
            const tokenAddr = customInputs.tokenAddress || '';
            if (!tokenAddr) return { error: 'Token address is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddr}/counters`);
          }},
          { id: 'tokenLogs', label: 'Token Logs', description: 'Event logs for token', run: async () => {
            const tokenAddr = customInputs.tokenAddress || '';
            if (!tokenAddr) return { error: 'Token address is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddr}/logs`);
          }},
          { id: 'tokenInstances', label: 'Token Instances', description: 'NFT instances (for NFT tokens)', run: async () => {
            const tokenAddr = customInputs.tokenAddress || '';
            if (!tokenAddr) return { error: 'Token address is required' };
            const page = customInputs.page || '1';
            const limit = customInputs.limit || '100';
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddr}/instances?page=${page}&limit=${limit}`);
          }},
          { id: 'tokenInstanceById', label: 'Token Instance By ID', description: 'Specific NFT instance', run: async () => {
            const tokenAddr = customInputs.tokenAddress || '';
            const instanceId = customInputs.instanceId || '';
            if (!tokenAddr) return { error: 'Token address is required' };
            if (!instanceId) return { error: 'Instance ID is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddr}/instances/${instanceId}`);
          }},
          { id: 'tokenInstanceTransfers', label: 'Token Instance Transfers', description: 'Transfers for NFT instance', run: async () => {
            const tokenAddr = customInputs.tokenAddress || '';
            const instanceId = customInputs.instanceId || '';
            if (!tokenAddr) return { error: 'Token address is required' };
            if (!instanceId) return { error: 'Instance ID is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddr}/instances/${instanceId}/transfers`);
          }},
          { id: 'tokenInstanceHolders', label: 'Token Instance Holders', description: 'Holders of NFT instance', run: async () => {
            const tokenAddr = customInputs.tokenAddress || '';
            const instanceId = customInputs.instanceId || '';
            if (!tokenAddr) return { error: 'Token address is required' };
            if (!instanceId) return { error: 'Instance ID is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddr}/instances/${instanceId}/holders`);
          }},
          { id: 'tokenInstanceTransfersCount', label: 'Token Instance Transfers Count', description: 'Transfer count for NFT instance', run: async () => {
            const tokenAddr = customInputs.tokenAddress || '';
            const instanceId = customInputs.instanceId || '';
            if (!tokenAddr) return { error: 'Token address is required' };
            if (!instanceId) return { error: 'Instance ID is required' };
            return await fetchJson(`https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddr}/instances/${instanceId}/transfers-count`);
          }},
          { id: 'refetchTokenInstanceMetadata', label: 'Refetch Token Instance Metadata', description: 'Refetch NFT metadata', run: async () => {
            const tokenAddr = customInputs.tokenAddress || '';
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
  }, [customInputs]);

  const selectedStatMeta = useMemo(
    () => pulsechainStats.find(stat => stat.id === selectedStat) ?? null,
    [pulsechainStats, selectedStat]
  );

  const handleRunStat = useCallback(
    async (statId: string) => {
      const statMeta = pulsechainStats.find(s => s.id === statId);
      if (!statMeta) return;

      setCurrentRequest(null);
      clearLogs();

      const startTime = Date.now();

      try {
        const result = await statMeta.run();
        const endTime = Date.now();

        setCurrentRequest({
          statId: statMeta.id,
          endpoint: statMeta.label,
          params: customInputs,
          response: result,
          timestamp: new Date(),
          duration: endTime - startTime,
        });
      } catch (error: unknown) {
        const endTime = Date.now();
        setCurrentRequest({
          statId: statMeta.id,
          endpoint: statMeta.label,
          params: customInputs,
          response: { error: error instanceof Error ? error.message : String(error) },
          timestamp: new Date(),
          duration: endTime - startTime,
        });
      }
    },
    [pulsechainStats, customInputs, clearLogs]
  );

  const renderInputFields = () => {
    if (!selectedStatMeta) return null;

    const fields: Array<{ key: string; label: string; placeholder: string }> = [];

    if (selectedStatMeta.id.includes('search') || selectedStatMeta.id === 'checkSearchRedirect') {
      fields.push({ key: 'searchQuery', label: 'Search Query', placeholder: 'Enter search query' });
    }
    if (selectedStatMeta.id.includes('transaction') && selectedStatMeta.id !== 'transactionsList') {
      fields.push({ key: 'transactionHash', label: 'Transaction Hash', placeholder: '0x...' });
    }
    if (selectedStatMeta.id.includes('block') && selectedStatMeta.id !== 'blocksList') {
      fields.push({ key: 'blockNumberOrHash', label: 'Block Number or Hash', placeholder: 'Block number or hash' });
    }
    if (selectedStatMeta.id.includes('address') || selectedStatMeta.id.includes('Address')) {
      fields.push({ key: 'addressHash', label: 'Address Hash', placeholder: '0x...' });
    }
    if (selectedStatMeta.id.includes('token') || selectedStatMeta.id.includes('Token')) {
      fields.push({ key: 'tokenAddress', label: 'Token Address', placeholder: '0x...' });
    }
    if (selectedStatMeta.id.includes('instance') || selectedStatMeta.id.includes('Instance')) {
      fields.push({ key: 'instanceId', label: 'Instance ID', placeholder: 'NFT instance ID' });
    }
    if (selectedStatMeta.id.includes('smartContract') || selectedStatMeta.id === 'smartContractDetails') {
      fields.push({ key: 'contractAddress', label: 'Contract Address', placeholder: '0x...' });
    }
    if (selectedStatMeta.description?.includes('paginated')) {
      fields.push({ key: 'page', label: 'Page', placeholder: '1' });
      fields.push({ key: 'limit', label: 'Limit', placeholder: '100' });
    }

    if (fields.length === 0) return null;

    return (
      <div className="space-y-2">
        {fields.map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="text-white/80 block text-xs mb-1">{label}</label>
            <input
              type="text"
              value={customInputs[key] || ''}
              onChange={(e) => setCustomInputs({ ...customInputs, [key]: e.target.value })}
              className={`w-full bg-black/60 backdrop-blur border border-gray-700 rounded px-2 text-white ${
                compact ? 'py-1 text-xs' : 'py-2 text-sm'
              }`}
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full space-y-3 text-white">
      {/* PulseChain Stats Dropdown */}
      <div className="space-y-2">
        <label className="text-white block text-sm">PulseChain API Endpoints</label>
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
            <div className="absolute z-[9999] w-full mt-1 bg-black/90 backdrop-blur border border-gray-700 rounded max-h-60 overflow-y-auto">
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

      {/* Input Fields */}
      {selectedStatMeta && renderInputFields()}

      {/* Run Button */}
      {selectedStatMeta && (
        <Button
          type="button"
          onClick={() => handleRunStat(selectedStat)}
          className={`w-full bg-purple-700 hover:bg-purple-800 text-white ${
            compact ? 'py-2 text-xs' : 'py-2 text-sm'
          }`}
        >
          Run {selectedStatMeta.label}
        </Button>
      )}

      {/* Response Display */}
      {currentRequest && (
        <div className="space-y-2">
          <div className="rounded-lg border border-white/10 bg-black/50 backdrop-blur p-3">
            <div className="flex items-center justify-between mb-2">
              <span className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>
                {currentRequest.endpoint}
              </span>
              <span className={`text-white/60 ${compact ? 'text-[10px]' : 'text-xs'}`}>
                {currentRequest.duration}ms
              </span>
            </div>
            <div className="rounded bg-black/60 border border-gray-700 p-2 max-h-96 overflow-auto">
              <pre className={`text-white/90 ${compact ? 'text-[10px]' : 'text-xs'} whitespace-pre-wrap break-words`}>
                {JSON.stringify(currentRequest.response, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Network Logs Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild>
          <button
            className={`w-full bg-black/60 backdrop-blur border border-gray-700 rounded px-3 text-white ${
              compact ? 'py-1.5 text-xs' : 'py-2 text-sm'
            }`}
          >
            View Network Logs ({logs.length})
          </button>
        </DrawerTrigger>
        <DrawerContent className="bg-black/50 backdrop-blur border-gray-700">
          <DrawerHeader>
            <DrawerTitle className="text-white">Network Activity</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-white/60 text-sm">No network activity yet</p>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-white/10 bg-black/50 backdrop-blur p-2 text-white/80 space-y-1 break-words max-w-full"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-mono ${
                          log.status === 'success'
                            ? 'bg-green-500/20 text-green-300'
                            : log.status === 'error'
                            ? 'bg-red-500/20 text-red-300'
                            : 'bg-yellow-500/20 text-yellow-300'
                        }`}
                      >
                        {log.method}
                      </span>
                      {log.statusCode && (
                        <span className="text-xs text-white/60">{log.statusCode}</span>
                      )}
                      {log.durationMs !== undefined && (
                        <span className="text-xs text-white/60">{log.durationMs.toFixed(0)}ms</span>
                      )}
                    </div>
                    <div className="text-xs font-mono break-all">{log.url}</div>
                    {log.error && (
                      <div className="text-xs text-red-300 break-words">Error: {log.error}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
