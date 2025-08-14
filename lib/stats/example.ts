// Example stat implementation - Copy this pattern for new stats
import { BaseStat, BaseStatConfig } from './base';
import { StatResult } from './index';

export class ExampleStat extends BaseStat {
  constructor() {
    const config: BaseStatConfig = {
      id: 'example',
      name: 'Example Stat',
      description: 'This is an example stat implementation',
      enabled: true,
      format: 'number',
      decimals: 0,
      apiSource: 'custom'
    };
    super(config);
  }

  async fetch(tokenAddress: string): Promise<StatResult> {
    try {
      // Example API call - replace with actual implementation
      const response = await fetch(`https://api.example.com/token/${tokenAddress}`);
      
      if (!response.ok) {
        return this.createErrorResult(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.value) {
        return this.createErrorResult('No data available');
      }
      
      return this.createSuccessResult(data.value, 'number', 0);
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : 'Failed to fetch data');
    }
  }
}

// Export the stat instance
export const exampleStat = new ExampleStat(); 