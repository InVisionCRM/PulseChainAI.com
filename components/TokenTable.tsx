'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { parseCSV, TokenData } from '@/lib/csvParser';

// Priority tokens that should always appear at the top
const PRIORITY_TOKENS = [
  '0xB7d4eB5fDfE3d4d3B5C16a44A49948c6EC77c6F1', // #1 - GOLD badge
  '0xB5C4ecEF450fd36d0eBa1420F6A19DBfBeE5292e', // #2 - GOLD badge
  '0x31Ac295D593877bb77c3fCc19Fbbcea9c4f1c50A', // #3
  '0x33779a40987F729a7DF6cc08B1dAD1a21b58A220', // #4
  '0x9deeaF046e144Fb6304A5ACD2aF142bBfE958030', // #5
  '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39', // #6
  '0xA1077a294dDE1B09bB078844df40758a5D0f9a27', // #7
  '0x2fa878Ab3F87CC1C9737Fc071108F904c0B0C95d', // #8
  '0xc10A4Ed9b4042222d69ff0B374eddd47ed90fC1F', // #9
  '0xC70CF25DFCf5c5e9757002106C096ab72fab299E'  // #10
];

const parseVolumeString = (volumeStr: string): number => {
  // Remove $ and parse multipliers
  const cleanStr = volumeStr.replace('$', '');
  if (cleanStr.includes('M')) {
    return parseFloat(cleanStr.replace('M', '')) * 1000000;
  } else if (cleanStr.includes('K')) {
    return parseFloat(cleanStr.replace('K', '')) * 1000;
  } else {
    return parseFloat(cleanStr) || 0;
  }
};

const parseFormattedVolume = (formattedVolume: string): number => {
  // Parse already formatted volume strings like "$1.15K", "$10.5M"
  return parseVolumeString(formattedVolume);
};

const parseFormattedLiquidity = (formattedLiquidity: string): number => {
  // Parse already formatted liquidity strings
  return parseFloat(formattedLiquidity.replace(/[$,]/g, '')) || 0;
};

const formatVolume = (volume: number): string => {
  if (volume >= 1000000) {
    return `$${((volume / 1000000)).toFixed(2)}M`;
  } else if (volume >= 1000) {
    return `$${((volume / 1000)).toFixed(2)}K`;
  } else {
    return `$${Math.floor(volume)}`;
  }
};

const formatPrice = (price: number): string => {
  if (price === 0) return '$0';

  // For very small prices (< 0.0001), use superscript zero-count format
  if (price < 0.0001) {
    const str = price.toString();
    const decimalIndex = str.indexOf('.');

    if (decimalIndex === -1) return `$${price.toFixed(2)}`;

    // Count zeros after decimal point
    let zeroCount = 0;
    let firstNonZeroIndex = -1;

    for (let i = decimalIndex + 1; i < str.length; i++) {
      if (str[i] === '0') {
        zeroCount++;
      } else {
        firstNonZeroIndex = i;
        break;
      }
    }

    if (firstNonZeroIndex === -1 || zeroCount === 0) {
      return `$${price.toExponential(2)}`;
    }

    // Get first 3 significant digits
    const significantDigits = str.substring(firstNonZeroIndex, firstNonZeroIndex + 3);

    // Convert zero count to superscript
    const superscriptZeros = zeroCount.toString().split('').map(digit => {
      const superscripts = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
      return superscripts[digit] || digit;
    }).join('');

    return `$0.0${superscriptZeros}${significantDigits}`;
  }

  // For small prices (< 0.01), show more decimals
  if (price < 0.01) {
    return `$${price.toFixed(6)}`;
  }

  // For normal prices, show 4 decimals
  if (price < 1) {
    return `$${price.toFixed(4)}`;
  }

  // For prices >= 1, show 2 decimals
  return `$${price.toFixed(2)}`;
};

