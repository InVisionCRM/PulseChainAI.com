import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';


// Initialize Google AI
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// API schema and scan data for context
const API_SCHEMA = `
Available API Endpoints:
- /search - Search for tokens, addresses, blocks, transactions
- /tokens/{address} - Get token information
- /tokens/{address}/holders - Get token holders
- /tokens/{address}/transfers - Get token transfers
- /addresses/{address} - Get address information
- /addresses/{address}/transactions - Get address transactions
- /addresses/{address}/token-balances - Get address token balances
- /transactions/{hash} - Get transaction details
- /blocks/{number} - Get block information
- /stats - Get network statistics
- /stats/charts/market - Get market chart data
- /smart-contracts/{address} - Get smart contract details
`;

const ANALYSIS_PROMPT = `
You are an expert blockchain analyst specializing in PulseChain data analysis. You have access to comprehensive real-time blockchain data through various API endpoints.

Your capabilities include:
1. Token Analysis: Real holder analysis, transfer patterns, live market data
2. Address Analysis: Live transaction history, current token portfolios, activity patterns
3. Transaction Analysis: Detailed transaction breakdowns, state changes, logs
4. Block Analysis: Block information, transactions, gas usage
5. Market Analysis: Live price data, volume analysis, market trends
6. Cross-Contract Analysis: Real holder overlap, correlation analysis
7. Whale Analysis: Large transaction tracking, whale movements
8. Historical Analysis: Price history, activity patterns over time

CRITICAL: You have access to REAL, LIVE blockchain data. You MUST ONLY analyze the actual data provided to you. NEVER make up numbers, addresses, or statistics. If no data is provided for a token, say "No data available" rather than making up information. Never mention simulation, mock data, or hypothetical scenarios.

When analyzing data:
- Provide clear, actionable insights based on real data
- Use specific numbers and percentages from the actual blockchain
- Identify patterns and anomalies in the real data
- Format responses with proper markdown
- Include relevant data visualizations when appropriate

Available data types (all real-time):
- Token holders and transfers
- Address balances and transactions
- Market prices and volumes
- Smart contract interactions
- Block and transaction details
- Historical data and trends

Always be accurate, informative, and helpful in your analysis using only real blockchain data.

FINAL INSTRUCTION: If you don't have real data for something, say "No data available" or "Unable to retrieve data" - NEVER make up numbers, addresses, or statistics. Only report what you can verify from the actual data provided.
`;

interface ContextItem {
  id: string;
  address: string;
  name: string;
  symbol?: string;
  type: 'token' | 'address' | 'contract';
  icon_url?: string | null;
}

interface AnalysisRequest {
  query: string;
  selectedEndpoints?: string[];
  contextItems?: ContextItem[];
  context?: {
    tokenAddress?: string;
    address?: string;
    transactionHash?: string;
    blockNumber?: string;
  };
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  step?: 'plan' | 'execute';
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalysisRequest = await request.json();
    const { query, selectedEndpoints, contextItems, context, history, step } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Get user API key if provided
    const userApiKey = request.headers.get('x-user-api-key');
    const apiKey = userApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    // Initialize AI with user's API key if provided
    const ai = userApiKey ? new GoogleGenAI({ apiKey: userApiKey }) : genAI;

    // Step 1: Analyze request and provide endpoint plan
    if (!step || step === 'plan') {
      const requiredEndpoints = await analyzeRequestForEndpoints(query, contextItems, ai);

      return NextResponse.json({
        step: 'plan',
        plan: requiredEndpoints,
        message: `I'll analyze your query: "${query}"

**Required API Endpoints:**
${requiredEndpoints.requiredEndpoints?.map(endpoint => `- ${endpoint}`).join('\n') || 'No specific endpoints determined'}

**Data Limits:**
- Token holders: Up to 1,000 holders per token
- Token transfers: Up to 500 transfers per token  
- Address transactions: Up to 500 transactions per address
- Search results: Up to 100 results per search
- Holder overlap analysis: Up to 1,000 holders per comparison

**Next Steps:**
1. Confirm these endpoints are correct for your analysis
2. I'll fetch the real blockchain data
3. Provide comprehensive analysis based on actual data

Would you like me to proceed with fetching this data?`
      });
    }

    // Step 2: Fetch data and provide analysis
    if (step === 'execute') {
      // Auto-determine required endpoints and fetch data
      const requiredEndpoints = await analyzeRequestForEndpoints(query, contextItems, ai);
      const fetchedData = await fetchDataFromEndpoints(query, requiredEndpoints.requiredEndpoints || [], contextItems);
      
      // Build analysis result with the fetched data
      const analysisResult = {
        data: fetchedData,
        endpoints: requiredEndpoints.requiredEndpoints || []
      };
      
      const prompt = buildAnalysisPrompt(query, analysisResult, history, contextItems);
      
      
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      const text = result.text;

      return NextResponse.json({ 
        step: 'complete',
        success: true,
        analysis: text,
        data: analysisResult.data,
        endpoints: analysisResult.endpoints,
        requiredEndpoints: requiredEndpoints
      });
    }

    return NextResponse.json({ error: 'Invalid step parameter' }, { status: 400 });

  } catch (error) {
    console.error('Blockchain analysis error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return NextResponse.json(
      { error: 'Failed to analyze blockchain data', details: error.message },
      { status: 500 }
    );
  }
}

