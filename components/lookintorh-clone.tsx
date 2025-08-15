"use client";

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Eye, Bell, Activity, Zap, BarChart3, Target } from 'lucide-react';

// Type definitions
interface HistoricalPurchase {
  date: string;
  eth: number;
  price: number;
  value: number;
}

interface ChartDataPoint {
  date: string;
  ethPrice: number;
  totalETH: number;
  totalInvestment: number;
  currentValue: number;
  profitLoss: number;
  dcaPrice: number;
}

interface WalletBalances {
  [key: string]: number;
}

interface ApiErrors {
  [key: string]: string | null;
}

interface Transaction {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  nonce: string;
  blockHash: string;
  transactionIndex: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  gasUsed: string;
  confirmations: string;
  methodId: string;
  functionName: string;
}

interface InternalTransaction {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  input: string;
  type: string;
  gas: string;
  gasUsed: string;
  traceId: string;
  isError: string;
  errCode: string;
}

interface Transfer {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  nonce: string;
  input: string;
  confirmations: string;
}

const LookIntoRHClone = () => {
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [totalValue, setTotalValue] = useState<number>(0);
  const [totalETH, setTotalETH] = useState<number>(0);
  const [profitLoss, setProfitLoss] = useState<number>(0);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [walletBalances, setWalletBalances] = useState<WalletBalances>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [apiKey, setApiKey] = useState<string>('5NIDMGWB2UYP7S88YWVR65JMB5ZVPD5W9U');
  const [apiKeyInput, setApiKeyInput] = useState<string>('5NIDMGWB2UYP7S88YWVR65JMB5ZVPD5W9U');
  const [apiErrors, setApiErrors] = useState<ApiErrors>({});
  const [showApiSettings, setShowApiSettings] = useState<boolean>(false);
  
  // Transaction states
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [internalTransactions, setInternalTransactions] = useState<InternalTransaction[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState<boolean>(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | InternalTransaction | Transfer | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'transactions' | 'internal' | 'transfers'>('transactions');

  // Known Ethereum wallet addresses from Richard Heart treasury
  const WALLET_ADDRESSES: { [key: string]: string } = {
    'PulseChain Sacrifice': '0x9Cd83BE15a79646A3D22B81fc8dDf7B7240a62cB',
    'PulseX Sacrifice': '0x075e72a5edf65f0a5f44699c7654c1a76941ddc8'
  };

  // Historical purchase data - replace with actual data when available
  const HISTORICAL_PURCHASES: HistoricalPurchase[] = [
    // Add real purchase data here when available
    // Format: { date: 'YYYY-MM-DD', eth: amount, price: priceAtPurchase, value: totalUSDValue }
  ];

  // Robust fetch function with multiple CORS proxy fallbacks
  const fetchWithProxy = async (url: string) => {
    const proxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      `https://cors-anywhere.herokuapp.com/${url}`,
      `https://thingproxy.freeboard.io/fetch/${url}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
      `https://cors.bridged.cc/${url}`,
      `https://cors.eu.org/${url}`
    ];
    
    // Helper function to create a timeout promise
    const createTimeout = (ms: number) => new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Request timeout after ${ms}ms`)), ms)
    );
    
    for (let i = 0; i < proxies.length; i++) {
      try {
        console.log(`Trying proxy ${i + 1}/${proxies.length}: ${proxies[i].slice(0, 50)}...`);
        
        // Race between fetch and timeout (10 seconds)
        const response = await Promise.race([
          fetch(proxies[i], {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (compatible; LookIntoRH/1.0)'
            }
          }),
          createTimeout(10000)
        ]);
        
        if (response.ok) {
          console.log(`Proxy ${i + 1} successful with status: ${response.status}`);
          
          // Test if the response actually contains valid data
          try {
            const text = await response.text();
            console.log(`Proxy ${i + 1} response preview:`, text.slice(0, 200));
            
            // Check if it's valid JSON or contains expected data
            if (text.includes('"status"') || text.includes('"result"') || text.includes('"message"')) {
              console.log(`Proxy ${i + 1} contains valid API response`);
              // Create a new response object since we consumed the text
              return new Response(text, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
              });
            } else {
              console.log(`Proxy ${i + 1} response doesn't contain expected API data`);
              continue; // Try next proxy
            }
          } catch (parseError) {
            console.log(`Proxy ${i + 1} failed to parse response:`, parseError);
            continue; // Try next proxy
          }
        } else {
          console.log(`Proxy ${i + 1} failed with status: ${response.status}`);
        }
      } catch (error) {
        console.log(`Proxy ${i + 1} failed with error:`, error);
        continue;
      }
    }
    
    // If all proxies fail, try direct fetch (may fail due to CORS)
    console.log('All proxies failed, trying direct fetch...');
    try {
      const response = await Promise.race([
        fetch(url),
        createTimeout(10000)
      ]);
      return response;
    } catch (error) {
      console.log('Direct fetch also failed:', error);
      throw new Error('All fetch methods failed');
    }
  };

  // Fetch current ETH price from CoinGecko API
  const fetchETHPrice = async () => {
    try {
      console.log('Fetching ETH price from CoinGecko...');
      // Try direct fetch first (works in some environments)
      let response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      
      if (!response.ok) {
        throw new Error(`Direct fetch failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('CoinGecko direct response:', data);
      
      if (data.ethereum && data.ethereum.usd) {
        const price = data.ethereum.usd;
        console.log(`Current ETH price: $${price}`);
        setApiErrors(prev => ({...prev, ethPrice: null}));
        return price;
      }
      throw new Error('Invalid price data from CoinGecko');
    } catch (error) {
      console.error('Direct CoinGecko fetch failed:', error);
      
      // Try DexScreener as primary fallback
      try {
        console.log('Trying DexScreener for ETH price...');
        const response = await fetch('https://api.dexscreener.com/latest/dex/search?q=ethereum');
        
        if (!response.ok) {
          throw new Error(`DexScreener HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('DexScreener response:', data);
        
        if (data.pairs && data.pairs.length > 0) {
          // Find a reliable ETH/USDC or ETH/USDT pair with good liquidity
          const reliablePair = data.pairs.find((pair: any) => 
            (pair.baseToken.symbol === 'ETH' || pair.baseToken.symbol === 'WETH') &&
            (pair.quoteToken.symbol === 'USDC' || pair.quoteToken.symbol === 'USDT') &&
            parseFloat(pair.liquidity?.usd || '0') > 1000000 // At least $1M liquidity
          );
          
          if (reliablePair && reliablePair.priceUsd) {
            const price = parseFloat(reliablePair.priceUsd);
            console.log(`DexScreener ETH price: $${price} from ${reliablePair.dexId}`);
            setApiErrors(prev => ({...prev, ethPrice: null}));
            return price;
          }
        }
        
        throw new Error('No reliable ETH price data found from DexScreener');
      } catch (fallbackError) {
        console.error('DexScreener also failed:', fallbackError);
        
        // Final fallback: use a reasonable default price
        console.log('Using fallback ETH price: $4000');
        setApiErrors(prev => ({...prev, ethPrice: 'Using fallback price - APIs unavailable'}));
        return 4000;
      }
    }
  };

  // Fetch wallet balance using Etherscan v2 API
  const fetchWalletBalance = async (address: string) => {
    try {
      console.log(`Fetching balance for ${address} with API key: ${apiKey}...`);
      // Using Etherscan v2 API format with chainid parameter
      const url = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=balance&address=${address}&tag=latest&apikey=${apiKey}`;
      const response = await fetchWithProxy(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`API v2 response for ${address}:`, data);
      
      if (data.status === '1' && data.result) {
        // Convert from Wei to ETH
        const ethBalance = parseFloat(data.result) / 1e18;
        console.log(`Real balance for ${address}: ${ethBalance} ETH`);
        setApiErrors(prev => ({...prev, [`wallet_${address}`]: null}));
        return ethBalance;
      } else {
        const errorMsg = data.message || data.result || 'Unknown API error';
        console.error(`API v2 error for ${address}:`, errorMsg);
        setApiErrors(prev => ({...prev, [`wallet_${address}`]: errorMsg}));
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error(`Error fetching wallet balance for ${address}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setApiErrors(prev => ({...prev, [`wallet_${address}`]: errorMessage}));
      return 0;
    }
  };

  // Update API key and refresh data
  const updateApiKey = () => {
    setApiKey(apiKeyInput);
    setApiErrors({});
    initializeData();
  };

  // Test API key function
  const testApiKey = async () => {
    setLoading(true);
    setApiErrors({});
    
    try {
      // Test with Vitalik's well-known ETH address for API validation
      const testAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // Vitalik's address
      const url = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=balance&address=${testAddress}&tag=latest&apikey=${apiKeyInput}`;
      const response = await fetchWithProxy(url);
      const data = await response.json();
      
      console.log('API key test response:', data);
      
      if (data.status === '1') {
        setApiErrors({test: 'API Key is valid! ✅ (Ethereum mainnet access confirmed)'});
        setApiKey(apiKeyInput);
      } else {
        setApiErrors({test: `API Key Error: ${data.message || data.result}`});
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setApiErrors({test: `Network Error: ${errorMessage}`});
    }
    
    setLoading(false);
  };

  // Fetch transactions for a wallet address
  const fetchTransactions = async (address: string) => {
    try {
      console.log(`Fetching transactions for ${address}...`);
      const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1000&sort=desc&apikey=${apiKey}`;
      const response = await fetchWithProxy(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Transactions response for ${address}:`, data);
      
      if (data.status === '1' && data.result) {
        return data.result as Transaction[];
      } else {
        const errorMsg = data.message || data.result || 'Unknown API error';
        console.error(`Transactions API error for ${address}:`, errorMsg);
        return [];
      }
    } catch (error) {
      console.error(`Error fetching transactions for ${address}:`, error);
      return [];
    }
  };

  // Fetch internal transactions for a wallet address
  const fetchInternalTransactions = async (address: string) => {
    try {
      console.log(`Fetching internal transactions for ${address}...`);
      const url = `https://api.etherscan.io/api?module=account&action=txlistinternal&address=${address}&startblock=0&endblock=99999999&page=1&offset=1000&sort=desc&apikey=${apiKey}`;
      const response = await fetchWithProxy(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Internal transactions response for ${address}:`, data);
      
      if (data.status === '1' && data.result) {
        return data.result as InternalTransaction[];
      } else {
        const errorMsg = data.message || data.result || 'Unknown API error';
        console.error(`Internal transactions API error for ${address}:`, errorMsg);
        return [];
      }
    } catch (error) {
      console.error(`Error fetching internal transactions for ${address}:`, error);
      return [];
    }
  };

  // Fetch token transfers for a wallet address
  const fetchTransfers = async (address: string) => {
    try {
      console.log(`Fetching token transfers for ${address}...`);
      const url = `https://api.etherscan.io/api?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&page=1&offset=1000&sort=desc&apikey=${apiKey}`;
      const response = await fetchWithProxy(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Token transfers response for ${address}:`, data);
      
      if (data.status === '1' && data.result) {
        return data.result as Transfer[];
      } else {
        const errorMsg = data.message || data.result || 'Unknown API error';
        console.error(`Token transfers API error for ${address}:`, errorMsg);
        return [];
      }
    } catch (error) {
      console.error(`Error fetching token transfers for ${address}:`, error);
      return [];
    }
  };

  // Fetch all transaction data for all wallets
  const fetchAllTransactionData = async () => {
    setTransactionsLoading(true);
    console.log('Starting to fetch transaction data...');
    
    try {
      const allTransactions: Transaction[] = [];
      const allInternalTransactions: InternalTransaction[] = [];
      const allTransfers: Transfer[] = [];
      
      for (const [name, address] of Object.entries(WALLET_ADDRESSES)) {
        console.log(`Fetching transaction data for ${name} (${address})...`);
        
        // Fetch regular transactions
        const txs = await fetchTransactions(address);
        console.log(`Got ${txs.length} transactions for ${name}`);
        allTransactions.push(...txs);
        
        // Fetch internal transactions
        const internalTxs = await fetchInternalTransactions(address);
        console.log(`Got ${internalTxs.length} internal transactions for ${name}`);
        allInternalTransactions.push(...internalTxs);
        
        // Fetch token transfers
        const tokenTxs = await fetchTransfers(address);
        console.log(`Got ${tokenTxs.length} token transfers for ${name}`);
        allTransfers.push(...tokenTxs);
      }
      
      // Sort by timestamp (newest first)
      allTransactions.sort((a, b) => parseInt(b.timeStamp) - parseInt(a.timeStamp));
      allInternalTransactions.sort((a, b) => parseInt(b.timeStamp) - parseInt(a.timeStamp));
      allTransfers.sort((a, b) => parseInt(b.timeStamp) - parseInt(a.timeStamp));
      
      console.log(`Total transactions: ${allTransactions.length}`);
      console.log(`Total internal transactions: ${allInternalTransactions.length}`);
      console.log(`Total transfers: ${allTransfers.length}`);
      
      setTransactions(allTransactions.slice(0, 1000));
      setInternalTransactions(allInternalTransactions.slice(0, 1000));
      setTransfers(allTransfers.slice(0, 1000));
      
      console.log(`Fetched ${allTransactions.length} transactions, ${allInternalTransactions.length} internal transactions, ${allTransfers.length} transfers`);
    } catch (error) {
      console.error('Error fetching transaction data:', error);
    } finally {
      setTransactionsLoading(false);
    }
  };

  // Calculate running totals and generate chart data
  const generateChartData = (currentETHPrice: number) => {
    let runningETH = 0;
    let runningInvestment = 0;
    
    const chartPoints = HISTORICAL_PURCHASES.map(purchase => {
      runningETH += purchase.eth;
      runningInvestment += purchase.value;
      
      const currentValue = runningETH * currentETHPrice;
      const profitLoss = currentValue - runningInvestment;
      
      return {
        date: purchase.date,
        ethPrice: currentETHPrice,
        totalETH: runningETH,
        totalInvestment: runningInvestment,
        currentValue: currentValue,
        profitLoss: profitLoss,
        dcaPrice: runningInvestment / runningETH
      };
    });

    return chartPoints;
  };

  // Initialize data function
  const initializeData = async () => {
    setLoading(true);
    
    try {
      // Fetch current ETH price
      const currentPrice = await fetchETHPrice();
      setEthPrice(currentPrice);

      // Fetch wallet balances
      const balances: WalletBalances = {};
      for (const [name, address] of Object.entries(WALLET_ADDRESSES)) {
        balances[name] = await fetchWalletBalance(address);
      }
      setWalletBalances(balances);

      // Fetch transaction data
      await fetchAllTransactionData();

      // Calculate totals
      const totalETHHoldings = Object.values(balances).reduce((sum: number, balance: number) => sum + balance, 0);
      setTotalETH(totalETHHoldings);
      
      const totalCurrentValue = totalETHHoldings * currentPrice;
      setTotalValue(totalCurrentValue);

      // Generate chart data
      const chartPoints = generateChartData(currentPrice);
      setChartData(chartPoints);

      // Calculate overall profit/loss
      const totalInvested = HISTORICAL_PURCHASES.reduce((sum: number, purchase: HistoricalPurchase) => sum + purchase.value, 0);
      const overallProfitLoss = totalCurrentValue - totalInvested;
      setProfitLoss(overallProfitLoss);

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error initializing data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initialize data on component mount
  useEffect(() => {
    initializeData();

    // Set up real-time updates every 30 seconds
    const interval = setInterval(async () => {
      const newPrice = await fetchETHPrice();
      setEthPrice(newPrice);
      setTotalValue(totalETH * newPrice);
      setLastUpdate(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, [totalETH, apiKey]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format number with commas
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(num));
  };

  // Format timestamp to readable date
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(parseInt(timestamp) * 1000);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format ETH value from Wei
  const formatETHValue = (value: string) => {
    const ethValue = parseFloat(value) / 1e18;
    return `${ethValue.toFixed(6)} ETH`;
  };

  // Format gas price from Wei
  const formatGasPrice = (gasPrice: string) => {
    const gwei = parseFloat(gasPrice) / 1e9;
    return `${gwei.toFixed(2)} Gwei`;
  };

  // Format address for display
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Get transaction status color
  const getTransactionStatusColor = (isError: string, status: string) => {
    if (isError === '1') return 'text-red-400';
    if (status === '1') return 'text-green-400';
    return 'text-yellow-400';
  };

  // Get transaction status text
  const getTransactionStatusText = (isError: string, status: string) => {
    if (isError === '1') return 'Failed';
    if (status === '1') return 'Success';
    return 'Pending';
  };

  // Helper function to determine if a transaction is incoming or outgoing for any tracked wallet
  const getTransactionDirection = (tx: Transaction | InternalTransaction | Transfer, walletAddresses: Record<string, string>) => {
    if ('from' in tx && 'to' in tx) {
      const fromLower = tx.from.toLowerCase();
      const toLower = tx.to.toLowerCase();
      
      // Check if either address is one of our tracked wallets
      const isFromTracked = Object.values(walletAddresses).some(addr => addr.toLowerCase() === fromLower);
      const isToTracked = Object.values(walletAddresses).some(addr => addr.toLowerCase() === toLower);
      
      if (isFromTracked && !isToTracked) {
        return 'out';
      } else if (isToTracked && !isFromTracked) {
        return 'in';
      } else if (isFromTracked && isToTracked) {
        return 'internal'; // Transfer between tracked wallets
      }
    }
    return 'unknown';
  };

  // Helper function to get the relevant address for display (the one that's NOT a tracked wallet)
  const getOtherAddress = (tx: Transaction | InternalTransaction | Transfer, walletAddresses: Record<string, string>) => {
    if ('from' in tx && 'to' in tx) {
      const fromLower = tx.from.toLowerCase();
      const toLower = tx.to.toLowerCase();
      
      const isFromTracked = Object.values(walletAddresses).some(addr => addr.toLowerCase() === fromLower);
      const isToTracked = Object.values(walletAddresses).some(addr => addr.toLowerCase() === toLower);
      
      if (isFromTracked && !isToTracked) {
        return tx.to; // Show destination address
      } else if (isToTracked && !isFromTracked) {
        return tx.from; // Show source address
      }
    }
    return '';
  };

  // Helper function to check if an address is a known sacrifice address
  const isSacrificeAddress = (address: string) => {
    const sacrificeAddresses = [
      '0x000000000000000000000000000000000000dead', // Dead address
      '0x0000000000000000000000000000000000000000', // Zero address
      '0x0000000000000000000000000000000000000001', // One address
      '0x0000000000000000000000000000000000000002', // Two address
      '0x0000000000000000000000000000000000000003', // Three address
      '0x0000000000000000000000000000000000000004', // Four address
      '0x0000000000000000000000000000000000000005', // Five address
      '0x0000000000000000000000000000000000000006', // Six address
      '0x0000000000000000000000000000000000000007', // Seven address
      '0x0000000000000000000000000000000000000008', // Eight address
      '0x0000000000000000000000000000000000000009', // Nine address
      '0x000000000000000000000000000000000000000a', // Ten address
      '0x000000000000000000000000000000000000000b', // Eleven address
      '0x000000000000000000000000000000000000000c', // Twelve address
      '0x000000000000000000000000000000000000000d', // Thirteen address
      '0x000000000000000000000000000000000000000e', // Fourteen address
      '0x000000000000000000000000000000000000000f', // Fifteen address
      '0x0000000000000000000000000000000000000010', // Sixteen address
      '0x0000000000000000000000000000000000000011', // Seventeen address
      '0x0000000000000000000000000000000000000012', // Eighteen address
      '0x0000000000000000000000000000000000000013', // Nineteen address
      '0x0000000000000000000000000000000000000014', // Twenty address
      '0x0000000000000000000000000000000000000015', // Twenty-one address
      '0x0000000000000000000000000000000000000016', // Twenty-two address
      '0x0000000000000000000000000000000000000017', // Twenty-three address
      '0x0000000000000000000000000000000000000018', // Twenty-four address
      '0x0000000000000000000000000000000000000019', // Twenty-five address
      '0x000000000000000000000000000000000000001a', // Twenty-six address
      '0x000000000000000000000000000000000000001b', // Twenty-seven address
      '0x000000000000000000000000000000000000001c', // Twenty-eight address
      '0x000000000000000000000000000000000000001d', // Twenty-nine address
      '0x000000000000000000000000000000000000001e', // Thirty address
      '0x000000000000000000000000000000000000001f', // Thirty-one address
      '0x0000000000000000000000000000000000000020', // Thirty-two address
      '0x0000000000000000000000000000000000000021', // Thirty-three address
      '0x0000000000000000000000000000000000000022', // Thirty-four address
      '0x0000000000000000000000000000000000000023', // Thirty-five address
      '0x0000000000000000000000000000000000000024', // Thirty-six address
      '0x0000000000000000000000000000000000000025', // Thirty-seven address
      '0x0000000000000000000000000000000000000026', // Thirty-eight address
      '0x0000000000000000000000000000000000000027', // Thirty-nine address
      '0x0000000000000000000000000000000000000028', // Forty address
      '0x0000000000000000000000000000000000000029', // Forty-one address
      '0x000000000000000000000000000000000000002a', // Forty-two address
      '0x000000000000000000000000000000000000002b', // Forty-three address
      '0x000000000000000000000000000000000000002c', // Forty-four address
      '0x000000000000000000000000000000000000002d', // Forty-five address
      '0x000000000000000000000000000000000000002e', // Forty-six address
      '0x000000000000000000000000000000000000002f', // Forty-seven address
      '0x0000000000000000000000000000000000000030', // Forty-eight address
      '0x0000000000000000000000000000000000000031', // Forty-nine address
      '0x0000000000000000000000000000000000000032', // Fifty address
      '0x0000000000000000000000000000000000000033', // Fifty-one address
      '0x0000000000000000000000000000000000000034', // Fifty-two address
      '0x0000000000000000000000000000000000000035', // Fifty-three address
      '0x0000000000000000000000000000000000000036', // Fifty-four address
      '0x0000000000000000000000000000000000000037', // Fifty-five address
      '0x0000000000000000000000000000000000000038', // Fifty-six address
      '0x0000000000000000000000000000000000000039', // Fifty-seven address
      '0x000000000000000000000000000000000000003a', // Fifty-eight address
      '0x000000000000000000000000000000000000003b', // Fifty-nine address
      '0x000000000000000000000000000000000000003c', // Sixty address
      '0x000000000000000000000000000000000000003d', // Sixty-one address
      '0x000000000000000000000000000000000000003e', // Sixty-two address
      '0x000000000000000000000000000000000000003f', // Sixty-three address
      '0x0000000000000000000000000000000000000040', // Sixty-four address
      '0x0000000000000000000000000000000000000041', // Sixty-five address
      '0x0000000000000000000000000000000000000042', // Sixty-six address
      '0x0000000000000000000000000000000000000043', // Sixty-seven address
      '0x0000000000000000000000000000000000000044', // Sixty-eight address
      '0x0000000000000000000000000000000000000045', // Sixty-nine address
      '0x0000000000000000000000000000000000000046', // Seventy address
      '0x0000000000000000000000000000000000000047', // Seventy-one address
      '0x0000000000000000000000000000000000000048', // Seventy-two address
      '0x0000000000000000000000000000000000000049', // Seventy-three address
      '0x000000000000000000000000000000000000004a', // Seventy-four address
      '0x000000000000000000000000000000000000004b', // Seventy-five address
      '0x000000000000000000000000000000000000004c', // Seventy-six address
      '0x000000000000000000000000000000000000004d', // Seventy-seven address
      '0x000000000000000000000000000000000000004e', // Seventy-eight address
      '0x000000000000000000000000000000000000004f', // Seventy-nine address
      '0x0000000000000000000000000000000000000050', // Eighty address
      '0x0000000000000000000000000000000000000051', // Eighty-one address
      '0x0000000000000000000000000000000000000052', // Eighty-two address
      '0x0000000000000000000000000000000000000053', // Eighty-three address
      '0x0000000000000000000000000000000000000054', // Eighty-four address
      '0x0000000000000000000000000000000000000055', // Eighty-five address
      '0x0000000000000000000000000000000000000056', // Eighty-six address
      '0x0000000000000000000000000000000000000057', // Eighty-seven address
      '0x0000000000000000000000000000000000000058', // Eighty-eight address
      '0x0000000000000000000000000000000000000059', // Eighty-nine address
      '0x000000000000000000000000000000000000005a', // Ninety address
      '0x000000000000000000000000000000000000005b', // Ninety-one address
      '0x000000000000000000000000000000000000005c', // Ninety-two address
      '0x000000000000000000000000000000000000005d', // Ninety-three address
      '0x000000000000000000000000000000000000005e', // Ninety-four address
      '0x000000000000000000000000000000000000005f', // Ninety-five address
      '0x0000000000000000000000000000000000000060', // Ninety-six address
      '0x0000000000000000000000000000000000000061', // Ninety-seven address
      '0x0000000000000000000000000000000000000062', // Ninety-eight address
      '0x0000000000000000000000000000000000000063', // Ninety-nine address
      '0x0000000000000000000000000000000000000064', // One hundred address
      '0x0000000000000000000000000000000000000065', // One hundred one address
      '0x0000000000000000000000000000000000000066', // One hundred two address
      '0x0000000000000000000000000000000000000067', // One hundred three address
      '0x0000000000000000000000000000000000000068', // One hundred four address
      '0x0000000000000000000000000000000000000069', // One hundred five address
      '0x000000000000000000000000000000000000006a', // One hundred six address
      '0x000000000000000000000000000000000000006b', // One hundred seven address
      '0x000000000000000000000000000000000000006c', // One hundred eight address
      '0x000000000000000000000000000000000000006d', // One hundred nine address
      '0x000000000000000000000000000000000000006e', // One hundred ten address
      '0x000000000000000000000000000000000000006f', // One hundred eleven address
      '0x0000000000000000000000000000000000000070', // One hundred twelve address
      '0x0000000000000000000000000000000000000071', // One hundred thirteen address
      '0x0000000000000000000000000000000000000072', // One hundred fourteen address
      '0x0000000000000000000000000000000000000073', // One hundred fifteen address
      '0x0000000000000000000000000000000000000074', // One hundred sixteen address
      '0x0000000000000000000000000000000000000075', // One hundred seventeen address
      '0x0000000000000000000000000000000000000076', // One hundred eighteen address
      '0x0000000000000000000000000000000000000077', // One hundred nineteen address
      '0x0000000000000000000000000000000000000078', // One hundred twenty address
      '0x0000000000000000000000000000000000000079', // One hundred twenty-one address
      '0x000000000000000000000000000000000000007a', // One hundred twenty-two address
      '0x000000000000000000000000000000000000007b', // One hundred twenty-three address
      '0x000000000000000000000000000000000000007c', // One hundred twenty-four address
      '0x000000000000000000000000000000000000007d', // One hundred twenty-five address
      '0x000000000000000000000000000000000000007e', // One hundred twenty-six address
      '0x000000000000000000000000000000000000007f', // One hundred twenty-seven address
      '0x0000000000000000000000000000000000000080', // One hundred twenty-eight address
      '0x0000000000000000000000000000000000000081', // One hundred twenty-nine address
      '0x0000000000000000000000000000000000000082', // One hundred thirty address
      '0x0000000000000000000000000000000000000083', // One hundred thirty-one address
      '0x0000000000000000000000000000000000000084', // One hundred thirty-two address
      '0x0000000000000000000000000000000000000085', // One hundred thirty-three address
      '0x0000000000000000000000000000000000000086', // One hundred thirty-four address
      '0x0000000000000000000000000000000000000087', // One hundred thirty-five address
      '0x0000000000000000000000000000000000000088', // One hundred thirty-six address
      '0x0000000000000000000000000000000000000089', // One hundred thirty-seven address
      '0x000000000000000000000000000000000000008a', // One hundred thirty-eight address
      '0x000000000000000000000000000000000000008b', // One hundred thirty-nine address
      '0x000000000000000000000000000000000000008c', // One hundred forty address
      '0x000000000000000000000000000000000000008d', // One hundred forty-one address
      '0x000000000000000000000000000000000000008e', // One hundred forty-two address
      '0x000000000000000000000000000000000000008f', // One hundred forty-three address
      '0x0000000000000000000000000000000000000090', // One hundred forty-four address
      '0x0000000000000000000000000000000000000091', // One hundred forty-five address
      '0x0000000000000000000000000000000000000092', // One hundred forty-six address
      '0x0000000000000000000000000000000000000093', // One hundred forty-seven address
      '0x0000000000000000000000000000000000000094', // One hundred forty-eight address
      '0x0000000000000000000000000000000000000095', // One hundred forty-nine address
      '0x0000000000000000000000000000000000000096', // One hundred fifty address
      '0x0000000000000000000000000000000000000097', // One hundred fifty-one address
      '0x0000000000000000000000000000000000000098', // One hundred fifty-two address
      '0x0000000000000000000000000000000000000099', // One hundred fifty-three address
      '0x000000000000000000000000000000000000009a', // One hundred fifty-four address
      '0x000000000000000000000000000000000000009b', // One hundred fifty-five address
      '0x000000000000000000000000000000000000009c', // One hundred fifty-six address
      '0x000000000000000000000000000000000000009d', // One hundred fifty-seven address
      '0x000000000000000000000000000000000000009e', // One hundred fifty-eight address
      '0x000000000000000000000000000000000000009f', // One hundred fifty-nine address
      '0x00000000000000000000000000000000000000a0', // One hundred sixty address
      '0x00000000000000000000000000000000000000a1', // One hundred sixty-one address
      '0x00000000000000000000000000000000000000a2', // One hundred sixty-two address
      '0x00000000000000000000000000000000000000a3', // One hundred sixty-three address
      '0x00000000000000000000000000000000000000a4', // One hundred sixty-four address
      '0x00000000000000000000000000000000000000a5', // One hundred sixty-five address
      '0x00000000000000000000000000000000000000a6', // One hundred sixty-six address
      '0x00000000000000000000000000000000000000a7', // One hundred sixty-seven address
      '0x00000000000000000000000000000000000000a8', // One hundred sixty-eight address
      '0x00000000000000000000000000000000000000a9', // One hundred sixty-nine address
      '0x00000000000000000000000000000000000000aa', // One hundred seventy address
      '0x00000000000000000000000000000000000000ab', // One hundred seventy-one address
      '0x00000000000000000000000000000000000000ac', // One hundred seventy-two address
      '0x00000000000000000000000000000000000000ad', // One hundred seventy-three address
      '0x00000000000000000000000000000000000000ae', // One hundred seventy-four address
      '0x00000000000000000000000000000000000000af', // One hundred seventy-five address
      '0x00000000000000000000000000000000000000b0', // One hundred seventy-six address
      '0x00000000000000000000000000000000000000b1', // One hundred seventy-seven address
      '0x00000000000000000000000000000000000000b2', // One hundred seventy-eight address
      '0x00000000000000000000000000000000000000b3', // One hundred seventy-nine address
      '0x00000000000000000000000000000000000000b4', // One hundred eighty address
      '0x00000000000000000000000000000000000000b5', // One hundred eighty-one address
      '0x00000000000000000000000000000000000000b6', // One hundred eighty-two address
      '0x00000000000000000000000000000000000000b7', // One hundred eighty-three address
      '0x00000000000000000000000000000000000000b8', // One hundred eighty-four address
      '0x00000000000000000000000000000000000000b9', // One hundred eighty-five address
      '0x00000000000000000000000000000000000000ba', // One hundred eighty-six address
      '0x00000000000000000000000000000000000000bb', // One hundred eighty-seven address
      '0x00000000000000000000000000000000000000bc', // One hundred eighty-eight address
      '0x00000000000000000000000000000000000000bd', // One hundred eighty-nine address
      '0x00000000000000000000000000000000000000be', // One hundred ninety address
      '0x00000000000000000000000000000000000000bf', // One hundred ninety-one address
      '0x00000000000000000000000000000000000000c0', // One hundred ninety-two address
      '0x00000000000000000000000000000000000000c1', // One hundred ninety-three address
      '0x00000000000000000000000000000000000000c2', // One hundred ninety-four address
      '0x00000000000000000000000000000000000000c3', // One hundred ninety-five address
      '0x00000000000000000000000000000000000000c4', // One hundred ninety-six address
      '0x00000000000000000000000000000000000000c5', // One hundred ninety-seven address
      '0x00000000000000000000000000000000000000c6', // One hundred ninety-eight address
      '0x00000000000000000000000000000000000000c7', // One hundred ninety-nine address
      '0x00000000000000000000000000000000000000c8', // Two hundred address
      '0x00000000000000000000000000000000000000c9', // Two hundred one address
      '0x00000000000000000000000000000000000000ca', // Two hundred two address
      '0x00000000000000000000000000000000000000cb', // Two hundred three address
      '0x00000000000000000000000000000000000000cc', // Two hundred four address
      '0x00000000000000000000000000000000000000cd', // Two hundred five address
      '0x00000000000000000000000000000000000000ce', // Two hundred six address
      '0x00000000000000000000000000000000000000cf', // Two hundred seven address
      '0x00000000000000000000000000000000000000d0', // Two hundred eight address
      '0x00000000000000000000000000000000000000d1', // Two hundred nine address
      '0x00000000000000000000000000000000000000d2', // Two hundred ten address
      '0x00000000000000000000000000000000000000d3', // Two hundred eleven address
      '0x00000000000000000000000000000000000000d4', // Two hundred twelve address
      '0x00000000000000000000000000000000000000d5', // Two hundred thirteen address
      '0x00000000000000000000000000000000000000d6', // Two hundred fourteen address
      '0x00000000000000000000000000000000000000d7', // Two hundred fifteen address
      '0x00000000000000000000000000000000000000d8', // Two hundred sixteen address
      '0x00000000000000000000000000000000000000d9', // Two hundred seventeen address
      '0x00000000000000000000000000000000000000da', // Two hundred eighteen address
      '0x00000000000000000000000000000000000000db', // Two hundred nineteen address
      '0x00000000000000000000000000000000000000dc', // Two hundred twenty address
      '0x00000000000000000000000000000000000000dd', // Two hundred twenty-one address
      '0x00000000000000000000000000000000000000de', // Two hundred twenty-two address
      '0x00000000000000000000000000000000000000df', // Two hundred twenty-three address
      '0x00000000000000000000000000000000000000e0', // Two hundred twenty-four address
      '0x00000000000000000000000000000000000000e1', // Two hundred twenty-five address
      '0x00000000000000000000000000000000000000e2', // Two hundred twenty-six address
      '0x00000000000000000000000000000000000000e3', // Two hundred twenty-seven address
      '0x00000000000000000000000000000000000000e4', // Two hundred twenty-eight address
      '0x00000000000000000000000000000000000000e5', // Two hundred twenty-nine address
      '0x00000000000000000000000000000000000000e6', // Two hundred thirty address
      '0x00000000000000000000000000000000000000e7', // Two hundred thirty-one address
      '0x00000000000000000000000000000000000000e8', // Two hundred thirty-two address
      '0x00000000000000000000000000000000000000e9', // Two hundred thirty-three address
      '0x00000000000000000000000000000000000000ea', // Two hundred thirty-four address
      '0x00000000000000000000000000000000000000eb', // Two hundred thirty-five address
      '0x00000000000000000000000000000000000000ec', // Two hundred thirty-six address
      '0x00000000000000000000000000000000000000ed', // Two hundred thirty-seven address
      '0x00000000000000000000000000000000000000ee', // Two hundred thirty-eight address
      '0x00000000000000000000000000000000000000ef', // Two hundred thirty-nine address
      '0x00000000000000000000000000000000000000f0', // Two hundred forty address
      '0x00000000000000000000000000000000000000f1', // Two hundred forty-one address
      '0x00000000000000000000000000000000000000f2', // Two hundred forty-two address
      '0x00000000000000000000000000000000000000f3', // Two hundred forty-three address
      '0x00000000000000000000000000000000000000f4', // Two hundred forty-four address
      '0x00000000000000000000000000000000000000f5', // Two hundred forty-five address
      '0x00000000000000000000000000000000000000f6', // Two hundred forty-six address
      '0x00000000000000000000000000000000000000f7', // Two hundred forty-seven address
      '0x00000000000000000000000000000000000000f8', // Two hundred forty-eight address
      '0x00000000000000000000000000000000000000f9', // Two hundred forty-nine address
      '0x00000000000000000000000000000000000000fa', // Two hundred fifty address
      '0x00000000000000000000000000000000000000fb', // Two hundred fifty-one address
      '0x00000000000000000000000000000000000000fc', // Two hundred fifty-two address
      '0x00000000000000000000000000000000000000fd', // Two hundred fifty-three address
      '0x00000000000000000000000000000000000000fe', // Two hundred fifty-four address
      '0x00000000000000000000000000000000000000ff', // Two hundred fifty-five address
    ];
    return sacrificeAddresses.includes(address.toLowerCase());
  };

  // Helper function to check if an address is a contract (has code)
  const isContractAddress = (address: string) => {
    // This is a simplified check - in a real implementation you'd verify if the address has code
    // For now, we'll check if it's a known contract address or if it's not a sacrifice address
    const knownContracts = [
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
      '0xA0b86a33E6441b6c4c8B0d1B4c0B3c4c8B0d1B4', // Example contract
    ];
    return knownContracts.includes(address) || (!isSacrificeAddress(address) && address.length === 42);
  };

  // Helper function to get address label
  const getAddressLabel = (address: string) => {
    if (isSacrificeAddress(address)) {
      return '🔥 SACRIFICE';
    }
    if (isContractAddress(address)) {
      return '📜 CONTRACT';
    }
    return '👤 WALLET';
  };

  // Helper function to get transaction direction icon and color
  const getTransactionDirectionInfo = (direction: string) => {
    switch (direction) {
      case 'in':
        return { icon: '⬇️', color: 'text-green-400', bgColor: 'bg-green-900/20', label: 'INCOMING' };
      case 'out':
        return { icon: '⬆️', color: 'text-red-400', bgColor: 'bg-red-900/20', label: 'OUTGOING' };
      case 'internal':
        return { icon: '🔄', color: 'text-blue-400', bgColor: 'bg-blue-900/20', label: 'INTERNAL' };
      default:
        return { icon: '❓', color: 'text-gray-400', bgColor: 'bg-gray-900/20', label: 'UNKNOWN' };
    }
  };

  // Transaction Modal Component
  const TransactionModal = ({ transaction, onClose }: { transaction: Transaction | InternalTransaction | Transfer | null, onClose: () => void }) => {
    if (!transaction) return null;

    const isRegularTx = 'nonce' in transaction;
    const isInternalTx = 'type' in transaction;
    const isTransfer = 'tokenName' in transaction;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gray-800 backdrop-blur-sm border border-gray-600/50 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">
                {isRegularTx ? 'Transaction Details' : isInternalTx ? 'Internal Transaction Details' : 'Token Transfer Details'}
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Close transaction details"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Hash */}
              <div className="bg-gray-700 p-4 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Transaction Hash</h3>
                <p className="text-white font-mono text-sm break-all">{transaction.hash}</p>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Block Number</h3>
                  <p className="text-white">{transaction.blockNumber}</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Timestamp</h3>
                  <p className="text-white">{formatTimestamp(transaction.timeStamp)}</p>
                </div>
              </div>

              {/* Addresses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">From</h3>
                  <p className="text-white font-mono text-sm break-all">{transaction.from}</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">To</h3>
                  <p className="text-white font-mono text-sm break-all">{transaction.to}</p>
                </div>
              </div>

              {/* Value and Gas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Value</h3>
                  <p className="text-white">{formatETHValue(transaction.value)}</p>
                </div>
                {isRegularTx && (
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Gas Used</h3>
                    <p className="text-white">{parseInt(transaction.gasUsed).toLocaleString()}</p>
                  </div>
                )}
              </div>

              {/* Additional fields based on transaction type */}
              {isRegularTx && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-700 p-4 rounded-lg">
                      <h3 className="text-sm font-semibold text-gray-400 mb-2">Gas Price</h3>
                      <p className="text-white">{formatGasPrice(transaction.gasPrice)}</p>
                    </div>
                    <div className="bg-gray-700 p-4 rounded-lg">
                      <h3 className="text-sm font-semibold text-gray-400 mb-2">Status</h3>
                      <p className={isRegularTx ? getTransactionStatusColor(transaction.isError, transaction.txreceipt_status) : 'text-gray-400'}>
                        {isRegularTx ? getTransactionStatusText(transaction.isError, transaction.txreceipt_status) : 'N/A'}
                      </p>
                    </div>
                  </div>
                  {('functionName' in transaction) && transaction.functionName && (
                    <div className="bg-gray-700 p-4 rounded-lg">
                      <h3 className="text-sm font-semibold text-gray-400 mb-2">Function</h3>
                      <p className="text-white font-mono text-sm">{transaction.functionName}</p>
                    </div>
                  )}
                </>
              )}

              {isTransfer && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Token</h3>
                    <p className="text-white">{transaction.tokenName} ({transaction.tokenSymbol})</p>
                  </div>
                  <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="text-sm font-semibold text-gray-400 mb-2">Decimals</h3>
                    <p className="text-white">{transaction.tokenDecimal}</p>
                  </div>
                </div>
              )}

              {/* Input Data */}
              {transaction.input && transaction.input !== '0x' && (
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Input Data</h3>
                  <p className="text-white font-mono text-xs break-all">{transaction.input}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={onClose}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg text-white font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading Richard Heart Treasury Data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-400">LookIntoRH.com</h1>
          <div className="text-sm text-gray-400">
            Last Updated: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        {/* Title and Description */}
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold mb-4">Richard Heart Treasury Tracker</h2>
          <p className="text-gray-400 max-w-4xl mx-auto leading-relaxed">
            Since the inception of HEX in December 2019, it appears as though Richard Heart has been acquiring ETH via his projects Hex, Pulsechain, & PulseX. 
            The Pulsechain & PulseX sacrifice wallets are public and have been linked to ETH purchases/holdings worth {formatCurrency(totalValue)}. 
            This website indexes those alleged purchases and keeps track of their current value.
          </p>
        </div>

        {/* API Configuration Section */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">🔧 API Configuration</h3>
            <button 
              onClick={() => setShowApiSettings(!showApiSettings)}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm transition-colors"
            >
              {showApiSettings ? 'Hide Settings' : 'Show Settings'}
            </button>
          </div>
          
          {showApiSettings && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Etherscan API Key (Get free key at etherscan.io/apis)
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Enter your Etherscan API key"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                  <button
                    onClick={testApiKey}
                    className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-sm transition-colors"
                    disabled={loading}
                  >
                    Test Key
                  </button>
                  <button
                    onClick={updateApiKey}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm transition-colors"
                    disabled={loading}
                  >
                    Update & Refresh
                  </button>
                </div>
              </div>
              
              {apiErrors.test && (
                <div className={`p-3 rounded text-sm ${apiErrors.test.includes('✅') ? 'bg-green-900 text-green-100' : 'bg-red-900 text-red-100'}`}>
                  {apiErrors.test}
                </div>
              )}
              
              <div className="text-xs text-gray-400">
                <p>• Free Etherscan accounts get 100,000 requests/day</p>
                <p>• Using Etherscan v2 API for Ethereum mainnet (chainid=1)</p>
                <p>• API key format: 34 characters (letters and numbers)</p>
                <p>• Current key: {apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : 'Not set'}</p>
              </div>
            </div>
          )}
        </div>

        {/* API Status Indicator */}
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6">
          <h3 className="text-lg font-bold mb-2">📡 Live API Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">ETH Price API:</p>
              <p className={ethPrice > 0 ? 'text-green-400' : 'text-red-400'}>
                {ethPrice > 0 ? `✅ Connected - $${ethPrice.toLocaleString()}` : '❌ Failed'}
              </p>
              {apiErrors.ethPrice && (
                <p className="text-red-300 text-xs mt-1">{apiErrors.ethPrice}</p>
              )}
              {ethPrice > 0 && ethPrice < 100 && (
                <p className="text-yellow-300 text-xs mt-1">⚠️ Price seems unusually low, may be using fallback</p>
              )}
            </div>
            <div>
              <p className="text-gray-400">Wallet Balance API:</p>
              <p className={Object.values(walletBalances).some(b => b > 0) ? 'text-green-400' : 'text-red-400'}>
                {Object.values(walletBalances).some(b => b > 0) ? '✅ Connected' : '❌ Failed'}
              </p>
              {Object.entries(apiErrors).filter(([key]) => key.startsWith('wallet_')).map(([key, error]) => (
                <p key={key} className="text-red-300 text-xs mt-1">
                  {key.replace('wallet_', '').slice(0, 8)}...: {error}
                </p>
              ))}
            </div>
          </div>
          <div className="mt-3 p-2 bg-gray-700 rounded text-xs">
            <p className="text-yellow-400">💡 Troubleshooting:</p>
            <p className="text-gray-300">1. Check browser console (F12) for detailed errors</p>
            <p className="text-gray-300">2. Verify your API key is correct and active</p>
            <p className="text-gray-300">3. CORS errors are normal - using multiple proxy fallbacks</p>
            <p className="text-gray-300">4. If ETH price seems wrong, check console for fallback details</p>
          </div>
        </div>

        {/* Data Loading Indicator */}
        {loading && (
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-6">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-white text-lg mb-2">Loading Treasury Data...</p>
              <p className="text-gray-400 text-sm">Fetching wallet balances and transaction history</p>
            </div>
          </div>
        )}

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total ETH Holdings</p>
                <p className="text-2xl font-bold">{formatNumber(totalETH)} ETH</p>
              </div>
              <Activity className="text-blue-400" size={24} />
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Current ETH Price</p>
                <p className="text-2xl font-bold">{formatCurrency(ethPrice)}</p>
              </div>
              <BarChart3 className="text-green-400" size={24} />
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Portfolio Value</p>
                <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
              </div>
              <Target className="text-purple-400" size={24} />
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Unrealized P&L</p>
                <p className={`text-2xl font-bold ${profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {profitLoss >= 0 ? '+' : ''}{formatCurrency(profitLoss)}
                </p>
              </div>
              {profitLoss >= 0 ? 
                <TrendingUp className="text-green-400" size={24} /> : 
                <TrendingDown className="text-red-400" size={24} />
              }
            </div>
          </div>
        </div>

        {/* Pro Features Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-lg mb-8">
          <h3 className="text-xl font-bold mb-4">🔥 LookIntoRH Pro Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <Eye className="text-green-400" size={16} />
              <span>Be the first to know when the Pulsechain Treasury makes a move!</span>
            </div>
            <div className="flex items-center space-x-2">
              <Activity className="text-green-400" size={16} />
              <span>Block-by-block monitoring of all 35 treasury daughter wallets</span>
            </div>
            <div className="flex items-center space-x-2">
              <Bell className="text-green-400" size={16} />
              <span>Instant email, text, or Telegram alerts</span>
            </div>
            <div className="flex items-center space-x-2">
              <Target className="text-green-400" size={16} />
              <span>Custom threshold notifications</span>
            </div>
            <div className="flex items-center space-x-2">
              <Zap className="text-green-400" size={16} />
              <span>Get an edge over everyone on Pulsechain</span>
            </div>
            <div className="flex items-center space-x-2">
              <TrendingUp className="text-green-400" size={16} />
              <span>Must-have tool for this bull market (ETH &gt;$4k)</span>
            </div>
            <div className="flex items-center space-x-2">
              <BarChart3 className="text-green-400" size={16} />
              <span>Track all Tornado Cash mixing transactions</span>
            </div>
            <div className="flex items-center space-x-2">
              <Activity className="text-green-400" size={16} />
              <span>Pro Dashboard with real-time activity feed & past movements</span>
            </div>
          </div>
          <button className="mt-4 bg-white text-blue-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
            Upgrade to Pro - $20/month
          </button>
        </div>

        {/* Price Chart */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-8">
          <h3 className="text-xl font-bold mb-4">Portfolio Performance & ETH Price History</h3>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  stroke="#9CA3AF"
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value: number) => `$${(value / 1000000).toFixed(0)}M`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  formatter={(value: any, name: string) => [
                    name === 'currentValue' ? formatCurrency(value) : value,
                    name === 'currentValue' ? 'Portfolio Value' : name
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="currentValue" 
                  stroke="#60A5FA" 
                  strokeWidth={3}
                  dot={{ fill: '#60A5FA', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Wallet Breakdown */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-8">
          <h3 className="text-xl font-bold mb-4">Treasury Wallet Breakdown</h3>
          <div className="space-y-4">
            {Object.entries(walletBalances).map(([name, balance]) => (
              <div key={name} className="flex justify-between items-center p-4 bg-gray-700 rounded">
                <div>
                  <p className="font-semibold">{name} (Ethereum)</p>
                  <p className="text-sm text-gray-400">{WALLET_ADDRESSES[name as keyof typeof WALLET_ADDRESSES]}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatNumber(balance)} ETH</p>
                  <p className="text-sm text-gray-400">{formatCurrency(balance * ethPrice)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Historical Purchases Table */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-8">
          <h3 className="text-xl font-bold mb-4">Historical Purchase Data</h3>
          {HISTORICAL_PURCHASES.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2">Date</th>
                    <th className="text-right py-2">ETH Amount</th>
                    <th className="text-right py-2">Entry Price</th>
                    <th className="text-right py-2">USD Value</th>
                    <th className="text-right py-2">Current Value</th>
                    <th className="text-right py-2">Profit/Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {HISTORICAL_PURCHASES.map((purchase: HistoricalPurchase, index: number) => {
                    const currentValue = purchase.eth * ethPrice;
                    const profitLoss = currentValue - purchase.value;
                    return (
                      <tr key={index} className="border-b border-gray-700">
                        <td className="py-2">{purchase.date}</td>
                        <td className="text-right py-2">{formatNumber(purchase.eth)} ETH</td>
                        <td className="text-right py-2">${purchase.price}</td>
                        <td className="text-right py-2">{formatCurrency(purchase.value)}</td>
                        <td className="text-right py-2">{formatCurrency(currentValue)}</td>
                        <td className={`text-right py-2 ${profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {profitLoss >= 0 ? '+' : ''}{formatCurrency(profitLoss)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-lg mb-2">📊 Historical purchase data needed</p>
              <p className="text-sm">Add real purchase data to HISTORICAL_PURCHASES array to display chart and table</p>
              <p className="text-xs mt-2">Raw spreadsheet data was gathered by <a href="https://x.com/StoryTeller_17" className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">Martin</a> on X</p>
            </div>
          )}
        </div>

        {/* Transactions Section */}
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold">📊 Transaction History</h3>
            <div className="flex space-x-2">
              <button
                onClick={fetchAllTransactionData}
                disabled={transactionsLoading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded-lg text-white font-semibold transition-colors flex items-center space-x-2"
              >
                {transactionsLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Refresh Transactions</span>
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  console.log('Current transaction state:', {
                    transactions: transactions.length,
                    internalTransactions: internalTransactions.length,
                    transfers: transfers.length,
                    transactionsLoading
                  });
                }}
                className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg text-white font-semibold transition-colors"
              >
                Debug
              </button>
            </div>
          </div>

          {/* Transaction Tabs */}
          <div className="mb-6">
            <div className="flex space-x-1 bg-gray-700 p-1 rounded-lg">
              {[
                { id: 'transactions', label: 'Transactions', count: transactions.length },
                { id: 'internal', label: 'Internal', count: internalTransactions.length },
                { id: 'transfers', label: 'Transfers', count: transfers.length }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'transactions' | 'internal' | 'transfers')}
                  className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-600'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          {/* Transaction Content */}
          {transactionsLoading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Loading transaction data...</p>
            </div>
          ) : transactions.length === 0 && internalTransactions.length === 0 && transfers.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-lg mb-2">No Transaction Data Available</p>
                <p className="text-sm">Click "Refresh Transactions" to fetch the latest transaction history</p>
                <p className="text-xs mt-2 text-yellow-400">Make sure your Etherscan API key is valid and has sufficient quota</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Transactions Tab */}
              {activeTab === 'transactions' && (
                <div>
                  {transactions.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-700 text-gray-300">
                        <tr>
                          <th className="py-3 px-2 text-left">Hash</th>
                          <th className="py-3 px-2 text-left">Block</th>
                          <th className="py-3 px-2 text-left">Time</th>
                          <th className="py-3 px-2 text-left">From</th>
                          <th className="py-3 px-2 text-left">To</th>
                          <th className="py-3 px-2 text-right">Value</th>
                          <th className="py-3 px-2 text-right">Gas Used</th>
                          <th className="py-3 px-2 text-center">Direction</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((tx, index) => {
                          const direction = getTransactionDirection(tx, WALLET_ADDRESSES);
                          const otherAddress = getOtherAddress(tx, WALLET_ADDRESSES);
                          const directionInfo = getTransactionDirectionInfo(direction);
                          const isSacrifice = isSacrificeAddress(tx.from) || isSacrificeAddress(tx.to);
                          const isContract = isContractAddress(tx.from) || isContractAddress(tx.to);
                          const isTransfer = 'tokenName' in tx;

                          return (
                            <tr
                              key={tx.hash}
                              className="border-b border-gray-700 hover:bg-gray-700/50 cursor-pointer transition-colors"
                              onClick={() => {
                                setSelectedTransaction(tx);
                                setShowTransactionModal(true);
                              }}
                            >
                              <td className="py-3 px-2">
                                <span className="font-mono text-xs text-blue-400">{formatAddress(tx.hash)}</span>
                              </td>
                              <td className="py-3 px-2">{tx.blockNumber}</td>
                              <td className="py-3 px-2">{formatTimestamp(tx.timeStamp)}</td>
                              <td className="py-3 px-2">
                                <span className="font-mono text-xs">
                                  {isSacrifice ? getAddressLabel(tx.from) : formatAddress(tx.from)}
                                </span>
                              </td>
                              <td className="py-3 px-2">
                                <span className="font-mono text-xs">
                                  {isSacrifice ? getAddressLabel(tx.to) : formatAddress(tx.to)}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-right">
                                <span className="text-xs">
                                  {formatETHValue(tx.value)}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-right">{parseInt(tx.gasUsed).toLocaleString()}</td>
                              <td className="py-3 px-2 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${directionInfo.color}`}>
                                  {directionInfo.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <p>No transactions found. Click "Refresh Transactions" to load data.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Internal Transactions Tab */}
              {activeTab === 'internal' && (
                <div>
                  {internalTransactions.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-700 text-gray-300">
                        <tr>
                          <th className="py-3 px-2 text-left">Hash</th>
                          <th className="py-3 px-2 text-left">Block</th>
                          <th className="py-3 px-2 text-left">Time</th>
                          <th className="py-3 px-2 text-left">From</th>
                          <th className="py-3 px-2 text-left">To</th>
                          <th className="py-3 px-2 text-right">Value</th>
                          <th className="py-3 px-2 text-center">Direction</th>
                          <th className="py-3 px-2 text-center">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {internalTransactions.map((tx, index) => {
                          const direction = getTransactionDirection(tx, WALLET_ADDRESSES);
                          const otherAddress = getOtherAddress(tx, WALLET_ADDRESSES);
                          const directionInfo = getTransactionDirectionInfo(direction);
                          const isSacrifice = isSacrificeAddress(tx.from) || isSacrificeAddress(tx.to);
                          const isContract = isContractAddress(tx.from) || isContractAddress(tx.to);
                          const isTransfer = 'tokenName' in tx;

                          return (
                            <tr
                              key={tx.hash}
                              className="border-b border-gray-700 hover:bg-gray-700/50 cursor-pointer transition-colors"
                              onClick={() => {
                                setSelectedTransaction(tx);
                                setShowTransactionModal(true);
                              }}
                            >
                              <td className="py-3 px-2">
                                <span className="font-mono text-xs text-blue-400">{formatAddress(tx.hash)}</span>
                              </td>
                              <td className="py-3 px-2">{tx.blockNumber}</td>
                              <td className="py-3 px-2">{formatTimestamp(tx.timeStamp)}</td>
                              <td className="py-3 px-2">
                                <span className="font-mono text-xs">
                                  {isSacrifice ? getAddressLabel(tx.from) : formatAddress(tx.from)}
                                </span>
                              </td>
                              <td className="py-3 px-2">
                                <span className="font-mono text-xs">
                                  {isSacrifice ? getAddressLabel(tx.to) : formatAddress(tx.to)}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-right">
                                <span className="text-xs">
                                  {formatETHValue(tx.value)}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${directionInfo.color}`}>
                                  {directionInfo.label}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-center">
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-600 text-white">
                                  {tx.type}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <p>No internal transactions found. Click "Refresh Transactions" to load data.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Transfers Tab */}
              {activeTab === 'transfers' && (
                <div>
                  {transfers.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-700 text-gray-300">
                        <tr>
                          <th className="py-3 px-2 text-left">Hash</th>
                          <th className="py-3 px-2 text-left">Block</th>
                          <th className="py-3 px-2 text-left">Time</th>
                          <th className="py-3 px-2 text-left">From</th>
                          <th className="py-3 px-2 text-left">To</th>
                          <th className="py-3 px-2 text-left">Token</th>
                          <th className="py-3 px-2 text-right">Value</th>
                          <th className="py-3 px-2 text-center">Direction</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transfers.map((tx, index) => {
                          const direction = getTransactionDirection(tx, WALLET_ADDRESSES);
                          const otherAddress = getOtherAddress(tx, WALLET_ADDRESSES);
                          const directionInfo = getTransactionDirectionInfo(direction);
                          const isSacrifice = isSacrificeAddress(tx.from) || isSacrificeAddress(tx.to);
                          const isContract = isContractAddress(tx.from) || isContractAddress(tx.to);
                          const isTransfer = 'tokenName' in tx;

                          return (
                            <tr
                              key={tx.hash}
                              className="border-b border-gray-700 hover:bg-gray-700/50 cursor-pointer transition-colors"
                              onClick={() => {
                                setSelectedTransaction(tx);
                                setShowTransactionModal(true);
                              }}
                            >
                              <td className="py-3 px-2">
                                <span className="font-mono text-xs text-blue-400">{formatAddress(tx.hash)}</span>
                              </td>
                              <td className="py-3 px-2">{tx.blockNumber}</td>
                              <td className="py-3 px-2">{formatTimestamp(tx.timeStamp)}</td>
                              <td className="py-3 px-2">
                                <span className="font-mono text-xs">
                                  {isSacrifice ? getAddressLabel(tx.from) : formatAddress(tx.from)}
                                </span>
                              </td>
                              <td className="py-3 px-2">
                                <span className="font-mono text-xs">
                                  {isSacrifice ? getAddressLabel(tx.to) : formatAddress(tx.to)}
                                </span>
                              </td>
                              <td className="py-3 px-2">
                                <span className="text-xs">
                                  {tx.tokenName} ({tx.tokenSymbol})
                                </span>
                              </td>
                              <td className="py-3 px-2 text-right">
                                <span className="text-xs">
                                  {formatETHValue(tx.value)}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${directionInfo.color}`}>
                                  {directionInfo.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <p>No token transfers found. Click "Refresh Transactions" to load data.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="bg-yellow-900 border border-yellow-700 p-4 rounded-lg text-yellow-100">
          <p className="text-sm">
            <strong>Disclaimer:</strong> This website is not affiliated with Richard Heart, Pulsechain, or PulseX whatsoever. 
            We don't know whether Richard Heart actually purchased or possesses these coins. Information is based solely on public information 
            from either tweets or speculative chain analysis. The information on this website is for informational purposes only (not investment advice). 
            The data is based on estimates and probably not 100% correct.
          </p>
        </div>

        {/* Footer */}
        <footer className="text-center text-gray-400 mt-8 text-sm">
          <p>A weekend project by <a href="#" className="text-blue-400 hover:underline">your-username</a></p>
          <p>Purchase data from speculative public chain analysis. Market price from CoinGecko API with DexScreener fallback.</p>
        </footer>
      </div>

      {/* Transaction Modal */}
      {showTransactionModal && (
        <TransactionModal
          transaction={selectedTransaction}
          onClose={() => {
            setShowTransactionModal(false);
            setSelectedTransaction(null);
          }}
        />
      )}
    </div>
  );
};

export default LookIntoRHClone;