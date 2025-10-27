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

    try {
      // Fetch contract data
      const result = await fetchContract(contractAddress);
      const data = result.data;
      setContractData(data);
      console.log('Contract data loaded in TokenContractView:', data);

      // Parse ABI and fetch read method values
      if (data.abi && Array.isArray(data.abi)) {
        try {
          const readMethodsWithVals = await fetchReadMethodsWithValues(contractAddress, data.abi);
          setReadFunctionsWithValues(readMethodsWithVals);
        } catch (readError) {
          console.error('Error fetching read methods:', readError);
          // Continue even if read methods fail
        }
      }

    } catch (e) {
      console.error('Error loading contract:', e);
      setError(e instanceof Error ? e.message : 'Failed to load contract');
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
