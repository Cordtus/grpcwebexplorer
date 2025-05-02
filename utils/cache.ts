// utils/cacheService.ts

// Type definitions
export interface CacheEntry {
  data: any;
  timestamp: number;
}

export interface CacheConfig {
  enabled: boolean;
  expirationDays: number;
}

// Constants
const CACHE_CONFIG_KEY = 'grpc_explorer_cache_config';
const METHOD_CACHE_PREFIX = 'grpc_explorer_method_';
const SERVICE_CACHE_PREFIX = 'grpc_explorer_service_';
const SERVICES_LIST_PREFIX = 'grpc_explorer_services_';

// Default cache configuration
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  expirationDays: 7
};

// Load cache configuration from localStorage
export const getCacheConfig = (): CacheConfig => {
  try {
    const storedConfig = localStorage.getItem(CACHE_CONFIG_KEY);
    if (storedConfig) {
      return JSON.parse(storedConfig);
    }
  } catch (err) {
    console.error('Failed to load cache config:', err);
  }
  
  // If no config found or error parsing, return default and save it
  setCacheConfig(DEFAULT_CACHE_CONFIG);
  return DEFAULT_CACHE_CONFIG;
};

// Save cache configuration to localStorage
export const setCacheConfig = (config: CacheConfig): void => {
  try {
    localStorage.setItem(CACHE_CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save cache config:', err);
  }
};

// Check if an entry is expired based on current config
export const isEntryExpired = (entry: CacheEntry): boolean => {
  const config = getCacheConfig();
  const now = Date.now();
  const expirationTime = entry.timestamp + (config.expirationDays * 24 * 60 * 60 * 1000);
  return now > expirationTime;
};

// Generate a cache key for a specific service/method
export const generateServiceKey = (endpoint: string, service: string, useTLS: boolean): string => {
  return `${SERVICE_CACHE_PREFIX}${useTLS ? 'tls_' : ''}${endpoint}_${service}`;
};

export const generateMethodKey = (endpoint: string, service: string, method: string, useTLS: boolean): string => {
  return `${METHOD_CACHE_PREFIX}${useTLS ? 'tls_' : ''}${endpoint}_${service}_${method}`;
};

export const generateServicesKey = (endpoint: string, useTLS: boolean): string => {
  return `${SERVICES_LIST_PREFIX}${useTLS ? 'tls_' : ''}${endpoint}`;
};

// Cache operations
export const saveToCache = (key: string, data: any): void => {
  try {
    const config = getCacheConfig();
    if (!config.enabled) return;
    
    const entry: CacheEntry = {
      data,
      timestamp: Date.now()
    };
    
    localStorage.setItem(key, JSON.stringify(entry));
    console.log(`Cached: ${key}`);
  } catch (err) {
    console.error(`Failed to cache ${key}:`, err);
  }
};

export const getFromCache = (key: string): any | null => {
  try {
    const config = getCacheConfig();
    if (!config.enabled) return null;
    
    const item = localStorage.getItem(key);
    if (!item) return null;
    
    const entry: CacheEntry = JSON.parse(item);
    
    if (isEntryExpired(entry)) {
      localStorage.removeItem(key);
      return null;
    }
    
    return entry.data;
  } catch (err) {
    console.error(`Failed to retrieve ${key} from cache:`, err);
    return null;
  }
};

// Clear all method caches
export const clearMethodCache = (): void => {
  try {
    const keys = Object.keys(localStorage);
    const methodCacheKeys = keys.filter(key => 
      key.startsWith(METHOD_CACHE_PREFIX) || 
      key.startsWith(SERVICE_CACHE_PREFIX) || 
      key.startsWith(SERVICES_LIST_PREFIX)
    );
    
    methodCacheKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log(`Cleared ${methodCacheKeys.length} cached items`);
  } catch (err) {
    console.error('Failed to clear cache:', err);
  }
};

// Get cache statistics
export const getCacheStats = (): { count: number, sizeKB: number } => {
  try {
    const keys = Object.keys(localStorage);
    const methodCacheKeys = keys.filter(key => 
      key.startsWith(METHOD_CACHE_PREFIX) || 
      key.startsWith(SERVICE_CACHE_PREFIX) || 
      key.startsWith(SERVICES_LIST_PREFIX)
    );
    
    const count = methodCacheKeys.length;
    let totalSize = 0;
    
    methodCacheKeys.forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        totalSize += item.length * 2; // Approximate size in bytes (UTF-16 chars)
      }
    });
    
    return {
      count,
      sizeKB: Math.round(totalSize / 1024)
    };
  } catch (err) {
    console.error('Failed to calculate cache stats:', err);
    return { count: 0, sizeKB: 0 };
  }
};