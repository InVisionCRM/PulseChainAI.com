// Watchlist groups — lets the user organise watched tokens into named,
// colour-themed folders, mirroring the portfolio address-groups feature
// (see groupsStore.ts). Group definitions + per-token assignments are
// persisted to localStorage; the watched tokens themselves stay in
// watchlistStore.
//
// Membership is single-group ("folders"): a token resolves to exactly one
// group. A missing/dangling assignment falls back to the default group, so the
// default always catches ungrouped tokens without a migration pass. Tokens are
// keyed per (chain, address) so the same address on two chains can live in
// different groups — the same identity watchlistStore dedupes on.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ChainId } from '@/services';
// Reuse the portfolio groups' colour system so the two features stay visually
// consistent and there's a single source of truth for palette + helpers.
import {
  GROUP_COLOR_KEYS,
  type GroupColorKey,
} from '@/lib/stores/groupsStore';

export interface WatchlistGroup {
  id: string;
  name: string;
  color: GroupColorKey;
  createdAt: number;
}

export const DEFAULT_WL_GROUP_ID = 'watchlist';

const DEFAULT_WL_GROUP: WatchlistGroup = {
  id: DEFAULT_WL_GROUP_ID,
  name: 'Watchlist',
  color: 'orange',
  createdAt: 0,
};

const norm = (a: string) => a.trim().toLowerCase();

/** Stable per-token key matching watchlistStore's (chain, address) identity. */
export const tokenKey = (chain: ChainId, address: string) =>
  `${chain}:${norm(address)}`;

let seq = 0;
const newId = () => `wlg_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/**
 * Pure resolver used by components after subscribing to groups + assignments,
 * so the result is reactive. Returns the default group id when the token has no
 * assignment or points at a group that no longer exists.
 */
export function resolveWlGroupId(
  groups: WatchlistGroup[],
  assignments: Record<string, string>,
  chain: ChainId,
  address: string,
): string {
  const gid = assignments[tokenKey(chain, address)];
  if (gid && groups.some((g) => g.id === gid)) return gid;
  return DEFAULT_WL_GROUP_ID;
}

interface WatchlistGroupsStore {
  groups: WatchlistGroup[];
  /** tokenKey(chain, address) -> groupId. Absent = default group. */
  assignments: Record<string, string>;

  createGroup: (name?: string, color?: GroupColorKey) => string;
  renameGroup: (id: string, name: string) => void;
  setGroupColor: (id: string, color: GroupColorKey) => void;
  removeGroup: (id: string) => void;
  assignToken: (chain: ChainId, address: string, groupId: string) => void;
  /** Imperative read (non-reactive) — for handlers, not render. */
  groupIdForToken: (chain: ChainId, address: string) => string;
}

export const useWatchlistGroupsStore = create<WatchlistGroupsStore>()(
  persist(
    (set, get) => ({
      groups: [DEFAULT_WL_GROUP],
      assignments: {},

      createGroup: (name, color) => {
        const id = newId();
        const count = get().groups.length;
        const resolvedColor =
          color ?? GROUP_COLOR_KEYS[count % GROUP_COLOR_KEYS.length];
        const group: WatchlistGroup = {
          id,
          name: name?.trim() || 'New group',
          color: resolvedColor,
          createdAt: Date.now(),
        };
        set((s) => ({ groups: [...s.groups, group] }));
        return id;
      },

      renameGroup: (id, name) => {
        const n = name.trim();
        if (!n) return;
        set((s) => ({
          groups: s.groups.map((g) => (g.id === id ? { ...g, name: n } : g)),
        }));
      },

      setGroupColor: (id, color) => {
        set((s) => ({
          groups: s.groups.map((g) => (g.id === id ? { ...g, color } : g)),
        }));
      },

      removeGroup: (id) => {
        if (id === DEFAULT_WL_GROUP_ID) return; // default is permanent
        set((s) => {
          // Strip assignments to the deleted group so those tokens resolve back
          // to the default group on their own.
          const assignments: Record<string, string> = {};
          for (const [key, gid] of Object.entries(s.assignments)) {
            if (gid !== id) assignments[key] = gid;
          }
          return {
            groups: s.groups.filter((g) => g.id !== id),
            assignments,
          };
        });
      },

      assignToken: (chain, address, groupId) => {
        const key = tokenKey(chain, address);
        set((s) => {
          // Assigning to the default group is the same as having no explicit
          // assignment — keep the map lean by clearing it instead.
          if (groupId === DEFAULT_WL_GROUP_ID) {
            const { [key]: _drop, ...rest } = s.assignments;
            return { assignments: rest };
          }
          return { assignments: { ...s.assignments, [key]: groupId } };
        });
      },

      groupIdForToken: (chain, address) =>
        resolveWlGroupId(get().groups, get().assignments, chain, address),
    }),
    {
      name: 'morbius-watchlist-groups-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ groups: s.groups, assignments: s.assignments }),
      // Guarantee the default group survives rehydration even if a persisted
      // payload somehow lacks it (older/corrupt state).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<WatchlistGroupsStore>;
        const groups =
          p.groups && p.groups.length > 0 ? p.groups : current.groups;
        const hasDefault = groups.some((g) => g.id === DEFAULT_WL_GROUP_ID);
        return {
          ...current,
          ...p,
          groups: hasDefault ? groups : [DEFAULT_WL_GROUP, ...groups],
        };
      },
    },
  ),
);
