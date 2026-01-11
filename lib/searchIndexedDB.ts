import type { SearchResultItem } from "@/types";

const DB_NAME = "MorbiusSearchCache";
const DB_VERSION = 1;
const STORE_NAME = "searchResults";
const TTL = 24 * 60 * 60 * 1000; // 24 hours for IndexedDB cache

interface CachedSearchEntry {
  query: string;
  results: SearchResultItem[];
  timestamp: number;
}

class SearchIndexedDB {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize IndexedDB
   */
  private async init(): Promise<void> {
    // Return existing initialization promise if already initializing
    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.isInitialized && this.db) {
      return Promise.resolve();
    }

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        console.warn('IndexedDB not available');
        reject(new Error('IndexedDB not available'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: "query" });
          objectStore.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Get cached search results from IndexedDB
   */
  async get(query: string): Promise<SearchResultItem[] | null> {
    try {
      await this.init();

      if (!this.db) {
        return null;
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(query.toLowerCase().trim());

        request.onsuccess = () => {
          const entry = request.result as CachedSearchEntry | undefined;

          if (!entry) {
            resolve(null);
            return;
          }

          // Check if cache is still valid
          const now = Date.now();
          if (now - entry.timestamp > TTL) {
            // Cache expired, delete it
            this.delete(query);
            resolve(null);
            return;
          }

          resolve(entry.results);
        };

        request.onerror = () => {
          console.error('Failed to get from IndexedDB:', request.error);
          resolve(null);
        };
      });
    } catch (error) {
      console.error('IndexedDB get error:', error);
      return null;
    }
  }

  /**
   * Store search results in IndexedDB
   */
  async set(query: string, results: SearchResultItem[]): Promise<void> {
    try {
      await this.init();

      if (!this.db) {
        return;
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);

        const entry: CachedSearchEntry = {
          query: query.toLowerCase().trim(),
          results,
          timestamp: Date.now(),
        };

        const request = store.put(entry);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.error('Failed to save to IndexedDB:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('IndexedDB set error:', error);
    }
  }

  /**
   * Delete a specific cache entry
   */
  async delete(query: string): Promise<void> {
    try {
      await this.init();

      if (!this.db) {
        return;
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(query.toLowerCase().trim());

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.error('Failed to delete from IndexedDB:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('IndexedDB delete error:', error);
    }
  }

  /**
   * Clear all cached results
   */
  async clear(): Promise<void> {
    try {
      await this.init();

      if (!this.db) {
        return;
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.error('Failed to clear IndexedDB:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('IndexedDB clear error:', error);
    }
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<void> {
    try {
      await this.init();

      if (!this.db) {
        return;
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index("timestamp");
        const now = Date.now();

        const request = index.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;

          if (cursor) {
            const entry = cursor.value as CachedSearchEntry;

            if (now - entry.timestamp > TTL) {
              cursor.delete();
            }

            cursor.continue();
          } else {
            resolve();
          }
        };

        request.onerror = () => {
          console.error('Failed to cleanup IndexedDB:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('IndexedDB cleanup error:', error);
    }
  }
}

// Singleton instance
export const searchIndexedDB = new SearchIndexedDB();

// Run cleanup periodically (every hour)
if (typeof window !== 'undefined') {
  setInterval(() => {
    searchIndexedDB.cleanup();
  }, 60 * 60 * 1000);
}
