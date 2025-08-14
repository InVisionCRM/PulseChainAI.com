// Centralized configuration for all blockchain services

import type { ServiceConfig } from './types';

export const SERVICE_CONFIG: ServiceConfig = {
  pulsechain: {
    baseUrl: 'https://api.scan.pulsechain.com/api/v2/',
    timeout: 30000,
    retries: 3,
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'PulseChain-AI-Dashboard/1.0'
    }
  },
  moralis: {
    chainId: '0x171', // PulseChain
    apiKey: process.env.MORALIS_API_KEY
  },
  dexscreener: {
    baseUrl: 'https://api.dexscreener.com/latest/dex/',
    timeout: 15000,
    retries: 2,
    headers: {
      'Accept': 'application/json'
    }
  }
};

export const API_ENDPOINTS = {
  pulsechain: {
    contracts: 'smart-contracts',
    tokens: 'tokens',
    addresses: 'addresses',
    transactions: 'transactions',
    search: 'search'
  },
  dexscreener: {
    tokens: 'tokens',
    pairs: 'pairs'
  }
};

export const DEAD_ADDRESSES = [
  '0x000000000000000000000000000000000000dead',
  '0x0000000000000000000000000000000000000000'
];

export const DEFAULT_PAGINATION_LIMIT = 50;
export const MAX_RETRY_ATTEMPTS = 3;
export const REQUEST_TIMEOUT = 30000;