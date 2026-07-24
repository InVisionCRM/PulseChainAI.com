'use client';

// Promo ad slot on the geicko token page — sits between the stat cards and the
// Price Performance block (mirrors DexScreener's banner placement). For now the
// creative is one of our own videos with a cycling typewriter tagline; clicking
// it opens the "Advertise with Morbius" inquiry modal (pricing + creative spec +
// contact). Payment/creative upload will be automated later; today it's an
// inquiry funnel via X / Telegram.

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconX, IconBrandX, IconBrandTelegram } from '@tabler/icons-react';

// The exact banner size advertisers supply — kept to one simple, standard ratio
// so it's easy to make. The banner renders at this aspect so the art fits 1:1.
const AD_SPEC = { w: 1200, h: 300, ratio: '4:1', maxKb: 500 };

const CONTACT = {
  x: { handle: '@KCrypto369', url: 'https://x.com/KCrypto369' },
  telegram: { handle: '@Morbius_Cash', url: 'https://t.me/Morbius_Cash' },
};

const TIERS = [
  { amount: '1,000,000', unit: 'MORBIUS', period: 'per day', highlight: false },
  { amount: '5,000,000', unit: 'MORBIUS', period: 'per week', highlight: true },
  { amount: '15,000,000', unit: 'MORBIUS', period: 'per month', highlight: false },
];

// Taglines cycled by the typewriter effect.
const PHRASES = [
  'Advertise with Morbius today!',
  'Morbius is growing fast',
  'Jump on board now!',
  'Click here for pricing',
];

// Typewriter: type a phrase, hold, delete, advance. Pure timers, no deps.
function useTypewriter(phrases: string[]) {
  const [text, setText] = useState('');
  useEffect(() => {
    let phrase = 0;
    let char = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const full = phrases[phrase];
      char += deleting ? -1 : 1;
      setText(full.slice(0, char));
      let delay = deleting ? 40 : 75;
      if (!deleting && char === full.length) { deleting = true; delay = 1400; }        // hold full
      else if (deleting && char === 0) { deleting = false; phrase = (phrase + 1) % phrases.length; delay = 350; } // next
      timer = setTimeout(tick, delay);
    };
    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [phrases]);
  return text;
}

function InquiryModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[200] grid place-items-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <div className="text-sm font-semibold text-[var(--text)]">Advertise with Morbius</div>
          <button type="button" onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text)]" aria-label="Close">
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-4 py-4">
          <p className="mb-3 text-xs leading-relaxed text-[var(--text-muted)]">
            Put your project in front of every Morbius token-page visitor. Pay in <b className="text-[var(--text)]">$MORBIUS</b> — pick a slot:
          </p>

          {/* Pricing tiers */}
          <div className="space-y-2">
            {TIERS.map((t) => (
              <div
                key={t.period}
                className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${
                  t.highlight
                    ? 'border-[#FA4616]/50 bg-[#FA4616]/10'
                    : 'border-[var(--line)] bg-[var(--surface)]'
                }`}
              >
                <div>
                  <div className="text-sm font-bold text-[var(--text)]">
                    {t.amount} <span className="text-[11px] font-semibold text-[var(--text-muted)]">{t.unit}</span>
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">{t.period}</div>
                </div>
                {t.highlight && (
                  <span className="rounded-full bg-[#FA4616] px-2 py-0.5 text-[10px] font-bold uppercase text-white">Popular</span>
                )}
              </div>
            ))}
          </div>

          {/* Creative spec */}
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Your banner</div>
            <ul className="space-y-0.5 text-xs text-[var(--text-muted)]">
              <li>• Size <b className="text-[var(--text)]">{AD_SPEC.w} × {AD_SPEC.h} px</b> ({AD_SPEC.ratio})</li>
              <li>• PNG or JPG, under {AD_SPEC.maxKb} KB</li>
              <li>• Optional link + short tagline</li>
            </ul>
          </div>

          {/* Contact */}
          <div className="mt-4">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Get in touch</div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={CONTACT.x.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold text-[var(--text)] transition-colors hover:border-[#FA4616]/50"
              >
                <IconBrandX className="h-4 w-4" /> {CONTACT.x.handle}
              </a>
              <a
                href={CONTACT.telegram.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold text-[var(--text)] transition-colors hover:border-[#FA4616]/50"
              >
                <IconBrandTelegram className="h-4 w-4" /> {CONTACT.telegram.handle}
              </a>
            </div>
          </div>

          <p className="mt-3 text-center text-[10px] text-[var(--text-faint)]">
            Automated on-chain purchase &amp; upload coming soon.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function GeickoAdBanner() {
  const [open, setOpen] = useState(false);
  const text = useTypewriter(PHRASES);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => { videoRef.current?.play().catch(() => {}); }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Advertise with Morbius"
        className="group relative block w-full overflow-hidden rounded-xl border border-[var(--line)]"
        style={{ aspectRatio: `${AD_SPEC.w} / ${AD_SPEC.h}`, maxHeight: 160 }}
      >
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          poster="/add-wallet-bg.jpg"
          autoPlay muted loop playsInline preload="metadata"
        >
          <source src="/add-wallet-bg.mp4" type="video/mp4" />
        </video>
        {/* Legibility gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/20" />

        {/* "Ad" chip */}
        <span className="absolute right-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/70">
          Ad
        </span>

        {/* Typewriter tagline */}
        <div className="absolute inset-0 flex flex-col justify-center px-4 text-left sm:px-6">
          <div className="text-base font-extrabold text-white drop-shadow sm:text-xl">
            {text}
            <span className="ml-0.5 inline-block w-[2px] animate-pulse bg-white align-middle" style={{ height: '1em' }} />
          </div>
          <div className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-[#FA4616] px-3 py-1 text-[11px] font-bold text-white shadow transition-transform group-hover:scale-105">
            Advertise here →
          </div>
        </div>
      </button>

      {open && <InquiryModal onClose={() => setOpen(false)} />}
    </>
  );
}
