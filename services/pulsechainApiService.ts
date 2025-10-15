// Enhanced PulseChain API Service for Comprehensive Blockchain Analysis
// Phase 2: Extended functionality with full endpoint coverage

const PULSECHAIN_API_BASE = '/api/pulsechain-proxy';

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  type: string;
  holders: number;
  exchange_rate?: string;
  total_supply?: string;
  circulating_market_cap?: string;
  icon_url?: string;
}

export interface TokenInfoDetailed extends TokenInfo {
  circulating_market_cap: string;
  icon_url: string;
  exchange_rate: string;
}

export interface Holder {
  address: {
    hash: string;
    implementation_name?: string | null;
    is_contract: boolean;
    is_verified?: boolean | null;
    name?: string | null;
    private_tags?: string[];
    public_tags?: string[];
    watchlist_names?: string[];
  };
  value: string;
  token_id?: string | null;
  token?: {
    address: string;
    circulating_market_cap?: string | null;
    decimals: string;
    exchange_rate?: string | null;
    holders: string;
    icon_url?: string | null;
    name: string;
    symbol: string;
    total_supply: string;
    type: string;
  };
}

export interface AddressInfo {
  hash: string;
  name?: string;
  is_contract: boolean;
  is_verified?: boolean;
  coin_balance: string;
  token_balances?: TokenBalance[];
}

export interface TokenBalance {
  value: string;
  token_id?: string;
  token: TokenInfo;
}

export interface SearchResult {
  address: string;
  name: string;
  symbol?: string;
  type: string;
  icon_url?: string;
  is_smart_contract_verified?: boolean;
}

export interface Transaction {
  hash: string;
  timestamp: string;
  status: string;
  method?: string;
  from: string;
  to: string;
  value: string;
  fee: string;
  gas_limit: string;
  gas_used: string;
}

export interface TokenTransfer {
  transaction_hash: string;
  from: string;
  to: string;
  token: TokenInfo;
  value: string;
  block_hash: string;
  log_index: number;
  timestamp: string;
}

export interface TokenCounters {
  token_holders_count: number;
  transfers_count: number;
}

export interface MarketChartItem {
  date: string;
  closing_price: string;
  market_cap: string;
}

export interface StatsResponse {
  total_blocks: number;
  total_addresses: number;
  total_transactions: number;
  average_block_time: number;
  coin_price: string;
  total_gas_used: string;
  transactions_today: number;
  gas_used_today: string;
}

// New interfaces for enhanced functionality
export interface Block {
  hash: string;
  number: number;
  timestamp: string;
  transactions_count: number;
  gas_used: string;
  gas_limit: string;
  base_fee_per_gas: string;
  burnt_fees: string;
  miner: string;
}

export interface InternalTransaction {
  transaction_hash: string;
  block_number: number;
  from: string;
  to: string;
  value: string;
  gas_limit: string;
  gas_used: string;
  success: boolean;
  error?: string;
  type: string;
  created_contract?: string;
}

export interface Log {
  transaction_hash: string;
  block_number: number;
  address: string;
  topics: string[];
  data: string;
  log_index: number;
  decoded?: any;
}

export interface StateChange {
  type: string;
  address: string;
  balance_before: string;
  balance_after: string;
  token?: TokenInfo;
}

export interface Withdrawal {
  index: number;
  amount: string;
  validator_index: number;
  receiver: string;
  timestamp: string;
  block_number: number;
}

export interface SmartContract {
  address: string;
  name?: string;
  compiler_version: string;
  language: string;
  is_verified: boolean;
  source_code?: string;
  abi?: any[];
  optimization_enabled: boolean;
  constructor_arguments?: string;
}

export interface AddressCounters {
  transactions_count: number;
  token_transfers_count: number;
  gas_usage_count: number;
  validations_count: number;
}

export interface CoinBalanceHistory {
  block_number: number;
  block_timestamp: string;
  delta: string;
  value: string;
  transaction_hash: string;
}

