// Client-side cache using browser localStorage
// Each user's data is stored locally in their browser

export interface CacheEntry<T> {
	data: T;
	timestamp: number;
	version: string;
}

const CACHE_VERSION = "2.3.0";
const CACHE_PREFIX = "grpc-explorer:";
const SETTINGS_KEY = "grpc-explorer:settings";

function readSettings(): Record<string, unknown> {
	if (typeof window === "undefined") return {};
	try {
		const raw = localStorage.getItem(SETTINGS_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

function writeSetting(key: string, value: unknown): void {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(
			SETTINGS_KEY,
			JSON.stringify({ ...readSettings(), [key]: value }),
		);
	} catch (error) {
		console.warn(`Failed to save ${key} setting:`, error);
	}
}

export const NETWORK_CACHE_STORAGE_KEY = "grpc-explorer-networks";
export const CACHE_CHANGED_EVENT = "grpc-explorer:cache-changed";

function notifyCacheChanged(): void {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new Event(CACHE_CHANGED_EVENT));
}

export const REQUEST_TIMEOUT_MS = {
	DEFAULT: 10000,
	MIN: 1000,
	MAX: 60000,
} as const;

// Cache TTL options (in milliseconds)
export const CACHE_TTL_OPTIONS = {
	NONE: 0,
	ONE_HOUR: 3600000,
	SIX_HOURS: 21600000,
	ONE_DAY: 86400000,
	THIRTY_SIX_HOURS: 129600000,
	SEVENTY_TWO_HOURS: 259200000,
	MAX: Infinity,
} as const;

export type CacheTTLOption = keyof typeof CACHE_TTL_OPTIONS;

export const CACHE_TTL_LABELS: Record<CacheTTLOption, string> = {
	NONE: "None (always fresh)",
	ONE_HOUR: "1 hour",
	SIX_HOURS: "6 hours",
	ONE_DAY: "24 hours",
	THIRTY_SIX_HOURS: "36 hours",
	SEVENTY_TWO_HOURS: "72 hours",
	MAX: "Never expire",
};

export function normalizeRequestTimeoutMs(
	value: unknown,
	defaultValue: number = REQUEST_TIMEOUT_MS.DEFAULT,
): number {
	if (value === null || value === "" || typeof value === "boolean") {
		return defaultValue;
	}

	const parsed = typeof value === "number" ? value : Number(value);

	if (!Number.isFinite(parsed)) {
		return defaultValue;
	}

	const rounded = Math.round(parsed);
	return Math.min(
		REQUEST_TIMEOUT_MS.MAX,
		Math.max(REQUEST_TIMEOUT_MS.MIN, rounded),
	);
}

export function getRequestTimeoutMs(): number {
	return normalizeRequestTimeoutMs(readSettings().requestTimeoutMs);
}

export function setRequestTimeoutMs(timeoutMs: number): void {
	writeSetting("requestTimeoutMs", normalizeRequestTimeoutMs(timeoutMs));
}

/** Get user's preferred cache TTL setting. */
export function getCacheTTL(): number {
	const ttlOption = readSettings().cacheTTL as CacheTTLOption | undefined;
	return ttlOption && ttlOption in CACHE_TTL_OPTIONS
		? CACHE_TTL_OPTIONS[ttlOption]
		: CACHE_TTL_OPTIONS.MAX;
}

/** Set user's preferred cache TTL setting. */
export function setCacheTTL(option: CacheTTLOption): void {
	writeSetting("cacheTTL", option);
}

/**
 * Get cached data from localStorage
 * @param key Cache key
 * @param ttlMs Time-to-live in milliseconds (default: uses user preference)
 */
export function getFromCache<T>(key: string, ttlMs?: number): T | null {
	if (typeof window === "undefined") return null; // SSR safety

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

		// If TTL is Infinity (MAX), never expire
		if (effectiveTTL === Infinity) {
			return entry.data;
		}

		// Check TTL
		const age = Date.now() - entry.timestamp;
		if (age > effectiveTTL) {
			localStorage.removeItem(cacheKey);
			return null;
		}

		return entry.data;
	} catch (error) {
		console.warn("Cache read error:", error);
		return null;
	}
}

