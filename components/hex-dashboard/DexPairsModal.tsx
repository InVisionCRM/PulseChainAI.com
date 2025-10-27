import React from 'react';
import type { DexScreenerData } from '@/services/core/types';

interface DexPairsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  error: string | null;
  pairs: NonNullable<DexScreenerData['pairs']> | null;
}

const DexPairsModal: React.FC<DexPairsModalProps> = ({
  isOpen,
  onClose,
  isLoading,
  error,
  pairs,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.7)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
          <h3 className="text-white font-semibold">PulseChain HEX Liquidity Pairs (DexScreener)</h3>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white text-sm"
          >
            Close
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">
          {isLoading && (
            <div className="text-center text-slate-300 py-6">Loading pairs…</div>
          )}
          {error && (
            <div className="text-center text-red-300 py-6">{error}</div>
          )}
          {!isLoading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(pairs || []).map((p, idx) => (
                <a
                  key={`${p?.baseToken?.address}-${idx}`}
                  href={(p && (p as { url?: string }).url) || `https://dexscreener.com/pulsechain/${(p as { pairAddress?: string } | undefined)?.pairAddress ?? ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-white font-medium truncate">
                      {p?.baseToken?.symbol}/{p?.quoteToken?.symbol}
                    </div>
                    <div className="text-xs text-slate-400">FDV: ${p?.fdv?.toLocaleString?.() ?? '—'}</div>
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    <span className="mr-3">Price: ${Number(p?.priceUsd || 0).toFixed(6)}</span>
                    <span>Liquidity: ${p?.liquidity?.usd?.toLocaleString?.() ?? '—'}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    24h Vol: ${(p?.volume?.h24 ?? 0).toLocaleString?.()} • 24h Δ: {(p?.priceChange?.h24 ?? 0).toFixed?.(2)}%
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DexPairsModal;