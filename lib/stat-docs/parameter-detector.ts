// Parameter detection and documentation generation for stats
// Extracts required parameters for each stat based on naming patterns

export interface StatParameter {
  key: string;
  label: string;
  type: 'string' | 'number';
  required: boolean;
  description: string;
  placeholder: string;
  example: string;
}

export interface StatDocumentation {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: StatParameter[];
}

/**
 * Determines required parameters for a given stat ID
 * Based on the logic from AdminStatsPanel's getRequiredInputs
 */
export function detectStatParameters(statId: string): StatParameter[] {
  const parameters: StatParameter[] = [];
  
  // Always include the token address as the primary parameter
  parameters.push({
    key: 'address',
    label: 'Token Address',
    type: 'string',
    required: true,
    description: 'The PulseChain token contract address to query',
    placeholder: '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e',
    example: '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e'
  });
  
  // Search-specific parameters
  if (statId === 'search' || statId === 'checkSearchRedirect') {
    parameters.push({
      key: 'searchQuery',
      label: 'Search Query',
      type: 'string',
      required: true,
      description: 'The search term to query',
      placeholder: 'Enter search query...',
      example: 'PulseChain'
    });
  }
  
  // Transaction-specific parameters
  if (statId.startsWith('transaction')) {
    parameters.push({
      key: 'transactionHash',
      label: 'Transaction Hash',
      type: 'string',
      required: true,
      description: 'The transaction hash to query',
      placeholder: '0x...',
      example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    });
  }
  
  // Block-specific parameters
  if (statId.startsWith('block')) {
    parameters.push({
      key: 'blockNumberOrHash',
      label: 'Block Number or Hash',
      type: 'string',
      required: true,
      description: 'The block number or hash to query',
      placeholder: '12345 or 0x...',
      example: '12345678'
    });
  }
  
  // Address-specific parameters
  if (statId.startsWith('address') || statId === 'addressInfo' || statId === 'addressCounters' || 
      statId === 'addressTransactions' || statId === 'addressTokenTransfers' || 
      statId === 'addressInternalTransactions' || statId === 'addressLogs' || 
      statId === 'addressBlocksValidated' || statId === 'addressTokenBalances' || 
      statId === 'addressTokens' || statId === 'addressCoinBalanceHistory' || 
      statId === 'addressCoinBalanceHistoryByDay' || statId === 'addressWithdrawals' || 
      statId === 'addressNFT' || statId === 'addressNFTCollections') {
    parameters.push({
      key: 'addressHash',
      label: 'Address Hash',
      type: 'string',
      required: false,
      description: 'The wallet address to query (defaults to token address if not provided)',
      placeholder: '0x... (optional)',
      example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4'
    });
  }
  
  // Token balance specific - needs wallet address
  if (statId === 'tokenBalance') {
    parameters.push({
      key: 'walletAddress',
      label: 'Wallet Address',
      type: 'string',
      required: true,
      description: 'The wallet address to check token balance for',
      placeholder: '0x...',
      example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4'
    });
  }
  
  // Token-specific filters
  if (statId === 'addressTokenBalances') {
    parameters.push({
      key: 'tokenAddress',
      label: 'Token Address (optional)',
      type: 'string',
      required: false,
      description: 'Filter results by specific token address',
      placeholder: 'Filter by token address...',
      example: '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e'
    });
  }
  
  // NFT instance parameters
  if (statId.includes('Instance') && statId !== 'tokenInstances') {
    parameters.push({
      key: 'instanceId',
      label: 'Instance ID',
      type: 'string',
      required: true,
      description: 'The NFT instance/token ID',
      placeholder: 'NFT instance ID...',
      example: '1'
    });
  }
  
  // Smart contract parameters
  if (statId === 'smartContractDetails') {
    parameters.push({
      key: 'contractAddress',
      label: 'Contract Address',
      type: 'string',
      required: true,
      description: 'The smart contract address to query',
      placeholder: '0x...',
      example: '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e'
    });
  }
  
  // Pagination parameters for list endpoints
  if (statId.includes('List') || statId.includes('Transactions') || statId.includes('Transfers') || 
      statId.includes('Holders') || statId.includes('Instances') || statId.includes('Blocks') || 
      statId.includes('Withdrawals') || statId.includes('NFT') || statId.includes('Tokens') ||
      statId.includes('Logs') || statId.includes('History')) {
    parameters.push({
      key: 'page',
      label: 'Page',
      type: 'number',
      required: false,
      description: 'Page number for pagination',
      placeholder: '1',
      example: '1'
    });
    parameters.push({
      key: 'limit',
      label: 'Limit',
      type: 'number',
      required: false,
      description: 'Number of results per page',
      placeholder: '100',
      example: '50'
    });
  }
  
  return parameters;
}

/**
 * Generates a URL query string from parameters
 */
export function generateQueryString(params: Record<string, string | number>): string {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, String(value));
    }
  });
  return queryParams.toString();
}

/**
 * Generates example values for all parameters
 */
export function generateExampleParams(parameters: StatParameter[]): Record<string, string> {
  const examples: Record<string, string> = {};
  parameters.forEach(param => {
    examples[param.key] = param.example;
  });
  return examples;
}

