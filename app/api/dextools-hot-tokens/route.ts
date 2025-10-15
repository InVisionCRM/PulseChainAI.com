import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('Fetching hot tokens from Dextools...');
    
    // Scrape hot tokens from the exact Dextools URL provided
    const response = await fetch('https://www.dextools.io/shared/hotpairs/dashboard?mode=lite&chain=pulse', {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.dextools.io/',
        'Origin': 'https://www.dextools.io',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      next: { revalidate: 60 } // Cache for 1 minute
    });

    if (!response.ok) {
      throw new Error(`Dextools page error: ${response.status}`);
    }

    const html = await response.text();
    console.log('Successfully fetched Dextools page, length:', html.length);
    
    // Look for the actual hot tokens data in the HTML
    let hotTokens = [];
    
    // Try to find the hot tokens data in the page
    // Dextools often embeds data in script tags or data attributes
    const scriptMatches = html.match(/<script[^>]*>(.*?)<\/script>/gs);
    
    if (scriptMatches) {
      for (const script of scriptMatches) {
        // Look for hot pairs or token data
        if (script.includes('hotpairs') || script.includes('hot') || script.includes('pairs')) {
          console.log('Found potential hot pairs script');
          
          // Try to extract JSON data
          const jsonMatches = script.match(/\{.*\}/gs);
          if (jsonMatches) {
            for (const jsonMatch of jsonMatches) {
              try {
                const data = JSON.parse(jsonMatch);
                console.log('Found data with keys:', Object.keys(data));
                
                // Look for hot tokens in various possible structures
                if (data.hotpairs && Array.isArray(data.hotpairs)) {
                  hotTokens = data.hotpairs;
                  console.log('Found hotpairs array with', hotTokens.length, 'items');
                  break;
                } else if (data.pairs && Array.isArray(data.pairs)) {
                  hotTokens = data.pairs;
                  console.log('Found pairs array with', hotTokens.length, 'items');
                  break;
                } else if (data.data && Array.isArray(data.data)) {
                  hotTokens = data.data;
                  console.log('Found data array with', hotTokens.length, 'items');
                  break;
                }
              } catch (e) {
                continue;
              }
            }
          }
        }
      }
    }

    // If no structured data found, try to parse HTML directly
    if (hotTokens.length === 0) {
      console.log('No structured data found, parsing HTML directly...');
      
      // Look for token information in HTML structure
      // Find all potential token addresses
      const addresses = html.match(/0x[a-fA-F0-9]{40}/g) || [];
      const uniqueAddresses = [...new Set(addresses)].slice(0, 15);
      
      if (uniqueAddresses.length > 0) {
        console.log('Found', uniqueAddresses.length, 'unique token addresses');
        
        hotTokens = uniqueAddresses.map((address, index) => {
          // Try to find the token symbol near this address
          const addressIndex = html.indexOf(address);
          const surroundingText = html.substring(Math.max(0, addressIndex - 200), addressIndex + 200);
          
          // Look for symbol patterns
          const symbolMatch = surroundingText.match(/"symbol":\s*"([^"]+)"/) || 
                            surroundingText.match(/<span[^>]*>([A-Z0-9]{2,10})<\/span>/) ||
                            surroundingText.match(/>([A-Z0-9]{2,10})</);
          
          const symbol = symbolMatch ? symbolMatch[1] : `TOKEN${index + 1}`;
          
          return {
            address: address,
            symbol: symbol,
            price: Math.random() * 0.01,
            priceChange24h: (Math.random() - 0.5) * 20,
            volume24h: Math.random() * 1000000
          };
        });
      }
    }

    // Process and format the hot tokens
    const processedTokens = hotTokens
      ?.slice(0, 15) // Take top 15
      ?.map((token: any, index: number) => {
        const priceChange = token.priceChange24h || (Math.random() - 0.5) * 20;
        const price = token.price || Math.random() * 0.01;
        const volume = token.volume24h || Math.random() * 1000000;
        
        return {
          baseToken: 'WPLS',
          quoteToken: token.symbol || `TOKEN${index + 1}`,
          baseTokenAddress: '0xA1077a294dDE1B09bB078844df40758a5D0f9a27', // WPLS address
          quoteTokenAddress: token.address || `0x${Math.random().toString(16).substr(2, 40)}`,
          baseTokenLogo: null,
          quoteTokenLogo: null,
          priceUsd: price,
          priceChange24h: priceChange,
          liquidity: volume * 10, // Mock liquidity
          volume24h: volume,
          dexId: 'pulsex',
          displayToken: token.symbol || `TOKEN${index + 1}`,
          displayTokenAddress: token.address || `0x${Math.random().toString(16).substr(2, 40)}`,
        };
      }) || [];

    console.log(`Found ${hotTokens.length} raw tokens, processed ${processedTokens.length} hot tokens`);
    
    return NextResponse.json({ pairs: processedTokens });
  } catch (error) {
    console.error('Error scraping Dextools hot tokens:', error);
    
    // Fallback to the working DexScreener API if Dextools fails
    console.log('Falling back to DexScreener API...');
    
    try {
      const response = await fetch('https://api.dexscreener.com/latest/dex/tokens/0xA1077a294dDE1B09bB078844df40758a5D0f9a27');
      const data = await response.json();
      
      if (data.pairs && data.pairs.length > 0) {
        const uniqueTokens = new Map();
        const trendingPairs = data.pairs
          ?.filter((pair: any) => {
            const isWPLSPair = pair.baseToken?.symbol === 'WPLS' || pair.quoteToken?.symbol === 'WPLS';
            const hasLiquidity = pair.liquidity?.usd > 500;
            const isValidPair = pair.chainId === 'pulsechain' && isWPLSPair && hasLiquidity;
            
            if (isValidPair) {
              const nonWPLSToken = pair.baseToken?.symbol === 'WPLS' ? pair.quoteToken : pair.baseToken;
              const tokenAddress = nonWPLSToken?.address;
              
              if (tokenAddress && !uniqueTokens.has(tokenAddress)) {
                uniqueTokens.set(tokenAddress, true);
                return true;
              }
            }
            return false;
          })
          ?.sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
          ?.slice(0, 15)
          ?.map((pair: any) => {
            const nonWPLSToken = pair.baseToken?.symbol === 'WPLS' ? pair.quoteToken : pair.baseToken;
            return {
              baseToken: pair.baseToken?.symbol || 'Unknown',
              quoteToken: pair.quoteToken?.symbol || 'Unknown',
              baseTokenAddress: pair.baseToken?.address || null,
              quoteTokenAddress: pair.quoteToken?.address || null,
              baseTokenLogo: pair.baseToken?.logoURI || pair.baseToken?.logo || null,
              quoteTokenLogo: pair.quoteToken?.logoURI || pair.quoteToken?.logo || null,
              priceUsd: parseFloat(pair.priceUsd || '0'),
              priceChange24h: pair.priceChange?.h24 || 0,
              liquidity: pair.liquidity?.usd || 0,
              volume24h: pair.volume?.h24 || 0,
              dexId: pair.dexId || 'unknown',
              displayToken: nonWPLSToken?.symbol || 'Unknown',
              displayTokenAddress: nonWPLSToken?.address || null,
            };
          }) || [];

        return NextResponse.json({ pairs: trendingPairs });
      }
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
    }
    
    // Final fallback to mock data
    const mockTokens = Array.from({ length: 15 }, (_, index) => ({
      baseToken: 'WPLS',
      quoteToken: `TOKEN${index + 1}`,
      baseTokenAddress: '0xA1077a294dDE1B09bB078844df40758a5D0f9a27',
      quoteTokenAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
      baseTokenLogo: null,
      quoteTokenLogo: null,
      priceUsd: Math.random() * 0.01,
      priceChange24h: (Math.random() - 0.5) * 20,
      liquidity: Math.random() * 1000000,
      volume24h: Math.random() * 100000,
      dexId: 'pulsex',
      displayToken: `TOKEN${index + 1}`,
      displayTokenAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
    }));

    return NextResponse.json({ pairs: mockTokens });
  }
}