const fetchTokenSocials = async (pairAddress: string): Promise<{ socials: Array<{ type: string; url: string }>, tokenAddress: string }> => {
  try {
    // Add timeout and better error handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(`https://api.dexscreener.com/latest/dex/pairs/pulsechain/${pairAddress}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Silently fail for API errors to avoid console spam
      return { socials: [], tokenAddress: '' };
    }

    const data = await response.json();

    if (!data.pair) return { socials: [], tokenAddress: '' };

    const socials: Array<{ type: string; url: string }> = [];

    // Extract social links from pair info
    if (data.pair.info?.socials) {
      socials.push(...data.pair.info.socials);
    }

    // Extract from token links
    const baseToken = data.pair.baseToken;
    const quoteToken = data.pair.quoteToken;

    [baseToken, quoteToken].forEach(token => {
      if (token?.links) {
        if (token.links.twitter) {
          socials.push({ type: 'twitter', url: token.links.twitter });
        }
        if (token.links.telegram) {
          socials.push({ type: 'telegram', url: token.links.telegram });
        }
      }
    });

    // Remove duplicates
    const uniqueSocials = socials.filter((social, index, self) =>
      index === self.findIndex(s => s.url === social.url)
    );

    return {
      socials: uniqueSocials,
      tokenAddress: baseToken?.address || ''
    };
  } catch (error) {
    // Silently fail to avoid console spam, but allow the table to load
    return { socials: [], tokenAddress: '' };
  }
};

