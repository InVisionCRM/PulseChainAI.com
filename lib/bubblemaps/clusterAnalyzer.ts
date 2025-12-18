import { WalletCluster, TransactionNode, TransactionEdge, TokenHolder, ClusteringOptions, ClusterAnalysis } from './types';

const PULSESCAN_BASE = 'https://api.scan.pulsechain.com/api/v2';

// Fetch top token holders
async function getTopHolders(tokenAddress: string, limit: number = 100): Promise<TokenHolder[]> {
  try {
    const response = await fetch(`${PULSESCAN_BASE}/tokens/${tokenAddress}/holders?limit=${limit}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch token holders: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.items) {
      return [];
    }

    // Calculate total supply for percentages
    const totalSupply = data.items.reduce((sum: number, holder: any) => sum + parseFloat(holder.value), 0);

    return data.items.map((holder: any) => ({
      address: holder.address.hash.toLowerCase(),
      balance: holder.value,
      percentage: totalSupply > 0 ? (parseFloat(holder.value) / totalSupply) * 100 : 0
    }));
  } catch (error) {
    console.error('Error fetching top holders:', error);
    return [];
  }
}

// Fetch token transfers for a specific address
async function getAddressTransfers(address: string, tokenAddress: string, daysBack: number): Promise<any[]> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    const cutoffIso = cutoffDate.toISOString();

    const params = new URLSearchParams({
      type: 'ERC-20',
      filter: 'to | from',
      limit: '1000'
    });

    if (tokenAddress) {
      params.append('token', tokenAddress);
    }

    const response = await fetch(`${PULSESCAN_BASE}/addresses/${address}/token-transfers?${params}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch transfers: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.items) {
      return [];
    }

    // Filter by date and token
    return data.items.filter((transfer: any) => {
      const transferDate = new Date(transfer.timestamp);
      return transferDate >= cutoffDate &&
             transfer.token?.address?.toLowerCase() === tokenAddress.toLowerCase();
    });
  } catch (error) {
    console.error(`Error fetching transfers for ${address}:`, error);
    return [];
  }
}

// Build transaction graph from transfer data
function buildTransactionGraph(
  topHolders: TokenHolder[],
  allTransfers: Map<string, any[]>
): Map<string, TransactionNode> {
  const graph = new Map<string, TransactionNode>();

  // Initialize nodes
  topHolders.forEach(holder => {
    graph.set(holder.address, {
      address: holder.address,
      balance: parseFloat(holder.balance),
      percentage: holder.percentage,
      connections: new Map(),
      totalVolume: 0,
      transactionCount: 0,
      riskScore: 0
    });
  });

  // Build connections
  const holderAddresses = new Set(topHolders.map(h => h.address));

  for (const [address, transfers] of allTransfers) {
    transfers.forEach((transfer: any) => {
      const fromAddr = transfer.from.hash.toLowerCase();
      const toAddr = transfer.to.hash.toLowerCase();

      // Only track connections between top holders
      if (holderAddresses.has(fromAddr) && holderAddresses.has(toAddr) && fromAddr !== toAddr) {
        const fromNode = graph.get(fromAddr)!;
        const toNode = graph.get(toAddr)!;

        const edge: TransactionEdge = {
          from: fromAddr,
          to: toAddr,
          amount: parseFloat(transfer.total.value),
          timestamp: transfer.timestamp,
          tokenAddress: transfer.token.address,
          hash: transfer.transaction_hash,
          blockNumber: transfer.block_number
        };

        // Add edge to from node's connections
        if (!fromNode.connections.has(toAddr)) {
          fromNode.connections.set(toAddr, []);
        }
        fromNode.connections.get(toAddr)!.push(edge);
        fromNode.totalVolume += edge.amount;
        fromNode.transactionCount++;
      }
    });
  }

  return graph;
}

