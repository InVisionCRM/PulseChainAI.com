
import { pulsechainApi, fetchDexScreenerData } from '@/services';

export const DEAD_ADDRESS = '0x000000000000000000000000000000000000dead';

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

const cache: {
  [key: string]: {
    tokenInfo?: any;
    tokenCounters?: any;
    addressInfo?: any;
    addressCounters?: any;
    holders?: Array<{ hash: string; value: string }>;
    transfers24h?: TransferItem[];
    dex?: any;
  }
} = {};

export const fetchJson = async (url: string): Promise<any> => {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const formatNumber2 = (value: number): string => {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
};

export const formatPct2 = (value: number): string => `${Number(value).toFixed(2)}%`;

export const formatTokenAmount2 = (raw: number, decimals: number): string => {
  const v = decimals ? raw / Math.pow(10, decimals) : raw;
  return formatNumber2(v);
};

export const getHoldersPaged = async (address: string, maxPages = 50): Promise<Array<{ hash: string; value: string }>> => {
  const base = 'https://api.scan.pulsechain.com/api/v2';
  const limit = 50;
  let pageItems: Array<{ hash: string; value: string }> = [];
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
};

export const getTransfers24h = async (address: string, maxPages = 50): Promise<TransferItem[]> => {
  const base = 'https://api.scan.pulsechain.com/api/v2';
  const limit = 200;
  const out: TransferItem[] = [];
  let nextParams: Record<string, string> | undefined = undefined;
  const cutoff24hIso = new Date(new Date().getTime() - 24 * 60 * 60 * 1000).toISOString();

  for (let i = 0; i < maxPages; i += 1) {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (nextParams) {
      Object.entries(nextParams).forEach(([k, v]) => qs.set(k, String(v)));
    }
    const url = `${base}/tokens/${address}/transfers?${qs.toString()}`;
    const data = await fetchJson(url);
    const items: TransferItem[] = Array.isArray(data?.items) ? data.items : [];
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

    if (!data?.next_page_params) break;
    nextParams = data.next_page_params as Record<string, string>;
  }
  return out;
};

export const getTransfersLastNDays = async (address: string, days: number, maxPages = 200): Promise<TransferItem[]> => {
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

  return out.filter(t => t.timestamp && new Date(t.timestamp).toISOString() >= cutoffIso);
};

export const getWalletTokenTransfers = async (address: string, maxPages = 200): Promise<TransferItem[]> => {
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
};

export const ensureCoreCaches = async (tokenAddress: string) => {
  if (!cache[tokenAddress]) {
    cache[tokenAddress] = {};
  }

  const [tokenInfoRes, tokenCountersRes, addressInfoRes, addressCountersRes] = await Promise.all([
    cache[tokenAddress].tokenInfo ? Promise.resolve({ data: cache[tokenAddress].tokenInfo }) : pulsechainApi.getTokenInfo(tokenAddress),
    cache[tokenAddress].tokenCounters ? Promise.resolve({ data: cache[tokenAddress].tokenCounters }) : pulsechainApi.getTokenCounters(tokenAddress),
    cache[tokenAddress].addressInfo ? Promise.resolve({ data: cache[tokenAddress].addressInfo }) : pulsechainApi.getAddressInfo(tokenAddress),
    cache[tokenAddress].addressCounters ? Promise.resolve({ data: cache[tokenAddress].addressCounters }) : pulsechainApi.getAddressCounters(tokenAddress),
  ]);

  cache[tokenAddress] = {
    ...cache[tokenAddress],
    tokenInfo: tokenInfoRes.data,
    tokenCounters: tokenCountersRes.data,
    addressInfo: addressInfoRes.data,
    addressCounters: addressCountersRes.data,
  };

  return cache[tokenAddress];
};

export const ensureHolders = async (tokenAddress: string) => {
  if (!cache[tokenAddress]) {
    cache[tokenAddress] = {};
  }
  if (cache[tokenAddress].holders) return cache[tokenAddress].holders as Array<{ hash: string; value: string }>;
  const holders = await getHoldersPaged(tokenAddress, 200);
  cache[tokenAddress].holders = holders;
  return holders;
};

export const ensureTransfers24h = async (tokenAddress: string) => {
  if (!cache[tokenAddress]) {
    cache[tokenAddress] = {};
  }
  if (cache[tokenAddress].transfers24h) return cache[tokenAddress].transfers24h as TransferItem[];
  const transfers = await getTransfers24h(tokenAddress, 100);
  cache[tokenAddress].transfers24h = transfers;
  return transfers;
};

export const ensureDex = async (tokenAddress: string) => {
  if (!cache[tokenAddress]) {
    cache[tokenAddress] = {};
  }
  if (cache[tokenAddress].dex) return cache[tokenAddress].dex;
  const dexResult = await fetchDexScreenerData(tokenAddress);
  const dex = dexResult?.raw;
  cache[tokenAddress].dex = dex;
  return dex;
};
