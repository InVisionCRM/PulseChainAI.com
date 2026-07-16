// Unified PulseChain API client
// Consolidates functionality from pulsechainService and pulsechainApiService

import type { 
  TokenInfo, 
  TokenInfoDetailed, 
  Holder, 
  HoldersResponse, 
  Transaction, 
  TransactionResponse, 
  AddressInfo, 
  ContractData, 
  ReadMethodWithValue, 
  SearchResponse, 
  ApiResponse, 
  PaginatedResponse,
  StatsResponse,
  MarketChartItem,
  TransactionChartItem,
  Block,
  InternalTransaction,
  LogEntry,
  AddressCounters,
  CoinBalanceHistoryEntry,
  Withdrawal,
  NFTInstance,
  TokenTransfer
} from '../core/types';

import { SERVICE_CONFIG, API_ENDPOINTS, DEFAULT_PAGINATION_LIMIT } from '../core/config';
import { validateAddress, handleApiError, withRetry } from '../core/errors';
import { fetchWithTimeout } from '../core/fetchWithTimeout';

export class PulsechainApiClient {
  private baseUrl: string;
  private proxyUrl: string = '/api/pulsechain-proxy';
  // Contract source is fetched by several components at once (contract tab,
  // AI reader, read-methods, audit). Dedupe concurrent look-ups and briefly
  // cache the result so a single contract isn't fetched 6× per page load.
  private contractInflight = new Map<string, Promise<ApiResponse<ContractData>>>();
  private contractCache = new Map<string, { at: number; value: ApiResponse<ContractData> }>();
  private static CONTRACT_TTL = 300_000; // 5 min

  constructor() {
    this.baseUrl = SERVICE_CONFIG.pulsechain.baseUrl;
  }

