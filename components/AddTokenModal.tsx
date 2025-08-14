"use client";
import { useState } from "react";
import TokenSelector from "./TokenSelector";
import StatSelector from "./StatSelector";
import { TokenData, StatConfig } from "./StatCounterBuilder";
import { motion, AnimatePresence } from "motion/react";

interface AddTokenModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (token: TokenData, stats: StatConfig[], statResults?: Record<string, unknown>) => void;
  onMinimize?: () => void;
  compact?: boolean; // New prop for smaller size in AI agent
}

export default function AddTokenModal({ open, onClose, onAdd, onMinimize, compact = false }: AddTokenModalProps) {
  const [selectedToken, setSelectedToken] = useState<TokenData | null>(null);
  const [selectedStats, setSelectedStats] = useState<StatConfig[]>([]);
  const [statResults, setStatResults] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  const handleAdd = () => {
    if (!selectedToken || selectedStats.length === 0) {
      setError("Please select a token and at least one stat.");
      return;
    }
    onAdd(selectedToken, selectedStats, statResults);
    setSelectedToken(null);
    setSelectedStats([]);
    setStatResults({});
    setError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className={`bg-gray-900 rounded-2xl shadow-2xl border border-white/20 relative overflow-hidden flex flex-col ${
              compact 
                ? 'p-4 max-w-2xl w-full max-h-[70vh] text-sm' 
                : 'p-8 max-w-4xl w-full max-h-[90vh]'
            }`}
          >
            <div className="absolute top-4 right-4 flex space-x-2">
              <button
                onClick={() => {
                  // Minimize to see dashboard
                  onMinimize?.();
                }}
                className="text-white/60 hover:text-white text-lg px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
                title="Minimize to see dashboard"
              >
                👁️
              </button>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white text-2xl"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <h2 className={`font-bold text-white mb-6 text-center ${compact ? 'text-lg' : 'text-2xl'}`}>
              Add New Token Card
            </h2>
            
            <div className="flex-1 flex gap-6 overflow-hidden">
              {/* Left Side - Configuration */}
              <div className="flex-1 overflow-y-auto pr-4">
                <div className={`${compact ? 'mb-4' : 'mb-6'}`}>
                  <h3 className={`font-semibold text-white mb-2 ${compact ? 'text-sm' : 'text-lg'}`}>Select Token</h3>
                  <TokenSelector
                    selectedToken={selectedToken}
                    onTokenSelect={setSelectedToken}
                    onError={setError}
                    isLoading={false}
                  />
                </div>
                {selectedToken && (
                  <div className={`${compact ? 'mb-4' : 'mb-6'}`}>
                    <h3 className={`font-semibold text-white mb-2 ${compact ? 'text-sm' : 'text-lg'}`}>Select Stats</h3>
                    <StatSelector
                      token={selectedToken}
                      onStatsChange={setSelectedStats}
                      onStatResultsChange={setStatResults}
                      onError={setError}
                    />
                  </div>
                )}
                {error && <div className="text-red-400 mb-4 text-center">{error}</div>}
              </div>
              
              {/* Right Side - Preview */}
              <div className="flex-1 border-l border-white/20 pl-4">
                <h3 className={`font-semibold text-white mb-4 ${compact ? 'text-sm' : 'text-lg'}`}>Preview</h3>
                <div className="bg-gray-800 rounded-lg p-4 h-full overflow-y-auto">
                  {selectedToken ? (
                    <div className="space-y-4">
                      <div className="text-center">
                        <h4 className={`font-bold text-white mb-2 ${compact ? 'text-base' : 'text-xl'}`}>
                          {selectedToken.name} ({selectedToken.symbol})
                        </h4>
                        <p className={`text-gray-400 ${compact ? 'text-xs' : 'text-sm'}`}>
                          {selectedToken.address.slice(0, 6)}...{selectedToken.address.slice(-4)}
                        </p>
                      </div>
                      
                      {selectedStats.length > 0 ? (
                        <div className="grid gap-3" style={{
                          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))'
                        }}>
                          {selectedStats.map((stat, index) => {
                            const result = statResults[stat.id];
                            return (
                              <div key={index} className={`bg-gray-700 rounded-lg text-center ${compact ? 'p-2' : 'p-3'}`} style={{
                                minWidth: 'fit-content',
                                width: '100%'
                              }}>
                                <div className={`text-gray-400 mb-1 ${compact ? 'text-xs' : 'text-sm'}`}>{stat.name}</div>
                                <div className={`font-semibold text-white ${compact ? 'text-sm' : 'text-lg'}`}>
                                  {result?.formattedValue || result?.value || 'Loading...'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 py-8">
                          Select stats to see preview
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      Select a token to see preview
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className={`pt-4 border-t border-white/20 ${compact ? 'mt-4' : 'mt-6'}`}>
              <button
                onClick={handleAdd}
                className={`w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 ${
                  compact ? 'py-2 px-4 text-sm' : 'py-3 px-6 text-lg'
                }`}
                disabled={!selectedToken || selectedStats.length === 0}
              >
                Add to Dashboard
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}