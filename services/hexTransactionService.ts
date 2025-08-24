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
  
  // The Graph endpoints
  private readonly ETHEREUM_SUBGRAPH = 'https://gateway.thegraph.com/api/a08fcab20e333b38bb75daf3d97a0bb5/subgraphs/id/A6JyHRn6CUvvgBZwni9JyrgovKWK6FoSQ8TVt6JJGhcp';
  private readonly PULSECHAIN_PROXY = '/api/pulsechain-graphql-proxy';

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
    // Query The Graph for current balance
    const query = `
      query GetHexBalance($address: String!) {
        # Try to get the most recent transfer involving this address
        transfersTo: transfers(
          where: { to: $address }
          orderBy: timestamp
          orderDirection: desc
          first: 1
        ) {
          id
          value
          timestamp
        }
        transfersFrom: transfers(
          where: { from: $address }
          orderBy: timestamp
          orderDirection: desc
          first: 1
        ) {
          id
          value
          timestamp
        }
        # Also check if this address has any HEX-related activity
        stakeStarts(where: { stakerAddr: $address }) {
          id
        }
      }
    `;

    try {
      const data = await this.executeEthereumQuery<{
        transfersTo: Array<{ id: string; value: string; timestamp: string }>;
        transfersFrom: Array<{ id: string; value: string; timestamp: string }>;
        stakeStarts: Array<{ id: string }>;
      }>(query, { address: address.toLowerCase() });

      // For now, we'll estimate balance based on recent activity
      // In a production app, you'd want to use a proper blockchain API like Alchemy/Infura
      let estimatedBalance = '0';
      
      if (data.transfersTo.length > 0 || data.transfersFrom.length > 0 || data.stakeStarts.length > 0) {
        // If there's any HEX activity, we can try to get a rough balance estimate
        // This is a simplified approach - in reality you'd sum all inbound/outbound transfers
        const latestTransferTo = data.transfersTo[0];
        if (latestTransferTo) {
          estimatedBalance = latestTransferTo.value;
        }
      }

      return {
        address,
        balance: estimatedBalance,
        balanceFormatted: this.formatHexAmount(estimatedBalance),
        network: 'ethereum',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ Error fetching Ethereum HEX balance:`, error);
      // Return zero balance on error
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
    // Similar approach for PulseChain using the proxy
    const query = `
      query GetHexBalance($address: String!) {
        transfersTo: transfers(
          where: { to: $address }
          orderBy: timestamp
          orderDirection: desc
          first: 1
        ) {
          id
          value
          timestamp
        }
        transfersFrom: transfers(
          where: { from: $address }
          orderBy: timestamp
          orderDirection: desc
          first: 1
        ) {
          id
          value
          timestamp
        }
        stakeStarts(where: { stakerAddr: $address }) {
          id
        }
      }
    `;

    try {
      const data = await this.executePulsechainQuery<{
        transfersTo: Array<{ id: string; value: string; timestamp: string }>;
        transfersFrom: Array<{ id: string; value: string; timestamp: string }>;
        stakeStarts: Array<{ id: string }>;
      }>(query, { address: address.toLowerCase() });

      let estimatedBalance = '0';
      
      if (data.transfersTo.length > 0 || data.transfersFrom.length > 0 || data.stakeStarts.length > 0) {
        const latestTransferTo = data.transfersTo[0];
        if (latestTransferTo) {
          estimatedBalance = latestTransferTo.value;
        }
      }

      return {
        address,
        balance: estimatedBalance,
        balanceFormatted: this.formatHexAmount(estimatedBalance),
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
        # Regular HEX transfers
        transfersFrom: transfers(
          where: { from: $address }
          orderBy: timestamp
          orderDirection: desc
          first: $limit
        ) {
          id
          from
          to
          value
          timestamp
          transactionHash
          blockNumber
        }
        transfersTo: transfers(
          where: { to: $address }
          orderBy: timestamp
          orderDirection: desc
          first: $limit
        ) {
          id
          from
          to
          value
          timestamp
          transactionHash
          blockNumber
        }
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
        transfersFrom: Array<{
          id: string; from: string; to: string; value: string; 
          timestamp: string; transactionHash: string; blockNumber: string;
        }>;
        transfersTo: Array<{
          id: string; from: string; to: string; value: string; 
          timestamp: string; transactionHash: string; blockNumber: string;
        }>;
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

      // Process transfers from the address (outgoing)
      data.transfersFrom.forEach(transfer => {
        transactions.push({
          id: transfer.id,
          hash: transfer.transactionHash,
          blockNumber: transfer.blockNumber,
          timestamp: transfer.timestamp,
          from: transfer.from,
          to: transfer.to,
          value: transfer.value,
          type: 'transfer',
          description: `Sent ${this.formatHexAmount(transfer.value)} HEX to ${transfer.to.slice(0, 8)}...`,
          network: 'ethereum'
        });
      });

      // Process transfers to the address (incoming)
      data.transfersTo.forEach(transfer => {
        transactions.push({
          id: transfer.id,
          hash: transfer.transactionHash,
          blockNumber: transfer.blockNumber,
          timestamp: transfer.timestamp,
          from: transfer.from,
          to: transfer.to,
          value: transfer.value,
          type: 'transfer',
          description: `Received ${this.formatHexAmount(transfer.value)} HEX from ${transfer.from.slice(0, 8)}...`,
          network: 'ethereum'
        });
      });

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
    // Similar query structure for PulseChain
    const query = `
      query GetAllHexTransactions($address: String!, $limit: Int!) {
        transfersFrom: transfers(
          where: { from: $address }
          orderBy: timestamp
          orderDirection: desc
          first: $limit
        ) {
          id
          from
          to
          value
          timestamp
          transactionHash
          blockNumber
        }
        transfersTo: transfers(
          where: { to: $address }
          orderBy: timestamp
          orderDirection: desc
          first: $limit
        ) {
          id
          from
          to
          value
          timestamp
          transactionHash
          blockNumber
        }
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
        transfersFrom: Array<{
          id: string; from: string; to: string; value: string; 
          timestamp: string; transactionHash: string; blockNumber: string;
        }>;
        transfersTo: Array<{
          id: string; from: string; to: string; value: string; 
          timestamp: string; transactionHash: string; blockNumber: string;
        }>;
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

      // Process transfers from the address (outgoing)
      data.transfersFrom.forEach(transfer => {
        transactions.push({
          id: transfer.id,
          hash: transfer.transactionHash,
          blockNumber: transfer.blockNumber,
          timestamp: transfer.timestamp,
          from: transfer.from,
          to: transfer.to,
          value: transfer.value,
          type: 'transfer',
          description: `Sent ${this.formatHexAmount(transfer.value)} HEX to ${transfer.to.slice(0, 8)}...`,
          network: 'pulsechain'
        });
      });

      // Process transfers to the address (incoming)
      data.transfersTo.forEach(transfer => {
        transactions.push({
          id: transfer.id,
          hash: transfer.transactionHash,
          blockNumber: transfer.blockNumber,
          timestamp: transfer.timestamp,
          from: transfer.from,
          to: transfer.to,
          value: transfer.value,
          type: 'transfer',
          description: `Received ${this.formatHexAmount(transfer.value)} HEX from ${transfer.from.slice(0, 8)}...`,
          network: 'pulsechain'
        });
      });

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
    const response = await fetch(this.PULSECHAIN_PROXY, {
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
      throw new Error(`PulseChain GraphQL proxy error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`PulseChain GraphQL proxy error: ${data.error}`);
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