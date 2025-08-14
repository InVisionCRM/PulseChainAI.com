// Stats Registry - Central export for all stat modules
// This file will import and re-export all stat modules as they are created

export interface StatResult {
  value: any;
  formattedValue: string;
  error?: string;
  lastUpdated: Date;
  source: string;
}

export interface StatConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  format: 'number' | 'currency' | 'percentage' | 'address' | 'text';
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

// Import stat modules
import { tokensBurnedStat } from './tokensBurned';
import { tokenBalanceStat } from './tokenBalance';
import * as tokenSupply from './tokenSupply';
import * as holderDistribution from './holderDistribution';
import * as marketAndLiquidity from './marketAndLiquidity';
import * as onChainActivity from './onChainActivity';
import * as creatorAnalysis from './creatorAnalysis';
import * as contractMetadata from './contractMetadata';
import * as additionalHolderStats from './additionalHolderStats';
import * as additionalMarketAndLiquidity from './additionalMarketAndLiquidity';
import * as additionalOnChainActivity from './additionalOnChainActivity';

// Available stats configuration
export const availableStats: StatConfig[] = [
  tokensBurnedStat.getConfig(),
  tokenBalanceStat.getConfig(),
  ...Object.values(tokenSupply).map(stat => stat.getConfig()),
  ...Object.values(holderDistribution).map(stat => stat.getConfig()),
  ...Object.values(marketAndLiquidity).map(stat => stat.getConfig()),
  ...Object.values(onChainActivity).map(stat => stat.getConfig()),
  ...Object.values(creatorAnalysis).map(stat => stat.getConfig()),
  ...Object.values(contractMetadata).map(stat => stat.getConfig()),
  ...Object.values(additionalHolderStats).map(stat => stat.getConfig()),
  ...Object.values(additionalMarketAndLiquidity).map(stat => stat.getConfig()),
  ...Object.values(additionalOnChainActivity).map(stat => stat.getConfig()),
];

// Stat functions registry
export const statFunctions: Record<string, (tokenAddress: string, walletAddress?: string) => Promise<StatResult>> = {
  tokensBurned: (tokenAddress: string) => tokensBurnedStat.fetch(tokenAddress),
  tokenBalance: (walletAddress: string, tokenAddress: string) => tokenBalanceStat.fetch(walletAddress, tokenAddress),
  ...Object.values(tokenSupply).reduce((acc, stat) => {
    acc[stat.id] = (tokenAddress: string) => stat.fetch(tokenAddress);
    return acc;
  }, {} as Record<string, (tokenAddress: string) => Promise<StatResult>>),
  ...Object.values(holderDistribution).reduce((acc, stat) => {
    acc[stat.id] = (tokenAddress: string) => stat.fetch(tokenAddress);
    return acc;
  }, {} as Record<string, (tokenAddress: string) => Promise<StatResult>>),
  ...Object.values(marketAndLiquidity).reduce((acc, stat) => {
    acc[stat.id] = (tokenAddress: string) => stat.fetch(tokenAddress);
    return acc;
  }, {} as Record<string, (tokenAddress: string) => Promise<StatResult>>),
  ...Object.values(onChainActivity).reduce((acc, stat) => {
    acc[stat.id] = (tokenAddress: string) => stat.fetch(tokenAddress);
    return acc;
  }, {} as Record<string, (tokenAddress: string) => Promise<StatResult>>),
  ...Object.values(creatorAnalysis).reduce((acc, stat) => {
    acc[stat.id] = (tokenAddress: string) => stat.fetch(tokenAddress);
    return acc;
  }, {} as Record<string, (tokenAddress: string) => Promise<StatResult>>),
  ...Object.values(contractMetadata).reduce((acc, stat) => {
    acc[stat.id] = (tokenAddress: string) => stat.fetch(tokenAddress);
    return acc;
  }, {} as Record<string, (tokenAddress: string) => Promise<StatResult>>),
  ...Object.values(additionalHolderStats).reduce((acc, stat) => {
    acc[stat.id] = (tokenAddress: string) => stat.fetch(tokenAddress);
    return acc;
  }, {} as Record<string, (tokenAddress: string) => Promise<StatResult>>),
  ...Object.values(additionalMarketAndLiquidity).reduce((acc, stat) => {
    acc[stat.id] = (tokenAddress: string) => stat.fetch(tokenAddress);
    return acc;
  }, {} as Record<string, (tokenAddress: string) => Promise<StatResult>>),
  ...Object.values(additionalOnChainActivity).reduce((acc, stat) => {
    acc[stat.id] = (tokenAddress: string) => stat.fetch(tokenAddress);
    return acc;
  }, {} as Record<string, (tokenAddress: string) => Promise<StatResult>>),
};

// Main function to fetch a specific stat
export async function fetchStat(statId: string, tokenAddress: string, walletAddress?: string): Promise<StatResult> {
  const statFunction = statFunctions[statId];
  if (!statFunction) {
    throw new Error(`Stat function not found: ${statId}`);
  }
  
  if (statId === 'tokenBalance' && walletAddress) {
    return await (statFunction as any)(walletAddress, tokenAddress);
  }
  
  return await statFunction(tokenAddress);
}

// Main function to fetch multiple stats
export async function fetchStats(statIds: string[], tokenAddress: string, walletAddress?: string): Promise<Record<string, StatResult>> {
  const results: Record<string, StatResult> = {};
  
  for (const statId of statIds) {
    try {
      results[statId] = await fetchStat(statId, tokenAddress, walletAddress);
    } catch (error) {
      results[statId] = {
        value: null,
        formattedValue: 'Error',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastUpdated: new Date(),
        source: statId
      };
    }
  }
  
  return results;
} 