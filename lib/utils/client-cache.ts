// Client-side cache using browser localStorage
// Each user's data is stored locally in their browser

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
}

const CACHE_VERSION = '1.0.0';
const CACHE_PREFIX = 'grpc-explorer:';

/**
 * Get cached data from localStorage
 * @param key Cache key
 * @param ttlMs Time-to-live in milliseconds (default: 1 hour)
 */
export function getFromCache<T>(key: string, ttlMs: number = 3600000): T | null {
  if (typeof window === 'undefined') return null; // SSR safety

  try {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    const raw = localStorage.getItem(cacheKey);

    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);

    // Check version
    if (entry.version !== CACHE_VERSION) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    // Check TTL
    const age = Date.now() - entry.timestamp;
    if (age > ttlMs) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.warn('Cache read error:', error);
    return null;
  }
}

/**
 * Save data to localStorage cache
 * @param key Cache key
 * @param data Data to cache
 */
export function saveToCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return; // SSR safety

  try {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };

    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch (error) {
    console.warn('Cache write error:', error);
    // Fail silently - might be quota exceeded
  }
}

/**
 * Remove specific cache entry
 */
export function removeFromCache(key: string): void {
  if (typeof window === 'undefined') return;

  try {
    const cacheKey = `${CACHE_PREFIX}${key}`;
    localStorage.removeItem(cacheKey);
  } catch (error) {
    console.warn('Cache remove error:', error);
  }
}

/**
 * Clear all cache entries for this app
 */
export function clearAllCache(): void {
  if (typeof window === 'undefined') return;

  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('Cache clear error:', error);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { count: number; sizeKB: number } {
  if (typeof window === 'undefined') return { count: 0, sizeKB: 0 };

  try {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));

    let totalSize = 0;
    cacheKeys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        totalSize += value.length;
      }
    });

    return {
      count: cacheKeys.length,
      sizeKB: Math.round(totalSize / 1024),
    };
  } catch (error) {
    return { count: 0, sizeKB: 0 };
  }
}

/**
 * Generate cache key for service discovery
 */
export function getServicesCacheKey(endpoint: string, tlsEnabled: boolean): string {
  return `services:${endpoint}:${tlsEnabled}`;
}

/**
 * Generate cache key for endpoint configuration
 */
export function getEndpointCacheKey(endpoint: string): string {
  return `endpoint:${endpoint}`;
}