/**
 * Save data to localStorage cache
 * @param key Cache key
 * @param data Data to cache
 */
export function saveToCache<T>(key: string, data: T): void {
	if (typeof window === "undefined") return; // SSR safety

	try {
		const cacheKey = `${CACHE_PREFIX}${key}`;
		const entry: CacheEntry<T> = {
			data,
			timestamp: Date.now(),
			version: CACHE_VERSION,
		};

		localStorage.setItem(cacheKey, JSON.stringify(entry));
		notifyCacheChanged();
	} catch (error) {
		console.warn("Cache write error:", error);
		// Fail silently - might be quota exceeded
	}
}

/**
 * Remove specific cache entry
 */
export function removeFromCache(key: string): void {
	if (typeof window === "undefined") return;

	try {
		const cacheKey = `${CACHE_PREFIX}${key}`;
		localStorage.removeItem(cacheKey);
		notifyCacheChanged();
	} catch (error) {
		console.warn("Cache remove error:", error);
	}
}

/**
 * Clear all cache entries for this app
 */
export function clearAllCache(): void {
	if (typeof window === "undefined") return;

	try {
		const keys = Object.keys(localStorage);
		keys.forEach((key) => {
			if (key.startsWith(CACHE_PREFIX)) {
				localStorage.removeItem(key);
			}
		});
		notifyCacheChanged();
	} catch (error) {
		console.warn("Cache clear error:", error);
	}
}

export interface CacheStats {
	serviceCount: number;
	descriptorCount: number;
	networkCount: number;
	sizeKB: number;
}

/**
 * Get cache statistics. The menu bar shows the service-list count; descriptor
 * entries are reported separately so "cached" means something specific.
 */
export function getCacheStats(): CacheStats {
	if (typeof window === "undefined") {
		return {
			serviceCount: 0,
			descriptorCount: 0,
			networkCount: 0,
			sizeKB: 0,
		};
	}

	try {
		const keys = Object.keys(localStorage);
		const serviceKeys = keys.filter((key) =>
			key.startsWith(`${CACHE_PREFIX}services:`),
		);
		const descriptorKeys = keys.filter((key) =>
			key.startsWith(`${CACHE_PREFIX}descriptor:`),
		);
		const cacheKeys = [...serviceKeys, ...descriptorKeys];

		let totalSize = 0;
		for (const key of [...cacheKeys, NETWORK_CACHE_STORAGE_KEY]) {
			const value = localStorage.getItem(key);
			if (value) totalSize += value.length;
		}

		let networkCount = 0;
		try {
			const networks = localStorage.getItem(NETWORK_CACHE_STORAGE_KEY);
			if (networks) {
				const parsed = JSON.parse(networks);
				if (Array.isArray(parsed?.networks)) {
					networkCount = parsed.networks.length;
				}
			}
		} catch {
			// Ignore malformed network cache.
		}

		return {
			serviceCount: serviceKeys.length,
			descriptorCount: descriptorKeys.length,
			networkCount,
			sizeKB: Math.round(totalSize / 1024),
		};
	} catch (_error) {
		return {
			serviceCount: 0,
			descriptorCount: 0,
			networkCount: 0,
			sizeKB: 0,
		};
	}
}

/**
 * Generate cache key for service discovery
 */
export function getServicesCacheKey(
	endpoint: string,
	tlsEnabled: boolean,
): string {
	return `services:${endpoint}:${tlsEnabled}`;
}

// Removed services can live on in persisted network/service caches written by
// older builds. Drop them on read so an upgrade does not keep exposing them.
const REMOVED_SERVICE_FULL_NAMES = new Set(["cosmos.tx.v1beta1.Transactions"]);

