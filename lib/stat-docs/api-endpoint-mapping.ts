// Maps stats to their actual external API endpoints and responses
// This provides accurate documentation of what APIs are actually being called

export interface ApiEndpoint {
  url: string;
  method: string;
  description: string;
  parameters?: Record<string, {
    type: string;
    required: boolean;
    description: string;
    example: string;
  }>;
  sampleResponse?: any;
}

export interface StatApiMapping {
  statId: string;
  statName: string;
  endpoints: ApiEndpoint[];
  implementationNotes?: string;
  dataProcessing?: string;
}

// Blockscout API Base URL
const BLOCKSCOUT_BASE = 'https://api.scan.pulsechain.com/api/v2';
const BLOCKSCOUT_V1 = 'https://api.scan.pulsechain.com/api';
const DEXSCREENER_BASE = 'https://api.dexscreener.com/latest/dex';

/**
 * Get API endpoint mappings for a specific stat
 */
export function getStatApiMapping(statId: string): StatApiMapping | null {
  return statApiMappings[statId] || null;
}

/**
 * Complete mapping of stats to their actual API calls
 */
export const statApiMappings: Record<string, StatApiMapping> = {
  // TOKEN SUPPLY STATS
  totalSupply: {
    statId: 'totalSupply',
    statName: 'Total Supply',
    endpoints: [
      {
        url: `${BLOCKSCOUT_BASE}/tokens/{address}`,
        method: 'GET',
        description: 'Get token information including total supply',
        parameters: {
          address: {
            type: 'string',
            required: true,
            description: 'Token contract address',
            example: '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e'
          }
        },
        sampleResponse: {
          address: '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e',
          circulating_market_cap: null,
          decimals: '18',
          exchange_rate: '0.000123',
          holders: '1234',
          icon_url: 'https://...',
          name: 'Token Name',
          symbol: 'TKN',
          total_supply: '1000000000000000000000000',
          type: 'ERC-20'
        }
      }
    ],
    implementationNotes: 'Fetches token info and extracts total_supply field',
    dataProcessing: 'Divides raw value by 10^decimals to get human-readable number'
  },

  holders: {
    statId: 'holders',
    statName: 'Total Holders',
    endpoints: [
      {
        url: `${BLOCKSCOUT_BASE}/tokens/{address}`,
        method: 'GET',
        description: 'Get token information including holder count',
        sampleResponse: {
          address: '0x...',
          holders: '1234',
          name: 'Token Name',
          symbol: 'TKN',
          // ... other fields
        }
      },
      {
        url: `${BLOCKSCOUT_BASE}/tokens/{address}/counters`,
        method: 'GET',
        description: 'Get token counters (alternative source for holder count)',
        sampleResponse: {
          token_holders_count: '1234',
          transfers_count: '5678'
        }
      }
    ],
    implementationNotes: 'Tries tokenCounters.token_holders_count first, falls back to tokenInfo.holders'
  },

  burnedTotal: {
    statId: 'burnedTotal',
    statName: 'Total Burned',
    endpoints: [
      {
        url: `${BLOCKSCOUT_BASE}/tokens/{address}`,
        method: 'GET',
        description: 'Get token information including total supply'
      },
      {
        url: `${BLOCKSCOUT_BASE}/tokens/{address}/holders?limit=50`,
        method: 'GET',
        description: 'Get holders list to find dead address balance (paginated)',
        parameters: {
          address: {
            type: 'string',
            required: true,
            description: 'Token contract address',
            example: '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e'
          },
          limit: {
            type: 'number',
            required: false,
            description: 'Number of holders per page',
            example: '50'
          },
          items_count: {
            type: 'string',
            required: false,
            description: 'Pagination cursor (from next_page_params)',
            example: '50'
          },
          value: {
            type: 'string',
            required: false,
            description: 'Pagination cursor (from next_page_params)',
            example: '1000000000000000000'
          }
        },
        sampleResponse: {
          items: [
            {
              address: {
                hash: '0x000000000000000000000000000000000000dead',
                implementation_name: null,
                is_contract: false,
                is_verified: null,
                name: null,
                private_tags: [],
                public_tags: [],
                watchlist_names: []
              },
              token: {
                address: '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e',
                circulating_market_cap: null,
                decimals: '18',
                exchange_rate: '0.000123',
                holders: '1234',
                icon_url: null,
                name: 'Token Name',
                symbol: 'TKN',
                total_supply: '1000000000000000000000000',
                type: 'ERC-20'
              },
              token_id: null,
              value: '500000000000000000000000'
            }
          ],
          next_page_params: {
            items_count: '50',
            value: '500000000000000000000000'
          }
        }
      }
    ],
    implementationNotes: 'Fetches all holders (up to 50 pages), finds 0x...dead address, returns its balance',
    dataProcessing: 'Calculates percentage of total supply that is burned'
  },

  burned24h: {
    statId: 'burned24h',
    statName: 'Burned (24h)',
    endpoints: [
      {
        url: `${BLOCKSCOUT_BASE}/tokens/{address}`,
        method: 'GET',
        description: 'Get token info for total supply and decimals'
      },
      {
        url: `${BLOCKSCOUT_BASE}/tokens/{address}/transfers?limit=200`,
        method: 'GET',
        description: 'Get token transfers (paginated) to calculate burns in last 24h',
        parameters: {
          address: {
            type: 'string',
            required: true,
            description: 'Token contract address',
            example: '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e'
          },
          limit: {
            type: 'number',
            required: false,
            description: 'Number of transfers per page',
            example: '200'
          }
        },
        sampleResponse: {
          items: [
            {
              block_hash: '0x...',
              from: {
                hash: '0x...',
                implementations: [],
                is_contract: false,
                is_verified: null,
                metadata: null,
                name: null,
                private_tags: [],
                public_tags: [],
                watchlist_names: []
              },
              log_index: '123',
              method: 'transfer',
              timestamp: '2025-12-10T15:30:00.000000Z',
              to: {
                hash: '0x000000000000000000000000000000000000dead',
                // ... similar structure
              },
              token: {
                // ... token details
              },
              total: {
                decimals: '18',
                value: '1000000000000000000'
              },
              tx_hash: '0x...',
              type: 'token_transfer'
            }
          ],
          next_page_params: {
            block_number: 12345678,
            index: 123,
            items_count: 200
          }
        }
      }
    ],
    implementationNotes: 'Fetches transfers, filters for transfers TO dead address with timestamp >= 24h ago, sums values',
    dataProcessing: 'Filters transfers by timestamp, sums burn amounts, calculates percentage'
  },

  // MARKET & LIQUIDITY STATS
  currentPrice: {
    statId: 'currentPrice',
    statName: 'Current Price',
    endpoints: [
      {
        url: `${DEXSCREENER_BASE}/tokens/pulsechain/{address}`,
        method: 'GET',
        description: 'Get token price and market data from DexScreener',
        parameters: {
          address: {
            type: 'string',
            required: true,
            description: 'Token contract address',
            example: '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e'
          }
        },
        sampleResponse: {
          schemaVersion: '1.0.0',
          pairs: [
            {
              chainId: 'pulsechain',
              dexId: 'pulsex',
              url: 'https://pulsex.com/swap?outputCurrency=0x...',
              pairAddress: '0x...',
              baseToken: {
                address: '0xA1077a294dDE1B09bB078844df40758a5D0f9a27',
                name: 'Wrapped PLS',
                symbol: 'WPLS'
              },
              quoteToken: {
                address: '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e',
                name: 'Token Name',
                symbol: 'TKN'
              },
              priceNative: '0.000123',
              priceUsd: '0.0000456',
              txns: {
                m5: { buys: 10, sells: 5 },
                h1: { buys: 100, sells: 50 },
                h6: { buys: 500, sells: 250 },
                h24: { buys: 2000, sells: 1000 }
              },
              volume: {
                h24: 123456.78,
                h6: 45678.90,
                h1: 12345.67,
                m5: 1234.56
              },
              priceChange: {
                m5: 2.5,
                h1: 5.0,
                h6: -3.2,
                h24: 10.5
              },
              liquidity: {
                usd: 500000.00,
                base: 1000000,
                quote: 2000000
              },
              fdv: 1000000.00,
              pairCreatedAt: 1700000000000
            }
          ]
        }
      }
    ],
    implementationNotes: 'Uses DexScreener API to get real-time price data from PulseX DEX',
    dataProcessing: 'Extracts priceUsd from first pair in response'
  },

  marketCap: {
    statId: 'marketCap',
    statName: 'Market Cap',
    endpoints: [
      {
        url: `${BLOCKSCOUT_BASE}/tokens/{address}`,
        method: 'GET',
        description: 'Get token supply'
      },
      {
        url: `${DEXSCREENER_BASE}/tokens/pulsechain/{address}`,
        method: 'GET',
        description: 'Get current price from DexScreener'
      }
    ],
    implementationNotes: 'Calculates: (total_supply / 10^decimals) * priceUsd',
    dataProcessing: 'Multiplies circulating supply by current USD price'
  },

  // TOKEN BALANCE
  tokenBalance: {
    statId: 'tokenBalance',
    statName: 'Token Balance',
    endpoints: [
      {
        url: `${BLOCKSCOUT_V1}?module=account&action=tokenbalance&contractaddress={tokenAddress}&address={walletAddress}`,
        method: 'GET',
        description: 'Get token balance for specific wallet (Blockscout V1 API)',
        parameters: {
          module: {
            type: 'string',
            required: true,
            description: 'API module',
            example: 'account'
          },
          action: {
            type: 'string',
            required: true,
            description: 'API action',
            example: 'tokenbalance'
          },
          contractaddress: {
            type: 'string',
            required: true,
            description: 'Token contract address',
            example: '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e'
          },
          address: {
            type: 'string',
            required: true,
            description: 'Wallet address to check',
            example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4'
          }
        },
        sampleResponse: {
          status: '1',
          message: 'OK',
          result: '1000000000000000000000'
        }
      },
      {
        url: `${BLOCKSCOUT_BASE}/tokens/{address}`,
        method: 'GET',
        description: 'Get token info for decimals'
      }
    ],
    implementationNotes: 'Uses Blockscout V1 API for balance, V2 for token info',
    dataProcessing: 'Divides result by 10^decimals to get human-readable balance'
  },

  // HOLDER DISTRIBUTION STATS
  top10Pct: {
    statId: 'top10Pct',
    statName: 'Top 10 Holdings',
    endpoints: [
      {
        url: `${BLOCKSCOUT_BASE}/tokens/{address}`,
        method: 'GET',
        description: 'Get token info for total supply'
      },
      {
        url: `${BLOCKSCOUT_BASE}/tokens/{address}/holders?limit=50`,
        method: 'GET',
        description: 'Get holders list (paginated, fetches multiple pages)'
      }
    ],
    implementationNotes: 'Fetches all holders, sorts by balance descending, sums top 10, calculates percentage',
    dataProcessing: 'Calculates: (sum of top 10 balances / total_supply) * 100'
  }
};

