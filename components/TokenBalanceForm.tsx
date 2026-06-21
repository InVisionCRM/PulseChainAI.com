'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TokenData } from './StatCounterBuilder';
import TokenSelector from './TokenSelector';

interface TokenBalanceFormProps {
  onConfirm: (walletAddress: string, tokenAddress: string) => void;
  onCancel: () => void;
}

export default function TokenBalanceForm({ onConfirm, onCancel }: TokenBalanceFormProps) {
  const [walletAddress, setWalletAddress] = useState('');
  const [selectedToken, setSelectedToken] = useState<TokenData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!walletAddress.trim()) {
      setError('Please enter a wallet address');
      return;
    }
    
    if (!selectedToken) {
      setError('Please select a token');
      return;
    }

    // Basic address validation
    if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
      setError('Please enter a valid wallet address');
      return;
    }

    setError(null);
    onConfirm(walletAddress.trim(), selectedToken.address);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-[var(--panel)] rounded-lg p-6 border border-[var(--line-strong)]"
    >
      <h3 className="text-lg font-semibold text-[var(--text)] mb-4">Token Balance Configuration</h3>
      
      <div className="space-y-4">
        {/* Wallet Address Input */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
            Wallet Address
          </label>
          <input
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 bg-[var(--panel)] border border-[var(--line)] rounded text-[var(--text)] text-sm placeholder-gray-400"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Enter the address you want to check the balance for
          </p>
        </div>

        {/* Token Selector */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-muted)] mb-2">
            Token Contract
          </label>
          <TokenSelector
            selectedToken={selectedToken}
            onTokenSelect={setSelectedToken}
            onError={setError}
            isLoading={false}
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Select the token you want to check the balance of
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded p-2">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 bg-[var(--app-bg)] hover:bg-[var(--app-bg)] text-[var(--text)] rounded-lg font-medium transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </motion.div>
  );
} 