export function filterRemovedCachedServices<T extends { fullName: string }>(
	services: T[] | undefined,
): T[] {
	return (services || []).filter(
		(service) => !REMOVED_SERVICE_FULL_NAMES.has(service.fullName),
	);
}

export function hasRemovedCachedServices(
	services: Array<{ fullName: string }> | undefined,
): boolean {
	return (services || []).some((service) =>
		REMOVED_SERVICE_FULL_NAMES.has(service.fullName),
	);
}

/** Generate cache key for one service descriptor. */
export function getDescriptorCacheKey(
	endpoint: string,
	tlsEnabled: boolean,
	serviceName: string,
): string {
	return `descriptor:${endpoint}:${tlsEnabled}:${serviceName}`;
}

/** Drop cached descriptors for an endpoint, e.g. after a forced refresh. */
export function clearDescriptorCache(
	endpoint: string,
	tlsEnabled: boolean,
): void {
	if (typeof window === "undefined") return;

	try {
		const prefix = `${CACHE_PREFIX}${getDescriptorCacheKey(
			endpoint,
			tlsEnabled,
			"",
		)}`;
		for (const key of Object.keys(localStorage)) {
			if (key.startsWith(prefix)) {
				localStorage.removeItem(key);
			}
		}
		notifyCacheChanged();
	} catch (error) {
		console.warn("Descriptor cache clear error:", error);
	}
}

/**
 * Cached chain info for display purposes
 */
export interface CachedChainInfo {
	endpoint: string;
	chainId?: string;
	tlsEnabled: boolean;
	serviceCount: number;
	cachedAt: number;
	age: string;
}

/**
 * List all cached chains (from services cache)
 * Returns information about each cached chain for display in UI
 */
export function listCachedChains(): CachedChainInfo[] {
	if (typeof window === "undefined") return [];

	try {
		const keys = Object.keys(localStorage);
		const servicesCacheKeys = keys.filter((key) =>
			key.startsWith(`${CACHE_PREFIX}services:`),
		);

		const cachedChains: CachedChainInfo[] = [];
		const now = Date.now();

		for (const key of servicesCacheKeys) {
			try {
				const raw = localStorage.getItem(key);
				if (!raw) continue;

				const entry: CacheEntry<any> = JSON.parse(raw);

				// Check version
				if (entry.version !== CACHE_VERSION) continue;

				// Parse the key to get endpoint and TLS info
				// Key format: grpc-explorer:services:{endpoint}:{tls}
				const keyParts = key.replace(`${CACHE_PREFIX}services:`, "").split(":");
				const tlsEnabled = keyParts.pop() === "true";
				const endpoint = keyParts.join(":"); // Handle ports in endpoint

				const data = entry.data;
				const chainId = data?.chainId || data?.status?.chainId;
				const serviceCount = data?.services?.length || 0;
				const cachedAt = entry.timestamp;

				// Calculate human-readable age
				const ageMs = now - cachedAt;
				const ageMinutes = Math.floor(ageMs / 60000);
				const ageHours = Math.floor(ageMs / 3600000);
				const ageDays = Math.floor(ageMs / 86400000);

				let age: string;
				if (ageDays > 0) {
					age = `${ageDays}d ago`;
				} else if (ageHours > 0) {
					age = `${ageHours}h ago`;
				} else if (ageMinutes > 0) {
					age = `${ageMinutes}m ago`;
				} else {
					age = "just now";
				}

				cachedChains.push({
					endpoint,
					chainId,
					tlsEnabled,
					serviceCount,
					cachedAt,
					age,
				});
			} catch (_e) {}
		}

		// Sort by most recently cached
		return cachedChains.sort((a, b) => b.cachedAt - a.cachedAt);
	} catch (error) {
		console.warn("Failed to list cached chains:", error);
		return [];
	}
}
