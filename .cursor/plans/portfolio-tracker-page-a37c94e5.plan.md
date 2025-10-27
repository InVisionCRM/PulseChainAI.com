<!-- a37c94e5-c48d-4bc4-a16a-81509b9cf0de 93135e82-e986-40b0-92eb-016ba593b4ec -->
# Match Transaction Modal UI Exactly

## Overview

Transform the TransactionModal to match the provided UI design pixel-perfect, including proper swap transaction parsing, token logo integration, and DEX detection.

## Key Changes Required

### 1. Create New API Endpoint for Swap Transactions

**File**: `/app/api/address/[address]/swap-transactions/route.ts` (new)

Create an endpoint that:

- Fetches transactions from PulseChain API (`/api/v2/addresses/{address}/transactions`)
- Parses transaction logs to identify swap events (token transfers in/out)
- Detects DEX interactions (PulseX router addresses: `0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02`, `0x165C3410fC91EF562C50559f7d2289fEbed552d9`)
- Groups token transfers by transaction hash to create swap objects
- Returns formatted swap data with:
  - `type: 'swap'`
  - `from: 'You'` (when sender matches address parameter)
  - `to: 'X PulseX'` (detected DEX name)
  - `sentAssets: [{symbol, amount, value, tokenAddress}]`
  - `receivedAssets: [{symbol, amount, value, tokenAddress}]`
  - `status: 'success' | 'failed'`
  - `timestamp`
  - `gasUsed`, `gasSymbol`, `gasValue`
  - `txHash`

Logic for swap detection:

- Check if transaction interacts with known DEX router contracts
- Parse token transfer events from transaction logs
- Identify sent tokens (from user address) vs received tokens (to user address)
- Calculate USD values using DexScreener price data
- Format amounts with proper decimals

Known DEX addresses to detect:

- PulseX V1: `0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02`
- PulseX V2: `0x165C3410fC91EF562C50559f7d2289fEbed552d9`

### 2. Update TransactionModal Component

**File**: `/components/TransactionModal.tsx`

#### UI Structure Changes

Match the exact layout from the image:

**Top Navigation Bar**:

- Keep existing tabs structure (Portfolio, Transactions, MultiChain Transactions, Spending Caps)
- "Transactions" tab should be active by default
- White underline for active tab

**Transactions Header Section**:

- Left side: "Transactions" title (large, bold) + refresh icon + "View as You" toggle
- Right side: Token address filter input
- Toggle styling: Dark gray background when off, blue when on, white circle slider

**Transaction Type Filters**:

- Buttons: All, Contract Interaction, Receive, Send, Swap, Token Approval
- Active button: White/light background with dark text
- Inactive buttons: Dark background with gray text
- Proper spacing and rounded corners

**Transaction Cards** (main focus):

Each swap transaction displayed as a card with:

1. **Header row**:

   - Left: "Swap" label + "From: You" + "To: X PulseX" (with DEX logo if available)
   - Right: Timestamp ("10 weeks and 4 days ago") + external link icon

2. **Sent Assets** (red arrows):

   - Red upward arrow icon
   - Token logo (circular, from DexScreener)
   - Amount + symbol in white
   - USD value in gray (if > $0)
   - Right side: External link icon + filter icon

3. **Received Assets** (green arrows):

   - Green downward arrow icon
   - Token logo (circular, from DexScreener)
   - Amount + symbol in white
   - USD value in gray in parentheses
   - Right side: External link icon + filter icon

4. **Footer row**:

   - Left: Green checkmark + "Success" (or red X + "Failed")
   - Right: Gas info ("Gas: 344.71049126 PLS ($0.01)")

#### Styling Details

Colors:

- Background: `bg-gray-900` for modal, `bg-gray-800` for cards
- Borders: `border-gray-700`
- Text: White for primary, `text-gray-400` for secondary
- Success: `text-green-500`
- Sent arrows: `text-red-500`
- Received arrows: `text-green-500`

Typography:

- Transaction title: Bold, white
- Amounts: Medium weight, white
- USD values: Gray, in parentheses
- Timestamps: Small, gray

Icons:

- Use Lucide React icons (already imported)
- Size: `w-4 h-4` for arrows and status, `w-3 h-3` for external/filter icons

### 3. Fetch Token Logos from DexScreener

**File**: `/components/TransactionModal.tsx`

Add function to fetch token logos:

```typescript
const fetchTokenLogo = async (tokenAddress: string): Promise<string | null> => {
  try {
    const result = await dexscreenerApi.getTokenProfile(tokenAddress);
    if (result.success && result.data) {
      return result.data.tokenInfo?.logoURI || 
             result.data.pairs?.[0]?.baseToken?.logoURI || 
             result.data.pairs?.[0]?.info?.imageUrl || 
             null;
    }
  } catch (error) {
    console.error('Error fetching token logo:', error);
  }
  return null;
};
```

