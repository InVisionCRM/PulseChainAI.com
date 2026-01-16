'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { LoaderThree } from "@/components/ui/loader";
import SourceCodeTab from '@/components/SourceCodeTab';
import { fetchContract, fetchReadMethods } from '../services/pulsechainService';
import { fetchReadMethodsWithValues } from '../services/index';
import type { ContractData, AbiItem } from '../types';

interface TokenContractViewProps {
  contractAddress: string;
  compact?: boolean;
}

export default function TokenContractView({ contractAddress, compact = false }: TokenContractViewProps): JSX.Element {
  const [contractData, setContractData] = useState<ContractData | null>(null);
  const [readFunctionsWithValues, setReadFunctionsWithValues] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadContract = useCallback(async () => {
    if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      setError('Invalid contract address');
      return;
    }

    setIsLoading(true);
    setError(null);
    // Don't clear contractData immediately - preserve it until new data loads

    try {
      // Fetch contract data
      const result = await fetchContract(contractAddress);
      const data = result.data;
      
      // Preserve existing source code if new fetch returns empty but we have existing data
      const existingSourceCode = contractData?.source_code;
      const newSourceCode = data?.source_code;
      
      // Only update if we have valid data with source code or ABI
      if (data && (newSourceCode || (data.abi && Array.isArray(data.abi) && data.abi.length > 0))) {
        // If new fetch has empty source but we have existing source, preserve it
        if (!newSourceCode && existingSourceCode && data.abi && Array.isArray(data.abi) && data.abi.length > 0) {
          // Keep existing source code but update ABI
          setContractData({
            ...data,
            source_code: existingSourceCode
          });
          console.log('Preserved existing source code, updated ABI');
        } else {
          setContractData(data);
        }
        
        console.log('Contract data loaded in TokenContractView:', {
          name: data.name,
          hasSourceCode: !!data.source_code,
          sourceCodeLength: data.source_code?.length || 0,
          abiLength: data.abi?.length || 0,
          isVerified: data.is_verified
        });
      } else {
        console.warn('Contract data missing source code and ABI:', data);
        // If we have existing data with source code, don't overwrite with empty data
        if (contractData?.source_code && !data?.source_code) {
          console.log('Preserving existing contract data with source code');
          // Don't update - keep existing data
        } else if (data) {
          setContractData(data);
        }
      }

      // Parse ABI and fetch read method values (don't block on this)
      if (data.abi && Array.isArray(data.abi) && data.abi.length > 0) {
        // Fetch read methods in background - don't let errors affect contract display
        fetchReadMethodsWithValues(contractAddress, data.abi)
          .then((readMethodsWithVals) => {
            setReadFunctionsWithValues(readMethodsWithVals);
          })
          .catch((readError) => {
            console.error('Error fetching read methods (non-blocking):', readError);
            // Don't set error state - contract display should still work
          });
      }

    } catch (e) {
      console.error('Error loading contract:', e);
      setError(e instanceof Error ? e.message : 'Failed to load contract');
      // Don't clear contractData on error - preserve existing data
    } finally {
      setIsLoading(false);
    }
  }, [contractAddress]);

  useEffect(() => {
    loadContract();
  }, [loadContract]);

  // Parse ABI for read and write functions
  const abiReadFunctions = contractData?.abi
    ? contractData.abi.filter((item: AbiItem) =>
        item.type === 'function' &&
        (item.stateMutability === 'view' || item.stateMutability === 'pure')
      )
    : [];

  const abiWriteFunctions = contractData?.abi
    ? contractData.abi.filter((item: AbiItem) =>
        item.type === 'function' &&
        item.stateMutability !== 'view' &&
        item.stateMutability !== 'pure'
      )
    : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <LoaderThree />
          <p className="text-gray-400 text-xs mt-2">Loading contract...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-400 text-xs">{error}</p>
          <button
            onClick={loadContract}
            className="mt-2 px-3 py-1 bg-orange-600 hover:bg-orange-700 rounded text-xs text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!contractData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 text-xs">No contract data available</p>
      </div>
    );
  }

  return (
    <div className={`h-full overflow-y-auto ${compact ? 'text-xs' : 'text-sm'}`}>
      <SourceCodeTab
        sourceCode={contractData.source_code || ''}
        readFunctions={readFunctionsWithValues.length > 0 ? readFunctionsWithValues : abiReadFunctions}
        writeFunctions={abiWriteFunctions}
        isAnalyzingAI={false}
      />
    </div>
  );
}
