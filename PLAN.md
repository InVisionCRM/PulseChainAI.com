# Implementation Plan: Industry Standard Filtering & Search for TokenTable

## Overview
Add comprehensive filtering and search functionality to the TokenTable component with a clean, compact UI similar to CoinGecko and DexScreener.

## User Requirements
- **UI Style**: Compact filters bar above table (search + quick chips + expandable advanced panel)
- **Priority Filters**:
  1. Text search (name/symbol)
  2. Quick filters (GOLD, Gainers, Losers)
  3. Price/Volume/Liquidity ranges
- **GOLD Token Behavior**: Always show at top, even if they don't match filters

## Architecture Design

### 1. Filter State Management
Add new state variables to TokenTable component:
```typescript
const [searchQuery, setSearchQuery] = useState('');
const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);
const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
const [priceRange, setPriceRange] = useState({ min: '', max: '' });
const [volumeRange, setVolumeRange] = useState({ min: '', max: '' });
const [liquidityRange, setLiquidityRange] = useState({ min: '', max: '' });
const [filteredTokens, setFilteredTokens] = useState<TokenData[]>([]);
```

### 2. Filter UI Components (All inline in TokenTable.tsx)

#### FilterBar Component (Inline)
Located between the header and table, contains:
- **Search Input** (left side)
  - Real-time text search
  - Searches both token.name and token.symbol
  - Debounced 200ms for performance
  - Icon: Search icon from lucide-react

- **Quick Filter Chips** (center)
  - "GOLD Only" - Filters rank <= 5
  - "Top Gainers" - priceChange24h > 0
  - "Top Losers" - priceChange24h < 0
  - Toggle on/off, one active at a time
  - Active state: bg-blue-600/50, Inactive: bg-white/10

- **Advanced Filters Button** (right side)
  - Toggle button with "Filters" text + filter icon
  - Shows count of active advanced filters (if any)
  - Expands/collapses advanced panel below

#### Advanced Filters Panel (Collapsible, Inline)
Slides down below FilterBar when opened:
- **Price Range**
  - Min/Max input fields
  - Placeholder: "$0.00" format
  - Validates numeric input

- **Volume Range**
  - Min/Max input fields
  - Placeholder: "$0" format
  - Parses K/M suffixes from display values

- **Liquidity Range**
  - Min/Max input fields
  - Placeholder: "$0" format
  - Parses K/M suffixes

- **Clear All Filters** button at bottom right
  - Resets all filters to default state

### 3. Filtering Logic

#### Filter Application Order
1. **Preserve GOLD tokens** (rank <= 5) - always extracted and shown first
2. **Apply all filters to regular tokens** (rank > 5):
   - Text search (if query exists)
   - Quick filter (if one is active)
   - Advanced filters (price, volume, liquidity ranges)
3. **Combine results**: GOLD tokens + filtered regular tokens
4. **Maintain existing sort** on filtered results

#### Filter Functions
```typescript
const applyFilters = (tokens: TokenData[]) => {
  // Separate GOLD priority tokens (rank <= 5)
  const goldTokens = tokens.filter(t => t.rank <= 5);
  const regularTokens = tokens.filter(t => t.rank > 5);

  // Filter regular tokens
  let filtered = regularTokens.filter(token => {
    // Text search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!token.name.toLowerCase().includes(query) &&
          !token.symbol.toLowerCase().includes(query)) {
        return false;
      }
    }

    // Quick filters
    if (activeQuickFilter === 'gold') {
      return false; // Gold only shows GOLD tokens, regular tokens excluded
    }
    if (activeQuickFilter === 'gainers') {
      const change = parseFloat(token.priceChange24h.replace('%', ''));
      if (change <= 0) return false;
    }
    if (activeQuickFilter === 'losers') {
      const change = parseFloat(token.priceChange24h.replace('%', ''));
      if (change >= 0) return false;
    }

    // Price range
    if (priceRange.min || priceRange.max) {
      const price = parsePriceString(token.price);
      if (priceRange.min && price < parseFloat(priceRange.min)) return false;
      if (priceRange.max && price > parseFloat(priceRange.max)) return false;
    }

    // Volume range
    if (volumeRange.min || volumeRange.max) {
      const volume = parseFormattedVolume(token.volume);
      if (volumeRange.min && volume < parseFloat(volumeRange.min)) return false;
      if (volumeRange.max && volume > parseFloat(volumeRange.max)) return false;
    }

    // Liquidity range
    if (liquidityRange.min || liquidityRange.max) {
      const liquidity = parseFormattedLiquidity(token.liquidity);
      if (liquidityRange.min && liquidity < parseFloat(liquidityRange.min)) return false;
      if (liquidityRange.max && liquidity > parseFloat(liquidityRange.max)) return false;
    }

    return true;
  });

  // Always show GOLD tokens at top
  return [...goldTokens, ...filtered];
};
```

### 4. UX Enhancements

#### Active Filter Indicators
- Show chip count badge on "Advanced Filters" button
- Visual highlight on active quick filter chips
- "Clear All" button only visible when filters are active

#### Performance Optimizations
- Debounce text search (200ms)
- Use useMemo for filtered results
- Only re-filter when dependencies change

#### Mobile Responsiveness
- Stack filter components vertically on mobile
- Make advanced panel full-width
- Reduce input field sizes on small screens

### 5. Visual Design

Following existing TokenTable styling:
- **Colors**:
  - Background: bg-black
  - Borders: border-white/20
  - Active elements: bg-blue-600/50
  - Inactive elements: bg-white/10
  - Text: text-white, text-white/80, text-white/50

- **Typography**:
  - Font: font-poppins (consistent with rest of table)
  - Sizes: text-sm for filters, text-xs for mobile

- **Spacing**:
  - Filter bar: py-3 px-4
  - Gap between elements: gap-2 or gap-3
  - Advanced panel: p-4

## Implementation Steps

1. **Add filter state variables** to TokenTable component
2. **Create FilterBar inline component** with:
   - Search input
   - Quick filter chips
   - Advanced filters toggle button
3. **Create AdvancedFiltersPanel inline component** with range inputs
4. **Implement applyFilters function** with all filter logic
5. **Add useEffect** to apply filters when state changes
6. **Update table rendering** to use filteredTokens instead of tokens
7. **Add "Clear All" functionality** to reset all filters
8. **Test filtering logic** with various combinations
9. **Verify GOLD tokens** always appear first regardless of filters
10. **Test mobile responsiveness** and adjust as needed

## Files to Modify

- `components/TokenTable.tsx` - Main implementation (all changes in this file)

## Success Criteria

✅ Text search works for token name and symbol
✅ Quick filters toggle and work correctly
✅ Advanced filters panel expands/collapses smoothly
✅ All range filters function properly
✅ Multiple filters combine correctly (AND logic)
✅ GOLD tokens (rank <= 5) always show at top
✅ Filter count displays on Advanced Filters button
✅ Clear All resets to default state
✅ Mobile responsive design
✅ Consistent Poppins typography
✅ Performance remains smooth with filters applied

## Edge Cases to Handle

- Empty search results - show "No tokens found" message
- Invalid numeric inputs in range filters - validate and show error or ignore
- Clearing filters restores full token list
- GOLD tokens show even when "Top Losers" filter is active
- Sorting still works on filtered results
- Refresh button clears filters or maintains them (maintain them)
