'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion';
import { StatCounterConfig, TokenCard, TokenData, StatConfig } from './StatCounterBuilder';
import TokenCardComponent from './TokenCard';
import StatsDialog from './StatsDialog';

interface NewMultiTokenPreviewProps {
  config: StatCounterConfig;
  statResults: Record<string, Record<string, unknown>>;
  onTokenCardUpdate: (cardId: string, updates: Partial<TokenCard>) => void;
  onTokenCardDelete: (cardId: string) => void;
  onCardSelect: (cardId: string) => void;
  onStatResultsUpdate: (cardId: string, results: Record<string, unknown>) => void;
  isMobileView?: boolean;
}

export default function NewMultiTokenPreview({ 
  config, 
  statResults, 
  onTokenCardUpdate, 
  onTokenCardDelete,
  onCardSelect,
  onStatResultsUpdate,
  isMobileView = false
}: NewMultiTokenPreviewProps) {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [statsDialogCardId, setStatsDialogCardId] = useState<string | null>(null);

  const handleCardSelect = (cardId: string) => {
    setSelectedCard(cardId);
    onCardSelect(cardId);
  };

  const handleAddStats = (cardId: string) => {
    setStatsDialogCardId(cardId);
    setStatsDialogOpen(true);
  };

  const handleStatsChange = (cardId: string, newStats: StatConfig[]) => {
    onTokenCardUpdate(cardId, { stats: newStats });
  };

  const handleStatResultsChange = (cardId: string, results: Record<string, unknown>) => {
    onStatResultsUpdate(cardId, results);
  };

  const handleDeleteCard = (cardId: string) => {
    onTokenCardDelete(cardId);
    if (selectedCard === cardId) {
      setSelectedCard(null);
      onCardSelect(null);
    }
  };

  if (config.tokens.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-xl font-semibold mb-4 text-blue-400">
            Multi-Token Dashboard
          </h2>
          <p className="text-gray-300 mb-6">
            Search for tokens in the header to add them to your dashboard
          </p>
          <div className="rounded-lg p-4 bg-gray-700/50 border border-white/10">
            <p className="text-sm text-gray-300">
              💡 Use the search bar above to find and add tokens
            </p>
          </div>
        </div>
      </div>
    );
  }

  const selectedCardData = statsDialogCardId 
    ? config.tokens.find(card => card.id === statsDialogCardId)
    : null;

  return (
    <div className="relative w-full h-full">
      {/* Grid Background */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="w-full h-full" style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }} /* eslint-disable-line react/forbid-dom-props */ />
      </div>

      {/* Token Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-6">
        {config.tokens.map((tokenCard) => (
          <motion.div
            key={tokenCard.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative"
          >
            <TokenCardComponent
              token={tokenCard.token!}
              stats={tokenCard.stats}
              statResults={statResults[tokenCard.id] || {}}
              onAddStats={() => handleAddStats(tokenCard.id)}
              onDelete={() => handleDeleteCard(tokenCard.id)}
              isSelected={selectedCard === tokenCard.id}
              onClick={() => handleCardSelect(tokenCard.id)}
              className="w-full h-full"
            />
          </motion.div>
        ))}
      </div>

      {/* Stats Dialog */}
      {selectedCardData && (
        <StatsDialog
          open={statsDialogOpen}
          onClose={() => {
            setStatsDialogOpen(false);
            setStatsDialogCardId(null);
          }}
          token={selectedCardData.token!}
          currentStats={selectedCardData.stats}
          onStatsChange={(newStats) => handleStatsChange(selectedCardData.id, newStats)}
          onStatResultsChange={(results) => handleStatResultsChange(selectedCardData.id, results)}
        />
      )}

      {/* Instructions */}
      {config.tokens.length > 0 && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-lg border border-white/20 rounded-lg px-4 py-2 text-white text-sm z-40">
          <span>💡 Click "Add Stats" on any card to customize the displayed information</span>
        </div>
      )}
    </div>
  );
} 