// CoinGecko API client for comprehensive token profile data

import type { ApiResponse } from '../core/types';

export interface CoinGeckoTokenInfo {
  id: string;
  symbol: string;
  name: string;
  web_slug: string;
  asset_platform_id: string;
  platforms: Record<string, string>;
  detail_platforms: Record<string, {
    decimal_place: number | null;
    contract_address: string;
  }>;
  block_time_in_minutes: number;
  hashing_algorithm: string | null;
  categories: string[];
  preview_listing: boolean;
  public_notice: string | null;
  additional_notices: string[];
  localization: Record<string, string>;
  description: Record<string, string>;
  links: {
    homepage: string[];
    whitepaper: string[];
    blockchain_site: string[];
    official_forum_url: string[];
    chat_url: string[];
    announcement_url: string[];
    snapshot_url: string | null;
    twitter_screen_name: string | null;
    facebook_username: string | null;
    bitcointalk_thread_identifier: string | null;
    telegram_channel_identifier: string | null;
    subreddit_url: string | null;
    repos_url: {
      github: string[];
      bitbucket: string[];
    };
  };
  image: {
    thumb: string;
    small: string;
    large: string;
  };
  country_origin: string | null;
  genesis_date: string | null;
  sentiment_votes_up_percentage: number;
  sentiment_votes_down_percentage: number;
  watchlist_portfolio_users: number;
  market_cap_rank: number;
  market_data: {
    current_price: Record<string, number>;
    total_value_locked: number | null;
    mcap_to_tvl_ratio: number | null;
    fdv_to_tvl_ratio: number | null;
    roi: number | null;
    ath: Record<string, number>;
    ath_change_percentage: Record<string, number>;
    ath_date: Record<string, string>;
    atl: Record<string, number>;
    atl_change_percentage: Record<string, number>;
    atl_date: Record<string, string>;
    market_cap: Record<string, number>;
    market_cap_rank: number;
    fully_diluted_valuation: Record<string, number>;
    market_cap_fdv_ratio: number;
    total_volume: Record<string, number>;
    high_24h: Record<string, number>;
    low_24h: Record<string, number>;
    price_change_24h: number;
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_14d: number;
    price_change_percentage_30d: number;
    price_change_percentage_60d: number;
    price_change_percentage_200d: number;
    price_change_percentage_1y: number;
    market_cap_change_24h: number;
    market_cap_change_percentage_24h: number;
    price_change_percentage_1h_in_currency: Record<string, number>;
    price_change_percentage_24h_in_currency: Record<string, number>;
    price_change_percentage_7d_in_currency: Record<string, number>;
    price_change_percentage_14d_in_currency: Record<string, number>;
    price_change_percentage_30d_in_currency: Record<string, number>;
    price_change_percentage_60d_in_currency: Record<string, number>;
    price_change_percentage_200d_in_currency: Record<string, number>;
    price_change_percentage_1y_in_currency: Record<string, number>;
    market_cap_change_24h_in_currency: Record<string, number>;
    market_cap_change_percentage_24h_in_currency: Record<string, number>;
    total_supply: number;
    max_supply: number | null;
    circulating_supply: number;
    last_updated: string;
  };
  community_data: {
    facebook_likes: number | null;
    reddit_average_posts_48h: number;
    reddit_average_comments_48h: number;
    reddit_subscribers: number;
    reddit_accounts_active_48h: number;
    telegram_channel_user_count: number | null;
  };
  developer_data: {
    forks: number;
    stars: number;
    subscribers: number;
    total_issues: number;
    closed_issues: number;
    pull_requests_merged: number;
    pull_request_contributors: number;
    code_additions_deletions_4_weeks: {
      additions: number;
      deletions: number;
    };
    commit_count_4_weeks: number;
    last_4_weeks_commit_activity_series: number[];
  };
  status_updates: string[];
  last_updated: string;
  tickers: Array<{
    base: string;
    target: string;
    market: {
      name: string;
      identifier: string;
      has_trading_incentive: boolean;
    };
    last: number;
    volume: number;
    converted_last: Record<string, number>;
    converted_volume: Record<string, number>;
    trust_score: string;
    bid_ask_spread_percentage: number;
    timestamp: string;
    last_traded_at: string;
    last_fetch_at: string;
    is_anomaly: boolean;
    is_stale: boolean;
    trade_url: string | null;
    token_info_url: string | null;
    coin_id: string;
    target_coin_id: string;
  }>;
}

