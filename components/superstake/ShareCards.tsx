'use client';

// Pick a card, get a 1080x1080 PNG. The canvas is the real output — the preview
// is that same canvas scaled down with CSS, so what you see is exactly what
// downloads rather than an approximation of it.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconShare2, IconX, IconDownload, IconCopy, IconCheck } from '@tabler/icons-react';
import { CARDS, CARD_H, CARD_W, drawCard, type ShareData } from '@/lib/superstake/shareCard';

const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace';
const GRAD = 'linear-gradient(135deg,#7E089D,#AE176A 30%,#D83639 58%,#E96635 80%,#FB9438)';

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
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white transition-transform hover:-translate-y-px"
        style={{ background: GRAD }}
      >
        <IconShare2 className="h-3.5 w-3.5" />
        {label ?? 'Share a card'}
      </button>
      {open && <Picker data={data} only={only} onClose={() => setOpen(false)} />}
    </>
  );
}

function Picker({
  data, only, onClose,
}: { data: ShareData; only?: readonly string[]; onClose: () => void }) {
  const cards = useMemo(
    () => (only ? CARDS.filter((k) => only.includes(k.id)) : CARDS.filter((k) => !k.id.startsWith('sim-'))),
    [only],
  );
  const [id, setId] = useState(cards[0].id);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const [logoReady, setLogoReady] = useState(false);

  // Load the mark and let the app's fonts settle before the first paint,
  // otherwise the card renders in a fallback face and looks nothing like it should.
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      logoRef.current = img;
      setLogoReady(true);
    };
    img.onerror = () => alive && setLogoReady(true);
    img.src = '/superstake-logo.png';
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.ready.then(() => alive && setLogoReady((v) => v || false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    const go = () => drawCard(ctx, id, data, logoRef.current);
    if (fonts?.ready) fonts.ready.then(go);
    else go();
  }, [id, data, logoReady]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const blob = useCallback(
    () =>
      new Promise<Blob | null>((res) =>
        canvasRef.current ? canvasRef.current.toBlob(res, 'image/png') : res(null),
      ),
    [],
  );

  const download = useCallback(async () => {
    const b = await blob();
    if (!b) return;
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url;
    a.download = `superstake-${id}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, [blob, id]);

  const copy = useCallback(async () => {
    setBusy(true);
    try {
      const b = await blob();
      if (b && navigator.clipboard && 'write' in navigator.clipboard) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } else {
        await download();
      }
    } catch {
      // Clipboard image writes are blocked in some browsers; a download always works.
      await download();
    } finally {
      setBusy(false);
    }
  }, [blob, download]);

  const share = useCallback(async () => {
    const b = await blob();
    if (!b) return;
    const file = new File([b], `superstake-${id}.png`, { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData_) => boolean };
    type ShareData_ = { files?: File[]; title?: string; text?: string };
    if (nav.canShare?.({ files: [file] })) {
      await navigator
        .share({ files: [file], title: 'SuperStake', text: 'morbius.io/superstake' } as ShareData_)
        .catch(() => {});
    } else {
      await download();
    }
  }, [blob, download, id]);

  const canShare =
    typeof navigator !== 'undefined' &&
    typeof (navigator as Navigator & { canShare?: unknown }).canShare === 'function';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm md:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Share a SuperStake card"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="my-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <h2 className="text-sm font-bold text-[var(--text)]">Share a card</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[var(--text-faint)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
          {/* Two columns even on desktop — a single column of twenty would be
              mostly below the fold. */}
          <div className="order-2 grid max-h-[46vh] grid-cols-2 gap-1.5 overflow-y-auto md:order-1 md:max-h-[64vh]">
            {cards.map((k) => {
              const on = k.id === id;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setId(k.id)}
                  aria-pressed={on}
                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                    on
                      ? 'border-transparent text-white'
                      : 'border-[var(--line)] text-[var(--text-muted)] hover:bg-[var(--surface)]'
                  }`}
                  style={on ? { background: GRAD } : undefined}
                >
                  <div className="text-[13px] font-bold">{k.name}</div>
                  <div className={`text-[11px] leading-snug ${on ? 'opacity-85' : 'text-[var(--text-faint)]'}`}>
                    {k.blurb}
                  </div>
                </button>
              );
            })}
          </div>

          {/* live preview — the very canvas that gets exported */}
          <div className="order-1 md:order-2">
            <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-xl border border-[var(--line)]">
              <canvas
                ref={canvasRef}
                width={CARD_W}
                height={CARD_H}
                className="block h-auto w-full"
                aria-label="Card preview"
              />
            </div>

            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={download}
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white transition-transform hover:-translate-y-px"
                style={{ background: GRAD }}
              >
                <IconDownload className="h-3.5 w-3.5" /> Download PNG
              </button>
              <button
                type="button"
                onClick={copy}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-bold text-[var(--text)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-60"
              >
                {copied ? <IconCheck className="h-3.5 w-3.5" /> : <IconCopy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy image'}
              </button>
              {canShare && (
                <button
                  type="button"
                  onClick={share}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-xs font-bold text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
                >
                  <IconShare2 className="h-3.5 w-3.5" /> Share
                </button>
              )}
            </div>
            <p
              className="mt-2 text-center text-[10px] uppercase tracking-[0.12em] text-[var(--text-faint)]"
              style={{ fontFamily: MONO }}
            >
              {CARD_W}×{CARD_H} PNG · figures as of {data.asOf}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