// Step 1: AI analyzes request and determines required APIs
async function analyzeRequestForEndpoints(query: string, contextItems?: ContextItem[], ai?: any) {
  const prompt = `
You are an AI assistant that analyzes blockchain data requests and determines which API endpoints are needed to fulfill the request.

User Query: "${query}"

Available API Endpoints:
- /search - Search for tokens, addresses, or transactions
- /tokens/{address} - Get detailed token information
- /tokens/{address}/holders - Get token holders
- /tokens/{address}/transfers - Get token transfer history
- /addresses/{address} - Get address information
- /addresses/{address}/transactions - Get address transaction history
- /addresses/{address}/token-balances - Get address token balances
- /transactions/{hash} - Get transaction details
- /blocks/{number} - Get block information
- /stats - Get network statistics

Context Items (if any): ${contextItems ? JSON.stringify(contextItems) : 'None'}

Based on the user's query, determine which API endpoints should be called to gather the necessary data. 

IMPORTANT: Respond with ONLY a valid JSON object, no markdown, no code blocks, no explanations. The response must be parseable JSON.

Return this exact JSON structure:
{
  "requiredEndpoints": ["endpoint1", "endpoint2"],
  "reasoning": "brief explanation",
  "estimatedDataPoints": "what data will be gathered"
}

Focus on the most relevant endpoints for the specific request. Be selective and efficient.
`;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    const response = result.text.trim();
    
    // Clean the response to extract just the JSON
    let jsonResponse = response;
    if (response.includes('```json')) {
      jsonResponse = response.split('```json')[1].split('```')[0];
    } else if (response.includes('```')) {
      jsonResponse = response.split('```')[1];
    }
    
    // Parse the JSON response
    const parsed = JSON.parse(jsonResponse);
    
    return {
      requiredEndpoints: parsed.requiredEndpoints || [],
      reasoning: parsed.reasoning || '',
      estimatedDataPoints: parsed.estimatedDataPoints || '',
      query: query
    };
  } catch (error) {
    console.error('Error analyzing request for endpoints:', error);
    // Fallback to basic endpoint determination
    return {
      requiredEndpoints: ['search', 'token-info', 'token-holders'],
      reasoning: 'Fallback to basic token analysis endpoints',
      estimatedDataPoints: 'Token information and holder data',
      query: query
    };
  }
}

// Step 2: Fetch data from confirmed endpoints
async function fetchDataFromEndpoints(query: string, selectedEndpoints?: string[], contextItems?: ContextItem[]) {
  const data: any = {};
  
  if (!selectedEndpoints || selectedEndpoints.length === 0) {
    return { error: 'No endpoints selected for data fetching' };
  }

  // Extract token names from query
  const tokenNames = extractTokenNames(query);
  
  // First, search for tokens mentioned in the query (always do this to find tokens)
  const foundTokens: any[] = [];
  
  // Always search for tokens mentioned in the query, regardless of selected endpoints
  for (const tokenName of tokenNames) {
      try {
        // Call the API directly like the data sources menu does
        const searchUrl = `https://api.scan.pulsechain.com/api/v2/search?q=${encodeURIComponent(tokenName)}`;
        const searchResponse = await fetch(searchUrl);
        const searchResults = await searchResponse.json();
        
        if (searchResults && Array.isArray(searchResults) && searchResults.length > 0) {
          data[`search_${tokenName}`] = searchResults;
          const firstResult = searchResults[0];
          foundTokens.push({
            name: tokenName,
            address: firstResult.address,
            symbol: firstResult.symbol,
            type: 'token'
          });
        } else if (searchResults && searchResults.items && Array.isArray(searchResults.items) && searchResults.items.length > 0) {
          // Handle paginated response structure
          data[`search_${tokenName}`] = searchResults.items;
          const firstResult = searchResults.items[0];
          foundTokens.push({
            name: tokenName,
            address: firstResult.address,
            symbol: firstResult.symbol,
            type: 'token'
          });
        }
      } catch (error) {
        console.error(`Error searching for ${tokenName}:`, error);
      }
  }
  
  // Combine context items with found tokens
  const allTokens = [
    ...(contextItems || []),
    ...foundTokens
  ];
  
  
  // If we found tokens, make sure we have the necessary endpoints
  if (foundTokens.length > 0) {
    if (!selectedEndpoints.includes('search')) {
      selectedEndpoints.push('search');
    }
    if (!selectedEndpoints.includes('token-holders')) {
      selectedEndpoints.push('token-holders');
    }
  }
  
  for (const endpoint of selectedEndpoints) {
    try {
      switch (endpoint) {
        case 'search':
          // Already handled above
          break;
          
        case 'token-info':
          // Get token info for all tokens
          for (const item of allTokens) {
            if (item.type === 'token') {
              try {
                const tokenInfoUrl = `https://api.scan.pulsechain.com/api/v2/tokens/${item.address}`;
                const tokenInfoResponse = await fetch(tokenInfoUrl);
                const tokenInfo = await tokenInfoResponse.json();
                
                // Handle the correct data structure from the API
                if (tokenInfo && tokenInfo.items && tokenInfo.items.length > 0) {
                  data[`token_info_${item.symbol || item.name}`] = tokenInfo.items[0];
                } else {
                  data[`token_info_${item.symbol || item.name}`] = tokenInfo;
                }
              } catch (error) {
                console.error(`Error fetching token info for ${item.name}:`, error);
              }
            }
          }
          break;
          
        case 'token-holders':
          // Get token holders for all tokens with pagination to get 500+ holders
          for (const item of allTokens) {
            if (item.type === 'token') {
              try {
                const allHolders: any[] = [];
                let page = 1;
                const maxPages = 10; // Fetch up to 10 pages to get 500+ holders
                
                
                while (page <= maxPages) {
                  const holdersUrl = `https://api.scan.pulsechain.com/api/v2/tokens/${item.address}/holders?page=${page}&limit=200`;
                  
                  const holdersResponse = await fetch(holdersUrl);
                  
                  if (!holdersResponse.ok) {
                    break;
                  }
                  
                  const holders = await holdersResponse.json();
                  
                  let pageHolders: any[] = [];
                  
                  // Handle the correct data structure from the API
                  if (holders && Array.isArray(holders) && holders.length > 0) {
                    pageHolders = holders;
                  } else if (holders && holders.items && Array.isArray(holders.items) && holders.items.length > 0) {
                    pageHolders = holders.items;
                  } else if (holders && holders.data && Array.isArray(holders.data) && holders.data.length > 0) {
                    pageHolders = holders.data;
                  }
                  
                  if (pageHolders.length === 0) {
                    break;
                  }
                  
                  allHolders.push(...pageHolders);
                  
                  // If we got less than the limit, we've reached the end
                  if (pageHolders.length < 200) {
                    break;
                  }
                  
                  page++;
                }
                
                data[`token_holders_${item.symbol || item.name}`] = allHolders;
                
              } catch (error) {
                console.error(`Error fetching token holders for ${item.name}:`, error);
                data[`token_holders_${item.symbol || item.name}`] = [];
              }
            }
          }
          break;
          
        case 'token-transfers':
          // Get token transfers for all tokens
          for (const item of allTokens) {
            if (item.type === 'token') {
              try {
                const transfersUrl = `https://api.scan.pulsechain.com/api/v2/tokens/${item.address}/transfers?page=1&limit=1000`;
                const transfersResponse = await fetch(transfersUrl);
                const transfers = await transfersResponse.json();
                data[`token_transfers_${item.symbol || item.name}`] = transfers;
              } catch (error) {
                console.error(`Error fetching token transfers for ${item.name}:`, error);
              }
            }
          }
          break;
          
        case 'address-info':
          // Get address info for context items
          if (contextItems) {
            for (const item of contextItems) {
              if (item.type === 'address') {
                try {
                  const addressInfoUrl = `https://api.scan.pulsechain.com/api/v2/addresses/${item.address}`;
                  const addressInfoResponse = await fetch(addressInfoUrl);
                  const addressInfo = await addressInfoResponse.json();
                  data[`address_info_${item.name}`] = addressInfo;
                } catch (error) {
                  console.error(`Error fetching address info for ${item.name}:`, error);
                }
              }
            }
          }
          break;
          
        case 'network-stats':
          // Get network statistics
          try {
            const statsUrl = `https://api.scan.pulsechain.com/api/v2/stats`;
            const statsResponse = await fetch(statsUrl);
            const stats = await statsResponse.json();
            data.network_stats = stats;
          } catch (error) {
            console.error('Error fetching network stats:', error);
          }
          break;
      }
    } catch (error) {
      console.error(`Error fetching data from endpoint ${endpoint}:`, error);
    }
  }
  
  return data;
}

