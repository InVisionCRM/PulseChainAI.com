import React from 'react';
import { Transaction } from './types';
import { formatDateUTC } from './utils';

export interface GeickoRabbyTransactionsListProps {
  /** Array of transactions to display (will show first 4) */
  transactions: Transaction[];
}

/**
 * Rabby-style recent transactions list for Geicko
 * Displays up to 4 recent transactions with type-based color coding
 */
export default function GeickoRabbyTransactionsList({
  transactions,
}: GeickoRabbyTransactionsListProps) {
  const limitedTransactions = transactions.slice(0, 4);

  return (
    <section className="bg-white rounded-2xl shadow-[0_18px_50px_rgba(15,23,42,0.08)] px-4 py-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">Recent Transactions</h3>
      </div>
      <div className="mt-3 space-y-3">
        {limitedTransactions.length > 0 ? (
          limitedTransactions.map((tx, idx) => {
            const typeColorClass =
              tx.type === 'BUY'
                ? 'text-green-600'
                : tx.type === 'SELL'
                ? 'text-red-600'
                : 'text-blue-600';
            const borderColorClass =
              tx.type === 'BUY'
                ? 'border-green-100'
                : tx.type === 'SELL'
                ? 'border-red-100'
                : 'border-blue-100';

            return (
              <div
                key={`${tx.txHash}-${idx}`}
                className={`flex items-center justify-between rounded-2xl border ${borderColorClass} px-3 py-2`}
              >
                <div>
                  <p className={`text-sm font-semibold ${typeColorClass}`}>
                    {tx.type.toUpperCase()}
                  </p>
                  <p className="text-xs text-slate-500">{formatDateUTC(tx.timestamp)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    $
                    {tx.valueUsd?.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    }) || '—'}
                  </p>
                  <a
                    href={`https://scan.pulsechain.com/tx/${tx.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-500 hover:text-indigo-700"
                  >
                    View →
                  </a>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500">
            No swap activity found. This token may be new or have limited DEX trading.
          </div>
        )}
      </div>
    </section>
  );
}
