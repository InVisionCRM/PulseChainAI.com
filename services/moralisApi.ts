// Moralis API client for historical price data

export interface OHLCVCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OHLCVResponse {
  result: OHLCVCandle[];
  success: boolean;
  error?: string;
}

export class MoralisApiClient {
  private apiKey: string;
  private baseUrl = 'https://deep-index.moralis.io/api/v2.2';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.MORALIS_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('MORALIS_API_KEY is required');
    }
  }

  /**
   * Get OHLCV candlestick data for a token pair
   * @param pairAddress - The DEX pair address
   * @param chain - Chain ID in hex (e.g., "0x171" for PulseChain)
   * @param timeframe - Candlestick timeframe: "1m", "5m", "15m", "30m", "1h", "4h", "1d"
   * @param fromDate - Start date (ISO 8601 or timestamp)
   * @param toDate - End date (ISO 8601 or timestamp)
   */
  async getOHLCV(
    pairAddress: string,
    chain: string = '0x171', // PulseChain
    timeframe: string = '1h',
    fromDate?: string | number,
    toDate?: string | number
  ): Promise<OHLCVResponse> {
    try {
      const params = new URLSearchParams({
        chain,
        timeframe,
      });

      // Moralis requires fromDate and toDate, not from_date/to_date
      if (fromDate) {
        const dateStr = typeof fromDate === 'number'
          ? Math.floor(fromDate / 1000).toString() // Convert to Unix timestamp in seconds
          : fromDate;
        params.append('fromDate', dateStr);
      }
      if (toDate) {
        const dateStr = typeof toDate === 'number'
          ? Math.floor(toDate / 1000).toString() // Convert to Unix timestamp in seconds
          : toDate;
        params.append('toDate', dateStr);
      }

      const url = `${this.baseUrl}/pairs/${pairAddress}/ohlcv?${params.toString()}`;

      console.log('Fetching OHLCV from Moralis:', url);

      const response = await fetch(url, {
        headers: {
          'X-API-Key': this.apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Moralis API error:', response.status, errorText);
        throw new Error(`Moralis API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Transform Moralis response to our format
      const candles: OHLCVCandle[] = (data.result || data).map((candle: any) => ({
        timestamp: new Date(candle.timestamp || candle.time).getTime(),
        open: parseFloat(candle.open || candle.o),
        high: parseFloat(candle.high || candle.h),
        low: parseFloat(candle.low || candle.l),
        close: parseFloat(candle.close || candle.c),
        volume: parseFloat(candle.volume || candle.v || 0),
      }));

      return {
        result: candles,
        success: true,
      };
    } catch (error) {
      console.error('Moralis OHLCV fetch error:', error);
      return {
        result: [],
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get simplified price history for chart display
   * Returns array of {timestamp, value} points
   */
  async getPriceHistory(
    pairAddress: string,
    chain: string = '0x171',
    timeRange: '1H' | '1D' | '1W' | '1M' | '1Y' | 'ALL'
  ): Promise<{ timestamp: number; value: number; volume?: number }[]> {
    const now = Date.now();
    let timeframe: string;
    let fromDate: number;

    // Map time ranges to Moralis timeframes
    switch (timeRange) {
      case '1H':
        timeframe = '1m'; // 1-minute candles
        fromDate = now - (60 * 60 * 1000); // 1 hour ago
        break;
      case '1D':
        timeframe = '5m'; // 5-minute candles
        fromDate = now - (24 * 60 * 60 * 1000); // 24 hours ago
        break;
      case '1W':
        timeframe = '30m'; // 30-minute candles
        fromDate = now - (7 * 24 * 60 * 60 * 1000); // 7 days ago
        break;
      case '1M':
        timeframe = '1h'; // 1-hour candles
        fromDate = now - (30 * 24 * 60 * 60 * 1000); // 30 days ago
        break;
      case '1Y':
        timeframe = '1d'; // 1-day candles
        fromDate = now - (365 * 24 * 60 * 60 * 1000); // 365 days ago
        break;
      case 'ALL':
        timeframe = '1d'; // 1-day candles
        fromDate = now - (730 * 24 * 60 * 60 * 1000); // 2 years ago
        break;
      default:
        timeframe = '1h';
        fromDate = now - (24 * 60 * 60 * 1000);
    }

    const response = await this.getOHLCV(pairAddress, chain, timeframe, fromDate, now);

    if (!response.success || !response.result || response.result.length === 0) {
      return [];
    }

    // Convert OHLCV candles to simple price points (using close price)
    return response.result.map(candle => ({
      timestamp: candle.timestamp,
      value: candle.close,
      volume: candle.volume,
    }));
  }
}

// Export singleton instance
export const moralisApi = new MoralisApiClient();