async function analyzeQuery(query: string, context?: any, selectedEndpoints?: string[], contextItems?: ContextItem[]) {
  const lowerQuery = query.toLowerCase();
  const data: any = {};
  const endpoints: string[] = [];


  // If specific endpoints are selected, only use those
  const shouldUseSelectedEndpoints = selectedEndpoints && selectedEndpoints.length > 0;

  // Helper function to check if an endpoint should be used
  const shouldUseEndpoint = (endpointId: string): boolean => {
    if (!shouldUseSelectedEndpoints) return true; // Use all endpoints if none selected
    return selectedEndpoints!.includes(endpointId);
  };

  // Helper function to add endpoint if allowed
  const addEndpointIfAllowed = (endpointId: string) => {
    if (shouldUseEndpoint(endpointId)) {
      endpoints.push(endpointId);
    }
  };

  // Map endpoint IDs to actual API endpoints
  const endpointMapping: Record<string, string> = {
    'search': '/search',
    'token-info': '/tokens/{address}',
    'token-holders': '/tokens/{address}/holders',
    'token-transfers': '/tokens/{address}/transfers',
    'address-info': '/addresses/{address}',
    'address-transactions': '/addresses/{address}/transactions',
    'address-token-balances': '/addresses/{address}/token-balances',
    'transaction-details': '/transactions/{hash}',
    'block-info': '/blocks/{number}',
    'network-stats': '/stats',
    'market-charts': '/stats/charts/market',
    'smart-contracts': '/smart-contracts/{address}'
  };

  try {
    // Process context items if provided
    if (contextItems && contextItems.length > 0) {
      data.contextItems = contextItems;
      
      // Fetch data for each context item
      for (const item of contextItems) {
        try {
          if (item.type === 'token') {
            // Get token info
            try {
              const tokenInfoUrl = `https://api.scan.pulsechain.com/api/v2/tokens/${item.address}`;
              const tokenInfoResponse = await fetch(tokenInfoUrl);
              const tokenInfo = await tokenInfoResponse.json();
              if (tokenInfo) {
                if (!data.contextTokens) data.contextTokens = {};
                data.contextTokens[item.symbol || item.name] = tokenInfo;
                addEndpointIfAllowed('token-info');
              }
            } catch (error) {
              // Token info not available, continue
            }

            // Get holders
            try {
                              const holdersUrl = `https://api.scan.pulsechain.com/api/v2/tokens/${item.address}/holders?page=1&limit=2000`;
              const holdersResponse = await fetch(holdersUrl);
              const holders = await holdersResponse.json();
              if (holders.length > 0) {
                if (!data.contextHolders) data.contextHolders = {};
                data.contextHolders[item.symbol || item.name] = holders;
                addEndpointIfAllowed('token-holders');
              }
            } catch (error) {
              // Holder data not available, continue
            }

            // Get transfers
            try {
                              const transfersUrl = `https://api.scan.pulsechain.com/api/v2/tokens/${item.address}/transfers?page=1&limit=1000`;
              const transfersResponse = await fetch(transfersUrl);
              const transfers = await transfersResponse.json();
              if (transfers.length > 0) {
                if (!data.contextTransfers) data.contextTransfers = {};
                data.contextTransfers[item.symbol || item.name] = transfers;
                addEndpointIfAllowed('token-transfers');
              }
            } catch (error) {
              // Transfer data not available, continue
            }
          } else if (item.type === 'address') {
            // Get address info
            try {
              const addressInfoUrl = `https://api.scan.pulsechain.com/api/v2/addresses/${item.address}`;
              const addressInfoResponse = await fetch(addressInfoUrl);
              const addressInfo = await addressInfoResponse.json();
              if (addressInfo) {
                if (!data.contextAddresses) data.contextAddresses = {};
                data.contextAddresses[item.address] = addressInfo;
                addEndpointIfAllowed('address-info');
              }
            } catch (error) {
              // Address info not available, continue
            }
          }
        } catch (error) {
          // Error processing context item, continue
        }
      }

      // Calculate correlations between context tokens if multiple tokens are provided
      const contextTokens = contextItems.filter(item => item.type === 'token');
      if (contextTokens.length >= 2) {
        try {
          const tokenAddresses = contextTokens.map(item => item.address);
          const overlaps = await calculateTokenOverlaps(tokenAddresses);
          data.contextTokenOverlaps = overlaps;
          addEndpointIfAllowed('token-holders');
        } catch (error) {
          // Error calculating token overlaps, continue
        }
      }
    }
    // Multi-entity queries (e.g., "Compare HEX, WPLS, and PLSX holders")
    if (lowerQuery.includes('compare') && (lowerQuery.includes('holders') || lowerQuery.includes('overlap'))) {
      const tokenNames = extractTokenNames(query);
      if (tokenNames.length >= 2) {
        try {
        data.multiTokenComparison = await analyzeMultipleTokens(tokenNames);
          addEndpointIfAllowed('search');
          addEndpointIfAllowed('token-holders');
        } catch (error) {
          // Error in multi-token comparison, continue
        }
      }
    }

    // Time-based filtering queries
    if (lowerQuery.includes('last week') || lowerQuery.includes('last month') || lowerQuery.includes('recent') || lowerQuery.includes('today')) {
      const timeFilter = extractTimeFilter(query);
      data.timeFilter = timeFilter;
      
      // Apply time filtering to existing data
      if (data.transfers) {
        data.transfers = filterByTime(data.transfers, timeFilter);
      }
      if (data.transactions) {
        data.transactions = filterByTime(data.transactions, timeFilter);
      }
    }

    // Advanced search queries (e.g., "Find addresses with >1000 HEX and >10000 WPLS")
    if (lowerQuery.includes('find addresses') || lowerQuery.includes('addresses with') || lowerQuery.includes('>')) {
      const searchCriteria = extractSearchCriteria(query);
      if (searchCriteria.length > 0) {
        try {
        data.advancedSearch = await performAdvancedSearch(searchCriteria);
          addEndpointIfAllowed('token-holders');
          addEndpointIfAllowed('address-token-balances');
        } catch (error) {
          // Error in advanced search, continue
        }
      }
    }

    // Token-related queries
    if (lowerQuery.includes('token') || lowerQuery.includes('holders') || lowerQuery.includes('hex') || lowerQuery.includes('wpls') || lowerQuery.includes('plsx')) {
      try {
      // Search for tokens using direct API call
      const searchUrl = `https://api.scan.pulsechain.com/api/v2/search?q=${encodeURIComponent(query)}`;
      const searchResponse = await fetch(searchUrl);
      const searchResults = await searchResponse.json();
      if (searchResults && Array.isArray(searchResults) && searchResults.length > 0) {
        data.searchResults = searchResults;
        addEndpointIfAllowed('search');
      } else if (searchResults && searchResults.items && Array.isArray(searchResults.items) && searchResults.items.length > 0) {
        // Handle paginated response structure
        data.searchResults = searchResults.items;
        addEndpointIfAllowed('search');

        // Get detailed token info for first result
          try {
        const tokenInfoUrl = `https://api.scan.pulsechain.com/api/v2/tokens/${searchResults[0].address}`;
        const tokenInfoResponse = await fetch(tokenInfoUrl);
        const tokenInfo = await tokenInfoResponse.json();
        
        // Handle the correct data structure from the API
        if (tokenInfo && tokenInfo.items && tokenInfo.items.length > 0) {
          data.tokenInfo = tokenInfo.items[0];
        } else {
        data.tokenInfo = tokenInfo;
        }
            addEndpointIfAllowed('token-info');
          } catch (error) {
            // Token info not available, continue
          }

        // Get holders if requested
        if (lowerQuery.includes('holders') || lowerQuery.includes('top')) {
            try {
                          const holdersUrl = `https://api.scan.pulsechain.com/api/v2/tokens/${searchResults[0].address}/holders?page=1&limit=2000`;
          const holdersResponse = await fetch(holdersUrl);
          const holders = await holdersResponse.json();
          
          // Handle the correct data structure from the API
          if (holders && holders.items) {
            data.holders = holders.items;
          } else {
          data.holders = holders;
          }
              addEndpointIfAllowed('token-holders');
            } catch (error) {
              // Holder data not available, continue
            }
        }

        // Get transfers if requested
        if (lowerQuery.includes('transactions') || lowerQuery.includes('transfers') || lowerQuery.includes('movement')) {
            try {
                          const transfersUrl = `https://api.scan.pulsechain.com/api/v2/tokens/${searchResults[0].address}/transfers?page=1&limit=1000`;
          const transfersResponse = await fetch(transfersUrl);
          const transfers = await transfersResponse.json();
          data.transfers = transfers;
              addEndpointIfAllowed('token-transfers');
            } catch (error) {
              // Transfer data not available, continue
            }
        }

        // Get market data if requested
        if (lowerQuery.includes('price') || lowerQuery.includes('market') || lowerQuery.includes('volume')) {
            try {
          const marketChartUrl = `https://api.scan.pulsechain.com/api/v2/charts/market`;
          const marketChartResponse = await fetch(marketChartUrl);
          const marketChart = await marketChartResponse.json();
          data.marketChart = marketChart;
              addEndpointIfAllowed('market-charts');
            } catch (error) {
              // Market chart data not available, continue
            }
        }
      }
      } catch (error) {
        // Error in token-related query processing, continue
      }
    }

    // Address-related queries
    if (lowerQuery.includes('address') || lowerQuery.includes('wallet') || lowerQuery.includes('0x')) {
      // Extract address from query or context
      const addressMatch = query.match(/0x[a-fA-F0-9]{40}/);
      const address = addressMatch?.[0] || context?.address;

      if (address) {
        try {
        const addressInfoUrl = `https://api.scan.pulsechain.com/api/v2/addresses/${address}`;
        const addressInfoResponse = await fetch(addressInfoUrl);
        const addressInfo = await addressInfoResponse.json();
        data.addressInfo = addressInfo;
          addEndpointIfAllowed('address-info');
        } catch (error) {
          console.log(`Address info not available for ${address}: ${error.message}`);
        }

        // Get token balances
        try {
        const tokenBalancesUrl = `https://api.scan.pulsechain.com/api/v2/addresses/${address}/token-balances`;
        const tokenBalancesResponse = await fetch(tokenBalancesUrl);
        const tokenBalances = await tokenBalancesResponse.json();
        data.tokenBalances = tokenBalances;
          addEndpointIfAllowed('address-token-balances');
        } catch (error) {
          console.log(`Token balances not available for ${address}: ${error.message}`);
        }

        // Get transactions if requested
        if (lowerQuery.includes('transactions') || lowerQuery.includes('activity')) {
          try {
                          const transactionsUrl = `https://api.scan.pulsechain.com/api/v2/addresses/${address}/transactions?page=1&limit=1000`;
          const transactionsResponse = await fetch(transactionsUrl);
          const transactions = await transactionsResponse.json();
          data.transactions = transactions;
            addEndpointIfAllowed('address-transactions');
          } catch (error) {
            console.log(`Transaction data not available for ${address}: ${error.message}`);
          }
        }
      }
    }

    // Transaction-related queries
    if (lowerQuery.includes('transaction') || lowerQuery.includes('tx') || lowerQuery.includes('hash')) {
      const txMatch = query.match(/0x[a-fA-F0-9]{64}/);
      const txHash = txMatch?.[0] || context?.transactionHash;

      if (txHash) {
        try {
        const transaction = await pulsechainApiService.getTransaction(txHash);
        data.transaction = transaction;
          addEndpointIfAllowed('transaction-details');
        } catch (error) {
          console.log(`Transaction data not available for ${txHash}: ${error.message}`);
        }

        // Get token transfers for this transaction
        try {
        const tokenTransfers = await pulsechainApiService.getTransactionTokenTransfers(txHash);
        data.tokenTransfers = tokenTransfers;
          addEndpointIfAllowed('token-transfers');
        } catch (error) {
          console.log(`Token transfer data not available for ${txHash}: ${error.message}`);
        }
      }
    }

    // Whale analysis
    if (lowerQuery.includes('whale') || lowerQuery.includes('large') || lowerQuery.includes('movement')) {
      if (data.tokenInfo) {
        try {
        const whaleMovements = await pulsechainApiService.getWhaleMovements(data.tokenInfo.address);
        data.whaleMovements = whaleMovements;
          addEndpointIfAllowed('token-transfers');
        } catch (error) {
          console.log(`Whale movement data not available for ${data.tokenInfo.address}: ${error.message}`);
        }
      }
    }

    // Correlation analysis
    if (lowerQuery.includes('correlation') || lowerQuery.includes('overlap') || lowerQuery.includes('compare')) {
      if (data.tokenInfo) {
        try {
        // For now, compare with WPLS as default
        const wplsAddress = '0xA1077a294dDE1B09bB078844df40758a5D0f9a27';
        const overlap = await pulsechainApiService.getHolderOverlap(data.tokenInfo.address, wplsAddress);
        data.holderOverlap = overlap;
          addEndpointIfAllowed('token-holders');
        } catch (error) {
          console.log(`Holder overlap data not available: ${error.message}`);
        }
      }
    }

    // Network statistics
    if (lowerQuery.includes('network') || lowerQuery.includes('stats') || lowerQuery.includes('total')) {
      try {
      const stats = await pulsechainApiService.getStats();
      data.networkStats = stats;
        addEndpointIfAllowed('network-stats');
      } catch (error) {
        console.log(`Network stats not available: ${error.message}`);
      }
    }

    // Historical analysis
    if (lowerQuery.includes('history') || lowerQuery.includes('trend') || lowerQuery.includes('chart')) {
      if (data.tokenInfo) {
        try {
        const priceHistory = await pulsechainApiService.getTokenPriceHistory(data.tokenInfo.address, 30);
        data.priceHistory = priceHistory;
          addEndpointIfAllowed('market-charts');
        } catch (error) {
          console.log(`Price history not available for ${data.tokenInfo.address}: ${error.message}`);
        }
      }
    }

  } catch (error) {
    console.error('Error fetching blockchain data:', error);
    data.error = 'Failed to fetch some data';
  }

  // Map endpoint IDs back to actual API endpoints
  const mappedEndpoints = endpoints.map(endpointId => endpointMapping[endpointId]).filter(Boolean);
  
  return { data, endpoints: mappedEndpoints };
}

