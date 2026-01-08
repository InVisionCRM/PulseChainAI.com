'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Copy, ExternalLink, Search, Wallet, TrendingUp, DollarSign, ArrowUp, ArrowDown, CheckCircle, XCircle, Shield } from 'lucide-react';
import { SwapTransactionData, TransactionAsset } from '../../types';
import { dexscreenerApi } from '@/services/blockchain/dexscreenerApi';
import { getAddressTransactions, getAddressTokenBalances } from '@/services/pulsechainService';

// Types
interface Transaction {
  hash: string;
  timestamp: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  status: string;
}

interface TokenBalance {
  token: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    exchange_rate?: string;
    logoURI?: string;
    isLP?: boolean;
  };
  value: string;
  token_id?: string;
}

interface ChainData {
  tokens: TokenBalance[];
  nativeBalance: number;
  totalValue: number;
  tokenCount: number;
}

interface Approval {
  block_number: string;
  block_timestamp: string;
  transaction_hash: string;
  value: string;
  value_formatted: string;
  token: {
    address: string;
    address_label?: string;
    name: string;
    symbol: string;
    logo?: string;
    possible_spam: boolean;
    verified_contract: boolean;
    current_balance?: string;
    current_balance_formatted?: string;
    usd_price?: string;
    usd_at_risk?: string;
  };
  spender: {
    address: string;
  };
}

