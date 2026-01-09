import React from 'react';
import { OwnershipData } from './types';
import { PUMP_TIRES_CREATOR } from './utils';

export interface GeickoOwnershipPanelProps {
  /** Ownership data with renounced status and addresses */
  ownershipData: OwnershipData;
  /** Token contract address for linking */
  tokenAddress: string;
}

/**
 * Ownership panel for Geicko
 * Displays contract renouncement status and owner/creator info
 */
export default function GeickoOwnershipPanel({
  ownershipData,
  tokenAddress,
}: GeickoOwnershipPanelProps) {
  const isRenounced =
    ownershipData.isRenounced ||
    ownershipData.creatorAddress?.toLowerCase() === PUMP_TIRES_CREATOR.toLowerCase();

  const isPumpTires =
    ownershipData.creatorAddress?.toLowerCase() === PUMP_TIRES_CREATOR.toLowerCase();

  return (
    <div className="bg-gradient-to-br from-white/5 via-blue-500/5 to-white/5 rounded-lg p-3">
      <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wider">
        Ownership
      </div>

      {ownershipData.isLoading ? (
        <div className="text-center text-gray-500 text-sm">Loading...</div>
      ) : isRenounced ? (
        <div className="text-center">
          <div className="text-base text-green-400 font-semibold">Renounced ✓</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {isPumpTires ? 'Pump.Tires' : 'No Owner'}
          </div>
        </div>
      ) : (
        <div className="text-center">
          <div className="text-base text-red-400 font-semibold">Not Renounced</div>
          {ownershipData.ownerAddress && (
            <a
              href={`https://scan.pulsechain.com/address/${ownershipData.ownerAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 font-mono mt-0.5 inline-block"
              title={ownershipData.ownerAddress}
            >
              ...{ownershipData.ownerAddress.slice(-6)}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
