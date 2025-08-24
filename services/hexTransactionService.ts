export interface HexTransaction {
  id: string;
  hash: string;
  blockNumber: string;
  timestamp: string;
  from: string;
  to: string;
  value: string;
  type: 'transfer' | 'stake_start' | 'stake_end' | 'good_accounting' | 'share_price_change' | 'daily_data_update' | 'claim' | 'mint' | 'burn';
  description: string;
  gasUsed?: string;
  gasPrice?: string;
  network: 'ethereum' | 'pulsechain';
}

export interface HexBalance {
  address: string;
  balance: string;
  balanceFormatted: string;
  network: 'ethereum' | 'pulsechain';
  timestamp: string;
}

export interface WalletTransactionData {
  address: string;
  network: 'ethereum' | 'pulsechain';
  balance: HexBalance | null;
  transactions: HexTransaction[];
  totalTransactions: number;
  lastUpdated: string;
}

export class HexTransactionService {
  // HEX contract addresses
  private readonly HEX_CONTRACT_ETHEREUM = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
  private readonly HEX_CONTRACT_PULSECHAIN = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
  
  // The Graph endpoints - using the same endpoints as the working staking services
  private readonly ETHEREUM_SUBGRAPH = 'https://gateway.thegraph.com/api/a08fcab20e333b38bb75daf3d97a0bb5/subgraphs/id/A6JyHRn6CUvvgBZwni9JyrgovKWK6FoSQ8TVt6JJGhcp';
  private readonly PULSECHAIN_SUBGRAPH = 'https://graph.pulsechain.com/subgraphs/name/Codeakk/Hex';

  async getWalletTransactionData(address: string, network: 'ethereum' | 'pulsechain'): Promise<WalletTransactionData> {
    console.log(`🔍 Fetching HEX transaction data for ${address} on ${network}...`);
    
    try {
      const [balance, transactions] = await Promise.allSettled([
        this.getHexBalance(address, network),
        this.getAllHexTransactions(address, network)
      ]);

      const balanceResult = balance.status === 'fulfilled' ? balance.value : null;
      const transactionsResult = transactions.status === 'fulfilled' ? transactions.value : [];

      if (balance.status === 'rejected') {
        console.warn(`⚠️ Failed to fetch balance for ${address}:`, balance.reason);
      }
      if (transactions.status === 'rejected') {
        console.warn(`⚠️ Failed to fetch transactions for ${address}:`, transactions.reason);
      }

      return {
        address,
        network,
        balance: balanceResult,
        transactions: transactionsResult,
        totalTransactions: transactionsResult.length,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ Error fetching wallet data for ${address}:`, error);
      throw error;
    }
  }

  async getHexBalance(address: string, network: 'ethereum' | 'pulsechain'): Promise<HexBalance> {
    console.log(`💰 Fetching HEX balance for ${address} on ${network}...`);
    
    if (network === 'ethereum') {
      return this.getEthereumHexBalance(address);
    } else {
      return this.getPulsechainHexBalance(address);
    }
  }

  private async getEthereumHexBalance(address: string): Promise<HexBalance> {
    // For HEX balance, we need to use a proper ERC20 balance query or external API
    // The Graph doesn't directly track ERC20 balances, only events
    // We'll use a fallback approach with Ethereum RPC or return placeholder for now
    
    try {
      // For now, return a realistic placeholder since proper balance fetching 
      // requires direct blockchain RPC calls or specialized APIs like Alchemy
      // In a real implementation, you'd use:
      // 1. Ethereum RPC call to HEX contract balanceOf(address) method
      // 2. Or use services like Alchemy Token API
      // 3. Or maintain a balance tracking system based on transfer events
      
      const placeholderBalance = '0'; // Default to 0 since we can't reliably estimate from transfers
      
      return {
        address,
        balance: placeholderBalance,
        balanceFormatted: this.formatHexAmount(placeholderBalance),
        network: 'ethereum',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ Error fetching Ethereum HEX balance:`, error);
      return {
        address,
        balance: '0',
        balanceFormatted: '0 HEX',
        network: 'ethereum',
        timestamp: new Date().toISOString()
      };
    }
  }

