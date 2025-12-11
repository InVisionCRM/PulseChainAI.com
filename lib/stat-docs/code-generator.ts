// Generate code examples for stat API calls in multiple languages

import { StatParameter, generateQueryString } from './parameter-detector';
import { getStatApiMapping, type ApiEndpoint } from './api-endpoint-mapping';

export interface CodeExamples {
  curl: string;
  javascript: string;
  typescript: string;
  python: string;
}

/**
 * Generates code examples for all supported languages using REAL API endpoints
 */
export function generateCodeExamples(
  statId: string,
  statName: string,
  parameters: StatParameter[],
  baseUrl: string = 'https://yourdomain.com'
): CodeExamples {
  // Get real API mapping if available
  const apiMapping = getStatApiMapping(statId);
  
  if (apiMapping && apiMapping.endpoints.length > 0) {
    // Use real external API endpoints
    return {
      curl: generateRealCurlExample(apiMapping.endpoints, parameters),
      javascript: generateRealJavaScriptExample(apiMapping, parameters),
      typescript: generateRealTypeScriptExample(apiMapping, parameters),
      python: generateRealPythonExample(apiMapping.endpoints, parameters, apiMapping.statId)
    };
  }
  
  // Fallback to wrapper API if no mapping exists
  const exampleParams: Record<string, string> = {};
  parameters.forEach(param => {
    exampleParams[param.key] = param.example;
  });
  
  const queryString = generateQueryString(exampleParams);
  const fullUrl = `${baseUrl}/api/stats/${statId}?${queryString}`;
  
  return {
    curl: generateCurlExample(fullUrl),
    javascript: generateJavaScriptExample(statId, exampleParams, baseUrl),
    typescript: generateTypeScriptExample(statId, statName, exampleParams, baseUrl),
    python: generatePythonExample(fullUrl)
  };
}

/**
 * Generate cURL example
 */
function generateCurlExample(fullUrl: string): string {
  return `curl --request GET \\
  --url '${fullUrl}' \\
  --header 'accept: application/json'`;
}

/**
 * Generate JavaScript/Node.js example
 */
function generateJavaScriptExample(
  statId: string,
  params: Record<string, string>,
  baseUrl: string
): string {
  const queryString = generateQueryString(params);
  
  return `// Using fetch API
const response = await fetch(
  '${baseUrl}/api/stats/${statId}?${queryString}',
  {
    method: 'GET',
    headers: {
      'accept': 'application/json'
    }
  }
);

const data = await response.json();
console.log('Formatted Value:', data.formattedValue);
console.log('Raw Value:', data.value);

// Full response structure:
// {
//   value: any,              // Raw stat value
//   formattedValue: string,  // Human-readable formatted value
//   lastUpdated: Date,       // Timestamp of data retrieval
//   source: string,          // Data source (e.g., "pulsechain")
//   error?: string           // Error message if request failed
// }`;
}

/**
 * Generate TypeScript example with proper typing
 */
function generateTypeScriptExample(
  statId: string,
  statName: string,
  params: Record<string, string>,
  baseUrl: string
): string {
  const queryString = generateQueryString(params);
  
  return `// TypeScript example with type safety
interface StatResult {
  value: any;
  formattedValue: string;
  lastUpdated: Date;
  source: string;
  error?: string;
}

async function get${toPascalCase(statId)}(
  ${Object.keys(params).map(key => `${key}: string`).join(',\n  ')}
): Promise<StatResult> {
  const params = new URLSearchParams({
    ${Object.keys(params).map(key => `${key}`).join(',\n    ')}
  });
  
  const response = await fetch(
    \`${baseUrl}/api/stats/${statId}?\${params}\`,
    {
      method: 'GET',
      headers: {
        'accept': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }
  
  return await response.json();
}

// Usage
const result = await get${toPascalCase(statId)}(
  ${Object.entries(params).map(([key, val]) => `'${val}'`).join(',\n  ')}
);

console.log('${statName}:', result.formattedValue);`;
}

/**
 * Generate Python example
 */
function generatePythonExample(fullUrl: string): string {
  return `import requests
import json

# Make the API request
response = requests.get(
    '${fullUrl}',
    headers={'accept': 'application/json'}
)

# Check if request was successful
if response.status_code == 200:
    data = response.json()
    print('Formatted Value:', data['formattedValue'])
    print('Raw Value:', data['value'])
    print('Source:', data['source'])
    print('Last Updated:', data['lastUpdated'])
else:
    print(f'Error: {response.status_code}')
    print(response.text)

# Full response structure:
# {
#   "value": any,              # Raw stat value
#   "formattedValue": str,     # Human-readable formatted value
#   "lastUpdated": str,        # ISO timestamp of data retrieval
#   "source": str,             # Data source (e.g., "pulsechain")
#   "error": str (optional)    # Error message if request failed
# }`;
}

/**
 * Generate cURL example using REAL API endpoints
 */
