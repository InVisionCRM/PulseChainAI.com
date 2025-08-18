# HEX Dashboard

A comprehensive real-time dashboard for HEX cryptocurrency data and staking analytics across Ethereum and PulseChain networks.

## Overview

The HEX Dashboard provides detailed insights into HEX token performance, staking metrics, and on-chain analytics. It aggregates data from multiple sources including The Graph Protocol for staking data and custom APIs for price feeds.

## Features

### 📊 Multi-Network Support
- **Ethereum Network**: Original HEX token data
- **PulseChain Network**: HEX copy on PulseChain with enhanced metrics
- **Real-time Data**: Live price feeds and market data

### 🔒 Staking Analytics
- **Overview Metrics**: Total active stakes, staked amounts, average stake length
- **Global Information**: Current HEX day, stake shares total, locked hearts
- **Active Stakes**: Real-time tracking of all active stakes with days served/remaining
- **All Stake Events**: Complete history of stake start events with pagination
- **Top Stakes**: Largest stakes by amount with detailed breakdown

### 📈 Price & Market Data
- **Live Pricing**: Real-time HEX prices from multiple DEXs
- **Historical Data**: Time-series data with filtering and sorting
- **Market Metrics**: Trading volume, liquidity pools, price changes
- **Cross-chain Comparison**: Side-by-side Ethereum vs PulseChain metrics

### 🤖 AI Analysis
- **Gemini Integration**: AI-powered analysis of HEX data trends
- **Multiple Analysis Types**: Price, staking, market, trend, and correlation analysis
- **Interactive Chat**: Query-based insights and data interpretation

## Architecture

### Components Structure

```
app/hex-dashboard/
├── page.tsx                 # Main dashboard route
└── README.md               # This documentation

components/
├── hex-dashboard.tsx       # Main dashboard component (25k+ lines)
├── HexGeminiAnalysis.tsx   # AI analysis integration
└── ...
```

### Data Sources

1. **HEX Staking Service** (`/services/hexStakingService.ts`)
   - **Source**: The Graph Protocol
   - **Subgraph**: HEX staking data subgraph
   - **Data**: Stakes, stake ends, global info, historical metrics

2. **Custom HEX API** (`/api/hex-proxy`)
   - **Endpoints**: 
     - `/fulldata` - Ethereum historical data
     - `/fulldatapulsechain` - PulseChain historical data  
     - `/livedata` - Real-time market data
   - **Data**: Price history, T-Share rates, liquidity metrics

3. **DexScreener API** (`/services/blockchain/dexscreenerApi`)
   - **Source**: DexScreener DEX aggregator
   - **Data**: Trading pairs, volumes, DEX-specific pricing

### Key Data Types

```typescript
interface HexStakingMetrics {
  totalActiveStakes: number;
  totalStakedHearts: string;
  averageStakeLength: number;
  globalInfo: HexGlobalInfo | null;
  topStakes: HexStake[];
  recentStakeStarts: HexStake[];
}

interface HexStake {
  id: string;
  stakeId: string;
  stakerAddr: string;
  stakedHearts: string;
  stakeShares: string;
  stakedDays: string;
  startDay: string;
  endDay: string;
  isActive: boolean;
  daysServed?: number;
  daysLeft?: number;
}
```

## Features Deep Dive

### Staking Dashboard

The staking tab provides comprehensive analytics:

1. **Overview Tab**:
   - Global staking metrics display
   - Top 10 stakes by amount
   - Key performance indicators

2. **All Stakes Tab**:
   - Paginated view of all stake start events
   - Sortable by stake amount, days, timestamp
   - Filter by date ranges

3. **Active Stakes Tab**:
   - Live view of currently active stakes
   - Days served and days remaining calculations
   - Stake performance tracking

### Data Processing

The dashboard implements several data processing features:

- **Real-time Updates**: Automatic refresh mechanisms
- **Pagination**: Efficient handling of large datasets (50 items per page)
- **Sorting**: Multi-column sorting with direction indicators
- **Filtering**: Date-based filtering for historical analysis
- **Error Handling**: Robust error states with retry mechanisms

### Performance Optimizations

- **Lazy Loading**: Staking data loads on-demand when tab is accessed
- **Caching**: Component-level state management for fetched data
- **Batch Processing**: Paginated API calls for large datasets
- **Background Fetching**: Non-blocking data updates

## Technical Implementation

### State Management

```typescript
// Core dashboard state
const [ethereumData, setEthereumData] = useState<HexRow[]>([]);
const [pulsechainData, setPulsechainData] = useState<HexRow[]>([]);
const [liveData, setLiveData] = useState<LiveData | null>(null);
const [stakingData, setStakingData] = useState<HexStakingMetrics | null>(null);

// UI state
const [activeTab, setActiveTab] = useState<'pulsechain' | 'ethereum' | 'staking'>('pulsechain');
const [sortConfig, setSortConfig] = useState<{ key: keyof HexRow; direction: 'asc' | 'desc' }>();
const [currentPage, setCurrentPage] = useState<number>(1);
```

### API Integration

The dashboard uses a proxy pattern for external API calls:

```typescript
const getApiUrl = (endpoint: 'ethereum' | 'pulsechain' | 'live'): string => {
  const endpointMap = {
    ethereum: 'fulldata',
    pulsechain: 'fulldatapulsechain', 
    live: 'livedata'
  };
  return `/api/hex-proxy?endpoint=${endpointMap[endpoint]}`;
};
```

### Error Handling

Comprehensive error handling with user feedback:

- Network timeouts and retries
- GraphQL error parsing
- User-friendly error messages
- Graceful degradation for missing data

## Styling & UI

- **Design System**: Tailwind CSS with custom color palette
- **Glassmorphism**: Backdrop blur effects with transparency
- **Responsive**: Mobile-first responsive design
- **Dark Theme**: Space-themed dark color scheme
- **Loading States**: Animated loading indicators
- **Interactive Elements**: Hover effects and transitions

## Dependencies

- **React 18+**: Core framework
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **Lucide React**: Icons
- **React Markdown**: AI analysis rendering

## Usage

1. **Navigate to Dashboard**: Visit `/hex-dashboard` route
2. **Select Network**: Choose between Ethereum, PulseChain, or Staking tabs
3. **Explore Data**: Use sorting, filtering, and pagination controls
4. **AI Analysis**: Enable Gemini analysis for insights
5. **Export Data**: Download functionality for data export

## Performance Metrics

- **Initial Load**: < 3 seconds for basic data
- **Staking Data**: < 5 seconds for full staking metrics
- **Pagination**: < 1 second for page transitions
- **Real-time Updates**: 30-second refresh intervals

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Security Considerations

- API key rotation for The Graph
- Rate limiting protection
- Input validation for user filters
- XSS protection for rendered content