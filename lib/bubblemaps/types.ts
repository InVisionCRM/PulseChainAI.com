export interface TransactionEdge {
  from: string;
  to: string;
  amount: number;
  timestamp: string;
  tokenAddress: string;
  hash: string;
  blockNumber?: number;
}

export interface TransactionNode {
  address: string;
  balance: number;
  percentage: number;
  connections: Map<string, TransactionEdge[]>;
  totalVolume: number;
  transactionCount: number;
  riskScore: number;
}

export interface WalletCluster {
  id: string;
  addresses: string[];
  connectionStrength: number;
  totalVolume: number;
  transactionCount: number;
  commonPatterns: string[];
  riskIndicators: string[];
  riskScore: number;
  nodes: TransactionNode[];
  edges: TransactionEdge[];
}

export interface ClusterAnalysis {
  clusters: WalletCluster[];
  totalWallets: number;
  totalConnections: number;
  highRiskClusters: number;
  analysisTimestamp: string;
}

export interface TokenHolder {
  address: string;
  balance: string;
  percentage: number;
}

export interface ClusteringOptions {
  tokenAddress: string;
  topHoldersCount: number;
  daysBack: number;
  minTransactionAmount?: number;
  maxClusterSize?: number;
}