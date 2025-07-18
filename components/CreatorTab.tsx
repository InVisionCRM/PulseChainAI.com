import React, { useState } from 'react';
import type { TokenBalance, Transaction, TokenInfo } from '@/types';
import LoadingSpinner from './icons/LoadingSpinner';

const truncateHash = (hash: string) => `${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`;

const CopyButton: React.FC<{ text: string; className?: string }> = ({ text, className = "" }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    return (
        <button
            onClick={handleCopy}
            className={`ml-2 p-1 rounded hover:bg-slate-600 transition-colors ${className}`}
            title="Copy to clipboard"
        >
            {copied ? (
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
            ) : (
                <svg className="w-4 h-4 text-slate-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            )}
        </button>
    );
};

const InfoRow: React.FC<{ label: string; value: string; link: string; }> = ({ label, value, link }) => (
    <div className="flex justify-between items-center text-sm py-2 border-b border-slate-700/50">
        <span className="text-slate-400">{label}</span>
        <div className="flex items-center">
            <a href={link} target="_blank" rel="noopener noreferrer" title={value} className="font-mono text-purple-400 hover:text-purple-300 transition-colors break-all text-right">
                {truncateHash(value)}
            </a>
            <CopyButton text={value} />
        </div>
    </div>
);

const CreatorTab: React.FC<{
    creatorAddress: string | null;
    creationTxHash: string | null;
    tokenBalance: TokenBalance | null;
    transactions: Transaction[] | null;
    tokenInfo: TokenInfo | null;
    isLoading: boolean;
}> = ({ creatorAddress, creationTxHash, tokenBalance, transactions, tokenInfo, isLoading }) => {

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center text-center p-8 h-full">
                <LoadingSpinner className="w-8 h-8 text-purple-400" />
                <p className="mt-3 text-slate-300">Loading creator details...</p>
            </div>
        );
    }

    if (!creatorAddress) {
        return (
            <div className="flex items-center justify-center p-8 text-slate-400 h-full">
                Creator information not available (contract may be created by another contract).
            </div>
        );
    }

    const formatBalance = () => {
        if (!tokenBalance || !tokenInfo) return null;
        const decimals = parseInt(tokenInfo.decimals, 10);
        const balance = BigInt(tokenBalance.value);
        const divisor = BigInt(10) ** BigInt(decimals);
        const formatted = Number(balance * 10000n / divisor) / 10000;
        return formatted.toLocaleString(undefined, { maximumFractionDigits: 4 });
    };

    const formattedBalance = formatBalance();
    
    return (
        <div className="p-4 sm:p-6 space-y-6">
            <section>
                <h3 className="text-lg font-bold text-white mb-2">Creator Details</h3>
                <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                    {creatorAddress && (
                        <InfoRow label="Address" value={creatorAddress} link={`https://scan.pulsechain.com/address/${creatorAddress}`} />
                    )}
                    {creationTxHash && (
                         <InfoRow label="Creation Tx" value={creationTxHash} link={`https://scan.pulsechain.com/tx/${creationTxHash}`} />
                    )}
                </div>
            </section>
            
            {tokenInfo && (
                <section>
                    <h3 className="text-lg font-bold text-white mb-2">Token Holdings</h3>
                     <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 text-sm">
                        {formattedBalance ? (
                            <p>Creator holds <span className="font-bold text-purple-400">{formattedBalance}</span> {tokenInfo.symbol}.</p>
                        ) : (
                            <p className="text-slate-400">Creator does not hold any {tokenInfo.symbol}.</p>
                        )}
                    </div>
                </section>
            )}

            <section>
                <h3 className="text-lg font-bold text-white mb-2">Other Contracts Created by this Address</h3>
                <div className="bg-slate-900/50 rounded-lg border border-slate-700 max-h-96 overflow-y-auto">
                    {transactions && transactions.length > 0 ? (
                        <ul className="divide-y divide-slate-700/50">
                           {transactions.map(tx => (
                               <li key={tx.hash} className="p-3 hover:bg-slate-800/50 transition-colors">
                                   <div className="flex justify-between items-center text-sm">
                                       <div>
                                           <span className="text-slate-400 mr-2">Tx:</span>
                                           <a href={`https://scan.pulsechain.com/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="font-mono text-purple-400 hover:underline">{truncateHash(tx.hash)}</a>
                                       </div>
                                       <span className="text-slate-500 text-xs">
                                           {new Date(tx.timestamp).toLocaleString()}
                                       </span>
                                   </div>
                                   {tx.to && (
                                    <div className="text-xs mt-1">
                                        <span className="text-slate-400 mr-2">Contract:</span>
                                        <a href={`https://scan.pulsechain.com/address/${tx.to.hash}`} target="_blank" rel="noopener noreferrer" className="font-mono text-cyan-400 hover:underline">{tx.to.name || tx.to.hash}</a>
                                    </div>
                                   )}
                               </li>
                           ))}
                        </ul>
                    ) : (
                        <p className="p-8 text-center text-slate-400">No other contract creation transactions found for this address.</p>
                    )}
                </div>
            </section>
        </div>
    );
};

export default CreatorTab;
