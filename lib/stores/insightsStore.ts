import { create } from 'zustand';
import type { PortfolioToken } from '@/services';

// Lifted state for the per-token insights modal. Lives in a store rather
// than per-WalletCard local state because the modal needs to render at
// the page level — WalletCard's outer <section> has backdrop-blur-xl,
// which creates a CSS containing block for fixed-position descendants
// and confines the overlay to one card. Hoisting the render up to the
// page (where there's no backdrop-blur ancestor) sidesteps the issue
// without needing createPortal, which in Next.js + React 19 has its own
// synthetic-event-delegation quirks under app router.

interface InsightsState {
  activeToken: PortfolioToken | null;
  openInsights: (token: PortfolioToken) => void;
  closeInsights: () => void;
}

export const useInsightsStore = create<InsightsState>((set) => ({
  activeToken: null,
  openInsights: (token) => set({ activeToken: token }),
  closeInsights: () => set({ activeToken: null }),
}));
