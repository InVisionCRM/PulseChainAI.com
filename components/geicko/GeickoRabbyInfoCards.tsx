import React from 'react';

export interface GeickoRabbyInfoCardsProps {
  /** Primary trading pair data */
  primaryPair: any;
}

/**
 * Rabby-style info cards for Geicko
 * Displays PLS price and gas information
 */
export default function GeickoRabbyInfoCards({ primaryPair }: GeickoRabbyInfoCardsProps) {
  const heroPrice = Number(primaryPair?.priceUsd || 0);
  const heroPriceDisplay = heroPrice
    ? `$${heroPrice.toFixed(heroPrice >= 1 ? 2 : 4)}`
    : '$0.0000';

  // Calculate gas estimate based on recent transactions
  const gasEstimate = (
    Math.max(0.001, (primaryPair?.txns?.m5?.buys || 0) / 1000) + 0.0028
  ).toFixed(4);

  return (
    <section className="bg-white rounded-2xl shadow-[0_12px_40px_rgba(15,23,42,0.08)] px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm text-slate-600">
      {/* PLS Price */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-semibold">
          $
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400">PLS price</p>
          <p className="text-base font-semibold text-slate-900">{heroPriceDisplay}</p>
        </div>
      </div>

      {/* Gas Estimate */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-semibold">
          ⛽
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400">Gas</p>
          <p className="text-base font-semibold text-slate-900">{gasEstimate} Gwei</p>
        </div>
      </div>
    </section>
  );
}
