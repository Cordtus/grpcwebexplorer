// lib/grpc/cache.ts

import fs from 'fs';
import path from 'path';
import { LRUCache } from 'lru-cache';   // ← named import, not default

// Directory where we write JSON files on disk
const CACHE_DIR = path.resolve(process.cwd(), '.cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR);
}

export type CacheEntry<T> = {
  key: string;
  data: T;
  timestamp: number;
};

// In-memory LRU cache
const inMemory = new LRUCache<string, CacheEntry<any>>({
  max: 500,
  ttl: 1000 * 60 * 60, // 1 hour
});

export function getFromCache<T>(key: string): CacheEntry<T> | undefined {
  // Try in-memory first
  const mem = inMemory.get(key);
  if (mem) {
    return mem;
  }

  // If not in-memory, try on-disk
  const diskPath = path.join(CACHE_DIR, `${key}.json`);
  if (fs.existsSync(diskPath)) {
    try {
      const raw = fs.readFileSync(diskPath, 'utf-8');
      const parsed: CacheEntry<T> = JSON.parse(raw);
      // Repopulate in-memory before returning
      inMemory.set(key, parsed);
      return parsed;
    } catch {
      // If parse fails, swallow and return undefined
      return undefined;
    }
  }

  return undefined;
}

export function writeToCache<T>(entry: CacheEntry<T>): void {
  // Write to in-memory
  inMemory.set(entry.key, entry);

  // Write to disk as JSON
  const diskPath = path.join(CACHE_DIR, `${entry.key}.json`);
  try {
    fs.writeFileSync(diskPath, JSON.stringify(entry, null, 2), 'utf-8');
  } catch {
    // Fail silently on disk write errors
  }
}

// Re‐export under the names your client code expects:
export const getCache = getFromCache;
export const setCache = writeToCache;
