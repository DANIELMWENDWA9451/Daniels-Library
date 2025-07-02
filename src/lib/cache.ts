// Advanced caching system for LibGen Pro
export interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

export interface CacheConfig {
  maxAge: number; // in milliseconds
  maxSize: number; // maximum number of items
  storageKey: string;
}

export class AdvancedCache<T> {
  private cache = new Map<string, CacheItem<T>>();
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
    this.loadFromStorage();
  }

  set(key: string, data: T, customMaxAge?: number): void {
    const maxAge = customMaxAge || this.config.maxAge;
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + maxAge
    };

    this.cache.set(key, item);
    this.cleanup();
    this.saveToStorage();
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      this.saveToStorage();
      return null;
    }

    return item.data;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      this.saveToStorage();
      return false;
    }
    
    return true;
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.saveToStorage();
  }

  clear(): void {
    this.cache.clear();
    this.saveToStorage();
  }

  private cleanup(): void {
    // Remove expired items
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }

    // If still over size limit, remove oldest items
    if (this.cache.size > this.config.maxSize) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, this.cache.size - this.config.maxSize);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        const now = Date.now();
        
        // Only load non-expired items
        Object.entries(data).forEach(([key, item]: [string, any]) => {
          if (item.expiry > now) {
            this.cache.set(key, item as CacheItem<T>);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to load cache from storage:', error);
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const data = Object.fromEntries(this.cache.entries());
      localStorage.setItem(this.config.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save cache to storage:', error);
    }
  }

  getStats() {
    const now = Date.now();
    const validItems = Array.from(this.cache.values()).filter(item => item.expiry > now);
    
    return {
      totalItems: this.cache.size,
      validItems: validItems.length,
      expiredItems: this.cache.size - validItems.length,
      oldestItem: validItems.length > 0 ? Math.min(...validItems.map(item => item.timestamp)) : null,
      newestItem: validItems.length > 0 ? Math.max(...validItems.map(item => item.timestamp)) : null
    };
  }
}

// Pre-configured cache instances
export const searchCache = new AdvancedCache({
  maxAge: 10 * 60 * 1000, // 10 minutes
  maxSize: 100,
  storageKey: 'libgen_search_cache'
});

export const coverCache = new AdvancedCache({
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for ultra-fast cover caching
  maxSize: 1000, // Increased cache size
  storageKey: 'libgen_cover_cache'
});

export const metadataCache = new AdvancedCache({
  maxAge: 60 * 60 * 1000, // 1 hour
  maxSize: 200,
  storageKey: 'libgen_metadata_cache'
});

// Utility functions for cache key generation

/**
 * A robust Base64 encoding function that handles Unicode characters.
 * @param str The string to encode.
 * @returns The Base64-encoded string.
 */
function safeBtoa(str: string): string {
  try {
    // Handles UTF-8 characters by first encoding them into a URI-compatible format.
    return btoa(unescape(encodeURIComponent(str)));
  } catch (e) {
    // Fallback for environments where the above might fail, or for non-string inputs.
    console.warn("safeBtoa fallback used for:", str, e);
    // Attempt to encode directly, which may fail for non-Latin1 characters.
    return btoa(String(str));
  }
}

export function generateSearchKey(query: string, options: any): string {
  const keyPayload = JSON.stringify({ query, ...options });
  return `search_${safeBtoa(keyPayload)}`;
}

export function generateCoverKey(isbn?: string, title?: string, author?: string, rawCoverUrl?: string): string {
  const keyPayload = JSON.stringify({ isbn, title, author, rawCoverUrl });
  return `cover_${safeBtoa(keyPayload)}`;
}

export function generateMetadataKey(md5: string): string {
  return `metadata_${md5}`;
}