export interface NFTInstance {
  id: string;
  token_id: string;
  owner: string;
  token: TokenInfo;
  metadata?: any;
  image_url?: string;
}

export interface SearchResultRedirect {
  parameter: string;
  redirect: string;
  type: string;
}

export interface IndexingStatus {
  finished_indexing: boolean;
  finished_indexing_blocks: boolean;
  indexed_blocks_ratio: string;
  indexed_internal_transactions_ratio: string;
}

export interface TransactionChartItem {
  date: string;
  transaction_count: number;
}

export interface Fee {
  type: string;
  value: string;
}

export interface RawTrace {
  action: any;
  result?: any;
  subtraces: number;
  traceAddress: number[];
  type: string;
  error?: string;
}

class PulseChainApiService {
  private baseUrl: string;

  constructor(baseUrl: string = PULSECHAIN_API_BASE) {
    this.baseUrl = baseUrl;
  }

  // Generic API call method with error handling
  private async apiCall<T>(endpoint: string, params?: Record<string, any>, method: string = 'GET'): Promise<T> {
    try {
      // Use window.location.origin to get the current domain
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const url = new URL(`${this.baseUrl}`, baseUrl);
      url.searchParams.append('endpoint', endpoint);
      
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      if (params && method === 'GET') {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            url.searchParams.append(key, value.toString());
          }
        });
      } else if (params && method !== 'GET') {
        options.body = JSON.stringify(params);
      }

      const response = await fetch(url.toString(), options);
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Check if the response contains an error
      if (data.error) {
        throw new Error(data.error);
      }
      
      return data as T;
    } catch (error) {
      throw error;
    }
  }

  // 1. Search & Discovery
  async search(query: string): Promise<SearchResult[]> {
    return this.apiCall<SearchResult[]>('/search', { q: query });
  }

  async checkSearchRedirect(query: string): Promise<SearchResultRedirect> {
    return this.apiCall<SearchResultRedirect>('/search/check-redirect', { q: query });
  }

  // 2. Token Analysis
  async getTokenInfo(tokenAddress: string): Promise<TokenInfoDetailed> {
    return this.apiCall<TokenInfoDetailed>(`/tokens/${tokenAddress}`);
  }

  async getTokenHolders(tokenAddress: string, page: number = 1, limit: number = 2000): Promise<Holder[]> {
    const response = await this.apiCall<{ items: Holder[] }>(`/tokens/${tokenAddress}/holders`, { page, limit });
    return response.items || [];
  }

  async getTokenTransfers(tokenAddress: string, page: number = 1, limit: number = 1000): Promise<TokenTransfer[]> {
    return this.apiCall<TokenTransfer[]>(`/tokens/${tokenAddress}/transfers`, { page, limit });
  }

  async getTokenCounters(tokenAddress: string): Promise<TokenCounters> {
    return this.apiCall<TokenCounters>(`/tokens/${tokenAddress}/counters`);
  }

  async getTokenInstances(tokenAddress: string, page: number = 1, limit: number = 100): Promise<NFTInstance[]> {
    return this.apiCall<NFTInstance[]>(`/tokens/${tokenAddress}/instances`, { page, limit });
  }

  async getTokenInstanceById(tokenAddress: string, instanceId: string): Promise<NFTInstance> {
    return this.apiCall<NFTInstance>(`/tokens/${tokenAddress}/instances/${instanceId}`);
  }

  async getTokenInstanceTransfers(tokenAddress: string, instanceId: string): Promise<TokenTransfer[]> {
    return this.apiCall<TokenTransfer[]>(`/tokens/${tokenAddress}/instances/${instanceId}/transfers`);
  }

  async getTokenInstanceHolders(tokenAddress: string, instanceId: string): Promise<Holder[]> {
    return this.apiCall<Holder[]>(`/tokens/${tokenAddress}/instances/${instanceId}/holders`);
  }

  async getTokenInstanceTransfersCount(tokenAddress: string, instanceId: string): Promise<number> {
    return this.apiCall<number>(`/tokens/${tokenAddress}/instances/${instanceId}/transfers-count`);
  }

  async refetchTokenInstanceMetadata(tokenAddress: string, instanceId: string): Promise<any> {
    return this.apiCall(`/tokens/${tokenAddress}/instances/${instanceId}/refetch-metadata`, {}, 'PATCH');
  }

  // 3. Address Analysis
  async getAddressInfo(address: string): Promise<AddressInfo> {
    return this.apiCall<AddressInfo>(`/addresses/${address}`);
  }

  async getAddressTokenBalances(address: string): Promise<TokenBalance[]> {
    return this.apiCall<TokenBalance[]>(`/addresses/${address}/token-balances`);
  }

  async getAddressTokens(address: string, page: number = 1, limit: number = 2000): Promise<TokenBalance[]> {
    return this.apiCall<TokenBalance[]>(`/addresses/${address}/tokens`, { page, limit });
  }

  async getAddressTransactions(address: string, page: number = 1, limit: number = 1000): Promise<Transaction[]> {
    return this.apiCall<Transaction[]>(`/addresses/${address}/transactions`, { page, limit });
  }

  async getAddressTokenTransfers(address: string, page: number = 1, limit: number = 1000): Promise<TokenTransfer[]> {
    return this.apiCall<TokenTransfer[]>(`/addresses/${address}/token-transfers`, { page, limit });
  }

  async getAddressInternalTransactions(address: string, page: number = 1, limit: number = 1000): Promise<InternalTransaction[]> {
    return this.apiCall<InternalTransaction[]>(`/addresses/${address}/internal-transactions`, { page, limit });
  }

  async getAddressLogs(address: string, page: number = 1, limit: number = 100): Promise<Log[]> {
    return this.apiCall<Log[]>(`/addresses/${address}/logs`, { page, limit });
  }

  async getAddressBlocksValidated(address: string, page: number = 1, limit: number = 100): Promise<Block[]> {
    return this.apiCall<Block[]>(`/addresses/${address}/blocks-validated`, { page, limit });
  }

  async getAddressCoinBalanceHistory(address: string, page: number = 1, limit: number = 100): Promise<CoinBalanceHistory[]> {
    return this.apiCall<CoinBalanceHistory[]>(`/addresses/${address}/coin-balance-history`, { page, limit });
  }

  async getAddressCoinBalanceHistoryByDay(address: string, page: number = 1, limit: number = 100): Promise<CoinBalanceHistory[]> {
    return this.apiCall<CoinBalanceHistory[]>(`/addresses/${address}/coin-balance-history-by-day`, { page, limit });
  }

  async getAddressWithdrawals(address: string, page: number = 1, limit: number = 100): Promise<Withdrawal[]> {
    return this.apiCall<Withdrawal[]>(`/addresses/${address}/withdrawals`, { page, limit });
  }

  async getAddressNFT(address: string, page: number = 1, limit: number = 100): Promise<NFTInstance[]> {
    return this.apiCall<NFTInstance[]>(`/addresses/${address}/nft`, { page, limit });
  }

  async getAddressNFTCollections(address: string, page: number = 1, limit: number = 100): Promise<NFTInstance[]> {
    return this.apiCall<NFTInstance[]>(`/addresses/${address}/nft/collections`, { page, limit });
  }

  async getAddressCounters(address: string): Promise<AddressCounters> {
    return this.apiCall<AddressCounters>(`/addresses/${address}/counters`);
  }

  // 4. Contract Analysis
  async getSmartContract(contractAddress: string): Promise<SmartContract> {
    return this.apiCall<SmartContract>(`/smart-contracts/${contractAddress}`);
  }

  async getSmartContracts(page: number = 1, limit: number = 100): Promise<SmartContract[]> {
    return this.apiCall<SmartContract[]>('/smart-contracts', { page, limit });
  }

  async getSmartContractsCounters(): Promise<any> {
    return this.apiCall('/smart-contracts/counters');
  }

  // 5. Transaction Analysis
  async getTransaction(txHash: string): Promise<Transaction> {
    return this.apiCall<Transaction>(`/transactions/${txHash}`);
  }

  async getTransactionTokenTransfers(txHash: string): Promise<TokenTransfer[]> {
    return this.apiCall<TokenTransfer[]>(`/transactions/${txHash}/token-transfers`);
  }

  async getTransactionInternalTransactions(txHash: string): Promise<InternalTransaction[]> {
    return this.apiCall<InternalTransaction[]>(`/transactions/${txHash}/internal-transactions`);
  }

  async getTransactionLogs(txHash: string): Promise<Log[]> {
    return this.apiCall<Log[]>(`/transactions/${txHash}/logs`);
  }

  async getTransactionRawTrace(txHash: string): Promise<RawTrace[]> {
    return this.apiCall<RawTrace[]>(`/transactions/${txHash}/raw-trace`);
  }

  async getTransactionStateChanges(txHash: string): Promise<StateChange[]> {
    return this.apiCall<StateChange[]>(`/transactions/${txHash}/state-changes`);
  }

  async getTransactionSummary(txHash: string): Promise<any> {
    return this.apiCall(`/transactions/${txHash}/summary`);
  }

  // 6. Block Analysis
  async getBlock(blockNumberOrHash: string): Promise<Block> {
    return this.apiCall<Block>(`/blocks/${blockNumberOrHash}`);
  }

  async getBlockTransactions(blockNumberOrHash: string, page: number = 1, limit: number = 100): Promise<Transaction[]> {
    return this.apiCall<Transaction[]>(`/blocks/${blockNumberOrHash}/transactions`, { page, limit });
  }

  async getBlockWithdrawals(blockNumberOrHash: string, page: number = 1, limit: number = 100): Promise<Withdrawal[]> {
    return this.apiCall<Withdrawal[]>(`/blocks/${blockNumberOrHash}/withdrawals`, { page, limit });
  }

  // 7. Market Data
  async getMarketChart(): Promise<MarketChartItem[]> {
    return this.apiCall<MarketChartItem[]>('/stats/charts/market');
  }

  async getTransactionChart(): Promise<TransactionChartItem[]> {
    return this.apiCall<TransactionChartItem[]>('/stats/charts/transactions');
  }

  async getStats(): Promise<StatsResponse> {
    return this.apiCall<StatsResponse>('/stats');
  }

  // 8. List Endpoints
  async getTokensList(page: number = 1, limit: number = 100): Promise<TokenInfo[]> {
    return this.apiCall<TokenInfo[]>('/tokens', { page, limit });
  }

  async getTransactionsList(page: number = 1, limit: number = 100): Promise<Transaction[]> {
    return this.apiCall<Transaction[]>('/transactions', { page, limit });
  }

  async getBlocksList(page: number = 1, limit: number = 100): Promise<Block[]> {
    return this.apiCall<Block[]>('/blocks', { page, limit });
  }

  async getTokenTransfersList(page: number = 1, limit: number = 1000): Promise<TokenTransfer[]> {
    return this.apiCall<TokenTransfer[]>('/token-transfers', { page, limit });
  }

  async getInternalTransactionsList(page: number = 1, limit: number = 100): Promise<InternalTransaction[]> {
    return this.apiCall<InternalTransaction[]>('/internal-transactions', { page, limit });
  }

  async getAddressesList(page: number = 1, limit: number = 100): Promise<AddressInfo[]> {
    return this.apiCall<AddressInfo[]>('/addresses', { page, limit });
  }

  async getWithdrawalsList(page: number = 1, limit: number = 100): Promise<Withdrawal[]> {
    return this.apiCall<Withdrawal[]>('/withdrawals', { page, limit });
  }

  // 9. Configuration
  async getJsonRpcUrl(): Promise<string> {
    return this.apiCall<string>('/config/json-rpc-url');
  }

  // 10. Account Abstraction
  async getAccountAbstractionStatus(): Promise<any> {
    return this.apiCall('/proxy/account-abstraction/status');
  }

  // 11. Main Page Data
  async getMainPageTransactions(page: number = 1, limit: number = 100): Promise<Transaction[]> {
    return this.apiCall<Transaction[]>('/main-page/transactions', { page, limit });
  }

  async getMainPageBlocks(page: number = 1, limit: number = 100): Promise<Block[]> {
    return this.apiCall<Block[]>('/main-page/blocks', { page, limit });
  }

  async getIndexingStatus(): Promise<IndexingStatus> {
    return this.apiCall<IndexingStatus>('/main-page/indexing-status');
  }

  // Enhanced Analysis Methods
  async getHolderOverlap(token1Address: string, token2Address: string): Promise<{
    token1Holders: Holder[];
    token2Holders: Holder[];
    overlap: string[];
    overlapPercentage: number;
  }> {
    try {
      // Get holders for both tokens
      const [token1Holders, token2Holders] = await Promise.all([
        this.getTokenHolders(token1Address, 1, 1000), // Get more holders for better analysis
        this.getTokenHolders(token2Address, 1, 1000)
      ]);

      // Find overlapping addresses
      const token1Addresses = new Set(token1Holders.map(h => h.address.toLowerCase()));
      const token2Addresses = new Set(token2Holders.map(h => h.address.toLowerCase()));
      
      const overlap = Array.from(token1Addresses).filter(addr => token2Addresses.has(addr));
      const overlapPercentage = (overlap.length / Math.max(token1Addresses.size, token2Addresses.size)) * 100;

      return {
        token1Holders,
        token2Holders,
        overlap,
        overlapPercentage
      };
    } catch (error) {
      throw error;
    }
  }

  async getAddressTokenPortfolio(address: string): Promise<{
    address: string;
    tokens: TokenBalance[];
    totalTokens: number;
    estimatedValue?: string;
  }> {
    try {
      const tokenBalances = await this.getAddressTokenBalances(address);
      
      return {
        address,
        tokens: tokenBalances,
        totalTokens: tokenBalances.length,
        estimatedValue: '0' // TODO: Calculate USD value
      };
    } catch (error) {
      throw error;
    }
  }

  async searchTokensByName(name: string): Promise<TokenInfo[]> {
    try {
      const results = await this.search(name);
      const tokenResults = results.filter(result => result.type === 'token');
      
      // Get detailed info for each token
      const tokenDetails = await Promise.all(
        tokenResults.slice(0, 20).map(result => this.getTokenInfo(result.address))
      );
      
      return tokenDetails;
    } catch (error) {
      throw error;
    }
  }

  // Whale Analysis Methods
  async getWhaleMovements(tokenAddress: string, minAmount: string = '1000000', hours: number = 24): Promise<{
    largeTransactions: Transaction[];
    totalVolume: string;
    whaleCount: number;
    exchanges: string[];
  }> {
    try {
      const transfers = await this.getTokenTransfers(tokenAddress, 1, 100);
      const now = Date.now();
      const timeThreshold = now - (hours * 60 * 60 * 1000);

      const largeTransfers = transfers.filter(transfer => {
        const transferTime = new Date(transfer.timestamp).getTime();
        const transferValue = parseFloat(transfer.value);
        return transferTime > timeThreshold && transferValue >= parseFloat(minAmount);
      });

      const exchanges = [...new Set(largeTransfers.map(t => t.to))];
      const totalVolume = largeTransfers.reduce((sum, t) => sum + parseFloat(t.value), 0).toString();
      const whaleCount = new Set(largeTransfers.map(t => t.from)).size;

      return {
        largeTransactions: largeTransfers as any,
        totalVolume,
        whaleCount,
        exchanges
      };
    } catch (error) {
      throw error;
    }
  }

  // Historical Analysis Methods
  async getTokenPriceHistory(tokenAddress: string, days: number = 30): Promise<MarketChartItem[]> {
    try {
      const marketData = await this.getMarketChart();
      // Filter for specific token if needed
      return marketData.slice(-days);
    } catch (error) {
      throw error;
    }
  }

  async getAddressActivityHistory(address: string, days: number = 30): Promise<{
    transactions: Transaction[];
    tokenTransfers: TokenTransfer[];
    internalTransactions: InternalTransaction[];
  }> {
    try {
      const [transactions, tokenTransfers, internalTransactions] = await Promise.all([
        this.getAddressTransactions(address, 1, 100),
        this.getAddressTokenTransfers(address, 1, 100),
        this.getAddressInternalTransactions(address, 1, 100)
      ]);

      const now = Date.now();
      const timeThreshold = now - (days * 24 * 60 * 60 * 1000);

      const filterByTime = <T extends { timestamp: string }>(items: T[]): T[] => {
        return items.filter(item => new Date(item.timestamp).getTime() > timeThreshold);
      };

      return {
        transactions: filterByTime(transactions),
        tokenTransfers: filterByTime(tokenTransfers),
        internalTransactions: internalTransactions // InternalTransaction doesn't have timestamp
      };
    } catch (error) {
      throw error;
    }
  }

  // JSON-RPC Methods for Contract Calls
  private rpcUrl = 'https://rpc.pulsechain.com';

  /**
   * Make a JSON-RPC eth_call to read contract data
   * @param contractAddress - The contract to call
   * @param data - The encoded function call data
   * @param blockTag - Block number or 'latest' (default)
   */
  async ethCall(contractAddress: string, data: string, blockTag: string = 'latest'): Promise<string> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [
            {
              to: contractAddress,
              data: data
            },
            blockTag
          ],
          id: 1
        })
      });

      if (!response.ok) {
        throw new Error(`RPC call failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(`RPC error: ${result.error.message || JSON.stringify(result.error)}`);
      }

      return result.result;
    } catch (error) {
      console.error('eth_call failed:', error);
      throw error;
    }
  }

  /**
   * Read token0 address from a Uniswap V2 pair
   */
  async getToken0FromPair(pairAddress: string): Promise<string> {
    // token0() function selector: 0x0dfe1681
    const data = '0x0dfe1681';
    const result = await this.ethCall(pairAddress, data);
    // Result is padded address, extract last 40 chars
    return '0x' + result.slice(-40);
  }

  /**
   * Read token1 address from a Uniswap V2 pair
   */
  async getToken1FromPair(pairAddress: string): Promise<string> {
    // token1() function selector: 0xd21220a7
    const data = '0xd21220a7';
    const result = await this.ethCall(pairAddress, data);
    // Result is padded address, extract last 40 chars
    return '0x' + result.slice(-40);
  }

  /**
   * Read decimals from an ERC20 token
   */
  async getTokenDecimals(tokenAddress: string): Promise<number> {
    try {
      // decimals() function selector: 0x313ce567
      const data = '0x313ce567';
      const result = await this.ethCall(tokenAddress, data);
      return parseInt(result, 16);
    } catch (error) {
      console.warn(`Failed to get decimals for ${tokenAddress}, defaulting to 18:`, error);
      return 18; // Default to 18 if call fails
    }
  }

  /**
   * Get current reserves from a Uniswap V2 pair
   * Returns [reserve0, reserve1, blockTimestampLast]
   */
  async getReservesFromPair(pairAddress: string): Promise<{
    reserve0: bigint;
    reserve1: bigint;
    blockTimestampLast: number;
  }> {
    // getReserves() function selector: 0x0902f1ac
    const data = '0x0902f1ac';
    const result = await this.ethCall(pairAddress, data);
    
    // Remove '0x' prefix
    const cleanData = result.startsWith('0x') ? result.slice(2) : result;
    
    // Parse the three uint112 values (reserves are uint112, not uint256)
    // Each uint256 in return is 64 hex chars
    const reserve0 = BigInt('0x' + cleanData.slice(0, 64));
    const reserve1 = BigInt('0x' + cleanData.slice(64, 128));
    const blockTimestampLast = parseInt(cleanData.slice(128, 192), 16);
    
    return { reserve0, reserve1, blockTimestampLast };
  }
}

// Export singleton instance
export const pulsechainApiService = new PulseChainApiService(); 