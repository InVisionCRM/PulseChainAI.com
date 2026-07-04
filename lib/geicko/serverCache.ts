// Tiny in-memory TTL cache with in-flight coalescing for API routes.
//
// The geicko routes (pressure, performance, pools) do multi-second subgraph /
// GeckoTerminal scans. A single page load can fire the same request several
// times (mount + prop-resolution re-renders), and every visitor repeats the
// work, because `Cache-Control` alone doesn't help the *first* concurrent
// burst. This memoizes per process: the first caller does the work, concurrent
// callers await the same promise, and later callers get the cached value until
// the TTL lapses. Serverless instances each keep their own map — that's fine,
// it's a best-effort accelerator, not a source of truth.

type Entry = { at: number; value: unknown };

const MAX_ENTRIES = 500;

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

/**
 * `shouldCache` guards against caching a bad value for the whole TTL — e.g. an
 * empty pool list produced by a GeckoTerminal rate-limit. When it returns
 * false the value is still returned to concurrent callers (coalesced), just
 * not remembered.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  shouldCache?: (value: T) => boolean,
): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const p = load()
    .then((value) => {
      if (shouldCache && !shouldCache(value)) return value;
      if (store.size >= MAX_ENTRIES) {
        // Evict the oldest entry; the map iterates in insertion order.
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.delete(key); // re-insert so refreshed keys move to the back
      store.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p as Promise<T>;
}
