import type { ContractData, TokenInfo, SearchResultItem, SearchResponse, ReadMethodWithValue, Transaction, TransactionResponse, TokenBalance, AddressInfo, DexScreenerData } from '@/types';

const API_BASE_URL = 'https://api.scan.pulsechain.com/api/v2/';

const isAddressValid = (address: string): boolean => /^0x[a-fA-F0-9]{40}$/.test(address);


// Fetch contract from Sourcify (used by Otterscan) - via proxy to avoid CORS
const fetchContractFromSourcify = async (address: string, chainId: number = 369): Promise<{ data: ContractData; raw: any } | null> => {
  try {
    // Use Next.js API proxy to avoid CORS issues
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const metadataUrl = `${baseUrl}/api/sourcify-proxy?chainId=${chainId}&address=${address}&type=metadata`;
    
    const metadataResponse = await fetch(metadataUrl);
    
    if (!metadataResponse.ok) {
      return null; // Contract not verified on Sourcify
    }
    
    const metadata = await metadataResponse.json();
    return await parseSourcifyMetadata(metadata, address, chainId, baseUrl);
  } catch (error) {
    console.error('Error fetching from Sourcify:', error);
    return null;
  }
};

// Parse Sourcify metadata into ContractData format
const parseSourcifyMetadata = async (metadata: any, address: string, chainId: number, apiBaseUrl: string): Promise<{ data: ContractData; raw: any }> => {
  const compiler = metadata.compiler || {};
  const settings = compiler.settings || {};
  const sources = metadata.sources || {};
  
  // Fetch source files - Sourcify stores them as separate files
  let sourceCode = '';
  const sourceFiles = Object.keys(sources).sort();
  
  // First, try to get source content from metadata.sources (if available)
  let hasContentInMetadata = false;
  for (const filePath of sourceFiles) {
    const sourceInfo = sources[filePath];
    if (sourceInfo?.content) {
      sourceCode += `// File: ${filePath}\n${sourceInfo.content}\n\n`;
      hasContentInMetadata = true;
    }
  }
  
  // If sources weren't in metadata, fetch them from Sourcify files endpoint
  if (!hasContentInMetadata && sourceFiles.length > 0) {
    try {
      // Try fetching all files at once using Sourcify's files endpoint via proxy
      const filesUrl = `${apiBaseUrl}/api/sourcify-proxy?chainId=${chainId}&address=${address}&type=files`;
      // Use a timeout promise for better compatibility
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000)
      );
      
      const filesResponse = await Promise.race([
        fetch(filesUrl),
        timeoutPromise
      ]) as Response;
      
      if (filesResponse.ok) {
        const filesData = await filesResponse.json();
        // Files endpoint returns an object with file paths as keys
        if (filesData && typeof filesData === 'object') {
          const fileKeys = Object.keys(filesData).sort();
          for (const filePath of fileKeys) {
            const content = filesData[filePath];
            if (typeof content === 'string' && content.trim().length > 0) {
              sourceCode += `// File: ${filePath}\n${content}\n\n`;
            }
          }
        }
      }
      
      // If files endpoint didn't work or returned empty, try individual files
      if (!sourceCode || sourceCode.trim().length === 0) {
        // Fetch each source file individually
        const fetchPromises = sourceFiles.map(async (filePath) => {
          try {
            // Use API proxy to avoid CORS
            const sourceUrl = `${apiBaseUrl}/api/sourcify-proxy?chainId=${chainId}&address=${address}&type=source&filePath=${encodeURIComponent(filePath)}`;
            
            // Use a timeout promise instead of AbortSignal.timeout for better compatibility
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 5000)
            );
            
            const sourceResponse = await Promise.race([
              fetch(sourceUrl),
              timeoutPromise
            ]) as Response;
            
            if (sourceResponse.ok) {
              const content = await sourceResponse.text();
              if (content && content.trim().length > 0) {
                return { filePath, content };
              }
            }
          } catch (error) {
            // Silently fail for individual files - we'll try other methods
            return null;
          }
          return null;
        });
        
        const results = await Promise.allSettled(fetchPromises);
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            sourceCode += `// File: ${result.value.filePath}\n${result.value.content}\n\n`;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching source files from Sourcify:', error);
      // Don't throw - preserve any source code we've already collected
    }
  }
  
  // Log if we have source code or not (for debugging)
  if (sourceCode && sourceCode.trim().length > 0) {
    console.log(`Successfully fetched ${sourceFiles.length} source file(s) from Sourcify`);
  } else {
    console.warn('No source code found in Sourcify metadata or files');
  }
  
  // Extract ABI from output - try multiple possible locations
  let abi: any[] = [];
  if (metadata.output?.abi && Array.isArray(metadata.output.abi)) {
    abi = metadata.output.abi;
  } else if (metadata.output?.contracts) {
    // ABI might be nested in contracts - collect all ABIs
    const contractKeys = Object.keys(metadata.output.contracts);
    for (const contractKey of contractKeys) {
      const contract = metadata.output.contracts[contractKey];
      if (contract?.abi && Array.isArray(contract.abi)) {
        // Merge all ABIs (avoid duplicates)
        const existingNames = new Set(abi.map((item: any) => item.name));
        for (const abiItem of contract.abi) {
          if (!existingNames.has(abiItem.name)) {
            abi.push(abiItem);
            existingNames.add(abiItem.name);
          }
        }
      }
    }
  }
  
  // Extract compiler version
  const compilerVersion = compiler.version || '';
  
  // Determine optimization
  const optimizationEnabled = settings.optimizer?.enabled || false;
  
  // Extract contract name from metadata or from the first contract key
  let contractName = metadata.contractName || 'Contract';
  if (!contractName && metadata.output?.contracts) {
    const contractKeys = Object.keys(metadata.output.contracts);
    if (contractKeys.length > 0) {
      const firstKey = contractKeys[0];
      contractName = firstKey.split(':').pop() || 'Contract';
    }
  }
  
  const contractData: ContractData = {
    name: contractName,
    source_code: sourceCode.trim() || '', // Ensure we have source code
    compiler_version: compilerVersion,
    optimization_enabled: optimizationEnabled,
    is_verified: true,
    abi: abi,
    creator_address_hash: null, // Sourcify doesn't provide this
    creation_tx_hash: null, // Sourcify doesn't provide this
  };
  
  return { data: contractData, raw: metadata };
};

