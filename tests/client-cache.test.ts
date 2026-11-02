// tests/client-cache.test.ts
// Tests for client-cache utility functions (server-side safe parts)

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	filterRemovedCachedServices,
	getCacheTTL,
	getDescriptorCacheKey,
	getServicesCacheKey,
	hasRemovedCachedServices,
	normalizeRequestTimeoutMs,
	REQUEST_TIMEOUT_MS,
	setCacheTTL,
} from "@/lib/utils/client-cache";

describe("Cache key generation", () => {
	describe("getServicesCacheKey", () => {
		it("includes endpoint and TLS flag", () => {
			const key = getServicesCacheKey("grpc.example.com:443", true);
			expect(key).toBe("services:grpc.example.com:443:true");
		});

		it("produces different keys for TLS on/off", () => {
			const keyTls = getServicesCacheKey("host:9090", true);
			const keyNoTls = getServicesCacheKey("host:9090", false);
			expect(keyTls).not.toBe(keyNoTls);
		});

		it("produces different keys for different endpoints", () => {
			const key1 = getServicesCacheKey("host1:443", true);
			const key2 = getServicesCacheKey("host2:443", true);
			expect(key1).not.toBe(key2);
		});
	});

	describe("removed service migration", () => {
		const pseudo = {
			name: "Transactions",
			fullName: "cosmos.tx.v1beta1.Transactions",
		};
		const real = { name: "Service", fullName: "cosmos.tx.v1beta1.Service" };

		it("drops the old synthetic Transactions service", () => {
			expect(filterRemovedCachedServices([pseudo, real])).toEqual([real]);
			expect(hasRemovedCachedServices([pseudo, real])).toBe(true);
			expect(hasRemovedCachedServices([real])).toBe(false);
		});

		it("handles missing services safely", () => {
			expect(filterRemovedCachedServices(undefined)).toEqual([]);
			expect(hasRemovedCachedServices(undefined)).toBe(false);
		});
	});

	describe("getDescriptorCacheKey", () => {
		it("includes endpoint, TLS flag, and service name", () => {
			expect(
				getDescriptorCacheKey(
					"grpc.example.com:443",
					true,
					"cosmos.bank.Query",
				),
			).toBe("descriptor:grpc.example.com:443:true:cosmos.bank.Query");
		});

		it("separates services and TLS modes", () => {
			expect(getDescriptorCacheKey("host:443", true, "a.Query")).not.toBe(
				getDescriptorCacheKey("host:443", false, "a.Query"),
			);
			expect(getDescriptorCacheKey("host:443", true, "a.Query")).not.toBe(
				getDescriptorCacheKey("host:443", true, "b.Query"),
			);
		});
	});
});

describe("Cache TTL settings", () => {
	const store = new Map<string, string>();

	beforeEach(() => {
		vi.stubGlobal("window", {});
		vi.stubGlobal("localStorage", {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => store.set(key, value),
			removeItem: (key: string) => store.delete(key),
		});
	});

	afterEach(() => {
		store.clear();
		vi.unstubAllGlobals();
	});

	it("preserves the NONE option as zero", () => {
		setCacheTTL("NONE");
		expect(getCacheTTL()).toBe(0);
	});

	it("defaults to never expire when unset", () => {
		expect(getCacheTTL()).toBe(Number.POSITIVE_INFINITY);
	});
});

describe("Request timeout settings", () => {
	it("uses the default timeout for invalid values", () => {
		expect(normalizeRequestTimeoutMs(undefined)).toBe(
			REQUEST_TIMEOUT_MS.DEFAULT,
		);
		expect(normalizeRequestTimeoutMs(null)).toBe(REQUEST_TIMEOUT_MS.DEFAULT);
		expect(normalizeRequestTimeoutMs("")).toBe(REQUEST_TIMEOUT_MS.DEFAULT);
		expect(normalizeRequestTimeoutMs(false)).toBe(REQUEST_TIMEOUT_MS.DEFAULT);
		expect(normalizeRequestTimeoutMs("not-a-number")).toBe(
			REQUEST_TIMEOUT_MS.DEFAULT,
		);
	});

	it("clamps timeout values to the supported range", () => {
		expect(normalizeRequestTimeoutMs(100)).toBe(REQUEST_TIMEOUT_MS.MIN);
		expect(normalizeRequestTimeoutMs(120000)).toBe(REQUEST_TIMEOUT_MS.MAX);
	});

	it("accepts numeric strings and rounds values", () => {
		expect(normalizeRequestTimeoutMs("2500")).toBe(2500);
		expect(normalizeRequestTimeoutMs(2500.4)).toBe(2500);
		expect(normalizeRequestTimeoutMs(2500.6)).toBe(2501);
	});
});