// Detect patterns in transaction data
function detectPatterns(edges: TransactionEdge[]): string[] {
  const patterns: string[] = [];

  if (edges.length === 0) return patterns;

  // 1. Round number transactions (potential wash trading)
  const roundNumberTxs = edges.filter(edge => {
    const amount = edge.amount;
    const amountStr = amount.toString();
    // Check for round numbers (ends with many zeros)
    return amountStr.includes('000') && amountStr.length > 6;
  });

  if (roundNumberTxs.length > edges.length * 0.3) {
    patterns.push('High frequency of round number transactions');
  }

  // 2. Rapid back-and-forth trading
  const backAndForth: TransactionEdge[] = [];
  for (const edge of edges) {
    const reverseEdge = edges.find(e =>
      e.from === edge.to &&
      e.to === edge.from &&
      Math.abs(new Date(e.timestamp).getTime() - new Date(edge.timestamp).getTime()) < 3600000 // Within 1 hour
    );
    if (reverseEdge && !backAndForth.includes(reverseEdge)) {
      backAndForth.push(edge);
    }
  }

  if (backAndForth.length > 0) {
    patterns.push(`Rapid back-and-forth transactions (${backAndForth.length} pairs)`);
  }

  // 3. Similar transaction amounts
  const amounts = edges.map(e => e.amount).sort((a, b) => a - b);
  const median = amounts[Math.floor(amounts.length / 2)];
  const similarAmounts = amounts.filter(amount =>
    Math.abs(amount - median) / median < 0.1 // Within 10% of median
  );

  if (similarAmounts.length > edges.length * 0.5) {
    patterns.push('Unusually similar transaction amounts');
  }

  // 4. High frequency between same pairs
  const pairFrequency = new Map<string, number>();
  edges.forEach(edge => {
    const pair = [edge.from, edge.to].sort().join('-');
    pairFrequency.set(pair, (pairFrequency.get(pair) || 0) + 1);
  });

  const highFreqPairs = Array.from(pairFrequency.entries()).filter(([, freq]) => freq > 5);
  if (highFreqPairs.length > 0) {
    patterns.push(`High frequency trading (${highFreqPairs.length} wallet pairs)`);
  }

  return patterns;
}

// Assess risk indicators
function assessRiskIndicators(edges: TransactionEdge[], addresses: string[]): string[] {
  const indicators: string[] = [];

  // Central hub pattern (one wallet connected to many others)
  const connectionCounts = new Map<string, number>();
  addresses.forEach(addr => {
    const nodeConnections = new Set<string>();
    edges.forEach(edge => {
      if (edge.from === addr) nodeConnections.add(edge.to);
      if (edge.to === addr) nodeConnections.add(edge.from);
    });
    connectionCounts.set(addr, nodeConnections.size);
  });

  const maxConnections = Math.max(...connectionCounts.values());
  if (maxConnections > addresses.length * 0.4) {
    indicators.push('Central hub wallet detected');
  }

  // Time-based clustering (many transactions in short time)
  const timeWindows: { [key: string]: TransactionEdge[] } = {};
  edges.forEach(edge => {
    const hour = new Date(edge.timestamp).getHours();
    const day = new Date(edge.timestamp).toDateString();
    const key = `${day}-${hour}`;
    if (!timeWindows[key]) timeWindows[key] = [];
    timeWindows[key].push(edge);
  });

  const busyHours = Object.values(timeWindows).filter(window => window.length > 10);
  if (busyHours.length > 0) {
    indicators.push('High transaction volume in specific time windows');
  }

  return indicators;
}

// Find connected components (clusters) using DFS
function findClusters(graph: Map<string, TransactionNode>): WalletCluster[] {
  const clusters: WalletCluster[] = [];
  const processed = new Set<string>();

  for (const [address] of graph) {
    if (processed.has(address)) continue;

    const clusterAddresses = new Set<string>();
    const clusterEdges: TransactionEdge[] = [];

    // DFS to find connected component
    const stack = [address];
    clusterAddresses.add(address);

    while (stack.length > 0) {
      const currentAddr = stack.pop()!;
      processed.add(currentAddr);

      const currentNode = graph.get(currentAddr)!;

      // Check connections
      for (const [connectedAddr, edges] of currentNode.connections) {
        if (!clusterAddresses.has(connectedAddr)) {
          clusterAddresses.add(connectedAddr);
          stack.push(connectedAddr);
        }
        clusterEdges.push(...edges);
      }
    }

    if (clusterAddresses.size > 1) { // Only clusters with multiple addresses
      const cluster = analyzeCluster(Array.from(clusterAddresses), clusterEdges, graph);
      clusters.push(cluster);
    }
  }

  return clusters;
}

