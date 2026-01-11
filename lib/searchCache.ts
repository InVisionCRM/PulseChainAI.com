import type { SearchResultItem } from "@/types";
import { searchIndexedDB } from "./searchIndexedDB";

interface CacheEntry {
  data: SearchResultItem[];
  timestamp: number;
}

class SearchCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes cache TTL for in-memory
  private readonly MAX_ENTRIES = 100; // Prevent memory bloat

  /**
   * Normalize query for consistent cache keys
   */
  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim();
  }

  /**
   * Check if cache entry is still valid
   */
  private isValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < this.TTL;
  }

  /**
   * Get cached results if available and valid (checks both memory and IndexedDB)
   */
  async getAsync(query: string): Promise<SearchResultItem[] | null> {
    const key = this.normalizeQuery(query);

    // First, check in-memory cache (fastest)
    const entry = this.cache.get(key);
    if (entry && this.isValid(entry)) {
      return entry.data;
    }

    // Not in memory, check IndexedDB (persistent cache)
    try {
      const indexedResults = await searchIndexedDB.get(key);
      if (indexedResults) {
        // Populate memory cache with IndexedDB result
        this.cache.set(key, {
          data: indexedResults,
          timestamp: Date.now(),
        });
        return indexedResults;
      }
    } catch (error) {
      console.error('IndexedDB cache retrieval failed:', error);
    }

    return null;
  }

  /**
   * Synchronous get (only checks in-memory cache)
   */
  get(query: string): SearchResultItem[] | null {
    const key = this.normalizeQuery(query);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (!this.isValid(entry)) {
      this.cache.delete(key);
      return null;
    }

    // Cache hit - return immediately
    return entry.data;
  }

  /**
   * Store search results in both memory and IndexedDB
   */
  set(query: string, data: SearchResultItem[]): void {
    const key = this.normalizeQuery(query);

    // Enforce max cache size (LRU-like behavior)
    if (this.cache.size >= this.MAX_ENTRIES) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    // Store in memory cache
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // Also store in IndexedDB for persistence (async, don't wait)
    searchIndexedDB.set(key, data).catch((error) => {
      console.error('Failed to cache in IndexedDB:', error);
    });
  }

  /**
   * Clear all cached results
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics for debugging
   */
  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
      maxEntries: this.MAX_ENTRIES,
      ttl: this.TTL,
    };
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.TTL) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance
export const searchCache = new SearchCache();

// Optional: Periodic cleanup (every 5 minutes)
if (typeof window !== 'undefined') {
  setInterval(() => {
    searchCache.cleanup();
  }, 5 * 60 * 1000);
}
