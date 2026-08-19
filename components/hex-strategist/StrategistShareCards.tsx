'use client';

// The Macro tab's share button. The unlock schedule and rates ride in from the
// tab; the pulse payload (24h/30d activity) is fetched once, the first time a
// card that needs it is opened — the modal shows its busy strip until it lands.

import { useCallback, useMemo, useRef, useState } from 'react';
import { IconShare2 } from '@tabler/icons-react';
import ShareCardModal, { SHARE_GRAD } from '@/components/share/ShareCardModal';
import {
  BRAND_URL, CARDS, CARD_H, CARD_W, drawCard, type StrategistShareData,
} from '@/lib/hex/strategistShareCard';
import type { Network, Rates } from '@/lib/hex/strategistData';

export interface StrategistShareProps {
  net: Network;
  schedule: {
    currentDay: number;
    buckets: [number, number, number, number][];
    totals: { hex: number; tShares: number; stakes: number };
    network_totals: { hex: number; tShares: number };
    overdue: { hex: number; stakes: number };
    frozen?: { hex: number; stakes: number };
  };
  rates: Rates | null;
}

export default function StrategistShareCards({ net, schedule, rates }: StrategistShareProps) {
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState<StrategistShareData['pulse']>(null);
  const [pulseBusy, setPulseBusy] = useState(false);
  const fetched = useRef(false);
  const [selected, setSelected] = useState<string>(CARDS[0].id);

  const onSelect = useCallback(
    (id: string) => {
      setSelected(id);
      const kind = CARDS.find((k) => k.id === id);
      if (!kind?.needsPulse || fetched.current) return;
      fetched.current = true;
      setPulseBusy(true);
      fetch(`/api/hex/pulse?network=${net}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => setPulse(j ?? null))
        .catch(() => setPulse(null))
        .finally(() => setPulseBusy(false));
    },
    [net],
  );

  const data = useMemo<StrategistShareData>(
    () => ({
      network: net as 'pulsechain' | 'ethereum',
      asOf: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      currentDay: schedule.currentDay,
      buckets: schedule.buckets,
      totals: schedule.totals,
      networkHex: schedule.network_totals.hex,
      networkTShares: schedule.network_totals.tShares,
      overdue: { hex: schedule.overdue.hex, stakes: schedule.overdue.stakes },
      frozenHex: schedule.frozen?.hex ?? 0,
      priceUsd: rates?.priceUsd ?? null,
      pulse,
    }),
    [net, schedule, rates, pulse],
  );

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, id: string, logo: HTMLImageElement | null) => {
      drawCard(ctx, id, data, logo);
    },
    [data],
  );

  const busy = pulseBusy && !!CARDS.find((k) => k.id === selected)?.needsPulse;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Share a card"
        title="Share a card"
        className="rounded-lg p-1.5 text-white transition-transform hover:-translate-y-px"
        style={{ background: SHARE_GRAD }}
      >
        <IconShare2 className="h-4 w-4" />
      </button>
      {open && (
        <ShareCardModal
          title="Share the chain"
          cards={CARDS.map((k) => ({ id: k.id, name: k.name, blurb: k.blurb, group: k.group }))}
          groups={[
            { key: 'macro', label: 'The macro' },
            { key: 'pulse', label: 'The pulse' },
          ]}
          draw={draw}
          drawKey={data}
          onSelect={onSelect}
          busy={busy}
          logoSrc="/hex-logo.svg"
          filePrefix="hex-strategist"
          shareTitle="HEX Strategist"
          shareText={BRAND_URL}
          footNote={`${CARD_W}×${CARD_H} PNG · figures as of ${data.asOf}`}
          width={CARD_W}
          height={CARD_H}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
