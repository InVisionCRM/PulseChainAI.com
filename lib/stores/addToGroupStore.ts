// Open/close state for the global "Add to group" modal. Triggers live all over
// the app (holder rows, contract owner/creator, tx counterparties, …), so the
// modal is mounted once at the root layout and driven from this store rather
// than prop-drilling. Mirrors the insightsStore pattern.

import { create } from 'zustand';
import type { ChainId } from '@/services';
import type { AddressSource } from '@/lib/portfolio/addressLabels';

export interface AddToGroupRequest {
  address: string;
  chain?: ChainId;
  source: AddressSource;
  /** Prefilled, editable label suggestion. */
  suggestedLabel: string;
}

interface AddToGroupState {
  request: AddToGroupRequest | null;
  open: (req: AddToGroupRequest) => void;
  close: () => void;
}

export const useAddToGroupStore = create<AddToGroupState>((set) => ({
  request: null,
  open: (request) => set({ request }),
  close: () => set({ request: null }),
}));
