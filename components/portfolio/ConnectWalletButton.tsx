'use client';

// Minimal injected-wallet connect ("browser extension" wallets — MetaMask,
// Rabby, etc.). Reads the account(s) the wallet exposes and adds them to the
// tracked portfolio. Strictly read-only: we never request a signature.
//
// Mobile wallets / WalletConnect (and in-app actions like revoke/swap) would
// need RainbowKit/Reown + a WalletConnect projectId and a provider tree — a
// deliberate follow-up, not wired here.

import { useCallback, useEffect, useState } from 'react';
import { IconWallet } from '@tabler/icons-react';
import { usePortfolioStore } from '@/lib/stores/portfolioStore';

interface InjectedProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

const getEth = (): InjectedProvider | null =>
  typeof window !== 'undefined'
    ? ((window as unknown as { ethereum?: InjectedProvider }).ethereum ?? null)
    : null;

const ADDRESS_RX = /^0x[a-fA-F0-9]{40}$/;

export function ConnectWalletButton() {
  const addWallet = usePortfolioStore((s) => s.addWallet);
  const refreshWallet = usePortfolioStore((s) => s.refreshWallet);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Assume present during SSR/first paint; correct on mount so we don't flash
  // "Get a wallet" before the injected provider is detected.
  const [hasWallet, setHasWallet] = useState(true);

  useEffect(() => {
    setHasWallet(!!getEth());
  }, []);

  const connect = useCallback(async () => {
    const eth = getEth();
    if (!eth) {
      setHasWallet(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Prompt for account access (lets the user pick multiple), then read the
      // granted set. Not all wallets implement wallet_requestPermissions, so
      // it's best-effort — eth_requestAccounts still triggers the prompt.
      try {
        await eth.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
      } catch {
        /* ignore — fall through to eth_requestAccounts */
      }
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as unknown;
      const list = Array.isArray(accounts) ? (accounts as string[]) : [];
      if (list.length === 0) {
        setError('No accounts shared.');
        return;
      }
      let added = 0;
      for (const a of list) {
        if (typeof a === 'string' && ADDRESS_RX.test(a) && addWallet(a)) {
          added++;
          void refreshWallet(a);
        }
      }
      if (added === 0) setError('Those accounts are already tracked.');
    } catch (e) {
      const code = (e as { code?: number })?.code;
      setError(code === 4001 ? 'Connection rejected.' : 'Could not connect.');
    } finally {
      setBusy(false);
    }
  }, [addWallet, refreshWallet]);

  if (!hasWallet) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 sm:gap-1.5 rounded-lg border border-[var(--line)] text-[var(--text-muted)] hover:text-[var(--text)] text-xs sm:text-sm font-semibold px-2 py-1.5 sm:px-3 sm:py-2 transition-colors"
        title="No browser wallet detected — get one to connect"
      >
        <IconWallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        Get a wallet
      </a>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={connect}
        disabled={busy}
        className="inline-flex items-center gap-1 sm:gap-1.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] text-xs sm:text-sm font-semibold px-2 py-1.5 sm:px-3 sm:py-2 transition-colors disabled:opacity-50"
        title="Connect a browser wallet to add its address(es)"
      >
        <IconWallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        {busy ? 'Connecting…' : 'Connect wallet'}
      </button>
      {error && <span className="text-[11px] text-red-300">{error}</span>}
    </div>
  );
}
