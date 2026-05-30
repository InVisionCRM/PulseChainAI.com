import { create } from 'zustand';

// Lifted state for the Manage Tokens modal. Lives in a store rather than
// per-WalletCard local state because the modal needs to render at the
// portfolio page level — WalletCard's outer <section> has backdrop-blur-xl,
// which creates a CSS containing block for fixed-position descendants and
// would otherwise confine the overlay inside one card. Same pattern the
// insightsStore uses.

interface ManageTokensState {
  walletAddress: string | null;
  openForWallet: (address: string) => void;
  close: () => void;
}

export const useManageTokensStore = create<ManageTokensState>((set) => ({
  walletAddress: null,
  openForWallet: (address) => set({ walletAddress: address.toLowerCase() }),
  close: () => set({ walletAddress: null }),
}));
