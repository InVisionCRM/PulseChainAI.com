# Liquid HEX Balance Service Setup

This service fetches liquid HEX balances (excluding staked HEX) from both Ethereum and PulseChain networks when users click on wallet addresses.

## Features

- **Ethereum Liquid HEX**: Shows "Liquid eHEX" balance using Etherscan API or RPC fallback
- **PulseChain Liquid HEX**: Shows "Liquid pHEX" balance using PulseChain explorer API or RPC fallback
- **Smart Fallbacks**: If one method fails, automatically tries alternative methods
- **Real-time Updates**: Fetches balances when modal opens

## Setup Required

### 1. Environment Variables

Create a `.env.local` file in your project root with:

```bash
# Ethereum RPC URL (Alchemy, Infura, or your own node)
NEXT_PUBLIC_ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-alchemy-api-key

# PulseChain RPC URL (default is public RPC)
NEXT_PUBLIC_PULSECHAIN_RPC_URL=https://rpc.pulsechain.com

# Etherscan API Key (for Ethereum HEX balance fetching)
NEXT_PUBLIC_ETHERSCAN_API_KEY=your-etherscan-api-key
```

### 2. API Keys Needed

#### Ethereum
- **Etherscan API Key**: [Get free key here](https://etherscan.io/apis)
- **Alternative**: Alchemy or Infura RPC endpoint

#### PulseChain
- **No API key required** - uses public RPC and explorer APIs

## How It Works

1. **User clicks wallet address** in any staking table
2. **Modal opens** showing staking history
3. **Liquid HEX balances are fetched** automatically for both networks
4. **Balances displayed** next to "Total Stakes" in overview section

## Display Logic

- **Liquid eHEX**: Green card showing Ethereum HEX balance (if > 0)
- **Liquid pHEX**: blue card showing PulseChain HEX balance (if > 0)
- **No Liquid HEX**: Gray card showing "No liquid HEX found" when address has no liquid balances
- **Loading State**: Animated placeholder while fetching balances

## API Endpoints Used

### Ethereum
- Primary: `https://api.etherscan.io/api` (token balance)
- Fallback: RPC call to `eth_call` with ERC-20 balanceOf function

### PulseChain
- Primary: `https://scan.pulsechain.com/api` (token balance)
- Fallback: RPC call to `eth_call` with ERC-20 balanceOf function

## Error Handling

- **Graceful degradation**: If APIs fail, shows "No liquid HEX found"
- **Console logging**: Detailed error logs for debugging
- **User-friendly messages**: Clear indication when balances can't be loaded

## Performance

- **Parallel fetching**: Both network balances fetched simultaneously
- **Caching**: Consider implementing Redis/Memcache for production
- **Rate limiting**: Respect API rate limits (especially Etherscan)

## Security Notes

- **Public RPCs**: PulseChain RPC is public, Ethereum RPC should be private
- **API keys**: Never commit API keys to version control
- **Validation**: Address format validation before API calls

## Troubleshooting

### Common Issues

1. **"No liquid HEX found" for addresses with known balances**
   - Check API keys are set correctly
   - Verify RPC endpoints are accessible
   - Check browser console for error logs

2. **Slow balance loading**
   - Consider upgrading to paid RPC endpoints
   - Implement caching for frequently accessed addresses

3. **Etherscan API errors**
   - Verify API key is valid and has sufficient quota
   - Check if you've exceeded rate limits

### Debug Mode

Enable console logging by checking browser developer tools for:
- Balance fetch attempts
- API response details
- Fallback method usage
- Error messages

## Future Enhancements

- **Balance caching** with TTL
- **Historical balance tracking**
- **USD value display** using live price feeds
- **Transaction history** for liquid HEX movements
- **WebSocket updates** for real-time balance changes
