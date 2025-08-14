// Base stat template for creating new stat modules
import { StatResult, StatConfig } from './index';

export interface BaseStatConfig extends StatConfig {
  apiSource: 'moralis' | 'pulsechain' | 'dexscreener' | 'custom';
  cacheDuration?: number; // in seconds
}

export abstract class BaseStat {
  protected config: BaseStatConfig;

  constructor(config: BaseStatConfig) {
    this.config = config;
  }

  // Abstract method that each stat must implement
  abstract fetch(tokenAddress: string): Promise<StatResult>;

  // Helper method to format values
  protected formatValue(value: any, format: string, decimals: number = 2): string {
    if (value === null || value === undefined) return 'N/A';
    
    switch (format) {
      case 'currency':
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(numValue)) return 'N/A';
        return `$${numValue.toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        })}`;
      
      case 'number':
        const num = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(num)) return 'N/A';
        return num.toLocaleString();
      
      case 'percentage':
        const percent = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(percent)) return 'N/A';
        return `${percent.toFixed(decimals)}%`;
      
      case 'address':
        if (typeof value !== 'string') return 'N/A';
        return `${value.slice(0, 6)}...${value.slice(-4)}`;
      
      default:
        return String(value);
    }
  }

  // Helper method to create error result
  protected createErrorResult(error: string): StatResult {
    return {
      value: null,
      formattedValue: 'Error',
      error,
      lastUpdated: new Date(),
      source: this.config.id
    };
  }

  // Helper method to create success result
  protected createSuccessResult(value: any, format: string, decimals: number = 2): StatResult {
    return {
      value,
      formattedValue: this.formatValue(value, format, decimals),
      lastUpdated: new Date(),
      source: this.config.id
    };
  }

  // Get the stat configuration
  getConfig(): BaseStatConfig {
    return this.config;
  }
}

// Example of how to create a new stat:
/*
import { BaseStat, BaseStatConfig } from './base';
import { moralisService } from '@/services/moralisService';

export class PriceStat extends BaseStat {
  constructor() {
    const config: BaseStatConfig = {
      id: 'price',
      name: 'Price',
      description: 'Current token price in USD',
      enabled: true,
      format: 'currency',
      decimals: 6,
      apiSource: 'moralis'
    };
    super(config);
  }

  async fetch(tokenAddress: string): Promise<StatResult> {
    try {
      const tokenData = await moralisService.getTokenMetadata(tokenAddress);
      if (!tokenData?.price) {
        return this.createErrorResult('Price data not available');
      }
      
      return this.createSuccessResult(tokenData.price, 'currency', 6);
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : 'Failed to fetch price');
    }
  }
}
*/ 