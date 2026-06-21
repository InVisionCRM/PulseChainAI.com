import type { AddressCategory } from '@/lib/gumshoe/address-labels';

// Counterparty categories worth flagging. Routers/factories/wrapped are
// labelled elsewhere but not badged — they'd be noise. CEX / locker / OFAC /
// burn get a coloured chip. Shared by the activity feed and the connections
// panel so the two views stay visually consistent.
export const COUNTERPARTY_BADGE: Partial<
  Record<AddressCategory, { text: string; cls: string; hint: string }>
> = {
  ofac: {
    text: 'OFAC',
    cls: 'border-red-400/50 bg-red-500/20 text-red-200',
    hint: 'OFAC-sanctioned address',
  },
  exchange: {
    text: 'CEX',
    cls: 'border-sky-400/40 bg-sky-500/15 text-sky-200',
    hint: 'Centralized exchange',
  },
  locker: {
    text: 'Locker',
    cls: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
    hint: 'Liquidity locker',
  },
  burn: {
    text: 'Burn',
    cls: 'border-[var(--line-strong)] bg-[var(--surface-2)] text-[var(--text-muted)]',
    hint: 'Burn address',
  },
};

export function CounterpartyBadge({
  category,
  label,
}: {
  category: AddressCategory | null | undefined;
  label?: string | null;
}) {
  const b = category ? COUNTERPARTY_BADGE[category] : undefined;
  if (!b) return null;
  return (
    <span
      title={label ? `${label} — ${b.hint}` : b.hint}
      className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${b.cls}`}
    >
      {b.text}
    </span>
  );
}
