'use client';

// "Install App" button for the nav. On Chrome/Android/desktop it captures the
// beforeinstallprompt event and triggers the native install flow. On iOS (no
// such API) it opens Add-to-Home-Screen instructions. Registers the service
// worker on mount and hides itself when already running as an installed PWA.

import { useEffect, useState } from 'react';
import { IconDeviceMobileDown, IconShare2, IconSquarePlus, IconX } from '@tabler/icons-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isIos = () =>
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !/crios|fxios/i.test(navigator.userAgent); // Safari only — Chrome/FF on iOS can't add either

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true);

export function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIos, setShowIos] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    setInstalled(isStandalone());

    // Register the service worker (required for installability on Android).
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Don't render until mounted (avoids SSR/standalone flicker), and never inside
  // the installed app.
  if (!ready || installed) return null;

  // Show the button when we either have a native prompt or we're on iOS Safari
  // (where we fall back to instructions). Otherwise stay hidden.
  const canNative = !!deferred;
  const iosFallback = isIos();
  if (!canNative && !iosFallback) return null;

  const onClick = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice.catch(() => {});
      setDeferred(null);
    } else {
      setShowIos(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        title="Install Morbius"
        className="mb-2 flex items-center justify-center gap-2 rounded-lg border border-purple-500/40 bg-purple-500/15 px-3 py-2 transition duration-200 hover:bg-purple-500/25"
      >
        <IconDeviceMobileDown className="h-5 w-5 shrink-0 text-purple-300" />
        <span className="inline-block whitespace-pre text-sm text-[var(--text)]">Install App</span>
      </button>

      {showIos && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={() => setShowIos(false)}>
          <div
            className="w-full max-w-sm rounded-t-2xl border border-[var(--line)] bg-[var(--panel)] p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--text)]">Install on iPhone / iPad</h3>
              <button type="button" onClick={() => setShowIos(false)} className="text-[var(--text-faint)] hover:text-[var(--text)]">
                <IconX className="h-5 w-5" />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-[var(--text-muted)]">
              <li className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-purple-500/20 text-xs font-bold text-purple-300">1</span>
                Tap the <IconShare2 className="mx-0.5 inline h-4 w-4 text-purple-300" /> <span className="font-semibold text-[var(--text)]">Share</span> button in Safari.
              </li>
              <li className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-purple-500/20 text-xs font-bold text-purple-300">2</span>
                Choose <IconSquarePlus className="mx-0.5 inline h-4 w-4 text-purple-300" /> <span className="font-semibold text-[var(--text)]">Add to Home Screen</span>.
              </li>
              <li className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-purple-500/20 text-xs font-bold text-purple-300">3</span>
                Tap <span className="font-semibold text-[var(--text)]">Add</span> — Morbius lands on your home screen.
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