// Helper functions for enhanced query processing

function extractTokenNames(query: string): string[] {
  const tokenPatterns = [
    /\b(HEX|WPLS|PLSX|INC|PULSE|PTGC|PSSH|PHEX)\b/gi,
    /\b([A-Z]{2,10})\b/g
  ];
  
  const tokens = new Set<string>();
  
  tokenPatterns.forEach(pattern => {
    const matches = query.match(pattern);
    if (matches) {
      matches.forEach(match => {
        if (match.length >= 2) {
          tokens.add(match.toUpperCase());
        }
      });
    }
  });
  
  
  return Array.from(tokens);
}

function extractTimeFilter(query: string): { type: string; days: number } {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('last week')) {
    return { type: 'days', days: 7 };
  } else if (lowerQuery.includes('last month')) {
    return { type: 'days', days: 30 };
  } else if (lowerQuery.includes('last 24 hours') || lowerQuery.includes('today')) {
    return { type: 'days', days: 1 };
  } else if (lowerQuery.includes('last 48 hours')) {
    return { type: 'days', days: 2 };
  } else if (lowerQuery.includes('last year')) {
    return { type: 'days', days: 365 };
  }
  
  // Default to last 7 days
  return { type: 'days', days: 7 };
}

function extractSearchCriteria(query: string): Array<{ token: string; minAmount: number; operator: string }> {
  const criteria: Array<{ token: string; minAmount: number; operator: string }> = [];
  
  // Pattern: >1000 HEX, >10000 WPLS, etc.
  const pattern = /([><=]+)\s*([0-9,]+)\s+(HEX|WPLS|PLSX|INC|PULSE|[A-Z]{3,10})/gi;
  const matches = query.matchAll(pattern);
  
  for (const match of matches) {
    const operator = match[1];
    const amount = parseInt(match[2].replace(/,/g, ''));
    const token = match[3].toUpperCase();
    
    criteria.push({
      token,
      minAmount: amount,
      operator
    });
  }
  
  return criteria;
}

