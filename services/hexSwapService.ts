export interface HexSwap {
  transaction_hash: string;
  block_number: string;
  block_timestamp: string;
  token_address: string;
  token_symbol: string;
  token_name: string;
  token_logo?: string;
  token_decimals: string;
  direction: 'IN' | 'OUT';
  from_address: string;
  to_address: string;
  amount: string;
  amount_formatted: string;
  value_usd?: string;
  gas_price: string;
  gas_used: string;
  gas_fee: string;
  gas_fee_usd?: string;
  chain: string;
  swap_type: 'HEX_IN' | 'HEX_OUT' | 'OTHER';
}

export interface SwapResponse {
  result: HexSwap[];
  total: number;
  page: number;
  page_size: number;
  cursor?: string;
}

export class HexSwapService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    // This would typically come from environment variables
    this.apiKey = process.env.NEXT_PUBLIC_MORALIS_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjYzOWU4ZWMwLTJkM2ItNDgwYS04MWY5LTdiMDM3OTYxZjIyYSIsIm9yZ0lkIjoiNDMyMTk3IiwidXNlcklkIjoiNDQ0NTc3IiwidHlwZUlkIjoiZWY3YmEyYjMtMTMyYS00MWI0LWEyMDgtYTUwNGEzMjk5NDMzIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3Mzk4NTgyMDYsImV4cCI6NDg5NTYxODIwNn0.iSuHF229Nk_9yiiqDxyyGM0MB6DEG09gLa2oFWYf5us';
    this.baseUrl = 'https://deep-index.moralis.io/api/v2.2';
  }

  /**
   * Get chain ID for Moralis API
   */
  private getChainId(network: 'ethereum' | 'pulsechain'): string {
    switch (network) {
      case 'ethereum':
        return '0x1'; // Ethereum mainnet
      case 'pulsechain':
        return '0x171'; // PulseChain
      default:
        return '0x1';
    }
  }

  /**
   * Check if a token is HEX-related
   */
  private isHexToken(tokenAddress: string, tokenSymbol: string, network: 'ethereum' | 'pulsechain'): boolean {
    const hexAddresses = {
      ethereum: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39',
      pulsechain: '0x57fde0a71132198dfc1b2490b26c17fcef9601b2'
    };

    const hexSymbols = ['HEX', 'pHEX', 'eHEX'];
    
    return tokenAddress.toLowerCase() === hexAddresses[network].toLowerCase() || 
           hexSymbols.includes(tokenSymbol.toUpperCase());
  }

  /**
   * Fetch HEX swaps for a wallet address
   */
  async getHexSwaps(
    address: string, 
    network: 'ethereum' | 'pulsechain',
    page: number = 1,
    pageSize: number = 50
  ): Promise<SwapResponse> {
    try {
      const chainId = this.getChainId(network);
      const url = `${this.baseUrl}/wallets/${address}/swaps?chain=${chainId}&order=DESC&limit=${pageSize}&offset=${(page - 1) * pageSize}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'X-API-Key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Filter to only HEX-related swaps and enhance with swap type
      const hexSwaps: HexSwap[] = (data.result || [])
        .filter((swap: any) => this.isHexToken(swap.token_address, swap.token_symbol, network))
        .map((swap: any) => ({
          ...swap,
          swap_type: this.determineSwapType(swap, network),
          amount_formatted: this.formatAmount(swap.amount, swap.token_decimals),
          value_usd: swap.value_usd || '0',
          gas_fee_usd: swap.gas_fee_usd || '0'
        }));

      return {
        result: hexSwaps,
        total: hexSwaps.length,
        page,
        page_size: pageSize,
        cursor: data.cursor
      };

    } catch (error) {
      console.error(`Error fetching HEX swaps for ${network}:`, error);
      return {
        result: [],
        total: 0,
        page,
        page_size: pageSize
      };
    }
  }

  /**
   * Determine the type of HEX swap
   */
  private determineSwapType(swap: any, network: 'ethereum' | 'pulsechain'): 'HEX_IN' | 'HEX_OUT' | 'OTHER' {
    const hexAddresses = {
      ethereum: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39',
      pulsechain: '0x57fde0a71132198dfc1b2490b26c17fcef9601b2'
    };

    const hexAddress = hexAddresses[network].toLowerCase();
    
    if (swap.token_address.toLowerCase() === hexAddress) {
      return swap.direction === 'IN' ? 'HEX_IN' : 'HEX_OUT';
    }
    
    return 'OTHER';
  }

  /**
   * Format token amount with proper decimals
   */
  private formatAmount(amount: string, decimals: string): string {
    try {
      const numAmount = parseFloat(amount);
      const numDecimals = parseInt(decimals);
      const formattedAmount = numAmount / Math.pow(10, numDecimals);
      
      if (formattedAmount >= 1000000) {
        return `${(formattedAmount / 1000000).toFixed(2)}M`;
      } else if (formattedAmount >= 1000) {
        return `${(formattedAmount / 1000).toFixed(2)}K`;
      } else {
        return formattedAmount.toFixed(2);
      }
    } catch (error) {
      return '0';
    }
  }

  /**
   * Format USD value
   */
  formatUSD(value: string | number): string {
    try {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(numValue)) return '$0.00';
      
      if (numValue >= 1000000) {
        return `$${(numValue / 1000000).toFixed(2)}M`;
      } else if (numValue >= 1000) {
        return `$${(numValue / 1000).toFixed(2)}K`;
      } else {
        return `$${numValue.toFixed(2)}`;
      }
    } catch (error) {
      return '$0.00';
    }
  }

  /**
   * Get explorer URL for transaction
   */
  getExplorerUrl(txHash: string, network: 'ethereum' | 'pulsechain'): string {
    switch (network) {
      case 'ethereum':
        return `https://etherscan.io/tx/${txHash}`;
      case 'pulsechain':
        return `https://scan.pulsechain.com/tx/${txHash}`;
      default:
        return `https://etherscan.io/tx/${txHash}`;
    }
  }

  /**
   * Get network display name
   */
  getNetworkName(network: 'ethereum' | 'pulsechain'): string {
    switch (network) {
      case 'ethereum':
        return 'Ethereum';
      case 'pulsechain':
        return 'PulseChain';
      default:
        return 'Unknown';
    }
  }
}

// Export singleton instance
export const hexSwapService = new HexSwapService();
