// Shared chain mark — renders a chain's logo as a small circular chip instead
// of a text pill (ETH/PLS). Mirrors the DeBank / Zapper / Zerion convention
// already used on token icons in WalletCard / WatchlistPanel. The Ethereum mark
// is dark, so it sits on white; PulseChain's is colourful, so it sits on the
// app's dark navy — keeping both legible on any surface.

import type { ChainId } from '@/services';

const CHAIN_LOGO_SRC: Record<ChainId, string> = {
  ethereum: '/ethlogo.svg',
  pulsechain: '/LogoVector.svg',
};

export const CHAIN_NAMES: Record<ChainId, string> = {
  ethereum: 'Ethereum',
  pulsechain: 'PulseChain',
};

export function ChainLogo({
  chain,
  size = 16,
  className = '',
}: {
  chain: ChainId;
  size?: number;
  className?: string;
}) {
  const isEth = chain === 'ethereum';
  return (
    <span
      title={CHAIN_NAMES[chain]}
      aria-label={CHAIN_NAMES[chain]}
      role="img"
      style={{ width: size, height: size }}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${
        isEth ? 'bg-white' : 'bg-[#0b1f3a]'
      } ${className}`}
    >
      <img
        src={CHAIN_LOGO_SRC[chain]}
        alt={CHAIN_NAMES[chain]}
        className="h-full w-full object-contain p-[1px]"
      />
    </span>
  );
}
