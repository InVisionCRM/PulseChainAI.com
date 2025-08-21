# PulseChain Staking Database Integration

This document outlines the database integration implemented for PulseChain staking statistics.

## Overview

The system now includes a comprehensive database layer that provides:
- **Persistent data storage** for PulseChain staking data
- **Faster query performance** compared to GraphQL API calls
- **Background synchronization** for automatic data updates
- **Graceful fallback** to GraphQL API when database is unavailable

## Architecture

### Database Schema
The integration includes 5 main tables:

1. **`pulsechain_stake_starts`** - All stake start events
2. **`pulsechain_stake_ends`** - All stake end events  
3. **`pulsechain_global_info`** - HEX protocol global information
4. **`pulsechain_sync_status`** - Synchronization tracking
5. **`pulsechain_staker_metrics`** - Aggregated staker analytics

### Service Layer

#### PulseChainHexStakingService
- **Database-first approach**: Queries database before falling back to GraphQL
- **Automatic caching**: Stores GraphQL results in database for future use
- **Enhanced cache status**: Shows both memory cache and database statistics

#### PulsechainSyncService
- **Incremental synchronization**: Only fetches new data since last sync
- **Background operations**: Runs periodic syncs every 30 minutes
- **Error handling**: Graceful handling of network or API failures

## Files Structure

```
lib/
├── db/
│   ├── connection.ts           # Database connection setup
│   ├── pulsechainStakingDb.ts  # Database operations layer
│   ├── schema.sql              # Database schema definition
│   └── databaseStatus.ts       # Database availability checking
├── sync/
│   └── pulsechainSyncService.ts # Background sync service
services/
└── pulsechainHexStakingService.ts # Updated with DB integration
scripts/
├── initDatabase.ts             # Database initialization
├── createTablesOneByOne.ts     # Manual table creation
└── debugDatabase.ts            # Database debugging
app/api/admin/
└── pulsechain-sync/route.ts    # Admin API endpoints
```

## Usage

### Database Initialization

```bash
# Initialize database schema
npm run db:init

# Initialize and perform initial sync
npm run db:sync
```

### Admin API Endpoints

The system provides admin endpoints for managing the database:

- `GET /api/admin/pulsechain-sync?action=status` - Get sync status
- `GET /api/admin/pulsechain-sync?action=sync` - Trigger manual sync
- `GET /api/admin/pulsechain-sync?action=force-sync` - Force full resync
- `POST /api/admin/pulsechain-sync` - Advanced operations

### Programmatic Usage

```typescript
import { pulsechainStakingDb } from '@/lib/db/pulsechainStakingDb';
import { pulsechainSyncService } from '@/lib/sync/pulsechainSyncService';

// Get staking overview from database
const overview = await pulsechainStakingDb.getStakingOverview();

// Trigger sync
const result = await pulsechainSyncService.performSync();

// Start periodic sync (every 30 minutes)
await pulsechainSyncService.startPeriodicSync(30);
```

## UI Integration

The StakingOverview component now shows enhanced status information:

- **Database Connection Status**: Shows if database is available
- **Database Counts**: Displays number of records in each table
- **Memory Cache Status**: Shows current cache state
- **Cache Age**: Time since last data fetch

## Benefits

### Performance Improvements
- **Faster loading**: Database queries vs API calls
- **Reduced API calls**: Less strain on GraphQL endpoints
- **Better pagination**: Efficient database-level pagination

### Reliability
- **Offline capability**: Works with cached data when APIs are down
- **Automatic recovery**: Graceful fallback and retry mechanisms
- **Data persistence**: No data loss between application restarts

### Analytics
- **Historical tracking**: Long-term data analysis
- **Staker metrics**: Pre-calculated analytics for faster insights
- **Trend analysis**: Track changes over time

## Current Status

✅ **Completed Features:**
- Database schema design and creation
- Database service layer implementation
- Service integration with fallback logic
- Background sync service
- Admin API endpoints
- UI status indicators

⚠️ **Known Issues:**
- Database table creation permissions may need adjustment
- Initial sync may take several minutes for full dataset
- Some indexes may need optimization for large datasets

## Troubleshooting

### Database Connection Issues
```bash
# Check database connection
npx tsx scripts/debugDatabase.ts

# Check table status
npx tsx scripts/checkTables.ts
```

### Sync Issues
- Check admin API status endpoint
- Review sync service logs
- Verify GraphQL endpoint availability

### Performance Issues
- Monitor database query performance
- Check memory cache status
- Review pagination settings

## Future Enhancements

- **Real-time updates**: WebSocket integration for live data
- **Advanced analytics**: More sophisticated metrics calculation
- **Data export**: CSV/JSON export functionality
- **Performance monitoring**: Query performance tracking
- **Automated cleanup**: Old data archival system

## Environment Variables

Required environment variables:
- `DATABASE_URL` - Neon database connection string
- `POSTGRES_URL` - Alternative database connection string

The system will automatically load these from `.env.local` if not available in the environment.