function filterByTime<T extends { timestamp: string }>(items: T[], timeFilter: { type: string; days: number }): T[] {
  const now = Date.now();
  const timeThreshold = now - (timeFilter.days * 24 * 60 * 60 * 1000);
  
  return items.filter(item => {
    const itemTime = new Date(item.timestamp).getTime();
    return itemTime > timeThreshold;
  });
}

async function analyzeMultipleTokens(tokenNames: string[]) {
  const results: any = {};
  
  for (const tokenName of tokenNames) {
    try {
      // Search for token using direct API call
      const searchUrl = `https://api.scan.pulsechain.com/api/v2/search?q=${encodeURIComponent(tokenName)}`;
      const searchResponse = await fetch(searchUrl);
      const searchResults = await searchResponse.json();
      
      if (searchResults && Array.isArray(searchResults) && searchResults.length > 0) {
        const tokenAddress = searchResults[0].address;
        
        // Get token info and holders from direct API calls
        const tokenInfoUrl = `https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddress}`;
        const tokenInfoResponse = await fetch(tokenInfoUrl);
        const tokenInfo = await tokenInfoResponse.json();
        
                        const holdersUrl = `https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddress}/holders?page=1&limit=2000`;
        const holdersResponse = await fetch(holdersUrl);
        const holders = await holdersResponse.json();
        
        results[tokenName] = {
          info: tokenInfo,
          holders: holders,
          address: tokenAddress
        };
      }
    } catch (error) {
      console.error(`Error analyzing token ${tokenName}:`, error);
    }
  }
  
  // Calculate overlaps between tokens
  if (Object.keys(results).length >= 2) {
    const tokenAddresses = Object.values(results).map((r: any) => r.address);
    results.overlaps = await calculateTokenOverlaps(tokenAddresses);
  }
  
  return results;
}

