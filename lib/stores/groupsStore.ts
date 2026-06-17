// Address groups — lets the user organise portfolio addresses into named,
// colour-themed folders. Group definitions + per-address assignments are
// persisted to localStorage; the wallet list itself stays in portfolioStore.
//
// Membership is single-group ("folders"): an address resolves to exactly one
// group. A missing/danging assignment falls back to the default group, so the
// default always catches ungrouped wallets without a migration pass.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type GroupColorKey =
  | 'blue'
  | 'violet'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'cyan'
  | 'fuchsia'
  | 'orange'
  | 'teal'
  | 'sky';

export interface GroupColor {
  label: string;
  base: string; // hex #rrggbb
}

export const GROUP_COLORS: Record<GroupColorKey, GroupColor> = {
  blue: { label: 'Blue', base: '#60a5fa' },
  violet: { label: 'Violet', base: '#a78bfa' },
  emerald: { label: 'Emerald', base: '#34d399' },
  amber: { label: 'Amber', base: '#fbbf24' },
  rose: { label: 'Rose', base: '#fb7185' },
  cyan: { label: 'Cyan', base: '#22d3ee' },
  fuchsia: { label: 'Fuchsia', base: '#e879f9' },
  orange: { label: 'Orange', base: '#fb923c' },
  teal: { label: 'Teal', base: '#2dd4bf' },
  sky: { label: 'Sky', base: '#38bdf8' },
};

export const GROUP_COLOR_KEYS = Object.keys(GROUP_COLORS) as GroupColorKey[];

/** Hex base of a colour key, with a safe fallback for unknown keys. */
export function groupBase(key: GroupColorKey): string {
  return (GROUP_COLORS[key] ?? GROUP_COLORS.blue).base;
}

/** rgba() string for a colour key at the given alpha — for tints/borders. */
export function groupRgba(key: GroupColorKey, alpha: number): string {
  const hex = groupBase(key).replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface AddressGroup {
  id: string;
  name: string;
  color: GroupColorKey;
  createdAt: number;
}

export const DEFAULT_GROUP_ID = 'my-wallets';

const DEFAULT_GROUP: AddressGroup = {
  id: DEFAULT_GROUP_ID,
  name: 'My Wallets',
  color: 'blue',
  createdAt: 0,
};

const norm = (a: string) => a.trim().toLowerCase();

let seq = 0;
const newId = () => `grp_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/**
 * Pure resolver used by components after subscribing to groups + assignments,
 * so the result is reactive. Returns the default group id when the address has
 * no assignment or points at a group that no longer exists.
 */
export function resolveGroupId(
  groups: AddressGroup[],
  assignments: Record<string, string>,
  address: string,
): string {
  const gid = assignments[norm(address)];
  if (gid && groups.some((g) => g.id === gid)) return gid;
  return DEFAULT_GROUP_ID;
}

interface GroupsStore {
  groups: AddressGroup[];
  /** lowercased address -> groupId. Absent = default group. */
  assignments: Record<string, string>;

  createGroup: (name?: string, color?: GroupColorKey) => string;
  renameGroup: (id: string, name: string) => void;
  setGroupColor: (id: string, color: GroupColorKey) => void;
  removeGroup: (id: string) => void;
  assignAddress: (address: string, groupId: string) => void;
  /** Imperative read (non-reactive) — for stores/handlers, not render. */
  groupIdForAddress: (address: string) => string;
}

export const useGroupsStore = create<GroupsStore>()(
  persist(
    (set, get) => ({
      groups: [DEFAULT_GROUP],
      assignments: {},

      createGroup: (name, color) => {
        const id = newId();
        const count = get().groups.length;
        const resolvedColor =
          color ?? GROUP_COLOR_KEYS[count % GROUP_COLOR_KEYS.length];
        const group: AddressGroup = {
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
        if (id === DEFAULT_GROUP_ID) return; // default is permanent
        set((s) => {
          // Strip assignments to the deleted group so those addresses resolve
          // back to the default group.
          const assignments: Record<string, string> = {};
          for (const [addr, gid] of Object.entries(s.assignments)) {
            if (gid !== id) assignments[addr] = gid;
          }
          return {
            groups: s.groups.filter((g) => g.id !== id),
            assignments,
          };
        });
      },

      assignAddress: (address, groupId) => {
        const a = norm(address);
        set((s) => {
          // Assigning to the default group is the same as having no explicit
          // assignment — keep the map lean by clearing it instead.
          if (groupId === DEFAULT_GROUP_ID) {
            const { [a]: _drop, ...rest } = s.assignments;
            return { assignments: rest };
          }
          return { assignments: { ...s.assignments, [a]: groupId } };
        });
      },

      groupIdForAddress: (address) =>
        resolveGroupId(get().groups, get().assignments, address),
    }),
    {
      name: 'morbius-groups-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ groups: s.groups, assignments: s.assignments }),
      // Guarantee the default group survives rehydration even if a persisted
      // payload somehow lacks it (older/corrupt state).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<GroupsStore>;
        const groups =
          p.groups && p.groups.length > 0 ? p.groups : current.groups;
        const hasDefault = groups.some((g) => g.id === DEFAULT_GROUP_ID);
        return {
          ...current,
          ...p,
          groups: hasDefault ? groups : [DEFAULT_GROUP, ...groups],
        };
      },
    },
  ),
);
