'use client';

import { useState } from 'react';
import { IconCheck, IconCopy } from '@tabler/icons-react';

/** Copies the full hash; the receipt only has room to print a short one. */
export function CopyHash({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      aria-label={done ? 'Copied' : 'Copy transaction hash'}
      className="shrink-0 rounded p-0.5 text-[#6b6358] transition-colors hover:text-[#22201c]"
    >
      {done ? <IconCheck className="h-3.5 w-3.5" /> : <IconCopy className="h-3.5 w-3.5" />}
    </button>
  );
}
