import React from 'react';
import { SearchResultItem } from './types';

export interface GeickoSearchBarProps {
  /** Current search input value */
  searchInput: string;
  /** Callback when search input changes */
  setSearchInput: (value: string) => void;
  /** Search results array */
  searchResults: SearchResultItem[] | null;
  /** Whether to show search results dropdown */
  showSearchResults: boolean;
  /** Is search in progress */
  isSearching: boolean;
  /** Search error message */
  searchError: string | null;
  /** Form submit handler */
  onSearch: (e: React.FormEvent) => void;
  /** Callback when a result is selected */
  onSelectResult: (item: SearchResultItem) => void;
  /** Optional ref for the input element */
  inputRef?: React.RefObject<HTMLInputElement>;
  /** Optional placeholder text */
  placeholder?: string;
}

/**
 * Search bar component for Geicko token analyzer
 * Supports searching by ticker, name, or address with dropdown results
 */
export default function GeickoSearchBar({
  searchInput,
  setSearchInput,
  searchResults,
  showSearchResults,
  isSearching,
  searchError,
  onSearch,
  onSelectResult,
  inputRef,
  placeholder = 'Search by ticker, name, or address',
}: GeickoSearchBarProps) {
  return (
    <div className="hidden md:block px-2 md:px-3 mt-2 mb-2">
      <form onSubmit={onSearch} className="relative">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            placeholder={placeholder}
          />
          <button
            type="submit"
            className="px-3 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white border border-white/10 transition-colors"
          >
            Search
          </button>
        </div>

        {/* Loading indicator */}
        {isSearching && (
          <div className="absolute right-3 top-3 text-[11px] text-gray-400">
            Searching...
          </div>
        )}

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults && searchResults.length > 0 && (
          <div className="absolute z-50 mt-2 w-full bg-gray-900 border border-gray-800 rounded-lg shadow-xl overflow-hidden">
            {searchResults.map((item) => {
              const holders = (item as any).holders as number | null | undefined;
              return (
                <button
                  key={item.address}
                  type="button"
                  onClick={() => onSelectResult(item)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-800 transition-colors gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">
                      {item.name || item.symbol || 'Token'}
                    </div>
                    <div className="text-[11px] text-gray-400 truncate">
                      {item.symbol || '—'} • Holders:{' '}
                      {holders !== null && holders !== undefined
                        ? holders.toLocaleString()
                        : '—'}
                    </div>
                  </div>
                  <span className="font-mono text-xs text-gray-400">
                    {item.address.slice(0, 6)}...{item.address.slice(-4)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Error Message */}
        {searchError && (
          <div className="mt-1 text-xs text-amber-300">{searchError}</div>
        )}
      </form>
    </div>
  );
}
