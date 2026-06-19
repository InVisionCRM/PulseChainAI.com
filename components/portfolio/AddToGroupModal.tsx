'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { IconX, IconPlus, IconCheck, IconFolderPlus } from '@tabler/icons-react';
import { useOutsideClick } from '@/hooks/use-outside-click';
import { useAddToGroupStore } from '@/lib/stores/addToGroupStore';
import {
  useGroupsStore,
  groupBase,
  groupRgba,
  DEFAULT_GROUP_ID,
} from '@/lib/stores/groupsStore';
import { addAddressToGroup } from '@/lib/portfolio/groupActions';
import { SOURCE_LABEL, shortAddr } from '@/lib/portfolio/addressLabels';

// Mounted once at the root layout. Reads its request from addToGroupStore so any
// address surface in the app can open it. Lets the user pick/create a group,
// tweak the auto-generated label, and choose whether to track balances.
export function AddToGroupModal() {
  const request = useAddToGroupStore((s) => s.request);
  const close = useAddToGroupStore((s) => s.close);
  const groups = useGroupsStore((s) => s.groups);
  const createGroup = useGroupsStore((s) => s.createGroup);

  const ref = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState('');
  const [groupId, setGroupId] = useState<string>(DEFAULT_GROUP_ID);
  const [track, setTrack] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);

  useOutsideClick(ref, () => {
    if (request) close();
  });

  // Reset the form whenever a new request comes in.
  useEffect(() => {
    if (!request) return;
    setLabel(request.suggestedLabel);
    setGroupId(DEFAULT_GROUP_ID);
    setTrack(false);
    setNewGroupName('');
    setShowNewGroup(false);
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', onKey);
    };
  }, [request, close]);

  const ordered = [
    ...groups.filter((g) => g.id === DEFAULT_GROUP_ID),
    ...groups.filter((g) => g.id !== DEFAULT_GROUP_ID),
  ];

  const handleCreateGroup = () => {
    const id = createGroup(newGroupName.trim() || undefined);
    setGroupId(id);
    setShowNewGroup(false);
    setNewGroupName('');
  };

  const handleAdd = () => {
    if (!request) return;
    addAddressToGroup({
      address: request.address,
      chain: request.chain,
      groupId,
      label,
      source: request.source,
      track,
    });
    close();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {request && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[120]"
          />
          <div className="fixed inset-0 z-[130] grid place-items-center p-4 pointer-events-none">
            <motion.div
              ref={ref}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0F1A2E] shadow-2xl pointer-events-auto overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-white/10">
                <IconFolderPlus className="h-5 w-5 text-orange-300" />
                <h2 className="text-base font-bold text-white">Add to group</h2>
                <button
                  type="button"
                  onClick={close}
                  className="ml-auto h-7 w-7 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 text-white"
                  aria-label="Close"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                {/* Address being added */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                    {SOURCE_LABEL[request.source]}
                  </span>
                  <span className="font-mono text-sm text-white/80">
                    {shortAddr(request.address)}
                  </span>
                </div>

                {/* Label */}
                <label className="block space-y-1">
                  <span className="text-xs uppercase tracking-wide text-white/60 font-semibold">
                    Name
                  </span>
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Label for this address"
                    className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/60"
                  />
                </label>

                {/* Group picker */}
                <div className="space-y-2">
                  <span className="text-xs uppercase tracking-wide text-white/60 font-semibold">
                    Group
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {ordered.map((g) => {
                      const selected = g.id === groupId;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setGroupId(g.id)}
                          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                          style={{
                            backgroundColor: groupRgba(g.color, selected ? 0.3 : 0.12),
                            borderColor: groupRgba(g.color, selected ? 0.95 : 0.35),
                            color: '#fff',
                          }}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: groupBase(g.color) }}
                          />
                          {g.name}
                          {selected && <IconCheck className="h-3.5 w-3.5" />}
                        </button>
                      );
                    })}

                    {!showNewGroup && (
                      <button
                        type="button"
                        onClick={() => setShowNewGroup(true)}
                        className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/25 px-3 py-1.5 text-xs font-semibold text-white/60 hover:text-white hover:border-white/40 transition-colors"
                      >
                        <IconPlus className="h-3.5 w-3.5" />
                        New group
                      </button>
                    )}
                  </div>

                  {showNewGroup && (
                    <div className="flex items-center gap-2">
                      <input
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCreateGroup();
                        }}
                        autoFocus
                        placeholder="New group name"
                        className="flex-1 rounded-lg bg-black/40 border border-white/15 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/60"
                      />
                      <button
                        type="button"
                        onClick={handleCreateGroup}
                        className="rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold px-3 py-1.5"
                      >
                        Create
                      </button>
                    </div>
                  )}
                </div>

                {/* Track toggle */}
                <button
                  type="button"
                  onClick={() => setTrack((t) => !t)}
                  className="w-full flex items-start gap-3 rounded-lg border border-white/10 bg-black/20 p-3 text-left hover:bg-black/30 transition-colors"
                  aria-pressed={track}
                >
                  <span
                    className="mt-0.5 h-5 w-9 rounded-full p-0.5 transition-colors shrink-0"
                    style={{
                      backgroundColor: track
                        ? 'rgba(249, 115, 22, 0.9)'
                        : 'rgba(255,255,255,0.15)',
                    }}
                  >
                    <span
                      className="block h-4 w-4 rounded-full bg-white transition-transform"
                      style={{ transform: track ? 'translateX(16px)' : 'translateX(0)' }}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">
                      Track balances
                    </span>
                    <span className="block text-xs text-white/50 leading-snug">
                      {track
                        ? 'Scanned as a full portfolio wallet (balances & tokens).'
                        : 'Saved as a reference only — flip on to scan it like a wallet.'}
                    </span>
                  </span>
                </button>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-white/70 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500/90 hover:bg-orange-500 text-white text-sm font-semibold px-4 py-2 transition-colors"
                >
                  <IconPlus className="h-4 w-4" />
                  Add to group
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
