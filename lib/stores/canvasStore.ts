import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface StatData {
  id: string;
  label: string;
  value?: any;
  loading: boolean;
  error?: string;
}

export interface TokenCard {
  id: string;
  position: { x: number; y: number };
  token: {
    address: string;
    name: string;
    symbol?: string;
    icon_url?: string | null;
  };
  stats: StatData[];
  expanded: boolean;
}

interface CanvasState {
  // Canvas view state
  zoom: number;
  pan: { x: number; y: number };
  
  // Cards state
  cards: TokenCard[];
  selectedCardId: string | null;
  
  // Drag state
  isDragging: boolean;
  dragCardId: string | null;
  
  // UI state
  showTokenSearch: boolean;
  showStatPalette: boolean;
  selectedCardForStats: string | null;
  
  // Actions
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  resetView: () => void;
  
  addCard: (card: TokenCard) => void;
  updateCard: (cardId: string, updates: Partial<TokenCard>) => void;
  deleteCard: (cardId: string) => void;
  setSelectedCard: (cardId: string | null) => void;
  
  setDragState: (isDragging: boolean, dragCardId?: string | null) => void;
  
  setShowTokenSearch: (show: boolean) => void;
  setShowStatPalette: (show: boolean) => void;
  setSelectedCardForStats: (cardId: string | null) => void;
  
  addStatToCard: (cardId: string, stat: StatData) => void;
  updateStatInCard: (cardId: string, statId: string, updates: Partial<StatData>) => void;
  removeStatFromCard: (cardId: string, statId: string) => void;
}

export const useCanvasStore = create<CanvasState>()(
  devtools(
    (set, get) => ({
      // Initial state
      zoom: 1,
      pan: { x: 0, y: 0 },
      cards: [],
      selectedCardId: null,
      isDragging: false,
      dragCardId: null,
      showTokenSearch: false,
      showStatPalette: false,
      selectedCardForStats: null,
      
      // Canvas actions
      setZoom: (zoom) => set({ zoom }),
      setPan: (pan) => set({ pan }),
      resetView: () => set({ zoom: 1, pan: { x: 0, y: 0 } }),
      
      // Card actions
      addCard: (card) => 
        set((state) => ({ cards: [...state.cards, card] })),
        
      updateCard: (cardId, updates) =>
        set((state) => ({
          cards: state.cards.map((card) =>
            card.id === cardId ? { ...card, ...updates } : card
          ),
        })),
        
      deleteCard: (cardId) =>
        set((state) => ({
          cards: state.cards.filter((card) => card.id !== cardId),
          selectedCardId: state.selectedCardId === cardId ? null : state.selectedCardId,
        })),
        
      setSelectedCard: (cardId) => set({ selectedCardId: cardId }),
      
      // Drag actions
      setDragState: (isDragging, dragCardId = null) => 
        set({ isDragging, dragCardId }),
      
      // UI actions
      setShowTokenSearch: (show) => set({ showTokenSearch: show }),
      setShowStatPalette: (show) => set({ showStatPalette: show }),
      setSelectedCardForStats: (cardId) => set({ selectedCardForStats: cardId }),
      
      // Stat actions
      addStatToCard: (cardId, stat) =>
        set((state) => ({
          cards: state.cards.map((card) =>
            card.id === cardId
              ? { ...card, stats: [...card.stats, stat] }
              : card
          ),
        })),
        
      updateStatInCard: (cardId, statId, updates) =>
        set((state) => ({
          cards: state.cards.map((card) =>
            card.id === cardId
              ? {
                  ...card,
                  stats: card.stats.map((stat) =>
                    stat.id === statId ? { ...stat, ...updates } : stat
                  ),
                }
              : card
          ),
        })),
        
      removeStatFromCard: (cardId, statId) =>
        set((state) => ({
          cards: state.cards.map((card) =>
            card.id === cardId
              ? { ...card, stats: card.stats.filter((stat) => stat.id !== statId) }
              : card
          ),
        })),
    }),
    {
      name: 'canvas-store',
    }
  )
);