function generateRealCurlExample(endpoints: ApiEndpoint[], parameters: StatParameter[]): string {
  const tokenAddress = parameters.find(p => p.key === 'address')?.example || '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e';
  const walletAddress = parameters.find(p => p.key === 'walletAddress')?.example;
  
  let curl = `# This stat makes ${endpoints.length} API call${endpoints.length !== 1 ? 's' : ''}:\n\n`;
  
  endpoints.forEach((endpoint, index) => {
    const url = endpoint.url.replace('{address}', tokenAddress).replace('{tokenAddress}', tokenAddress).replace('{walletAddress}', walletAddress || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4');
    
    curl += `# ${index + 1}. ${endpoint.description}\n`;
    curl += `curl --request ${endpoint.method} \\\n`;
    curl += `  --url '${url}' \\\n`;
    curl += `  --header 'accept: application/json'`;
    
    if (index < endpoints.length - 1) {
      curl += '\n\n';
    }
  });
  
  return curl;
}

/**
 * Generate JavaScript example using REAL API endpoints - ONE complete executable function
 */
function generateRealJavaScriptExample(mapping: any, parameters: StatParameter[]): string {
  const tokenAddress = parameters.find(p => p.key === 'address')?.example || '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e';
  const walletAddress = parameters.find(p => p.key === 'walletAddress')?.example;
  
  // Generate based on specific stat implementation
  return generateCompleteJavaScriptForStat(mapping.statId, tokenAddress, walletAddress);
}

/**
 * Generate complete, working JavaScript for specific stats
 */
function generateCompleteJavaScriptForStat(statId: string, tokenAddress: string, walletAddress?: string): string {
  // TOTAL SUPPLY
  if (statId === 'totalSupply') {
    return `async function getTotalSupply(tokenAddress) {
  try {
    const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!response.ok) throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
    
    const data = await response.json();
    const totalSupply = data.total_supply;
    const decimals = Number(data.decimals || 18);
    const readableSupply = Number(totalSupply) / Math.pow(10, decimals);
    
    return {
      raw: totalSupply,
      decimals: decimals,
      formatted: readableSupply.toLocaleString()
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getTotalSupply('${tokenAddress}').then(console.log);`;
  }
  
  // HOLDERS
  if (statId === 'holders') {
    return `async function getHolders(tokenAddress) {
  try {
    const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/counters\`, {
      headers: { 'accept': 'application/json' }
    });
    
    if (response.ok) {
      const counters = await response.json();
      if (counters.token_holders_count) {
        return {
          count: Number(counters.token_holders_count),
          formatted: Number(counters.token_holders_count).toLocaleString(),
          source: 'counters'
        };
      }
    }
    
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    
    const tokenData = await tokenResponse.json();
    const holdersCount = Number(tokenData.holders || 0);
    
    return {
      count: holdersCount,
      formatted: holdersCount.toLocaleString(),
      source: 'token_info'
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getHolders('${tokenAddress}').then(console.log);`;
  }
  
  // BURNED 24H
  if (statId === 'burned24h') {
    return `async function getBurned24h(tokenAddress) {
  try {
    const BURN_ADDRESSES = [
      '0x000000000000000000000000000000000000dead',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000369',
      '0x000000000000000000000000000000000000dead'
    ].map(addr => addr.toLowerCase());
    
    // Step 1: Get token info
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    
    const decimals = Number(tokenData.decimals || 18);
    const totalSupply = Number(tokenData.total_supply || 0);
    
    // Step 2: Get transfers from last 24 hours (paginated)
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let allTransfers = [];
    let nextParams = null;
    let page = 0;
    const maxPages = 50;
    
    while (page < maxPages) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, value));
      }
      
      const transfersResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/transfers?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!transfersResponse.ok) throw new Error(\`HTTP \${transfersResponse.status}\`);
      
      const transfersData = await transfersResponse.json();
      const items = transfersData.items || [];
      
      if (items.length === 0) break;
      
      // Filter transfers within 24h
      for (const transfer of items) {
        if (transfer.timestamp && transfer.timestamp >= cutoff24h) {
          allTransfers.push(transfer);
        }
      }
      
      // Check if we've gone past 24h
      const lastTimestamp = items[items.length - 1]?.timestamp;
      if (lastTimestamp && lastTimestamp < cutoff24h) break;
      
      if (!transfersData.next_page_params) break;
      nextParams = transfersData.next_page_params;
      page++;
    }
    
    // Step 3: Filter for transfers TO burn addresses and sum
    let totalBurned = 0;
    for (const transfer of allTransfers) {
      const toAddress = transfer.to?.hash?.toLowerCase();
      if (toAddress && BURN_ADDRESSES.includes(toAddress)) {
        totalBurned += Number(transfer.total?.value || 0);
      }
    }
    
    const burnedReadable = totalBurned / Math.pow(10, decimals);
    const burnedPercent = totalSupply > 0 ? (totalBurned / totalSupply) * 100 : 0;
    
    return {
      raw: totalBurned,
      readable: burnedReadable,
      formatted: burnedReadable.toLocaleString(),
      percent: burnedPercent,
      percentFormatted: \`\${burnedPercent.toFixed(2)}%\`,
      transferCount: allTransfers.filter(t => BURN_ADDRESSES.includes(t.to?.hash?.toLowerCase())).length
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getBurned24h('${tokenAddress}').then(console.log);`;
  }
  
  // MINTED 24H
  if (statId === 'minted24h') {
    return `async function getMinted24h(tokenAddress) {
  try {
    // Step 1: Get token info
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    
    const decimals = Number(tokenData.decimals || 18);
    
    // Step 2: Get transfers from last 24 hours (paginated)
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let allTransfers = [];
    let nextParams = null;
    let page = 0;
    const maxPages = 50;
    
    while (page < maxPages) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, value));
      }
      
      const transfersResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/transfers?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!transfersResponse.ok) throw new Error(\`HTTP \${transfersResponse.status}\`);
      
      const transfersData = await transfersResponse.json();
      const items = transfersData.items || [];
      
      if (items.length === 0) break;
      
      // Filter transfers within 24h
      for (const transfer of items) {
        if (transfer.timestamp && transfer.timestamp >= cutoff24h) {
          allTransfers.push(transfer);
        }
      }
      
      // Check if we've gone past 24h
      const lastTimestamp = items[items.length - 1]?.timestamp;
      if (lastTimestamp && lastTimestamp < cutoff24h) break;
      
      if (!transfersData.next_page_params) break;
      nextParams = transfersData.next_page_params;
      page++;
    }
    
    // Step 3: Filter for mints (transfers FROM token contract itself) and sum
    let totalMinted = 0;
    for (const transfer of allTransfers) {
      const fromAddress = transfer.from?.hash?.toLowerCase();
      if (fromAddress === tokenAddress.toLowerCase()) {
        totalMinted += Number(transfer.total?.value || 0);
      }
    }
    
    const mintedReadable = totalMinted / Math.pow(10, decimals);
    
    return {
      raw: totalMinted,
      readable: mintedReadable,
      formatted: mintedReadable.toLocaleString(),
      transferCount: allTransfers.filter(t => t.from?.hash?.toLowerCase() === tokenAddress.toLowerCase()).length
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getMinted24h('${tokenAddress}').then(console.log);`;
  }
  
  // BURNED TOTAL
  if (statId === 'burnedTotal') {
    return `async function getBurnedTotal(tokenAddress) {
  try {
    const BURN_ADDRESSES = [
      '0x000000000000000000000000000000000000dead',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000369',
      '0x000000000000000000000000000000000000dead'
    ].map(addr => addr.toLowerCase());
    
    // Step 1: Get token info
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    
    const decimals = Number(tokenData.decimals || 18);
    const totalSupply = Number(tokenData.total_supply || 0);
    
    // Step 2: Get all holders (paginated)
    let allHolders = [];
    let nextParams = null;
    let page = 0;
    const maxPages = 200;
    
    while (page < maxPages) {
      const params = new URLSearchParams({ limit: '50' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, value));
      }
      
      const holdersResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/holders?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!holdersResponse.ok) throw new Error(\`HTTP \${holdersResponse.status}\`);
      
      const holdersData = await holdersResponse.json();
      const items = holdersData.items || [];
      
      for (const item of items) {
        allHolders.push({
          address: item.address?.hash,
          value: item.value
        });
      }
      
      if (!holdersData.next_page_params) break;
      nextParams = holdersData.next_page_params;
      page++;
    }
    
    // Step 3: Find ALL burn/dead addresses and sum their balances
    let totalBurnedRaw = 0;
    for (const holder of allHolders) {
      if (holder.address && BURN_ADDRESSES.includes(holder.address.toLowerCase())) {
        totalBurnedRaw += Number(holder.value || 0);
      }
    }
    
    const burnedReadable = totalBurnedRaw / Math.pow(10, decimals);
    const burnedPercent = totalSupply > 0 ? (totalBurnedRaw / totalSupply) * 100 : 0;
    
    return {
      raw: totalBurnedRaw,
      readable: burnedReadable,
      formatted: burnedReadable.toLocaleString(),
      percent: burnedPercent,
      percentFormatted: \`\${burnedPercent.toFixed(2)}%\`
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getBurnedTotal('${tokenAddress}').then(console.log);`;
  }
  
  // HOLDER DISTRIBUTION STATS (top1Pct, top10Pct, top20Pct, top50Pct)
  if (statId === 'top1Pct' || statId === 'top10Pct' || statId === 'top20Pct' || statId === 'top50Pct') {
    const topCounts = { top1Pct: 1, top10Pct: 10, top20Pct: 20, top50Pct: 50 };
    const topCount = topCounts[statId as keyof typeof topCounts];
    return `async function get${toPascalCase(statId)}(tokenAddress) {
  try {
    // Step 1: Get token info for total supply
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const totalSupply = Number(tokenData.total_supply || 0);
    
    // Step 2: Get all holders (paginated)
    let allHolders = [];
    let nextParams = null;
    let page = 0;
    const maxPages = 200;
    
    while (page < maxPages) {
      const params = new URLSearchParams({ limit: '50' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, value));
      }
      
      const holdersResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/holders?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!holdersResponse.ok) throw new Error(\`HTTP \${holdersResponse.status}\`);
      
      const holdersData = await holdersResponse.json();
      const items = holdersData.items || [];
      
      for (const item of items) {
        allHolders.push({
          address: item.address?.hash,
          value: Number(item.value || 0)
        });
      }
      
      if (!holdersData.next_page_params) break;
      nextParams = holdersData.next_page_params;
      page++;
    }
    
    // Step 3: Sort by value descending and take top ${topCount}
    allHolders.sort((a, b) => b.value - a.value);
    const topHolders = allHolders.slice(0, ${topCount});
    const topSum = topHolders.reduce((sum, h) => sum + h.value, 0);
    const percentage = totalSupply > 0 ? (topSum / totalSupply) * 100 : 0;
    
    return {
      percentage: percentage,
      formatted: \`\${percentage.toFixed(2)}%\`,
      topHolderCount: ${topCount},
      totalHolders: allHolders.length
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// get${toPascalCase(statId)}('${tokenAddress}').then(console.log);`;
  }
  
  // SIMPLE METADATA STATS (address, symbol, name)
  if (statId === 'address') {
    return `async function getAddress(tokenAddress) {
  // Token address is just the input parameter
  return {
    address: tokenAddress,
    formatted: tokenAddress
  };
}

// Usage:
// getAddress('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'symbol') {
    return `async function getSymbol(tokenAddress) {
  try {
    const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
    
    const data = await response.json();
    return {
      symbol: data.symbol,
      name: data.name
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getSymbol('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'name') {
    return `async function getName(tokenAddress) {
  try {
    const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
    
    const data = await response.json();
    return {
      name: data.name,
      symbol: data.symbol
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getName('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'iconUrl') {
    return `async function getIconUrl(tokenAddress) {
  try {
    // Try DexScreener first
    const dexResponse = await fetch(\`https://api.dexscreener.com/latest/dex/tokens/\${tokenAddress}\`);
    if (dexResponse.ok) {
      const dexData = await dexResponse.json();
      const iconUrl = dexData.pairs?.[0]?.info?.imageUrl;
      if (iconUrl) {
        return { iconUrl, source: 'dexscreener' };
      }
    }
    
    // Fallback to Blockscout
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    
    const tokenData = await tokenResponse.json();
    return {
      iconUrl: tokenData.icon_url,
      source: 'blockscout'
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getIconUrl('${tokenAddress}').then(console.log);`;
  }
  
  // TRANSFER STATS
  if (statId === 'transfersTotal') {
    return `async function getTransfersTotal(tokenAddress) {
  try {
    const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/counters\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
    
    const data = await response.json();
    const transfersCount = Number(data.transfers_count || 0);
    
    return {
      count: transfersCount,
      formatted: transfersCount.toLocaleString()
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getTransfersTotal('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'transfers24h') {
    return `async function getTransfers24h(tokenAddress) {
  try {
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let transferCount = 0;
    let nextParams = null;
    let page = 0;
    const maxPages = 50;
    
    while (page < maxPages) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, value));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/transfers?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      
      if (items.length === 0) break;
      
      // Count transfers within 24h
      for (const transfer of items) {
        if (transfer.timestamp && transfer.timestamp >= cutoff24h) {
          transferCount++;
        }
      }
      
      // Check if we've gone past 24h
      const lastTimestamp = items[items.length - 1]?.timestamp;
      if (lastTimestamp && lastTimestamp < cutoff24h) break;
      
      if (!data.next_page_params) break;
      nextParams = data.next_page_params;
      page++;
    }
    
    return {
      count: transferCount,
      formatted: transferCount.toLocaleString()
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getTransfers24h('${tokenAddress}').then(console.log);`;
  }
  
  // MARKET & LIQUIDITY STATS (DexScreener)
  if (statId === 'priceUsd') {
    return `async function getPriceUsd(tokenAddress) {
  try {
    const response = await fetch(\`https://api.dexscreener.com/latest/dex/tokens/\${tokenAddress}\`);
    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
    
    const data = await response.json();
    const priceUsd = data.pairs?.[0]?.priceUsd;
    
    return {
      priceUsd: priceUsd ? parseFloat(priceUsd) : null,
      formatted: priceUsd ? \`$\${parseFloat(priceUsd).toFixed(6)}\` : 'N/A'
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getPriceUsd('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'liquidityUsd') {
    return `async function getLiquidityUsd(tokenAddress) {
  try {
    const response = await fetch(\`https://api.dexscreener.com/latest/dex/tokens/\${tokenAddress}\`);
    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
    
    const data = await response.json();
    const liquidityUsd = Number(data.pairs?.[0]?.liquidity?.usd || 0);
    
    return {
      liquidityUsd: liquidityUsd,
      formatted: \`$\${liquidityUsd.toLocaleString()}\`
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getLiquidityUsd('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'totalLiquidityUsd') {
    return `async function getTotalLiquidityUsd(tokenAddress) {
  try {
    const response = await fetch(\`https://api.dexscreener.com/latest/dex/tokens/\${tokenAddress}\`);
    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
    
    const data = await response.json();
    const pairs = data.pairs || [];
    const totalLiquidityUsd = pairs.reduce((sum, pair) => sum + Number(pair?.liquidity?.usd || 0), 0);
    
    return {
      totalLiquidityUsd: totalLiquidityUsd,
      formatted: \`$\${totalLiquidityUsd.toLocaleString()}\`,
      pairCount: pairs.length
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getTotalLiquidityUsd('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'totalTokensInLiquidity') {
    return `async function getTotalTokensInLiquidity(tokenAddress) {
  try {
    // Get token decimals from Blockscout
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const decimals = Number(tokenData.decimals || 18);
    
    // Get liquidity data from DexScreener
    const dexResponse = await fetch(\`https://api.dexscreener.com/latest/dex/tokens/\${tokenAddress}\`);
    if (!dexResponse.ok) throw new Error(\`HTTP \${dexResponse.status}\`);
    
    const dexData = await dexResponse.json();
    const pairs = dexData.pairs || [];
    const totalBaseTokens = pairs.reduce((sum, pair) => sum + Number(pair?.liquidity?.base || 0), 0);
    const readableAmount = totalBaseTokens / Math.pow(10, decimals);
    
    return {
      raw: totalBaseTokens,
      readable: readableAmount,
      formatted: readableAmount.toLocaleString(),
      pairCount: pairs.length
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getTotalTokensInLiquidity('${tokenAddress}').then(console.log);`;
  }
  
  // CREATOR ANALYSIS STATS
  if (statId === 'creatorInitialSupply') {
    return `async function getCreatorInitialSupply(tokenAddress) {
  try {
    // Step 1: Get token address info to find creation tx
    const addressResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!addressResponse.ok) throw new Error(\`HTTP \${addressResponse.status}\`);
    const addressInfo = await addressResponse.json();
    
    const creationTxHash = addressInfo.creation_tx_hash;
    if (!creationTxHash) return { error: 'No creation tx found' };
    
    // Step 2: Get creation transaction details
    const txResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/transactions/\${creationTxHash}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!txResponse.ok) throw new Error(\`HTTP \${txResponse.status}\`);
    const txData = await txResponse.json();
    
    const creator = txData.from?.hash;
    const tokenTransfers = txData.token_transfers || [];
    
    // Step 3: Find initial mint to creator (from 0x00...00)
    const mintTransfer = tokenTransfers.find(t => 
      t.from?.hash === '0x0000000000000000000000000000000000000000' &&
      t.to?.hash?.toLowerCase() === creator?.toLowerCase() &&
      t.token?.address?.toLowerCase() === tokenAddress.toLowerCase()
    );
    
    if (!mintTransfer) return { error: 'No initial mint to creator found' };
    
    // Step 4: Get token info for total supply and decimals
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    
    const initialSupply = Number(mintTransfer.total?.value || 0);
    const totalSupply = Number(tokenData.total_supply || 0);
    const decimals = Number(tokenData.decimals || 18);
    const percentage = totalSupply > 0 ? (initialSupply / totalSupply) * 100 : 0;
    const readable = initialSupply / Math.pow(10, decimals);
    
    return {
      creator,
      initialSupply: initialSupply,
      readable: readable,
      formatted: readable.toLocaleString(),
      percentage: percentage,
      percentageFormatted: \`\${percentage.toFixed(2)}%\`
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getCreatorInitialSupply('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'creatorCurrentBalance') {
    return `async function getCreatorCurrentBalance(tokenAddress) {
  try {
    // Step 1: Get token address info to find creator
    const addressResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!addressResponse.ok) throw new Error(\`HTTP \${addressResponse.status}\`);
    const addressInfo = await addressResponse.json();
    
    const creatorAddress = addressInfo.creator_address_hash;
    if (!creatorAddress) return { error: 'No creator address found' };
    
    // Step 2: Get creator's token balances
    const balanceResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${creatorAddress}/token-balances?token=\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!balanceResponse.ok) throw new Error(\`HTTP \${balanceResponse.status}\`);
    const balances = await balanceResponse.json();
    
    const tokenBalance = balances.find(b => b.token?.address?.toLowerCase() === tokenAddress.toLowerCase());
    
    // Step 3: Get decimals
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const decimals = Number(tokenData.decimals || 18);
    
    const balance = Number(tokenBalance?.value || 0);
    const readable = balance / Math.pow(10, decimals);
    
    return {
      creatorAddress,
      balance: balance,
      readable: readable,
      formatted: readable.toLocaleString()
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getCreatorCurrentBalance('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'ownershipStatus') {
    return `async function getOwnershipStatus(tokenAddress) {
  try {
    // Step 1: Get address info to find creator
    const addressResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!addressResponse.ok) throw new Error(\`HTTP \${addressResponse.status}\`);
    const addressInfo = await addressResponse.json();
    
    const creatorAddress = addressInfo.creator_address_hash;
    if (!creatorAddress) return { error: 'No creator address found' };
    
    // Step 2: Get creator's transactions to check for renounceOwnership
    const txResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${creatorAddress}/transactions\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!txResponse.ok) throw new Error(\`HTTP \${txResponse.status}\`);
    const txData = await txResponse.json();
    
    const renouncedTx = (txData.items || []).find(tx => 
      tx.method?.toLowerCase() === 'renounceownership'
    );
    
    if (renouncedTx) {
      return {
        status: 'Renounced',
        transaction: renouncedTx.hash,
        timestamp: renouncedTx.timestamp
      };
    } else {
      return {
        status: 'Not Renounced'
      };
    }
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getOwnershipStatus('${tokenAddress}').then(console.log);`;
  }
  
  // WHALE COUNT STATS
  if (statId === 'whaleCount1Pct') {
    return `async function getWhaleCount1Pct(tokenAddress) {
  try {
    // Step 1: Get token info for total supply
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const totalSupply = Number(tokenData.total_supply || 0);
    const threshold = totalSupply * 0.01; // 1% of supply
    
    // Step 2: Get all holders (paginated)
    let whaleCount = 0;
    let nextParams = null;
    let page = 0;
    const maxPages = 200;
    
    while (page < maxPages) {
      const params = new URLSearchParams({ limit: '50' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, value));
      }
      
      const holdersResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/holders?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!holdersResponse.ok) throw new Error(\`HTTP \${holdersResponse.status}\`);
      
      const holdersData = await holdersResponse.json();
      const items = holdersData.items || [];
      
      // Count holders above threshold
      for (const item of items) {
        if (Number(item.value || 0) >= threshold) {
          whaleCount++;
        }
      }
      
      if (!holdersData.next_page_params) break;
      nextParams = holdersData.next_page_params;
      page++;
    }
    
    return {
      whaleCount: whaleCount,
      threshold: threshold,
      thresholdPercentage: '1%'
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getWhaleCount1Pct('${tokenAddress}').then(console.log);`;
  }
  
  // ADDITIONAL HOLDER STATS
  if (statId === 'avgHolderBalance') {
    return `async function getAvgHolderBalance(tokenAddress) {
  try {
    const BURN_ADDRESSES = [
      '0x000000000000000000000000000000000000dead',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000369',
      '0x000000000000000000000000000000000000dead'
    ].map(addr => addr.toLowerCase());
    
    // Get token info and counters
    const [tokenResponse, countersResponse] = await Promise.all([
      fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
        headers: { 'accept': 'application/json' }
      }),
      fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/counters\`, {
        headers: { 'accept': 'application/json' }
      })
    ]);
    
    if (!tokenResponse.ok || !countersResponse.ok) throw new Error('HTTP error');
    
    const tokenData = await tokenResponse.json();
    const countersData = await countersResponse.json();
    
    const totalSupply = Number(tokenData.total_supply || 0);
    const decimals = Number(tokenData.decimals || 18);
    const holderCount = Number(countersData.token_holders_count || 0);
    
    // Get burned tokens
    let totalBurned = 0;
    let nextParams = null;
    let page = 0;
    
    while (page < 200) {
      const params = new URLSearchParams({ limit: '50' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, value));
      }
      
      const holdersResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/holders?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      const holdersData = await holdersResponse.json();
      const items = holdersData.items || [];
      
      for (const item of items) {
        const addr = item.address?.hash?.toLowerCase();
        if (addr && BURN_ADDRESSES.includes(addr)) {
          totalBurned += Number(item.value || 0);
        }
      }
      
      if (!holdersData.next_page_params) break;
      nextParams = holdersData.next_page_params;
      page++;
    }
    
    const circulatingSupply = totalSupply - totalBurned;
    const avgBalance = holderCount > 0 ? circulatingSupply / holderCount : 0;
    const readableAvg = avgBalance / Math.pow(10, decimals);
    
    return {
      avgBalance: avgBalance,
      readable: readableAvg,
      formatted: readableAvg.toLocaleString(),
      holderCount: holderCount
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getAvgHolderBalance('${tokenAddress}').then(console.log);`;
  }
  
  // MORE ON-CHAIN ACTIVITY STATS
  if (statId === 'medianTransferValue24h') {
    return `async function getMedianTransferValue24h(tokenAddress) {
  try {
    // Get token decimals
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const decimals = Number(tokenData.decimals || 18);
    
    // Get 24h transfers
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const transferValues = [];
    let nextParams = null;
    let page = 0;
    
    while (page < 50) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, value));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/transfers?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      for (const transfer of items) {
        if (transfer.timestamp && transfer.timestamp >= cutoff24h) {
          transferValues.push(Number(transfer.total?.value || 0));
        }
      }
      
      const lastTimestamp = items[items.length - 1]?.timestamp;
      if (lastTimestamp && lastTimestamp < cutoff24h) break;
      
      if (!data.next_page_params) break;
      nextParams = data.next_page_params;
      page++;
    }
    
    // Sort and find median
    transferValues.sort((a, b) => a - b);
    const median = transferValues.length > 0 
      ? transferValues[Math.floor(transferValues.length / 2)] 
      : 0;
    const readable = median / Math.pow(10, decimals);
    
    return {
      medianRaw: median,
      medianReadable: readable,
      formatted: readable.toLocaleString(),
      transferCount: transferValues.length
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getMedianTransferValue24h('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'transactionVelocity') {
    return `async function getTransactionVelocity(tokenAddress) {
  try {
    // Get token info
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const totalSupply = Number(tokenData.total_supply || 0);
    
    // Get holders to find burned tokens
    const BURN_ADDRESSES = [
      '0x000000000000000000000000000000000000dead',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000369',
      '0x000000000000000000000000000000000000dead'
    ];
    
    let burnedTotal = 0;
    let nextHolderParams = null;
    let holderPage = 0;
    
    while (holderPage < 50) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextHolderParams) {
        Object.entries(nextHolderParams).forEach(([key, value]) => params.set(key, value));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/holders?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      for (const holder of items) {
        if (BURN_ADDRESSES.includes(holder.address.hash.toLowerCase())) {
          burnedTotal += Number(holder.value || 0);
        }
      }
      
      if (!data.next_page_params) break;
      nextHolderParams = data.next_page_params;
      holderPage++;
    }
    
    const circulatingSupply = totalSupply - burnedTotal;
    if (circulatingSupply === 0) {
      return { velocity: 0, formatted: '0%' };
    }
    
    // Get 24h transfer volume
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let transferVolume = 0;
    let nextTransferParams = null;
    let transferPage = 0;
    
    while (transferPage < 50) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextTransferParams) {
        Object.entries(nextTransferParams).forEach(([key, value]) => params.set(key, value));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/transfers?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      for (const transfer of items) {
        if (transfer.timestamp && transfer.timestamp >= cutoff24h) {
          transferVolume += Number(transfer.total?.value || 0);
        }
      }
      
      const lastTimestamp = items[items.length - 1]?.timestamp;
      if (lastTimestamp && lastTimestamp < cutoff24h) break;
      
      if (!data.next_page_params) break;
      nextTransferParams = data.next_page_params;
      transferPage++;
    }
    
    const velocity = transferVolume / circulatingSupply;
    const velocityPct = velocity * 100;
    
    return {
      velocity: velocity,
      velocityPercent: velocityPct,
      formatted: velocityPct.toFixed(2) + '%',
      transferVolume,
      circulatingSupply
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getTransactionVelocity('${tokenAddress}').then(console.log);`;
  }
  
  // ADDITIONAL ON-CHAIN ACTIVITY STATS (24h based)
  if (statId === 'uniqueSenders24h') {
    return `async function getUniqueSenders24h(tokenAddress) {
  try {
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const uniqueSenders = new Set();
    let nextParams = null;
    let page = 0;
    
    while (page < 50) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, value));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/transfers?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      for (const transfer of items) {
        if (transfer.timestamp && transfer.timestamp >= cutoff24h) {
          const fromAddress = transfer.from?.hash?.toLowerCase();
          if (fromAddress) uniqueSenders.add(fromAddress);
        }
      }
      
      const lastTimestamp = items[items.length - 1]?.timestamp;
      if (lastTimestamp && lastTimestamp < cutoff24h) break;
      
      if (!data.next_page_params) break;
      nextParams = data.next_page_params;
      page++;
    }
    
    return {
      uniqueSenders: uniqueSenders.size,
      formatted: uniqueSenders.size.toLocaleString()
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getUniqueSenders24h('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'uniqueReceivers24h') {
    return `async function getUniqueReceivers24h(tokenAddress) {
  try {
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const uniqueReceivers = new Set();
    let nextParams = null;
    let page = 0;
    
    while (page < 50) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, value));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/transfers?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      for (const transfer of items) {
        if (transfer.timestamp && transfer.timestamp >= cutoff24h) {
          const toAddress = transfer.to?.hash?.toLowerCase();
          if (toAddress) uniqueReceivers.add(toAddress);
        }
      }
      
      const lastTimestamp = items[items.length - 1]?.timestamp;
      if (lastTimestamp && lastTimestamp < cutoff24h) break;
      
      if (!data.next_page_params) break;
      nextParams = data.next_page_params;
      page++;
    }
    
    return {
      uniqueReceivers: uniqueReceivers.size,
      formatted: uniqueReceivers.size.toLocaleString()
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getUniqueReceivers24h('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'avgTransferValue24h') {
    return `async function getAvgTransferValue24h(tokenAddress) {
  try {
    // Get token decimals
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const decimals = Number(tokenData.decimals || 18);
    
    // Get 24h transfers
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const transferValues = [];
    let nextParams = null;
    let page = 0;
    
    while (page < 50) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, value));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/transfers?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      for (const transfer of items) {
        if (transfer.timestamp && transfer.timestamp >= cutoff24h) {
          transferValues.push(Number(transfer.total?.value || 0));
        }
      }
      
      const lastTimestamp = items[items.length - 1]?.timestamp;
      if (lastTimestamp && lastTimestamp < cutoff24h) break;
      
      if (!data.next_page_params) break;
      nextParams = data.next_page_params;
      page++;
    }
    
    const avg = transferValues.length > 0 
      ? transferValues.reduce((a, b) => a + b, 0) / transferValues.length 
      : 0;
    const readable = avg / Math.pow(10, decimals);
    
    return {
      avgRaw: avg,
      avgReadable: readable,
      formatted: readable.toLocaleString(),
      transferCount: transferValues.length
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getAvgTransferValue24h('${tokenAddress}').then(console.log);`;
  }
  
  // LEGACY STATS
  if (statId === 'tokensBurned') {
    return `async function getTokensBurned(tokenAddress) {
  try {
    // Get token decimals
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const decimals = Number(tokenData.decimals || 18);
    
    // Burn addresses to check
    const burnAddresses = [
      '0x000000000000000000000000000000000000dEaD',
      '0x0000000000000000000000000000000000000369',
      '0x0000000000000000000000000000000000000000'
    ];
    
    let totalBurned = 0;
    
    // Query each burn address using legacy API
    for (const burnAddress of burnAddresses) {
      try {
        const response = await fetch(\`https://api.scan.pulsechain.com/api?module=account&action=tokenbalance&contractaddress=\${tokenAddress}&address=\${burnAddress}\`);
        if (!response.ok) continue;
        
        const data = await response.json();
        const rawAmount = parseInt(data.result || '0');
        const burnedAmount = rawAmount / Math.pow(10, decimals);
        totalBurned += burnedAmount;
      } catch (error) {
        // Skip individual address errors
        continue;
      }
    }
    
    return {
      totalBurned: totalBurned,
      formatted: totalBurned.toLocaleString(undefined, { maximumFractionDigits: 0 })
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getTokensBurned('${tokenAddress}').then(console.log);`;
  }
  
  // REMAINING STATS
  if (statId === 'tokenBalance') {
    return `async function getTokenBalance(tokenAddress, walletAddress) {
  try {
    // Get token decimals
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const decimals = Number(tokenData.decimals || 18);
    
    // Get wallet's token balances
    const balanceResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${walletAddress}/token-balances?token=\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!balanceResponse.ok) throw new Error(\`HTTP \${balanceResponse.status}\`);
    
    const balanceData = await balanceResponse.json();
    const tokenBalance = balanceData.find(item => 
      item.token?.address?.toLowerCase() === tokenAddress.toLowerCase()
    );
    
    if (!tokenBalance) {
      return {
        balanceRaw: 0,
        balanceReadable: 0,
        formatted: '0'
      };
    }
    
    const rawBalance = Number(tokenBalance.value || 0);
    const readable = rawBalance / Math.pow(10, decimals);
    
    return {
      balanceRaw: rawBalance,
      balanceReadable: readable,
      formatted: readable.toLocaleString()
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getTokenBalance('${tokenAddress}', '0xYourWalletAddress').then(console.log);`;
  }
  
  if (statId === 'abiComplexity') {
    return `async function getAbiComplexity(tokenAddress) {
  try {
    // Get creator address
    const addressResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!addressResponse.ok) throw new Error(\`HTTP \${addressResponse.status}\`);
    const addressData = await addressResponse.json();
    const creatorAddress = addressData.creator_address_hash;
    
    if (!creatorAddress) {
      return { complexity: 0, error: 'No creator address found' };
    }
    
    // Get smart contract ABI
    const contractResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/smart-contracts/\${creatorAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!contractResponse.ok) throw new Error(\`HTTP \${contractResponse.status}\`);
    
    const contractData = await contractResponse.json();
    const abi = contractData.abi || [];
    
    // Count functions in ABI
    const functionCount = abi.filter(item => item.type === 'function').length;
    
    return {
      complexity: functionCount,
      totalAbiItems: abi.length,
      formatted: \`\${functionCount} functions\`
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getAbiComplexity('${tokenAddress}').then(console.log);`;
  }
  
  // CREATOR ANALYSIS EXTENDED
  if (statId === 'creatorFirst5Outbound') {
    return `async function getCreatorFirst5Outbound(tokenAddress) {
  try {
    // Get token info to find creator
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const addressData = await tokenResponse.json();
    const creatorAddress = addressData.creator_address_hash;
    
    if (!creatorAddress) {
      return { error: 'No creator address found' };
    }
    
    // Get creator's transactions
    const txResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${creatorAddress}/transactions\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!txResponse.ok) throw new Error(\`HTTP \${txResponse.status}\`);
    
    const txData = await txResponse.json();
    const allTxs = txData.items || [];
    
    // Filter for outbound transactions
    const outboundTxs = allTxs.filter(tx => 
      tx.from?.hash?.toLowerCase() === creatorAddress.toLowerCase()
    );
    
    // Take first 5
    const first5 = outboundTxs.slice(0, 5).map(tx => ({
      hash: tx.hash,
      to: tx.to?.hash,
      value: (Number(tx.value) / 1e18).toFixed(4) + ' PLS',
      method: tx.method || 'transfer',
      timestamp: tx.timestamp
    }));
    
    return {
      creatorAddress,
      first5Outbound: first5
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getCreatorFirst5Outbound('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'creatorTokenHistory') {
    return `async function getCreatorTokenHistory(tokenAddress) {
  try {
    // Get token info to find creator and decimals
    const addressResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!addressResponse.ok) throw new Error(\`HTTP \${addressResponse.status}\`);
    const addressData = await addressResponse.json();
    const creatorAddress = addressData.creator_address_hash;
    
    if (!creatorAddress) {
      return { error: 'No creator address found' };
    }
    
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const decimals = Number(tokenData.decimals || 18);
    
    // Get all token transfers for creator
    const allTransfers = [];
    let nextParams = null;
    let page = 0;
    
    while (page < 200) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, value));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${creatorAddress}/token-transfers?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      allTransfers.push(...items);
      
      if (!data.next_page_params) break;
      nextParams = data.next_page_params;
      page++;
    }
    
    // Filter for this specific token
    const relevantTransfers = allTransfers.filter(t => 
      t.token?.address?.toLowerCase() === tokenAddress.toLowerCase()
    );
    
    const history = relevantTransfers.map(t => {
      const isOutbound = t.from?.hash?.toLowerCase() === creatorAddress.toLowerCase();
      const value = Number(t.total?.value || 0) / Math.pow(10, decimals);
      
      return {
        timestamp: t.timestamp,
        direction: isOutbound ? 'OUT' : 'IN',
        counterparty: isOutbound ? t.to?.hash : t.from?.hash,
        value: value.toFixed(4),
        txHash: t.tx_hash
      };
    });
    
    return {
      creatorAddress,
      tokenAddress,
      transferCount: history.length,
      history
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getCreatorTokenHistory('${tokenAddress}').then(console.log);`;
  }
  
  // ADDITIONAL HOLDER STATS DETAILED
  if (statId === 'top50Holders') {
    return `async function getTop50Holders(tokenAddress) {
  try {
    // Get token info
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const totalSupply = Number(tokenData.total_supply || 0);
    const decimals = Number(tokenData.decimals || 18);
    
    // Get all holders
    const allHolders = [];
    let nextParams = null;
    let page = 0;
    
    while (page < 50) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, value));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/holders?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      allHolders.push(...items);
      
      if (!data.next_page_params) break;
      nextParams = data.next_page_params;
      page++;
    }
    
    // Sort by balance and take top 50
    allHolders.sort((a, b) => Number(b.value) - Number(a.value));
    const top50 = allHolders.slice(0, 50);
    
    const result = top50.map((holder, index) => {
      const balance = Number(holder.value);
      const percentage = totalSupply > 0 ? (balance / totalSupply) * 100 : 0;
      const readable = balance / Math.pow(10, decimals);
      
      return {
        rank: index + 1,
        address: holder.address.hash,
        balanceRaw: holder.value,
        balanceReadable: readable,
        percentage: percentage.toFixed(4) + '%'
      };
    });
    
    return result;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getTop50Holders('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'giniCoefficient') {
    return `async function getGiniCoefficient(tokenAddress) {
  try {
    // Get all holders
    const allHolders = [];
    let nextParams = null;
    let page = 0;
    
    while (page < 50) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, value));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/holders?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      allHolders.push(...items);
      
      if (!data.next_page_params) break;
      nextParams = data.next_page_params;
      page++;
    }
    
    if (allHolders.length < 2) {
      return { gini: 0, formatted: '0.0000' };
    }
    
    // Extract and sort values
    const values = allHolders.map(h => Number(h.value)).sort((a, b) => a - b);
    const n = values.length;
    
    // Calculate Gini coefficient
    let sumOfDifferences = 0;
    for (let i = 0; i < n; i++) {
      sumOfDifferences += (2 * (i + 1) - n - 1) * values[i];
    }
    
    const totalValue = values.reduce((sum, val) => sum + val, 0);
    
    if (totalValue === 0) {
      return { gini: 0, formatted: '0.0000' };
    }
    
    const gini = sumOfDifferences / (n * totalValue);
    
    return {
      gini: gini,
      formatted: gini.toFixed(4),
      holderCount: n
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getGiniCoefficient('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'newVsLostHolders7d') {
    return `async function getNewVsLostHolders7d(tokenAddress) {
  try {
    // Get 7 days of transfers
    const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const transfers = [];
    let nextParams = null;
    let page = 0;
    
    while (page < 50) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, value));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/transfers?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      // Filter for 7d timeframe
      for (const transfer of items) {
        if (transfer.timestamp && transfer.timestamp >= cutoff7d) {
          transfers.push(transfer);
        }
      }
      
      const lastTimestamp = items[items.length - 1]?.timestamp;
      if (lastTimestamp && lastTimestamp < cutoff7d) break;
      
      if (!data.next_page_params) break;
      nextParams = data.next_page_params;
      page++;
    }
    
    if (transfers.length === 0) {
      return {
        newHolders: 0,
        lostHolders: 0,
        netChange: 0,
        formatted: '0/0 (0)'
      };
    }
    
    // Track addresses and their activity
    const addressActivity = new Map();
    
    for (const transfer of transfers) {
      const fromAddr = transfer.from?.hash?.toLowerCase();
      const toAddr = transfer.to?.hash?.toLowerCase();
      
      if (fromAddr) {
        if (!addressActivity.has(fromAddr)) {
          addressActivity.set(fromAddr, { sent: false, received: false });
        }
        addressActivity.get(fromAddr).sent = true;
      }
      
      if (toAddr) {
        if (!addressActivity.has(toAddr)) {
          addressActivity.set(toAddr, { sent: false, received: false });
        }
        addressActivity.get(toAddr).received = true;
      }
    }
    
    // Count new holders (only received) and lost holders (only sent)
    let newHolders = 0;
    let lostHolders = 0;
    
    for (const [addr, activity] of addressActivity) {
      if (activity.received && !activity.sent) {
        newHolders++;
      }
      if (activity.sent && !activity.received) {
        lostHolders++;
      }
    }
    
    const netChange = newHolders - lostHolders;
    
    return {
      newHolders,
      lostHolders,
      netChange,
      formatted: \`\${newHolders}/\${lostHolders} (\${netChange})\`
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getNewVsLostHolders7d('${tokenAddress}').then(console.log);`;
  }
  
  // ADVANCED MARKET STATS
  if (statId === 'blueChipPairRatio') {
    return `async function getBlueChipPairRatio(tokenAddress) {
  try {
    const BLUE_CHIP_ADDRESSES = new Set([
      '0xa1077a294dde1b09bb078844df40758a5d0f9a27', // WPLS
      '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', // HEX
      '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07', // USDC
      '0xefd766ccb38eaf1dfd701853bfce31359239f305'  // DAI
    ]);
    
    const response = await fetch(\`https://api.dexscreener.com/latest/dex/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
    
    const data = await response.json();
    const pairs = data.pairs || [];
    
    if (pairs.length === 0) {
      return {
        ratio: 0,
        totalLiquidity: 0,
        blueChipLiquidity: 0,
        formatted: '0%'
      };
    }
    
    let totalLiquidity = 0;
    let blueChipLiquidity = 0;
    
    for (const pair of pairs) {
      const liquidityUsd = Number(pair.liquidity?.usd || 0);
      totalLiquidity += liquidityUsd;
      
      const quoteAddress = pair.quoteToken?.address?.toLowerCase();
      if (quoteAddress && BLUE_CHIP_ADDRESSES.has(quoteAddress)) {
        blueChipLiquidity += liquidityUsd;
      }
    }
    
    const ratio = totalLiquidity > 0 ? (blueChipLiquidity / totalLiquidity) * 100 : 0;
    
    return {
      ratio: ratio,
      totalLiquidity: totalLiquidity,
      blueChipLiquidity: blueChipLiquidity,
      formatted: ratio.toFixed(2) + '%'
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getBlueChipPairRatio('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'diamondHandsScore') {
    return `async function getDiamondHandsScore(tokenAddress) {
  try {
    // Get transfers for last 180 days
    const cutoff180d = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    
    const allTransfers = [];
    let nextParams = null;
    let page = 0;
    
    while (page < 200) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, value));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/transfers?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      allTransfers.push(...items);
      
      const lastTimestamp = items[items.length - 1]?.timestamp;
      if (lastTimestamp && lastTimestamp < cutoff180d) break;
      
      if (!data.next_page_params) break;
      nextParams = data.next_page_params;
      page++;
    }
    
    // Find active wallets
    const activeWallets180d = new Set();
    const activeWallets90d = new Set();
    
    for (const transfer of allTransfers) {
      const fromAddr = transfer.from?.hash?.toLowerCase();
      if (!fromAddr) continue;
      
      if (transfer.timestamp >= cutoff180d) {
        activeWallets180d.add(fromAddr);
      }
      if (transfer.timestamp >= cutoff90d) {
        activeWallets90d.add(fromAddr);
      }
    }
    
    // Get all holders and token info
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const totalSupply = Number(tokenData.total_supply || 0);
    
    const holders = [];
    let nextHolderParams = null;
    let holderPage = 0;
    
    while (holderPage < 50) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextHolderParams) {
        Object.entries(nextHolderParams).forEach(([key, value]) => params.set(key, value));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/holders?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      holders.push(...items);
      
      if (!data.next_page_params) break;
      nextHolderParams = data.next_page_params;
      holderPage++;
    }
    
    // Calculate unmoved tokens
    let unmoved90d = 0;
    let unmoved180d = 0;
    
    for (const holder of holders) {
      const addr = holder.address?.hash?.toLowerCase();
      if (!addr) continue;
      
      const balance = Number(holder.value || 0);
      
      if (!activeWallets90d.has(addr)) {
        unmoved90d += balance;
      }
      if (!activeWallets180d.has(addr)) {
        unmoved180d += balance;
      }
    }
    
    const score90d = totalSupply > 0 ? (unmoved90d / totalSupply) * 100 : 0;
    const score180d = totalSupply > 0 ? (unmoved180d / totalSupply) * 100 : 0;
    
    return {
      score90d: score90d,
      score180d: score180d,
      formatted: \`90d: \${score90d.toFixed(2)}%, 180d: \${score180d.toFixed(2)}%\`
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getDiamondHandsScore('${tokenAddress}').then(console.log);`;
  }
  
  // FALLBACK
  return `// API mapping not yet created for stat: ${statId}
// Please contact support for documentation.`;
}

/**
 * Generate TypeScript example using REAL API endpoints - ONE complete executable function
 */
function generateRealTypeScriptExample(mapping: any, parameters: StatParameter[]): string {
  const tokenAddress = parameters.find(p => p.key === 'address')?.example || '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e';
  const walletAddress = parameters.find(p => p.key === 'walletAddress')?.example;
  
  // Generate based on specific stat implementation
  return generateCompleteTypeScriptForStat(mapping.statId, tokenAddress, walletAddress);
}

/**
 * Generate complete, working TypeScript for specific stats
 */
function generateCompleteTypeScriptForStat(statId: string, tokenAddress: string, walletAddress?: string): string {
  // TOTAL SUPPLY
  if (statId === 'totalSupply') {
    return `interface TokenInfo {
  address: string;
  decimals: string;
  total_supply: string;
  name?: string;
  symbol?: string;
}

async function getTotalSupply(tokenAddress: string): Promise<{ raw: string; decimals: number; formatted: string }> {
  try {
    const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!response.ok) throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
    
    const data: TokenInfo = await response.json();
    const totalSupply = data.total_supply;
    const decimals = Number(data.decimals || 18);
    const readableSupply = Number(totalSupply) / Math.pow(10, decimals);
    
    return {
      raw: totalSupply,
      decimals: decimals,
      formatted: readableSupply.toLocaleString()
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getTotalSupply('${tokenAddress}').then(console.log);`;
  }
  
  // HOLDERS
  if (statId === 'holders') {
    return `interface TokenCounters {
  token_holders_count?: string;
  transfers_count?: string;
}

interface TokenInfo {
  holders?: string;
  name?: string;
  symbol?: string;
}

async function getHolders(tokenAddress: string): Promise<{ count: number; formatted: string; source: string }> {
  try {
    const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/counters\`, {
      headers: { 'accept': 'application/json' }
    });
    
    if (response.ok) {
      const counters: TokenCounters = await response.json();
      if (counters.token_holders_count) {
        return {
          count: Number(counters.token_holders_count),
          formatted: Number(counters.token_holders_count).toLocaleString(),
          source: 'counters'
        };
      }
    }
    
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    
    const tokenData: TokenInfo = await tokenResponse.json();
    const holdersCount = Number(tokenData.holders || 0);
    
    return {
      count: holdersCount,
      formatted: holdersCount.toLocaleString(),
      source: 'token_info'
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getHolders('${tokenAddress}').then(console.log);`;
  }
  
  // BURNED 24H
  if (statId === 'burned24h') {
    return `interface Transfer {
  timestamp?: string;
  to?: { hash?: string };
  total?: { value?: string };
}

async function getBurned24h(tokenAddress: string): Promise<{ raw: number; readable: number; formatted: string; percent: number; percentFormatted: string; transferCount: number }> {
  try {
    const BURN_ADDRESSES = [
      '0x000000000000000000000000000000000000dead',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000369',
      '0x000000000000000000000000000000000000dead'
    ].map(addr => addr.toLowerCase());
    
    // Step 1: Get token info
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    
    const decimals = Number(tokenData.decimals || 18);
    const totalSupply = Number(tokenData.total_supply || 0);
    
    // Step 2: Get transfers from last 24 hours (paginated)
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const allTransfers: Transfer[] = [];
    let nextParams: any = null;
    let page = 0;
    const maxPages = 50;
    
    while (page < maxPages) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, String(value)));
      }
      
      const transfersResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/transfers?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!transfersResponse.ok) throw new Error(\`HTTP \${transfersResponse.status}\`);
      
      const transfersData = await transfersResponse.json();
      const items: Transfer[] = transfersData.items || [];
      
      if (items.length === 0) break;
      
      // Filter transfers within 24h
      for (const transfer of items) {
        if (transfer.timestamp && transfer.timestamp >= cutoff24h) {
          allTransfers.push(transfer);
        }
      }
      
      // Check if we've gone past 24h
      const lastTimestamp = items[items.length - 1]?.timestamp;
      if (lastTimestamp && lastTimestamp < cutoff24h) break;
      
      if (!transfersData.next_page_params) break;
      nextParams = transfersData.next_page_params;
      page++;
    }
    
    // Step 3: Filter for transfers TO burn addresses and sum
    let totalBurned = 0;
    for (const transfer of allTransfers) {
      const toAddress = transfer.to?.hash?.toLowerCase();
      if (toAddress && BURN_ADDRESSES.includes(toAddress)) {
        totalBurned += Number(transfer.total?.value || 0);
      }
    }
    
    const burnedReadable = totalBurned / Math.pow(10, decimals);
    const burnedPercent = totalSupply > 0 ? (totalBurned / totalSupply) * 100 : 0;
    
    return {
      raw: totalBurned,
      readable: burnedReadable,
      formatted: burnedReadable.toLocaleString(),
      percent: burnedPercent,
      percentFormatted: \`\${burnedPercent.toFixed(2)}%\`,
      transferCount: allTransfers.filter(t => BURN_ADDRESSES.includes(t.to?.hash?.toLowerCase() || '')).length
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getBurned24h('${tokenAddress}').then(console.log);`;
  }
  
  // MINTED 24H
  if (statId === 'minted24h') {
    return `interface Transfer {
  timestamp?: string;
  from?: { hash?: string };
  total?: { value?: string };
}

async function getMinted24h(tokenAddress: string): Promise<{ raw: number; readable: number; formatted: string; transferCount: number }> {
  try {
    // Step 1: Get token info
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    
    const decimals = Number(tokenData.decimals || 18);
    
    // Step 2: Get transfers from last 24 hours (paginated)
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const allTransfers: Transfer[] = [];
    let nextParams: any = null;
    let page = 0;
    const maxPages = 50;
    
    while (page < maxPages) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, String(value)));
      }
      
      const transfersResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/transfers?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!transfersResponse.ok) throw new Error(\`HTTP \${transfersResponse.status}\`);
      
      const transfersData = await transfersResponse.json();
      const items: Transfer[] = transfersData.items || [];
      
      if (items.length === 0) break;
      
      // Filter transfers within 24h
      for (const transfer of items) {
        if (transfer.timestamp && transfer.timestamp >= cutoff24h) {
          allTransfers.push(transfer);
        }
      }
      
      // Check if we've gone past 24h
      const lastTimestamp = items[items.length - 1]?.timestamp;
      if (lastTimestamp && lastTimestamp < cutoff24h) break;
      
      if (!transfersData.next_page_params) break;
      nextParams = transfersData.next_page_params;
      page++;
    }
    
    // Step 3: Filter for mints (transfers FROM token contract itself) and sum
    let totalMinted = 0;
    for (const transfer of allTransfers) {
      const fromAddress = transfer.from?.hash?.toLowerCase();
      if (fromAddress === tokenAddress.toLowerCase()) {
        totalMinted += Number(transfer.total?.value || 0);
      }
    }
    
    const mintedReadable = totalMinted / Math.pow(10, decimals);
    
    return {
      raw: totalMinted,
      readable: mintedReadable,
      formatted: mintedReadable.toLocaleString(),
      transferCount: allTransfers.filter(t => t.from?.hash?.toLowerCase() === tokenAddress.toLowerCase()).length
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getMinted24h('${tokenAddress}').then(console.log);`;
  }
  
  // BURNED TOTAL
  if (statId === 'burnedTotal') {
    return `interface Holder {
  address?: { hash?: string };
  value?: string;
}

async function getBurnedTotal(tokenAddress: string): Promise<{ raw: number; readable: number; formatted: string; percent: number; percentFormatted: string }> {
  try {
    const BURN_ADDRESSES = [
      '0x000000000000000000000000000000000000dead',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000369',
      '0x000000000000000000000000000000000000dead'
    ].map(addr => addr.toLowerCase());
    
    // Step 1: Get token info
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    
    const decimals = Number(tokenData.decimals || 18);
    const totalSupply = Number(tokenData.total_supply || 0);
    
    // Step 2: Get all holders (paginated)
    const allHolders: Array<{ address?: string; value?: string }> = [];
    let nextParams: any = null;
    let page = 0;
    const maxPages = 200;
    
    while (page < maxPages) {
      const params = new URLSearchParams({ limit: '50' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, String(value)));
      }
      
      const holdersResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/holders?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!holdersResponse.ok) throw new Error(\`HTTP \${holdersResponse.status}\`);
      
      const holdersData = await holdersResponse.json();
      const items: Holder[] = holdersData.items || [];
      
      for (const item of items) {
        allHolders.push({
          address: item.address?.hash,
          value: item.value
        });
      }
      
      if (!holdersData.next_page_params) break;
      nextParams = holdersData.next_page_params;
      page++;
    }
    
    // Step 3: Find ALL burn/dead addresses and sum their balances
    let totalBurnedRaw = 0;
    for (const holder of allHolders) {
      if (holder.address && BURN_ADDRESSES.includes(holder.address.toLowerCase())) {
        totalBurnedRaw += Number(holder.value || 0);
      }
    }
    
    const burnedReadable = totalBurnedRaw / Math.pow(10, decimals);
    const burnedPercent = totalSupply > 0 ? (totalBurnedRaw / totalSupply) * 100 : 0;
    
    return {
      raw: totalBurnedRaw,
      readable: burnedReadable,
      formatted: burnedReadable.toLocaleString(),
      percent: burnedPercent,
      percentFormatted: \`\${burnedPercent.toFixed(2)}%\`
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getBurnedTotal('${tokenAddress}').then(console.log);`;
  }
  
  // HOLDER DISTRIBUTION STATS (TypeScript)
  if (statId === 'top1Pct' || statId === 'top10Pct' || statId === 'top20Pct' || statId === 'top50Pct') {
    const topCounts = { top1Pct: 1, top10Pct: 10, top20Pct: 20, top50Pct: 50 };
    const topCount = topCounts[statId as keyof typeof topCounts];
    return `interface Holder {
  address?: { hash?: string };
  value?: string;
}

async function get${toPascalCase(statId)}(tokenAddress: string): Promise<{ percentage: number; formatted: string; topHolderCount: number; totalHolders: number }> {
  try {
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const totalSupply = Number(tokenData.total_supply || 0);
    
    const allHolders: Array<{ address?: string; value: number }> = [];
    let nextParams: any = null;
    let page = 0;
    
    while (page < 200) {
      const params = new URLSearchParams({ limit: '50' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, String(value)));
      }
      
      const holdersResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/holders?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!holdersResponse.ok) throw new Error(\`HTTP \${holdersResponse.status}\`);
      
      const holdersData = await holdersResponse.json();
      const items: Holder[] = holdersData.items || [];
      
      for (const item of items) {
        allHolders.push({
          address: item.address?.hash,
          value: Number(item.value || 0)
        });
      }
      
      if (!holdersData.next_page_params) break;
      nextParams = holdersData.next_page_params;
      page++;
    }
    
    allHolders.sort((a, b) => b.value - a.value);
    const topSum = allHolders.slice(0, ${topCount}).reduce((sum, h) => sum + h.value, 0);
    const percentage = totalSupply > 0 ? (topSum / totalSupply) * 100 : 0;
    
    return {
      percentage,
      formatted: \`\${percentage.toFixed(2)}%\`,
      topHolderCount: ${topCount},
      totalHolders: allHolders.length
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// get${toPascalCase(statId)}('${tokenAddress}').then(console.log);`;
  }
  
  // SIMPLE METADATA STATS (TypeScript)
  if (statId === 'address' || statId === 'symbol' || statId === 'name') {
    if (statId === 'address') {
      return `async function getAddress(tokenAddress: string): Promise<{ address: string; formatted: string }> {
  return { address: tokenAddress, formatted: tokenAddress };
}

// Usage:
// getAddress('${tokenAddress}').then(console.log);`;
    }
    
    const fieldName = statId === 'symbol' ? 'symbol' : 'name';
    return `async function get${toPascalCase(statId)}(tokenAddress: string): Promise<{ ${fieldName}: string }> {
  try {
    const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
    
    const data = await response.json();
    return { ${fieldName}: data.${fieldName} };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// get${toPascalCase(statId)}('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'iconUrl') {
    return `async function getIconUrl(tokenAddress: string): Promise<{ iconUrl?: string; source: string }> {
  try {
    const dexResponse = await fetch(\`https://api.dexscreener.com/latest/dex/tokens/\${tokenAddress}\`);
    if (dexResponse.ok) {
      const dexData = await dexResponse.json();
      const iconUrl = dexData.pairs?.[0]?.info?.imageUrl;
      if (iconUrl) return { iconUrl, source: 'dexscreener' };
    }
    
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    
    const tokenData = await tokenResponse.json();
    return { iconUrl: tokenData.icon_url, source: 'blockscout' };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getIconUrl('${tokenAddress}').then(console.log);`;
  }
  
  // TRANSFER STATS (TypeScript)
  if (statId === 'transfersTotal') {
    return `async function getTransfersTotal(tokenAddress: string): Promise<{ count: number; formatted: string }> {
  try {
    const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/counters\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
    
    const data = await response.json();
    const transfersCount = Number(data.transfers_count || 0);
    
    return {
      count: transfersCount,
      formatted: transfersCount.toLocaleString()
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getTransfersTotal('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'transfers24h') {
    return `interface Transfer {
  timestamp?: string;
}

async function getTransfers24h(tokenAddress: string): Promise<{ count: number; formatted: string }> {
  try {
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let transferCount = 0;
    let nextParams: any = null;
    let page = 0;
    
    while (page < 50) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, String(value)));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/transfers?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items: Transfer[] = data.items || [];
      
      if (items.length === 0) break;
      
      for (const transfer of items) {
        if (transfer.timestamp && transfer.timestamp >= cutoff24h) {
          transferCount++;
        }
      }
      
      const lastTimestamp = items[items.length - 1]?.timestamp;
      if (lastTimestamp && lastTimestamp < cutoff24h) break;
      
      if (!data.next_page_params) break;
      nextParams = data.next_page_params;
      page++;
    }
    
    return {
      count: transferCount,
      formatted: transferCount.toLocaleString()
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getTransfers24h('${tokenAddress}').then(console.log);`;
  }
  
  // MARKET & LIQUIDITY STATS (TypeScript)
  if (statId === 'priceUsd' || statId === 'liquidityUsd' || statId === 'totalLiquidityUsd') {
    if (statId === 'priceUsd') {
      return `async function getPriceUsd(tokenAddress: string): Promise<{ priceUsd: number | null; formatted: string }> {
  try {
    const response = await fetch(\`https://api.dexscreener.com/latest/dex/tokens/\${tokenAddress}\`);
    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
    
    const data = await response.json();
    const priceUsd = data.pairs?.[0]?.priceUsd;
    
    return {
      priceUsd: priceUsd ? parseFloat(priceUsd) : null,
      formatted: priceUsd ? \`$\${parseFloat(priceUsd).toFixed(6)}\` : 'N/A'
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getPriceUsd('${tokenAddress}').then(console.log);`;
    }
    
    if (statId === 'liquidityUsd') {
      return `async function getLiquidityUsd(tokenAddress: string): Promise<{ liquidityUsd: number; formatted: string }> {
  try {
    const response = await fetch(\`https://api.dexscreener.com/latest/dex/tokens/\${tokenAddress}\`);
    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
    
    const data = await response.json();
    const liquidityUsd = Number(data.pairs?.[0]?.liquidity?.usd || 0);
    
    return {
      liquidityUsd,
      formatted: \`$\${liquidityUsd.toLocaleString()}\`
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getLiquidityUsd('${tokenAddress}').then(console.log);`;
    }
    
    return `async function getTotalLiquidityUsd(tokenAddress: string): Promise<{ totalLiquidityUsd: number; formatted: string; pairCount: number }> {
  try {
    const response = await fetch(\`https://api.dexscreener.com/latest/dex/tokens/\${tokenAddress}\`);
    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
    
    const data = await response.json();
    const pairs = data.pairs || [];
    const totalLiquidityUsd = pairs.reduce((sum: number, pair: any) => sum + Number(pair?.liquidity?.usd || 0), 0);
    
    return {
      totalLiquidityUsd,
      formatted: \`$\${totalLiquidityUsd.toLocaleString()}\`,
      pairCount: pairs.length
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getTotalLiquidityUsd('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'totalTokensInLiquidity') {
    return `async function getTotalTokensInLiquidity(tokenAddress: string): Promise<{ raw: number; readable: number; formatted: string; pairCount: number }> {
  try {
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const decimals = Number(tokenData.decimals || 18);
    
    const dexResponse = await fetch(\`https://api.dexscreener.com/latest/dex/tokens/\${tokenAddress}\`);
    if (!dexResponse.ok) throw new Error(\`HTTP \${dexResponse.status}\`);
    
    const dexData = await dexResponse.json();
    const pairs = dexData.pairs || [];
    const totalBaseTokens = pairs.reduce((sum: number, pair: any) => sum + Number(pair?.liquidity?.base || 0), 0);
    const readableAmount = totalBaseTokens / Math.pow(10, decimals);
    
    return {
      raw: totalBaseTokens,
      readable: readableAmount,
      formatted: readableAmount.toLocaleString(),
      pairCount: pairs.length
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getTotalTokensInLiquidity('${tokenAddress}').then(console.log);`;
  }
  
  // CREATOR ANALYSIS STATS (TypeScript)
  if (statId === 'creatorInitialSupply') {
    return `async function getCreatorInitialSupply(tokenAddress: string): Promise<any> {
  try {
    const addressResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!addressResponse.ok) throw new Error(\`HTTP \${addressResponse.status}\`);
    const addressInfo = await addressResponse.json();
    
    const creationTxHash = addressInfo.creation_tx_hash;
    if (!creationTxHash) return { error: 'No creation tx found' };
    
    const txResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/transactions/\${creationTxHash}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!txResponse.ok) throw new Error(\`HTTP \${txResponse.status}\`);
    const txData = await txResponse.json();
    
    const creator = txData.from?.hash;
    const mintTransfer = (txData.token_transfers || []).find((t: any) => 
      t.from?.hash === '0x0000000000000000000000000000000000000000' &&
      t.to?.hash?.toLowerCase() === creator?.toLowerCase() &&
      t.token?.address?.toLowerCase() === tokenAddress.toLowerCase()
    );
    
    if (!mintTransfer) return { error: 'No initial mint to creator found' };
    
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    
    const initialSupply = Number(mintTransfer.total?.value || 0);
    const totalSupply = Number(tokenData.total_supply || 0);
    const decimals = Number(tokenData.decimals || 18);
    const percentage = totalSupply > 0 ? (initialSupply / totalSupply) * 100 : 0;
    const readable = initialSupply / Math.pow(10, decimals);
    
    return {
      creator,
      initialSupply,
      readable,
      formatted: readable.toLocaleString(),
      percentage,
      percentageFormatted: \`\${percentage.toFixed(2)}%\`
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getCreatorInitialSupply('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'creatorCurrentBalance') {
    return `async function getCreatorCurrentBalance(tokenAddress: string): Promise<any> {
  try {
    const addressResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!addressResponse.ok) throw new Error(\`HTTP \${addressResponse.status}\`);
    const addressInfo = await addressResponse.json();
    
    const creatorAddress = addressInfo.creator_address_hash;
    if (!creatorAddress) return { error: 'No creator address found' };
    
    const balanceResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${creatorAddress}/token-balances?token=\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!balanceResponse.ok) throw new Error(\`HTTP \${balanceResponse.status}\`);
    const balances = await balanceResponse.json();
    
    const tokenBalance = balances.find((b: any) => b.token?.address?.toLowerCase() === tokenAddress.toLowerCase());
    
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const decimals = Number(tokenData.decimals || 18);
    
    const balance = Number(tokenBalance?.value || 0);
    const readable = balance / Math.pow(10, decimals);
    
    return {
      creatorAddress,
      balance,
      readable,
      formatted: readable.toLocaleString()
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getCreatorCurrentBalance('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'ownershipStatus') {
    return `async function getOwnershipStatus(tokenAddress: string): Promise<any> {
  try {
    const addressResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!addressResponse.ok) throw new Error(\`HTTP \${addressResponse.status}\`);
    const addressInfo = await addressResponse.json();
    
    const creatorAddress = addressInfo.creator_address_hash;
    if (!creatorAddress) return { error: 'No creator address found' };
    
    const txResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${creatorAddress}/transactions\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!txResponse.ok) throw new Error(\`HTTP \${txResponse.status}\`);
    const txData = await txResponse.json();
    
    const renouncedTx = (txData.items || []).find((tx: any) => 
      tx.method?.toLowerCase() === 'renounceownership'
    );
    
    if (renouncedTx) {
      return {
        status: 'Renounced',
        transaction: renouncedTx.hash,
        timestamp: renouncedTx.timestamp
      };
    } else {
      return { status: 'Not Renounced' };
    }
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getOwnershipStatus('${tokenAddress}').then(console.log);`;
  }
  
  // WHALE COUNT STATS (TypeScript)
  if (statId === 'whaleCount1Pct') {
    return `async function getWhaleCount1Pct(tokenAddress: string): Promise<{ whaleCount: number; threshold: number; thresholdPercentage: string }> {
  try {
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const totalSupply = Number(tokenData.total_supply || 0);
    const threshold = totalSupply * 0.01;
    
    let whaleCount = 0;
    let nextParams: any = null;
    let page = 0;
    
    while (page < 200) {
      const params = new URLSearchParams({ limit: '50' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, String(value)));
      }
      
      const holdersResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/holders?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!holdersResponse.ok) throw new Error(\`HTTP \${holdersResponse.status}\`);
      
      const holdersData = await holdersResponse.json();
      const items = holdersData.items || [];
      
      for (const item of items) {
        if (Number(item.value || 0) >= threshold) {
          whaleCount++;
        }
      }
      
      if (!holdersData.next_page_params) break;
      nextParams = holdersData.next_page_params;
      page++;
    }
    
    return {
      whaleCount,
      threshold,
      thresholdPercentage: '1%'
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getWhaleCount1Pct('${tokenAddress}').then(console.log);`;
  }
  
  // ADDITIONAL HOLDER STATS (TypeScript)
  if (statId === 'avgHolderBalance') {
    return `async function getAvgHolderBalance(tokenAddress: string): Promise<{ avgBalance: number; readable: number; formatted: string; holderCount: number }> {
  try {
    const BURN_ADDRESSES = [
      '0x000000000000000000000000000000000000dead',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000369',
      '0x000000000000000000000000000000000000dead'
    ].map(addr => addr.toLowerCase());
    
    const [tokenResponse, countersResponse] = await Promise.all([
      fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
        headers: { 'accept': 'application/json' }
      }),
      fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/counters\`, {
        headers: { 'accept': 'application/json' }
      })
    ]);
    
    if (!tokenResponse.ok || !countersResponse.ok) throw new Error('HTTP error');
    
    const tokenData = await tokenResponse.json();
    const countersData = await countersResponse.json();
    
    const totalSupply = Number(tokenData.total_supply || 0);
    const decimals = Number(tokenData.decimals || 18);
    const holderCount = Number(countersData.token_holders_count || 0);
    
    let totalBurned = 0;
    let nextParams: any = null;
    let page = 0;
    
    while (page < 200) {
      const params = new URLSearchParams({ limit: '50' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, String(value)));
      }
      
      const holdersResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/holders?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      const holdersData = await holdersResponse.json();
      const items = holdersData.items || [];
      
      for (const item of items) {
        const addr = item.address?.hash?.toLowerCase();
        if (addr && BURN_ADDRESSES.includes(addr)) {
          totalBurned += Number(item.value || 0);
        }
      }
      
      if (!holdersData.next_page_params) break;
      nextParams = holdersData.next_page_params;
      page++;
    }
    
    const circulatingSupply = totalSupply - totalBurned;
    const avgBalance = holderCount > 0 ? circulatingSupply / holderCount : 0;
    const readableAvg = avgBalance / Math.pow(10, decimals);
    
    return {
      avgBalance,
      readable: readableAvg,
      formatted: readableAvg.toLocaleString(),
      holderCount
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getAvgHolderBalance('${tokenAddress}').then(console.log);`;
  }
  
  // MORE ON-CHAIN ACTIVITY STATS (TypeScript)
  if (statId === 'medianTransferValue24h') {
    return `async function getMedianTransferValue24h(tokenAddress: string): Promise<{ medianRaw: number; medianReadable: number; formatted: string; transferCount: number }> {
  try {
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const decimals = Number(tokenData.decimals || 18);
    
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const transferValues: number[] = [];
    let nextParams: any = null;
    let page = 0;
    
    while (page < 50) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, String(value)));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/transfers?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      for (const transfer of items) {
        if (transfer.timestamp && transfer.timestamp >= cutoff24h) {
          transferValues.push(Number(transfer.total?.value || 0));
        }
      }
      
      const lastTimestamp = items[items.length - 1]?.timestamp;
      if (lastTimestamp && lastTimestamp < cutoff24h) break;
      
      if (!data.next_page_params) break;
      nextParams = data.next_page_params;
      page++;
    }
    
    transferValues.sort((a, b) => a - b);
    const median = transferValues.length > 0 
      ? transferValues[Math.floor(transferValues.length / 2)] 
      : 0;
    const readable = median / Math.pow(10, decimals);
    
    return {
      medianRaw: median,
      medianReadable: readable,
      formatted: readable.toLocaleString(),
      transferCount: transferValues.length
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getMedianTransferValue24h('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'transactionVelocity') {
    return `async function getTransactionVelocity(tokenAddress: string): Promise<{ velocity: number; velocityPercent: number; formatted: string; transferVolume: number; circulatingSupply: number }> {
  try {
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const totalSupply = Number(tokenData.total_supply || 0);
    
    const BURN_ADDRESSES = [
      '0x000000000000000000000000000000000000dead',
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000002',
      '0x0000000000000000000000000000000000000369',
      '0x000000000000000000000000000000000000dead'
    ];
    
    let burnedTotal = 0;
    let nextHolderParams: any = null;
    let holderPage = 0;
    
    while (holderPage < 50) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextHolderParams) {
        Object.entries(nextHolderParams).forEach(([key, value]) => params.set(key, String(value)));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/holders?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      for (const holder of items) {
        if (BURN_ADDRESSES.includes(holder.address.hash.toLowerCase())) {
          burnedTotal += Number(holder.value || 0);
        }
      }
      
      if (!data.next_page_params) break;
      nextHolderParams = data.next_page_params;
      holderPage++;
    }
    
    const circulatingSupply = totalSupply - burnedTotal;
    if (circulatingSupply === 0) {
      return { velocity: 0, velocityPercent: 0, formatted: '0%', transferVolume: 0, circulatingSupply: 0 };
    }
    
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let transferVolume = 0;
    let nextTransferParams: any = null;
    let transferPage = 0;
    
    while (transferPage < 50) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextTransferParams) {
        Object.entries(nextTransferParams).forEach(([key, value]) => params.set(key, String(value)));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/transfers?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      for (const transfer of items) {
        if (transfer.timestamp && transfer.timestamp >= cutoff24h) {
          transferVolume += Number(transfer.total?.value || 0);
        }
      }
      
      const lastTimestamp = items[items.length - 1]?.timestamp;
      if (lastTimestamp && lastTimestamp < cutoff24h) break;
      
      if (!data.next_page_params) break;
      nextTransferParams = data.next_page_params;
      transferPage++;
    }
    
    const velocity = transferVolume / circulatingSupply;
    const velocityPct = velocity * 100;
    
    return {
      velocity: velocity,
      velocityPercent: velocityPct,
      formatted: velocityPct.toFixed(2) + '%',
      transferVolume,
      circulatingSupply
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getTransactionVelocity('${tokenAddress}').then(console.log);`;
  }
  
  // ADDITIONAL ON-CHAIN ACTIVITY STATS (TypeScript)
  if (statId === 'uniqueSenders24h' || statId === 'uniqueReceivers24h') {
    const field = statId === 'uniqueSenders24h' ? 'from' : 'to';
    const funcName = statId === 'uniqueSenders24h' ? 'getUniqueSenders24h' : 'getUniqueReceivers24h';
    const resultKey = statId === 'uniqueSenders24h' ? 'uniqueSenders' : 'uniqueReceivers';
    
    return `async function ${funcName}(tokenAddress: string): Promise<{ ${resultKey}: number; formatted: string }> {
  try {
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const uniqueAddresses = new Set<string>();
    let nextParams: any = null;
    let page = 0;
    
    while (page < 50) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, String(value)));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/transfers?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      for (const transfer of items) {
        if (transfer.timestamp && transfer.timestamp >= cutoff24h) {
          const address = transfer.${field}?.hash?.toLowerCase();
          if (address) uniqueAddresses.add(address);
        }
      }
      
      const lastTimestamp = items[items.length - 1]?.timestamp;
      if (lastTimestamp && lastTimestamp < cutoff24h) break;
      
      if (!data.next_page_params) break;
      nextParams = data.next_page_params;
      page++;
    }
    
    return {
      ${resultKey}: uniqueAddresses.size,
      formatted: uniqueAddresses.size.toLocaleString()
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// ${funcName}('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'avgTransferValue24h') {
    return `async function getAvgTransferValue24h(tokenAddress: string): Promise<{ avgRaw: number; avgReadable: number; formatted: string; transferCount: number }> {
  try {
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const decimals = Number(tokenData.decimals || 18);
    
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const transferValues: number[] = [];
    let nextParams: any = null;
    let page = 0;
    
    while (page < 50) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, String(value)));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/transfers?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      for (const transfer of items) {
        if (transfer.timestamp && transfer.timestamp >= cutoff24h) {
          transferValues.push(Number(transfer.total?.value || 0));
        }
      }
      
      const lastTimestamp = items[items.length - 1]?.timestamp;
      if (lastTimestamp && lastTimestamp < cutoff24h) break;
      
      if (!data.next_page_params) break;
      nextParams = data.next_page_params;
      page++;
    }
    
    const avg = transferValues.length > 0 
      ? transferValues.reduce((a, b) => a + b, 0) / transferValues.length 
      : 0;
    const readable = avg / Math.pow(10, decimals);
    
    return {
      avgRaw: avg,
      avgReadable: readable,
      formatted: readable.toLocaleString(),
      transferCount: transferValues.length
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getAvgTransferValue24h('${tokenAddress}').then(console.log);`;
  }
  
  // LEGACY STATS (TypeScript)
  if (statId === 'tokensBurned') {
    return `async function getTokensBurned(tokenAddress: string): Promise<{ totalBurned: number; formatted: string }> {
  try {
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const decimals = Number(tokenData.decimals || 18);
    
    const burnAddresses = [
      '0x000000000000000000000000000000000000dEaD',
      '0x0000000000000000000000000000000000000369',
      '0x0000000000000000000000000000000000000000'
    ];
    
    let totalBurned = 0;
    
    for (const burnAddress of burnAddresses) {
      try {
        const response = await fetch(\`https://api.scan.pulsechain.com/api?module=account&action=tokenbalance&contractaddress=\${tokenAddress}&address=\${burnAddress}\`);
        if (!response.ok) continue;
        
        const data = await response.json();
        const rawAmount = parseInt(data.result || '0');
        const burnedAmount = rawAmount / Math.pow(10, decimals);
        totalBurned += burnedAmount;
      } catch (error) {
        continue;
      }
    }
    
    return {
      totalBurned: totalBurned,
      formatted: totalBurned.toLocaleString(undefined, { maximumFractionDigits: 0 })
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getTokensBurned('${tokenAddress}').then(console.log);`;
  }
  
  // REMAINING STATS (TypeScript)
  if (statId === 'tokenBalance') {
    return `async function getTokenBalance(tokenAddress: string, walletAddress: string): Promise<{ balanceRaw: number; balanceReadable: number; formatted: string }> {
  try {
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const decimals = Number(tokenData.decimals || 18);
    
    const balanceResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${walletAddress}/token-balances?token=\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!balanceResponse.ok) throw new Error(\`HTTP \${balanceResponse.status}\`);
    
    const balanceData = await balanceResponse.json();
    const tokenBalance = balanceData.find((item: any) => 
      item.token?.address?.toLowerCase() === tokenAddress.toLowerCase()
    );
    
    if (!tokenBalance) {
      return {
        balanceRaw: 0,
        balanceReadable: 0,
        formatted: '0'
      };
    }
    
    const rawBalance = Number(tokenBalance.value || 0);
    const readable = rawBalance / Math.pow(10, decimals);
    
    return {
      balanceRaw: rawBalance,
      balanceReadable: readable,
      formatted: readable.toLocaleString()
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getTokenBalance('${tokenAddress}', '0xYourWalletAddress').then(console.log);`;
  }
  
  if (statId === 'abiComplexity') {
    return `async function getAbiComplexity(tokenAddress: string): Promise<{ complexity: number; totalAbiItems: number; formatted: string }> {
  try {
    const addressResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!addressResponse.ok) throw new Error(\`HTTP \${addressResponse.status}\`);
    const addressData = await addressResponse.json();
    const creatorAddress = addressData.creator_address_hash;
    
    if (!creatorAddress) {
      return { complexity: 0, totalAbiItems: 0, formatted: '0 functions' };
    }
    
    const contractResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/smart-contracts/\${creatorAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!contractResponse.ok) throw new Error(\`HTTP \${contractResponse.status}\`);
    
    const contractData = await contractResponse.json();
    const abi = contractData.abi || [];
    
    const functionCount = abi.filter((item: any) => item.type === 'function').length;
    
    return {
      complexity: functionCount,
      totalAbiItems: abi.length,
      formatted: \`\${functionCount} functions\`
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getAbiComplexity('${tokenAddress}').then(console.log);`;
  }
  
  // CREATOR ANALYSIS EXTENDED (TypeScript)
  if (statId === 'creatorFirst5Outbound') {
    return `async function getCreatorFirst5Outbound(tokenAddress: string): Promise<{ creatorAddress: string; first5Outbound: Array<any> }> {
  try {
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const addressData = await tokenResponse.json();
    const creatorAddress = addressData.creator_address_hash;
    
    if (!creatorAddress) {
      return { creatorAddress: '', first5Outbound: [] };
    }
    
    const txResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${creatorAddress}/transactions\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!txResponse.ok) throw new Error(\`HTTP \${txResponse.status}\`);
    
    const txData = await txResponse.json();
    const allTxs = txData.items || [];
    
    const outboundTxs = allTxs.filter((tx: any) => 
      tx.from?.hash?.toLowerCase() === creatorAddress.toLowerCase()
    );
    
    const first5 = outboundTxs.slice(0, 5).map((tx: any) => ({
      hash: tx.hash,
      to: tx.to?.hash,
      value: (Number(tx.value) / 1e18).toFixed(4) + ' PLS',
      method: tx.method || 'transfer',
      timestamp: tx.timestamp
    }));
    
    return {
      creatorAddress,
      first5Outbound: first5
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getCreatorFirst5Outbound('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'creatorTokenHistory') {
    return `async function getCreatorTokenHistory(tokenAddress: string): Promise<{ creatorAddress: string; tokenAddress: string; transferCount: number; history: Array<any> }> {
  try {
    const addressResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!addressResponse.ok) throw new Error(\`HTTP \${addressResponse.status}\`);
    const addressData = await addressResponse.json();
    const creatorAddress = addressData.creator_address_hash;
    
    if (!creatorAddress) {
      return { creatorAddress: '', tokenAddress, transferCount: 0, history: [] };
    }
    
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const decimals = Number(tokenData.decimals || 18);
    
    const allTransfers: any[] = [];
    let nextParams: any = null;
    let page = 0;
    
    while (page < 200) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, String(value)));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/addresses/\${creatorAddress}/token-transfers?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      allTransfers.push(...items);
      
      if (!data.next_page_params) break;
      nextParams = data.next_page_params;
      page++;
    }
    
    const relevantTransfers = allTransfers.filter(t => 
      t.token?.address?.toLowerCase() === tokenAddress.toLowerCase()
    );
    
    const history = relevantTransfers.map(t => {
      const isOutbound = t.from?.hash?.toLowerCase() === creatorAddress.toLowerCase();
      const value = Number(t.total?.value || 0) / Math.pow(10, decimals);
      
      return {
        timestamp: t.timestamp,
        direction: isOutbound ? 'OUT' : 'IN',
        counterparty: isOutbound ? t.to?.hash : t.from?.hash,
        value: value.toFixed(4),
        txHash: t.tx_hash
      };
    });
    
    return {
      creatorAddress,
      tokenAddress,
      transferCount: history.length,
      history
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getCreatorTokenHistory('${tokenAddress}').then(console.log);`;
  }
  
  // ADDITIONAL HOLDER STATS DETAILED (TypeScript)
  if (statId === 'top50Holders') {
    return `async function getTop50Holders(tokenAddress: string): Promise<Array<{ rank: number; address: string; balanceRaw: string; balanceReadable: number; percentage: string }>> {
  try {
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const totalSupply = Number(tokenData.total_supply || 0);
    const decimals = Number(tokenData.decimals || 18);
    
    const allHolders: any[] = [];
    let nextParams: any = null;
    let page = 0;
    
    while (page < 50) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, String(value)));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/holders?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      allHolders.push(...items);
      
      if (!data.next_page_params) break;
      nextParams = data.next_page_params;
      page++;
    }
    
    allHolders.sort((a, b) => Number(b.value) - Number(a.value));
    const top50 = allHolders.slice(0, 50);
    
    const result = top50.map((holder, index) => {
      const balance = Number(holder.value);
      const percentage = totalSupply > 0 ? (balance / totalSupply) * 100 : 0;
      const readable = balance / Math.pow(10, decimals);
      
      return {
        rank: index + 1,
        address: holder.address.hash,
        balanceRaw: holder.value,
        balanceReadable: readable,
        percentage: percentage.toFixed(4) + '%'
      };
    });
    
    return result;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getTop50Holders('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'giniCoefficient') {
    return `async function getGiniCoefficient(tokenAddress: string): Promise<{ gini: number; formatted: string; holderCount: number }> {
  try {
    const allHolders: any[] = [];
    let nextParams: any = null;
    let page = 0;
    
    while (page < 50) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, String(value)));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/holders?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      allHolders.push(...items);
      
      if (!data.next_page_params) break;
      nextParams = data.next_page_params;
      page++;
    }
    
    if (allHolders.length < 2) {
      return { gini: 0, formatted: '0.0000', holderCount: allHolders.length };
    }
    
    const values = allHolders.map(h => Number(h.value)).sort((a, b) => a - b);
    const n = values.length;
    
    let sumOfDifferences = 0;
    for (let i = 0; i < n; i++) {
      sumOfDifferences += (2 * (i + 1) - n - 1) * values[i];
    }
    
    const totalValue = values.reduce((sum, val) => sum + val, 0);
    
    if (totalValue === 0) {
      return { gini: 0, formatted: '0.0000', holderCount: n };
    }
    
    const gini = sumOfDifferences / (n * totalValue);
    
    return {
      gini: gini,
      formatted: gini.toFixed(4),
      holderCount: n
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getGiniCoefficient('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'newVsLostHolders7d') {
    return `async function getNewVsLostHolders7d(tokenAddress: string): Promise<{ newHolders: number; lostHolders: number; netChange: number; formatted: string }> {
  try {
    const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const transfers: any[] = [];
    let nextParams: any = null;
    let page = 0;
    
    while (page < 50) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, String(value)));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/transfers?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      for (const transfer of items) {
        if (transfer.timestamp && transfer.timestamp >= cutoff7d) {
          transfers.push(transfer);
        }
      }
      
      const lastTimestamp = items[items.length - 1]?.timestamp;
      if (lastTimestamp && lastTimestamp < cutoff7d) break;
      
      if (!data.next_page_params) break;
      nextParams = data.next_page_params;
      page++;
    }
    
    if (transfers.length === 0) {
      return {
        newHolders: 0,
        lostHolders: 0,
        netChange: 0,
        formatted: '0/0 (0)'
      };
    }
    
    const addressActivity = new Map<string, { sent: boolean; received: boolean }>();
    
    for (const transfer of transfers) {
      const fromAddr = transfer.from?.hash?.toLowerCase();
      const toAddr = transfer.to?.hash?.toLowerCase();
      
      if (fromAddr) {
        if (!addressActivity.has(fromAddr)) {
          addressActivity.set(fromAddr, { sent: false, received: false });
        }
        addressActivity.get(fromAddr)!.sent = true;
      }
      
      if (toAddr) {
        if (!addressActivity.has(toAddr)) {
          addressActivity.set(toAddr, { sent: false, received: false });
        }
        addressActivity.get(toAddr)!.received = true;
      }
    }
    
    let newHolders = 0;
    let lostHolders = 0;
    
    for (const [addr, activity] of addressActivity) {
      if (activity.received && !activity.sent) {
        newHolders++;
      }
      if (activity.sent && !activity.received) {
        lostHolders++;
      }
    }
    
    const netChange = newHolders - lostHolders;
    
    return {
      newHolders,
      lostHolders,
      netChange,
      formatted: \`\${newHolders}/\${lostHolders} (\${netChange})\`
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getNewVsLostHolders7d('${tokenAddress}').then(console.log);`;
  }
  
  // ADVANCED MARKET STATS (TypeScript)
  if (statId === 'blueChipPairRatio') {
    return `async function getBlueChipPairRatio(tokenAddress: string): Promise<{ ratio: number; totalLiquidity: number; blueChipLiquidity: number; formatted: string }> {
  try {
    const BLUE_CHIP_ADDRESSES = new Set([
      '0xa1077a294dde1b09bb078844df40758a5d0f9a27', // WPLS
      '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', // HEX
      '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07', // USDC
      '0xefd766ccb38eaf1dfd701853bfce31359239f305'  // DAI
    ]);
    
    const response = await fetch(\`https://api.dexscreener.com/latest/dex/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
    
    const data = await response.json();
    const pairs = data.pairs || [];
    
    if (pairs.length === 0) {
      return {
        ratio: 0,
        totalLiquidity: 0,
        blueChipLiquidity: 0,
        formatted: '0%'
      };
    }
    
    let totalLiquidity = 0;
    let blueChipLiquidity = 0;
    
    for (const pair of pairs) {
      const liquidityUsd = Number(pair.liquidity?.usd || 0);
      totalLiquidity += liquidityUsd;
      
      const quoteAddress = pair.quoteToken?.address?.toLowerCase();
      if (quoteAddress && BLUE_CHIP_ADDRESSES.has(quoteAddress)) {
        blueChipLiquidity += liquidityUsd;
      }
    }
    
    const ratio = totalLiquidity > 0 ? (blueChipLiquidity / totalLiquidity) * 100 : 0;
    
    return {
      ratio: ratio,
      totalLiquidity: totalLiquidity,
      blueChipLiquidity: blueChipLiquidity,
      formatted: ratio.toFixed(2) + '%'
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getBlueChipPairRatio('${tokenAddress}').then(console.log);`;
  }
  
  if (statId === 'diamondHandsScore') {
    return `async function getDiamondHandsScore(tokenAddress: string): Promise<{ score90d: number; score180d: number; formatted: string }> {
  try {
    const cutoff180d = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    
    const allTransfers: any[] = [];
    let nextParams: any = null;
    let page = 0;
    
    while (page < 200) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextParams) {
        Object.entries(nextParams).forEach(([key, value]) => params.set(key, String(value)));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/transfers?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      allTransfers.push(...items);
      
      const lastTimestamp = items[items.length - 1]?.timestamp;
      if (lastTimestamp && lastTimestamp < cutoff180d) break;
      
      if (!data.next_page_params) break;
      nextParams = data.next_page_params;
      page++;
    }
    
    const activeWallets180d = new Set<string>();
    const activeWallets90d = new Set<string>();
    
    for (const transfer of allTransfers) {
      const fromAddr = transfer.from?.hash?.toLowerCase();
      if (!fromAddr) continue;
      
      if (transfer.timestamp >= cutoff180d) {
        activeWallets180d.add(fromAddr);
      }
      if (transfer.timestamp >= cutoff90d) {
        activeWallets90d.add(fromAddr);
      }
    }
    
    const tokenResponse = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}\`, {
      headers: { 'accept': 'application/json' }
    });
    if (!tokenResponse.ok) throw new Error(\`HTTP \${tokenResponse.status}\`);
    const tokenData = await tokenResponse.json();
    const totalSupply = Number(tokenData.total_supply || 0);
    
    const holders: any[] = [];
    let nextHolderParams: any = null;
    let holderPage = 0;
    
    while (holderPage < 50) {
      const params = new URLSearchParams({ limit: '200' });
      if (nextHolderParams) {
        Object.entries(nextHolderParams).forEach(([key, value]) => params.set(key, String(value)));
      }
      
      const response = await fetch(\`https://api.scan.pulsechain.com/api/v2/tokens/\${tokenAddress}/holders?\${params}\`, {
        headers: { 'accept': 'application/json' }
      });
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      
      const data = await response.json();
      const items = data.items || [];
      if (items.length === 0) break;
      
      holders.push(...items);
      
      if (!data.next_page_params) break;
      nextHolderParams = data.next_page_params;
      holderPage++;
    }
    
    let unmoved90d = 0;
    let unmoved180d = 0;
    
    for (const holder of holders) {
      const addr = holder.address?.hash?.toLowerCase();
      if (!addr) continue;
      
      const balance = Number(holder.value || 0);
      
      if (!activeWallets90d.has(addr)) {
        unmoved90d += balance;
      }
      if (!activeWallets180d.has(addr)) {
        unmoved180d += balance;
      }
    }
    
    const score90d = totalSupply > 0 ? (unmoved90d / totalSupply) * 100 : 0;
    const score180d = totalSupply > 0 ? (unmoved180d / totalSupply) * 100 : 0;
    
    return {
      score90d: score90d,
      score180d: score180d,
      formatted: \`90d: \${score90d.toFixed(2)}%, 180d: \${score180d.toFixed(2)}%\`
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

// Usage:
// getDiamondHandsScore('${tokenAddress}').then(console.log);`;
  }
  
  // FALLBACK
  return `// API mapping not yet created for stat: ${statId}`;
}

/**
 * Generate Python example using REAL API endpoints - ONE complete executable function
 */
function generateRealPythonExample(endpoints: ApiEndpoint[], parameters: StatParameter[], statId: string): string {
  const tokenAddress = parameters.find(p => p.key === 'address')?.example || '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e';
  const walletAddress = parameters.find(p => p.key === 'walletAddress')?.example;
  
  // Generate based on specific stat implementation
  return generateCompletePythonForStat(statId, tokenAddress, walletAddress);
}

/**
 * Generate complete, working Python for specific stats
 */
function generateCompletePythonForStat(statId: string, tokenAddress: string, walletAddress?: string): string {
  // TOTAL SUPPLY
  if (statId === 'totalSupply') {
    return `import requests

def get_total_supply(token_address):
    """
    Fetches total supply for a token from Blockscout API
    """
    try:
        response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        response.raise_for_status()
        
        data = response.json()
        total_supply = data['total_supply']
        decimals = int(data.get('decimals', 18))
        readable_supply = int(total_supply) / (10 ** decimals)
        
        return {
            'raw': total_supply,
            'decimals': decimals,
            'formatted': '{:,.2f}'.format(readable_supply)
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_total_supply('${tokenAddress}')
# print(result)`;
  }
  
  // HOLDERS
  if (statId === 'holders') {
    return `import requests

def get_holders(token_address):
    """
    Fetches holder count from Blockscout API
    Tries counters endpoint first, falls back to token info
    """
    try:
        response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}/counters',
            headers={'accept': 'application/json'}
        )
        
        if response.ok:
            counters = response.json()
            if 'token_holders_count' in counters:
                count = int(counters['token_holders_count'])
                return {
                    'count': count,
                    'formatted': f'{count:,}',
                    'source': 'counters'
                }
        
        token_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        token_response.raise_for_status()
        
        token_data = token_response.json()
        holders_count = int(token_data.get('holders', 0))
        
        return {
            'count': holders_count,
            'formatted': f'{holders_count:,}',
            'source': 'token_info'
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_holders('${tokenAddress}')
# print(result)`;
  }
  
  // BURNED 24H
  if (statId === 'burned24h') {
    return `import requests
from datetime import datetime, timedelta

def get_burned_24h(token_address):
    """
    Fetches tokens burned in last 24h by checking transfers to burn addresses
    """
    try:
        BURN_ADDRESSES = [
            '0x000000000000000000000000000000000000dead',
            '0x0000000000000000000000000000000000000000',
            '0x0000000000000000000000000000000000000002',
            '0x0000000000000000000000000000000000000369',
            '0x000000000000000000000000000000000000dead'
        ]
        burn_addresses_lower = [addr.lower() for addr in BURN_ADDRESSES]
        
        # Step 1: Get token info
        token_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        
        decimals = int(token_data.get('decimals', 18))
        total_supply = int(token_data.get('total_supply', 0))
        
        # Step 2: Get transfers from last 24 hours (paginated)
        cutoff_24h = (datetime.now() - timedelta(days=1)).isoformat()
        all_transfers = []
        next_params = None
        page = 0
        max_pages = 50
        
        while page < max_pages:
            params = {'limit': '200'}
            if next_params:
                params.update(next_params)
            
            transfers_response = requests.get(
                f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}/transfers',
                params=params,
                headers={'accept': 'application/json'}
            )
            transfers_response.raise_for_status()
            transfers_data = transfers_response.json()
            
            items = transfers_data.get('items', [])
            if not items:
                break
            
            # Filter transfers within 24h
            for transfer in items:
                if transfer.get('timestamp') and transfer['timestamp'] >= cutoff_24h:
                    all_transfers.append(transfer)
            
            # Check if we've gone past 24h
            last_timestamp = items[-1].get('timestamp')
            if last_timestamp and last_timestamp < cutoff_24h:
                break
            
            if not transfers_data.get('next_page_params'):
                break
            next_params = transfers_data['next_page_params']
            page += 1
        
        # Step 3: Filter for transfers TO burn addresses and sum
        total_burned = 0
        burn_transfer_count = 0
        for transfer in all_transfers:
            to_address = transfer.get('to', {}).get('hash', '').lower()
            if to_address in burn_addresses_lower:
                total_burned += int(transfer.get('total', {}).get('value', 0))
                burn_transfer_count += 1
        
        burned_readable = total_burned / (10 ** decimals)
        burned_percent = (total_burned / total_supply * 100) if total_supply > 0 else 0
        
        return {
            'raw': total_burned,
            'readable': burned_readable,
            'formatted': '{:,.2f}'.format(burned_readable),
            'percent': burned_percent,
            'percent_formatted': '{:.2f}%'.format(burned_percent),
            'transfer_count': burn_transfer_count
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_burned_24h('${tokenAddress}')
# print(result)`;
  }
  
  // MINTED 24H
  if (statId === 'minted24h') {
    return `import requests
from datetime import datetime, timedelta

def get_minted_24h(token_address):
    """
    Fetches tokens minted in last 24h (transfers FROM token contract)
    """
    try:
        # Step 1: Get token info
        token_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        
        decimals = int(token_data.get('decimals', 18))
        
        # Step 2: Get transfers from last 24 hours (paginated)
        cutoff_24h = (datetime.now() - timedelta(days=1)).isoformat()
        all_transfers = []
        next_params = None
        page = 0
        max_pages = 50
        
        while page < max_pages:
            params = {'limit': '200'}
            if next_params:
                params.update(next_params)
            
            transfers_response = requests.get(
                f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}/transfers',
                params=params,
                headers={'accept': 'application/json'}
            )
            transfers_response.raise_for_status()
            transfers_data = transfers_response.json()
            
            items = transfers_data.get('items', [])
            if not items:
                break
            
            # Filter transfers within 24h
            for transfer in items:
                if transfer.get('timestamp') and transfer['timestamp'] >= cutoff_24h:
                    all_transfers.append(transfer)
            
            # Check if we've gone past 24h
            last_timestamp = items[-1].get('timestamp')
            if last_timestamp and last_timestamp < cutoff_24h:
                break
            
            if not transfers_data.get('next_page_params'):
                break
            next_params = transfers_data['next_page_params']
            page += 1
        
        # Step 3: Filter for mints (transfers FROM token contract) and sum
        total_minted = 0
        mint_transfer_count = 0
        for transfer in all_transfers:
            from_address = transfer.get('from', {}).get('hash', '').lower()
            if from_address == token_address.lower():
                total_minted += int(transfer.get('total', {}).get('value', 0))
                mint_transfer_count += 1
        
        minted_readable = total_minted / (10 ** decimals)
        
        return {
            'raw': total_minted,
            'readable': minted_readable,
            'formatted': '{:,.2f}'.format(minted_readable),
            'transfer_count': mint_transfer_count
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_minted_24h('${tokenAddress}')
# print(result)`;
  }
  
  // BURNED TOTAL
  if (statId === 'burnedTotal') {
    return `import requests

def get_burned_total(token_address):
    """
    Fetches total burned tokens by finding ALL burn/dead addresses
    """
    try:
        BURN_ADDRESSES = [
            '0x000000000000000000000000000000000000dead',
            '0x0000000000000000000000000000000000000000',
            '0x0000000000000000000000000000000000000002',
            '0x0000000000000000000000000000000000000369',
            '0x000000000000000000000000000000000000dead'
        ]
        burn_addresses_lower = [addr.lower() for addr in BURN_ADDRESSES]
        
        # Step 1: Get token info
        token_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        
        decimals = int(token_data.get('decimals', 18))
        total_supply = int(token_data.get('total_supply', 0))
        
        # Step 2: Get all holders (paginated)
        all_holders = []
        next_params = None
        page = 0
        max_pages = 200
        
        while page < max_pages:
            params = {'limit': '50'}
            if next_params:
                params.update(next_params)
            
            holders_response = requests.get(
                f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}/holders',
                params=params,
                headers={'accept': 'application/json'}
            )
            holders_response.raise_for_status()
            holders_data = holders_response.json()
            
            items = holders_data.get('items', [])
            for item in items:
                all_holders.append({
                    'address': item.get('address', {}).get('hash'),
                    'value': item.get('value')
                })
            
            if not holders_data.get('next_page_params'):
                break
            next_params = holders_data['next_page_params']
            page += 1
        
        # Step 3: Find ALL burn/dead addresses and sum their balances
        total_burned_raw = 0
        for holder in all_holders:
            holder_addr = holder.get('address', '').lower()
            if holder_addr in burn_addresses_lower:
                total_burned_raw += int(holder.get('value', 0))
        
        burned_readable = total_burned_raw / (10 ** decimals)
        burned_percent = (total_burned_raw / total_supply * 100) if total_supply > 0 else 0
        
        return {
            'raw': total_burned_raw,
            'readable': burned_readable,
            'formatted': '{:,.2f}'.format(burned_readable),
            'percent': burned_percent,
            'percent_formatted': '{:.2f}%'.format(burned_percent)
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_burned_total('${tokenAddress}')
# print(result)`;
  }
  
  // HOLDER DISTRIBUTION STATS (Python)
  if (statId === 'top1Pct' || statId === 'top10Pct' || statId === 'top20Pct' || statId === 'top50Pct') {
    const topCounts = { top1Pct: 1, top10Pct: 10, top20Pct: 20, top50Pct: 50 };
    const topCount = topCounts[statId as keyof typeof topCounts];
    return `import requests

def get_${statId.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')}(token_address):
    """
    Fetches percentage of supply held by top ${topCount} holders
    """
    try:
        # Step 1: Get total supply
        token_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        total_supply = int(token_data.get('total_supply', 0))
        
        # Step 2: Get all holders
        all_holders = []
        next_params = None
        page = 0
        
        while page < 200:
            params = {'limit': '50'}
            if next_params:
                params.update(next_params)
            
            holders_response = requests.get(
                f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}/holders',
                params=params,
                headers={'accept': 'application/json'}
            )
            holders_response.raise_for_status()
            holders_data = holders_response.json()
            
            items = holders_data.get('items', [])
            for item in items:
                all_holders.append({
                    'address': item.get('address', {}).get('hash'),
                    'value': int(item.get('value', 0))
                })
            
            if not holders_data.get('next_page_params'):
                break
            next_params = holders_data['next_page_params']
            page += 1
        
        # Step 3: Sort and calculate top ${topCount}
        all_holders.sort(key=lambda h: h['value'], reverse=True)
        top_sum = sum(h['value'] for h in all_holders[:${topCount}])
        percentage = (top_sum / total_supply * 100) if total_supply > 0 else 0
        
        return {
            'percentage': percentage,
            'formatted': '{:.2f}%'.format(percentage),
            'top_holder_count': ${topCount},
            'total_holders': len(all_holders)
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_${statId.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')}('${tokenAddress}')
# print(result)`;
  }
  
  // SIMPLE METADATA STATS (Python)
  if (statId === 'address') {
    return `def get_address(token_address):
    """Returns the token address"""
    return {
        'address': token_address,
        'formatted': token_address
    }

# Usage:
# result = get_address('${tokenAddress}')
# print(result)`;
  }
  
  if (statId === 'symbol' || statId === 'name') {
    const fieldName = statId;
    return `import requests

def get_${fieldName}(token_address):
    """
    Fetches token ${fieldName} from Blockscout
    """
    try:
        response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        response.raise_for_status()
        data = response.json()
        return {
            '${fieldName}': data.get('${fieldName}')
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_${fieldName}('${tokenAddress}')
# print(result)`;
  }
  
  if (statId === 'iconUrl') {
    return `import requests

def get_icon_url(token_address):
    """
    Fetches token icon URL from DexScreener or Blockscout
    """
    try:
        # Try DexScreener first
        dex_response = requests.get(
            f'https://api.dexscreener.com/latest/dex/tokens/{token_address}'
        )
        if dex_response.ok:
            dex_data = dex_response.json()
            icon_url = dex_data.get('pairs', [{}])[0].get('info', {}).get('imageUrl')
            if icon_url:
                return {'icon_url': icon_url, 'source': 'dexscreener'}
        
        # Fallback to Blockscout
        token_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        return {
            'icon_url': token_data.get('icon_url'),
            'source': 'blockscout'
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_icon_url('${tokenAddress}')
# print(result)`;
  }
  
  // TRANSFER STATS (Python)
  if (statId === 'transfersTotal') {
    return `import requests

def get_transfers_total(token_address):
    """
    Fetches total transfer count from Blockscout counters
    """
    try:
        response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}/counters',
            headers={'accept': 'application/json'}
        )
        response.raise_for_status()
        data = response.json()
        transfers_count = int(data.get('transfers_count', 0))
        
        return {
            'count': transfers_count,
            'formatted': f'{transfers_count:,}'
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_transfers_total('${tokenAddress}')
# print(result)`;
  }
  
  if (statId === 'transfers24h') {
    return `import requests
from datetime import datetime, timedelta

def get_transfers_24h(token_address):
    """
    Counts transfers in last 24 hours
    """
    try:
        cutoff_24h = (datetime.now() - timedelta(days=1)).isoformat()
        transfer_count = 0
        next_params = None
        page = 0
        
        while page < 50:
            params = {'limit': '200'}
            if next_params:
                params.update(next_params)
            
            response = requests.get(
                f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}/transfers',
                params=params,
                headers={'accept': 'application/json'}
            )
            response.raise_for_status()
            data = response.json()
            
            items = data.get('items', [])
            if not items:
                break
            
            for transfer in items:
                if transfer.get('timestamp') and transfer['timestamp'] >= cutoff_24h:
                    transfer_count += 1
            
            last_timestamp = items[-1].get('timestamp')
            if last_timestamp and last_timestamp < cutoff_24h:
                break
            
            if not data.get('next_page_params'):
                break
            next_params = data['next_page_params']
            page += 1
        
        return {
            'count': transfer_count,
            'formatted': f'{transfer_count:,}'
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_transfers_24h('${tokenAddress}')
# print(result)`;
  }
  
  // MARKET & LIQUIDITY STATS (Python)
  if (statId === 'priceUsd') {
    return `import requests

def get_price_usd(token_address):
    """
    Fetches current USD price from DexScreener
    """
    try:
        response = requests.get(
            f'https://api.dexscreener.com/latest/dex/tokens/{token_address}'
        )
        response.raise_for_status()
        data = response.json()
        price_usd = data.get('pairs', [{}])[0].get('priceUsd')
        
        return {
            'price_usd': float(price_usd) if price_usd else None,
            'formatted': '$' + '{:,.6f}'.format(float(price_usd)) if price_usd else 'N/A'
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_price_usd('${tokenAddress}')
# print(result)`;
  }
  
  if (statId === 'liquidityUsd') {
    return `import requests

def get_liquidity_usd(token_address):
    """
    Fetches liquidity in USD from DexScreener (first pair)
    """
    try:
        response = requests.get(
            f'https://api.dexscreener.com/latest/dex/tokens/{token_address}'
        )
        response.raise_for_status()
        data = response.json()
        liquidity_usd = int(data.get('pairs', [{}])[0].get('liquidity', {}).get('usd', 0))
        
        return {
            'liquidity_usd': liquidity_usd,
            'formatted': '$' + '{:,}'.format(liquidity_usd)
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_liquidity_usd('${tokenAddress}')
# print(result)`;
  }
  
  if (statId === 'totalLiquidityUsd') {
    return `import requests

def get_total_liquidity_usd(token_address):
    """
    Fetches total liquidity across all pairs from DexScreener
    """
    try:
        response = requests.get(
            f'https://api.dexscreener.com/latest/dex/tokens/{token_address}'
        )
        response.raise_for_status()
        data = response.json()
        pairs = data.get('pairs', [])
        total_liquidity_usd = sum(int(pair.get('liquidity', {}).get('usd', 0)) for pair in pairs)
        
        return {
            'total_liquidity_usd': total_liquidity_usd,
            'formatted': '$' + '{:,}'.format(total_liquidity_usd),
            'pair_count': len(pairs)
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_total_liquidity_usd('${tokenAddress}')
# print(result)`;
  }
  
  if (statId === 'totalTokensInLiquidity') {
    return `import requests

def get_total_tokens_in_liquidity(token_address):
    """
    Fetches total token amount in liquidity pools
    """
    try:
        # Get decimals from Blockscout
        token_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        decimals = int(token_data.get('decimals', 18))
        
        # Get liquidity from DexScreener
        dex_response = requests.get(
            f'https://api.dexscreener.com/latest/dex/tokens/{token_address}'
        )
        dex_response.raise_for_status()
        dex_data = dex_response.json()
        pairs = dex_data.get('pairs', [])
        total_base_tokens = sum(int(pair.get('liquidity', {}).get('base', 0)) for pair in pairs)
        readable_amount = total_base_tokens / (10 ** decimals)
        
        return {
            'raw': total_base_tokens,
            'readable': readable_amount,
            'formatted': f'{readable_amount:,}',
            'pair_count': len(pairs)
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_total_tokens_in_liquidity('${tokenAddress}')
# print(result)`;
  }
  
  // CREATOR ANALYSIS STATS (Python)
  if (statId === 'creatorInitialSupply') {
    return `import requests

def get_creator_initial_supply(token_address):
    """
    Fetches creator's initial supply from creation transaction
    """
    try:
        # Get address info for creation tx
        address_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/addresses/{token_address}',
            headers={'accept': 'application/json'}
        )
        address_response.raise_for_status()
        address_info = address_response.json()
        
        creation_tx_hash = address_info.get('creation_tx_hash')
        if not creation_tx_hash:
            return {'error': 'No creation tx found'}
        
        # Get creation transaction
        tx_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/transactions/{creation_tx_hash}',
            headers={'accept': 'application/json'}
        )
        tx_response.raise_for_status()
        tx_data = tx_response.json()
        
        creator = tx_data.get('from', {}).get('hash')
        token_transfers = tx_data.get('token_transfers', [])
        
        # Find initial mint to creator
        mint_transfer = next((t for t in token_transfers if 
            t.get('from', {}).get('hash') == '0x0000000000000000000000000000000000000000' and
            t.get('to', {}).get('hash', '').lower() == creator.lower() and
            t.get('token', {}).get('address', '').lower() == token_address.lower()
        ), None)
        
        if not mint_transfer:
            return {'error': 'No initial mint to creator found'}
        
        # Get token info
        token_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        
        initial_supply = int(mint_transfer.get('total', {}).get('value', 0))
        total_supply = int(token_data.get('total_supply', 0))
        decimals = int(token_data.get('decimals', 18))
        percentage = (initial_supply / total_supply * 100) if total_supply > 0 else 0
        readable = initial_supply / (10 ** decimals)
        
        return {
            'creator': creator,
            'initial_supply': initial_supply,
            'readable': readable,
            'formatted': f'{readable:,}',
            'percentage': percentage,
            'percentage_formatted': '{:.2f}%'.format(percentage)
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_creator_initial_supply('${tokenAddress}')
# print(result)`;
  }
  
  if (statId === 'creatorCurrentBalance') {
    return `import requests

def get_creator_current_balance(token_address):
    """
    Fetches creator's current token balance
    """
    try:
        # Get creator address
        address_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/addresses/{token_address}',
            headers={'accept': 'application/json'}
        )
        address_response.raise_for_status()
        address_info = address_response.json()
        
        creator_address = address_info.get('creator_address_hash')
        if not creator_address:
            return {'error': 'No creator address found'}
        
        # Get creator's token balances
        balance_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/addresses/{creator_address}/token-balances',
            params={'token': token_address},
            headers={'accept': 'application/json'}
        )
        balance_response.raise_for_status()
        balances = balance_response.json()
        
        token_balance = next((b for b in balances if 
            b.get('token', {}).get('address', '').lower() == token_address.lower()
        ), None)
        
        # Get decimals
        token_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        decimals = int(token_data.get('decimals', 18))
        
        balance = int(token_balance.get('value', 0)) if token_balance else 0
        readable = balance / (10 ** decimals)
        
        return {
            'creator_address': creator_address,
            'balance': balance,
            'readable': readable,
            'formatted': f'{readable:,}'
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_creator_current_balance('${tokenAddress}')
# print(result)`;
  }
  
  if (statId === 'ownershipStatus') {
    return `import requests

def get_ownership_status(token_address):
    """
    Checks if contract ownership has been renounced
    """
    try:
        # Get creator address
        address_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/addresses/{token_address}',
            headers={'accept': 'application/json'}
        )
        address_response.raise_for_status()
        address_info = address_response.json()
        
        creator_address = address_info.get('creator_address_hash')
        if not creator_address:
            return {'error': 'No creator address found'}
        
        # Get creator's transactions
        tx_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/addresses/{creator_address}/transactions',
            headers={'accept': 'application/json'}
        )
        tx_response.raise_for_status()
        tx_data = tx_response.json()
        
        renounced_tx = next((tx for tx in tx_data.get('items', []) if 
            tx.get('method', '').lower() == 'renounceownership'
        ), None)
        
        if renounced_tx:
            return {
                'status': 'Renounced',
                'transaction': renounced_tx.get('hash'),
                'timestamp': renounced_tx.get('timestamp')
            }
        else:
            return {'status': 'Not Renounced'}
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_ownership_status('${tokenAddress}')
# print(result)`;
  }
  
  // WHALE COUNT STATS (Python)
  if (statId === 'whaleCount1Pct') {
    return `import requests

def get_whale_count_1_pct(token_address):
    """
    Counts holders that own more than 1% of total supply
    """
    try:
        # Get total supply
        token_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        total_supply = int(token_data.get('total_supply', 0))
        threshold = total_supply * 0.01
        
        # Get all holders and count whales
        whale_count = 0
        next_params = None
        page = 0
        
        while page < 200:
            params = {'limit': '50'}
            if next_params:
                params.update(next_params)
            
            holders_response = requests.get(
                f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}/holders',
                params=params,
                headers={'accept': 'application/json'}
            )
            holders_response.raise_for_status()
            holders_data = holders_response.json()
            
            items = holders_data.get('items', [])
            for item in items:
                if int(item.get('value', 0)) >= threshold:
                    whale_count += 1
            
            if not holders_data.get('next_page_params'):
                break
            next_params = holders_data['next_page_params']
            page += 1
        
        return {
            'whale_count': whale_count,
            'threshold': threshold,
            'threshold_percentage': '1%'
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_whale_count_1_pct('${tokenAddress}')
# print(result)`;
  }
  
  // ADDITIONAL HOLDER STATS (Python)
  if (statId === 'avgHolderBalance') {
    return `import requests

def get_avg_holder_balance(token_address):
    """
    Calculates average holder balance (excluding burned tokens)
    """
    try:
        BURN_ADDRESSES = [
            '0x000000000000000000000000000000000000dead',
            '0x0000000000000000000000000000000000000000',
            '0x0000000000000000000000000000000000000002',
            '0x0000000000000000000000000000000000000369',
            '0x000000000000000000000000000000000000dead'
        ]
        burn_addresses_lower = [addr.lower() for addr in BURN_ADDRESSES]
        
        # Get token info and counters
        token_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        counters_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}/counters',
            headers={'accept': 'application/json'}
        )
        token_response.raise_for_status()
        counters_response.raise_for_status()
        
        token_data = token_response.json()
        counters_data = counters_response.json()
        
        total_supply = int(token_data.get('total_supply', 0))
        decimals = int(token_data.get('decimals', 18))
        holder_count = int(counters_data.get('token_holders_count', 0))
        
        # Get burned tokens
        total_burned = 0
        next_params = None
        page = 0
        
        while page < 200:
            params = {'limit': '50'}
            if next_params:
                params.update(next_params)
            
            holders_response = requests.get(
                f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}/holders',
                params=params,
                headers={'accept': 'application/json'}
            )
            holders_response.raise_for_status()
            holders_data = holders_response.json()
            
            items = holders_data.get('items', [])
            for item in items:
                addr = item.get('address', {}).get('hash', '').lower()
                if addr in burn_addresses_lower:
                    total_burned += int(item.get('value', 0))
            
            if not holders_data.get('next_page_params'):
                break
            next_params = holders_data['next_page_params']
            page += 1
        
        circulating_supply = total_supply - total_burned
        avg_balance = (circulating_supply / holder_count) if holder_count > 0 else 0
        readable_avg = avg_balance / (10 ** decimals)
        
        return {
            'avg_balance': avg_balance,
            'readable': readable_avg,
            'formatted': f'{readable_avg:,}',
            'holder_count': holder_count
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_avg_holder_balance('${tokenAddress}')
# print(result)`;
  }
  
  // MORE ON-CHAIN ACTIVITY STATS (Python)
  if (statId === 'medianTransferValue24h') {
    return `import requests
from datetime import datetime, timedelta

def get_median_transfer_value_24h(token_address):
    """
    Calculates median transfer value in last 24h
    """
    try:
        # Get decimals
        token_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        decimals = int(token_data.get('decimals', 18))
        
        # Get 24h transfers
        cutoff_24h = (datetime.now() - timedelta(days=1)).isoformat()
        transfer_values = []
        next_params = None
        page = 0
        
        while page < 50:
            params = {'limit': '200'}
            if next_params:
                params.update(next_params)
            
            response = requests.get(
                f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}/transfers',
                params=params,
                headers={'accept': 'application/json'}
            )
            response.raise_for_status()
            data = response.json()
            
            items = data.get('items', [])
            if not items:
                break
            
            for transfer in items:
                if transfer.get('timestamp') and transfer['timestamp'] >= cutoff_24h:
                    value = int(transfer.get('total', {}).get('value', 0))
                    transfer_values.append(value)
            
            last_timestamp = items[-1].get('timestamp')
            if last_timestamp and last_timestamp < cutoff_24h:
                break
            
            if not data.get('next_page_params'):
                break
            next_params = data['next_page_params']
            page += 1
        
        # Calculate median
        transfer_values.sort()
        median = transfer_values[len(transfer_values) // 2] if transfer_values else 0
        readable = median / (10 ** decimals)
        
        return {
            'median_raw': median,
            'median_readable': readable,
            'formatted': f'{readable:,}',
            'transfer_count': len(transfer_values)
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_median_transfer_value_24h('${tokenAddress}')
# print(result)`;
  }
  
  if (statId === 'transactionVelocity') {
    return `import requests
from datetime import datetime, timedelta

def get_transaction_velocity(token_address):
    """
    Calculates transaction velocity (24h volume / circulating supply)
    """
    try:
        # Get token info
        token_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        total_supply = int(token_data.get('total_supply', 0))
        
        # Get burned tokens
        BURN_ADDRESSES = [
            '0x000000000000000000000000000000000000dead',
            '0x0000000000000000000000000000000000000000',
            '0x0000000000000000000000000000000000000002',
            '0x0000000000000000000000000000000000000369',
            '0x000000000000000000000000000000000000dead'
        ]
        
        burned_total = 0
        next_holder_params = None
        holder_page = 0
        
        while holder_page < 50:
            params = {'limit': '200'}
            if next_holder_params:
                params.update(next_holder_params)
            
            response = requests.get(
                f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}/holders',
                params=params,
                headers={'accept': 'application/json'}
            )
            response.raise_for_status()
            data = response.json()
            
            items = data.get('items', [])
            if not items:
                break
            
            for holder in items:
                if holder.get('address', {}).get('hash', '').lower() in BURN_ADDRESSES:
                    burned_total += int(holder.get('value', 0))
            
            if not data.get('next_page_params'):
                break
            next_holder_params = data['next_page_params']
            holder_page += 1
        
        circulating_supply = total_supply - burned_total
        if circulating_supply == 0:
            return {'velocity': 0, 'velocity_percent': 0, 'formatted': '0%'}
        
        # Get 24h transfer volume
        cutoff_24h = (datetime.now() - timedelta(days=1)).isoformat()
        transfer_volume = 0
        next_transfer_params = None
        transfer_page = 0
        
        while transfer_page < 50:
            params = {'limit': '200'}
            if next_transfer_params:
                params.update(next_transfer_params)
            
            response = requests.get(
                f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}/transfers',
                params=params,
                headers={'accept': 'application/json'}
            )
            response.raise_for_status()
            data = response.json()
            
            items = data.get('items', [])
            if not items:
                break
            
            for transfer in items:
                if transfer.get('timestamp') and transfer['timestamp'] >= cutoff_24h:
                    transfer_volume += int(transfer.get('total', {}).get('value', 0))
            
            last_timestamp = items[-1].get('timestamp')
            if last_timestamp and last_timestamp < cutoff_24h:
                break
            
            if not data.get('next_page_params'):
                break
            next_transfer_params = data['next_page_params']
            transfer_page += 1
        
        velocity = transfer_volume / circulating_supply
        velocity_pct = velocity * 100
        
        return {
            'velocity': velocity,
            'velocity_percent': velocity_pct,
            'formatted': '{:.2f}%'.format(velocity_pct),
            'transfer_volume': transfer_volume,
            'circulating_supply': circulating_supply
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_transaction_velocity('${tokenAddress}')
# print(result)`;
  }
  
  // ADDITIONAL ON-CHAIN ACTIVITY STATS (Python)
  if (statId === 'uniqueSenders24h') {
    return `import requests
from datetime import datetime, timedelta

def get_unique_senders_24h(token_address):
    """
    Counts unique sender addresses in last 24h
    """
    try:
        cutoff_24h = (datetime.now() - timedelta(days=1)).isoformat()
        unique_senders = set()
        next_params = None
        page = 0
        
        while page < 50:
            params = {'limit': '200'}
            if next_params:
                params.update(next_params)
            
            response = requests.get(
                f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}/transfers',
                params=params,
                headers={'accept': 'application/json'}
            )
            response.raise_for_status()
            data = response.json()
            
            items = data.get('items', [])
            if not items:
                break
            
            for transfer in items:
                if transfer.get('timestamp') and transfer['timestamp'] >= cutoff_24h:
                    from_address = transfer.get('from', {}).get('hash', '').lower()
                    if from_address:
                        unique_senders.add(from_address)
            
            last_timestamp = items[-1].get('timestamp')
            if last_timestamp and last_timestamp < cutoff_24h:
                break
            
            if not data.get('next_page_params'):
                break
            next_params = data['next_page_params']
            page += 1
        
        return {
            'unique_senders': len(unique_senders),
            'formatted': f'{len(unique_senders):,}'
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_unique_senders_24h('${tokenAddress}')
# print(result)`;
  }
  
  if (statId === 'uniqueReceivers24h') {
    return `import requests
from datetime import datetime, timedelta

def get_unique_receivers_24h(token_address):
    """
    Counts unique receiver addresses in last 24h
    """
    try:
        cutoff_24h = (datetime.now() - timedelta(days=1)).isoformat()
        unique_receivers = set()
        next_params = None
        page = 0
        
        while page < 50:
            params = {'limit': '200'}
            if next_params:
                params.update(next_params)
            
            response = requests.get(
                f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}/transfers',
                params=params,
                headers={'accept': 'application/json'}
            )
            response.raise_for_status()
            data = response.json()
            
            items = data.get('items', [])
            if not items:
                break
            
            for transfer in items:
                if transfer.get('timestamp') and transfer['timestamp'] >= cutoff_24h:
                    to_address = transfer.get('to', {}).get('hash', '').lower()
                    if to_address:
                        unique_receivers.add(to_address)
            
            last_timestamp = items[-1].get('timestamp')
            if last_timestamp and last_timestamp < cutoff_24h:
                break
            
            if not data.get('next_page_params'):
                break
            next_params = data['next_page_params']
            page += 1
        
        return {
            'unique_receivers': len(unique_receivers),
            'formatted': f'{len(unique_receivers):,}'
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_unique_receivers_24h('${tokenAddress}')
# print(result)`;
  }
  
  if (statId === 'avgTransferValue24h') {
    return `import requests
from datetime import datetime, timedelta

def get_avg_transfer_value_24h(token_address):
    """
    Calculates average transfer value in last 24h
    """
    try:
        # Get decimals
        token_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        decimals = int(token_data.get('decimals', 18))
        
        # Get 24h transfers
        cutoff_24h = (datetime.now() - timedelta(days=1)).isoformat()
        transfer_values = []
        next_params = None
        page = 0
        
        while page < 50:
            params = {'limit': '200'}
            if next_params:
                params.update(next_params)
            
            response = requests.get(
                f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}/transfers',
                params=params,
                headers={'accept': 'application/json'}
            )
            response.raise_for_status()
            data = response.json()
            
            items = data.get('items', [])
            if not items:
                break
            
            for transfer in items:
                if transfer.get('timestamp') and transfer['timestamp'] >= cutoff_24h:
                    value = int(transfer.get('total', {}).get('value', 0))
                    transfer_values.append(value)
            
            last_timestamp = items[-1].get('timestamp')
            if last_timestamp and last_timestamp < cutoff_24h:
                break
            
            if not data.get('next_page_params'):
                break
            next_params = data['next_page_params']
            page += 1
        
        avg = sum(transfer_values) / len(transfer_values) if transfer_values else 0
        readable = avg / (10 ** decimals)
        
        return {
            'avg_raw': avg,
            'avg_readable': readable,
            'formatted': f'{readable:,}',
            'transfer_count': len(transfer_values)
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_avg_transfer_value_24h('${tokenAddress}')
# print(result)`;
  }
  
  // LEGACY STATS (Python)
  if (statId === 'tokensBurned') {
    return `import requests

def get_tokens_burned(token_address):
    """
    Gets total burned tokens using legacy API
    """
    try:
        # Get decimals
        token_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        decimals = int(token_data.get('decimals', 18))
        
        # Burn addresses
        burn_addresses = [
            '0x000000000000000000000000000000000000dEaD',
            '0x0000000000000000000000000000000000000369',
            '0x0000000000000000000000000000000000000000'
        ]
        
        total_burned = 0
        
        for burn_address in burn_addresses:
            try:
                response = requests.get(
                    f'https://api.scan.pulsechain.com/api',
                    params={
                        'module': 'account',
                        'action': 'tokenbalance',
                        'contractaddress': token_address,
                        'address': burn_address
                    }
                )
                response.raise_for_status()
                data = response.json()
                
                raw_amount = int(data.get('result', '0'))
                burned_amount = raw_amount / (10 ** decimals)
                total_burned += burned_amount
            except:
                continue
        
        return {
            'total_burned': total_burned,
            'formatted': '{:,.0f}'.format(total_burned)
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_tokens_burned('${tokenAddress}')
# print(result)`;
  }
  
  // REMAINING STATS (Python)
  if (statId === 'tokenBalance') {
    return `import requests

def get_token_balance(token_address, wallet_address):
    """
    Gets the token balance for a specific wallet
    """
    try:
        # Get decimals
        token_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        decimals = int(token_data.get('decimals', 18))
        
        # Get wallet balance
        balance_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/addresses/{wallet_address}/token-balances',
            params={'token': token_address},
            headers={'accept': 'application/json'}
        )
        balance_response.raise_for_status()
        balance_data = balance_response.json()
        
        # Find the specific token
        token_balance = None
        for item in balance_data:
            if item.get('token', {}).get('address', '').lower() == token_address.lower():
                token_balance = item
                break
        
        if not token_balance:
            return {
                'balance_raw': 0,
                'balance_readable': 0,
                'formatted': '0'
            }
        
        raw_balance = int(token_balance.get('value', 0))
        readable = raw_balance / (10 ** decimals)
        
        return {
            'balance_raw': raw_balance,
            'balance_readable': readable,
            'formatted': f'{readable:,}'
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_token_balance('${tokenAddress}', '0xYourWalletAddress')
# print(result)`;
  }
  
  if (statId === 'abiComplexity') {
    return `import requests

def get_abi_complexity(token_address):
    """
    Calculates ABI complexity by counting functions
    """
    try:
        # Get creator address
        address_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/addresses/{token_address}',
            headers={'accept': 'application/json'}
        )
        address_response.raise_for_status()
        address_data = address_response.json()
        creator_address = address_data.get('creator_address_hash')
        
        if not creator_address:
            return {
                'complexity': 0,
                'total_abi_items': 0,
                'formatted': '0 functions',
                'error': 'No creator address found'
            }
        
        # Get smart contract ABI
        contract_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/smart-contracts/{creator_address}',
            headers={'accept': 'application/json'}
        )
        contract_response.raise_for_status()
        contract_data = contract_response.json()
        abi = contract_data.get('abi', [])
        
        # Count functions
        function_count = sum(1 for item in abi if item.get('type') == 'function')
        
        return {
            'complexity': function_count,
            'total_abi_items': len(abi),
            'formatted': f'{function_count} functions'
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_abi_complexity('${tokenAddress}')
# print(result)`;
  }
  
  // CREATOR ANALYSIS EXTENDED (Python)
  if (statId === 'creatorFirst5Outbound') {
    return `import requests

def get_creator_first_5_outbound(token_address):
    """
    Gets the first 5 outbound transactions from creator's wallet
    """
    try:
        # Get creator address
        token_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/addresses/{token_address}',
            headers={'accept': 'application/json'}
        )
        token_response.raise_for_status()
        address_data = token_response.json()
        creator_address = address_data.get('creator_address_hash')
        
        if not creator_address:
            return {'error': 'No creator address found'}
        
        # Get creator's transactions
        tx_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/addresses/{creator_address}/transactions',
            headers={'accept': 'application/json'}
        )
        tx_response.raise_for_status()
        tx_data = tx_response.json()
        
        all_txs = tx_data.get('items', [])
        
        # Filter for outbound
        outbound_txs = [
            tx for tx in all_txs 
            if tx.get('from', {}).get('hash', '').lower() == creator_address.lower()
        ]
        
        # Take first 5
        first_5 = []
        for tx in outbound_txs[:5]:
            first_5.append({
                'hash': tx.get('hash'),
                'to': tx.get('to', {}).get('hash'),
                'value': f"{(int(tx.get('value', 0)) / 1e18):.4f} PLS",
                'method': tx.get('method', 'transfer'),
                'timestamp': tx.get('timestamp')
            })
        
        return {
            'creator_address': creator_address,
            'first_5_outbound': first_5
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_creator_first_5_outbound('${tokenAddress}')
# print(result)`;
  }
  
  if (statId === 'creatorTokenHistory') {
    return `import requests

def get_creator_token_history(token_address):
    """
    Gets creator's full transaction history for the token
    """
    try:
        # Get creator address
        address_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/addresses/{token_address}',
            headers={'accept': 'application/json'}
        )
        address_response.raise_for_status()
        address_data = address_response.json()
        creator_address = address_data.get('creator_address_hash')
        
        if not creator_address:
            return {'error': 'No creator address found'}
        
        # Get decimals
        token_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        decimals = int(token_data.get('decimals', 18))
        
        # Get all token transfers
        all_transfers = []
        next_params = None
        page = 0
        
        while page < 200:
            params = {'limit': '200'}
            if next_params:
                params.update(next_params)
            
            response = requests.get(
                f'https://api.scan.pulsechain.com/api/v2/addresses/{creator_address}/token-transfers',
                params=params,
                headers={'accept': 'application/json'}
            )
            response.raise_for_status()
            data = response.json()
            
            items = data.get('items', [])
            if not items:
                break
            
            all_transfers.extend(items)
            
            if not data.get('next_page_params'):
                break
            next_params = data['next_page_params']
            page += 1
        
        # Filter for this token
        relevant_transfers = [
            t for t in all_transfers 
            if t.get('token', {}).get('address', '').lower() == token_address.lower()
        ]
        
        history = []
        for t in relevant_transfers:
            is_outbound = t.get('from', {}).get('hash', '').lower() == creator_address.lower()
            value = int(t.get('total', {}).get('value', 0)) / (10 ** decimals)
            
            history.append({
                'timestamp': t.get('timestamp'),
                'direction': 'OUT' if is_outbound else 'IN',
                'counterparty': t.get('to', {}).get('hash') if is_outbound else t.get('from', {}).get('hash'),
                'value': '{:.4f}'.format(value),
                'tx_hash': t.get('tx_hash')
            })
        
        return {
            'creator_address': creator_address,
            'token_address': token_address,
            'transfer_count': len(history),
            'history': history
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_creator_token_history('${tokenAddress}')
# print(result)`;
  }
  
  // ADDITIONAL HOLDER STATS DETAILED (Python)
  if (statId === 'top50Holders') {
    return `import requests

def get_top_50_holders(token_address):
    """
    Gets the top 50 token holders with their balances
    """
    try:
        # Get token info
        token_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        total_supply = int(token_data.get('total_supply', 0))
        decimals = int(token_data.get('decimals', 18))
        
        # Get all holders
        all_holders = []
        next_params = None
        page = 0
        
        while page < 50:
            params = {'limit': '200'}
            if next_params:
                params.update(next_params)
            
            response = requests.get(
                f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}/holders',
                params=params,
                headers={'accept': 'application/json'}
            )
            response.raise_for_status()
            data = response.json()
            
            items = data.get('items', [])
            if not items:
                break
            
            all_holders.extend(items)
            
            if not data.get('next_page_params'):
                break
            next_params = data['next_page_params']
            page += 1
        
        # Sort and get top 50
        all_holders.sort(key=lambda h: int(h.get('value', 0)), reverse=True)
        top_50 = all_holders[:50]
        
        result = []
        for index, holder in enumerate(top_50):
            balance = int(holder.get('value', 0))
            percentage = (balance / total_supply * 100) if total_supply > 0 else 0
            readable = balance / (10 ** decimals)
            
            result.append({
                'rank': index + 1,
                'address': holder.get('address', {}).get('hash'),
                'balance_raw': holder.get('value'),
                'balance_readable': readable,
                'percentage': '{:.4f}%'.format(percentage)
            })
        
        return result
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_top_50_holders('${tokenAddress}')
# print(result)`;
  }
  
  if (statId === 'giniCoefficient') {
    return `import requests

def get_gini_coefficient(token_address):
    """
    Calculates Gini coefficient to measure holder inequality
    """
    try:
        # Get all holders
        all_holders = []
        next_params = None
        page = 0
        
        while page < 50:
            params = {'limit': '200'}
            if next_params:
                params.update(next_params)
            
            response = requests.get(
                f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}/holders',
                params=params,
                headers={'accept': 'application/json'}
            )
            response.raise_for_status()
            data = response.json()
            
            items = data.get('items', [])
            if not items:
                break
            
            all_holders.extend(items)
            
            if not data.get('next_page_params'):
                break
            next_params = data['next_page_params']
            page += 1
        
        if len(all_holders) < 2:
            return {
                'gini': 0,
                'formatted': '0.0000',
                'holder_count': len(all_holders)
            }
        
        # Extract and sort values
        values = sorted([int(h.get('value', 0)) for h in all_holders])
        n = len(values)
        
        # Calculate Gini coefficient
        sum_of_differences = 0
        for i in range(n):
            sum_of_differences += (2 * (i + 1) - n - 1) * values[i]
        
        total_value = sum(values)
        
        if total_value == 0:
            return {
                'gini': 0,
                'formatted': '0.0000',
                'holder_count': n
            }
        
        gini = sum_of_differences / (n * total_value)
        
        return {
            'gini': gini,
            'formatted': '{:.4f}'.format(gini),
            'holder_count': n
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_gini_coefficient('${tokenAddress}')
# print(result)`;
  }
  
  if (statId === 'newVsLostHolders7d') {
    return `import requests
from datetime import datetime, timedelta

def get_new_vs_lost_holders_7d(token_address):
    """
    Counts new vs lost holders in the last 7 days
    """
    try:
        cutoff_7d = (datetime.now() - timedelta(days=7)).isoformat()
        transfers = []
        next_params = None
        page = 0
        
        while page < 50:
            params = {'limit': '200'}
            if next_params:
                params.update(next_params)
            
            response = requests.get(
                f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}/transfers',
                params=params,
                headers={'accept': 'application/json'}
            )
            response.raise_for_status()
            data = response.json()
            
            items = data.get('items', [])
            if not items:
                break
            
            for transfer in items:
                if transfer.get('timestamp') and transfer['timestamp'] >= cutoff_7d:
                    transfers.append(transfer)
            
            last_timestamp = items[-1].get('timestamp')
            if last_timestamp and last_timestamp < cutoff_7d:
                break
            
            if not data.get('next_page_params'):
                break
            next_params = data['next_page_params']
            page += 1
        
        if not transfers:
            return {
                'new_holders': 0,
                'lost_holders': 0,
                'net_change': 0,
                'formatted': '0/0 (0)'
            }
        
        # Track address activity
        address_activity = {}
        
        for transfer in transfers:
            from_addr = transfer.get('from', {}).get('hash', '').lower()
            to_addr = transfer.get('to', {}).get('hash', '').lower()
            
            if from_addr:
                if from_addr not in address_activity:
                    address_activity[from_addr] = {'sent': False, 'received': False}
                address_activity[from_addr]['sent'] = True
            
            if to_addr:
                if to_addr not in address_activity:
                    address_activity[to_addr] = {'sent': False, 'received': False}
                address_activity[to_addr]['received'] = True
        
        # Count new and lost holders
        new_holders = 0
        lost_holders = 0
        
        for addr, activity in address_activity.items():
            if activity['received'] and not activity['sent']:
                new_holders += 1
            if activity['sent'] and not activity['received']:
                lost_holders += 1
        
        net_change = new_holders - lost_holders
        
        return {
            'new_holders': new_holders,
            'lost_holders': lost_holders,
            'net_change': net_change,
            'formatted': f'{new_holders}/{lost_holders} ({net_change})'
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_new_vs_lost_holders_7d('${tokenAddress}')
# print(result)`;
  }
  
  // ADVANCED MARKET STATS (Python)
  if (statId === 'blueChipPairRatio') {
    return `import requests

def get_blue_chip_pair_ratio(token_address):
    """
    Calculates ratio of liquidity in blue chip pairs
    """
    try:
        BLUE_CHIP_ADDRESSES = {
            '0xa1077a294dde1b09bb078844df40758a5d0f9a27',  # WPLS
            '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39',  # HEX
            '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07',  # USDC
            '0xefd766ccb38eaf1dfd701853bfce31359239f305'   # DAI
        }
        
        response = requests.get(
            f'https://api.dexscreener.com/latest/dex/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        response.raise_for_status()
        data = response.json()
        
        pairs = data.get('pairs', [])
        if not pairs:
            return {
                'ratio': 0,
                'total_liquidity': 0,
                'blue_chip_liquidity': 0,
                'formatted': '0%'
            }
        
        total_liquidity = 0
        blue_chip_liquidity = 0
        
        for pair in pairs:
            liquidity_usd = float(pair.get('liquidity', {}).get('usd', 0))
            total_liquidity += liquidity_usd
            
            quote_address = pair.get('quoteToken', {}).get('address', '').lower()
            if quote_address in BLUE_CHIP_ADDRESSES:
                blue_chip_liquidity += liquidity_usd
        
        ratio = (blue_chip_liquidity / total_liquidity * 100) if total_liquidity > 0 else 0
        
        return {
            'ratio': ratio,
            'total_liquidity': total_liquidity,
            'blue_chip_liquidity': blue_chip_liquidity,
            'formatted': '{:.2f}%'.format(ratio)
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_blue_chip_pair_ratio('${tokenAddress}')
# print(result)`;
  }
  
  if (statId === 'diamondHandsScore') {
    return `import requests
from datetime import datetime, timedelta

def get_diamond_hands_score(token_address):
    """
    Calculates percentage of tokens unmoved in 90 and 180 days
    """
    try:
        cutoff_180d = (datetime.now() - timedelta(days=180)).isoformat()
        cutoff_90d = (datetime.now() - timedelta(days=90)).isoformat()
        
        # Get transfers for 180 days
        all_transfers = []
        next_params = None
        page = 0
        
        while page < 200:
            params = {'limit': '200'}
            if next_params:
                params.update(next_params)
            
            response = requests.get(
                f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}/transfers',
                params=params,
                headers={'accept': 'application/json'}
            )
            response.raise_for_status()
            data = response.json()
            
            items = data.get('items', [])
            if not items:
                break
            
            all_transfers.extend(items)
            
            last_timestamp = items[-1].get('timestamp')
            if last_timestamp and last_timestamp < cutoff_180d:
                break
            
            if not data.get('next_page_params'):
                break
            next_params = data['next_page_params']
            page += 1
        
        # Find active wallets
        active_wallets_180d = set()
        active_wallets_90d = set()
        
        for transfer in all_transfers:
            from_addr = transfer.get('from', {}).get('hash', '').lower()
            if not from_addr:
                continue
            
            timestamp = transfer.get('timestamp')
            if timestamp >= cutoff_180d:
                active_wallets_180d.add(from_addr)
            if timestamp >= cutoff_90d:
                active_wallets_90d.add(from_addr)
        
        # Get token info
        token_response = requests.get(
            f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}',
            headers={'accept': 'application/json'}
        )
        token_response.raise_for_status()
        token_data = token_response.json()
        total_supply = int(token_data.get('total_supply', 0))
        
        # Get all holders
        holders = []
        next_holder_params = None
        holder_page = 0
        
        while holder_page < 50:
            params = {'limit': '200'}
            if next_holder_params:
                params.update(next_holder_params)
            
            response = requests.get(
                f'https://api.scan.pulsechain.com/api/v2/tokens/{token_address}/holders',
                params=params,
                headers={'accept': 'application/json'}
            )
            response.raise_for_status()
            data = response.json()
            
            items = data.get('items', [])
            if not items:
                break
            
            holders.extend(items)
            
            if not data.get('next_page_params'):
                break
            next_holder_params = data['next_page_params']
            holder_page += 1
        
        # Calculate unmoved tokens
        unmoved_90d = 0
        unmoved_180d = 0
        
        for holder in holders:
            addr = holder.get('address', {}).get('hash', '').lower()
            if not addr:
                continue
            
            balance = int(holder.get('value', 0))
            
            if addr not in active_wallets_90d:
                unmoved_90d += balance
            if addr not in active_wallets_180d:
                unmoved_180d += balance
        
        score_90d = (unmoved_90d / total_supply * 100) if total_supply > 0 else 0
        score_180d = (unmoved_180d / total_supply * 100) if total_supply > 0 else 0
        
        return {
            'score_90d': score_90d,
            'score_180d': score_180d,
            'formatted': '90d: {:.2f}%, 180d: {:.2f}%'.format(score_90d, score_180d)
        }
    except requests.exceptions.RequestException as e:
        print(f'Error: {e}')
        raise

# Usage:
# result = get_diamond_hands_score('${tokenAddress}')
# print(result)`;
  }
  
  // FALLBACK
  return `# API mapping not yet created for stat: ${statId}`;
}

/**
 * Convert string to PascalCase
 */
function toPascalCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

// Removed generic response schema - now showing real API responses per endpoint

/**
 * Generate HTTP status code documentation
 */
export function generateStatusCodes(): {
  code: number;
  status: string;
  description: string;
}[] {
  return [
    {
      code: 200,
      status: 'Success',
      description: 'Returns the stat data successfully'
    },
    {
      code: 400,
      status: 'Bad Request',
      description: 'Invalid token address or missing required parameters'
    },
    {
      code: 404,
      status: 'Not Found',
      description: 'Token not found or stat does not exist'
    },
    {
      code: 429,
      status: 'Too Many Requests',
      description: 'Rate limit exceeded. Please try again later.'
    },
    {
      code: 500,
      status: 'Internal Server Error',
      description: 'Server error while processing the request'
    }
  ];
}

