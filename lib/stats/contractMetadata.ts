
import {
  ensureCoreCaches,
  ensureDex,
  fetchJson,
} from './utils';
import { StatConfig, StatResult } from './index';

// Token Address
export const tokenAddressStat = {
  id: 'address',
  name: 'Token Address',
  description: 'The address of the token contract.',
  enabled: true,
  format: 'address' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    return {
      value: tokenAddress,
      formattedValue: tokenAddress,
      lastUpdated: new Date(),
      source: 'static',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'address',
    name: 'Token Address',
    description: 'The address of the token contract.',
    enabled: true,
    format: 'address',
  }),
};

// Symbol
export const symbolStat = {
  id: 'symbol',
  name: 'Symbol',
  description: 'The symbol of the token.',
  enabled: true,
  format: 'text' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { tokenInfo } = await ensureCoreCaches(tokenAddress);
    const symbol = tokenInfo?.symbol;
    return {
      value: symbol,
      formattedValue: symbol,
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'symbol',
    name: 'Symbol',
    description: 'The symbol of the token.',
    enabled: true,
    format: 'text',
  }),
};

// Name
export const nameStat = {
  id: 'name',
  name: 'Name',
  description: 'The name of the token.',
  enabled: true,
  format: 'text' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { tokenInfo } = await ensureCoreCaches(tokenAddress);
    const name = tokenInfo?.name;
    return {
      value: name,
      formattedValue: name,
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'name',
    name: 'Name',
    description: 'The name of the token.',
    enabled: true,
    format: 'text',
  }),
};

// Icon URL
export const iconUrlStat = {
  id: 'iconUrl',
  name: 'Icon URL',
  description: 'The URL of the token icon.',
  enabled: true,
  format: 'text' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const dex = await ensureDex(tokenAddress);
    const { tokenInfo } = await ensureCoreCaches(tokenAddress);
    const iconUrl = dex?.pairs?.[0]?.info?.imageUrl || tokenInfo?.icon_url;
    return {
      value: iconUrl,
      formattedValue: iconUrl,
      lastUpdated: new Date(),
      source: 'dexscreener/pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'iconUrl',
    name: 'Icon URL',
    description: 'The URL of the token icon.',
    enabled: true,
    format: 'text',
  }),
};

// ABI Complexity Score
export const abiComplexityStat = {
  id: 'abiComplexity',
  name: 'ABI Complexity Score',
  description: 'The number of functions in the contract ABI.',
  enabled: true,
  format: 'number' as const,
  fetch: async (tokenAddress: string): Promise<StatResult> => {
    const { addressInfo } = await ensureCoreCaches(tokenAddress);
    const contract = await fetchJson(`https://api.scan.pulsechain.com/api/v2/smart-contracts/${addressInfo.creator_address_hash}`);
    const abi = contract?.abi || [];
    const complexity = abi.filter((item: any) => item.type === 'function').length;
    return {
      value: complexity,
      formattedValue: String(complexity),
      lastUpdated: new Date(),
      source: 'pulsechain',
    };
  },
  getConfig: (): StatConfig => ({
    id: 'abiComplexity',
    name: 'ABI Complexity Score',
    description: 'The number of functions in the contract ABI.',
    enabled: true,
    format: 'number',
  }),
};