async function calculateTokenOverlaps(tokenAddresses: string[]) {
  const overlaps: any = {};
  
  for (let i = 0; i < tokenAddresses.length; i++) {
    for (let j = i + 1; j < tokenAddresses.length; j++) {
      const token1 = tokenAddresses[i];
      const token2 = tokenAddresses[j];
      
      try {
        // Get holders for both tokens with pagination
        const fetchHoldersWithPagination = async (tokenAddress: string): Promise<any[]> => {
          const allHolders: any[] = [];
          let page = 1;
          const maxPages = 10; // Fetch up to 10 pages to get 500+ holders
          
          while (page <= maxPages) {
            const holdersUrl = `https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddress}/holders?page=${page}&limit=200`;
            const holdersResponse = await fetch(holdersUrl);
            
            if (!holdersResponse.ok) {
              break;
            }
            
            const holders = await holdersResponse.json();
            let pageHolders: any[] = [];
            
            if (holders && Array.isArray(holders) && holders.length > 0) {
              pageHolders = holders;
            } else if (holders && holders.items && Array.isArray(holders.items) && holders.items.length > 0) {
              pageHolders = holders.items;
            } else if (holders && holders.data && Array.isArray(holders.data) && holders.data.length > 0) {
              pageHolders = holders.data;
            }
            
            if (pageHolders.length === 0) {
              break;
            }
            
            allHolders.push(...pageHolders);
            
            if (pageHolders.length < 200) {
              break;
            }
            
            page++;
          }
          
          return allHolders;
        };
        
        const holders1 = await fetchHoldersWithPagination(token1);
        const holders2 = await fetchHoldersWithPagination(token2);
        
        // Calculate overlap
        const addresses1 = new Set(holders1.map((h: any) => h.address));
        const addresses2 = new Set(holders2.map((h: any) => h.address));
        const commonAddresses = [...addresses1].filter(addr => addresses2.has(addr));
        
        overlaps[`${token1}-${token2}`] = {
          token1Holders: holders1,
          token2Holders: holders2,
          overlap: commonAddresses,
          overlapPercentage: (commonAddresses.length / Math.max(holders1.length, holders2.length)) * 100
        };
      } catch (error) {
        console.error(`Error calculating overlap between ${token1} and ${token2}:`, error);
      }
    }
  }
  
  return overlaps;
}

