'use client';

// SuperStake's share button. The picker itself is the shared one in
// components/share — this file is just SuperStake's card list, its painter and
// its brand strings handed to it.

import { useCallback, useMemo, useState } from 'react';
import { IconShare2 } from '@tabler/icons-react';
import ShareCardModal, { SHARE_GRAD } from '@/components/share/ShareCardModal';
import { BRAND_URL, CARDS, CARD_H, CARD_W, drawCard, type ShareData } from '@/lib/superstake/shareCard';

export interface ShareCardsProps {
  data: ShareData;
  /**
   * Restrict the picker to these card ids. Without it the picker offers every
   * card *except* the simulator's — those read `data.sim`, which only the
   * simulator sets, so listing them anywhere else would offer a blank card.
   */
  only?: readonly string[];
  /** Button copy, when "Share a card" isn't specific enough. */
  label?: string;
}

export default function ShareCards({ data, only, label }: ShareCardsProps) {
  const [open, setOpen] = useState(false);
  const cards = useMemo(
    () =>
      (only ? CARDS.filter((k) => only.includes(k.id)) : CARDS.filter((k) => !k.id.startsWith('sim-')))
        .map((k) => ({ id: k.id, name: k.name, blurb: k.blurb })),
    [only],
  );
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, id: string, logo: HTMLImageElement | null) => {
      drawCard(ctx, id, data, logo);
    },
    [data],
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white transition-transform hover:-translate-y-px"
        style={{ background: SHARE_GRAD }}
      >
        <IconShare2 className="h-3.5 w-3.5" />
        {label ?? 'Share a card'}
      </button>
      {open && (
        <ShareCardModal
          cards={cards}
          draw={draw}
          drawKey={data}
          logoSrc="/superstake-logo.png"
          filePrefix="superstake"
          shareTitle="SuperStake"
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