export default function TokenTable() {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState('volume');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const getSortIcon = (field: string) => {
    if (sortBy !== field) return null;
    return sortOrder === 'desc' ? '↓' : '↑';
  };

  useEffect(() => {
    fetchTokenData();
  }, []);


  const fetchPriorityTokenData = async (contractAddress: string, index: number): Promise<TokenData | null> => {
    try {
      // Search for the token on DexScreener
      const searchResponse = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${contractAddress}`);
      const searchData = await searchResponse.json();

      // Find PulseChain pairs that include WPLS
      const wplsPairs = searchData.pairs?.filter((pair: any) => {
        if (pair.chainId !== 'pulsechain') return false;

        const token0Address = pair.baseToken?.address?.toLowerCase();
        const token1Address = pair.quoteToken?.address?.toLowerCase();
        const wplsAddr = '0xA1077a294dDE1B09bB078844df40758a5D0f9a27'.toLowerCase();

        // Check if this pair includes WPLS and matches our target token
        const hasWPLS = token0Address === wplsAddr || token1Address === wplsAddr;
        if (!hasWPLS) return false;

        // Check if the other token matches our search
        const targetAddr = contractAddress.toLowerCase();
        return token0Address === targetAddr || token1Address === targetAddr;
      }) || [];

      if (wplsPairs.length === 0) return null;

      // Take the pair with highest liquidity
      const bestPair = wplsPairs.sort((a: any, b: any) =>
        (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      )[0];

      // Determine which token is not WPLS
      const token0Address = bestPair.baseToken?.address?.toLowerCase();
      const isToken0WPLS = token0Address === '0xA1077a294dDE1B09bB078844df40758a5D0f9a27'.toLowerCase();
      const targetToken = isToken0WPLS ? bestPair.quoteToken : bestPair.baseToken;

      // Fetch socials for priority tokens
      const { socials } = await fetchTokenSocials(bestPair.pairAddress);

      return {
        rank: 0, // Will be set by position in priority list
        dexIcon: 'https://dd.dexscreener.com/ds-data/dexes/pulsex.png',
        tokenIcon: bestPair.info?.imageUrl || targetToken?.logoURI || '',
        symbol: targetToken.symbol,
        name: targetToken.name,
        price: formatPrice(parseFloat(bestPair.priceUsd || '0')),
        txns: bestPair.txns?.h24 ? (bestPair.txns.h24.buys + bestPair.txns.h24.sells).toString() : '0',
        volume: formatVolume(bestPair.volume?.h24 || 0),
        liquidity: formatVolume(bestPair.liquidity?.usd || 0),
        priceChange24h: bestPair.priceChange?.h24 ? `${bestPair.priceChange.h24.toFixed(2)}%` : '',
        fdv: bestPair.fdv ? `$${(bestPair.fdv / 1000000).toFixed(1)}M` : '',
        pairAddress: bestPair.pairAddress,
        dexName: 'PulseChain',
        socials
      };
    } catch (error) {
      console.error(`Failed to fetch priority token ${contractAddress}:`, error);
      return null;
    }
  };

  const fetchTokenData = async () => {
    try {
      setRefreshing(true);

      // First, fetch priority tokens
      const priorityPromises = PRIORITY_TOKENS.map(async (address, index) => {
        const data = await fetchPriorityTokenData(address, index);
        return data ? { ...data, rank: index + 1 } : null;
      });

      const priorityTokens = (await Promise.all(priorityPromises)).filter(Boolean) as TokenData[];

      // Then read the CSV from the public directory
      const response = await fetch('/dexscreener.csv');
      const csvText = await response.text();

      // Parse CSV and transform to TokenData[]
      const parsedTokens = parseCSV(csvText);

      // Filter out priority tokens from CSV data to avoid duplicates
      const priorityAddresses = new Set(priorityTokens.map(p => p.pairAddress));
      const filteredCsvTokens = parsedTokens.filter(token => !priorityAddresses.has(token.pairAddress));

      // Fetch socials and format volume/liquidity for all CSV tokens
      const csvTokensWithSocials = await Promise.all(
        filteredCsvTokens.map(async (token, index) => {
          const { socials, tokenAddress } = await fetchTokenSocials(token.pairAddress);
          const volumeValue = parseVolumeString(token.volume);
          const liquidityValue = parseFloat(token.liquidity.replace(/[$,]/g, '')) || 0;
          const priceValue = parseFloat(token.price.replace(/[$,]/g, '')) || 0;
          return {
            ...token,
            rank: index + 11, // Start ranking from 11 for CSV tokens
            socials,
            tokenAddress,
            volume: formatVolume(volumeValue),
            liquidity: formatVolume(liquidityValue),
            price: formatPrice(priceValue)
          };
        })
      );

      // Sort only the CSV tokens, keep priority tokens in their original order at the top
      const sortedCsvTokens = sortTokens(csvTokensWithSocials, sortBy, sortOrder);

      // Combine priority tokens (unsorted, in order) with sorted CSV tokens
      const allTokens = [...priorityTokens, ...sortedCsvTokens];

      setTokens(allTokens);
    } catch (error) {
      console.error('Failed to load token data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const sortTokens = (tokens: TokenData[], field: string, order: 'asc' | 'desc') => {
    return [...tokens].sort((a, b) => {
      let aVal: any, bVal: any;

      switch (field) {
        case 'price':
          aVal = parsePriceString(a.price);
          bVal = parsePriceString(b.price);
          break;
        case 'volume':
          aVal = parseFormattedVolume(a.volume);
          bVal = parseFormattedVolume(b.volume);
          break;
        case 'liquidity':
          aVal = parseFormattedLiquidity(a.liquidity);
          bVal = parseFormattedLiquidity(b.liquidity);
          break;
        case 'priceChange24h':
          aVal = parseFloat(a.priceChange24h.replace('%', '')) || 0;
          bVal = parseFloat(b.priceChange24h.replace('%', '')) || 0;
          break;
        default:
          return 0;
      }

      return order === 'desc' ? bVal - aVal : aVal - bVal;
    });
  };

  const handleSort = (field: string) => {
    const newOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortBy(field);
    setSortOrder(newOrder);

    // Separate priority tokens from regular tokens
    const priorityTokens = tokens.filter(token => token.rank <= 10);
    const regularTokens = tokens.filter(token => token.rank > 10);

    // Sort only the regular tokens
    const sortedRegularTokens = sortTokens(regularTokens, field, newOrder);

    // Combine priority tokens (in order) with sorted regular tokens
    setTokens([...priorityTokens, ...sortedRegularTokens]);
  };

  if (loading) {
    return (
      <div className="w-full mx-auto px-1 py-1">
        <div className="bg-black border border-b-white/40 p-1">
          <div className="flex justify-center items-center py-1">
            <div className="text-white text-sm">Loading tokens...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-1 py-1">
      <div className="bg-black rounded-lg overflow-hidden">
        <div className="px-1 py-1 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-md font-poppins text-white">Top PulseChain Tokens</h2>
          <button
            onClick={fetchTokenData}
            disabled={refreshing}
            className="flex items-center gap-1 px-1 py-1 text-xs bg-white/5 hover:bg-white/10 rounded text-white/70 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="max-h-[95vh] overflow-auto">
          <table className="w-full text-xs table-fixed">
            <thead className="bg-black/90 sticky top-0">
              <tr className="text-xs text-white/80 uppercase tracking-wider">
                <th className="w-[200px] px-1 py-1 text-center justify-center font-medium">Token</th>
                <th className="w-[90px] px-1 py-1 text-center justify-center font-medium cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('price')}>
                  Price {getSortIcon('price')}
                </th>
                <th className="w-[60px] px-1 py-1 text-center justify-center font-medium cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('priceChange24h')}>
                  24h {getSortIcon('priceChange24h')}
                </th>
                <th className="w-[70px] px-1 py-1 text-center justify-center font-medium cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('volume')}>
                  Volume {getSortIcon('volume')}
                </th>
                <th className="w-[80px] px-1 py-1 text-center justify-center font-medium cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('liquidity')}>
                  Liq {getSortIcon('liquidity')}
                </th>
                <th className="w-[50px] px-1 py-1 text-center justify-center font-medium">Links</th>
                <th className="w-[120px] px-1 py-1 text-center justify-center font-medium">Pair</th>
                <th className="w-[120px] px-1 py-1 text-center justify-center font-medium">Token</th>
                <th className="w-[275px] px-1 py-1 text-center justify-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20">
              {tokens.map((token) => (
                <tr key={token.pairAddress} className={`hover:bg-white/5 transition-colors ${token.rank <= 2 ? 'border border-yellow-500/50 bg-yellow-500/5' : ''}`}>
                  <td className="px-1 py-1">
                    <div className="flex items-center gap-1 overflow-hidden">
                      {token.rank <= 5 && (
                        <div className="relative group flex-shrink-0">
                          <span className="px-1 py-0.5 text-[8px] font-bold bg-yellow-500 text-black rounded-sm border border-yellow-400 cursor-help">
                            GOLD
                          </span>
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                            GOLD Badges are given to projects that have sponsored with Morbius.io.{' '}
                            <a
                              href="https://morbius.io"
                              className="text-blue-500 underline hover:text-blue-600"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Join Today!
                            </a>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <img src={token.dexIcon} alt="DEX" className="w-3 h-3 opacity-60" />
                        <img src={token.tokenIcon} alt={token.symbol} className="w-4 h-4 rounded-full" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/geicko?address=${token.pairAddress}&tab=chart`}
                          className="font-medium text-white text-xs truncate hover:text-blue-400 transition-colors"
                        >
                          {token.symbol}
                        </Link>
                        <div className="text-[9px] text-white/50 truncate">{token.name}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-1 py-1 text-center justify-center font-mono text-white text-xs truncate">{token.price}</td>

                  <td className="px-1 py-1 text-center justify-center">
                    <PriceChange value={token.priceChange24h} />
                  </td>

                  <td className="px-1 py-1 text-center justify-center font-mono text-white/80 text-xs truncate">{token.volume}</td>
                  <td className="px-1 py-1 text-center justify-center font-mono text-white/80 text-xs truncate">{token.liquidity}</td>

                  <td className="px-1 py-1 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {token.socials && token.socials.length > 0 ? (
                        token.socials.slice(0, 2).map((social, idx) => (
                          <a
                            key={idx}
                            href={social.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white/60 hover:text-blue-400 transition-colors"
                          >
                            {social.type === 'twitter' && <TwitterIcon />}
                            {social.type === 'telegram' && <TelegramIcon />}
                            {!social.type && <LinkIcon />}
                          </a>
                        ))
                      ) : (
                        <span className="text-white/30 text-xs">-</span>
                      )}
                    </div>
                  </td>

                  <td className="px-1 py-1 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => navigator.clipboard.writeText(token.pairAddress)}
                        className="text-white/60 hover:text-white transition-colors"
                        title="Copy pair address"
                      >
                        <CopyIcon />
                      </button>
                      <span className="text-xs font-mono text-white/80">
                        {token.pairAddress.slice(0, 4)}...{token.pairAddress.slice(-4)}
                      </span>
                    </div>
                  </td>

                  <td className="px-1 py-1 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => navigator.clipboard.writeText(token.tokenAddress || token.pairAddress)}
                        className="text-white/60 hover:text-white transition-colors"
                        title="Copy token address"
                      >
                        <CopyIcon />
                      </button>
                      <span className="text-xs font-mono text-white/80">
                        {(token.tokenAddress || token.pairAddress).slice(0, 4)}...{(token.tokenAddress || token.pairAddress).slice(-4)}
                      </span>
                    </div>
                  </td>

                  <td className="px-1 py-1">
                    <div className="grid grid-cols-3 gap-1">
                      <a
                        href={`/geicko?address=${token.pairAddress}&tab=chart`}
                        className="px-1 py-1 text-xs hover:bg-blue-600/40 text-white underline rounded transition-colors text-center justify-center"
                      >
                        Chart
                      </a>
                      <a
                        href={`/geicko?address=${token.pairAddress}&tab=holders`}
                        className="px-1 py-1 text-xs hover:bg-green-600/40 text-white underline rounded transition-colors text-center justify-center"
                      >
                        Holders
                      </a>
                      <a
                        href={`/geicko?address=${token.pairAddress}&tab=liquidity`}
                        className="px-1 py-1 text-xs hover:bg-purple-600/40 text-white underline rounded transition-colors text-center justify-center"
                      >
                        Liquidity
                      </a>
                      <a
                        href={`/geicko?address=${token.pairAddress}&tab=contract`}
                        className="px-1 py-1 text-xs hover:bg-orange-600/40 text-white underline rounded transition-colors text-center justify-center"
                      >
                        Code
                      </a>
                      <a
                        href={`/geicko?address=${token.pairAddress}&tab=switch`}
                        className="px-1 py-1 text-xs hover:bg-cyan-600/40 text-white underline rounded transition-colors text-center justify-center"
                      >
                        Swap
                      </a>
                      <a
                        href={`/geicko?address=${token.pairAddress}&tab=stats`}
                        className="px-1 py-1 text-xs hover:bg-pink-600/40 text-white underline rounded transition-colors text-center justify-center"
                      >
                        Stats
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PriceChange({ value }: { value: string }) {
  if (!value || value === '' || value === '""') return <span className="text-white/30 text-xs">-</span>;

  const cleanValue = value.replace(/"/g, '');
  if (cleanValue === '') return <span className="text-white/30 text-xs">-</span>;

  const isPositive = !cleanValue.startsWith('-');
  const colorClass = isPositive ? 'text-green-400' : 'text-red-400';

  return (
    <span className={`flex items-center justify-end gap-1 ${colorClass} text-xs`}>
      {isPositive ? <ArrowUp className="w-2 h-2" /> : <ArrowDown className="w-2 h-2" />}
      <span>{cleanValue}</span>
    </span>
  );
}

const TwitterIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const TelegramIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 0 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

const LinkIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);

const CopyIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);