async function performAdvancedSearch(criteria: Array<{ token: string; minAmount: number; operator: string }>) {
  const results: any = {};
  
  for (const criterion of criteria) {
    try {
      // Search for token using direct API call
      const searchUrl = `https://api.scan.pulsechain.com/api/v2/search?q=${encodeURIComponent(criterion.token)}`;
      const searchResponse = await fetch(searchUrl);
      const searchResults = await searchResponse.json();
      
      if (searchResults && Array.isArray(searchResults) && searchResults.length > 0) {
        const tokenAddress = searchResults[0].address;
        
        // Fetch holders with pagination
        const allHolders: any[] = [];
        let page = 1;
        const maxPages = 10; // Fetch up to 10 pages to get 500+ holders
        
        while (page <= maxPages) {
          const holdersUrl = `https://api.scan.pulsechain.com/api/v2/tokens/${tokenAddress}/holders?page=${page}&limit=200`;
          const holdersResponse = await fetch(holdersUrl);
          
          if (!holdersResponse.ok) {
            break;
          }
          
          const holders = await holdersResponse.json();
          let pageHolders: any[] = [];
          
          if (holders && Array.isArray(holders) && holders.length > 0) {
            pageHolders = holders;
          } else if (holders && holders.items && Array.isArray(holders.items) && holders.items.length > 0) {
            pageHolders = holders.items;
          } else if (holders && holders.data && Array.isArray(holders.data) && holders.data.length > 0) {
            pageHolders = holders.data;
          }
          
          if (pageHolders.length === 0) {
            break;
          }
          
          allHolders.push(...pageHolders);
          
          if (pageHolders.length < 200) {
            break;
          }
          
          page++;
        }
        
        const holders = allHolders;
        
        // Filter holders based on criteria
        const filteredHolders = holders.filter(holder => {
          const amount = parseFloat(holder.value);
          switch (criterion.operator) {
            case '>':
              return amount > criterion.minAmount;
            case '<':
              return amount < criterion.minAmount;
            case '>=':
              return amount >= criterion.minAmount;
            case '<=':
              return amount <= criterion.minAmount;
            case '=':
              return amount === criterion.minAmount;
            default:
              return amount > criterion.minAmount;
          }
        });
        
        results[criterion.token] = {
          tokenInfo: searchResults[0],
          filteredHolders: filteredHolders,
          totalHolders: holders.length,
          matchingHolders: filteredHolders.length
        };
      }
    } catch (error) {
      console.error(`Error in advanced search for ${criterion.token}:`, error);
    }
  }
  
  return results;
}

