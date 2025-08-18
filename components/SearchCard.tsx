"use client";

import React from 'react';
import { motion, AnimatePresence } from "framer-motion";
import LoadingSpinner from '@/components/icons/LoadingSpinner';

interface SearchCardProps {
  isVisible: boolean;
  onClose: () => void;
  contractAddress: string;
  onContractAddressChange: (value: string) => void;
  onLoadContract: () => void;
  isLoadingContract: boolean;
  isSearching: boolean;
  searchResults: any[];
  onSelectSearchResult: (item: any) => void;
  isSearchDropdownVisible: boolean;
  onSearchDropdownVisibilityChange: (visible: boolean) => void;
  searchContainerRef: React.RefObject<HTMLDivElement>;
}

const SearchCard: React.FC<SearchCardProps> = ({
  isVisible,
  onClose,
  contractAddress,
  onContractAddressChange,
  onLoadContract,
  isLoadingContract,
  isSearching,
  searchResults,
  onSelectSearchResult,
  isSearchDropdownVisible,
  onSearchDropdownVisibilityChange,
  searchContainerRef
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-gradient-to-br from-gray-950/95 to-gray-900/90 backdrop-blur-[2px] border border-gray-700/40 rounded-xl shadow-2xl w-full max-w-2xl p-6 relative overflow-hidden"
            style={{
              boxShadow: "0 0 8px rgba(255,255,255,0.08), 0 0 2px rgba(255,255,255,0.12), inset 0 1px 0 rgba(255,255,255,0.05)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Subtle glow overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/3 via-transparent to-white/3 rounded-xl pointer-events-none"></div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6 relative z-10">
              <h2 className="text-xl font-semibold text-gray-100">Search Contract</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-200 transition-colors"
                title="Close search"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Content */}
            <div className="space-y-4 relative z-10">
              <div className="w-full relative" ref={searchContainerRef}>
                <label htmlFor="contractAddress" className="block text-sm font-medium text-gray-400 mb-2">
                  Contract Address or Name/Ticker
                </label>
                <input
                  type="text"
                  id="contractAddress"
                  value={contractAddress}
                  onChange={(e) => onContractAddressChange(e.target.value)}
                  onFocus={() => onSearchDropdownVisibilityChange(true)}
                  placeholder="0x... or search for 'Pulse'"
                  className="w-full bg-gray-900/60 border border-gray-700/50 rounded-lg px-4 py-3 text-gray-200 placeholder-gray-500 focus:ring-1 focus:ring-gray-500/60 focus:outline-none transition text-base backdrop-blur-[1px]"
                  disabled={isLoadingContract}
                  autoComplete="off"
                />
                {isSearchDropdownVisible && (isSearching || searchResults.length > 0) && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-gray-950/95 backdrop-blur-[1px] border border-gray-700/50 rounded-lg shadow-xl z-10 max-h-80 overflow-y-auto">
                    {isSearching && (
                      <div className="p-3 text-gray-500 flex items-center gap-2">
                        <LoadingSpinner className="w-4 h-4" />
                        <span>Searching...</span>
                      </div>
                    )}
                    {!isSearching && searchResults.map(item => (
                      <div
                        key={item.address}
                        onClick={() => onSelectSearchResult(item)}
                        className="flex items-center gap-3 p-3 hover:bg-gray-900/60 cursor-pointer transition-colors"
                      >
                        {item.icon_url ? (
                          <img src={item.icon_url} alt={`${item.name} logo`} className="w-8 h-8 rounded-full bg-gray-900" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-gray-400 font-bold text-sm flex-shrink-0">
                            {item.name?.[0] || '?'}
                          </div>
                        )}
                        <div className="overflow-hidden flex-1">
                          <div className="font-semibold text-gray-200 truncate">
                            {item.name} {item.symbol && `(${item.symbol})`}
                          </div>
                          <div className="text-xs text-gray-500 capitalize">{item.type}</div>
                          <div className="text-xs text-gray-600 font-mono truncate">{item.address}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <button
                onClick={onLoadContract}
                disabled={isLoadingContract || !contractAddress}
                className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r from-gray-900/60 to-gray-800/60 border border-gray-600/40 text-gray-200 font-semibold px-6 py-3 rounded-lg disabled:bg-gray-900 disabled:cursor-not-allowed transition-all duration-200 disabled:opacity-50 text-base hover:border-gray-500/60 hover:shadow-[0_0_4px_rgba(255,255,255,0.08)] ${
                  contractAddress ? 'shadow-[0_0_4px_rgba(255,255,255,0.06)] ring-1 ring-gray-500/30' : ''
                }`}
                style={{
                  textShadow: "0 0 2px rgba(255,255,255,0.2)",
                  boxShadow: contractAddress ? "0 0 4px rgba(255,255,255,0.06), inset 0 0 8px rgba(255,255,255,0.02)" : "inset 0 0 8px rgba(255,255,255,0.02)"
                }}
              >
                {isLoadingContract ? <LoadingSpinner /> : 'Load Address'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SearchCard; 