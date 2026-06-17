'use client';

import { useMemo, useState } from 'react';
import {
  IconFolder,
  IconPlus,
  IconTrash,
  IconCheck,
} from '@tabler/icons-react';
import { usePortfolioStore } from '@/lib/stores/portfolioStore';
import {
  useGroupsStore,
  resolveGroupId,
  groupBase,
  groupRgba,
  GROUP_COLORS,
  GROUP_COLOR_KEYS,
  DEFAULT_GROUP_ID,
  type AddressGroup,
} from '@/lib/stores/groupsStore';
import { WalletCard } from '@/components/portfolio/WalletCard';
import type { PortfolioWallet } from '@/services';

const fmtUsd = (n: number) => {
  if (!Number.isFinite(n) || n === 0) return '$0.00';
  if (Math.abs(n) >= 1000) {
    return `$${n.toLocaleString(undefined, {
      notation: 'compact',
      maximumFractionDigits: 2,
    })}`;
  }
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// Renders the portfolio's wallets organised into colour-themed group sections,
// plus a manager bar for creating / renaming / recolouring / deleting groups.
// Wallets resolve to a group via groupsStore; unassigned wallets land in the
// default "My Wallets" group.
export function PortfolioGroups() {
  const wallets = usePortfolioStore((s) => s.wallets);
  const snapshotsByAddress = usePortfolioStore((s) => s.snapshotsByAddress);
  const groups = useGroupsStore((s) => s.groups);
  const assignments = useGroupsStore((s) => s.assignments);

  const walletsByGroup = useMemo(() => {
    const map = new Map<string, PortfolioWallet[]>();
    for (const w of wallets) {
      const gid = resolveGroupId(groups, assignments, w.address);
      const arr = map.get(gid) ?? [];
      arr.push(w);
      map.set(gid, arr);
    }
    return map;
  }, [wallets, groups, assignments]);

  // Default group always first; the rest keep creation order.
  const orderedGroups = useMemo(() => {
    const def = groups.find((g) => g.id === DEFAULT_GROUP_ID);
    const rest = groups.filter((g) => g.id !== DEFAULT_GROUP_ID);
    return def ? [def, ...rest] : rest;
  }, [groups]);

  const totalForGroup = (gid: string) =>
    (walletsByGroup.get(gid) ?? []).reduce((sum, w) => {
      const snap = snapshotsByAddress[w.address]?.snapshot;
      return sum + (snap?.totalValueUsd ?? 0);
    }, 0);

  return (
    <div className="space-y-6">
      <GroupManager groups={orderedGroups} walletsByGroup={walletsByGroup} />

      {orderedGroups.map((g) => {
        const ws = walletsByGroup.get(g.id) ?? [];
        // Empty groups exist only in the manager bar — no section until a
        // wallet is moved in, to avoid a wall of empty headers.
        if (ws.length === 0) return null;
        return (
          <GroupSection
            key={g.id}
            group={g}
            wallets={ws}
            total={totalForGroup(g.id)}
          />
        );
      })}
    </div>
  );
}

function GroupManager({
  groups,
  walletsByGroup,
}: {
  groups: AddressGroup[];
  walletsByGroup: Map<string, PortfolioWallet[]>;
}) {
  const createGroup = useGroupsStore((s) => s.createGroup);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId
    ? groups.find((g) => g.id === editingId) ?? null
    : null;

  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-white/60 text-xs font-semibold uppercase tracking-wider">
          <IconFolder className="h-4 w-4" />
          Groups
          <span className="text-white/30 normal-case font-normal">
            · {groups.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            const id = createGroup();
            setEditingId(id);
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold px-2.5 py-1.5 transition-colors"
        >
          <IconPlus className="h-3.5 w-3.5" />
          New group
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <GroupChip
            key={g.id}
            group={g}
            count={(walletsByGroup.get(g.id) ?? []).length}
            active={editingId === g.id}
            onClick={() =>
              setEditingId((cur) => (cur === g.id ? null : g.id))
            }
          />
        ))}
      </div>

      {editing && (
        <GroupEditor
          key={editing.id}
          group={editing}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function GroupChip({
  group,
  count,
  active,
  onClick,
}: {
  group: AddressGroup;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
      style={{
        backgroundColor: groupRgba(group.color, active ? 0.28 : 0.14),
        borderColor: groupRgba(group.color, active ? 0.9 : 0.4),
        color: '#fff',
      }}
    >
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: groupBase(group.color) }}
      />
      {group.name}
      <span className="text-white/50 font-normal">· {count}</span>
    </button>
  );
}

function GroupEditor({
  group,
  onClose,
}: {
  group: AddressGroup;
  onClose: () => void;
}) {
  const renameGroup = useGroupsStore((s) => s.renameGroup);
  const setGroupColor = useGroupsStore((s) => s.setGroupColor);
  const removeGroup = useGroupsStore((s) => s.removeGroup);

  const [name, setName] = useState(group.name);
  const isDefault = group.id === DEFAULT_GROUP_ID;

  const commitName = () => {
    const n = name.trim();
    if (n && n !== group.name) renameGroup(group.id, n);
  };

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitName();
              onClose();
            }
          }}
          autoFocus
          placeholder="Group name"
          className="flex-1 rounded-lg bg-black/40 border border-white/15 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40"
        />
        {!isDefault && (
          <button
            type="button"
            onClick={() => {
              removeGroup(group.id);
              onClose();
            }}
            title="Delete group"
            className="text-white/40 hover:text-red-400 shrink-0"
          >
            <IconTrash className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            commitName();
            onClose();
          }}
          title="Done"
          className="text-white/60 hover:text-white shrink-0"
        >
          <IconCheck className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {GROUP_COLOR_KEYS.map((k) => {
          const selected = group.color === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setGroupColor(group.id, k)}
              title={GROUP_COLORS[k].label}
              aria-pressed={selected}
              className="h-6 w-6 rounded-full transition-transform hover:scale-110"
              style={{
                backgroundColor: groupBase(k),
                boxShadow: selected
                  ? '0 0 0 2px #0F1A2E, 0 0 0 4px #fff'
                  : 'none',
              }}
            />
          );
        })}
      </div>

      {isDefault && (
        <p className="text-[11px] text-white/40 leading-snug">
          Default group — new and ungrouped wallets land here. Rename and
          recolour it freely; it can't be deleted.
        </p>
      )}
    </div>
  );
}

function GroupSection({
  group,
  wallets,
  total,
}: {
  group: AddressGroup;
  wallets: PortfolioWallet[];
  total: number;
}) {
  const base = groupBase(group.color);
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <span
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: base }}
        />
        <h3
          className="text-sm font-bold tracking-wide"
          style={{ color: base }}
        >
          {group.name}
        </h3>
        <span className="text-xs text-white/40">
          · {wallets.length} {wallets.length === 1 ? 'wallet' : 'wallets'}
        </span>
        <span className="ml-auto text-sm font-semibold text-white tabular-nums">
          {fmtUsd(total)}
        </span>
      </div>
      <div
        className="space-y-4 pl-3"
        style={{ borderLeft: `2px solid ${groupRgba(group.color, 0.5)}` }}
      >
        {wallets.map((w) => (
          <WalletCard key={w.address} wallet={w} />
        ))}
      </div>
    </section>
  );
}
