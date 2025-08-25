export interface LiquidHexBalances {
  ethereum: number | null;
  pulsechain: number | null;
}

export class LiquidHexBalanceService {
  private ethereumRpcUrl: string;
  private pulsechainRpcUrl: string;
  private etherscanApiKey: string;

  constructor() {
    // These would typically come from environment variables
    this.ethereumRpcUrl = process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/your-api-key';
    this.pulsechainRpcUrl = process.env.NEXT_PUBLIC_PULSECHAIN_RPC_URL || 'https://rpc.pulsechain.com';
    this.etherscanApiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || 'your-etherscan-api-key';
  }

  /**
   * Fetch liquid HEX balance for Ethereum (excluding staked HEX)
   */
  async getEthereumLiquidHexBalance(address: string): Promise<number | null> {
    try {
      // Method 1: Try Etherscan API first (more reliable)
      const etherscanResponse = await fetch(
        `https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39&address=${address}&tag=latest&apikey=${this.etherscanApiKey}`
      );
      
      if (etherscanResponse.ok) {
        const data = await etherscanResponse.json();
        if (data.status === '1' && data.result) {
          return parseFloat(data.result) / Math.pow(10, 8);
        }
      }

      // Method 2: Fallback to RPC call (if Etherscan fails)
      const rpcResponse = await fetch(this.ethereumRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [
            {
              to: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39',
              data: `0x70a08231000000000000000000000000${address.slice(2)}`
            },
            'latest'
          ],
          id: 1
        })
      });

      if (rpcResponse.ok) {
        const data = await rpcResponse.json();
        if (data.result && data.result !== '0x') {
          return parseInt(data.result, 16) / Math.pow(10, 8);
        }
      }

      return null;
    } catch (error) {
      console.error('Error fetching Ethereum HEX balance:', error);
      return null;
    }
  }

  /**
   * Fetch liquid HEX balance for PulseChain (excluding staked HEX)
   */
  async getPulsechainLiquidHexBalance(address: string): Promise<number | null> {
    try {
      // Method 1: Try PulseChain block explorer API
      const explorerResponse = await fetch(
        `https://scan.pulsechain.com/api?module=account&action=tokenbalance&contractaddress=0x57fde0a71132198dfc1b2490b26c17fcef9601b2&address=${address}&tag=latest`
      );
      
      if (explorerResponse.ok) {
        const data = await explorerResponse.json();
        if (data.status === '1' && data.result) {
          return parseFloat(data.result) / Math.pow(10, 8);
        }
      }

      // Method 2: Fallback to RPC call
      const rpcResponse = await fetch(this.pulsechainRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [
            {
              to: '0x57fde0a71132198dfc1b2490b26c17fcef9601b2',
              data: `0x70a08231000000000000000000000000${address.slice(2)}`
            },
            'latest'
          ],
          id: 1
        })
      });

      if (rpcResponse.ok) {
        const data = await rpcResponse.json();
        if (data.result && data.result !== '0x') {
          return parseInt(data.result, 16) / Math.pow(10, 8);
        }
      }

      return null;
    } catch (error) {
      console.error('Error fetching PulseChain HEX balance:', error);
      return null;
    }
  }

  /**
   * Fetch liquid HEX balances for both networks simultaneously
   */
  async getLiquidHexBalances(address: string): Promise<LiquidHexBalances> {
    try {
      const [ethereumBalance, pulsechainBalance] = await Promise.allSettled([
        this.getEthereumLiquidHexBalance(address),
        this.getPulsechainLiquidHexBalance(address)
      ]);

      return {
        ethereum: ethereumBalance.status === 'fulfilled' ? ethereumBalance.value : null,
        pulsechain: pulsechainBalance.status === 'fulfilled' ? pulsechainBalance.value : null
      };
    } catch (error) {
      console.error('Error fetching liquid HEX balances:', error);
      return { ethereum: null, pulsechain: null };
    }
  }

  /**
   * Format HEX amount with appropriate decimals
   */
  formatHexAmount(amount: number | null): string {
    if (amount === null) return 'N/A';
    if (amount === 0) return '0 HEX';
    
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(2)}M HEX`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(2)}K HEX`;
    } else {
      return `${amount.toFixed(2)} HEX`;
    }
  }
}

// Export singleton instance
export const liquidHexBalanceService = new LiquidHexBalanceService();