Enhance transaction data with logos after fetching:

- For each asset in `sentAssets` and `receivedAssets`, fetch logo
- Store in state: `tokenLogos: Record<string, string>`
- Display in UI using `<img>` tags with circular styling

### 4. Implement "View as You" Logic

When toggle is ON:

- Replace actual addresses with "You" for the wallet being viewed
- Show "From: You" or "To: You" based on transaction direction
- Keep DEX names visible (e.g., "To: X PulseX")

When toggle is OFF:

- Show actual addresses in shortened format (`0x1234...5678`)

### 5. Update fetchTransactions Function

**File**: `/components/TransactionModal.tsx`

Replace current implementation:

- Call new API endpoint: `/api/address/${tokenAddress}/swap-transactions`
- Remove mock data
- Handle real swap transaction data
- Fetch token logos for all assets
- Apply "View as You" transformation based on toggle state

### 6. External Link Functionality

Add click handlers for external link icons:

- Transaction hash link: `https://scan.pulsechain.com/tx/${txHash}`
- Token link: `https://scan.pulsechain.com/token/${tokenAddress}`
- Open in new tab

Add click handler for filter icon:

- Set `tokenFilter` state to the clicked token address
- Filter transactions to show only those involving that token

### 7. Refresh Button

Add functionality to refresh button:

- Call `fetchTransactions(1, true)` to reload data
- Show loading state briefly
- Update timestamp

## Files to Create/Modify

1. **Create**: `/app/api/address/[address]/swap-transactions/route.ts`

   - New API endpoint for formatted swap transactions
   - Parse PulseChain transaction data
   - Detect DEX interactions
   - Group token transfers into swaps
   - Calculate USD values

2. **Modify**: `/components/TransactionModal.tsx`

   - Update UI to match exact design
   - Integrate token logo fetching
   - Implement "View as You" toggle logic
   - Connect to new API endpoint
   - Add external link handlers
   - Add filter icon handlers
   - Remove mock data

3. **Modify**: `/types.ts` (if needed)

   - Add/update swap transaction types
   - Add asset type with logo field

## Implementation Details

### Transaction Parsing Logic

For each transaction from PulseChain API:

1. Check if `to` address matches known DEX routers
2. Parse `token_transfers` array from transaction
3. Separate transfers where `from` = user (sent) vs `to` = user (received)
4. For each token, fetch price from DexScreener
5. Calculate USD values: `amount * price`
6. Format gas: Convert wei to PLS, calculate USD value
7. Determine status from transaction result

### Token Logo Caching

Implement simple cache to avoid refetching:

```typescript
const logoCache = new Map<string, string>();
```

### Responsive Design

Ensure cards stack properly on mobile:

- Use flexbox with wrap
- Adjust padding on smaller screens
- Keep all information visible

## Testing Checklist

- [ ] New API endpoint returns properly formatted swap data
- [ ] Token logos display correctly for all assets
- [ ] "View as You" toggle works (shows "You" vs addresses)
- [ ] External link icons open correct URLs
- [ ] Filter icons filter transactions by token
- [ ] Refresh button reloads data
- [ ] Transaction cards match design exactly
- [ ] Colors, spacing, and typography match image
- [ ] Status indicators (success/failed) display correctly
- [ ] Gas fees display with proper formatting
- [ ] Timestamps use detailed format ("X weeks and Y days ago")
- [ ] Multiple received assets display correctly
- [ ] Mobile responsive design works

### To-dos

- [ ] Create /app/portfolio/page.tsx with basic component structure and imports
- [ ] Port and adapt core API functions from lookintorh-clone.tsx (price, balance, transactions, tokens)
- [ ] Implement token logo fetching from DexScreener API
- [ ] Implement simplified header with search functionality
- [ ] Create profile section with wallet address and portfolio value display
- [ ] Implement Portfolio tab with chain cards and token table
- [ ] Add token name click handler to navigate to ai-agent page
- [ ] Implement Transactions tab with TransactionModal integration
- [ ] Apply styling and ensure responsive design works on mobile
- [ ] Test with multiple addresses and verify all features work correctly
- [ ] Create /app/portfolio/page.tsx with basic component structure and imports
- [ ] Port and adapt core API functions from lookintorh-clone.tsx (price, balance, transactions, tokens)
- [ ] Implement simplified header with search functionality
- [ ] Create profile section with wallet address and portfolio value display
- [ ] Implement Portfolio tab with chain cards and token table
- [ ] Implement Transactions tab with transaction history table
- [ ] Apply styling and ensure responsive design works on mobile
- [ ] Test with multiple addresses and verify all features work correctly