export const fetchContract = async (address: string): Promise<{ data: ContractData; raw: any }> => {
  if (!isAddressValid(address)) {
    throw new Error('Invalid contract address format.');
  }

  try {
    // First, try PulseChain Scan API
    const response = await fetch(`${API_BASE_URL}smart-contracts/${address}`);
    const raw = await response.json();
    
    if (response.ok) {
      // Parse ABI if present
      if (typeof raw.abi === 'string') {
        try {
          raw.abi = JSON.parse(raw.abi);
        } catch (_) {
          raw.abi = [];
        }
      }

      // If we have source code and ABI, return it
      if (raw.source_code && raw.abi && Array.isArray(raw.abi) && raw.abi.length > 0) {
        return { data: raw as ContractData, raw };
      }
    }
    
    // If PulseChain Scan failed or missing data, try Sourcify (Otterscan source)
    console.log('PulseChain Scan failed or incomplete, trying Sourcify...');
    const sourcifyResult = await fetchContractFromSourcify(address);
    
    if (sourcifyResult) {
      console.log('Contract found on Sourcify (Otterscan source)');
      return sourcifyResult;
    }
    
    // If both failed, return minimal structure
    const minimal = {
      name: raw?.name || 'Unverified Contract',
      source_code: raw?.source_code || '',
      compiler_version: raw?.compiler_version || '',
      optimization_enabled: Boolean(raw?.optimization_enabled),
      is_verified: false,
      abi: Array.isArray(raw?.abi) ? raw.abi : [],
      creator_address_hash: raw?.creator_address_hash || null,
      creation_tx_hash: raw?.creation_tx_hash || null,
    } as ContractData;
    
    return { data: minimal, raw };
  } catch (error) {
    // On error, try Sourcify as fallback
    console.log('PulseChain Scan error, trying Sourcify fallback...');
    const sourcifyResult = await fetchContractFromSourcify(address);
    
    if (sourcifyResult) {
      console.log('Contract found on Sourcify (Otterscan source)');
      return sourcifyResult;
    }
    
    // If Sourcify also fails, throw error
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
        const url = `${API_BASE_URL}search?q=${encodeURIComponent(query.trim())}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Search API returned ${response.status}`);
            return [];
        }

        const data: SearchResponse = await response.json();

        if (!data.items || !Array.isArray(data.items)) {
            console.error('Invalid search response structure');
            return [];
        }

        return data.items.filter(item => item.address);
    } catch (error) {
        console.error('Search failed:', (error as Error).message);
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

// getAddressTransactions is defined below in a simplified form; keeping only one definition

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

export const getAddressTransactions = async (address: string): Promise<any> => {
  try {
    const response = await fetch(`${API_BASE_URL}addresses/${address}/transactions`);
    const raw = await response.json();
    if (!response.ok) return [];
    return raw?.items || [];
  } catch {
    return [];
  }
};

// Helper to fetch creator address via address info then tx details
export const fetchCreatorAddress = async (contract: string): Promise<string | null> => {
  try {
    const info = await fetchAddressInfo(contract);
    const creationTx = info?.data?.creation_tx_hash;
    const creator = info?.data?.creator_address_hash;
    if (creator) return creator;
    if (!creationTx) return null;
    const tx = await getTransactionByHash(creationTx);
    const from = tx?.from?.hash || tx?.from;
    return typeof from === 'string' ? from : null;
  } catch {
    return null;
  }
};

