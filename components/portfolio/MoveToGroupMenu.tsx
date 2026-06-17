'use client';

import { useRef, useState } from 'react';
import { IconFolder, IconCheck, IconPlus } from '@tabler/icons-react';
import { useOutsideClick } from '@/hooks/use-outside-click';
import {
  useGroupsStore,
  resolveGroupId,
  groupBase,
  DEFAULT_GROUP_ID,
} from '@/lib/stores/groupsStore';

// Small folder dropdown rendered in a WalletCard header. Lists every group
// (default first) and assigns the wallet's address to the chosen one. Single-
// group membership, so selecting a group moves the wallet out of its current
// one. A "New group" action creates a group and drops the wallet straight in.
export function MoveToGroupMenu({ address }: { address: string }) {
  const groups = useGroupsStore((s) => s.groups);
  const assignments = useGroupsStore((s) => s.assignments);
  const assignAddress = useGroupsStore((s) => s.assignAddress);
  const createGroup = useGroupsStore((s) => s.createGroup);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => setOpen(false));

  const currentId = resolveGroupId(groups, assignments, address);
  const ordered = [
    ...groups.filter((g) => g.id === DEFAULT_GROUP_ID),
    ...groups.filter((g) => g.id !== DEFAULT_GROUP_ID),
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-white/50 hover:text-white"
        title="Move to group"
        aria-label="Move to group"
        aria-expanded={open}
      >
        <IconFolder className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-48 rounded-lg border border-white/15 bg-[#0d2a4d] shadow-2xl py-1">
          <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-white/40">
            Move to group
          </div>
          {ordered.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                assignAddress(address, g.id);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-white/90 hover:bg-white/10 text-left"
            >
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: groupBase(g.color) }}
              />
              <span className="truncate flex-1">{g.name}</span>
              {g.id === currentId && (
                <IconCheck className="h-3.5 w-3.5 text-white/70 shrink-0" />
              )}
            </button>
          ))}
          <div className="my-1 border-t border-white/10" />
          <button
            type="button"
            onClick={() => {
              const id = createGroup();
              assignAddress(address, id);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-white/70 hover:bg-white/10 hover:text-white text-left"
          >
            <IconPlus className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">New group…</span>
          </button>
        </div>
      )}
    </div>
  );
}
