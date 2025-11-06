// Client-side cache using browser localStorage
// Each user's data is stored locally in their browser

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
}

const CACHE_VERSION = '1.0.0';
const CACHE_PREFIX = 'grpc-explorer:';
const SETTINGS_KEY = 'grpc-explorer:settings';

// Cache TTL options (in milliseconds)
export const CACHE_TTL_OPTIONS = {
  NONE: 0,
  ONE_HOUR: 3600000,      // 1 hour
  SIX_HOURS: 21600000,    // 6 hours
  ONE_DAY: 86400000,      // 24 hours
  THIRTY_SIX_HOURS: 129600000, // 36 hours
} as const;

export type CacheTTLOption = keyof typeof CACHE_TTL_OPTIONS;

export const CACHE_TTL_LABELS: Record<CacheTTLOption, string> = {
  NONE: 'None (always fresh)',
  ONE_HOUR: '1 hour',
  SIX_HOURS: '6 hours',
  ONE_DAY: '24 hours',
  THIRTY_SIX_HOURS: '36 hours',
};

/**
 * Get user's preferred cache TTL setting
 */
export function getCacheTTL(): number {
  if (typeof window === 'undefined') return CACHE_TTL_OPTIONS.ONE_HOUR;

  try {
    const settings = localStorage.getItem(SETTINGS_KEY);
    if (!settings) return CACHE_TTL_OPTIONS.ONE_HOUR;

    const parsed = JSON.parse(settings);
    const ttlOption = parsed.cacheTTL as CacheTTLOption;

    return CACHE_TTL_OPTIONS[ttlOption] || CACHE_TTL_OPTIONS.ONE_HOUR;
  } catch (error) {
    return CACHE_TTL_OPTIONS.ONE_HOUR;
  }
}

/**
 * Set user's preferred cache TTL setting
 */
export function setCacheTTL(option: CacheTTLOption): void {
  if (typeof window === 'undefined') return;

  try {
    const settings = localStorage.getItem(SETTINGS_KEY);
    const parsed = settings ? JSON.parse(settings) : {};

    parsed.cacheTTL = option;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
  } catch (error) {
    console.warn('Failed to save cache TTL setting:', error);
  }
}

/**
 * Get cached data from localStorage
 * @param key Cache key
 * @param ttlMs Time-to-live in milliseconds (default: uses user preference)
 */
export function getFromCache<T>(key: string, ttlMs?: number): T | null {
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

    // Get TTL (use provided or user preference)
    const effectiveTTL = ttlMs !== undefined ? ttlMs : getCacheTTL();

    // If TTL is 0 (NONE), don't use cache
    if (effectiveTTL === 0) {
      return null;
    }

    // Check TTL
    const age = Date.now() - entry.timestamp;
    if (age > effectiveTTL) {
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
