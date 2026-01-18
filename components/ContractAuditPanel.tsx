'use client';

import React from 'react';
import type { ContractAuditResult } from '@/types';
import { LoaderOne } from '@/components/ui/loader';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ContractAuditPanelProps {
  auditResult: ContractAuditResult | null;
  isLoading: boolean;
  isContractVerified?: boolean;
  hasSourceCode?: boolean;
}

/**
 * Formats an address to 0x...0000 format (0x + first 4 hex chars + ... + last 4 hex chars)
 */
function formatAddress(address: string | null): string {
  if (!address) return '—';
  if (!address.startsWith('0x') || address.length < 10) return address;
  // Skip '0x' prefix, take first 4 hex chars, then last 4 hex chars
  const hexPart = address.slice(2);
  return `0x${hexPart.slice(0, 4)}...${hexPart.slice(-4)}`;
}

/**
 * Formats boolean to Yes/No
 */
function formatBoolean(value: boolean): string {
  return value ? 'Yes' : 'No';
}

const auditChecks = [
  { 
    key: 'ownershipRenounced', 
    label: 'Ownership renounced',
    tooltip: 'Whether the contract owner has permanently renounced ownership, making the contract immutable and trustless.'
  },
  { 
    key: 'hiddenOwner', 
    label: 'Hidden owner',
    tooltip: 'Whether the contract owner is different from the creator and is itself a contract address, potentially hiding control.'
  },
  { 
    key: 'honeypot', 
    label: 'Honeypot',
    tooltip: 'Whether the contract appears to be a honeypot - allowing buys but preventing sells through transfer restrictions.'
  },
  { 
    key: 'proxyContract', 
    label: 'Proxy contract',
    tooltip: 'Whether the contract uses a proxy pattern, allowing the implementation to be upgraded or changed.'
  },
  { 
    key: 'mintable', 
    label: 'Mintable',
    tooltip: 'Whether the contract has mint functionality, allowing new tokens to be created after deployment.'
  },
  { 
    key: 'transferPausable', 
    label: 'Transfer pausable',
    tooltip: 'Whether the contract can pause transfers, allowing the owner to freeze all token movements.'
  },
  { 
    key: 'tradingCooldown', 
    label: 'Trading cooldown',
    tooltip: 'Whether the contract enforces cooldown periods between trades, limiting trading frequency.'
  },
  { 
    key: 'hasBlacklist', 
    label: 'Has blacklist',
    tooltip: 'Whether the contract can blacklist addresses, preventing them from trading or holding tokens.'
  },
  { 
    key: 'hasWhitelist', 
    label: 'Has whitelist',
    tooltip: 'Whether the contract uses whitelisting, restricting trading to only approved addresses.'
  },
  { 
    key: 'buyTax', 
    label: 'Buy tax',
    tooltip: 'Whether the contract charges a fee on token purchases, reducing the amount received.'
  },
  { 
    key: 'sellTax', 
    label: 'Sell tax',
    tooltip: 'Whether the contract charges a fee on token sales, reducing the amount received.'
  },
] as const;

export default function ContractAuditPanel({ 
  auditResult, 
  isLoading, 
  isContractVerified = true,
  hasSourceCode = true 
}: ContractAuditPanelProps) {
  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-4">
        <div className="flex items-center justify-center py-8">
          <LoaderOne />
        </div>
      </div>
    );
  }

  // Show message if contract is not verified or has no source code
  if (!isContractVerified || !hasSourceCode) {
    return (
      <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
          Contract Audit
        </h3>
        <div className="text-center py-8">
          <div className="mb-4">
            <svg className="w-12 h-12 text-yellow-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-yellow-400 font-semibold mb-2">Contract Not Verified</p>
          <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed">
            This contract's source code is not available on the blockchain. Without verified source code, 
            we cannot perform a comprehensive security audit. The contract may still function, but we 
            recommend caution when interacting with unverified contracts as their behavior cannot be verified.
          </p>
        </div>
      </div>
    );
  }

  if (!auditResult) {
    return (
      <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-4">
        <div className="text-center text-gray-400 text-sm py-4">
          No audit data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
        Contract Audit
      </h3>
      
      <div className="space-y-2">
        {auditChecks.map((check) => {
          const value = auditResult[check.key as keyof ContractAuditResult] as boolean;
          // Ownership renounced is reversed: green for Yes, red for No
          const isOwnershipRenounced = check.key === 'ownershipRenounced';
          const colorClass = isOwnershipRenounced
            ? (value ? 'text-green-400' : 'text-red-400')
            : (value ? 'text-red-400' : 'text-green-400');
          
          return (
            <div
              key={check.key}
              className="flex items-center justify-between py-2 border-b border-white/5 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      className="text-gray-500 hover:text-gray-400 transition-colors"
                      aria-label={`Information about ${check.label}`}
                      title={`Information about ${check.label}`}
                      type="button"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="sr-only">Information about {check.label}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-xs">{check.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
                <span className="text-xs text-gray-400 font-medium">{check.label}</span>
              </div>
              <span className={`text-xs font-semibold ${colorClass}`}>
                {formatBoolean(value)}
              </span>
            </div>
          );
        })}
        
        {/* Creator and Owner Addresses */}
        <div className="pt-2 mt-2 border-t border-white/10">
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-gray-400 font-medium">Creator address</span>
            <span className="text-xs text-white font-mono font-semibold">
              {formatAddress(auditResult.creatorAddress)}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-gray-400 font-medium">Owner address</span>
            <span className="text-xs text-white font-mono font-semibold">
              {formatAddress(auditResult.ownerAddress)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