// Analyze individual cluster
function analyzeCluster(
  addresses: string[],
  edges: TransactionEdge[],
  graph: Map<string, TransactionNode>
): WalletCluster {
  const totalVolume = edges.reduce((sum, edge) => sum + edge.amount, 0);
  const transactionCount = edges.length;

  const patterns = detectPatterns(edges);
  const riskIndicators = assessRiskIndicators(edges, addresses);

  // Calculate risk score based on patterns and indicators
  let riskScore = 0;
  if (patterns.length > 0) riskScore += patterns.length * 20;
  if (riskIndicators.length > 0) riskScore += riskIndicators.length * 30;
  if (totalVolume > 1000000) riskScore += 25; // High volume cluster
  if (addresses.length > 10) riskScore += 15; // Large cluster

  riskScore = Math.min(riskScore, 100); // Cap at 100

  return {
    id: generateClusterId(addresses),
    addresses,
    connectionStrength: totalVolume,
    totalVolume,
    transactionCount,
    commonPatterns: patterns,
    riskIndicators,
    riskScore,
    nodes: addresses.map(addr => graph.get(addr)!).filter(Boolean),
    edges
  };
}

// Generate unique cluster ID
function generateClusterId(addresses: string[]): string {
  const sorted = [...addresses].sort();
  return sorted.slice(0, 3).map(addr => addr.slice(2, 6)).join('-');
}

// Main analysis function
export async function analyzeWalletClusters(options: ClusteringOptions): Promise<ClusterAnalysis> {
  console.log(`Starting cluster analysis for token ${options.tokenAddress}`);

  // Step 1: Get top holders
  const topHolders = await getTopHolders(options.tokenAddress, options.topHoldersCount);
  if (topHolders.length === 0) {
    throw new Error('No token holders found or invalid token address');
  }

  console.log(`Found ${topHolders.length} top holders`);

  // Step 2: Fetch transfer data for all top holders
  const allTransfers = new Map<string, any[]>();
  const batchSize = 5; // Process in batches to avoid rate limits

  for (let i = 0; i < topHolders.length; i += batchSize) {
    const batch = topHolders.slice(i, i + batchSize);
    const promises = batch.map(holder =>
      getAddressTransfers(holder.address, options.tokenAddress, options.daysBack)
    );

    const results = await Promise.all(promises);
    batch.forEach((holder, index) => {
      allTransfers.set(holder.address, results[index]);
    });

    console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(topHolders.length / batchSize)}`);
  }

  const totalTransfers = Array.from(allTransfers.values()).reduce((sum, transfers) => sum + transfers.length, 0);
  console.log(`Collected ${totalTransfers} total transfers`);

  // Step 3: Build transaction graph
  const graph = buildTransactionGraph(topHolders, allTransfers);

  // Step 4: Find clusters
  const clusters = findClusters(graph);

  // Step 5: Sort clusters by risk score
  clusters.sort((a, b) => b.riskScore - a.riskScore);

  const highRiskClusters = clusters.filter(c => c.riskScore > 50).length;

  const result: ClusterAnalysis = {
    clusters,
    totalWallets: topHolders.length,
    totalConnections: clusters.reduce((sum, c) => sum + c.edges.length, 0),
    highRiskClusters,
    analysisTimestamp: new Date().toISOString()
  };

  console.log(`Analysis complete: ${clusters.length} clusters found, ${highRiskClusters} high-risk`);

  return result;
}