  // Core API method with error handling and retry logic
  private async apiCall<T>(
    endpoint: string, 
    useProxy: boolean = false, 
    params?: Record<string, any>
  ): Promise<T> {
    // Direct calls hit the canonical PulseChain Blockscout. (The old
    // scan.pulsechain.box mirror was removed — it is dead, returning Cloudflare
    // 5xx, so it only wasted a retry. `withRetry` re-attempts the primary, which
    // is intermittently 500-flaky; verified source has its own Sourcify fallback
    // in getContract().) Proxied calls keep their single URL.
    const bases = useProxy ? [this.proxyUrl] : [this.baseUrl];

    return withRetry(async () => {
      const searchParams = new URLSearchParams();

      if (useProxy) {
        searchParams.append('endpoint', endpoint);
      }
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, value.toString());
          }
        });
      }

      let lastError: unknown;
      for (const base of bases) {
        const fullUrl = useProxy
          ? `${base}?${searchParams.toString()}`
          : `${base}${endpoint}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
        try {
          const response = await fetchWithTimeout(fullUrl, {
            headers: SERVICE_CONFIG.pulsechain.headers,
          }, SERVICE_CONFIG.pulsechain.timeout);

          if (!response.ok) {
            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
            continue; // try the next base
          }

          return await response.json();
        } catch (error) {
          lastError = error;
        }
      }
      handleApiError(lastError, 'pulsechain');
    }, SERVICE_CONFIG.pulsechain.retries, 1000, 'pulsechain');
  }

  // Contract operations
  async getContract(address: string): Promise<ApiResponse<ContractData>> {
    validateAddress(address);
    const key = address.toLowerCase();

    const cached = this.contractCache.get(key);
    if (cached && Date.now() - cached.at < PulsechainApiClient.CONTRACT_TTL) {
      return cached.value;
    }
    const inflight = this.contractInflight.get(key);
    if (inflight) return inflight;

    const p = this.resolveContract(address)
      .then((value) => {
        // Only cache a value that actually carries source, so a transient miss
        // isn't remembered for 5 minutes.
        if (value.success && value.data?.source_code) {
          this.contractCache.set(key, { at: Date.now(), value });
        }
        return value;
      })
      .finally(() => this.contractInflight.delete(key));

    this.contractInflight.set(key, p);
    return p;
  }

  private async resolveContract(address: string): Promise<ApiResponse<ContractData>> {
    // Race two free sources and return the first that yields source: Blockscout
    // (richer, but intermittently 500-flaky/slow) and Sourcify (fast, reliable,
    // covers chain 369). Whichever produces verified source first wins — so a
    // healthy Blockscout is preferred, but a hung/500 one can't stall the
    // reader because Sourcify resolves in parallel.
    const blockscoutPromise = this.getBlockscoutContract(address);
    const sourcifyPromise = this.getContractFromSourcify(address);

    return new Promise<ApiResponse<ContractData>>((resolve) => {
      let pending = 2;
      let blockscoutPartial: ContractData | null = null;

      const onSettle = () => {
        if (--pending === 0) {
          // Neither yielded source. Return a partial (e.g. unverified contract
          // with just an ABI) so the UI can still render, else surface it.
          resolve(
            blockscoutPartial
              ? { data: blockscoutPartial, success: true }
              : { error: 'Contract source unavailable (explorer and Sourcify both failed)', success: false },
          );
        }
      };

      blockscoutPromise.then((data) => {
        if (data?.source_code) return resolve({ data, success: true }); // no-op if already resolved
        if (data) blockscoutPartial = data;
        onSettle();
      }, onSettle);

      sourcifyPromise.then((data) => {
        if (data) return resolve({ data, success: true });
        onSettle();
      }, onSettle);
    });
  }

  // Bounded Blockscout contract fetch (short attempts, no 90s retry chain) so a
  // hung/500 explorer can't stall callers. Returns null on miss.
  private async getBlockscoutContract(address: string): Promise<ContractData | null> {
    const url = `${this.baseUrl}${API_ENDPOINTS.pulsechain.contracts}/${address}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetchWithTimeout(url, { headers: SERVICE_CONFIG.pulsechain.headers }, 12000);
        if (res.ok) {
          const data = await res.json();
          // A 200 body can occasionally be an error string ("Internal server
          // error"); only trust an object.
          if (data && typeof data === 'object') {
            if (typeof data.abi === 'string') {
              try { data.abi = JSON.parse(data.abi); } catch { data.abi = []; }
            }
            const contract = data as ContractData;
            if (contract.source_code) return contract;
            // Keep an unverified/partial result but try once more for source.
            if (attempt === 1) return contract;
          }
        }
      } catch {
        // retry / give up
      }
    }
    return null;
  }

  // Verified source from Sourcify's v2 API. Returns null when the contract isn't
  // on Sourcify or the request fails, so callers can degrade gracefully.
  private async getContractFromSourcify(address: string): Promise<ContractData | null> {
    try {
      const url = `https://sourcify.dev/server/v2/contract/369/${address}?fields=sources,abi,compilation,metadata`;
      const response = await fetchWithTimeout(
        url,
        { headers: { Accept: 'application/json' } },
        12000,
      );
      if (!response.ok) return null;
      const d = await response.json();
      if (!d || typeof d !== 'object') return null;

      const sources = (d.sources ?? {}) as Record<string, { content?: string }>;
      // Flatten every source file into one blob with a header per file (the AI
      // reader and the contract viewer expect a single `source_code` string).
      const source_code = Object.entries(sources)
        .map(([path, file]) => {
          const shortPath = path.replace(/^verified-sources\/0x[a-fA-F0-9]{40}\/sources\//, '');
          return `// File: ${shortPath}\n${file?.content ?? ''}`;
        })
        .join('\n\n');
      if (!source_code.trim()) return null;

      const comp = (d.compilation ?? {}) as {
        name?: string;
        compilerVersion?: string;
        compilerSettings?: { evmVersion?: string; optimizer?: { enabled?: boolean; runs?: number } };
      };
      const settings = comp.compilerSettings ?? {};

      return {
        address,
        name: comp.name || 'Contract',
        compiler_version: comp.compilerVersion || '',
        optimization_enabled: !!settings.optimizer?.enabled,
        optimization_runs: settings.optimizer?.runs ?? 0,
        evm_version: settings.evmVersion || '',
        verified_at: d.verifiedAt || '',
        source_code,
        constructor_args: '',
        abi: Array.isArray(d.abi) ? d.abi : [],
        is_verified: true,
        is_partially_verified: d.runtimeMatch === 'partial' || d.creationMatch === 'partial',
      };
    } catch {
      return null;
    }
  }

  async getContractReadMethods(address: string): Promise<ApiResponse<ReadMethodWithValue[]>> {
    validateAddress(address);
    
    try {
      const contract = await this.getContract(address);
      if (!contract.success || !contract.data) {
        return { error: 'Contract not found or not verified', success: false };
      }

      const readMethods = contract.data.abi.filter((method: any) => 
        method.type === 'function' && 
        (method.stateMutability === 'view' || method.stateMutability === 'pure')
      );

      return { data: readMethods, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getContractReadMethodsWithValues(address: string): Promise<ApiResponse<ReadMethodWithValue[]>> {
    validateAddress(address);
    
    try {
      // First, try to get read methods with values from the API endpoint
      const readMethodsResponse = await this.apiCall<any>(
        `smart-contracts/${address}/methods-read`
      );

      // If the API returns methods with values, process them
      if (readMethodsResponse && Array.isArray(readMethodsResponse)) {
        // Extract the value from outputs array and add it to the method object
        const methodsWithValues = readMethodsResponse.map((method: any) => {
          // Only process read functions (view/pure) with no inputs
          if (method.type === 'function' && 
              (method.stateMutability === 'view' || method.stateMutability === 'pure') &&
              (!method.inputs || method.inputs.length === 0)) {
            
            // Extract value from outputs array
            let value = undefined;
            if (method.outputs && Array.isArray(method.outputs) && method.outputs.length > 0) {
              // Check if the output has a value property
              const output = method.outputs[0];
              if (output && output.value !== undefined) {
                value = output.value;
              }
            }
            
            return { ...method, value };
          }
          return method;
        });
        
        return { data: methodsWithValues, success: true };
      }

      // Fallback: get contract ABI and filter read methods
      const contract = await this.getContract(address);
      if (!contract.success || !contract.data) {
        return { error: 'Contract not found or not verified', success: false };
      }

      const readMethods = contract.data.abi.filter((method: any) => 
        method.type === 'function' && 
        (method.stateMutability === 'view' || method.stateMutability === 'pure')
      );

      return { data: readMethods, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  // Token operations
  async getTokenInfo(address: string): Promise<ApiResponse<TokenInfoDetailed>> {
    validateAddress(address);
    
    try {
      const data = await this.apiCall<TokenInfoDetailed>(`${API_ENDPOINTS.pulsechain.tokens}/${address}`);
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getTokenHolders(
    address: string, 
    limit: number = DEFAULT_PAGINATION_LIMIT,
    offset?: string
  ): Promise<ApiResponse<HoldersResponse>> {
    validateAddress(address);
    
    try {
      const params: Record<string, any> = { limit };
      if (offset) params.offset = offset;
      
      const data = await this.apiCall<HoldersResponse>(
        `${API_ENDPOINTS.pulsechain.tokens}/${address}/holders`,
        false,
        params
      );
      
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getTokenTransfers(
    address: string,
    limit: number = DEFAULT_PAGINATION_LIMIT,
    offset?: string
  ): Promise<ApiResponse<TransactionResponse>> {
    validateAddress(address);
    
    try {
      const params: Record<string, any> = { limit };
      if (offset) params.offset = offset;
      
      const data = await this.apiCall<TransactionResponse>(
        `${API_ENDPOINTS.pulsechain.tokens}/${address}/transfers`,
        false,
        params
      );
      
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getTokenCounters(address: string): Promise<ApiResponse<{ token_holders_count: number; transfers_count: number }>> {
    validateAddress(address);
    try {
      const data = await this.apiCall<{ token_holders_count: number; transfers_count: number }>(
        `${API_ENDPOINTS.pulsechain.tokens}/${address}/counters`
      );
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getTokenInstances(address: string, page: number = 1, limit: number = 100): Promise<ApiResponse<NFTInstance[]>> {
    validateAddress(address);
    try {
      const data = await this.apiCall<NFTInstance[]>(
        `${API_ENDPOINTS.pulsechain.tokens}/${address}/instances`,
        false,
        { page, limit }
      );
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getTokenInstanceById(address: string, id: string): Promise<ApiResponse<NFTInstance>> {
    validateAddress(address);
    try {
      const data = await this.apiCall<NFTInstance>(
        `${API_ENDPOINTS.pulsechain.tokens}/${address}/instances/${id}`
      );
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getTokenInstanceTransfers(address: string, id: string): Promise<ApiResponse<TokenTransfer[]>> {
    validateAddress(address);
    try {
      const data = await this.apiCall<TokenTransfer[]>(
        `${API_ENDPOINTS.pulsechain.tokens}/${address}/instances/${id}/transfers`
      );
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getTokenInstanceHolders(address: string, id: string): Promise<ApiResponse<Holder[]>> {
    validateAddress(address);
    try {
      const data = await this.apiCall<Holder[]>(
        `${API_ENDPOINTS.pulsechain.tokens}/${address}/instances/${id}/holders`
      );
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getTokenInstanceTransfersCount(address: string, id: string): Promise<ApiResponse<number>> {
    validateAddress(address);
    try {
      const data = await this.apiCall<number>(
        `${API_ENDPOINTS.pulsechain.tokens}/${address}/instances/${id}/transfers-count`
      );
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  // Address operations
  async getAddressInfo(address: string): Promise<ApiResponse<AddressInfo>> {
    validateAddress(address);
    
    try {
      const data = await this.apiCall<AddressInfo>(`${API_ENDPOINTS.pulsechain.addresses}/${address}`);
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getAddressTransactions(
    address: string,
    limit: number = DEFAULT_PAGINATION_LIMIT,
    offset?: string
  ): Promise<ApiResponse<TransactionResponse>> {
    validateAddress(address);
    
    try {
      const params: Record<string, any> = { limit };
      if (offset) params.offset = offset;
      
      const data = await this.apiCall<TransactionResponse>(
        `${API_ENDPOINTS.pulsechain.addresses}/${address}/transactions`,
        false,
        params
      );
      
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getAddressTokenBalances(address: string): Promise<ApiResponse<any>> {
    validateAddress(address);
    
    try {
      const data = await this.apiCall<any>(
        `${API_ENDPOINTS.pulsechain.addresses}/${address}/token-balances`
      );
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getAddressTokenTransfers(address: string, page: number = 1, limit: number = DEFAULT_PAGINATION_LIMIT): Promise<ApiResponse<TokenTransfer[] | TransactionResponse>> {
    validateAddress(address);
    try {
      const data = await this.apiCall<TokenTransfer[] | TransactionResponse>(
        `${API_ENDPOINTS.pulsechain.addresses}/${address}/token-transfers`,
        false,
        { page, limit }
      );
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getAddressInternalTransactions(address: string, page: number = 1, limit: number = DEFAULT_PAGINATION_LIMIT): Promise<ApiResponse<InternalTransaction[]>> {
    validateAddress(address);
    try {
      const data = await this.apiCall<InternalTransaction[]>(
        `${API_ENDPOINTS.pulsechain.addresses}/${address}/internal-transactions`,
        false,
        { page, limit }
      );
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getAddressLogs(address: string, page: number = 1, limit: number = DEFAULT_PAGINATION_LIMIT): Promise<ApiResponse<LogEntry[]>> {
    validateAddress(address);
    try {
      const data = await this.apiCall<LogEntry[]>(
        `${API_ENDPOINTS.pulsechain.addresses}/${address}/logs`,
        false,
        { page, limit }
      );
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getAddressBlocksValidated(address: string, page: number = 1, limit: number = DEFAULT_PAGINATION_LIMIT): Promise<ApiResponse<Block[]>> {
    validateAddress(address);
    try {
      const data = await this.apiCall<Block[]>(
        `${API_ENDPOINTS.pulsechain.addresses}/${address}/blocks-validated`,
        false,
        { page, limit }
      );
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getAddressTokens(address: string, page: number = 1, limit: number = DEFAULT_PAGINATION_LIMIT): Promise<ApiResponse<any>> {
    validateAddress(address);
    try {
      const data = await this.apiCall<any>(
        `${API_ENDPOINTS.pulsechain.addresses}/${address}/tokens`,
        false,
        { page, limit }
      );
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getAddressCounters(address: string): Promise<ApiResponse<AddressCounters>> {
    validateAddress(address);
    try {
      const data = await this.apiCall<AddressCounters>(
        `${API_ENDPOINTS.pulsechain.addresses}/${address}/counters`
      );
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getAddressCoinBalanceHistory(address: string, page: number = 1, limit: number = DEFAULT_PAGINATION_LIMIT): Promise<ApiResponse<CoinBalanceHistoryEntry[]>> {
    validateAddress(address);
    try {
      const data = await this.apiCall<CoinBalanceHistoryEntry[]>(
        `${API_ENDPOINTS.pulsechain.addresses}/${address}/coin-balance-history`,
        false,
        { page, limit }
      );
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getAddressCoinBalanceHistoryByDay(address: string, page: number = 1, limit: number = DEFAULT_PAGINATION_LIMIT): Promise<ApiResponse<CoinBalanceHistoryEntry[]>> {
    validateAddress(address);
    try {
      const data = await this.apiCall<CoinBalanceHistoryEntry[]>(
        `${API_ENDPOINTS.pulsechain.addresses}/${address}/coin-balance-history-by-day`,
        false,
        { page, limit }
      );
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getAddressWithdrawals(address: string, page: number = 1, limit: number = DEFAULT_PAGINATION_LIMIT): Promise<ApiResponse<Withdrawal[]>> {
    validateAddress(address);
    try {
      const data = await this.apiCall<Withdrawal[]>(
        `${API_ENDPOINTS.pulsechain.addresses}/${address}/withdrawals`,
        false,
        { page, limit }
      );
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getAddressNFT(address: string, page: number = 1, limit: number = DEFAULT_PAGINATION_LIMIT): Promise<ApiResponse<NFTInstance[]>> {
    validateAddress(address);
    try {
      const data = await this.apiCall<NFTInstance[]>(
        `${API_ENDPOINTS.pulsechain.addresses}/${address}/nft`,
        false,
        { page, limit }
      );
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getAddressNFTCollections(address: string, page: number = 1, limit: number = DEFAULT_PAGINATION_LIMIT): Promise<ApiResponse<NFTInstance[]>> {
    validateAddress(address);
    try {
      const data = await this.apiCall<NFTInstance[]>(
        `${API_ENDPOINTS.pulsechain.addresses}/${address}/nft/collections`,
        false,
        { page, limit }
      );
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  // Transaction operations
  async getTransaction(hash: string): Promise<ApiResponse<Transaction>> {
    if (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
      return { error: 'Invalid transaction hash format', success: false };
    }
    
    try {
      const data = await this.apiCall<Transaction>(`${API_ENDPOINTS.pulsechain.transactions}/${hash}`);
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getTransactionTokenTransfers(hash: string): Promise<ApiResponse<TokenTransfer[]>> {
    if (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
      return { error: 'Invalid transaction hash format', success: false };
    }
    try {
      const data = await this.apiCall<TokenTransfer[]>(`${API_ENDPOINTS.pulsechain.transactions}/${hash}/token-transfers`);
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getTransactionInternalTransactions(hash: string): Promise<ApiResponse<InternalTransaction[]>> {
    if (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
      return { error: 'Invalid transaction hash format', success: false };
    }
    try {
      const data = await this.apiCall<InternalTransaction[]>(`${API_ENDPOINTS.pulsechain.transactions}/${hash}/internal-transactions`);
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getTransactionLogs(hash: string): Promise<ApiResponse<LogEntry[]>> {
    if (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
      return { error: 'Invalid transaction hash format', success: false };
    }
    try {
      const data = await this.apiCall<LogEntry[]>(`${API_ENDPOINTS.pulsechain.transactions}/${hash}/logs`);
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getTransactionRawTrace(hash: string): Promise<ApiResponse<any>> {
    if (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
      return { error: 'Invalid transaction hash format', success: false };
    }
    try {
      const data = await this.apiCall<any>(`${API_ENDPOINTS.pulsechain.transactions}/${hash}/raw-trace`);
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getTransactionStateChanges(hash: string): Promise<ApiResponse<any>> {
    if (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
      return { error: 'Invalid transaction hash format', success: false };
    }
    try {
      const data = await this.apiCall<any>(`${API_ENDPOINTS.pulsechain.transactions}/${hash}/state-changes`);
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getTransactionSummary(hash: string): Promise<ApiResponse<any>> {
    if (!hash || !/^0x[a-fA-F0-9]{64}$/.test(hash)) {
      return { error: 'Invalid transaction hash format', success: false };
    }
    try {
      const data = await this.apiCall<any>(`${API_ENDPOINTS.pulsechain.transactions}/${hash}/summary`);
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  // Search operations
  async search(query: string): Promise<ApiResponse<SearchResponse>> {
    if (!query || query.length < 2) {
      return { error: 'Search query must be at least 2 characters', success: false };
    }
    
    try {
      const data = await this.apiCall<SearchResponse>(
        API_ENDPOINTS.pulsechain.search,
        false,
        { q: query }
      );
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async checkSearchRedirect(query: string): Promise<ApiResponse<any>> {
    if (!query || query.length < 2) {
      return { error: 'Search query must be at least 2 characters', success: false };
    }
    try {
      const data = await this.apiCall<any>(`${API_ENDPOINTS.pulsechain.search}/check-redirect`, false, { q: query });
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  // Blocks
  async getBlock(id: string): Promise<ApiResponse<Block>> {
    try {
      const data = await this.apiCall<Block>(`${API_ENDPOINTS.pulsechain.transactions.replace('transactions','blocks')}/${id}`);
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getBlockTransactions(id: string, page: number = 1, limit: number = DEFAULT_PAGINATION_LIMIT): Promise<ApiResponse<Transaction[]>> {
    try {
      const data = await this.apiCall<Transaction[]>(`blocks/${id}/transactions`, false, { page, limit });
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getBlockWithdrawals(id: string, page: number = 1, limit: number = DEFAULT_PAGINATION_LIMIT): Promise<ApiResponse<Withdrawal[]>> {
    try {
      const data = await this.apiCall<Withdrawal[]>(`blocks/${id}/withdrawals`, false, { page, limit });
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  // Stats & charts
  async getStats(): Promise<ApiResponse<StatsResponse>> {
    try {
      const data = await this.apiCall<StatsResponse>('stats');
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getTransactionChart(): Promise<ApiResponse<TransactionChartItem[]>> {
    try {
      const data = await this.apiCall<TransactionChartItem[]>('stats/charts/transactions');
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getMarketChart(): Promise<ApiResponse<MarketChartItem[]>> {
    try {
      const data = await this.apiCall<MarketChartItem[]>('stats/charts/market');
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  // Lists
  async getTokensList(page: number = 1, limit: number = DEFAULT_PAGINATION_LIMIT): Promise<ApiResponse<TokenInfo[]>> {
    try {
      const data = await this.apiCall<TokenInfo[]>('tokens', false, { page, limit });
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getTransactionsList(page: number = 1, limit: number = DEFAULT_PAGINATION_LIMIT): Promise<ApiResponse<Transaction[]>> {
    try {
      const data = await this.apiCall<Transaction[]>('transactions', false, { page, limit });
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getBlocksList(page: number = 1, limit: number = DEFAULT_PAGINATION_LIMIT): Promise<ApiResponse<Block[]>> {
    try {
      const data = await this.apiCall<Block[]>('blocks', false, { page, limit });
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getTokenTransfersList(page: number = 1, limit: number = DEFAULT_PAGINATION_LIMIT): Promise<ApiResponse<TokenTransfer[]>> {
    try {
      const data = await this.apiCall<TokenTransfer[]>('token-transfers', false, { page, limit });
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getInternalTransactionsList(page: number = 1, limit: number = DEFAULT_PAGINATION_LIMIT): Promise<ApiResponse<InternalTransaction[]>> {
    try {
      const data = await this.apiCall<InternalTransaction[]>('internal-transactions', false, { page, limit });
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getAddressesList(page: number = 1, limit: number = DEFAULT_PAGINATION_LIMIT): Promise<ApiResponse<AddressInfo[]>> {
    try {
      const data = await this.apiCall<AddressInfo[]>('addresses', false, { page, limit });
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getWithdrawalsList(page: number = 1, limit: number = DEFAULT_PAGINATION_LIMIT): Promise<ApiResponse<Withdrawal[]>> {
    try {
      const data = await this.apiCall<Withdrawal[]>('withdrawals', false, { page, limit });
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  // Config & status
  async getJsonRpcUrl(): Promise<ApiResponse<string>> {
    try {
      const data = await this.apiCall<string>('config/json-rpc-url');
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getAccountAbstractionStatus(): Promise<ApiResponse<any>> {
    try {
      const data = await this.apiCall<any>('proxy/account-abstraction/status');
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getMainPageTransactions(page: number = 1, limit: number = DEFAULT_PAGINATION_LIMIT): Promise<ApiResponse<Transaction[]>> {
    try {
      const data = await this.apiCall<Transaction[]>('main-page/transactions', false, { page, limit });
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getMainPageBlocks(page: number = 1, limit: number = DEFAULT_PAGINATION_LIMIT): Promise<ApiResponse<Block[]>> {
    try {
      const data = await this.apiCall<Block[]>('main-page/blocks', false, { page, limit });
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  async getIndexingStatus(): Promise<ApiResponse<any>> {
    try {
      const data = await this.apiCall<any>('main-page/indexing-status');
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  // Legacy helper for v1 token balance
  async getTokenBalanceLegacy(contractAddress: string, walletAddress: string): Promise<ApiResponse<any>> {
    if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress) || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return { error: 'Invalid address', success: false };
    }
    try {
      const url = `https://api.scan.pulsechain.com/api?module=account&action=tokenbalance&contractaddress=${contractAddress}&address=${walletAddress}`;
      const res = await fetchWithTimeout(url, {}, SERVICE_CONFIG.pulsechain.timeout);
      if (!res.ok) {
        return { error: `HTTP ${res.status}`, success: false };
      }
      const data = await res.json();
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }

  // Creator transactions (for specific address)
  async getCreatorTransactions(
    address: string,
    limit: number = DEFAULT_PAGINATION_LIMIT
  ): Promise<ApiResponse<TransactionResponse>> {
    validateAddress(address);
    
    try {
      const data = await this.apiCall<TransactionResponse>(
        `${API_ENDPOINTS.pulsechain.addresses}/${address}/transactions`,
        false,
        { 
          limit,
          filter: 'from'
        }
      );
      return { data, success: true };
    } catch (error) {
      return { error: (error as Error).message, success: false };
    }
  }
}

// Export singleton instance
export const pulsechainApi = new PulsechainApiClient();