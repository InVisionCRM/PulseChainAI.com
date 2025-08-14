# Moralis Integration for PulseChain AI Dashboard

This document outlines the integration of the Moralis SDK to replace the PulseChain APIs in the StatCounterBuilder component.

## Overview

The Moralis SDK provides a unified API for accessing blockchain data across multiple networks, including PulseChain. This integration replaces the custom PulseChain API service with Moralis's standardized EVM API. The integration uses a pre-configured API key, so users don't need to provide their own.

## Key Components

### 1. Moralis Service (`services/moralisService.ts`)

The main service that handles all Moralis API calls:

- **Initialization**: `initializeMoralis(apiKey)` - Initializes the Moralis SDK
- **Token Metadata**: `getTokenMetadata(address)` - Get detailed token information
- **Token Owners**: `getTokenOwners(address)` - Get token holder information
- **Token Transfers**: `getTokenTransfers(address)` - Get token transfer history
- **Wallet Balances**: `getWalletTokenBalances(address)` - Get wallet token balances
- **Burned Tokens**: `getBurnedTokens(address)` - Get total burned tokens for a specific token
- **Native Balance**: `getNativeBalance(address)` - Get native token balance
- **Block Information**: `getBlock(blockNumberOrHash)` - Get block details
- **Contract Functions**: `runContractFunction(address, abi, functionName, params)` - Execute contract functions

### 2. Hybrid Approach

The integration uses a hybrid approach for optimal performance:

- **Token Search**: Uses PulseChain API for real-time search results
- **Detailed Stats**: Uses Moralis for comprehensive token statistics
- **Fallback System**: Graceful fallbacks if either service fails

### 2. Moralis Hook (`lib/hooks/useMoralis.ts`)

Custom React hook for managing Moralis state:

- **State Management**: Tracks initialization status, loading states, and errors
- **API Key Management**: Handles API key storage and retrieval
- **Auto-initialization**: Automatically initializes with stored API key on mount

### 3. Integrated API Key

The integration uses a pre-configured Moralis API key:

- **No User Input Required**: Users don't need to provide their own API key
- **Automatic Initialization**: Moralis initializes automatically on component mount
- **Secure**: API key is embedded in the application code
- **Reliable**: Consistent access to blockchain data

### 4. Updated StatCounterBuilder

The main component now includes:

- **Moralis Integration Check**: Shows initialization status
- **Conditional Rendering**: Only shows components when Moralis is initialized
- **Error Handling**: Displays Moralis-specific errors
- **Automatic Initialization**: No user interaction required

## Configuration

### PulseChain Chain ID

The integration uses Moralis's chain parameter `"pulse"` for PulseChain API calls.

### API Endpoints Used

#### Moralis Endpoints
- **Token Metadata**: `Moralis.EvmApi.token.getTokenMetadata()`
- **Token Price**: `Moralis.EvmApi.token.getTokenPrice()`
- **Token Stats**: `Moralis.EvmApi.token.getTokenStats()`
- **Token Owners**: `Moralis.EvmApi.token.getTokenOwners()`
- **Token Transfers**: `Moralis.EvmApi.token.getTokenTransfers()`
- **Wallet Balances**: `Moralis.EvmApi.token.getWalletTokenBalances()`
- **Burned Tokens**: `Moralis.EvmApi.token.getWalletTokenBalances()` (for burn addresses)
- **Native Balance**: `Moralis.EvmApi.balance.getNativeBalance()`

#### PulseChain Endpoints
- **Token Search**: `https://api.scan.pulsechain.com/api/v2/search`
- **Token Info**: `https://api.scan.pulsechain.com/api/v2/tokens/{address}`
- **Token Holders**: `https://api.scan.pulsechain.com/api/v2/tokens/{address}/holders`

## Usage

### 1. Automatic Initialization

Moralis initializes automatically when components mount:

```typescript
import { useMoralis } from '@/lib/hooks/useMoralis';

const { isInitialized, isLoading, error } = useMoralis();
```

### 2. Use the Service

```typescript
import { moralisService } from '@/services/moralisService';
import { pulsechainApi } from '@/services';

// Search for tokens (PulseChain API)
const tokens = await search('SHIB');

// Get detailed token metadata (Moralis)
const metadata = await moralisService.getTokenMetadata('0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE');
```

### 3. Check Initialization Status

```typescript
const { isInitialized, isLoading, error } = useMoralis();

if (isInitialized) {
  // Moralis is ready to use
}
```

## Testing

A test page is available at `/test-moralis` to verify the integration:

- Tests token search functionality
- Tests token metadata retrieval
- Tests native balance queries
- Displays detailed results and error information

## Migration from PulseChain API

### Before (PulseChain API)
```typescript
import { pulsechainApi } from '@/services';
const results = await search('SHIB');
```

### After (Moralis)
```typescript
import { moralisService } from '@/services/moralisService';
const results = await moralisService.searchTokens('SHIB');
```

## Benefits of Integrated API Key

1. **Seamless User Experience**: No API key entry required
2. **Instant Access**: Blockchain data available immediately
3. **No Setup Required**: Works out of the box
4. **Consistent Performance**: Reliable API access
5. **Reduced Friction**: Users can start using features immediately

## Benefits

1. **Unified API**: Single SDK for multiple blockchain networks
2. **Better Documentation**: Comprehensive Moralis documentation
3. **Rate Limiting**: Built-in rate limiting and error handling
4. **Type Safety**: Full TypeScript support
5. **Extensibility**: Easy to add support for other networks
6. **Reliability**: Enterprise-grade API with high uptime

## Error Handling

The integration includes comprehensive error handling:

- **Initialization Errors**: Displayed in the API key modal
- **API Call Errors**: Caught and logged with user-friendly messages
- **Network Errors**: Graceful fallbacks for network issues
- **Rate Limit Errors**: Automatic retry logic for rate-limited requests

## Security Considerations

- API key is embedded in the application code
- API key is not exposed in the UI or error messages
- All API calls are made server-side when possible
- Rate limiting is handled by Moralis

## Future Enhancements

1. **Caching**: Implement caching for frequently accessed data
2. **WebSocket Support**: Real-time data updates
3. **Multi-chain Support**: Support for additional networks
4. **Advanced Analytics**: Enhanced analytics and reporting features
5. **Batch Operations**: Optimize multiple API calls

## Troubleshooting

### Common Issues

1. **"Moralis not initialized"**: Check if the service is loading properly
2. **"Rate limit exceeded"**: Wait before making additional requests
3. **"Network error"**: Check internet connection and try again
4. **"Invalid response"**: Verify the API endpoints are working correctly

### Debug Mode

Enable debug logging by setting the environment variable:
```bash
NEXT_PUBLIC_MORALIS_DEBUG=true
```

## API Key Management

The integrated API key is managed automatically:

- **No User Setup**: No API key entry required
- **Automatic Initialization**: Moralis starts automatically
- **Error Handling**: Graceful fallbacks for API issues
- **Rate Limiting**: Built-in rate limiting by Moralis

## Support

For issues with the Moralis integration:

1. Check the test page at `/test-moralis`
2. Review the browser console for error messages
3. Verify your API key has the necessary permissions
4. Check the [Moralis Documentation](https://moralisweb3.github.io/Moralis-JS-SDK/) 