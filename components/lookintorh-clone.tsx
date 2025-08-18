"use client";

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Types for transaction data
interface Transaction {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  functionName?: string;
  isError: string;
  txreceipt_status: string;
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

interface TokenTransfer {
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
  input: string;
  confirmations: string;
}

const RICHARD_HEART_ADDRESS = "0x075e72a5edf65f0a5f44699c7654c1a76941ddc8";
const ETHERSCAN_API_KEY = "5NIDMGWB2UYP7S88YWVR65JMB5ZVPD5W9U";

// Note: Direct API calls (no CORS proxies)

const LookIntoRHClone = () => {
  const [loading, setLoading] = useState(true);
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [plsPrice, setPlsPrice] = useState<number>(0.0001);
  const [walletBalance, setWalletBalance] = useState<string>('0');
  const [portfolioValue, setPortfolioValue] = useState<number>(0);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [internalTransactions, setInternalTransactions] = useState<InternalTransaction[]>([]);
  const [tokenTransfers, setTokenTransfers] = useState<TokenTransfer[]>([]);
  
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | InternalTransaction | TokenTransfer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [internalsLoading, setInternalsLoading] = useState(false);
  const [transfersLoading, setTransfersLoading] = useState(false);

  // Search functionality
  const [searchAddress, setSearchAddress] = useState<string>(RICHARD_HEART_ADDRESS);
  const [currentAddress, setCurrentAddress] = useState<string>(RICHARD_HEART_ADDRESS);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string>('');
  
  // Token logos and metadata
  const [tokenLogos, setTokenLogos] = useState<{[key: string]: string}>({});
  const [tokenMetadata, setTokenMetadata] = useState<{[key: string]: any}>({});
  
  // Multi-chain token balances
  const [ethereumTokens, setEthereumTokens] = useState<any[]>([]);
  const [pulsechainTokens, setPulsechainTokens] = useState<any[]>([]);
  const [ethereumTotalValue, setEthereumTotalValue] = useState<number>(0);
  const [pulsechainTotalValue, setPulsechainTotalValue] = useState<number>(0);
  const [nativeEthBalance, setNativeEthBalance] = useState<string>('0');
  const [nativePlsBalance, setNativePlsBalance] = useState<number>(0);
  
  // Portfolio expansion state
  const [expandedChain, setExpandedChain] = useState<string | null>(null);
  
  // Treasury tab state and config
  const TREASURY_ADDRESSES: string[] = [
    '0xB17c443c89B0c18e53B6E25aE55297e122B30E5c',
    '0xbFc9C5878245fb9FE49c688a9c554cBA1FAE71fA',
    '0x20fCB7b4E103EC482645E15715c8a2E7a437FBD6',
    '0xB628441794Cd41484BE092B3b5f4b2f7271eb60',
    '0x7bE74346Dc745EA110358810924C9088BC76Db59',
    '0x1a73652bFAdc26C632aE21F52AacbCBdb396d659',
    '0xc0658166531c5618e605566eaa97697047fCF559',
    '0xB727d70c04520FA68aE5802859487317496b4F99',
    '0x04652660148bfA25F660A1a78a3401821f5B541e',
    '0xa99682f323379F788Bc4F004CF0a135ff1e22bD7',
    '0x7C90b72Da9344980bF31B20c4b4ab31f026bC54e',
    '0xe6F9aA98e85c703B37e8d9AfEaf2f464750E063',
    '0x63f97aD9fA0d4e8ca5Bb2F21334366806f802547',
    '0xc83DEeAD548E132Cd1a0464D02e2DE128BA75f9b',
    '0xb928a97E5Ecd27C668cc370939C8f62f93DE54fa',
    '0x33cF90c54b777018CB5d7f7f6f30e73235a61c78',
    '0xF8086ee4A78Ab88640EAFB107aE7BC9Ac64C35EC',
    '0x4BB20207BAA8688904F0C35147F19B61ddc16FD0',
    '0xc2301960fFEA687f169E803826f457Bc0263E39c',
    '0xb8691E71F40aB9A6abbdeCe20fABC8C7521Cd43',
    '0xaB203F75546C0f2905D71351f0436eFEFA440daC',
    '0x1B7BAa734C00298b9429b518D621753Bb0fefF2',
    '0xc3B7f26d6C64024D5269DB60cEFCC3807ef31C1f',
    '0x13c808Af0281c18a89e8438317c66Db9645E8662',
    '0x9320249FD87CD011Acf1E3b269180B74cDD3519E',
    '0x0083d744c0949AD9091f236f332F7b17e69c03ee',
    '0x0e8Eb2232Fc3fB0c10756cD65D7052987D6316f4',
    '0xFE19b054F7B0cb7F4c051372AB2bD799472583CC',
    '0x293bf003350f068698036d63eEec322B7F437eEE'
  ];
  
  interface TreasuryEntry {
    balanceEth?: number;
    transactions?: Transaction[];
    internals?: InternalTransaction[];
    history?: { date: string; balanceEth: number }[];
    loadingDetails?: boolean;
    errorDetails?: string;
  }
  
  const [treasuryData, setTreasuryData] = useState<Record<string, TreasuryEntry>>({});
  const [treasuryBalancesLoaded, setTreasuryBalancesLoaded] = useState<boolean>(false);
  const [treasuryGlobalLoading, setTreasuryGlobalLoading] = useState<boolean>(false);
  const [tabsValue, setTabsValue] = useState<string>('treasury');

  // Simple fetch helper
  const fetchJson = async (url: string): Promise<any> => {
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };

  // Fetch ETH price with multiple fallbacks
  const fetchETHPrice = async (): Promise<number> => {
    try {
      // Try CoinGecko first (direct, may work without proxy)
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      if (response.ok) {
        const data = await response.json();
        return data.ethereum?.usd || 0;
      }
    } catch (error) {
      console.log('CoinGecko direct failed, trying DexScreener fallback...');
    }

    try {
      // Fallback to DexScreener for ETH price
      const dexUrl = 'https://api.dexscreener.com/latest/dex/tokens/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
      const dexResponse = await fetch(dexUrl);
      if (dexResponse.ok) {
        const dexData = await dexResponse.json();
        if (dexData.pairs && dexData.pairs.length > 0) {
          const validPair = dexData.pairs.find((pair: any) => 
            pair.priceUsd && 
            parseFloat(pair.priceUsd) > 1000 && 
            parseFloat(pair.priceUsd) < 10000 &&
            pair.liquidity?.usd && 
            parseFloat(pair.liquidity.usd) > 1000000
          );
          if (validPair) {
            return parseFloat(validPair.priceUsd);
          }
        }
      }
    } catch (error) {
      console.error('DexScreener fallback failed:', error);
    }

    console.warn('All ETH price sources failed, using default price of $3000');
    return 3000;
  };

  // Fetch PLS price with multiple fallbacks
  const fetchPLSPrice = async (): Promise<number> => {
    try {
      // Try CoinGecko first
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=pulsechain&vs_currencies=usd');
      if (response.ok) {
        const data = await response.json();
        return data.pulsechain?.usd || 0.0001;
      }
    } catch (error) {
      console.log('CoinGecko PLS failed, trying DexScreener fallback...');
    }

    try {
      // Fallback to DexScreener for PLS price
      const dexUrl = 'https://api.dexscreener.com/latest/dex/tokens/0x95b303987a60c715de9aa6a0c3bf3b8b3c0b3b3b'; // PLSX token
      const dexResponse = await fetch(dexUrl);
      if (dexResponse.ok) {
        const dexData = await dexResponse.json();
        if (dexData.pairs && dexData.pairs.length > 0) {
          const validPair = dexData.pairs.find((pair: any) => 
            pair.priceUsd && 
            parseFloat(pair.priceUsd) > 0.00001 && 
            parseFloat(pair.priceUsd) < 1 &&
            pair.liquidity?.usd && 
            parseFloat(pair.liquidity.usd) > 10000
          );
          if (validPair) {
            // Estimate PLS price from PLSX (rough approximation)
            return parseFloat(validPair.priceUsd) * 0.1; // Rough estimate
          }
        }
      }
    } catch (error) {
      console.error('DexScreener PLS fallback failed:', error);
    }

    console.warn('All PLS price sources failed, using default price of $0.0001');
    return 0.0001;
  };

  // Fetch wallet balance
  const fetchWalletBalance = async (address: string): Promise<string> => {
    try {
      const url = `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
      const data = await fetchJson(url);
      return data.result || '0';
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      return '0';
    }
  };

  // Fetch multiple ETH balances (up to 20 addresses per call) using Etherscan v2 API
  const fetchMultiWalletBalances = async (addresses: string[]): Promise<Record<string, number>> => {
    const chunkSize = 20;
    const chunks: string[][] = [];
    for (let i = 0; i < addresses.length; i += chunkSize) {
      chunks.push(addresses.slice(i, i + chunkSize));
    }
    const results: Record<string, number> = {};
    for (const chunk of chunks) {
      const addressParam = chunk.join(',');
      const url = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=balancemulti&address=${addressParam}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;
      try {
        const data = await fetchJson(url);
        if (data && data.status === '1' && Array.isArray(data.result)) {
          for (const item of data.result) {
            const acct: string = (item.account || item.address || '').toLowerCase();
            const wei: string = item.balance || '0';
            const eth = parseFloat(wei) / Math.pow(10, 18);
            results[acct] = eth;
          }
        }
      } catch (e) {
        console.error('Error fetching multi balances chunk:', e);
      }
    }
    return results;
  };

  // Fetch regular transactions
  const fetchTransactions = async (address: string): Promise<Transaction[]> => {
    setTransactionsLoading(true);
    try {
      const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1000&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
      const data = await fetchJson(url);
      const result = data.result;
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return [];
    } finally {
      setTransactionsLoading(false);
    }
  };

  // Fetch internal transactions
  const fetchInternalTransactions = async (address: string): Promise<InternalTransaction[]> => {
    setInternalsLoading(true);
    try {
      const url = `https://api.etherscan.io/api?module=account&action=txlistinternal&address=${address}&startblock=0&endblock=99999999&page=1&offset=1000&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
      const data = await fetchJson(url);
      const result = data.result;
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error fetching internal transactions:', error);
      return [];
    } finally {
      setInternalsLoading(false);
    }
  };

  // Fetch token transfers
  const fetchTokenTransfers = async (address: string): Promise<TokenTransfer[]> => {
    setTransfersLoading(true);
    try {
      const url = `https://api.etherscan.io/api?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&page=1&offset=1000&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
      const data = await fetchJson(url);
      const result = data.result;
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Error fetching token transfers:', error);
      return [];
    } finally {
      setTransfersLoading(false);
    }
  };

      // Fetch all tokens from Blockscout and categorize them
  const fetchAllTokensAndCategorize = async (address: string): Promise<{ethereum: any[], pulsechain: any[]}> => {
    try {
      const url = `https://eth.blockscout.com/api/v2/addresses/${address}/token-balances`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          // Enhance tokens with prices
          const tokensWithPrices = await Promise.all(
            data.map(async (token) => {
              if (token.token?.address_hash) {
                const price = await fetchTokenPrice(token.token.address_hash);
                return {
                  ...token,
                  token: {
                    ...token.token,
                    exchange_rate: price.toString()
                  }
                };
              }
              return token;
            })
          );

          // Categorize tokens
          return categorizeTokens(tokensWithPrices);
        }
      }
      return { ethereum: [], pulsechain: [] };
    } catch (error) {
      console.error('Error fetching tokens:', error);
      return { ethereum: [], pulsechain: [] };
    }
  };

  // Fetch Ethereum token balances (now just returns the ethereum portion)
  const fetchEthereumTokenBalances = async (address: string): Promise<any[]> => {
    const { ethereum } = await fetchAllTokensAndCategorize(address);
    return ethereum;
  };

  // Categorize tokens into Ethereum vs PulseChain
  const categorizeTokens = (tokens: any[]): {ethereum: any[], pulsechain: any[]} => {
    // Known Ethereum token addresses (major tokens)
    const ETHEREUM_TOKENS = new Set([
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
      '0xA0b86a33E6411dD3CEc56bBF4f8c7e59D8b4b12F', // DAI
      '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', // SHIB
      '0x514910771AF9Ca656af840dff83E8264EcF986CA', // LINK
      '0x4Fabb145d64652a948d72533023f6E7A623C7C53', // BUSD
      '0x0000000000085d4780B73119b644AE5ecd22b376', // TUSD
      '0xC581b735A1688071A1746c968e0798D642EDE491', // EURT
      '0xB98d4C97425d9908E66E53A6fDf673ACcA0BE986', // ABT
      '0xAf30D2a7E90d7DC361c8C4585e9BB7D2F6f15bc7', // 1ST
      '0xe304283C3e60Cefaf7eA514007Cf4E8fdC3d869d', // GEC
      '0xcf0C122c6b73ff809C693DB761e7BaeBe62b6a2E', // FLOKI
      '0x626E8036dEB333b408Be468F951bdB42433cBF18', // AIOZ
    ]);

    // Known PulseChain token patterns
    const PULSECHAIN_TOKENS = new Set([
      '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', // HEX (originally Ethereum, but major on PulseChain)
      '0x95b303987a60c715de9aa6a0c3bf3b8b3c0b3b3b', // PLSX
    ]);

    const ethereum: any[] = [];
    const pulsechain: any[] = [];

    tokens.forEach(token => {
      const address = token.token?.address_hash?.toLowerCase();
      const symbol = token.token?.symbol?.toLowerCase();
      
      // Categorize based on address
      if (ETHEREUM_TOKENS.has(address)) {
        ethereum.push(token);
      } else if (PULSECHAIN_TOKENS.has(address)) {
        pulsechain.push(token);
      }
      // Categorize based on symbol patterns
      else if (symbol?.includes('hex') || symbol?.includes('pls') || symbol?.includes('pulse')) {
        pulsechain.push(token);
      }
      // NFTs and unknown tokens go to PulseChain by default
      else if (token.token?.type === 'ERC-1155' || token.token?.type === 'ERC-721') {
        pulsechain.push(token);
      }
      // Default: major ERC-20s go to Ethereum, others to PulseChain
      else if (token.token?.type === 'ERC-20' && parseFloat(token.token?.exchange_rate || '0') > 0.01) {
        ethereum.push(token);
      } else {
        pulsechain.push(token);
      }
    });

    console.log(`Categorized: ${ethereum.length} Ethereum tokens, ${pulsechain.length} PulseChain tokens`);
    return { ethereum, pulsechain };
  };



  // Fetch token metadata and price from Blockscout
  const fetchTokenMetadata = async (tokenAddress: string): Promise<any> => {
    try {
      const url = `https://eth.blockscout.com/api/v2/tokens/${tokenAddress}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return {
          symbol: data.symbol || tokenAddress.slice(0, 6),
          name: data.name || 'Unknown Token',
          decimals: data.decimals || "18",
          exchange_rate: data.exchange_rate ? parseFloat(data.exchange_rate) : 0,
          icon_url: data.icon_url || null
        };
      }
      return {
        symbol: tokenAddress.slice(0, 6),
        name: 'Unknown Token',
        decimals: "18",
        exchange_rate: 0,
        icon_url: null
      };
    } catch (error) {
      console.error(`Error fetching token metadata for ${tokenAddress}:`, error);
      return {
        symbol: tokenAddress.slice(0, 6),
        name: 'Unknown Token',
        decimals: "18",
        exchange_rate: 0,
        icon_url: null
      };
    }
  };

  // Fetch individual token price from Blockscout (legacy function)
  const fetchTokenPrice = async (tokenAddress: string): Promise<number> => {
    const metadata = await fetchTokenMetadata(tokenAddress);
    return metadata.exchange_rate;
  };

    // Fetch PulseChain token balances (now just returns the pulsechain portion)
  const fetchPulseChainTokenBalances = async (address: string): Promise<any[]> => {
    const { pulsechain } = await fetchAllTokensAndCategorize(address);
    return pulsechain;
  };

  // Fetch PulseChain native balance from v2 API
  const fetchPulseChainNativeBalance = async (address: string): Promise<number> => {
    try {
      const url = `https://eth.blockscout.com/api/v2/addresses/${address}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data && data.coin_balance) {
          const balance = parseFloat(data.coin_balance) / Math.pow(10, 18); // PLS has 18 decimals
          return balance;
        }
      }
      return 0;
    } catch (error) {
      console.error('Error fetching PulseChain native balance:', error);
      return 0;
    }
  };

  // Calculate total USD value for Ethereum chain
  const calculateEthereumTotalValue = (tokens: any[], nativeBalance: string, ethPrice: number): number => {
    let total = 0;
    
    // Add native ETH value
    const nativeValue = parseFloat(nativeBalance) / Math.pow(10, 18) * ethPrice;
    total += nativeValue;
    
    // Add ERC-20 token values (these are Ethereum tokens)
    tokens.forEach(token => {
      if (token.token?.exchange_rate && token.value) {
        const tokenValue = parseFloat(token.value) / Math.pow(10, parseInt(token.token.decimals || '18')) * parseFloat(token.token.exchange_rate);
        total += tokenValue;
      }
    });
    
    return total;
  };

  // Calculate total USD value for PulseChain
  const calculatePulseChainTotalValue = (tokens: any[], nativePlsBalance: number, plsPrice: number): number => {
    let total = 0;
    
    // Add native PLS value
    const nativeValue = nativePlsBalance * plsPrice;
    total += nativeValue;
    
    // Add PLS token values (these are PulseChain tokens)
    tokens.forEach(token => {
      if (token.token?.exchange_rate && token.value) {
        const tokenValue = parseFloat(token.value) / Math.pow(10, parseInt(token.token.decimals || '18')) * parseFloat(token.token.exchange_rate);
        total += tokenValue;
      }
    });
    
    return total;
  };

  // Fetch token logos and metadata from multiple sources
  const fetchTokenLogos = async () => {
    const logos: {[key: string]: string} = {};
    const metadata: {[key: string]: any} = {};

    try {
      // Try DexScreener for major tokens
      const dexScreenerTokens = [
        { symbol: 'ETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' }, // WETH
        { symbol: 'HEX', address: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39' },
        { symbol: 'PLSX', address: '0x95b303987a60c715de9aa6a0c3bf3b8b3c0b3b3b' } // PulseX
      ];

      for (const token of dexScreenerTokens) {
        try {
          const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.address}`);
          if (response.ok) {
      const data = await response.json();
            if (data.pairs && data.pairs.length > 0) {
              const pair = data.pairs[0];
              if (pair.pairAddress) {
                logos[token.symbol] = `https://raw.githubusercontent.com/uniswap/assets/master/blockchains/ethereum/assets/${token.address.toLowerCase()}/logo.png`;
                metadata[token.symbol] = {
                  name: pair.baseToken?.name || token.symbol,
                  symbol: pair.baseToken?.symbol || token.symbol,
                  price: pair.priceUsd,
                  liquidity: pair.liquidity?.usd
                };
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch ${token.symbol} from DexScreener:`, error);
        }
      }

      // Fallback to CoinGecko for ETH
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/coins/ethereum');
        if (response.ok) {
          const data = await response.json();
          if (data.image?.large) {
            logos['ETH'] = data.image.large;
            metadata['ETH'] = {
              name: 'Ethereum',
              symbol: 'ETH',
              price: data.market_data?.current_price?.usd,
              marketCap: data.market_data?.market_cap?.usd
            };
          }
      }
    } catch (error) {
        console.warn('Failed to fetch ETH from CoinGecko:', error);
      }

      // Fallback to reliable CDN sources
      const fallbackLogos = {
        'ETH': 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
        'HEX': 'https://assets.coingecko.com/coins/images/10103/large/HEX-logo.png',
        'PLSX': 'https://assets.coingecko.com/coins/images/25437/large/pulsex.png'
      };

      // Use fallback logos for any missing ones
      Object.keys(fallbackLogos).forEach(symbol => {
        if (!logos[symbol]) {
          logos[symbol] = fallbackLogos[symbol as keyof typeof fallbackLogos];
        }
      });

      setTokenLogos(logos);
      setTokenMetadata(metadata);
      
    } catch (error) {
      console.error('Error fetching token logos:', error);
      
      // Set fallback logos if all else fails
      const fallbackLogos = {
        'ETH': 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
        'HEX': 'https://assets.coingecko.com/coins/images/10103/large/HEX-logo.png',
        'PLSX': 'https://assets.coingecko.com/coins/images/25437/large/pulsex.png'
      };
      setTokenLogos(fallbackLogos);
    }
  };

  // Search for wallet address
  const searchWallet = async () => {
    if (!searchAddress.trim()) {
      setSearchError('Please enter a valid address');
      return;
    }

    // Basic address validation
    if (!/^0x[a-fA-F0-9]{40}$/.test(searchAddress.trim())) {
      setSearchError('Please enter a valid Ethereum address');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    
    try {
      const address = searchAddress.trim();
      setCurrentAddress(address);
      
      // Fetch data for the new address
      const [price, plsPriceValue] = await Promise.all([
        fetchETHPrice(),
        fetchPLSPrice()
      ]);
      setEthPrice(price);
      setPlsPrice(plsPriceValue);

      const balance = await fetchWalletBalance(address);
      setWalletBalance(balance);
      
      const balanceInEth = parseFloat(balance) / Math.pow(10, 18);
      setPortfolioValue(balanceInEth * price);

      // Fetch multi-chain data
      const [txs, internalTxs, transfers, ethTokens, plsTokens, plsBalance] = await Promise.all([
        fetchTransactions(address),
        fetchInternalTransactions(address),
        fetchTokenTransfers(address),
        fetchEthereumTokenBalances(address),
        fetchPulseChainTokenBalances(address),
        fetchPulseChainNativeBalance(address)
      ]);

      setTransactions(txs);
      setInternalTransactions(internalTxs);
      setTokenTransfers(transfers);
      setEthereumTokens(ethTokens);
      setPulsechainTokens(plsTokens);
      setNativePlsBalance(plsBalance);

      // Calculate chain totals
      const ethTotal = calculateEthereumTotalValue(ethTokens, balance, price);
      const plsTotal = calculatePulseChainTotalValue(plsTokens, plsBalance, plsPriceValue);
      
      setEthereumTotalValue(ethTotal);
      setPulsechainTotalValue(plsTotal);
      
      setLoading(false);
    } catch (error) {
      console.error('Error searching wallet:', error);
      setSearchError('Failed to fetch wallet data. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Initialize data
  const initializeData = async () => {
    setLoading(true);
    try {
      // Fetch logos and data in parallel
      const [price, plsPriceValue, balance, logos] = await Promise.all([
        fetchETHPrice(),
        fetchPLSPrice(),
        fetchWalletBalance(currentAddress),
        fetchTokenLogos()
      ]);

      setEthPrice(price);
      setPlsPrice(plsPriceValue);
      setWalletBalance(balance);
      
      const balanceInEth = parseFloat(balance) / Math.pow(10, 18);
      setPortfolioValue(balanceInEth * price);

      // Fetch multi-chain data
      const [txs, internalTxs, transfers, ethTokens, plsTokens, plsBalance] = await Promise.all([
        fetchTransactions(currentAddress),
        fetchInternalTransactions(currentAddress),
        fetchTokenTransfers(currentAddress),
        fetchEthereumTokenBalances(currentAddress),
        fetchPulseChainTokenBalances(currentAddress),
        fetchPulseChainNativeBalance(currentAddress)
      ]);

      setTransactions(txs);
      setInternalTransactions(internalTxs);
      setTokenTransfers(transfers);
      setEthereumTokens(ethTokens);
      setPulsechainTokens(plsTokens);
      setNativePlsBalance(plsBalance);

      // Calculate chain totals
      const ethTotal = calculateEthereumTotalValue(ethTokens, balance, price);
      const plsTotal = calculatePulseChainTotalValue(plsTokens, plsBalance, plsPriceValue);
      
      setEthereumTotalValue(ethTotal);
      setPulsechainTotalValue(plsTotal);
    } catch (error) {
      console.error('Error initializing data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initializeData();
  }, []);

  // Auto-load Treasury balances when Treasury tab is active
  useEffect(() => {
    const loadTreasuryBalances = async () => {
      setTreasuryGlobalLoading(true);
      try {
        const balancesMap = await fetchMultiWalletBalances(TREASURY_ADDRESSES);
        setTreasuryData((prev) => {
          const updated = { ...prev } as Record<string, TreasuryEntry>;
          TREASURY_ADDRESSES.forEach((addr) => {
            const key = addr.toLowerCase();
            const eth = balancesMap[key] ?? 0;
            updated[addr] = { ...(updated[addr] || {}), balanceEth: eth };
          });
          return updated;
        });
        setTreasuryBalancesLoaded(true);
      } finally {
        setTreasuryGlobalLoading(false);
      }
    };
    if (tabsValue === 'treasury' && !treasuryBalancesLoaded) {
      loadTreasuryBalances();
    }
  }, [tabsValue, treasuryBalancesLoaded]);

  // Utility functions
  const formatETHValue = (value: string): string => {
    const eth = parseFloat(value) / Math.pow(10, 18);
    return eth.toFixed(6);
  };

  const formatTokenValue = (value: string, decimals: string): string => {
    const tokenValue = parseFloat(value) / Math.pow(10, parseInt(decimals));
    return tokenValue.toLocaleString();
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(parseInt(timestamp) * 1000).toLocaleString();
  };

  const truncateAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const isIncomingTransaction = (tx: Transaction | InternalTransaction | TokenTransfer): boolean => {
    return tx.to.toLowerCase() === currentAddress.toLowerCase();
  };

  const getTransactionDirection = (tx: Transaction | InternalTransaction | TokenTransfer): string => {
    return isIncomingTransaction(tx) ? 'IN' : 'OUT';
  };

  const openTransactionModal = (tx: Transaction | InternalTransaction | TokenTransfer) => {
    setSelectedTransaction(tx);
    setIsModalOpen(true);
  };

  const calculateDaysSinceStart = () => {
    const startDate = new Date('2019-12-02'); // HEX launch date
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <div className="text-gray-700 text-lg font-medium">Loading Portfolio...</div>
          <div className="text-gray-500 text-sm mt-1">Fetching Richard Heart's treasury data</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header - Exact DeBank Style */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center space-x-8">
              <div className="text-xl font-bold text-gray-900">
                <span className="text-purple-600">Pulse</span>RH
          </div>
              <nav className="hidden md:flex space-x-6">
                <a href="#" className="text-gray-700 hover:text-purple-600 font-medium">Portfolio</a>
                <a href="#" className="text-gray-700 hover:text-purple-600 font-medium">Treasury</a>
                <a href="#" className="text-gray-700 hover:text-purple-600 font-medium">Community</a>
                <a href="#" className="text-gray-700 hover:text-purple-600 font-medium">Protocols</a>
                <a href="#" className="text-gray-700 hover:text-purple-600 font-medium">More</a>
              </nav>
        </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-md mx-8">
              <div className="relative">
                  <input
                    type="text"
                  value={searchAddress}
                  onChange={(e) => setSearchAddress(e.target.value)}
                  placeholder="Search wallet address (0x...)"
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && searchWallet()}
                  />
                  <button
                  onClick={searchWallet}
                  disabled={isSearching}
                  className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 hover:text-purple-600 disabled:opacity-50"
                >
                  {isSearching ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                  ) : (
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                  </button>
                </div>
              {searchError && (
                <div className="text-red-500 text-xs mt-1 ml-2">{searchError}</div>
              )}
              </div>
              
            {/* Connect Wallet */}
            <Button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-medium">
              Connect Wallet
            </Button>
                </div>
        </div>
      </header>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Profile Section - Exact DeBank Layout */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-8 mb-8 border border-purple-100">
          <div className="flex items-start justify-between">
            {/* Profile Info */}
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  RH
              </div>
                <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-yellow-900 text-xs px-2 py-0.5 rounded-full font-bold">
                  VIP
            </div>
        </div>
            <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {currentAddress === RICHARD_HEART_ADDRESS ? 'Richard Heart' : 'Wallet Address'}
                  </h1>
                  {currentAddress === RICHARD_HEART_ADDRESS && (
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">VIP</Badge>
              )}
            </div>
                <p className="text-gray-600 font-mono text-sm">{truncateAddress(currentAddress)}</p>
                <p className="text-gray-500 text-sm mt-1">
                  {currentAddress === RICHARD_HEART_ADDRESS 
                    ? 'Treasury tracker for HEX, PulseChain & PulseX ecosystems'
                    : 'Ethereum wallet portfolio tracker'
                  }
                </p>
            </div>
          </div>

            {/* Portfolio Value */}
            <div className="text-right">
              <div className="text-4xl font-bold text-gray-900">${portfolioValue.toLocaleString()}</div>
              <div className="text-green-600 text-sm font-medium">+0.27% ↗</div>
          </div>
        </div>

          {/* Stats Row */}
          <div className="grid grid-cols-5 gap-6 mt-8 pt-6 border-t border-purple-200">
            <div className="text-center">
              <div className="text-gray-500 text-sm">TVF</div>
              <div className="text-lg font-bold text-gray-900">${(portfolioValue / 1000000).toFixed(1)}M</div>
              </div>
            <div className="text-center">
              <div className="text-gray-500 text-sm">Followers</div>
              <div className="text-lg font-bold text-gray-900">247K</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 text-sm">Following</div>
              <div className="text-lg font-bold text-gray-900">12</div>
          </div>
            <div className="text-center">
              <div className="text-gray-500 text-sm">Earnings</div>
              <div className="text-lg font-bold text-gray-900">${(portfolioValue * 0.1).toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 text-sm">Days Active</div>
              <div className="text-lg font-bold text-gray-900">{calculateDaysSinceStart()}</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-4 mt-6">
            {currentAddress === RICHARD_HEART_ADDRESS ? (
              <>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg">
                  Follow
                </Button>
                <Button variant="outline" className="border-purple-300 text-purple-600 hover:bg-purple-50 px-6 py-2 rounded-lg">
                  Say Hi
                </Button>
                <Button className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-2 rounded-lg">
                  AskPro
                </Button>
              </>
            ) : (
              <>
                <Button 
                  onClick={() => {
                    setSearchAddress(RICHARD_HEART_ADDRESS);
                    setCurrentAddress(RICHARD_HEART_ADDRESS);
                    initializeData();
                  }}
                  className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-lg"
                >
                  Back to Richard Heart
                </Button>
                <Button 
                  onClick={() => window.open(`https://etherscan.io/address/${currentAddress}`, '_blank')}
                  variant="outline" 
                  className="border-blue-300 text-blue-600 hover:bg-blue-50 px-6 py-2 rounded-lg"
                >
                  View on Etherscan
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Navigation Tabs - Exact DeBank Style */}
        <Tabs defaultValue={tabsValue} onValueChange={setTabsValue} className="w-full">
          <TabsList className="bg-white border border-gray-200 rounded-lg p-1 mb-8 h-12">
            <TabsTrigger value="portfolio" className="data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700 px-6 py-2 rounded-md font-medium">
              Portfolio
            </TabsTrigger>
            <TabsTrigger value="treasury" className="data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700 px-6 py-2 rounded-md font-medium">
              Treasury
            </TabsTrigger>
            <TabsTrigger value="transactions" className="data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700 px-6 py-2 rounded-md font-medium">
              Transactions
            </TabsTrigger>
            <TabsTrigger value="internals" className="data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700 px-6 py-2 rounded-md font-medium">
              Internal
            </TabsTrigger>
            <TabsTrigger value="transfers" className="data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700 px-6 py-2 rounded-md font-medium">
              Transfers
            </TabsTrigger>
            <TabsTrigger value="nfts" className="data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700 px-6 py-2 rounded-md font-medium">
              NFTs
            </TabsTrigger>
          </TabsList>

          {/* Portfolio Tab - DeBank Grid Style */}
          <TabsContent value="portfolio">
            <div className="space-y-6">
              {/* Chain Assets Grid - Original Layout */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Ethereum Card */}
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedChain('ethereum')}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                      Ξ
            </div>
            <div>
                      <div className="font-semibold text-gray-900">Ethereum</div>
                      <div className="text-2xl font-bold text-gray-900">${ethereumTotalValue.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">{ethereumTokens.length} tokens</div>
            </div>
          </div>
          </div>

                {/* PulseChain Card */}
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedChain('pulsechain')}
                >
                  <div className="flex items-center space-x-3">
                    <img 
                      src="/LogoVector.svg" 
                      alt="PulseChain" 
                      className="w-10 h-10"
                    />
              <div>
                      <div className="font-semibold text-gray-900">PulseChain</div>
                      <div className="text-2xl font-bold text-gray-900">${pulsechainTotalValue.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">{pulsechainTokens.length} tokens</div>
              </div>
          </div>
        </div>

                {/* Empty Cards for Layout */}
                <div className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 text-sm font-bold">
                      +
                    </div>
              <div>
                      <div className="font-semibold text-gray-900">Coming Soon</div>
                      <div className="text-2xl font-bold text-gray-900">$0</div>
                      <div className="text-sm text-gray-500">0 tokens</div>
              </div>
            </div>
          </div>

                <div className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 text-sm font-bold">
                      +
                    </div>
              <div>
                      <div className="font-semibold text-gray-900">Coming Soon</div>
                      <div className="text-2xl font-bold text-gray-900">$0</div>
                      <div className="text-sm text-gray-500">0 tokens</div>
              </div>
            </div>
          </div>

                <div className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 text-sm font-bold">
                      +
            </div>
              <div>
                      <div className="font-semibold text-gray-900">Coming Soon</div>
                      <div className="text-2xl font-bold text-gray-900">$0</div>
                      <div className="text-sm text-gray-500">0 tokens</div>
              </div>
            </div>
            </div>
          </div>

                            {/* Wallet Breakdown - Dynamic Based on Selected Chain */}
              <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                      <span className="w-6 h-6 bg-pink-100 rounded mr-2 flex items-center justify-center">💼</span>
                      {expandedChain === 'ethereum' ? 'Ethereum Wallet' : 
                       expandedChain === 'pulsechain' ? 'PulseChain Wallet' : 'Wallet'}
                    </h3>
                    <div className="text-lg font-bold text-gray-900">
                      {expandedChain === 'ethereum' ? `$${ethereumTotalValue.toLocaleString()}` :
                       expandedChain === 'pulsechain' ? `$${pulsechainTotalValue.toLocaleString()}` :
                       `$${(ethereumTotalValue + pulsechainTotalValue).toLocaleString()}`}
              </div>
            </div>
          </div>
                
                <div className="max-h-96 overflow-y-auto overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">USD Value</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {/* Ethereum Tokens */}
                      {expandedChain === 'ethereum' && (
                        <>
                          {/* Native ETH Row */}
                          <tr className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs mr-3">
                                  Ξ
        </div>
                                <span className="text-sm font-medium text-gray-900">ETH</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${Math.round(ethPrice).toLocaleString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatETHValue(walletBalance)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">${(parseFloat(walletBalance) / Math.pow(10, 18) * ethPrice).toLocaleString()}</td>
                          </tr>
                          
                          {/* High Value ERC-20 Tokens ($50+) */}
                          {ethereumTokens
                            .filter(token => {
                              if (!token.token?.exchange_rate) return false;
                              const value = parseFloat(token.value) / Math.pow(10, parseInt(token.token?.decimals || '18'));
                              const usdValue = value * parseFloat(token.token.exchange_rate);
                              return usdValue >= 50;
                            })
                            .map((token, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    {token.token?.icon_url ? (
                                      <img 
                                        src={token.token.icon_url} 
                                        alt={token.token.symbol} 
                                        className="w-6 h-6 rounded-full mr-3"
                                      />
                                    ) : (
                                      <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-xs font-bold mr-3">
                                        {token.token?.symbol?.charAt(0) || '?'}
            </div>
                                    )}
                                    <span className="text-sm font-medium text-gray-900">{token.token?.symbol || 'Unknown'}</span>
            </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {token.token?.exchange_rate ? `$${parseFloat(token.token.exchange_rate).toFixed(6)}` : 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {(parseFloat(token.value) / Math.pow(10, parseInt(token.token?.decimals || '18'))).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                                  {token.token?.exchange_rate ? 
                                    `$${(parseFloat(token.value) / Math.pow(10, parseInt(token.token?.decimals || '18')) * parseFloat(token.token.exchange_rate)).toFixed(2)}` : 
                                    'N/A'}
                                </td>
                              </tr>
                            ))}

                          {/* Low Value Tokens Accordion ($50-) */}
                          {(() => {
                            const lowValueTokens = ethereumTokens.filter(token => {
                              if (!token.token?.exchange_rate) return false;
                              const value = parseFloat(token.value) / Math.pow(10, parseInt(token.token?.decimals || '18'));
                              const usdValue = value * parseFloat(token.token.exchange_rate);
                              return usdValue < 50;
                            });

                            if (lowValueTokens.length > 0) {
                              return (
                                <tr>
                                  <td colSpan={4} className="px-6 py-4">
                                    <details className="group">
                                      <summary className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-3 rounded-lg">
                                        <div className="flex items-center space-x-3">
                                          <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-xs font-bold">
                                            💎
            </div>
                                          <span className="text-sm font-medium text-gray-700">
                                            Low Value Tokens ({lowValueTokens.length})
                                          </span>
            </div>
                                        <div className="text-sm text-gray-500 group-open:rotate-180 transition-transform">
                                          ▼
            </div>
                                      </summary>
                                      <div className="mt-3 space-y-2">
                                        {lowValueTokens.map((token, index) => (
                                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center space-x-3">
                                              {token.token?.icon_url ? (
                                                <img 
                                                  src={token.token.icon_url} 
                                                  alt={token.token.symbol} 
                                                  className="w-5 h-5 rounded-full"
                                                />
                                              ) : (
                                                <div className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center text-xs font-bold">
                                                  {token.token?.symbol?.charAt(0) || '?'}
            </div>
                                              )}
                                              <span className="text-sm font-medium text-gray-700">{token.token?.symbol || 'Unknown'}</span>
            </div>
                                            <div className="text-right">
                                              <div className="text-sm text-gray-600">
                                                {(parseFloat(token.value) / Math.pow(10, parseInt(token.token?.decimals || '18'))).toLocaleString()}
            </div>
                                              {token.token?.exchange_rate && (
                                                <div className="text-xs text-gray-500">
                                                  ${(parseFloat(token.value) / Math.pow(10, parseInt(token.token?.decimals || '18')) * parseFloat(token.token.exchange_rate)).toFixed(2)}
          </div>
                                              )}
        </div>
                                          </div>
                                        ))}
                                      </div>
                                    </details>
                                  </td>
                                </tr>
                              );
                            }
                            return null;
                          })()}
                        </>
                      )}

                      {/* PulseChain Tokens */}
                      {expandedChain === 'pulsechain' && (
                        <>
                          {/* Native PLS Row */}
                          <tr className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <img 
                                  src="/LogoVector.svg" 
                                  alt="PulseChain" 
                                  className="w-6 h-6 mr-3"
                                />
                                <span className="text-sm font-medium text-gray-900">PLS</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${plsPrice.toFixed(6)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{nativePlsBalance.toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">${(nativePlsBalance * plsPrice).toFixed(2)}</td>
                          </tr>
                          
                          {/* High Value PLS Tokens ($50+) */}
                          {pulsechainTokens
                            .filter(token => {
                              if (!token.token?.exchange_rate) return false;
                              const value = parseFloat(token.value) / Math.pow(10, parseInt(token.token?.decimals || '18'));
                              const usdValue = value * parseFloat(token.token.exchange_rate);
                              return usdValue >= 50;
                            })
                            .map((token, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    {token.token?.icon_url ? (
                                      <img 
                                        src={token.token.icon_url} 
                                        alt={token.token.symbol} 
                                        className="w-6 h-6 rounded-full mr-3"
                                      />
                                    ) : (
                                      <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-xs font-bold mr-3">
                                        {token.token?.symbol?.charAt(0) || '?'}
          </div>
                                    )}
                                    <span className="text-sm font-medium text-gray-900">{token.token?.symbol || 'Unknown'}</span>
        </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {token.token?.exchange_rate ? `$${parseFloat(token.token.exchange_rate).toFixed(6)}` : 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {(parseFloat(token.value) / Math.pow(10, parseInt(token.token?.decimals || '18'))).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                                  {token.token?.exchange_rate ? 
                                    `$${(parseFloat(token.value) / Math.pow(10, parseInt(token.token?.decimals || '18')) * parseFloat(token.token.exchange_rate)).toFixed(2)}` : 
                                    'N/A'}
                                </td>
                              </tr>
                            ))}

                          {/* Low Value PLS Tokens Accordion ($50-) */}
                          {(() => {
                            const lowValueTokens = pulsechainTokens.filter(token => {
                              if (!token.token?.exchange_rate) return false;
                              const value = parseFloat(token.value) / Math.pow(10, parseInt(token.token?.decimals || '18'));
                              const usdValue = value * parseFloat(token.token.exchange_rate);
                              return usdValue < 50;
                            });

                            if (lowValueTokens.length > 0) {
                              return (
                                <tr>
                                  <td colSpan={4} className="px-6 py-4">
                                    <details className="group">
                                      <summary className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-3 rounded-lg">
                                        <div className="flex items-center space-x-3">
                                          <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-xs font-bold">
                                            💎
                                          </div>
                                          <span className="text-sm font-medium text-gray-700">
                                            Low Value Tokens ({lowValueTokens.length})
                                          </span>
                                        </div>
                                        <div className="text-sm text-gray-500 group-open:rotate-180 transition-transform">
                                          ▼
                                        </div>
                                      </summary>
                                      <div className="mt-3 space-y-2">
                                        {lowValueTokens.map((token, index) => (
                                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center space-x-3">
                                              {token.token?.icon_url ? (
                                                <img 
                                                  src={token.token.icon_url} 
                                                  alt={token.token.symbol} 
                                                  className="w-5 h-5 rounded-full"
                                                />
                                              ) : (
                                                <div className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center text-xs font-bold">
                                                  {token.token?.symbol?.charAt(0) || '?'}
                                                </div>
                                              )}
                                              <span className="text-sm font-medium text-gray-700">{token.token?.symbol || 'Unknown'}</span>
                </div>
                <div className="text-right">
                                              <div className="text-sm text-gray-600">
                                                {(parseFloat(token.value) / Math.pow(10, parseInt(token.token?.decimals || '18'))).toLocaleString()}
                                              </div>
                                              {token.token?.exchange_rate && (
                                                <div className="text-xs text-gray-500">
                                                  ${(parseFloat(token.value) / Math.pow(10, parseInt(token.token?.decimals || '18')) * parseFloat(token.token.exchange_rate)).toFixed(2)}
                                                </div>
                                              )}
                </div>
              </div>
            ))}
          </div>
                                    </details>
                                  </td>
                                </tr>
                              );
                            }
                            return null;
                          })()}
                        </>
                      )}

                      {/* Default View - Combined Portfolio */}
                      {!expandedChain && (
                        <tr className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs mr-3">
                                Ξ
        </div>
                              <span className="text-sm font-medium text-gray-900">ETH</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${Math.round(ethPrice).toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatETHValue(walletBalance)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">${(parseFloat(walletBalance) / Math.pow(10, 18) * ethPrice).toLocaleString()}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <span className="w-6 h-6 bg-blue-100 rounded mr-2 flex items-center justify-center">💰</span>
                  Transactions ({transactions.length})
                  {transactionsLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 ml-2"></div>}
                </h3>
              </div>
              
            <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Direction</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hash</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From/To</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value (ETH)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Array.isArray(transactions) && transactions.slice(0, 50).map((tx, index) => (
                      <tr 
                        key={index} 
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => openTransactionModal(tx)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={`${getTransactionDirection(tx) === 'IN' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {getTransactionDirection(tx)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-blue-600">{truncateAddress(tx.hash)}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-600">
                          {isIncomingTransaction(tx) ? truncateAddress(tx.from) : truncateAddress(tx.to)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">{formatETHValue(tx.value)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-sm">{formatTimestamp(tx.timeStamp)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={tx.txreceipt_status === '1' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {tx.txreceipt_status === '1' ? 'Success' : 'Failed'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            </Card>
          </TabsContent>

          {/* Internal Transactions Tab */}
          <TabsContent value="internals">
            <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <span className="w-6 h-6 bg-green-100 rounded mr-2 flex items-center justify-center">🔄</span>
                  Internal Transactions ({internalTransactions.length})
                  {internalsLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500 ml-2"></div>}
                </h3>
        </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Direction</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hash</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From/To</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value (ETH)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  </tr>
                </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Array.isArray(internalTransactions) && internalTransactions.slice(0, 50).map((tx, index) => (
                      <tr 
                        key={index} 
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => openTransactionModal(tx)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={`${getTransactionDirection(tx) === 'IN' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {getTransactionDirection(tx)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-blue-600">{truncateAddress(tx.hash)}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-600">
                          {isIncomingTransaction(tx) ? truncateAddress(tx.from) : truncateAddress(tx.to)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">{formatETHValue(tx.value)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-sm">{formatTimestamp(tx.timeStamp)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className="bg-yellow-100 text-yellow-800">{tx.type || 'call'}</Badge>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            </Card>
          </TabsContent>

          {/* Token Transfers Tab */}
          <TabsContent value="transfers">
            <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <span className="w-6 h-6 bg-purple-100 rounded mr-2 flex items-center justify-center">🪙</span>
                  Token Transfers ({tokenTransfers.length})
                  {transfersLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500 ml-2"></div>}
                </h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Direction</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hash</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From/To</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Array.isArray(tokenTransfers) && tokenTransfers.slice(0, 50).map((tx, index) => (
                      <tr 
                        key={index} 
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => openTransactionModal(tx)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={`${getTransactionDirection(tx) === 'IN' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {getTransactionDirection(tx)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-blue-600">{truncateAddress(tx.hash)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className="bg-blue-100 text-blue-800">{tx.tokenSymbol}</Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-600">
                          {isIncomingTransaction(tx) ? truncateAddress(tx.from) : truncateAddress(tx.to)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">{formatTokenValue(tx.value, tx.tokenDecimal)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-sm">{formatTimestamp(tx.timeStamp)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            </Card>
          </TabsContent>

          {/* NFTs Tab */}
          <TabsContent value="nfts">
            <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <span className="w-6 h-6 bg-indigo-100 rounded mr-2 flex items-center justify-center">🖼️</span>
                  NFT Collection
                </h3>
              </div>
              <div className="p-12 text-center">
                <div className="text-gray-400 text-lg mb-2">🎨 NFT Collection Coming Soon</div>
                <div className="text-gray-500 text-sm">Richard Heart's NFT portfolio and collectibles</div>
              </div>
            </Card>
          </TabsContent>

          {/* Treasury Tab */}
          <TabsContent value="treasury">
            <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <span className="w-6 h-6 bg-yellow-100 rounded mr-2 flex items-center justify-center">🏦</span>
                    PulseChain Sacrifice Treasury (ETH)
                  </h3>
                </div>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {TREASURY_ADDRESSES.map((addr) => {
                    const entry = treasuryData[addr] || {};
                    const balanceEth = entry.balanceEth ?? 0;
                    const balanceUsd = balanceEth * ethPrice;
                    const hasDetails = !!entry.transactions || !!entry.internals;
                    return (
                      <div key={addr} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs text-gray-500">Address</div>
                              <div className="font-mono text-sm text-blue-600">{truncateAddress(addr)}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-500">Balance</div>
                              <div className="text-sm font-semibold text-gray-900">{balanceEth.toFixed(4)} ETH</div>
                              <div className="text-xs text-gray-500">${balanceUsd.toLocaleString()}</div>
                            </div>
                          </div>
                        </div>
                        <div className="p-4 space-y-3">
                          {/* Balance history (approx) */}
                          {entry.history && entry.history.length > 0 ? (
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Balance History (approx)</div>
                              <div className="h-16 bg-gray-50 rounded-md p-2 overflow-x-auto">
                                <div className="flex space-x-4 text-xs text-gray-600">
                                  {entry.history.slice(-10).map((h) => (
                                    <div key={h.date} className="min-w-[80px]">
                                      <div className="text-gray-500">{h.date}</div>
                                      <div className="font-medium">{h.balanceEth.toFixed(2)} ETH</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400">History will appear after loading details.</div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center justify-between">
                            <Button
                              variant="outline"
                              className="border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                              onClick={async () => {
                                setTreasuryData((prev) => ({
                                  ...prev,
                                  [addr]: { ...(prev[addr] || {}), loadingDetails: true, errorDetails: undefined },
                                }));
                                try {
                                  const [txs, internals] = await Promise.all([
                                    fetchTransactions(addr),
                                    fetchInternalTransactions(addr)
                                  ]);
                                  const events: { ts: number; deltaEth: number }[] = [];
                                  txs.forEach((tx) => {
                                    const valueEth = parseFloat(tx.value) / Math.pow(10, 18);
                                    const isIncoming = tx.to?.toLowerCase() === addr.toLowerCase();
                                    const gasUsed = parseFloat(tx.gasUsed || '0');
                                    const gasPrice = parseFloat(tx.gasPrice || '0');
                                    const feeEth = (gasUsed * gasPrice) / Math.pow(10, 18);
                                    const delta = isIncoming ? valueEth : -valueEth - feeEth;
                                    events.push({ ts: parseInt(tx.timeStamp), deltaEth: delta });
                                  });
                                  internals.forEach((itx) => {
                                    const valueEth = parseFloat(itx.value) / Math.pow(10, 18);
                                    const isIncoming = itx.to?.toLowerCase() === addr.toLowerCase();
                                    const delta = isIncoming ? valueEth : -valueEth;
                                    events.push({ ts: parseInt(itx.timeStamp), deltaEth: delta });
                                  });
                                  events.sort((a, b) => a.ts - b.ts);
                                  let cumulative = 0;
                                  const dailyMap: Record<string, number> = {};
                                  events.forEach((e) => {
                                    cumulative += e.deltaEth;
                                    const date = new Date(e.ts * 1000);
                                    const dayKey = date.toISOString().slice(0, 10);
                                    dailyMap[dayKey] = cumulative;
                                  });
                                  const historyPairs = Object.entries(dailyMap).sort((a, b) => (a[0] < b[0] ? -1 : 1));
                                  const currentBalanceEth = treasuryData[addr]?.balanceEth ?? balanceEth;
                                  const offset = currentBalanceEth - (historyPairs.length > 0 ? historyPairs[historyPairs.length - 1][1] : 0);
                                  const history = historyPairs.map(([day, val]) => ({ date: day, balanceEth: val + offset }));

                                  setTreasuryData((prev) => ({
                                    ...prev,
                                    [addr]: { ...(prev[addr] || {}), transactions: txs, internals, history, loadingDetails: false },
                                  }));
                                } catch (e: any) {
                                  setTreasuryData((prev) => ({
                                    ...prev,
                                    [addr]: { ...(prev[addr] || {}), loadingDetails: false, errorDetails: 'Failed to load details' },
                                  }));
                                }
                              }}
                            >
                              {entry.loadingDetails ? 'Loading…' : hasDetails ? 'Refresh Details' : 'Load Details'}
                            </Button>
                            <a
                              href={`https://etherscan.io/address/${addr}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:text-blue-700 text-sm underline"
                            >
                              View on Etherscan →
                            </a>
                          </div>

                          {/* Details Tables */}
                          {hasDetails && (
                            <div className="space-y-4 pt-2">
                              {/* Transactions */}
                              <div className="border border-gray-100 rounded-lg overflow-hidden">
                                <div className="px-3 py-2 bg-gray-50 text-sm font-medium text-gray-700">Transactions</div>
                                <div className="max-h-56 overflow-auto">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-xs text-gray-500">Dir</th>
                                        <th className="px-3 py-2 text-left text-xs text-gray-500">Hash</th>
                                        <th className="px-3 py-2 text-left text-xs text-gray-500">Value (ETH)</th>
                                        <th className="px-3 py-2 text-left text-xs text-gray-500">Time</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {(entry.transactions || []).slice(0, 25).map((tx, i) => (
                                        <tr key={i} className="hover:bg-gray-50 cursor-pointer" onClick={() => openTransactionModal(tx)}>
                                          <td className="px-3 py-2">
                                            <Badge className={`${(tx.to?.toLowerCase() === addr.toLowerCase()) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                              {(tx.to?.toLowerCase() === addr.toLowerCase()) ? 'IN' : 'OUT'}
                                            </Badge>
                                          </td>
                                          <td className="px-3 py-2 font-mono text-xs text-blue-600">{truncateAddress(tx.hash)}</td>
                                          <td className="px-3 py-2">{formatETHValue(tx.value)}</td>
                                          <td className="px-3 py-2 text-gray-500">{formatTimestamp(tx.timeStamp)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* Internal Transfers */}
                              <div className="border border-gray-100 rounded-lg overflow-hidden">
                                <div className="px-3 py-2 bg-gray-50 text-sm font-medium text-gray-700">Internal Transfers</div>
                                <div className="max-h-56 overflow-auto">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-xs text-gray-500">Dir</th>
                                        <th className="px-3 py-2 text-left text-xs text-gray-500">Hash</th>
                                        <th className="px-3 py-2 text-left text-xs text-gray-500">Value (ETH)</th>
                                        <th className="px-3 py-2 text-left text-xs text-gray-500">Time</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {(entry.internals || []).slice(0, 25).map((tx, i) => (
                                        <tr key={i} className="hover:bg-gray-50 cursor-pointer" onClick={() => openTransactionModal(tx)}>
                                          <td className="px-3 py-2">
                                            <Badge className={`${(tx.to?.toLowerCase() === addr.toLowerCase()) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                              {(tx.to?.toLowerCase() === addr.toLowerCase()) ? 'IN' : 'OUT'}
                                            </Badge>
                                          </td>
                                          <td className="px-3 py-2 font-mono text-xs text-blue-600">{truncateAddress(tx.hash)}</td>
                                          <td className="px-3 py-2">{formatETHValue(tx.value)}</td>
                                          <td className="px-3 py-2 text-gray-500">{formatTimestamp(tx.timeStamp)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          )}

                          {entry.errorDetails && (
                            <div className="text-xs text-red-600">{entry.errorDetails}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Transaction Details Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="bg-white border border-gray-200 text-gray-900 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gray-900">Transaction Details</DialogTitle>
            </DialogHeader>
            {selectedTransaction && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <span className="text-gray-500 font-medium">Hash:</span>
                    <div className="font-mono text-blue-600 break-all text-xs">{selectedTransaction.hash}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-gray-500 font-medium">Block:</span>
                    <div className="font-mono">{selectedTransaction.blockNumber}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-gray-500 font-medium">From:</span>
                    <div className="font-mono break-all text-xs">{selectedTransaction.from}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-gray-500 font-medium">To:</span>
                    <div className="font-mono break-all text-xs">{selectedTransaction.to}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-gray-500 font-medium">Value:</span>
                    <div className="font-semibold">
                      {'tokenSymbol' in selectedTransaction ? (
                        `${formatTokenValue(selectedTransaction.value, selectedTransaction.tokenDecimal)} ${selectedTransaction.tokenSymbol}`
                      ) : (
                        `${formatETHValue(selectedTransaction.value)} ETH`
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-gray-500 font-medium">Time:</span>
                    <div>{formatTimestamp(selectedTransaction.timeStamp)}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-gray-500 font-medium">Direction:</span>
                    <div>
                      <Badge className={`${getTransactionDirection(selectedTransaction) === 'IN' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {getTransactionDirection(selectedTransaction)}
                      </Badge>
                    </div>
                  </div>
                  {'tokenName' in selectedTransaction && (
                    <div className="space-y-1">
                      <span className="text-gray-500 font-medium">Token:</span>
                      <div>{selectedTransaction.tokenName} ({selectedTransaction.tokenSymbol})</div>
            </div>
          )}
        </div>
                <div className="pt-4 border-t border-gray-200">
                  <a
                    href={`https://etherscan.io/tx/${selectedTransaction.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 underline font-medium"
                  >
                    View on Etherscan →
                  </a>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Footer Disclaimer */}
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 p-6 rounded-xl text-amber-800 mt-8">
          <p className="text-sm leading-relaxed">
            <strong>Disclaimer:</strong> This website is not affiliated with Richard Heart, PulseChain, or PulseX whatsoever. 
            We don't know whether Richard Heart actually purchased or possesses these coins. Information is based solely on public information 
            from either tweets or speculative chain analysis. The information on this website is for informational purposes only (not investment advice). 
            The data is based on estimates and probably not 100% correct.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LookIntoRHClone;