type CacheEntry<T> = { ts: number; ttlMs: number; value: T };

export class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();

  // Optional background sweeper timer
  private sweeper: NodeJS.Timeout | null = null;

  constructor() {
    // Run periodic sweep to remove expired entries that were never accessed.
    // Interval chosen small to avoid long-lived stale entries; configurable if needed.
    const SWEEP_INTERVAL_MS = 1000;
    this.sweeper = setInterval(() => {
      try {
        const now = Date.now();
        for (const [k, entry] of this.store.entries()) {
          if (now - entry.ts > entry.ttlMs) {
            this.store.delete(k);
          }
        }
      } catch (e) {
        // swallow to avoid crashing on unexpected errors
      }
    }, SWEEP_INTERVAL_MS);
    // Allow process to exit if nothing else is pending
    if (this.sweeper && typeof this.sweeper.unref === 'function') {
      this.sweeper.unref();
    }
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    const now = Date.now();
    if (now - entry.ts > entry.ttlMs) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { ts: Date.now(), ttlMs, value });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  // Optional: stop the background sweeper when the cache is no longer needed
  stopSweeper(): void {
    if (this.sweeper) {
      clearInterval(this.sweeper);
      this.sweeper = null;
    }
  }
}

// Provide a simple shared instance for app-wide use.
export const memoryCache = new MemoryCache();
