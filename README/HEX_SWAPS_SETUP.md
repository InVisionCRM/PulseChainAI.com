# HEX Swaps Service Setup

This service fetches HEX swap transactions using the Moralis API for both Ethereum and PulseChain networks, displaying them in the transactions tab of the staker history modal.

## Features

- **HEX Swap Detection**: Automatically identifies HEX-related swaps on both networks
- **Real-time Data**: Fetches latest swap transactions from Moralis API
- **Network Support**: Works with Ethereum (0x1) and PulseChain (0x171)
- **Smart Filtering**: Shows only HEX-related trading activity
- **Pagination**: Handles large numbers of swap transactions
- **Professional UI**: Integrated seamlessly with existing staker history modal

## Setup Required

### 1. Environment Variables

Create a `.env.local` file in your project root with:

```bash
# Moralis API Key (required for swap data)
NEXT_PUBLIC_MORALIS_API_KEY=your-moralis-api-key-here

# Optional: Custom RPC endpoints (service will use defaults if not set)
NEXT_PUBLIC_ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-key
NEXT_PUBLIC_PULSECHAIN_RPC_URL=https://rpc.pulsechain.com
```

### 2. API Key Setup

#### Moralis API Key
- **Get Free Key**: [Moralis Dashboard](https://admin.moralis.io/)
- **Rate Limits**: Free tier includes generous limits for development
- **Production**: Consider upgrading for high-volume usage

## How It Works

1. **User clicks wallet address** in any staking table
2. **Modal opens** showing staking history
3. **User navigates to "Transactions" tab**
4. **HEX swaps automatically fetched** from Moralis API
5. **Swaps displayed** in dedicated table below existing transactions

## API Integration

### Moralis API Endpoints Used

- **Ethereum**: `https://deep-index.moralis.io/api/v2.2/wallets/{address}/swaps?chain=0x1`
- **PulseChain**: `https://deep-index.moralis.io/api/v2.2/wallets/{address}/swaps?chain=0x171`

### Chain IDs Supported

- **Ethereum**: `0x1` (mainnet)
- **PulseChain**: `0x171`

### Data Filtering

The service automatically filters swaps to show only HEX-related transactions:

- **HEX Token Addresses**:
  - Ethereum: `0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39`
  - PulseChain: `0x57fde0a71132198dfc1b2490b26c17fcef9601b2`

- **Token Symbols**: `HEX`, `pHEX`, `eHEX`

## Display Features

### Swap Types
- **📥 HEX In**: User received HEX tokens
- **📤 HEX Out**: User sent HEX tokens
- **🔄 Other**: Related token swaps

### Table Columns
1. **Type**: Visual indicator and swap type
2. **Token**: Token symbol, name, and logo
3. **Direction**: Received/Sent with color coding
4. **Amount**: Formatted token amount
5. **Value (USD)**: USD value at time of swap
6. **Gas Fee**: Transaction gas cost in USD
7. **Date**: Block timestamp
8. **Transaction**: Clickable explorer link

### Visual Indicators
- **Green**: HEX received (📥)
- **Red**: HEX sent (📤)
- **Blue**: Other token activity (🔄)
- **Color-coded badges**: Direction indicators

## Error Handling

- **API Failures**: Graceful fallback with user-friendly error messages
- **Rate Limiting**: Automatic retry with exponential backoff
- **Network Issues**: Clear error states with retry buttons
- **Empty Results**: "No HEX swaps found" message

## Performance Features

- **Lazy Loading**: Swaps only fetched when transactions tab is active
- **Pagination**: 50 swaps per page with navigation controls
- **Caching**: Consider implementing Redis for production use
- **Parallel Fetching**: Both networks can be queried simultaneously

## Security Considerations

- **API Key Protection**: Never commit API keys to version control
- **Rate Limiting**: Respect Moralis API rate limits
- **Input Validation**: Address format validation before API calls
- **Error Logging**: Detailed logs for debugging without exposing sensitive data

## Troubleshooting

### Common Issues

1. **"No HEX swaps found" for addresses with known trading activity**
   - Verify Moralis API key is valid
   - Check if address has swapped on supported networks
   - Verify chain ID configuration

2. **Slow swap loading**
   - Check Moralis API response times
   - Consider upgrading to paid Moralis plan
   - Implement client-side caching

3. **API errors**
   - Verify API key has sufficient quota
   - Check network connectivity
   - Review Moralis API status page

### Debug Mode

Enable console logging to see:
- API request/response details
- Filtering logic results
- Error details and fallback behavior
- Performance metrics

## Future Enhancements

- **Real-time Updates**: WebSocket integration for live swap data
- **Advanced Filtering**: Date ranges, token pairs, DEX selection
- **Analytics**: Trading volume, frequency, and patterns
- **Export**: CSV/PDF export of swap history
- **Notifications**: Alerts for large HEX movements
- **Portfolio Tracking**: Historical value changes over time

## API Rate Limits

### Free Tier
- **Requests per second**: 25
- **Daily requests**: 100,000
- **Concurrent requests**: 10

### Paid Plans
- **Starter**: 100 RPS, 1M daily requests
- **Professional**: 500 RPS, 10M daily requests
- **Enterprise**: Custom limits and dedicated support

## Support

- **Moralis Documentation**: [API Reference](https://docs.moralis.io/web3-data-api/evm)
- **Community**: [Moralis Discord](https://discord.gg/moralis)
- **Status Page**: [API Status](https://status.moralis.io/)

## Example Usage

```typescript
import { hexSwapService } from '@/services/hexSwapService';

// Fetch HEX swaps for an address
const swaps = await hexSwapService.getHexSwaps(
  '0x1234...', // wallet address
  'ethereum',   // network
  1,            // page
  50            // page size
);

console.log(`Found ${swaps.total} HEX swaps`);
```
