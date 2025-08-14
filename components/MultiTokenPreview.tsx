'use client';

import { motion, Reorder } from 'motion/react';
import { useState } from 'react';
import { StatCounterConfig, TokenCard } from './StatCounterBuilder';
import LivePreview from './LivePreview';

interface MultiTokenPreviewProps {
  config: StatCounterConfig;
  statResults: Record<string, Record<string, unknown>>;
  onTokenCardUpdate: (cardId: string, updates: Partial<TokenCard>) => void;
  onTokenCardDelete: (cardId: string) => void;
  onCardSelect: (cardId: string) => void;
  isMobileView?: boolean;
}

export default function MultiTokenPreview({ 
  config, 
  statResults, 
  onTokenCardUpdate, 
  onTokenCardDelete,
  onCardSelect,
  isMobileView = false
}: MultiTokenPreviewProps) {
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [snapLines, setSnapLines] = useState<{ x?: number; y?: number; type: 'horizontal' | 'vertical' }[]>([]);



  // Snapping system
  const GRID_SIZE = 20;
  const SNAP_THRESHOLD = 10;

  const snapToGrid = (x: number, y: number) => {
    return {
      x: Math.round(x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(y / GRID_SIZE) * GRID_SIZE
    };
  };

  const snapToOtherCards = (x: number, y: number, width: number, height: number, currentCardId: string) => {
    let snappedX = x;
    let snappedY = y;

    config.tokens.forEach(card => {
      if (card.id === currentCardId) return;

      // Snap to left edge
      if (Math.abs(x - card.position.x) < SNAP_THRESHOLD) {
        snappedX = card.position.x;
      }
      // Snap to right edge
      if (Math.abs((x + width) - (card.position.x + card.size.width)) < SNAP_THRESHOLD) {
        snappedX = card.position.x + card.size.width - width;
      }
      // Snap to top edge
      if (Math.abs(y - card.position.y) < SNAP_THRESHOLD) {
        snappedY = card.position.y;
      }
      // Snap to bottom edge
      if (Math.abs((y + height) - (card.position.y + card.size.height)) < SNAP_THRESHOLD) {
        snappedY = card.position.y + card.size.height - height;
      }
      // Snap to center horizontally
      if (Math.abs((x + width/2) - (card.position.x + card.size.width/2)) < SNAP_THRESHOLD) {
        snappedX = card.position.x + card.size.width/2 - width/2;
      }
      // Snap to center vertically
      if (Math.abs((y + height/2) - (card.position.y + card.size.height/2)) < SNAP_THRESHOLD) {
        snappedY = card.position.y + card.size.height/2 - height/2;
      }
    });

    return { x: snappedX, y: snappedY };
  };

  if (config.tokens.length === 0) {
    return (
      <div className="backdrop-blur-lg rounded-lg p-4 border text-center bg-gray-800 text-white">
        <div className="text-6xl mb-4">📊</div>
        <h2 className="text-xl font-semibold mb-4 text-blue-400">
          Multi-Token Dashboard
        </h2>
        <p className="mb-6 text-gray-300">
          Add tokens to create your dashboard
        </p>
        <div className="rounded-lg p-4 bg-gray-700">
          <p className="text-sm text-gray-300">
            Use the sidebar to add your first token
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative w-full h-full min-h-[600px] bg-transparent"
      onClick={(e) => {
        // Check if we clicked on the background (not on a card or other element)
        const target = e.target as HTMLElement;
        if (target.classList.contains('bg-transparent') || target === e.currentTarget) {
          setSelectedCard(null);
          onCardSelect(null);
        }
      }}
    >
      {/* Grid Background for positioning reference */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="w-full h-full" style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px'
        }} />
      </div>

      {/* Drag Outline Overlay */}
      {draggedCard && (
        <div
          className="absolute pointer-events-none z-[999]"
          style={{
            left: config.tokens.find(c => c.id === draggedCard)?.position.x || 0,
            top: config.tokens.find(c => c.id === draggedCard)?.position.y || 0,
            width: config.tokens.find(c => c.id === draggedCard)?.size.width || 0,
            height: config.tokens.find(c => c.id === draggedCard)?.size.height || 0,
            transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
            border: '2px dashed #3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '8px'
          }}
        />
      )}

      {/* Snap Lines */}
      {snapLines.map((line, index) => (
        <div
          key={index}
          className="absolute pointer-events-none z-[998]"
          style={{
            left: line.type === 'vertical' ? line.x : 0,
            top: line.type === 'horizontal' ? line.y : 0,
            width: line.type === 'vertical' ? '2px' : '100%',
            height: line.type === 'horizontal' ? '2px' : '100%',
            backgroundColor: '#3b82f6',
            boxShadow: '0 0 4px rgba(59, 130, 246, 0.8)'
          }}
        />
      ))}

      {/* Token Cards */}
      {config.tokens.map((tokenCard) => (
        <motion.div
          key={tokenCard.id}
          drag
          dragMomentum={false}
          dragElastic={0}
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          onDragStart={(event, info) => {
            setDraggedCard(tokenCard.id);
            setDragOffset({ x: info.offset.x, y: info.offset.y });
          }}
          onDrag={(event, info) => {
            // Update drag offset for smooth movement
            setDragOffset({ x: info.offset.x, y: info.offset.y });
            
            // Calculate potential snap lines
            const newX = tokenCard.position.x + info.offset.x;
            const newY = tokenCard.position.y + info.offset.y;
            const lines: { x?: number; y?: number; type: 'horizontal' | 'vertical' }[] = [];
            
            config.tokens.forEach(card => {
              if (card.id === tokenCard.id) return;
              
              // Check for horizontal snap lines
              if (Math.abs(newX - card.position.x) < SNAP_THRESHOLD) {
                lines.push({ x: card.position.x, type: 'vertical' });
              }
              if (Math.abs((newX + tokenCard.size.width) - (card.position.x + card.size.width)) < SNAP_THRESHOLD) {
                lines.push({ x: card.position.x + card.size.width, type: 'vertical' });
              }
              if (Math.abs((newX + tokenCard.size.width/2) - (card.position.x + card.size.width/2)) < SNAP_THRESHOLD) {
                lines.push({ x: card.position.x + card.size.width/2, type: 'vertical' });
              }
              
              // Check for vertical snap lines
              if (Math.abs(newY - card.position.y) < SNAP_THRESHOLD) {
                lines.push({ y: card.position.y, type: 'horizontal' });
              }
              if (Math.abs((newY + tokenCard.size.height) - (card.position.y + card.size.height)) < SNAP_THRESHOLD) {
                lines.push({ y: card.position.y + card.size.height, type: 'horizontal' });
              }
              if (Math.abs((newY + tokenCard.size.height/2) - (card.position.y + card.size.height/2)) < SNAP_THRESHOLD) {
                lines.push({ y: card.position.y + card.size.height/2, type: 'horizontal' });
              }
            });
            
            setSnapLines(lines);
          }}
          onDragEnd={(event, info) => {
            setDraggedCard(null);
            setDragOffset({ x: 0, y: 0 });
            setSnapLines([]);
            
            // Calculate new position
            const newX = tokenCard.position.x + info.offset.x;
            const newY = tokenCard.position.y + info.offset.y;
            
            // Apply snapping
            const gridSnapped = snapToGrid(newX, newY);
            const finalPosition = snapToOtherCards(
              gridSnapped.x, 
              gridSnapped.y, 
              tokenCard.size.width, 
              tokenCard.size.height, 
              tokenCard.id
            );
            
            onTokenCardUpdate(tokenCard.id, {
              position: finalPosition
            });
          }}
          className={`absolute cursor-move ${selectedCard === tokenCard.id ? 'ring-2 ring-blue-500/0' : ''}`}
          style={{
            left: tokenCard.position.x,
            top: tokenCard.position.y,
            width: tokenCard.size.width,
            height: tokenCard.size.height,
            zIndex: draggedCard === tokenCard.id ? 1000 : selectedCard === tokenCard.id ? 100 : 10,
            transform: draggedCard === tokenCard.id ? `translate(${dragOffset.x}px, ${dragOffset.y}px)` : 'none',
            transition: draggedCard === tokenCard.id ? 'none' : 'transform 0.2s ease-out'
          }}
          onClick={() => setSelectedCard(tokenCard.id)}
        >
          {/* Card Header with Controls */}
          <div className={`absolute ${isMobileView ? 'top-1 right-1' : 'top-2 right-2'} flex space-x-1 z-50`}>
            {tokenCard.token ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTokenCardDelete(tokenCard.id);
                }}
                className={`${isMobileView ? 'bg-red-500/90' : 'bg-red-500/80 hover:bg-red-600/80'} text-white ${isMobileView ? 'p-0.5' : 'p-1'} rounded ${isMobileView ? 'text-xs' : 'text-xs'}`}
                title="Delete this card"
              >
                ×
              </button>
            ) : (
              <div className="text-gray-400 text-xs">
                Empty Card
              </div>
            )}
          </div>

          {/* Token Card Content */}
          <div className="w-full h-full">
            {tokenCard.token ? (
              <LivePreview
                config={{
                  token: tokenCard.token,
                  stats: tokenCard.stats,
                  customization: tokenCard.customization
                }}
                statResults={statResults[tokenCard.id] || {}}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-800/50 rounded-lg">
                <div className="text-center text-gray-400">
                  <div className="text-4xl mb-2">📊</div>
                  <div className="text-sm">Empty Card</div>
                  <div className="text-xs mt-1">Click "+ Add Token" to configure</div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      ))}



      {/* Instructions */}
      {config.tokens.length > 0 && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-lg border border-white/20 rounded-lg px-4 py-2 text-white text-sm z-40">
          <span>💡 Drag cards to reposition • Cards snap to grid and align with others</span>
        </div>
      )}
      
      {/* View Mode Indicator */}
      {isMobileView && (
        <div className="fixed top-4 right-4 bg-blue-500/90 backdrop-blur-lg border border-blue-300/30 rounded-lg px-3 py-1 text-white text-xs z-40">
          📱 Mobile View
        </div>
      )}
      

    </div>
  );
} 