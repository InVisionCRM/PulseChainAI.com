'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconDotsVertical, IconCheck } from '@tabler/icons-react';
import {
  useGroupsStore,
  resolveGroupId,
  groupBase,
  DEFAULT_GROUP_ID,
} from '@/lib/stores/groupsStore';

interface Props {
  address: string;
  hiddenCount: number;
  isLoading: boolean;
  onRename: () => void;
  onManageTokens: () => void;
  onRefresh: () => void;
  onRemove: () => void;
}

// Consolidated wallet-header actions. On a cramped mobile header a row of icon
// buttons (revoke / manage / refresh / move / remove) ran out of room, so they
// live here behind a single kebab trigger as text items (no icons). The
// move-to-group picker is folded in as an inline section rather than its own
// nested dropdown.
export function WalletActionsMenu({
  address,
  hiddenCount,
  isLoading,
  onRename,
  onManageTokens,
  onRefresh,
  onRemove,
}: Props) {
  const groups = useGroupsStore((s) => s.groups);
  const assignments = useGroupsStore((s) => s.assignments);
  const assignAddress = useGroupsStore((s) => s.assignAddress);
  const createGroup = useGroupsStore((s) => s.createGroup);

  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Position the menu in a portal on document.body — the wallet card clips
  // overflow and uses backdrop-blur (a containing block), so an in-card dropdown
  // is both hidden when the card is collapsed and stacked below content. A
  // fixed-position portal escapes both.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setCoords({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    };
    place();
    window.addEventListener('resize', place);
    // A fixed menu detaches from the trigger on scroll, so close it instead.
    const onScroll = () => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  // Close on a click outside BOTH the trigger and the portalled menu.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  const currentId = resolveGroupId(groups, assignments, address);
  const ordered = [
    ...groups.filter((g) => g.id === DEFAULT_GROUP_ID),
    ...groups.filter((g) => g.id !== DEFAULT_GROUP_ID),
  ];

  const close = () => setOpen(false);
  const itemClass =
    'w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-left text-[var(--text)] hover:bg-[var(--surface-3)] transition-colors';

  const menu = open && coords && typeof document !== 'undefined' ? createPortal(
    (
      <div
        ref={menuRef}
        role="menu"
        style={{ position: 'fixed', top: coords.top, right: coords.right, zIndex: 100 }}
        className="w-56 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] py-1 shadow-2xl"
      >
          <button type="button" role="menuitem" className={itemClass} onClick={() => { onRename(); close(); }}>
            Edit name
          </button>

          <button type="button" role="menuitem" className={itemClass} onClick={() => { onManageTokens(); close(); }}>
            <span>Manage tokens</span>
            {hiddenCount > 0 && (
              <span className="text-xs text-[var(--text-faint)] tabular-nums">{hiddenCount} hidden</span>
            )}
          </button>

          <button
            type="button"
            role="menuitem"
            className={`${itemClass} disabled:opacity-40`}
            onClick={() => { onRefresh(); close(); }}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>

          <a
            role="menuitem"
            href={`https://revoke.cash/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className={itemClass}
            onClick={close}
          >
            <span>Revoke approvals</span>
            <span className="text-[var(--text-faint)]">↗</span>
          </a>

          <div className="my-1 border-t border-white/10" />

          <div className="px-3 pb-1 pt-1 text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
            Move to group
          </div>
          {ordered.map((g) => (
            <button
              key={g.id}
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={() => { assignAddress(address, g.id); close(); }}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: groupBase(g.color) }}
                />
                <span className="truncate">{g.name}</span>
              </span>
              {g.id === currentId && (
                <IconCheck className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
              )}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            className={`${itemClass} text-[var(--text-muted)] hover:text-[var(--text)]`}
            onClick={() => { const id = createGroup(); assignAddress(address, id); close(); }}
          >
            New group…
          </button>

          <div className="my-1 border-t border-white/10" />

          <button
            type="button"
            role="menuitem"
            className="w-full px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10"
            onClick={() => { onRemove(); close(); }}
          >
            Remove wallet
          </button>
      </div>
    ),
    document.body,
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center h-7 w-7 rounded-md text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-3)] transition-colors"
        title="Wallet actions"
        aria-label="Wallet actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <IconDotsVertical className="h-5 w-5" />
      </button>
      {menu}
    </>
  );
}
