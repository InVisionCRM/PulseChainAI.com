// Shared fetch wrapper that enforces a request timeout via AbortController.
//
// The plain `fetch` used across the blockchain clients has no timeout, so a
// hung upstream (slow RPC, stalled DexScreener/CoinGecko response) could keep a
// promise pending indefinitely — which in turn pinned loading states in the UI.
// Wrapping every request in an AbortController guarantees each call either
// resolves, rejects, or aborts within a bounded window.

export const DEFAULT_FETCH_TIMEOUT = 30000;

/**
 * Like `fetch`, but aborts the request after `timeoutMs` and throws a clear
 * timeout error. If the caller passes its own `signal` in `init`, that signal
 * is honored in addition to the internal timeout (whichever fires first wins).
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Compose with any signal the caller supplied so external cancellation still works.
  const externalSignal = init.signal;
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError' && !externalSignal?.aborted) {
      const target = typeof input === 'string' ? input : input.toString();
      throw new Error(`Request timed out after ${timeoutMs}ms: ${target}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
