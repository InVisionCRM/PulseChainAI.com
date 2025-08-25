import Moralis from 'moralis';

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

// Global Moralis initialization state
let isMoralisInitialized = false;

export class HexTransactionService {
  // HEX contract addresses
  private readonly HEX_CONTRACT_ADDRESS = '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39';
  
  // Moralis API configuration
  private readonly MORALIS_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjYzOWU4ZWMwLTJkM2ItNDgwYS04MWY5LTdiMDM3OTYxZjIyYSIsIm9yZ0lkIjoiNDMyMTk3IiwidXNlcklkIjoiNDQ0NTc3IiwidHlwZUlkIjoiZWY3YmEyYjMtMTMyYS00MWI0LWEyMDgtYTUwNGEzMjk5NDMzIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3Mzk4NTgyMDYsImV4cCI6NDg5NTYxODIwNn0.iSuHF229Nk_9yiiqDxyyGM0MB6DEG09gLa2oFWYf5us';
  
  private async initMoralis() {
    if (!isMoralisInitialized) {
      try {
        // Check if Moralis is already started
        if (Moralis.Core.isStarted) {
          isMoralisInitialized = true;
          return;
        }
        
        await Moralis.start({
          apiKey: this.MORALIS_API_KEY
        });
        isMoralisInitialized = true;
      } catch (error) {
        // If error is about modules already started, just mark as initialized
        if (error instanceof Error && error.message.includes('Modules are started already')) {
          isMoralisInitialized = true;
          return;
        }
        console.error('Failed to initialize Moralis:', error);
        throw error;
      }
    }
  }

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
    try {
      await this.initMoralis();
      
      const response = await Moralis.EvmApi.token.getWalletTokenBalances({
        chain: '0x1',
        address: address,
        tokenAddresses: [this.HEX_CONTRACT_ADDRESS]
      });
      
      const hexToken = response.raw.find((token: any) => 
        token.token_address.toLowerCase() === this.HEX_CONTRACT_ADDRESS.toLowerCase()
      );
      
      const balance = hexToken ? hexToken.balance : '0';
      
      return {
        address,
        balance,
        balanceFormatted: this.formatHexAmount(balance),
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
      await this.initMoralis();
      
      const response = await Moralis.EvmApi.token.getWalletTokenBalances({
        chain: '0x171',
        address: address,
        tokenAddresses: [this.HEX_CONTRACT_ADDRESS]
      });
      
      const hexToken = response.raw.find((token: any) => 
        token.token_address.toLowerCase() === this.HEX_CONTRACT_ADDRESS.toLowerCase()
      );
      
      const balance = hexToken ? hexToken.balance : '0';
      
      return {
        address,
        balance,
        balanceFormatted: this.formatHexAmount(balance),
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
    try {
      await this.initMoralis();
      
      const response = await Moralis.EvmApi.token.getWalletTokenTransfers({
        chain: '0x1',
        order: 'DESC',
        address: address,
        contractAddresses: [this.HEX_CONTRACT_ADDRESS],
        limit: limit
      });
      
      const transactions: HexTransaction[] = [];
      
      // Process token transfers
      response.raw.result.forEach((tx: any) => {
        const isReceived = tx.to_address.toLowerCase() === address.toLowerCase();
        const description = isReceived 
          ? `Received ${this.formatHexAmount(tx.value)} HEX from ${tx.from_address.slice(0, 8)}...`
          : `Sent ${this.formatHexAmount(tx.value)} HEX to ${tx.to_address.slice(0, 8)}...`;
          
        transactions.push({
          id: `${tx.transaction_hash}_${tx.log_index}`,
          hash: tx.transaction_hash,
          blockNumber: tx.block_number,
          timestamp: tx.block_timestamp,
          from: tx.from_address,
          to: tx.to_address,
          value: tx.value,
          type: 'transfer',
          description,
          network: 'ethereum'
        });
      });
      
      return transactions;
    } catch (error) {
      console.error(`❌ Error fetching Ethereum HEX transactions:`, error);
      return [];
    }
  }

  private async getPulsechainHexTransactions(address: string, limit: number = 100): Promise<HexTransaction[]> {
    try {
      await this.initMoralis();
      
      const response = await Moralis.EvmApi.token.getWalletTokenTransfers({
        chain: '0x171',
        order: 'DESC',
        address: address,
        contractAddresses: [this.HEX_CONTRACT_ADDRESS],
        limit: limit
      });
      
      const transactions: HexTransaction[] = [];
      
      // Process token transfers
      response.raw.result.forEach((tx: any) => {
        const isReceived = tx.to_address.toLowerCase() === address.toLowerCase();
        const description = isReceived 
          ? `Received ${this.formatHexAmount(tx.value)} HEX from ${tx.from_address.slice(0, 8)}...`
          : `Sent ${this.formatHexAmount(tx.value)} HEX to ${tx.to_address.slice(0, 8)}...`;
          
        transactions.push({
          id: `${tx.transaction_hash}_${tx.log_index}`,
          hash: tx.transaction_hash,
          blockNumber: tx.block_number,
          timestamp: tx.block_timestamp,
          from: tx.from_address,
          to: tx.to_address,
          value: tx.value,
          type: 'transfer',
          description,
          network: 'pulsechain'
        });
      });
      
      return transactions;
    } catch (error) {
      console.error(`❌ Error fetching PulseChain HEX transactions:`, error);
      return [];
    }
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
    return new Date(timestamp).toLocaleDateString('en-US', {
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