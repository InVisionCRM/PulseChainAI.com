import { useEffect, useRef } from 'react';

/**
 * Runs `callback` on a fixed interval, but only while the tab is visible.
 * When the tab is hidden the timer is cleared (no wasted network calls or
 * battery in a background tab); when it becomes visible again the callback
 * fires once immediately to catch up, then the interval resumes.
 *
 * The caller owns the first invocation — this hook does NOT fire on mount, so
 * existing "fetch once, then poll" effects keep their initial load and just
 * gain visibility-aware refresh. Pass `enabled: false` to suspend polling
 * (e.g. while paginated away from the live view).
 */
export function usePollingEffect(
  callback: () => void,
  delayMs: number,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (!enabled) return;
    let id: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (id == null) id = setInterval(() => savedCallback.current(), delayMs);
    };
    const stop = () => {
      if (id != null) { clearInterval(id); id = null; }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        // Catch up on whatever was missed while hidden, then resume polling.
        savedCallback.current();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [delayMs, enabled]);
}
