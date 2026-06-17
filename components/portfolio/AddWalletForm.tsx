'use client';

import { useState, type FormEvent } from 'react';
import { IconPlus, IconAlertCircle } from '@tabler/icons-react';
import { usePortfolioStore } from '@/lib/stores/portfolioStore';
import type { ChainId } from '@/services';

const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;
const ALL_CHAINS: { id: ChainId; label: string }[] = [
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'pulsechain', label: 'PulseChain' },
];
const CHAIN_LOGO: Record<ChainId, string> = {
  ethereum: '/ethlogo.svg',
  pulsechain: '/LogoVector.svg',
};

export function AddWalletForm() {
  const addWallet = usePortfolioStore((s) => s.addWallet);
  const refreshWallet = usePortfolioStore((s) => s.refreshWallet);

  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [chains, setChains] = useState<ChainId[]>(['ethereum', 'pulsechain']);
  const [error, setError] = useState<string | null>(null);

  const toggleChain = (id: ChainId) =>
    setChains((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = address.trim();
    if (!ADDRESS_RX.test(trimmed)) {
      setError('Enter a valid 0x… EVM address (40 hex characters).');
      return;
    }
    if (chains.length === 0) {
      setError('Select at least one chain.');
      return;
    }
    const added = addWallet(trimmed, label.trim() || undefined, chains);
    if (!added) {
      setError('This wallet is already in your portfolio.');
      return;
    }
    setError(null);
    setAddress('');
    setLabel('');
    void refreshWallet(trimmed);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-5 space-y-4"
    >
      <div className="flex flex-col md:flex-row gap-3 md:items-end">
        <label className="flex-1 space-y-1">
          <span className="text-xs uppercase tracking-wide text-white/60 font-semibold">
            Wallet address
          </span>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
            className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-white font-mono placeholder-white/30 focus:outline-none focus:border-orange-500/60"
          />
        </label>
        <label className="md:w-56 space-y-1">
          <span className="text-xs uppercase tracking-wide text-white/60 font-semibold">
            Label (optional)
          </span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Main wallet"
            className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/60"
          />
        </label>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-orange-500/90 hover:bg-orange-500 text-white text-sm font-semibold px-4 py-2 transition-colors"
        >
          <IconPlus className="h-4 w-4" />
          Add wallet
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-wide text-white/60 font-semibold">
          Track on
        </span>
        {ALL_CHAINS.map((c) => {
          const active = chains.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleChain(c.id)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                active
                  ? 'border-white/15 bg-white/[0.08] text-white'
                  : 'border-white/10 text-white/40 hover:text-white/70'
              }`}
            >
              <img
                src={CHAIN_LOGO[c.id]}
                alt=""
                className={`h-4 w-4 object-contain ${active ? '' : 'grayscale opacity-60'}`}
              />
              {c.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-300">
          <IconAlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </form>
  );
}