export class CoinGeckoApiClient {
  private baseUrl: string;
  private apiKey: string | undefined;

  constructor() {
    this.baseUrl = 'https://pro-api.coingecko.com/api/v3';
    this.apiKey = process.env.COINGECKO_API_KEY;
  }

  // Get comprehensive token profile information using the new endpoint
  async getTokenProfile(address: string, network: string = 'ethereum'): Promise<ApiResponse<CoinGeckoTokenInfo>> {
    try {
      // First try to get asset platforms to find the correct network ID
      const platforms = await this.getAssetPlatforms();
      if (!platforms.success) {
        return { success: false, error: 'Failed to fetch asset platforms' };
      }

      // Find the network in the platforms list
      const platform = platforms.data.find(p => 
        p.chain_identifier === network || 
        p.shortname === network || 
        p.name.toLowerCase().includes(network.toLowerCase())
      );

      if (!platform) {
        return { success: false, error: `Network ${network} not found` };
      }

      // Use the new comprehensive endpoint
      const response = await fetch(
        `${this.baseUrl}/coins/${platform.id}/contract/${address}`,
        {
          headers: {
            'x-cg-pro-api-key': this.apiKey || '',
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        // If contract lookup fails, try searching across platforms
        return await this.searchTokenAcrossPlatforms(address);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching token profile:', error);
      return { 
        success: false, 
        error: `CoinGecko error: ${(error as Error).message}` 
      };
    }
  }

  // Search for token across all platforms using the new endpoint
  private async searchTokenAcrossPlatforms(address: string): Promise<ApiResponse<CoinGeckoTokenInfo>> {
    try {
      // Try common networks for PulseChain tokens
      const networks = ['ethereum', 'binance-smart-chain', 'polygon-pos', 'avalanche'];
      
      for (const network of networks) {
        try {
          const url = `${this.baseUrl}/coins/${network}/contract/${address}`;
          const headers: Record<string, string> = {
            'x-cg-pro-api-key': this.apiKey || '',
            'Content-Type': 'application/json',
          };

          const response = await fetch(url, { headers });
          if (response.ok) {
            const data = await response.json();
            return { success: true, data };
          }
        } catch {
          continue; // Try next network
        }
      }

      throw new Error('Token not found on any supported network');
    } catch (error) {
      return { 
        success: false, 
        error: `CoinGecko search error: ${(error as Error).message}` 
      };
    }
  }

  // Get supported asset platforms
  async getAssetPlatforms(): Promise<ApiResponse<any[]>> {
    try {
      const url = `${this.baseUrl}/asset_platforms`;
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'PulseChain-AI-Dashboard/1.0'
      };

      if (this.apiKey) {
        headers['X-CG-Pro-API-Key'] = this.apiKey;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return { data, success: true };
    } catch (error) {
      return { 
        error: `CoinGecko platforms error: ${(error as Error).message}`, 
        success: false 
      };
    }
  }

  // Get token market data (alternative to DexScreener for basic price info)
  async getTokenMarketData(address: string, network: string = 'ethereum'): Promise<ApiResponse<any>> {
    try {
      const url = `${this.baseUrl}/onchain/networks/${network}/tokens/${address}/market_data`;
      
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'PulseChain-AI-Dashboard/1.0'
      };

      if (this.apiKey) {
        headers['X-CG-Pro-API-Key'] = this.apiKey;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`CoinGecko market data error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return { data, success: true };
    } catch (error) {
      return { 
        error: `CoinGecko market data error: ${(error as Error).message}`, 
        success: false 
      };
    }
  }
}

// Export singleton instance
export const coingeckoApi = new CoinGeckoApiClient();