  private async getPulsechainHexBalance(address: string): Promise<HexBalance> {
    try {
      // Same issue as Ethereum - proper balance fetching requires RPC calls
      // For PulseChain, you'd need to call the HEX contract directly
      const placeholderBalance = '0';
      
      return {
        address,
        balance: placeholderBalance,
        balanceFormatted: this.formatHexAmount(placeholderBalance),
        network: 'pulsechain',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ Error fetching PulseChain HEX balance:`, error);
      return {
        address,
        balance: '0',
        balanceFormatted: '0 HEX',
        network: 'pulsechain',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getAllHexTransactions(address: string, network: 'ethereum' | 'pulsechain', limit: number = 100): Promise<HexTransaction[]> {
    console.log(`📊 Fetching all HEX transactions for ${address} on ${network}...`);
    
    if (network === 'ethereum') {
      return this.getEthereumHexTransactions(address, limit);
    } else {
      return this.getPulsechainHexTransactions(address, limit);
    }
  }

  private async getEthereumHexTransactions(address: string, limit: number = 100): Promise<HexTransaction[]> {
    const query = `
      query GetAllHexTransactions($address: String!, $limit: Int!) {
        # Staking transactions
        stakeStarts(
          where: { stakerAddr: $address }
          orderBy: timestamp
          orderDirection: desc
          first: $limit
        ) {
          id
          stakeId
          stakerAddr
          stakedHearts
          stakedDays
          timestamp
          transactionHash
          blockNumber
        }
        stakeEnds(
          where: { stakerAddr: $address }
          orderBy: timestamp
          orderDirection: desc
          first: $limit
        ) {
          id
          stakeId
          stakerAddr
          payout
          penalty
          timestamp
          transactionHash
          blockNumber
        }
      }
    `;

    try {
      const data = await this.executeEthereumQuery<{
        stakeStarts: Array<{
          id: string; stakeId: string; stakerAddr: string; stakedHearts: string; 
          stakedDays: string; timestamp: string; transactionHash: string; blockNumber: string;
        }>;
        stakeEnds: Array<{
          id: string; stakeId: string; stakerAddr: string; payout: string; 
          penalty: string; timestamp: string; transactionHash: string; blockNumber: string;
        }>;
      }>(query, { address: address.toLowerCase(), limit });

      const transactions: HexTransaction[] = [];

      // Process stake starts
      data.stakeStarts.forEach(stake => {
        transactions.push({
          id: stake.id,
          hash: stake.transactionHash,
          blockNumber: stake.blockNumber,
          timestamp: stake.timestamp,
          from: stake.stakerAddr,
          to: this.HEX_CONTRACT_ETHEREUM,
          value: stake.stakedHearts,
          type: 'stake_start',
          description: `Started stake #${stake.stakeId}: ${this.formatHexAmount(stake.stakedHearts)} HEX for ${stake.stakedDays} days`,
          network: 'ethereum'
        });
      });

      // Process stake ends
      data.stakeEnds.forEach(stake => {
        const penalty = parseFloat(stake.penalty || '0');
        const payout = parseFloat(stake.payout || '0');
        const description = penalty > 0 
          ? `Ended stake #${stake.stakeId} with penalty: ${this.formatHexAmount(stake.penalty)} HEX`
          : `Ended stake #${stake.stakeId}: received ${this.formatHexAmount(stake.payout)} HEX`;

        transactions.push({
          id: stake.id,
          hash: stake.transactionHash,
          blockNumber: stake.blockNumber,
          timestamp: stake.timestamp,
          from: this.HEX_CONTRACT_ETHEREUM,
          to: stake.stakerAddr,
          value: payout > penalty ? stake.payout : '0',
          type: 'stake_end',
          description,
          network: 'ethereum'
        });
      });

      // Sort all transactions by timestamp (most recent first)
      transactions.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));

      return transactions.slice(0, limit);
    } catch (error) {
      console.error(`❌ Error fetching Ethereum HEX transactions:`, error);
      return [];
    }
  }

  private async getPulsechainHexTransactions(address: string, limit: number = 100): Promise<HexTransaction[]> {
    const query = `
      query GetAllHexTransactions($address: String!, $limit: Int!) {
        # Staking transactions
        stakeStarts(
          where: { stakerAddr: $address }
          orderBy: timestamp
          orderDirection: desc
          first: $limit
        ) {
          id
          stakeId
          stakerAddr
          stakedHearts
          stakedDays
          timestamp
          transactionHash
          blockNumber
        }
        stakeEnds(
          where: { stakerAddr: $address }
          orderBy: timestamp
          orderDirection: desc
          first: $limit
        ) {
          id
          stakeId
          stakerAddr
          payout
          penalty
          timestamp
          transactionHash
          blockNumber
        }
      }
    `;

    try {
      const data = await this.executePulsechainQuery<{
        stakeStarts: Array<{
          id: string; stakeId: string; stakerAddr: string; stakedHearts: string; 
          stakedDays: string; timestamp: string; transactionHash: string; blockNumber: string;
        }>;
        stakeEnds: Array<{
          id: string; stakeId: string; stakerAddr: string; payout: string; 
          penalty: string; timestamp: string; transactionHash: string; blockNumber: string;
        }>;
      }>(query, { address: address.toLowerCase(), limit });

      const transactions: HexTransaction[] = [];

      // Process stake starts
      data.stakeStarts.forEach(stake => {
        transactions.push({
          id: stake.id,
          hash: stake.transactionHash,
          blockNumber: stake.blockNumber,
          timestamp: stake.timestamp,
          from: stake.stakerAddr,
          to: this.HEX_CONTRACT_PULSECHAIN,
          value: stake.stakedHearts,
          type: 'stake_start',
          description: `Started stake #${stake.stakeId}: ${this.formatHexAmount(stake.stakedHearts)} HEX for ${stake.stakedDays} days`,
          network: 'pulsechain'
        });
      });

      // Process stake ends
      data.stakeEnds.forEach(stake => {
        const penalty = parseFloat(stake.penalty || '0');
        const payout = parseFloat(stake.payout || '0');
        const description = penalty > 0 
          ? `Ended stake #${stake.stakeId} with penalty: ${this.formatHexAmount(stake.penalty)} HEX`
          : `Ended stake #${stake.stakeId}: received ${this.formatHexAmount(stake.payout)} HEX`;

        transactions.push({
          id: stake.id,
          hash: stake.transactionHash,
          blockNumber: stake.blockNumber,
          timestamp: stake.timestamp,
          from: this.HEX_CONTRACT_PULSECHAIN,
          to: stake.stakerAddr,
          value: payout > penalty ? stake.payout : '0',
          type: 'stake_end',
          description,
          network: 'pulsechain'
        });
      });

      // Sort all transactions by timestamp (most recent first)
      transactions.sort((a, b) => parseInt(b.timestamp) - parseInt(a.timestamp));

      return transactions.slice(0, limit);
    } catch (error) {
      console.error(`❌ Error fetching PulseChain HEX transactions:`, error);
      return [];
    }
  }

  private async executeEthereumQuery<T>(query: string, variables: any = {}): Promise<T> {
    const response = await fetch(this.ETHEREUM_SUBGRAPH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ethereum GraphQL error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      const errorMessage = data.errors.map((e: any) => e.message).join(', ');
      throw new Error(`Ethereum GraphQL error: ${errorMessage}`);
    }

    return data.data;
  }

  private async executePulsechainQuery<T>(query: string, variables: any = {}): Promise<T> {
    const response = await fetch(this.PULSECHAIN_SUBGRAPH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`PulseChain GraphQL error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      const errorMessage = data.errors.map((e: any) => e.message).join(', ');
      throw new Error(`PulseChain GraphQL error: ${errorMessage}`);
    }

    return data.data;
  }

  private formatHexAmount(amount: string): string {
    const num = parseFloat(amount) / Math.pow(10, 8); // HEX has 8 decimals
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(2);
  }

  formatDate(timestamp: string): string {
    return new Date(parseInt(timestamp) * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getTransactionTypeColor(type: HexTransaction['type']): string {
    switch (type) {
      case 'transfer':
        return 'text-blue-400';
      case 'stake_start':
        return 'text-green-400';
      case 'stake_end':
        return 'text-orange-400';
      default:
        return 'text-gray-400';
    }
  }

  getTransactionTypeIcon(type: HexTransaction['type']): string {
    switch (type) {
      case 'transfer':
        return '💸';
      case 'stake_start':
        return '🔒';
      case 'stake_end':
        return '🔓';
      default:
        return '📄';
    }
  }

  getExplorerUrl(hash: string, network: 'ethereum' | 'pulsechain'): string {
    if (network === 'ethereum') {
      return `https://etherscan.io/tx/${hash}`;
    } else {
      return `https://scan.pulsechain.com/tx/${hash}`;
    }
  }
}

// Export singleton instance
export const hexTransactionService = new HexTransactionService();