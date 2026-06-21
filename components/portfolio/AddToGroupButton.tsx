'use client';

import { IconFolderPlus } from '@tabler/icons-react';
import { useAddToGroupStore } from '@/lib/stores/addToGroupStore';
import {
  suggestGroupLabel,
  type AddressSource,
  type LabelContext,
} from '@/lib/portfolio/addressLabels';
import type { ChainId } from '@/services';

interface Props {
  address: string;
  source: AddressSource;
  chain?: ChainId;
  context?: LabelContext;
  className?: string;
  /** Icon size in px (default 16). */
  size?: number;
  title?: string;
}

// Drop-in "save this address to a portfolio group" affordance. Used across the
// app next to any address. Computes a sensible default label from its source +
// context and hands off to the global AddToGroupModal.
export function AddToGroupButton({
  address,
  source,
  chain,
  context,
  className,
  size = 16,
  title = 'Add to portfolio group',
}: Props) {
  const open = useAddToGroupStore((s) => s.open);

  if (!address) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        open({
          address,
          chain,
          source,
          suggestedLabel: suggestGroupLabel(source, address, context),
        });
      }}
      title={title}
      aria-label={title}
      className={
        className ??
        'inline-flex items-center justify-center text-[var(--text-faint)] hover:text-orange-300 transition-colors'
      }
    >
      <IconFolderPlus style={{ width: size, height: size }} />
    </button>
  );
}
