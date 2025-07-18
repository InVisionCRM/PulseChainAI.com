import React from 'react';
import Image from 'next/image';
import type { TokenInfo } from '@/types';
import { GlowingEffect } from '@/components/ui/glowing-effect';

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between items-baseline text-xs md:text-sm">
    <span className="text-slate-400">{label}</span>
    <span className="font-mono text-slate-200 text-right">{value || 'N/A'}</span>
  </div>
);

const TokenInfoCard: React.FC<{ tokenInfo: TokenInfo | null }> = ({ tokenInfo }) => {
  if (!tokenInfo) {
    return (
      <div className="relative bg-slate-800/50 p-3 md:p-4 lg:p-6 rounded-xl shadow-lg border border-slate-700 h-full flex items-center justify-center">
        <GlowingEffect disabled={false} glow={true} />
        <p className="text-slate-400 text-sm md:text-base">Not a recognized token contract.</p>
      </div>
    );
  }

  return (
    <div className="relative bg-slate-800/50 p-3 md:p-4 lg:p-6 rounded-xl shadow-lg border border-slate-700">
      <GlowingEffect disabled={false} glow={true} />
      <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
        {tokenInfo.icon_url ? 
          <Image src={tokenInfo.icon_url} alt={`${tokenInfo.name} logo`} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-700" width={48} height={48} /> :
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-700 flex items-center justify-center text-purple-400 font-bold text-lg md:text-xl">?</div>
        }
        <div>
          <h3 className="text-lg md:text-xl font-bold text-white">{tokenInfo.name} ({tokenInfo.symbol})</h3>
          <p className="text-xs font-mono text-slate-400 break-all">{tokenInfo.address}</p>
        </div>
      </div>
      <div className="space-y-2">
        <DetailItem label="Total Supply" value={Number(tokenInfo.total_supply).toLocaleString()} />
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
