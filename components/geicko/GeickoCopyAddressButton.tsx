import React from 'react';
import { Copy } from 'lucide-react';
import { truncateAddress } from './utils';

export interface GeickoCopyAddressButtonProps {
  /** Ethereum address to copy */
  address: string;
  /** Optional label to display instead of address */
  label?: string;
  /** Callback when address is copied */
  onCopy?: (address: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Show full address or truncated (default: truncated) */
  showFull?: boolean;
  /** Icon size */
  iconSize?: 'sm' | 'md' | 'lg';
  /** Button variant */
  variant?: 'default' | 'compact' | 'icon-only';
  /** Custom truncation (start, end) - defaults to (6, 4) */
  truncate?: { start: number; end: number };
}

/**
 * Reusable button for copying Ethereum addresses with visual feedback
 * Used throughout Geicko for token addresses, holder addresses, etc.
 */
export default function GeickoCopyAddressButton({
  address,
  label,
  onCopy,
  className = '',
  showFull = false,
  iconSize = 'sm',
  variant = 'default',
  truncate = { start: 6, end: 4 },
}: GeickoCopyAddressButtonProps) {
  const handleClick = () => {
    if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(address);
    }
    onCopy?.(address);
  };

  // Icon size classes
  const iconSizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  // Display text
  const displayText = label || (showFull ? address : `${address.slice(0, truncate.start)}...${address.slice(-truncate.end)}`);

  // Variant styles
  if (variant === 'icon-only') {
    return (
      <button
        onClick={handleClick}
        className={`
          flex items-center justify-center w-6 h-6 rounded
          bg-white/5 border border-white/10
          hover:bg-white/10 transition-colors
          ${className}
        `}
        aria-label="Copy address"
        title={`Copy ${address}`}
      >
        <Copy className={`${iconSizeClasses[iconSize]} text-blue-400`} />
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={handleClick}
        className={`
          inline-flex items-center gap-1.5
          text-xs text-white/80 hover:text-white
          transition-colors
          ${className}
        `}
        title={`Copy ${address}`}
      >
        <span className="font-mono">{displayText}</span>
        <Copy className={`${iconSizeClasses[iconSize]} text-blue-400`} />
      </button>
    );
  }

  // Default variant
  return (
    <button
      onClick={handleClick}
      className={`
        flex items-center gap-1.5
        text-xs text-white/80 hover:text-white
        transition-colors
        bg-slate-900/30 backdrop-blur-sm
        px-2 py-1 rounded-lg
        border border-white/5 hover:border-white/10
        ${className}
      `}
      title={`Copy ${address}`}
    >
      <span className="font-mono">{displayText}</span>
      <Copy className={`${iconSizeClasses[iconSize]} text-blue-400`} />
    </button>
  );
}
