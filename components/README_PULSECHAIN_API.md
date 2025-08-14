## PulseChain API Endpoints and Expected Responses

This document enumerates the PulseChain (Blockscout v2) endpoints used by the app and the expected response models. Sources: `components/scan.csv` and `components/api-schema.csv`.

### Search
- GET /search → SearchResponse
- GET /search/check-redirect → { parameter: string; redirect: string; type: string }

### Global lists
- GET /transactions → Transaction[]
- GET /blocks → Block[]
- GET /token-transfers → TokenTransfer[]
- GET /internal-transactions → InternalTransaction[]

### Main page
- GET /main-page/transactions → Transaction[]
- GET /main-page/blocks → Block[]
- GET /main-page/indexing-status → { finished_indexing: boolean; finished_indexing_blocks: boolean; indexed_blocks_ratio: string; indexed_internal_transactions_ratio: string }

### Stats
- GET /stats → StatsResponse
- GET /stats/charts/transactions → TransactionChartItem[]
- GET /stats/charts/market → MarketChartItem[]

### Transactions
- GET /transactions/{transaction_hash} → Transaction
- GET /transactions/{transaction_hash}/token-transfers → TokenTransfer[]
- GET /transactions/{transaction_hash}/internal-transactions → InternalTransaction[]
- GET /transactions/{transaction_hash}/logs → LogEntry[]
- GET /transactions/{transaction_hash}/raw-trace → RawTrace[]
- GET /transactions/{transaction_hash}/state-changes → StateChange[]
- GET /transactions/{transaction_hash}/summary → any (human-readable summary)

### Blocks
- GET /blocks/{block_number_or_hash} → Block
- GET /blocks/{block_number_or_hash}/transactions → Transaction[]
- GET /blocks/{block_number_or_hash}/withdrawals → Withdrawal[]

### Addresses
- GET /addresses → AddressInfo[] (native coin holders list)
- GET /addresses/{address_hash} → AddressInfo
- GET /addresses/{address_hash}/counters → AddressCounters
- GET /addresses/{address_hash}/transactions → TransactionResponse
- GET /addresses/{address_hash}/token-transfers → TokenTransfer[] | TransactionResponse
- GET /addresses/{address_hash}/internal-transactions → InternalTransaction[]
- GET /addresses/{address_hash}/logs → LogEntry[]
- GET /addresses/{address_hash}/blocks-validated → Block[]
- GET /addresses/{address_hash}/token-balances → TokenBalance[]
- GET /addresses/{address_hash}/tokens → TokenBalance[] (paginated)
- GET /addresses/{address_hash}/coin-balance-history → CoinBalanceHistoryEntry[]
- GET /addresses/{address_hash}/coin-balance-history-by-day → CoinBalanceHistoryEntry[]
- GET /addresses/{address_hash}/withdrawals → Withdrawal[]
- GET /addresses/{address_hash}/nft → NFTInstance[]
- GET /addresses/{address_hash}/nft/collections → NFTInstance[]

### Tokens
- GET /tokens → TokenInfo[]
- GET /tokens/{address_hash} → TokenInfoDetailed
- GET /tokens/{address_hash}/transfers → TransactionResponse
- GET /tokens/{address_hash}/holders → HoldersResponse
- GET /tokens/{address_hash}/counters → { token_holders_count: number; transfers_count: number }
- GET /tokens/{address_hash}/instances → NFTInstance[]
- GET /tokens/{address_hash}/instances/{id} → NFTInstance
- GET /tokens/{address_hash}/instances/{id}/transfers → TokenTransfer[]
- GET /tokens/{address_hash}/instances/{id}/holders → Holder[]
- GET /tokens/{address_hash}/instances/{id}/transfers-count → number
- PATCH /tokens/{address_hash}/instances/{id}/refetch-metadata → any

### Smart Contracts
- GET /smart-contracts → SmartContract[] (verified)
- GET /smart-contracts/counters → any
- GET /smart-contracts/{address_hash} → SmartContract

