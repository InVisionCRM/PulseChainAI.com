'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { search } from '@/services/pulsechainService';
import { useCanvasStore, type TokenCard } from '@/lib/stores/canvasStore';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, useDraggable, MouseSensor, TouchSensor, useSensor, useSensors, DragMoveEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useGesture } from '@use-gesture/react';
import clsx from 'clsx';

// Grid settings for snapping - Made larger and less sensitive
const GRID_SIZE = 40;
const CARD_WIDTH = 320;
const CARD_HEIGHT = 240;



import { availableStats, fetchStat } from '@/lib/stats';

const STAT_CATEGORIES = availableStats.reduce((acc, stat) => {
  const category = stat.id.split(/(?=[A-Z])/).join(' ').replace(/ ./g, (c: string) => c.toUpperCase()).split(' ')[0];
  const existingCategory = acc.find((c: { title: string; stats: { id: string; label: string }[] }) => c.title === category);
  if (existingCategory) {
    existingCategory.stats.push({ id: stat.id, label: stat.name });
  } else {
    acc.push({ title: category, stats: [{ id: stat.id, label: stat.name }] });
  }
  return acc;
}, [] as { title: string; stats: { id: string; label: string }[] }[]);

interface TokenSearchResult {
  address: string;
  name: string;
  symbol?: string;
  type: string;
  icon_url?: string | null;
}

// Snap to grid helper
const snapToGrid = (value: number, gridSize: number = GRID_SIZE): number => {
  return Math.round(value / gridSize) * gridSize;
};