/**
 * Get all endpoints used by a stat
 */
export function getStatEndpoints(statId: string): ApiEndpoint[] {
  const mapping = getStatApiMapping(statId);
  return mapping?.endpoints || [];
}

/**
 * Generate documentation for a stat's API calls
 */
export function generateApiDocumentation(statId: string): string {
  const mapping = getStatApiMapping(statId);
  if (!mapping) {
    return 'API documentation not available for this stat.';
  }

  let doc = `# ${mapping.statName} API Documentation\n\n`;
  
  if (mapping.implementationNotes) {
    doc += `## Implementation\n${mapping.implementationNotes}\n\n`;
  }
  
  doc += `## API Endpoints\n\n`;
  doc += `This stat makes ${mapping.endpoints.length} API call${mapping.endpoints.length !== 1 ? 's' : ''}:\n\n`;
  
  mapping.endpoints.forEach((endpoint, index) => {
    doc += `### ${index + 1}. ${endpoint.description}\n\n`;
    doc += `\`\`\`\n${endpoint.method} ${endpoint.url}\n\`\`\`\n\n`;
    
    if (endpoint.parameters) {
      doc += `**Parameters:**\n`;
      Object.entries(endpoint.parameters).forEach(([key, param]) => {
        doc += `- \`${key}\` (${param.type})${param.required ? ' **required**' : ''}: ${param.description}\n`;
        doc += `  - Example: \`${param.example}\`\n`;
      });
      doc += '\n';
    }
    
    if (endpoint.sampleResponse) {
      doc += `**Sample Response:**\n\`\`\`json\n${JSON.stringify(endpoint.sampleResponse, null, 2)}\n\`\`\`\n\n`;
    }
  });
  
  if (mapping.dataProcessing) {
    doc += `## Data Processing\n${mapping.dataProcessing}\n\n`;
  }
  
  return doc;
}


