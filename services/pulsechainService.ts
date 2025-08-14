import type { ContractData, TokenInfo, SearchResultItem, SearchResponse, ReadMethodWithValue, Transaction, TransactionResponse, TokenBalance, AddressInfo, DexScreenerData } from '@/types';

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
        
        // Check if the response has items or if it's a different structure
        const data = raw.items || raw.data || raw || [];
        
        return { data, raw };
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

export const fetchDexScreenerData = async (address: string): Promise<{ data: DexScreenerData | null; raw: any }> => {
    if (!isAddressValid(address)) {
        return { data: null, raw: { error: 'Invalid address' } };
    }
    try {
        // Hybrid method: Use both search and direct lookup to get the most comprehensive pair list.
        const [searchResponse, tokenResponse] = await Promise.all([
            fetch(`https://api.dexscreener.com/latest/dex/search?q=${address}`),
            fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`)
        ]);

        const searchData = await searchResponse.json();
        const tokenData = await tokenResponse.json();

        if (!searchResponse.ok && !tokenResponse.ok) {
            throw new Error(`DEXScreener API Error: Both endpoints failed.`);
        }

        const allPairs = new Map<string, any>();

        (searchData.pairs || []).forEach((pair: any) => {
            allPairs.set(pair.pairAddress, pair);
        });

        (tokenData.pairs || []).forEach((pair: any) => {
            allPairs.set(pair.pairAddress, pair);
        });

        const combinedPairs = Array.from(allPairs.values());
        const raw = { pairs: combinedPairs }; // Create a raw object that mimics the original structure

        // Return the complete response structure
        return { 
            data: {
                pairs: combinedPairs,
                totalPairs: combinedPairs.length,
                wplsPairs: combinedPairs.filter((pair: any) => 
                    pair.quoteToken?.symbol === 'WPLS'
                ).length || 0,
                tokenInfo: combinedPairs[0]?.baseToken || null,
                info: combinedPairs[0]?.info || null
            }, 
            raw 
        };
    } catch (error) {
        console.error(`Failed to fetch DEXScreener data: ${(error as Error).message}`);
        return { data: null, raw: { error: (error as Error).message } };
    }
};

// New functions for AIApiOrchestrator
export const getTokenInfo = async (address: string): Promise<any> => {
    const result = await fetchTokenInfo(address);
    return result?.data || { error: 'Token not found' };
};

export const getTokenHolders = async (address: string): Promise<any> => {
    if (!isAddressValid(address)) {
        return { error: 'Invalid address' };
    }
    try {
        const response = await fetch(`${API_BASE_URL}tokens/${address}/holders`);
        const raw = await response.json();
        if (!response.ok) {
            return { error: `API Error: ${response.statusText}` };
        }
        return raw;
    } catch (error) {
        console.error(`Failed to fetch token holders: ${(error as Error).message}`);
        return { error: (error as Error).message };
    }
};

export const getTokenCounters = async (address: string): Promise<any> => {
    if (!isAddressValid(address)) {
        return { error: 'Invalid address' };
    }
    try {
        const response = await fetch(`${API_BASE_URL}tokens/${address}/counters`);
        const raw = await response.json();
        if (!response.ok) {
            return { error: `API Error: ${response.statusText}` };
        }
        return raw;
    } catch (error) {
        console.error(`Failed to fetch token counters: ${(error as Error).message}`);
        return { error: (error as Error).message };
    }
};

export const getTokenTransfers = async (address: string): Promise<any> => {
    if (!isAddressValid(address)) {
        return { error: 'Invalid address' };
    }
    try {
        const response = await fetch(`${API_BASE_URL}tokens/${address}/transfers`);
        const raw = await response.json();
        if (!response.ok) {
            return { error: `API Error: ${response.statusText}` };
        }
        return raw;
    } catch (error) {
        console.error(`Failed to fetch token transfers: ${(error as Error).message}`);
        return { error: (error as Error).message };
    }
};

export const getAddressInfo = async (address: string): Promise<any> => {
    const result = await fetchAddressInfo(address);
    return result?.data || { error: 'Address not found' };
};

export const getAddressCounters = async (address: string): Promise<any> => {
    if (!isAddressValid(address)) {
        return { error: 'Invalid address' };
    }
    try {
        const response = await fetch(`${API_BASE_URL}addresses/${address}/counters`);
        const raw = await response.json();
        if (!response.ok) {
            return { error: `API Error: ${response.statusText}` };
        }
        return raw;
    } catch (error) {
        console.error(`Failed to fetch address counters: ${(error as Error).message}`);
        return { error: (error as Error).message };
    }
};

export const getAddressTransactions = async (address: string): Promise<any> => {
    if (!isAddressValid(address)) {
        return { error: 'Invalid address' };
    }
    try {
        const response = await fetch(`${API_BASE_URL}addresses/${address}/transactions`);
        const raw = await response.json();
        if (!response.ok) {
            return { error: `API Error: ${response.statusText}` };
        }
        return raw;
    } catch (error) {
        console.error(`Failed to fetch address transactions: ${(error as Error).message}`);
        return { error: (error as Error).message };
    }
};

export const getAddressTokenTransfers = async (address: string): Promise<any> => {
    if (!isAddressValid(address)) {
        return { error: 'Invalid address' };
    }
    try {
        const response = await fetch(`${API_BASE_URL}addresses/${address}/token-transfers`);
        const raw = await response.json();
        if (!response.ok) {
            return { error: `API Error: ${response.statusText}` };
        }
        return raw;
    } catch (error) {
        console.error(`Failed to fetch address token transfers: ${(error as Error).message}`);
        return { error: (error as Error).message };
    }
};

export const getAddressTokenBalances = async (address: string): Promise<any> => {
    const result = await fetchAddressTokenBalances(address);
    return result?.data || { error: 'Failed to fetch token balances' };
};

export const getTokenBalance = async (contractAddress: string, walletAddress: string): Promise<any> => {
    if (!isAddressValid(contractAddress) || !isAddressValid(walletAddress)) {
        return { error: 'Invalid address' };
    }
    try {
        // Use the correct API endpoint for token balance (different from v2 API)
        const response = await fetch(`https://api.scan.pulsechain.com/api?module=account&action=tokenbalance&contractaddress=${contractAddress}&address=${walletAddress}`);
        const raw = await response.json();
        if (!response.ok) {
            return { error: `API Error: ${response.statusText}` };
        }
        return raw;
    } catch (error) {
        console.error(`Failed to fetch token balance: ${(error as Error).message}`);
        return { error: (error as Error).message };
    }
};

export const getTransactionByHash = async (txHash: string): Promise<any> => {
    if (!txHash || txHash.length !== 66) {
        return { error: 'Invalid transaction hash' };
    }
    try {
        const response = await fetch(`${API_BASE_URL}transactions/${txHash}`);
        const raw = await response.json();
        if (!response.ok) {
            return { error: `API Error: ${response.statusText}` };
        }
        return raw;
    } catch (error) {
        console.error(`Failed to fetch transaction: ${(error as Error).message}`);
        return { error: (error as Error).message };
    }
};