export default function StatCounterBuilderPage() {
  // Zustand store
  const {
    zoom, pan, cards, selectedCardId, isDragging, dragCardId,
    showTokenSearch, showStatPalette, selectedCardForStats,
    setZoom, setPan, resetView, addCard, updateCard, deleteCard, setSelectedCard,
    setDragState, setShowTokenSearch, setShowStatPalette, setSelectedCardForStats,
    addStatToCard, updateStatInCard, removeStatFromCard
  } = useCanvasStore();
  
  // Local state for UI interactions
  const [isPanning, setIsPanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TokenSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeCard, setActiveCard] = useState<TokenCard | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // DnD Kit sensors
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 8, // Minimum distance before drag starts
    },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250,
      tolerance: 5,
    },
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  // Wheel zoom is handled by useGesture

  // Panning is handled by useGesture

  // Token search with debouncing
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(searchQuery);
    if (isAddress) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await search(searchQuery);
        setSearchResults(results.slice(0, 10)); // Limit to 10 results
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Add new token card
  const addTokenCard = (token: TokenSearchResult) => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    // Find a good position - center of view, snapped to grid
    const centerX = (-pan.x + canvasRect.width / 2) / zoom;
    const centerY = (-pan.y + canvasRect.height / 2) / zoom;
    
    const snappedX = snapToGrid(centerX - CARD_WIDTH / 2);
    const snappedY = snapToGrid(centerY - CARD_HEIGHT / 2);

    const newCard: TokenCard = {
      id: `card-${Date.now()}`,
      position: { x: snappedX, y: snappedY },
      token: {
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        icon_url: token.icon_url || undefined
      },
      stats: [],
      expanded: false
    };

    addCard(newCard);
    setShowTokenSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Card dragging is now handled by dnd-kit

  // DnD Kit handlers
  const handleDragStart = (event: DragStartEvent) => {
    setDragState(true, event.active.id as string);
    const card = cards.find(c => c.id === event.active.id);
    if (card) {
      setSelectedCard(card.id);
      setActiveCard(card);
    }
  };

  const handleDragMove = (event: DragMoveEvent) => {
    // This is handled by the transform in useDraggable
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragState(false, null);
    setActiveCard(null);
    const { active, delta } = event;
    const cardId = active.id as string;
    const card = cards.find(c => c.id === cardId);

    if (card && delta.x !== 0 && delta.y !== 0) {
      const newPosition = {
        x: snapToGrid(card.position.x + delta.x / zoom),
        y: snapToGrid(card.position.y + delta.y / zoom),
      };
      updateCard(cardId, { position: newPosition });
    }
  };

  // Gesture binding for touch/mouse events
  const bind = useGesture({
    onDrag: ({ down, delta: [dx, dy], first, last }) => {
      if (first) setIsPanning(true);
      if (last) setIsPanning(false);
      if (down && !isDragging) {
        setPan({ x: pan.x + dx, y: pan.y + dy });
      }
    },
    onWheel: ({ event, delta: [, dy] }) => {
      event.preventDefault();
      const delta = dy > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(zoom * delta, 0.1), 3);
      setZoom(newZoom);
    },
  }, {
    drag: { filterTaps: true },
    wheel: { preventDefault: true },
  });

  // Add stat to card handler
  const handleAddStatToCard = (cardId: string, statId: string, statLabel: string) => {
    addStatToCardLocal(cardId, statId, statLabel);
  };

  
  // Add stat to card
  const addStatToCardLocal = async (cardId: string, statId: string, statLabel: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    // Don't add if stat already exists
    if (card.stats.some(s => s.id === statId)) return;
    
    // Add stat with loading state
    addStatToCard(cardId, { id: statId, label: statLabel, loading: true });

    setShowStatPalette(false);
    setSelectedCardForStats(null);

    // Calculate actual stat value
    try {
      const result = await fetchStat(statId, card.token.address);
      
      updateStatInCard(cardId, statId, { loading: false, value: result.formattedValue, error: result.error });
    } catch (error) {
      updateStatInCard(cardId, statId, { loading: false, error: 'Failed to load' });
    }
  };

  // Remove stat from card
  const removeStatFromCardLocal = (cardId: string, statId: string) => {
    removeStatFromCard(cardId, statId);
  };

  // Delete card
  const deleteCardLocal = (cardId: string) => {
    deleteCard(cardId);
    if (selectedCardId === cardId) {
      setSelectedCard(null);
    }
  };

  // Toggle card expansion
  const toggleCardExpanded = (cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (card) {
      updateCard(cardId, { expanded: !card.expanded });
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedCardId) {
          deleteCardLocal(selectedCardId);
        }
      }
      if (e.key === 'Escape') {
        setSelectedCard(null);
        setShowTokenSearch(false);
        setShowStatPalette(false);
      }
      if (e.key === ' ' && !showTokenSearch) {
        e.preventDefault();
        setShowTokenSearch(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCardId, showTokenSearch]);

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-purple-900 to-black overflow-hidden relative">
      {/* Header Toolbar */}
      <div className="absolute top-0 left-0 right-0 z-40 bg-black/20 backdrop-blur-xl border-b border-white/10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-white text-xl font-bold">Token Analytics Dashboard</h1>
          <div className="text-slate-400 text-sm">
            Zoom: {(zoom * 100).toFixed(0)}% | Cards: {cards.length}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowTokenSearch(true)}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <span className="mr-2">+</span>
            Add Token
          </Button>
          
          {selectedCardId && (
            <Button
              onClick={() => deleteCardLocal(selectedCardId)}
              variant="destructive"
              size="sm"
            >
              Delete Selected
            </Button>
          )}
          
          <Button
            onClick={resetView}
            variant="outline"
            size="sm"
          >
            Reset View
          </Button>
        </div>
      </div>

      {/* Canvas with DnD Context */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      >
        <div
          ref={canvasRef}
          {...bind()}
          className={clsx(
            "absolute inset-0 pt-20 canvas-background",
            isPanning ? "cursor-grabbing" : "cursor-grab"
          )}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0'
          }} // eslint-disable-line react/forbid-dom-props
        >
        {/* Grid Background */}
        <div 
          className="absolute inset-0 opacity-5 canvas-background"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)
            `,
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`
          }} // eslint-disable-line react/forbid-dom-props
        />

        {/* Card Outline Preview can be re-added here if desired */}

          {/* Token Cards */}
          {cards.map((card) => (
            <DraggableTokenCard
              key={card.id}
              card={card}
              isSelected={selectedCardId === card.id}
              onSelect={() => setSelectedCard(card.id)}
              onToggleExpanded={() => toggleCardExpanded(card.id)}
              onAddStat={() => {
                setSelectedCardForStats(card.id);
                setShowStatPalette(true);
              }}
              onRemoveStat={(statId) => removeStatFromCardLocal(card.id, statId)}
            />
          ))}

        {/* Welcome message when no cards */}
        {cards.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white/60 max-w-md">
              <div className="text-6xl mb-6">📊</div>
              <h2 className="text-2xl font-bold mb-4">Welcome to Token Analytics</h2>
              <p className="mb-6">Build your custom token dashboard by adding token cards and selecting the stats you want to track.</p>
              <div className="space-y-2 text-sm">
                <p>• Press <kbd className="bg-white/10 px-2 py-1 rounded">Space</kbd> or click "Add Token" to start</p>
                <p>• Scroll to zoom, drag to pan</p>
                <p>• Drag cards to move them (they snap to grid)</p>
                <p>• Click on cards to add/remove stats</p>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="absolute bottom-4 left-4 text-slate-400 text-sm space-y-1 pointer-events-none">
          <div>Press <kbd className="bg-white/10 px-1 py-0.5 rounded text-xs">Space</kbd> to add tokens</div>
          <div>Scroll to zoom • Drag to pan • Cards snap to grid</div>
          <div><kbd className="bg-white/10 px-1 py-0.5 rounded text-xs">Del</kbd> to delete selected</div>
        </div>
      </div>

      {/* Token Search Modal */}
      <AnimatePresence>
        {showTokenSearch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 rounded-xl border border-slate-600 p-6 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white text-lg font-bold">Add Token</h2>
                <button
                  onClick={() => setShowTokenSearch(false)}
                  className="text-slate-400 hover:text-white"
                  title="Close token search dialog"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tokens by name or symbol..."
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500 focus:outline-none"
                    autoFocus
                  />
                </div>

                {isSearching && (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span className="ml-2 text-slate-400">Searching...</span>
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {searchResults.map((token) => (
                      <button
                        key={token.address}
                        onClick={() => addTokenCard(token)}
                        className="w-full flex items-center gap-3 p-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-left transition-colors"
                      >
                        {token.icon_url ? (
                          <img src={token.icon_url} alt={token.name} className="w-8 h-8 rounded-full" />
                        ) : (
                          <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-white text-sm">
                            {token.symbol?.[0] || '?'}
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="text-white font-medium">{token.name}</div>
                          <div className="text-slate-400 text-sm">{token.symbol}</div>
                        </div>
                        <div className="text-slate-500 text-xs capitalize">{token.type}</div>
                      </button>
                    ))}
                  </div>
                )}

                {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                  <div className="text-center text-slate-400 py-4">
                    No tokens found for "{searchQuery}"
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stat Selection Modal */}
      <AnimatePresence>
        {showStatPalette && selectedCardForStats && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 rounded-xl border border-slate-600 p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-white text-xl font-bold">Add Stats</h2>
                <button
                  onClick={() => {
                    setShowStatPalette(false);
                    setSelectedCardForStats(null);
                  }}
                  className="text-slate-400 hover:text-white"
                  title="Close stats palette"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {STAT_CATEGORIES.map((category) => (
                  <div key={category.title}>
                    <h3 className="text-white font-semibold mb-3 text-lg">{category.title}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {category.stats.map((stat) => {
                        const card = cards.find(c => c.id === selectedCardForStats);
                        const hasThisStat = card?.stats.some(s => s.id === stat.id);
                        
                        return (
                          <button
                            key={stat.id}
                            onClick={() => handleAddStatToCard(selectedCardForStats, stat.id, stat.label)}
                            disabled={hasThisStat}
                            className={`p-3 rounded-lg text-left text-white text-sm transition-colors border ${
                              hasThisStat
                                ? 'bg-slate-600 border-slate-600 opacity-50 cursor-not-allowed'
                                : 'bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-slate-500'
                            }`}
                          >
                            {stat.label}
                            {hasThisStat && <span className="ml-2 text-green-400">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zoom Slider */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40">
        <div className="bg-black/80 backdrop-blur-md rounded-full px-6 py-3 border border-white/20">
          <div className="flex items-center gap-4">
            <span className="text-white text-sm font-medium">Zoom</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setZoom(Math.max(0.1, zoom - 0.2))}
                className="text-white hover:text-blue-400 transition-colors p-1"
                title="Zoom Out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-32 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer zoom-slider"
                title="Zoom level control"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(zoom - 0.1) / 4.9 * 100}%, #475569 ${(zoom - 0.1) / 4.9 * 100}%, #475569 100%)`
                }} // eslint-disable-line react/forbid-dom-props
              />
              <button
                onClick={() => setZoom(Math.min(5, zoom + 0.2))}
                className="text-white hover:text-blue-400 transition-colors p-1"
                title="Zoom In"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
            </div>
            <span className="text-slate-400 text-sm min-w-[3rem] text-right">{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      </div>

        
        {/* Drag Overlay */}
        <DragOverlay>
          {activeCard ? (
            <TokenCardComponent
              card={activeCard}
              isSelected={true}
              onSelect={() => {}}
              onToggleExpanded={() => {}}
              onAddStat={() => {}}
              onRemoveStat={() => {}}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// Draggable Token Card Component
interface DraggableTokenCardProps {
  card: TokenCard;
  isSelected: boolean;
  onSelect: () => void;
  onToggleExpanded: () => void;
  onAddStat: () => void;
  onRemoveStat: (statId: string) => void;
}

function DraggableTokenCard(props: DraggableTokenCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: props.card.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 1000 : 1,
    opacity: isDragging ? 0 : 1, // Hide original while dragging, DragOverlay shows it
    position: 'absolute' as const,
    left: props.card.position.x,
    top: props.card.position.y,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} /* eslint-disable-line react/forbid-dom-props */>
      <TokenCardComponent
        {...props}
      />
    </div>
  );
}

// Token Card Component
interface TokenCardProps {
  card: TokenCard;
  isSelected: boolean;
  onSelect: () => void;
  onToggleExpanded: () => void;
  onAddStat: () => void;
  onRemoveStat: (statId: string) => void;
}

function TokenCardComponent({ 
  card, 
  isSelected, 
  onSelect, 
  onToggleExpanded, 
  onAddStat, 
  onRemoveStat 
}: TokenCardProps) {
  // Calculate dynamic height based on number of stats
  const baseHeight = 140; // Header + footer + padding
  const statHeight = 44; // Height per stat (including padding)
  const addButtonHeight = 44; // Height for "Add Stat" button
  const bottomPadding = statHeight * 2; // 2 empty spaces worth of padding
  const minHeight = CARD_HEIGHT;
  
  const dynamicHeight = baseHeight + (card.stats.length * statHeight) + addButtonHeight + bottomPadding;
  const cardHeight = Math.max(minHeight, dynamicHeight);

  return (
    <div
      className={`relative cursor-move select-none transition-all duration-300 bg-slate-800/90 backdrop-blur-sm rounded-xl border-2 ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-600'
      } shadow-xl hover:shadow-2xl flex flex-col`}
      style={{
        width: CARD_WIDTH,
        height: cardHeight,
      }} // eslint-disable-line react/forbid-dom-props
            onClick={onSelect}
    >
      {/* Card Header */}
      <div className="p-4 border-b border-slate-600 flex-shrink-0">
        <div className="flex items-center gap-3">
          {card.token.icon_url ? (
            <img 
              src={card.token.icon_url} 
              alt={card.token.name} 
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
              {card.token.symbol?.[0] || '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold truncate">{card.token.name}</h3>
            <p className="text-slate-400 text-sm">{card.token.symbol}</p>
          </div>
          <div className="text-slate-500 text-xs">
            {card.stats.length} stat{card.stats.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        {/* Stats List - Remove height restriction */}
        <div className="space-y-2 flex-1">
          {card.stats.map((stat) => (
            <div key={stat.id} className="flex items-center justify-between bg-slate-700/50 rounded-lg p-2 min-h-[40px]">
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium truncate">{stat.label}</div>
                {stat.loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-slate-400 text-xs">Loading...</span>
                  </div>
                ) : stat.error ? (
                  <div className="text-red-400 text-xs">Error loading</div>
                ) : (
                  <div className="text-slate-300 text-xs break-words">{stat.value}</div>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveStat(stat.id);
                }}
                className="text-slate-400 hover:text-red-400 p-1 ml-2 flex-shrink-0"
                title="Remove stat"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Add Stat Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddStat();
          }}
          className="w-full py-3 border-2 border-dashed border-slate-600 hover:border-slate-500 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2 mt-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Stat
        </button>
      </div>

      {/* Card Footer - Address */}
      <div className="p-2 px-4 border-t border-slate-600/50 flex-shrink-0">
        <div className="text-slate-500 text-xs font-mono truncate">
          {card.token.address}
        </div>
      </div>
    </div>
  );
}

// Inject custom styles for zoom slider
if (typeof document !== 'undefined') {
  const styleId = 'zoom-slider-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .zoom-slider::-webkit-slider-thumb {
        appearance: none;
        height: 18px;
        width: 18px;
        border-radius: 50%;
        background: #3b82f6;
        border: 2px solid #1e293b;
        cursor: pointer;
        box-shadow: 0 0 10px rgba(59, 130, 246, 0.4);
      }

      .zoom-slider::-webkit-slider-thumb:hover {
        background: #2563eb;
        box-shadow: 0 0 15px rgba(59, 130, 246, 0.6);
      }

      .zoom-slider::-webkit-slider-track {
        width: 100%;
        height: 8px;
        cursor: pointer;
        background: transparent;
        border-radius: 4px;
      }

      .zoom-slider::-moz-range-thumb {
        height: 18px;
        width: 18px;
        border-radius: 50%;
        background: #3b82f6;
        border: 2px solid #1e293b;
        cursor: pointer;
        box-shadow: 0 0 10px rgba(59, 130, 246, 0.4);
      }

      .zoom-slider::-moz-range-track {
        width: 100%;
        height: 8px;
        cursor: pointer;
        background: transparent;
        border-radius: 4px;
      }
    `;
    document.head.appendChild(style);
  }
}