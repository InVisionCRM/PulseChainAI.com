import React from 'react';
import { DexScreenerData } from './types';

export interface GeickoSwitchTabProps {
  /** DexScreener data with token address */
  dexScreenerData: DexScreenerData | null;
  /** Token contract address (fallback) */
  apiTokenAddress: string;
}

/**
 * Switch tab for Geicko
 * Embeds Switch.win widget for token swapping
 */
export default function GeickoSwitchTab({
  dexScreenerData,
  apiTokenAddress,
}: GeickoSwitchTabProps) {
  const tokenAddress = dexScreenerData?.pairs?.[0]?.baseToken?.address || apiTokenAddress;

  const switchUrl = `https://switch.win/widget?network=pulsechain&background_color=000000&font_color=ffffff&secondary_font_color=7a7a7a&border_color=01e401&backdrop_color=transparent&from=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&to=${tokenAddress}`;

  return (
    <div className="w-full flex items-center justify-center p-4">
      <iframe
        src={switchUrl}
        allow="clipboard-read; clipboard-write"
        width="100%"
        height="720"
        className="border-0 rounded w-full max-w-4xl min-h-[720px]"
        title="Token Swap Interface"
      />
    </div>
  );
}
