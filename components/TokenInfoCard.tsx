import React from 'react';
import Image from 'next/image';
import type { TokenInfo, DexScreenerData } from '@/types';
import { GlowingEffect } from '@/components/ui/glowing-effect';
import { formatTokenAmount } from '@/lib/utils';

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between items-baseline text-xs md:text-sm">
    <span className="text-[var(--text-muted)]">{label}</span>
    <span className="font-mono text-[var(--text)] text-right">{value || 'N/A'}</span>
  </div>
);

const TokenInfoCard: React.FC<{ tokenInfo: TokenInfo | null; dexScreenerData?: DexScreenerData | null }> = ({ tokenInfo, dexScreenerData }) => {
  if (!tokenInfo) {
    return (
      <div className="relative bg-[var(--panel)] p-3 md:p-4 lg:p-6 rounded-xl shadow-lg border border-[var(--line)] h-full flex items-center justify-center">
        <GlowingEffect disabled={false} glow={true} />
        <p className="text-[var(--text-muted)] text-sm md:text-base">Not a recognized token contract.</p>
      </div>
    );
  }

  return (
    <div className="relative bg-[var(--panel)] p-3 md:p-4 lg:p-6 rounded-xl shadow-lg border border-[var(--line)]">
      <GlowingEffect disabled={false} glow={true} />
      <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
        {/* Use DexScreener image if available, otherwise fallback to tokenInfo.icon_url */}
        {dexScreenerData?.info?.imageUrl ? (
          <img 
            src={dexScreenerData.info.imageUrl} 
            alt={`${tokenInfo.name} logo`} 
            className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[var(--surface-2)] object-cover"
            onError={(e) => {
              // Fallback to tokenInfo.icon_url if DexScreener image fails
              if (tokenInfo.icon_url) {
                e.currentTarget.src = tokenInfo.icon_url;
              } else {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }
            }}
          />
        ) : tokenInfo.icon_url ? (
          <Image src={tokenInfo.icon_url} alt={`${tokenInfo.name} logo`} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[var(--surface-2)]" width={48} height={48} />
        ) : (
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-blue-400 font-bold text-lg md:text-xl hidden">?</div>
        )}
        <div>
          <h3 className="text-lg md:text-xl font-bold text-[var(--text)]">{tokenInfo.name} ({tokenInfo.symbol})</h3>
          <p className="text-xs font-mono text-[var(--text-muted)] break-all">{tokenInfo.address}</p>
          {/* Token description from DexScreener */}
          {dexScreenerData?.info?.header && (
            <p className="text-xs text-[var(--text-muted)] mt-1">{dexScreenerData.info.header}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <DetailItem label="Total Supply" value={formatTokenAmount(tokenInfo.total_supply, tokenInfo.decimals)} />
        <DetailItem label="Decimals" value={tokenInfo.decimals} />
        <DetailItem label="Holders" value={Number(tokenInfo.holders).toLocaleString()} />
        <DetailItem label="Type" value={tokenInfo.type} />
        <DetailItem label="Exchange Rate" value={tokenInfo.exchange_rate ? `$${Number(tokenInfo.exchange_rate).toFixed(4)}` : 'N/A'} />
        <DetailItem label="Mkt Cap" value={tokenInfo.circulating_market_cap ? `$${Number(tokenInfo.circulating_market_cap).toLocaleString(undefined, {maximumFractionDigits: 0})}` : 'N/A'} />
      </div>
    </div>
  );
};

export default TokenInfoCard;