function buildAnalysisPrompt(query: string, analysisResult: any, history?: any[], contextItems?: ContextItem[]) {
  let prompt = ANALYSIS_PROMPT + '\n\n';

  // Add conversation history if available
  if (history && history.length > 0) {
    prompt += 'Previous conversation:\n';
    history.forEach(msg => {
      prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
    });
    prompt += '\n';
  }

  // Add context items if provided
  if (contextItems && contextItems.length > 0) {
    prompt += 'Context Items (pre-loaded for analysis):\n';
    contextItems.forEach(item => {
      prompt += `- ${item.name} (${item.symbol || 'N/A'}) - ${item.type}: ${item.address}\n`;
    });
    prompt += '\n';
  }

  // Add current query
  prompt += `User Query: "${query}"\n\n`;

  // Add available data in a simple, readable format
  prompt += 'Available Blockchain Data:\n\n';
  
  // Handle fetched data structure
  const data = analysisResult.data;
  
  // Search results
  Object.keys(data).forEach(key => {
    if (key.startsWith('search_')) {
      const tokenName = key.replace('search_', '');
      const searchResults = data[key];
      if (Array.isArray(searchResults) && searchResults.length > 0) {
        prompt += `## Search Results for ${tokenName}:\n`;
        prompt += `- Total results found: ${searchResults.length}\n`;
        prompt += `- Using FIRST result for analysis:\n`;
        const firstResult = searchResults[0];
        prompt += `  1. ${firstResult.name || firstResult.symbol || 'Unknown'} (${firstResult.address})\n`;
        if (firstResult.symbol) prompt += `     Symbol: ${firstResult.symbol}\n`;
        if (firstResult.type) prompt += `     Type: ${firstResult.type}\n`;
        if (searchResults.length > 1) {
          prompt += `  Note: ${searchResults.length - 1} additional results available but using first match\n`;
        }
        prompt += '\n';
      }
    }
  });
  
  // Token info
  Object.keys(data).forEach(key => {
    if (key.startsWith('token_info_')) {
      const tokenName = key.replace('token_info_', '');
      const tokenInfo = data[key];
      if (tokenInfo) {
        prompt += `## Token Information for ${tokenName}:\n`;
        prompt += `- Name: ${tokenInfo.name || 'Unknown'}\n`;
        prompt += `- Symbol: ${tokenInfo.symbol || 'N/A'}\n`;
        prompt += `- Address: ${tokenInfo.address || 'N/A'}\n`;
        prompt += `- Total Supply: ${tokenInfo.total_supply || 'N/A'}\n`;
        prompt += `- Decimals: ${tokenInfo.decimals || 'N/A'}\n`;
        if (tokenInfo.holders) prompt += `- Total Holders: ${tokenInfo.holders}\n`;
        if (tokenInfo.circulating_market_cap) prompt += `- Market Cap: ${tokenInfo.circulating_market_cap}\n`;
        prompt += '\n';
      }
    }
  });
  
  // Token holders
  Object.keys(data).forEach(key => {
    if (key.startsWith('token_holders_')) {
      const tokenName = key.replace('token_holders_', '');
      const holders = data[key];
      if (Array.isArray(holders) && holders.length > 0) {
        prompt += `## Token Holders for ${tokenName}:\n`;
        prompt += `- Total Holders Found: ${holders.length}\n`;
        prompt += `- Top Holders:\n`;
                        holders.slice(0, 10).forEach((holder: any, index: number) => {
          const address = holder.address?.hash || holder.address || 'Unknown';
          const value = holder.value || '0';
          prompt += `  ${index + 1}. ${address}: ${value}\n`;
        });
        if (holders.length > 5) {
          prompt += `  ... and ${holders.length - 5} more holders\n`;
        }
        prompt += '\n';
      }
    }
  });
  
  // Token transfers
  Object.keys(data).forEach(key => {
    if (key.startsWith('token_transfers_')) {
      const tokenName = key.replace('token_transfers_', '');
      const transfers = data[key];
      if (Array.isArray(transfers) && transfers.length > 0) {
        prompt += `## Token Transfers for ${tokenName}:\n`;
        prompt += `- Total Transfers Found: ${transfers.length}\n`;
        prompt += `- Recent Transfers:\n`;
                        transfers.slice(0, 6).forEach((transfer: any, index: number) => {
          prompt += `  ${index + 1}. From: ${transfer.from || 'Unknown'}\n`;
          prompt += `     To: ${transfer.to || 'Unknown'}\n`;
          prompt += `     Value: ${transfer.value || '0'}\n`;
          if (transfer.timestamp) prompt += `     Time: ${transfer.timestamp}\n`;
        });
        if (transfers.length > 3) {
          prompt += `  ... and ${transfers.length - 3} more transfers\n`;
        }
        prompt += '\n';
      }
    }
  });
  
  // Address info
  Object.keys(data).forEach(key => {
    if (key.startsWith('address_info_')) {
      const addressName = key.replace('address_info_', '');
      const addressInfo = data[key];
      if (addressInfo) {
        prompt += `## Address Information for ${addressName}:\n`;
        prompt += `- Address: ${addressInfo.hash || 'N/A'}\n`;
        prompt += `- Is Contract: ${addressInfo.is_contract ? 'Yes' : 'No'}\n`;
        if (addressInfo.name) prompt += `- Name: ${addressInfo.name}\n`;
        if (addressInfo.coin_balance) prompt += `- PLS Balance: ${addressInfo.coin_balance}\n`;
        prompt += '\n';
      }
    }
  });
  
  // Network stats
  if (data.network_stats) {
    prompt += `- Network Stats: ${data.network_stats.total_transactions || 0} total transactions\n`;
  }
  
  // Legacy data structure support
  if (data.searchResults) {
    prompt += `- Search Results: ${data.searchResults.length} items found\n`;
  }
  if (data.tokenInfo) {
    prompt += `- Token Info: ${data.tokenInfo.name} (${data.tokenInfo.symbol})\n`;
  }
  if (data.holders) {
    prompt += `- Holders: ${data.holders.length} holders\n`;
  }
  if (data.transfers) {
    prompt += `- Transfers: ${data.transfers.length} recent transfers\n`;
  }
  if (data.addressInfo) {
    prompt += `- Address Info: ${data.addressInfo.hash}\n`;
  }
  if (data.transaction) {
    prompt += `- Transaction: ${data.transaction.hash}\n`;
  }
  if (data.whaleMovements) {
    prompt += `- Whale Movements: ${data.whaleMovements.whaleCount} whales, $${data.whaleMovements.totalVolume} volume\n`;
  }
  if (data.holderOverlap) {
    prompt += `- Holder Overlap: ${data.holderOverlap.overlapPercentage.toFixed(1)}% overlap\n`;
  }
  
  // Context items data
  if (data.contextTokens) {
    const tokenCount = Object.keys(data.contextTokens).length;
    prompt += `- Context Tokens: ${tokenCount} tokens with detailed data\n`;
  }
  if (data.contextHolders) {
    const holderCount = Object.keys(data.contextHolders).length;
    prompt += `- Context Holders: ${holderCount} tokens with holder data\n`;
  }
  if (data.contextTransfers) {
    const transferCount = Object.keys(data.contextTransfers).length;
    prompt += `- Context Transfers: ${transferCount} tokens with transfer data\n`;
  }
  if (data.contextAddresses) {
    const addressCount = Object.keys(data.contextAddresses).length;
    prompt += `- Context Addresses: ${addressCount} addresses with detailed data\n`;
  }
  if (data.contextTokenOverlaps) {
    prompt += `- Context Token Overlaps: Correlation data between context tokens\n`;
  }
  
  // Enhanced data types
  if (data.multiTokenComparison) {
    const tokenCount = Object.keys(data.multiTokenComparison).filter(key => key !== 'overlaps').length;
    prompt += `- Multi-Token Comparison: ${tokenCount} tokens analyzed\n`;
  }
  if (data.timeFilter) {
    prompt += `- Time Filter: Last ${data.timeFilter.days} days\n`;
  }
  if (data.advancedSearch) {
    const searchCount = Object.keys(data.advancedSearch).length;
    prompt += `- Advanced Search: ${searchCount} criteria applied\n`;
  }

  prompt += '\nAPI Endpoints Used: ' + analysisResult.endpoints.join(', ') + '\n\n';

  // Add detailed data for analysis
  prompt += 'Detailed Data:\n';
  prompt += JSON.stringify(analysisResult.data, null, 2);

  prompt += '\n\nPlease provide a comprehensive analysis based on the available data. Focus on insights, patterns, and actionable information.';

  return prompt;
} 