import React from 'react';

export interface GeickoSwapTabProps {
  // No props needed for this component
}

/**
 * Swap tab for Geicko
 * Displays Internet Money swap website in a full iframe
 */
export default function GeickoSwapTab({}: GeickoSwapTabProps = {}) {
  return (
    <div className="w-full h-full">
      <iframe
        src="https://swap.internetmoney.io/"
        width="100%"
        height="100%"
        className="border-4 border-brand-navy w-full min-h-[600px]"
        style={{ zoom: '0.9' }}
        title="Internet Money Swap"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}