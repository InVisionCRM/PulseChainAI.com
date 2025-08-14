# Stats System Documentation

## Overview

The stats system is designed to be modular and extensible. Each stat is implemented as a separate file that extends the `BaseStat` class, making it easy to add new stats without affecting existing ones.

## File Structure

```
lib/stats/
├── index.ts          # Main registry and exports
├── base.ts           # Base stat template
├── example.ts        # Example implementation
└── [stat-name].ts    # Individual stat implementations
```

## How to Add a New Stat

### 1. Create the Stat File

Create a new file in `lib/stats/` following the pattern:

```typescript
// lib/stats/price.ts
import { BaseStat, BaseStatConfig } from './base';
import { StatResult } from './index';
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

// Export the stat instance
export const priceStat = new PriceStat();
```

### 2. Register the Stat

Add the stat to the registry in `lib/stats/index.ts`:

```typescript
// Import the stat
import { priceStat } from './price';

// Add to available stats
export const availableStats: StatConfig[] = [
  priceStat.getConfig(),
  // ... other stats
];

// Add to stat functions
export const statFunctions: Record<string, (tokenAddress: string) => Promise<StatResult>> = {
  price: (tokenAddress: string) => priceStat.fetch(tokenAddress),
  // ... other stat functions
};
```

## Available Format Types

- `'currency'` - Formats as currency (e.g., "$1,234.56")
- `'number'` - Formats as number with commas (e.g., "1,234")
- `'percentage'` - Formats as percentage (e.g., "12.34%")
- `'address'` - Formats as shortened address (e.g., "0x1234...5678")
- `'text'` - Formats as plain text

## API Sources

- `'moralis'` - Uses Moralis API
- `'pulsechain'` - Uses PulseChain API
- `'dexscreener'` - Uses DEXScreener API
- `'custom'` - Uses custom implementation

## Error Handling

Each stat should handle errors gracefully and return a `StatResult` with:
- `error` field populated with error message
- `formattedValue` set to 'Error'
- `value` set to `null`

## Caching

Stats can implement their own caching strategies by overriding methods in the `BaseStat` class.

## Testing

Each stat can be tested independently by calling its `fetch` method directly:

```typescript
import { priceStat } from '@/lib/stats/price';

const result = await priceStat.fetch('0x1234...');
console.log(result);
```

## Next Steps

1. Create individual stat files for each metric you want to track
2. Register them in the main index file
3. Test each stat individually
4. Add them to the StatSelector component 