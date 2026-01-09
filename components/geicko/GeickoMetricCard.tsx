import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LoaderThree } from '@/components/ui/loader';

export interface GeickoMetricCardProps {
  /** Card title/label */
  label: string;
  /** Main value to display */
  value: string | number | React.ReactNode;
  /** Optional icon or emoji */
  icon?: React.ReactNode;
  /** Loading state */
  isLoading?: boolean;
  /** Optional click handler */
  onClick?: () => void;
  /** Visual variant */
  variant?: 'default' | 'highlight' | 'warning';
  /** Optional subtext below value */
  subtext?: string;
  /** Optional tooltip content for value */
  tooltip?: string | React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Optional children for custom content */
  children?: React.ReactNode;
}

/**
 * Reusable metric card component for displaying stats and metrics
 * Used throughout Geicko for burned tokens, holders, supply, etc.
 */
export default function GeickoMetricCard({
  label,
  value,
  icon,
  isLoading = false,
  onClick,
  variant = 'default',
  subtext,
  tooltip,
  className = '',
  size = 'md',
  children,
}: GeickoMetricCardProps) {
  // Variant styles
  const variantClasses = {
    default: 'from-white/5 via-blue-500/5 to-white/5',
    highlight: 'from-purple-500/10 via-blue-500/10 to-purple-500/10 border border-purple-500/20',
    warning: 'from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/20',
  };

  // Size styles
  const sizeClasses = {
    sm: 'p-2 min-h-[50px]',
    md: 'p-3 min-h-[60px]',
    lg: 'p-4 min-h-[80px]',
  };

  const valueSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  };

  const baseClasses = `
    relative bg-gradient-to-br ${variantClasses[variant]}
    rounded-lg ${sizeClasses[size]}
    ${onClick ? 'cursor-pointer hover:bg-white/10 transition-colors' : ''}
    ${className}
  `;

  const renderValue = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-2">
          <LoaderThree />
        </div>
      );
    }

    if (children) {
      return children;
    }

    const valueContent = (
      <div className={`${valueSizeClasses[size]} text-white font-semibold`}>
        {value}
      </div>
    );

    // Wrap in tooltip if tooltip content provided
    if (tooltip) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">{valueContent}</div>
          </TooltipTrigger>
          <TooltipContent>
            {typeof tooltip === 'string' ? <p>{tooltip}</p> : tooltip}
          </TooltipContent>
        </Tooltip>
      );
    }

    return valueContent;
  };

  return (
    <div className={baseClasses} onClick={onClick}>
      {/* Label */}
      <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider flex items-center gap-1.5">
        {icon && <span className="text-sm">{icon}</span>}
        {label}
      </div>

      {/* Value */}
      <div className="flex flex-col items-center justify-center">
        {renderValue()}

        {/* Optional subtext */}
        {subtext && !isLoading && (
          <div className="text-xs text-gray-500 mt-1">{subtext}</div>
        )}
      </div>
    </div>
  );
}
