import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Wallets the user is actively looking into — the "Investigating" tray in the
// geicko portfolio drawer.
//
// This is deliberately NOT a portfolio group. Groups are curated collections
// the user maintains on the portfolio page; a pin is scratch state — "hold this
// address while I bounce between tabs and tokens" — cheap to add, cheap to
// clear, and expected to be thrown away when the hunt is over. Conflating the
// two would pollute groups with transients.
//
// Pins are global (not per token): the whole point is that a wallet spotted on
// one token's holder list stays visible while you check what else it's in. The
// token it was pinned FROM is kept as context so the tray can say where a pin
// came from.

export interface PinnedWallet {
  /** Lowercased wallet address. */
  address: string;
  /** Symbol of the token whose holder list it was pinned from (display only). */
  symbol: string | null;
  /** Address of that token, so the tray can link back to the page. */
  token: string | null;
  /** Holder rank at pin time, e.g. 3 for "#3 holder". Display only. */
  rank: number | null;
  at: number;
}

const MAX_PINS = 30;

interface InvestigateStore {
  pins: PinnedWallet[];
  pin: (p: Omit<PinnedWallet, 'at' | 'address'> & { address: string }) => void;
  unpin: (address: string) => void;
  clear: () => void;
  isPinned: (address: string | null | undefined) => boolean;
}

export const useInvestigateStore = create<InvestigateStore>()(
  persist(
    (set, get) => ({
      pins: [],

      pin: (p) => {
        const address = p.address.toLowerCase();
        set((s) => ({
          pins: [
            { address, symbol: p.symbol ?? null, token: p.token ?? null, rank: p.rank ?? null, at: Date.now() },
            // Re-pinning moves it to the top with fresh context.
            ...s.pins.filter((x) => x.address !== address),
          ].slice(0, MAX_PINS),
        }));
      },

      unpin: (address) =>
        set((s) => ({ pins: s.pins.filter((x) => x.address !== address.toLowerCase()) })),

      clear: () => set({ pins: [] }),

      isPinned: (address) =>
        !!address && get().pins.some((x) => x.address === address.toLowerCase()),
    }),
    {
      name: 'morbius-investigate-v1',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
