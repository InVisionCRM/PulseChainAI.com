import React, { useEffect, useRef } from 'react';
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
  /** Callback to close search results */
  onCloseResults?: () => void;
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
  onCloseResults,
  inputRef,
  placeholder = 'Search by ticker, name, or address',
}: GeickoSearchBarProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    if (!showSearchResults || !onCloseResults) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onCloseResults();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSearchResults, onCloseResults]);

  return (
    <div className="px-2 md:px-3 mt-2 mb-2">
      <form onSubmit={onSearch} className="relative" ref={dropdownRef}>
        <div className="flex items-center gap-2 relative">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 pr-28 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              placeholder={placeholder}
            />
            {/* Loading indicator inside input */}
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[11px] text-cyan-400 font-medium">Searching</span>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="px-3 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Search
          </button>
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults && searchResults.length > 0 && (
          <div className="absolute z-50 mt-2 w-full bg-gray-900 border border-gray-800 rounded-lg shadow-xl overflow-hidden max-h-[400px] overflow-y-auto">
            {searchResults.map((item) => {
              const holders = 'holders' in item ? (item.holders as number | null | undefined) : undefined;
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