### Config
- GET /config/json-rpc-url → string

### Proxy
- GET /proxy/account-abstraction/status → any

### Types Summary
- Transaction, TransactionResponse
- Block
- TokenInfo, TokenInfoDetailed, Holder, HoldersResponse, TokenBalance, TokenTransfer
- AddressInfo, AddressCounters, CoinBalanceHistoryEntry
- InternalTransaction, LogEntry, RawTrace, StateChange, Withdrawal, NFTInstance
- StatsResponse, MarketChartItem, TransactionChartItem

Refer to `services/core/types.ts` for exact TypeScript interfaces used by the unified client (`pulsechainApi`).

## Response Schemas (from api-schema.csv)

These summarize the primary response shapes returned by the PulseChain (Blockscout v2) API. Field names are aligned with `api-schema.csv` and mirrored in `services/core/types.ts`.

- TokenInfo
  - address: string
  - name: string
  - symbol: string
  - decimals: number
  - type: string
  - holders: number
  - exchange_rate?: string
  - total_supply?: string
  - circulating_market_cap?: string
  - icon_url?: string

- TokenInfoDetailed (extends TokenInfo)
  - circulating_market_cap: string
  - icon_url: string
  - exchange_rate: string

- Holder
  - address: string
  - value: string
  - token_id?: string

- HoldersResponse
  - items: Holder[]
  - next_page_params?: any

- TokenTransfer
  - transaction_hash: string
  - from: string
  - to: string
  - value: string
  - timestamp?: string
  - block_hash?: string
  - log_index?: number
  - token?: TokenInfo
  - total?: { value: string }

- Transaction
  - hash: string
  - block_number: number
  - from: string
  - to: string
  - value: string
  - gas_used: string
  - gas_price: string
  - status: string
  - timestamp: string
  - method?: string
  - fee?: string

- TransactionResponse
  - items: Transaction[]
  - next_page_params?: any

- AddressInfo
  - hash: string
  - is_contract: boolean
  - is_verified?: boolean
  - name?: string
  - coin_balance?: string
  - transactions_count?: number
  - token_balances_count?: number

- AddressCounters
  - transactions_count: number
  - token_transfers_count: number
  - gas_usage_count?: number
  - validations_count?: number

- TokenBalance
  - token: TokenInfo
  - value: string
  - token_id?: string | null

- Block
  - hash: string
  - number: number
  - timestamp: string
  - transactions_count: number
  - gas_used?: string
  - gas_limit?: string
  - base_fee_per_gas?: string
  - burnt_fees?: string
  - miner?: string

- InternalTransaction
  - transaction_hash: string
  - block_number: number
  - from: string
  - to: string
  - value: string
  - gas_limit?: string
  - gas_used?: string
  - success: boolean
  - error?: string
  - type?: string
  - created_contract?: string
  - timestamp?: string

- LogEntry
  - transaction_hash: string
  - block_number: number
  - address: string
  - topics: string[]
  - data: string
  - log_index?: number
  - decoded?: any

- CoinBalanceHistoryEntry
  - block_number: number
  - block_timestamp: string
  - delta: string
  - value: string
  - transaction_hash?: string

- Withdrawal
  - index: number
  - amount: string
  - validator_index: number
  - receiver: string
  - timestamp: string
  - block_number: number

- StatsResponse
  - total_blocks: number
  - total_addresses: number
  - total_transactions: number
  - average_block_time: number
  - coin_price: string
  - total_gas_used?: string
  - transactions_today?: number
  - gas_used_today?: string

- MarketChartItem
  - date: string
  - closing_price: number | string
  - market_cap: number | string

- TransactionChartItem
  - date: string
  - transaction_count: number

- SmartContract (common fields)
  - address: string
  - name?: string
  - compiler_version: string
  - language: string
  - is_verified: boolean
  - source_code?: string
  - abi?: any[]
  - optimization_enabled: boolean
  - constructor_arguments?: string