const PortfolioTracker: React.FC = () => {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State management
  const [address, setAddress] = useState<string>('');
  const [currentAddress, setCurrentAddress] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Price data
  const [ethPrice, setEthPrice] = useState<number>(0);
  const [plsPrice, setPlsPrice] = useState<number>(0);

  // Portfolio data
  const [plsData, setPlsData] = useState<ChainData>({ tokens: [], nativeBalance: 0, totalValue: 0, tokenCount: 0 });
  const [totalPortfolioValue, setTotalPortfolioValue] = useState<number>(0);

  // Transaction data
  const [transactions, setTransactions] = useState<SwapTransactionData[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState<boolean>(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [tokenLogos, setTokenLogos] = useState<Record<string, string>>({});
  const [uiPreset, setUiPresetState] = useState<'classic' | 'rabby1'>('classic');
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);
  
  // Transaction filtering
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'receives' | 'sends'>('all');
  
  // Transaction pagination
  const [currentTransactionPage, setCurrentTransactionPage] = useState<number>(1);
  const [transactionsPerPage] = useState<number>(25);
  
  // LP token pair information
  const [lpTokenPairs, setLpTokenPairs] = useState<Record<string, any>>({});

  // Approvals data
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [isLoadingApprovals, setIsLoadingApprovals] = useState<boolean>(false);
  const [approvalsError, setApprovalsError] = useState<string | null>(null);
  const [spenderNames, setSpenderNames] = useState<Record<string, string>>({});
  const [holdersTimeframe, setHoldersTimeframe] = useState<'1' | '7' | '30' | '90'>('30');
  const [holdersStatsLoading, setHoldersStatsLoading] = useState<boolean>(false);
  const [holdersStats, setHoldersStats] = useState<{ newHolders: number; lostHolders: number; netChange: number } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedPreset = window.localStorage.getItem('geicko-ui-preset');
    if (storedPreset === 'classic' || storedPreset === 'rabby1') {
      setUiPresetState(storedPreset);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const shouldOpenFromSession = window.sessionStorage.getItem('open-portfolio-settings') === '1';
    const urlSearchParams = new URLSearchParams(window.location.search);
    const shouldOpenFromQuery = urlSearchParams.get('settings') === '1';

    if (shouldOpenFromSession || shouldOpenFromQuery) {
      setShowSettingsDrawer(true);
      window.sessionStorage.removeItem('open-portfolio-settings');
      if (shouldOpenFromQuery) {
        const url = new URL(window.location.href);
        url.searchParams.delete('settings');
        window.history.replaceState(null, '', url.toString());
      }
    }
  }, []);

  const updateUiPreset = useCallback((preset: 'classic' | 'rabby1') => {
    setUiPresetState(preset);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('geicko-ui-preset', preset);
      const customEvent = new CustomEvent<'classic' | 'rabby1'>('geicko-ui-preset-change', {
        detail: preset,
      });
      window.dispatchEvent(customEvent);
    }
    setShowSettingsDrawer(false);
  }, []);

  const isRabbyUI = uiPreset === 'rabby1';

  const settingsDrawer = showSettingsDrawer ? (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setShowSettingsDrawer(false)}
      />
      <div className="relative w-full max-w-md space-y-4 rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.65)]">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white">Interface Settings</p>
            <p className="text-xs text-slate-400">Choose your preferred layout for Geicko</p>
          </div>
          <button
            type="button"
            onClick={() => setShowSettingsDrawer(false)}
            className="text-slate-400 transition-colors hover:text-white"
            title="Close"
          >
            ✕
          </button>
        </div>
        <div className="space-y-2">
          <label
            className={`flex items-center justify-between rounded-2xl border px-3 py-2 ${
              uiPreset === 'classic'
                ? 'border-white/30 bg-white/5'
                : 'border-white/10 transition-colors hover:border-white/20'
            }`}
          >
            <div>
              <p className="text-sm font-semibold text-white">Classic Layout</p>
              <p className="text-xs text-slate-400">Minimal tabs and analytics</p>
            </div>
            <input
              type="radio"
              name="uiPreset"
              value="classic"
              checked={uiPreset === 'classic'}
              onChange={() => updateUiPreset('classic')}
              className="accent-white"
            />
          </label>
          <label
            className={`flex items-center justify-between rounded-2xl border px-3 py-2 ${
              uiPreset === 'rabby1'
                ? 'border-indigo-300 bg-indigo-500/10'
                : 'border-white/10 transition-colors hover:border-white/20'
            }`}
          >
            <div>
              <p className="text-sm font-semibold text-white">Rabby 1</p>
              <p className="text-xs text-slate-400">Carded dashboard + action grid</p>
            </div>
            <input
              type="radio"
              name="uiPreset"
              value="rabby1"
              checked={uiPreset === 'rabby1'}
              onChange={() => updateUiPreset('rabby1')}
              className="accent-indigo-400"
            />
          </label>
        </div>
        <p className="text-[11px] text-slate-500">
          Preferences are saved locally in your browser so your favorite layout loads automatically the next time you
          visit Geicko.
        </p>
      </div>
    </div>
  ) : null;

  // Fetch spender contract names from PulseChain API
  const fetchSpenderNames = async (spenderAddresses: string[]): Promise<Record<string, string>> => {
    const names: Record<string, string> = {};
    
    try {
      // Fetch contract names in smaller batches with timeout
      const batchSize = 5;
      for (let i = 0; i < spenderAddresses.length; i += batchSize) {
        const batch = spenderAddresses.slice(i, i + batchSize);
        
        const promises = batch.map(async (address) => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
            
            const response = await fetch(`https://scan.pulsechain.com/api/v2/addresses/${address}`, {
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              const data = await response.json();
              if (data.name) {
                names[address.toLowerCase()] = data.name;
                console.log(`Found name for ${address}: ${data.name}`);
              }
            }
          } catch (error) {
            console.error(`Error fetching name for ${address}:`, error);
          }
        });
        
        await Promise.all(promises);
      }
    } catch (error) {
      console.error('Error fetching spender names:', error);
    }
    
    return names;
  };

  // Fetch wallet approvals from Moralis API
  const fetchApprovals = async (walletAddress: string): Promise<Approval[]> => {
    try {
      console.log('Making API request to:', `https://deep-index.moralis.io/api/v2.2/wallets/${walletAddress}/approvals?chain=pulse&limit=25`);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(`https://deep-index.moralis.io/api/v2.2/wallets/${walletAddress}/approvals?chain=pulse&limit=25`, {
        headers: {
          'accept': 'application/json',
          'X-API-Key': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjYzOWU4ZWMwLTJkM2ItNDgwYS04MWY5LTdiMDM3OTYxZjIyYSIsIm9yZ0lkIjoiNDMyMTk3IiwidXNlcklkIjoiNDQ0NTc3IiwidHlwZUlkIjoiZWY3YmEyYjMtMTMyYS00MWI0LWEyMDgtYTUwNGEzMjk5NDMzIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3Mzk4NTgyMDYsImV4cCI6NDg5NTYxODIwNn0.iSuHF229Nk_9yiiqDxyyGM0MB6DEG09gLa2oFWYf5us'
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      console.log('Response status:', response.status);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Raw API response:', data);
      return data.result || [];
    } catch (error) {
      console.error('Error fetching approvals:', error);
      throw error;
    }
  };

  // API Functions (ported from lookintorh-clone.tsx)
  const fetchPLSPrice = async (): Promise<number> => {
    try {
      // Use DexScreener for PLS price via WPLS token
      const result = await dexscreenerApi.getTokenProfile('0xA1077a294dDE1B09bB078844df40758a5D0f9a27'); // WPLS address
      if (result.success && result.data?.marketData?.priceUsd) {
        return parseFloat(result.data.marketData.priceUsd);
      }
    } catch (error) {
      console.error('Error fetching PLS price from DexScreener:', error);
    }

    return 0.0001; // Fallback price
  };

  const fetchPulseChainNativeBalance = async (address: string): Promise<number> => {
    try {
      // Use the PulseChain API v2 endpoint through our proxy
      const response = await fetch(`/api/pulsechain-proxy?endpoint=/addresses/${address}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.coin_balance) {
          // PLS has 18 decimals, convert from wei to PLS
          const balance = parseFloat(data.coin_balance) / Math.pow(10, 18);
          return balance;
        }
      }
      return 0;
    } catch (error) {
      console.error('Error fetching PulseChain native balance:', error);
      return 0;
    }
  };

  const fetchAllTokensAndCategorize = async (address: string): Promise<TokenBalance[]> => {
    try {
      // Use the existing pulsechainService function
      const result = await getAddressTokenBalances(address);
      
      if (result.error) {
        console.error('Error fetching token balances:', result.error);
        return [];
      }
      
      const data = Array.isArray(result) ? result : result.data || [];
      
      if (Array.isArray(data)) {
        console.log(`[fetchAllTokensAndCategorize] Processing ${data.length} tokens`);

        // Enhance tokens with prices
        const tokensWithPrices = await Promise.all(
          data.map(async (token, index) => {
            if (token.token?.address) {
              console.log(`[fetchAllTokensAndCategorize] Fetching price for token ${index + 1}/${data.length}: ${token.token.symbol} (${token.token.address})`);
              const price = await fetchTokenPrice(token.token.address);
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

        console.log(`[fetchAllTokensAndCategorize] Price fetching complete.`);
        return tokensWithPrices;
      }
      return [];
    } catch (error) {
      console.error('Error fetching tokens:', error);
      return [];
    }
  };

  const fetchTokenPrice = async (tokenAddress: string): Promise<number> => {
    console.log(`[fetchTokenPrice] Fetching price for token: ${tokenAddress}`);
    try {
      const result = await dexscreenerApi.getTokenProfile(tokenAddress);
      console.log(`[fetchTokenPrice] DexScreener result for ${tokenAddress}:`, {
        success: result.success,
        hasData: !!result.data,
        hasMarketData: !!result.data?.marketData,
        priceUsd: result.data?.marketData?.priceUsd
      });

      if (result.success && result.data?.marketData?.priceUsd) {
        const price = parseFloat(result.data.marketData.priceUsd);
        console.log(`[fetchTokenPrice] ✅ Price found for ${tokenAddress}: $${price}`);
        return price;
      }

      console.warn(`[fetchTokenPrice] ⚠️ No price found for ${tokenAddress}`);
    } catch (error) {
      console.error(`[fetchTokenPrice] ❌ Error fetching token price for ${tokenAddress}:`, error);
    }
    return 0;
  };

  const fetchTokenLogo = async (tokenAddress: string): Promise<string | null> => {
    // Validate address format
    if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      console.warn(`[fetchTokenLogo] ❌ Invalid token address: ${tokenAddress}`);
      return null;
    }

    // Check cache first
    if (tokenLogos[tokenAddress.toLowerCase()]) {
      return tokenLogos[tokenAddress.toLowerCase()];
    }

    // Use CoinGecko CDN for known tokens (much faster than API calls)
    const knownTokens: { [key: string]: string } = {
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 'https://assets.coingecko.com/coins/images/279/large/ethereum.png', // WETH
      '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39': 'https://assets.coingecko.com/coins/images/10103/large/HEX-logo.png', // HEX
      '0x95B303987A60C71504D99Aa1b13B4DA07b0790ab': 'https://assets.coingecko.com/coins/images/25437/large/pulsex.png', // PLSX
      '0xA1077a294dDE1B09bB078844df40758a5D0f9a27': 'https://assets.coingecko.com/coins/images/279/large/ethereum.png', // WPLS (use ETH logo)
      '0x6B175474E89094C44Da98b954EedeAC495271d0F': 'https://assets.coingecko.com/coins/images/9956/large/4943.png', // DAI
      '0xA0b86a33E6441b8C4C8C0E6B4B8B8B8B8B8B8B8B': 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png', // USDC
    };

    const fallbackLogo = knownTokens[tokenAddress.toLowerCase()];
    if (fallbackLogo) {
      console.log(`[fetchTokenLogo] ✅ Using known token logo for ${tokenAddress}`);
      return fallbackLogo;
    }

    // For unknown tokens, skip API calls to improve performance
    console.log(`[fetchTokenLogo] ⚠️ No logo available for ${tokenAddress}, skipping slow API call`);
    return null;
  };

  // LP token detection and calculation function
  const getLPTokenPairInfo = async (tokenAddress: string, tokenSymbol: string, tokenName: string, walletBalance: string): Promise<{isLP: boolean, pairInfo?: {token0: string, token1: string, token0Symbol: string, token1Symbol: string, token0Amount: string, token1Amount: string, token0Logo?: string, token1Logo?: string}}> => {
    // Check if this is an LP token by symbol/name patterns
    const normalizedSymbol = (tokenSymbol || '').toUpperCase();
    const normalizedName = (tokenName || '').toLowerCase();
    const isLPBySymbol = normalizedSymbol.includes('LP') ||
                        normalizedSymbol.includes('UNI-V2') ||
                        normalizedSymbol.includes('CAKE-LP') ||
                        normalizedSymbol.includes('PLSX-LP') ||
                        normalizedSymbol.includes('PULSEX-LP') ||
                        normalizedSymbol.includes('V2');
    
    const isLPByName = normalizedName.includes('liquidity') ||
                      normalizedName.includes('lp token') ||
                      normalizedName.includes('pair') ||
                      normalizedName.includes('liquidity pool');
    
    if (!isLPBySymbol && !isLPByName) {
      return { isLP: false };
    }
    
    try {
      // Get LP token contract info from PulseChain API
      const tokenInfoResponse = await fetch(`/api/pulsechain-proxy?endpoint=/tokens/${tokenAddress}`);
      
      if (!tokenInfoResponse.ok) {
        return { isLP: false };
      }
      
      const tokenInfo = await tokenInfoResponse.json();
      
      // For LP tokens, we need to get the underlying pair information
      // This would typically require contract calls to get reserves
      // For now, we'll use DexScreener to get the pair info, but only for actual LP tokens
      console.log(`[getLPTokenPairInfo] Fetching DexScreener data for LP token: ${tokenSymbol} (${tokenAddress})`);
      const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
      
      if (dexResponse.ok) {
        const dexData = await dexResponse.json();
        console.log(`[getLPTokenPairInfo] DexScreener response for ${tokenSymbol}:`, dexData);
        
        if (dexData.pairs && dexData.pairs.length > 0) {
          // Find the pair with highest liquidity
          const bestPair = dexData.pairs.sort((a: any, b: any) => 
            (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
          )[0];
          
          // Calculate wallet's share of the LP
          const walletLPBalance = parseFloat(walletBalance) / Math.pow(10, tokenInfo.decimals || 18);
          const totalLPSupply = parseFloat(tokenInfo.total_supply || '0') / Math.pow(10, tokenInfo.decimals || 18);
          
          let token0Amount = '0';
          let token1Amount = '0';
          
          if (totalLPSupply > 0) {
            const walletShare = walletLPBalance / totalLPSupply;
            
            // Get reserves from the pair (this is simplified - in reality we'd call the LP contract)
            const token0Reserve = parseFloat(bestPair.liquidity?.base || '0');
            const token1Reserve = parseFloat(bestPair.liquidity?.quote || '0');
            
            token0Amount = (walletShare * token0Reserve).toFixed(6);
            token1Amount = (walletShare * token1Reserve).toFixed(6);
          }
          
          return {
            isLP: true,
            pairInfo: {
              token0: bestPair.baseToken?.address || '',
              token1: bestPair.quoteToken?.address || '',
              token0Symbol: bestPair.baseToken?.symbol || 'Unknown',
              token1Symbol: bestPair.quoteToken?.symbol || 'Unknown',
              token0Amount: token0Amount,
              token1Amount: token1Amount,
              token0Logo: bestPair.baseToken?.logoURI || bestPair.baseToken?.logo,
              token1Logo: bestPair.quoteToken?.logoURI || bestPair.quoteToken?.logo
            }
          };
        }
      }
      
      // If DexScreener doesn't have data, try to get pair info from PulseChain API
      console.log(`[getLPTokenPairInfo] DexScreener has no data for ${tokenSymbol}, trying PulseChain API...`);
      
      try {
        // Try to get token transfers to find the pair tokens
        const transfersResponse = await fetch(`/api/pulsechain-proxy?endpoint=/tokens/${tokenAddress}/transfers`);
        
        if (transfersResponse.ok) {
          const transfersData = await transfersResponse.json();
          console.log(`[getLPTokenPairInfo] Token transfers for ${tokenSymbol}:`, transfersData);
          
          // Look for the most recent transfers to identify pair tokens
          if (transfersData.items && transfersData.items.length > 0) {
            const recentTransfers = transfersData.items.slice(0, 10); // Get last 10 transfers
            
            // Find unique token addresses from transfers
            const tokenAddresses = new Set<string>();
            recentTransfers.forEach((transfer: any) => {
              if (transfer.token?.address) {
                tokenAddresses.add(transfer.token.address);
              }
            });
            
            // If we found at least 2 different tokens, assume they're the pair
            if (tokenAddresses.size >= 2) {
              const pairTokens = Array.from(tokenAddresses).slice(0, 2);
              
              // Calculate wallet's share of the LP
              const walletLPBalance = parseFloat(walletBalance) / Math.pow(10, tokenInfo.decimals || 18);
              const totalLPSupply = parseFloat(tokenInfo.total_supply || '0') / Math.pow(10, tokenInfo.decimals || 18);
              
              let token0Amount = '0';
              let token1Amount = '0';
              
              if (totalLPSupply > 0) {
                const walletShare = walletLPBalance / totalLPSupply;
                // Estimate amounts based on wallet share (this is approximate)
                token0Amount = (walletShare * 1000).toFixed(6); // Placeholder calculation
                token1Amount = (walletShare * 1000).toFixed(6); // Placeholder calculation
              }
              
              return {
                isLP: true,
                pairInfo: {
                  token0: pairTokens[0],
                  token1: pairTokens[1],
                  token0Symbol: 'Token0', // We don't have symbol info from transfers
                  token1Symbol: 'Token1',
                  token0Amount: token0Amount,
                  token1Amount: token1Amount,
                  token0Logo: undefined,
                  token1Logo: undefined
                }
              };
            }
          }
        }
      } catch (error) {
        console.error(`[getLPTokenPairInfo] Error fetching transfers for ${tokenSymbol}:`, error);
      }
      
      return { isLP: true, pairInfo: undefined }; // LP token detected but no pair info available
    } catch (error) {
      console.error('Error calculating LP holdings:', error);
      return { isLP: false };
    }
  };

  // Fetch transactions for the current address
  const fetchTransactions = async (address: string) => {
    if (!address) return;
    
    console.log('fetchTransactions called for address:', address);
    setIsLoadingTransactions(true);
    setTransactionsError(null);
    
    try {
      console.log('Making API request to:', `/api/address/${address}/swap-transactions?page=1&limit=100`);
      // Fetch transactions - request 100 for faster loading
      const response = await fetch(`/api/address/${address}/swap-transactions?page=1&limit=100`);
      
      console.log('Response status:', response.status);
      if (!response.ok) {
        throw new Error(`Failed to fetch transactions: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Transactions data received:', data);
      const newTransactions = data.items || [];
      
      console.log('Setting transactions:', newTransactions.length, 'transactions');
      setTransactions(newTransactions);
      setCurrentTransactionPage(1); // Reset to first page when new transactions are loaded
      
      // Optimize logo fetching - only fetch for tokens that don't have logos yet
      const logos: Record<string, string> = { ...tokenLogos };
      const uniqueTokens = new Set<string>();

      newTransactions.forEach(tx => {
        tx.sentAssets?.forEach(asset => {
          if (!logos[asset.tokenAddress.toLowerCase()]) {
            uniqueTokens.add(asset.tokenAddress);
          }
        });
        tx.receivedAssets?.forEach(asset => {
          if (!logos[asset.tokenAddress.toLowerCase()]) {
            uniqueTokens.add(asset.tokenAddress);
          }
        });
      });

      // Batch fetch logos for new tokens only
      if (uniqueTokens.size > 0) {
        const logoPromises = Array.from(uniqueTokens).map(async (tokenAddr) => {
          const logo = await fetchTokenLogo(tokenAddr);
          if (logo) {
            logos[tokenAddr.toLowerCase()] = logo;
          }
        });

        await Promise.all(logoPromises);
        setTokenLogos(logos);
      }
    } catch (err) {
      setTransactionsError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  const fetchWalletApprovals = async (address: string) => {
    if (!address) return;
    
    console.log('fetchWalletApprovals called for address:', address);
    setIsLoadingApprovals(true);
    setApprovalsError(null);
    
    try {
      console.log('Fetching approvals for address:', address);
      const approvalsData = await fetchApprovals(address);
      console.log('Approvals data received:', approvalsData);
      console.log('Setting approvals:', approvalsData.length, 'approvals');
      setApprovals(approvalsData);
      
      // Extract unique spender addresses and fetch their names
      const uniqueSpenderAddresses = [...new Set(approvalsData.map(approval => approval.spender.address))];
      console.log('Fetching names for spender addresses:', uniqueSpenderAddresses);
      
      // Fetch spender names in the background without blocking the UI
      fetchSpenderNames(uniqueSpenderAddresses).then(spenderNamesData => {
        console.log('Spender names received:', spenderNamesData);
        setSpenderNames(spenderNamesData);
      }).catch(error => {
        console.error('Error fetching spender names:', error);
        // Don't fail the whole process if spender names fail
      });
      
    } catch (error) {
      console.error('Error fetching approvals:', error);
      setApprovalsError('Failed to fetch approvals');
    } finally {
      setIsLoadingApprovals(false);
    }
  };

  const calculatePulseChainTotalValue = (tokens: TokenBalance[], plsBalance: number, plsPrice: number): number => {
    let totalValue = plsBalance * plsPrice;
    
    tokens.forEach(token => {
      if (token.token.exchange_rate) {
        const price = parseFloat(token.token.exchange_rate);
        const amount = parseFloat(token.value) / Math.pow(10, token.token.decimals || 18);
        totalValue += amount * price;
      }
    });
    
    return totalValue;
  };

  // Utility functions
  const formatETHValue = (value: number): string => {
    if (value >= 1) {
      return value.toFixed(4);
    } else if (value >= 0.0001) {
      return value.toFixed(6);
    } else {
      return value.toExponential(2);
    }
  };

  const formatTokenValue = (value: string, decimals: number = 18): string => {
    const numValue = parseFloat(value);
    const formatted = numValue / Math.pow(10, decimals);
    
    if (formatted >= 1) {
      return formatted.toFixed(2);
    } else if (formatted >= 0.0001) {
      return formatted.toFixed(6);
    } else {
      return formatted.toExponential(2);
    }
  };

  const formatUSDValue = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`;
    } else if (value >= 1) {
      return `$${value.toFixed(2)}`;
    } else {
      return `$${value.toFixed(4)}`;
    }
  };

  const truncateAddress = (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleTokenClick = (tokenAddress: string) => {
    router.push(`/ai-agent?address=${tokenAddress}`);
  };

  const handleSearch = async () => {
    if (!address.trim()) {
      setError('Please enter a valid PulseChain address');
      return;
    }

    setLoading(true);
    setError('');
    setCurrentAddress(address.trim());

    try {
      // Fetch PLS price
      const plsPriceValue = await fetchPLSPrice();
      setPlsPrice(plsPriceValue);

      // Fetch balances and tokens
      const [plsBalance, tokenData] = await Promise.all([
        fetchPulseChainNativeBalance(address.trim()),
        fetchAllTokensAndCategorize(address.trim())
      ]);

      // Enhance tokens with logos
      const enhanceTokensWithLogos = async (tokens: TokenBalance[]) => {
        console.log(`[enhanceTokensWithLogos] Processing ${tokens.length} tokens (optimized for speed)...`);
        
        const enhanced = await Promise.all(tokens.map(async (token, index) => {
          // Only process LP tokens for pair info (skip logo fetching for now to improve speed)
          const lpInfo = await getLPTokenPairInfo(token.token.address, token.token.symbol, token.token.name, token.value);
          
          // Store LP pair info if it's an LP token
          if (lpInfo.isLP && lpInfo.pairInfo) {
            setLpTokenPairs(prev => ({
              ...prev,
              [token.token.address.toLowerCase()]: lpInfo.pairInfo
            }));
          }
          
          return {
            ...token,
            token: {
              ...token.token,
              logoURI: token.token.logoURI, // Keep existing logo if any
              isLP: lpInfo.isLP
            }
          };
        }));
        
        console.log(`[enhanceTokensWithLogos] Processed ${enhanced.length} tokens`);
        return enhanced;
      };

      const enhancedPlsTokens = await enhanceTokensWithLogos(tokenData);

      console.log('Enhanced PulseChain tokens:', enhancedPlsTokens.length);

      // Calculate totals
      const plsTotalValue = calculatePulseChainTotalValue(enhancedPlsTokens, plsBalance, plsPriceValue);

      setPlsData({
        tokens: enhancedPlsTokens,
        nativeBalance: plsBalance,
        totalValue: plsTotalValue,
        tokenCount: enhancedPlsTokens.length
      });

      setTotalPortfolioValue(plsTotalValue);

      // Fetch transactions for the address
      await fetchTransactions(address.trim());

      // Fetch approvals for the address
      await fetchWalletApprovals(address.trim());

    } catch (error) {
      console.error('Error fetching portfolio data:', error);
      setError('Failed to fetch portfolio data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Transaction utility functions
  const formatDetailedTimeAgo = (timestamp: string): string => {
    const now = new Date().getTime();
    const transactionTime = new Date(timestamp).getTime();
    const diffInSeconds = Math.floor((now - transactionTime) / 1000);

    const weeks = Math.floor(diffInSeconds / 604800);
    const days = Math.floor((diffInSeconds % 604800) / 86400);
    const hours = Math.floor((diffInSeconds % 86400) / 3600);

    if (weeks > 0) {
      return `${weeks} week${weeks > 1 ? 's' : ''} and ${days} day${days !== 1 ? 's' : ''} ago`;
    } else if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} and ${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }
  };

  const getDisplayAddress = (address: string, isUserAddress: boolean): string => {
    if (isUserAddress) {
      return 'You';
    }
    if (address.startsWith('✗')) {
      return address; // DEX name
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleExternalLinkClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Transaction type detection
  const getTransactionType = (tx: SwapTransactionData, userAddress: string): { type: 'buy' | 'sell' | 'transfer' | 'swap', label: string, color: string } => {
    const isUserSender = tx.from === userAddress;
    const isUserReceiver = tx.to === userAddress;
    
    // Check if it's a DEX interaction (router address)
    const isDexInteraction = tx.to.startsWith('✗') || tx.from.startsWith('✗');
    
    if (isDexInteraction) {
      if (isUserSender && tx.sentAssets && tx.sentAssets.length > 0 && tx.receivedAssets && tx.receivedAssets.length > 0) {
        // User sent tokens and received tokens - this is a swap
        return { type: 'swap', label: 'Swap', color: 'text-blue-400' };
      } else if (isUserSender && tx.sentAssets && tx.sentAssets.length > 0) {
        // User sent tokens to DEX - this is a sell
        return { type: 'sell', label: 'Sell', color: 'text-red-400' };
      } else if (isUserReceiver && tx.receivedAssets && tx.receivedAssets.length > 0) {
        // User received tokens from DEX - this is a buy
        return { type: 'buy', label: 'Buy', color: 'text-green-400' };
      }
    }
    
    // If not a DEX interaction, it's a transfer
    if (isUserSender && isUserReceiver) {
      return { type: 'transfer', label: 'Self Transfer', color: 'text-gray-400' };
    } else if (isUserSender) {
      return { type: 'transfer', label: 'Send', color: 'text-orange-400' };
    } else if (isUserReceiver) {
      return { type: 'transfer', label: 'Receive', color: 'text-purple-400' };
    }
    
    return { type: 'transfer', label: 'Transfer', color: 'text-gray-400' };
  };

  // Filter transactions based on selected filter
  const getFilteredTransactions = (): SwapTransactionData[] => {
    if (transactionFilter === 'all') {
      return transactions;
    }
    
    return transactions.filter(tx => {
      const isUserSender = tx.from === currentAddress;
      const isUserReceiver = tx.to === currentAddress;
      
      if (transactionFilter === 'receives') {
        return isUserReceiver && !isUserSender; // User received but didn't send
      } else if (transactionFilter === 'sends') {
        return isUserSender && !isUserReceiver; // User sent but didn't receive
      }
      
      return true;
    });
  };

  // Get paginated transactions
  const getPaginatedTransactions = (): SwapTransactionData[] => {
    const filtered = getFilteredTransactions();
    const startIndex = (currentTransactionPage - 1) * transactionsPerPage;
    const endIndex = startIndex + transactionsPerPage;
    return filtered.slice(startIndex, endIndex);
  };

  // Get total pages for current filter
  const getTotalPages = (): number => {
    const filtered = getFilteredTransactions();
    return Math.ceil(filtered.length / transactionsPerPage);
  };

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentTransactionPage(1);
  }, [transactionFilter]);

  // Render functions
  const renderChainCard = (chainName: string, data: ChainData, nativeSymbol: string) => (
    <Card className="bg-slate-950 border-gray-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500/5 to-purple-600/5 flex items-center justify-center">
              <img src="/LogoVector.svg" alt="PulseChain" className="w-10 h-10" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-white">
                {chainName}
              </CardTitle>
              <p className="text-sm text-gray-400">
                {data.tokenCount} tokens
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-white">
              {formatUSDValue(data.totalValue)}
            </p>
            <p className="text-sm text-gray-400">
              {formatETHValue(data.nativeBalance)} {nativeSymbol}
            </p>
          </div>
        </div>
      </CardHeader>
    </Card>
  );

  const renderTokenTable = (tokens: TokenBalance[], chainName: string) => {
    // Sort tokens: first by logo availability, then by USD value (highest first)
    const sortedTokens = [...tokens].sort((a, b) => {
      // First sort by logo availability (tokens with logos first)
      const hasLogoA = !!a.token.logoURI;
      const hasLogoB = !!b.token.logoURI;
      
      if (hasLogoA && !hasLogoB) return -1;
      if (!hasLogoA && hasLogoB) return 1;
      
      // If both have logos or both don't have logos, sort by USD value
      const priceA = parseFloat(a.token.exchange_rate || '0');
      const amountA = parseFloat(a.value) / Math.pow(10, a.token.decimals || 18);
      const valueA = amountA * priceA;

      const priceB = parseFloat(b.token.exchange_rate || '0');
      const amountB = parseFloat(b.value) / Math.pow(10, b.token.decimals || 18);
      const valueB = amountB * priceB;

      return valueB - valueA;
    });

    return (
      <div className="space-y-4">
        {/* All Tokens */}
        {sortedTokens.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">
              All Tokens ({sortedTokens.length})
            </h3>
            <div className="space-y-3">
              {sortedTokens.map((token, index) => {
                const price = parseFloat(token.token.exchange_rate || '0');
                const amount = parseFloat(token.value) / Math.pow(10, token.token.decimals || 18);
                const usdValue = amount * price;

                console.log(`Token ${token.token.symbol}: price=${price}, amount=${amount}, value=${usdValue}, logoURI=${token.token.logoURI}`);
                
                return (
                  <div key={index} className="bg-slate-950 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
                    <div className="flex items-center justify-between">
                      {/* Token Info */}
                      <div className="flex items-center gap-3">
                        {token.token.logoURI ? (
                          <div className="relative w-10 h-10">
                            <img
                              src={token.token.logoURI}
                              alt={token.token.symbol}
                              className="w-10 h-10 rounded-full object-cover"
                              onError={(e) => {
                                console.warn(`Failed to load logo for ${token.token.symbol}:`, token.token.logoURI);
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                            <div
                              className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center absolute top-0 left-0"
                              style={{ display: 'none' }}
                            >
                              <span className="text-gray-400 text-xs font-medium">
                                {token.token.symbol?.slice(0, 2) || '?'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                            <span className="text-gray-400 text-xs font-medium">
                              {token.token.symbol?.slice(0, 2) || '?'}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleTokenClick(token.token.address)}
                              className="text-white hover:text-blue-400 font-medium hover:underline text-base"
                            >
                              {token.token.name || 'Unknown Token'}
                            </button>
                            {token.token.isLP && (
                              <span className="px-2 py-1 bg-blue-900/30 text-blue-300 text-xs rounded-full border border-blue-700/30">
                                LP
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-400">
                            {token.token.symbol || 'UNKNOWN'}
                          </p>
                          
                          {/* Show LP pair information */}
                          {token.token.isLP && (
                            <div className="mt-2">
                              {lpTokenPairs[token.token.address.toLowerCase()] ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">Underlying:</span>
                                    <div className="flex items-center gap-1">
                                      {lpTokenPairs[token.token.address.toLowerCase()].token0Logo && (
                                        <img 
                                          src={lpTokenPairs[token.token.address.toLowerCase()].token0Logo} 
                                          alt={lpTokenPairs[token.token.address.toLowerCase()].token0Symbol}
                                          className="w-4 h-4 rounded-full"
                                          onError={(e) => e.currentTarget.style.display = 'none'}
                                        />
                                      )}
                                      <span className="text-xs text-gray-400">
                                        {lpTokenPairs[token.token.address.toLowerCase()].token0Amount} {lpTokenPairs[token.token.address.toLowerCase()].token0Symbol}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">+</span>
                                    <div className="flex items-center gap-1">
                                      {lpTokenPairs[token.token.address.toLowerCase()].token1Logo && (
                                        <img 
                                          src={lpTokenPairs[token.token.address.toLowerCase()].token1Logo} 
                                          alt={lpTokenPairs[token.token.address.toLowerCase()].token1Symbol}
                                          className="w-4 h-4 rounded-full"
                                          onError={(e) => e.currentTarget.style.display = 'none'}
                                        />
                                      )}
                                      <span className="text-xs text-gray-400">
                                        {lpTokenPairs[token.token.address.toLowerCase()].token1Amount} {lpTokenPairs[token.token.address.toLowerCase()].token1Symbol}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-gray-500">
                                  LP pair information not available
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Token Values */}
                      <div className="text-right">
                        <div className="text-white font-semibold text-lg">
                          {formatUSDValue(usdValue)}
                        </div>
                        <div className="text-gray-400 text-sm">
                          {formatTokenValue(token.value, token.token.decimals)} {token.token.symbol}
                        </div>
                        {price > 0 && (
                          <div className="text-gray-500 text-xs">
                            Price: {formatUSDValue(price)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTransactions = () => {
    console.log('renderTransactions called - isLoadingTransactions:', isLoadingTransactions, 'transactionsError:', transactionsError, 'transactions.length:', transactions.length);
    
    const filteredTransactions = getFilteredTransactions();
    const paginatedTransactions = getPaginatedTransactions();
    const totalPages = getTotalPages();
    
    if (isLoadingTransactions) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-400">Loading transactions...</div>
        </div>
      );
    }

    if (transactionsError) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-red-400 mb-4">{transactionsError}</p>
          <button
            onClick={() => fetchTransactions(currentAddress)}
            className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    if (transactions.length === 0) {
      return (
        <div className="flex items-center justify-center py-8 text-gray-400">
          No transactions found
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Filter Buttons */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-400 mr-2">Filter:</span>
          <button
            onClick={() => setTransactionFilter('all')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              transactionFilter === 'all'
                ? 'bg-white text-black'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            All ({transactions.length})
          </button>
          <button
            onClick={() => setTransactionFilter('receives')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              transactionFilter === 'receives'
                ? 'bg-white text-black'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Receives ({transactions.filter(tx => tx.to === currentAddress && tx.from !== currentAddress).length})
          </button>
          <button
            onClick={() => setTransactionFilter('sends')}
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              transactionFilter === 'sends'
                ? 'bg-white text-black'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Sends ({transactions.filter(tx => tx.from === currentAddress && tx.to !== currentAddress).length})
          </button>
        </div>

        {/* Transactions List */}
        {filteredTransactions.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            No {transactionFilter === 'all' ? '' : transactionFilter} transactions found
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedTransactions.map((tx) => {
              const txType = getTransactionType(tx, currentAddress);
              return (
            <div key={tx.id} className="bg-slate-950 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
              {/* Transaction Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`px-2 py-1 rounded-full text-xs font-semibold ${txType.color} bg-opacity-20`}>
                    {txType.label}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">
                      From: {getDisplayAddress(tx.from, tx.from === currentAddress)}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className="text-gray-400">
                      To: {getDisplayAddress(tx.to, tx.to === currentAddress)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">{formatDetailedTimeAgo(tx.timestamp)}</span>
                  <button 
                    onClick={() => handleExternalLinkClick(`https://scan.pulsechain.com/tx/${tx.txHash}`)}
                    className="p-1 text-gray-400 hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>

            {/* Sent Assets */}
            {tx.sentAssets && tx.sentAssets.length > 0 && (
              <div className="space-y-2 mb-3">
                {tx.sentAssets.map((asset, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowUp className="w-4 h-4 text-red-500 flex-shrink-0" />
                      {tokenLogos[asset.tokenAddress.toLowerCase()] ? (
                        <img 
                          src={tokenLogos[asset.tokenAddress.toLowerCase()]} 
                          alt={asset.symbol}
                          className="w-5 h-5 rounded-full flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-700 flex-shrink-0" />
                      )}
                      <span className="text-white font-medium">{asset.amount} {asset.symbol}</span>
                      {asset.value > 0 && (
                        <span className="text-gray-400">(${asset.value.toFixed(2)})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleExternalLinkClick(`https://scan.pulsechain.com/token/${asset.tokenAddress}`)}
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Received Assets */}
            {tx.receivedAssets && tx.receivedAssets.length > 0 && (
              <div className="space-y-2 mb-3">
                {tx.receivedAssets.map((asset, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowDown className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {tokenLogos[asset.tokenAddress.toLowerCase()] ? (
                        <img 
                          src={tokenLogos[asset.tokenAddress.toLowerCase()]} 
                          alt={asset.symbol}
                          className="w-5 h-5 rounded-full flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-700 flex-shrink-0" />
                      )}
                      <span className="text-white font-medium">{asset.amount} {asset.symbol}</span>
                      <span className="text-gray-400">(${asset.value.toFixed(2)})</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleExternalLinkClick(`https://scan.pulsechain.com/token/${asset.tokenAddress}`)}
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Transaction Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-700">
              <div className="flex items-center gap-2">
                {tx.status === 'success' ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-green-500 text-sm font-medium">Success</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-red-500 text-sm font-medium">Failed</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">
                  Gas: {tx.gasUsed} {tx.gasSymbol} (${tx.gasValue.toFixed(2)})
                </span>
              </div>
            </div>
          </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {filteredTransactions.length > transactionsPerPage && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
            <div className="text-sm text-gray-400">
              Showing {((currentTransactionPage - 1) * transactionsPerPage) + 1} to {Math.min(currentTransactionPage * transactionsPerPage, filteredTransactions.length)} of {filteredTransactions.length} transactions
            </div>
            
            <div className="flex items-center gap-2">
              {/* First Page Button */}
              <button
                onClick={() => setCurrentTransactionPage(1)}
                disabled={currentTransactionPage === 1}
                className="px-3 py-1 text-sm rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="First Page"
              >
                ««
              </button>
              
              {/* Previous Page Button */}
              <button
                onClick={() => setCurrentTransactionPage(prev => Math.max(1, prev - 1))}
                disabled={currentTransactionPage === 1}
                className="px-3 py-1 text-sm rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Previous Page"
              >
                «
              </button>
              
              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {/* Show first page if not in initial range */}
                {currentTransactionPage > 3 && totalPages > 5 && (
                  <>
                    <button
                      onClick={() => setCurrentTransactionPage(1)}
                      className="px-3 py-1 text-sm rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                    >
                      1
                    </button>
                    {currentTransactionPage > 4 && <span className="text-gray-400">...</span>}
                  </>
                )}
                
                {/* Show pages around current page */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentTransactionPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentTransactionPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentTransactionPage - 2 + i;
                  }
                  
                  const isActive = pageNum === currentTransactionPage;
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentTransactionPage(pageNum)}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        isActive
                          ? 'bg-white text-black'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                {/* Show last page if not in final range */}
                {currentTransactionPage < totalPages - 2 && totalPages > 5 && (
                  <>
                    {currentTransactionPage < totalPages - 3 && <span className="text-gray-400">...</span>}
                    <button
                      onClick={() => setCurrentTransactionPage(totalPages)}
                      className="px-3 py-1 text-sm rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>
              
              {/* Next Page Button */}
              <button
                onClick={() => setCurrentTransactionPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentTransactionPage === totalPages}
                className="px-3 py-1 text-sm rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Next Page"
              >
                »
              </button>
              
              {/* Last Page Button */}
              <button
                onClick={() => setCurrentTransactionPage(totalPages)}
                disabled={currentTransactionPage === totalPages}
                className="px-3 py-1 text-sm rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Last Page"
              >
                »»
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Helper function to format approval amounts
  const formatApprovalAmount = (valueFormatted: string): string => {
    if (valueFormatted === '1.157920892373162e+68' || valueFormatted === '1.157920892373162e+69') {
      return 'Unlimited';
    }
    
    const num = parseFloat(valueFormatted);
    if (isNaN(num)) return valueFormatted;
    
    // Format to 2 decimal places
    return num.toFixed(2);
  };

  const renderApprovals = () => {
    console.log('renderApprovals called - isLoadingApprovals:', isLoadingApprovals, 'approvalsError:', approvalsError, 'approvals.length:', approvals.length);
    
    if (isLoadingApprovals) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-400">Loading approvals...</div>
        </div>
      );
    }

    if (approvalsError) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-red-400 mb-4">{approvalsError}</p>
          <button
            onClick={() => fetchWalletApprovals(currentAddress)}
            className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    if (approvals.length === 0) {
      return (
        <div className="flex items-center justify-center py-8 text-gray-400">
          No approvals found
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="text-sm text-gray-400 mb-4">
          Found {approvals.length} approvals. Spender names are being loaded...
        </div>
        {approvals.map((approval, index) => (
          <div key={index} className="bg-slate-950 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
            <div className="flex items-center justify-between">
              {/* Token Info */}
              <div className="flex items-center gap-3">
                {approval.token.logo ? (
                  <img 
                    src={approval.token.logo} 
                    alt={approval.token.symbol}
                    className="w-10 h-10 rounded-full"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center ${approval.token.logo ? 'hidden' : ''}`}>
                  <span className="text-white font-bold text-sm">
                    {approval.token.symbol?.charAt(0) || '?'}
                  </span>
                </div>
                <div>
                  <div className="text-white font-medium">
                    {approval.token.name || 'Unknown Token'}
                  </div>
                  <div className="text-gray-400 text-sm">
                    {approval.token.symbol || 'Unknown'}
                  </div>
                </div>
              </div>

              {/* Allowance Info */}
              <div className="text-right">
                <div className="flex items-center justify-end gap-4">
                  <div className="text-white font-medium">
                    {formatApprovalAmount(approval.value_formatted)}
                  </div>
                  <div className="text-gray-400 text-sm">
                    {new Date(approval.block_timestamp).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-gray-400 text-sm mt-1">
                  {approval.token.verified_contract ? 'Verified' : 'Unverified'}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(approval.token.address)}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                  title="Copy token address"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => window.open(`https://scan.pulsechain.com/address/${approval.spender.address}`, '_blank')}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                  title="View spender on PulseScan"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Additional Details */}
            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Token Address:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-white font-mono text-xs">
                      {truncateAddress(approval.token.address)}
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(approval.token.address)}
                      className="p-1 text-gray-400 hover:text-white transition-colors"
                      title="Copy full address"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-gray-400">Spender Contract:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-white font-mono text-xs">
                      {truncateAddress(approval.spender.address)}
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(approval.spender.address)}
                      className="p-1 text-gray-400 hover:text-white transition-colors"
                      title="Copy full address"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  {spenderNames[approval.spender.address.toLowerCase()] && (
                    <div className="text-blue-400 text-xs mt-1 font-medium">
                      {spenderNames[approval.spender.address.toLowerCase()]}
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-gray-400">Transaction Hash:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-white font-mono text-xs">
                      {truncateAddress(approval.transaction_hash)}
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(approval.transaction_hash)}
                      className="p-1 text-gray-400 hover:text-white transition-colors"
                      title="Copy transaction hash"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
              {approval.token.usd_at_risk && (
                <div className="mt-2 pt-2 border-t border-gray-700">
                  <div className="text-sm">
                    <span className="text-gray-400">USD at Risk:</span>
                    <span className="text-red-400 ml-2">${parseFloat(approval.token.usd_at_risk).toFixed(6)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (isRabbyUI) {
    const sortedTokens = [...plsData.tokens].sort((a, b) => {
      const priceA = parseFloat(a.token.exchange_rate || '0');
      const amountA = parseFloat(a.value) / Math.pow(10, a.token.decimals || 18);
      const priceB = parseFloat(b.token.exchange_rate || '0');
      const amountB = parseFloat(b.value) / Math.pow(10, b.token.decimals || 18);
      return amountB * priceB - amountA * priceA;
    }).slice(0, 6);

    const topTransactions = transactions.slice(0, 5);
    const approvalsPreview = approvals.slice(0, 4);

    return (
      <>
        <div className="min-h-screen bg-[#eef2ff] text-[#0f172a]">
          <header className="bg-[#1c2cf8] px-4 py-6 text-white shadow-[0_24px_60px_rgba(28,44,248,0.35)]">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSearch();
                }}
                className="flex w-full flex-col gap-2 sm:flex-row sm:items-center"
              >
                <div className="relative flex-1">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Enter PulseChain address..."
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white placeholder-white/70 shadow-[0_8px_25px_rgba(15,23,42,0.25)] focus:border-white focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={loading || !address.trim()}
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#1c2cf8] shadow-[0_12px_25px_rgba(15,23,42,0.25)] transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/70"
                  >
                    {loading ? 'Loading...' : 'Search'}
                  </button>
                  {/* <button
                    type="button"
                    onClick={() => setShowSettingsDrawer(true)}
                    className="rounded-2xl border border-white/30 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    UI Settings
                  </button> */}
                </div>
              </form>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
            {!currentAddress ? (
              <div className="rounded-[32px] border border-white/60 bg-white/80 px-6 py-12 text-center shadow-[0_30px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:px-10">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-2xl">
                  👛
                </div>
                <h2 className="text-2xl font-bold text-[#0f172a] sm:text-3xl">Track Your PulseChain Portfolio</h2>
                <p className="mt-3 text-sm text-slate-500 sm:text-base">
                  Enter any PulseChain address to view real-time balances, transactions, approvals, and analytics in the
                  Rabby-inspired view.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                <section className="rounded-[32px] border border-white/50 bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.2)] sm:p-8">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-400">Portfolio Value</p>
                      <p className="mt-2 text-4xl font-black tracking-tight text-[#0f172a] sm:text-5xl">
                        {formatUSDValue(totalPortfolioValue)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500 sm:text-sm">
                        <span className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-600">
                          {plsData.tokenCount} Tokens
                        </span>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-600">
                          {transactions.length} Transactions
                        </span>
                        <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-600">
                          {approvals.length} Approvals
                        </span>
                      </div>
                    </div>
                    <div className="grid w-full gap-3 sm:grid-cols-3 lg:w-auto">
                      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm shadow">
                        <p className="text-xs uppercase tracking-wide text-indigo-400">Native Balance</p>
                        <p className="mt-1 text-lg font-semibold text-[#1c2cf8]">
                          {formatETHValue(plsData.nativeBalance)} PLS
                        </p>
                      </div>
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-sm shadow">
                        <p className="text-xs uppercase tracking-wide text-emerald-500">PLS Price</p>
                        <p className="mt-1 text-lg font-semibold text-emerald-600">
                          {plsPrice ? formatUSDValue(plsPrice) : '$0.00'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm shadow">
                        <p className="text-xs uppercase tracking-wide text-slate-500">Watching</p>
                        <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <code className="rounded-full bg-slate-100 px-3 py-1 font-mono text-xs">
                            {truncateAddress(currentAddress)}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(currentAddress)}
                            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold hover:bg-slate-50"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                  <div className="space-y-6">
                    <div className="rounded-3xl border border-white/60 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-[#0f172a]">Token Holdings</h3>
                        <span className="text-xs font-medium text-slate-500">
                          Showing {sortedTokens.length} of {plsData.tokenCount}
                        </span>
                      </div>
                      <div className="mt-4 divide-y divide-slate-100">
                        {sortedTokens.length > 0 ? (
                          sortedTokens.map((token, index) => {
                            const price = parseFloat(token.token.exchange_rate || '0');
                            const amount = parseFloat(token.value) / Math.pow(10, token.token.decimals || 18);
                            const usdValue = amount * price;
                            return (
                              <div
                                key={`${token.token.address}-${index}`}
                                className="flex items-center justify-between py-3"
                              >
                                <div>
                                  <p className="text-sm font-semibold text-[#0f172a]">
                                    {token.token.name || 'Unknown Token'}
                                    <span className="ml-2 text-xs font-medium text-slate-400">
                                      {token.token.symbol}
                                    </span>
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    {formatTokenValue(token.value, token.token.decimals)} {token.token.symbol}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-[#0f172a]">
                                    {formatUSDValue(usdValue)}
                                  </p>
                                  <p className="text-xs text-slate-400">${price.toFixed(6)} each</p>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="py-6 text-center text-sm text-slate-400">
                            No token balances detected for this address.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/60 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-[#0f172a]">Token Approvals</h3>
                        <span className="text-xs font-medium text-slate-500">Latest {approvalsPreview.length}</span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {approvalsPreview.length > 0 ? (
                          approvalsPreview.map((approval, index) => (
                            <div
                              key={`${approval.transaction_hash}-${index}`}
                              className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-[#0f172a]">
                                    {approval.token.name || approval.token.symbol || 'Token'}
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    Allowance: {formatApprovalAmount(approval.value_formatted)}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(approval.token.address)}
                                  className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold hover:bg-slate-100"
                                >
                                  Copy
                                </button>
                              </div>
                              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                                <span>{new Date(approval.block_timestamp).toLocaleDateString()}</span>
                                <a
                                  href={`https://scan.pulsechain.com/address/${approval.spender.address}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-indigo-600 hover:text-indigo-500"
                                >
                                  View Spender →
                                </a>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-6 text-center text-sm text-slate-400">
                            No approvals fetched for this wallet yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-3xl border border-white/60 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-[#0f172a]">Recent Transactions</h3>
                        <span className="text-xs font-medium text-slate-500">Last {topTransactions.length}</span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {topTransactions.length > 0 ? (
                          topTransactions.map((tx, index) => (
                            <div
                              key={`${tx.txHash}-${index}`}
                              className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                            >
                              <div className="flex items-center justify-between text-sm font-semibold text-[#0f172a]">
                                <span>{tx.type}</span>
                                <span>{formatUSDValue(tx.amount * tx.priceUsd)}</span>
                              </div>
                              <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                                <span>{formatDetailedTimeAgo(tx.timestamp)}</span>
                                <a
                                  href={`https://scan.pulsechain.com/tx/${tx.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-medium text-indigo-600 hover:text-indigo-500"
                                >
                                  View →
                                </a>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-6 text-center text-sm text-slate-400">
                            No recent transactions for this wallet.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/60 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-[#0f172a]">Holder Metrics</h3>
                        <div className="flex items-center gap-1 text-xs font-medium text-indigo-500">
                          {(['1', '7', '30', '90'] as const).map((tf) => (
                            <button
                              key={tf}
                              type="button"
                              onClick={async () => {
                                setHoldersTimeframe(tf);
                                const days = tf === '1' ? 1 : tf === '7' ? 7 : tf === '30' ? 30 : 90;
                                setHoldersStatsLoading(true);
                                try {
                                  const apiRes = await fetch(`/api/holders-metrics?address=${encodeURIComponent(apiTokenAddress)}&days=${days}`);
                                  if (apiRes.ok) {
                                    const data = await apiRes.json();
                                    if (data && typeof data.newHolders === 'number') {
                                      setHoldersStats({
                                        newHolders: data.newHolders,
                                        lostHolders: data.lostHolders,
                                        netChange: data.netChange,
                                      });
                                    }
                                  }
                                } catch (error) {
                                  console.error('Failed to load holders stats:', error);
                                } finally {
                                  setHoldersStatsLoading(false);
                                }
                              }}
                              className={`rounded-full px-2 py-1 ${holdersTimeframe === tf ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            >
                              {tf}d
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-5">
                        {holdersStatsLoading ? (
                          <div className="flex items-center justify-center py-4 text-sm text-slate-500">Loading…</div>
                        ) : holdersStats ? (
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-emerald-500">New</p>
                              <p className="mt-1 text-xl font-semibold text-[#0f172a]">
                                {holdersStats.newHolders.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-rose-500">Lost</p>
                              <p className="mt-1 text-xl font-semibold text-[#0f172a]">
                                {holdersStats.lostHolders.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-indigo-500">Net</p>
                              <p className="mt-1 text-xl font-semibold text-[#0f172a]">
                                {holdersStats.netChange.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center py-4 text-sm text-slate-500">
                            Select a timeframe to populate holder metrics.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </main>
        </div>
        {settingsDrawer}
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-gray-700 bg-slate-950/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white">
                Portfolio Tracker
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Enter PulseChain address..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10 w-80 bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-gray-500"
                />
              </div>
              <Button 
                onClick={handleSearch}
                disabled={loading || !address.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? 'Loading...' : 'Search'}
              </Button>
              {/* <Button
                type="button"
                onClick={() => setShowSettingsDrawer(true)}
                className="bg-gray-800 text-white hover:bg-gray-700"
              >
                UI Settings
              </Button> */}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-lg">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {!currentAddress ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Track Your Portfolio
            </h2>
            <p className="text-gray-400 mb-8">
              Enter any PulseChain address to view their token balances and portfolio value
            </p>
            <div className="flex justify-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Enter PulseChain address..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="pl-10 w-96 bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-gray-500"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Profile Section */}
            <Card className="bg-slate-950 border-gray-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl font-bold text-white">
                      Portfolio Overview
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="text-sm bg-gray-800 px-2 py-1 rounded text-gray-200">
                        {truncateAddress(currentAddress)}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(currentAddress)}
                        className="h-6 w-6 p-0"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-white">
                      {formatUSDValue(totalPortfolioValue)}
                    </p>
                    <p className="text-sm text-gray-400">
                      Total Portfolio Value
                    </p>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Chain Cards */}
            <div className="grid grid-cols-1 gap-6">
              {renderChainCard('PulseChain', plsData, 'PLS')}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="portfolio" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-white/10 border border-white/20">
                <TabsTrigger value="portfolio" className="flex items-center gap-2 text-white data-[state=active]:bg-white data-[state=active]:text-black">
                  <TrendingUp className="w-4 h-4" />
                  Portfolio
                </TabsTrigger>
                <TabsTrigger value="transactions" className="flex items-center gap-2 text-white data-[state=active]:bg-white data-[state=active]:text-black">
                  <DollarSign className="w-4 h-4" />
                  Transactions
                </TabsTrigger>
                <TabsTrigger value="approvals" className="flex items-center gap-2 text-white data-[state=active]:bg-white data-[state=active]:text-black">
                  <Shield className="w-4 h-4" />
                  Approvals
                </TabsTrigger>
              </TabsList>

              <TabsContent value="portfolio" className="space-y-6">
                <Card className="bg-slate-950 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold text-white">
                      PulseChain Tokens
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {plsData.tokens.length > 0 ? (
                      renderTokenTable(plsData.tokens, 'PulseChain')
                    ) : (
                      <p className="text-gray-400 text-center py-8">
                        No PulseChain tokens found
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="transactions" className="space-y-6">
                <Card className="bg-slate-950 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold text-white">
                      Transaction History
                    </CardTitle>
                    <p className="text-gray-400">
                      Recent swap transactions and token transfers for this wallet
                    </p>
                  </CardHeader>
                  <CardContent>
                    {renderTransactions()}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="approvals" className="space-y-6">
                <Card className="bg-slate-950 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold text-white">
                      Token Approvals
                    </CardTitle>
                    <p className="text-gray-400">
                      Current token approvals for this wallet address
                    </p>
                  </CardHeader>
                  <CardContent>
                    {renderApprovals()}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      </div>
      {settingsDrawer}
    </>
  );
};

export default PortfolioTracker;
