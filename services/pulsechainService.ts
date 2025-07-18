import type { ContractData, TokenInfo, SearchResultItem, SearchResponse, ReadMethodWithValue, Transaction, TransactionResponse, TokenBalance, AddressInfo } from '../types';

const API_BASE_URL = 'https://api.scan.pulsechain.com/api/v2/';

const isAddressValid = (address: string): boolean => /^0x[a-fA-F0-9]{40}$/.test(address);


export const fetchContract = async (address: string): Promise<{ data: ContractData; raw: any }> => {
  if (!isAddressValid(address)) {
    throw new Error('Invalid contract address format.');
  }

  try {
    const response = await fetch(`${API_BASE_URL}smart-contracts/${address}`);
    const raw = await response.json();
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Contract not found or not verified.');
      }
      throw new Error(`API Error: ${raw.message || response.statusText} (Status: ${response.status})`);
    }

    if (!raw.source_code || !raw.abi) {
      throw new Error('This contract is not verified or its source code/ABI is not available.');
    }
    // The API returns ABI as a stringified JSON, so we need to parse it.
    if (typeof raw.abi === 'string') {
        raw.abi = JSON.parse(raw.abi);
    }
    return { data: raw as ContractData, raw };
  } catch (error) {
    if (error instanceof Error) {
        throw new Error(`Failed to fetch contract: ${error.message}`);
    }
    throw new Error('An unknown error occurred while fetching the contract.');
  }
};


export const fetchTokenInfo = async (address: string): Promise<{ data: TokenInfo; raw: any } | null> => {
    if (!isAddressValid(address)) {
        return null;
    }

    try {
        const response = await fetch(`${API_BASE_URL}tokens/${address}`);
        const raw = await response.json();
        if (!response.ok) {
            if (response.status === 404) {
                console.log(`No token info found for address ${address}. It might not be a token contract.`);
                return { data: null, raw } as any; // Return raw response for API tab even on 404
            }
            throw new Error(`Token API Error: ${response.statusText} (Status: ${response.status})`);
        }
        return { data: raw as TokenInfo, raw };
    } catch (error) {
        console.error(`Failed to fetch token info: ${(error as Error).message}`);
        return null;
    }
};

export const fetchAddressInfo = async (address: string): Promise<{ data: AddressInfo, raw: any } | null> => {
    if (!isAddressValid(address)) {
        return null;
    }
    try {
        const response = await fetch(`${API_BASE_URL}addresses/${address}`);
        const raw = await response.json();
        if (!response.ok) {
            return { data: null, raw } as any;
        }
        return { data: raw as AddressInfo, raw };
    } catch (error) {
        console.error(`Failed to fetch address info: ${(error as Error).message}`);
        return null;
    }
};

export const fetchReadMethods = async (address: string): Promise<{ data: ReadMethodWithValue[]; raw: any }> => {
    if (!isAddressValid(address)) {
        return { data: [], raw: { error: 'Invalid address' } };
    }
    try {
        const response = await fetch(`${API_BASE_URL}smart-contracts/${address}/methods-read`);
        const raw = await response.json();
        if (!response.ok) {
            console.error(`Failed to fetch read methods: ${response.statusText}`);
            return { data: [], raw };
        }
        return { data: raw.items || [], raw };
    } catch (error) {
        console.error(`Error fetching read methods: ${(error as Error).message}`);
        return { data: [], raw: { error: (error as Error).message } };
    }
};

export const search = async (query: string): Promise<SearchResultItem[]> => {
    if (query.trim().length < 2) {
        return [];
    }
    try {
        const response = await fetch(`${API_BASE_URL}search?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error(`Search API Error: ${response.statusText}`);
        }
        const data: SearchResponse = await response.json();
        return data.items.filter(item => item.address);
    } catch (error) {
        console.error(`Search failed: ${(error as Error).message}`);
        return [];
    }
};

export const fetchCreatorTransactions = async (address: string): Promise<{ data: Transaction[]; raw: any }> => {
    if (!isAddressValid(address)) {
        return { data: [], raw: { error: 'Invalid address' } };
    }
    try {
        const response = await fetch(`${API_BASE_URL}addresses/${address}/transactions?filter=to%20%7C%20from`);
        const raw = await response.json();
        if (!response.ok) {
            throw new Error(`Transaction API Error: ${response.statusText}`);
        }
        return { data: raw.items || [], raw };
    } catch (error) {
        console.error(`Failed to fetch creator transactions: ${(error as Error).message}`);
        return { data: [], raw: { error: (error as Error).message } };
    }
};

export const fetchAddressTokenBalances = async (address: string): Promise<{ data: TokenBalance[]; raw: any }> => {
    if (!isAddressValid(address)) {
        return { data: [], raw: { error: 'Invalid address' } };
    }
    try {
        const response = await fetch(`${API_BASE_URL}addresses/${address}/token-balances`);
        const raw = await response.json();
        if (!response.ok) {
            return { data: [], raw };
        }
        return { data: raw || [], raw };
    } catch (error) {
        console.error(`Failed to fetch address token balances: ${(error as Error).message}`);
        return { data: [], raw: { error: (error as Error).message } };
    }
};