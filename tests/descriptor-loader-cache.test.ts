// tests/descriptor-loader-cache.test.ts
// Cached service descriptors should not trigger another network request.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDescriptorCacheKey, saveToCache } from "@/lib/utils/client-cache";
import { descriptorLoader } from "@/lib/utils/descriptor-loader";

const storage = new Map<string, string>();

function installBrowserGlobals() {
	(globalThis as any).window = {
		dispatchEvent: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	};
	(globalThis as any).localStorage = {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => storage.set(key, value),
		removeItem: (key: string) => storage.delete(key),
	};
}

describe("descriptor loader cache", () => {
	beforeEach(() => {
		storage.clear();
		installBrowserGlobals();
	});

	afterEach(() => {
		descriptorLoader.clear("cache-test");
		delete (globalThis as any).window;
		delete (globalThis as any).localStorage;
		vi.restoreAllMocks();
	});

	it("serves a cached descriptor without calling fetch", async () => {
		const service = {
			name: "Query",
			fullName: "example.Query",
			methods: [],
			descriptorStatus: "loaded" as const,
		};
		saveToCache(
			getDescriptorCacheKey("grpc.example.com:443", true, "example.Query"),
			service,
		);

		const fetchMock = vi.fn();
		(globalThis as any).fetch = fetchMock;

		const received: unknown[] = [];
		const unsubscribe = descriptorLoader.onDescriptorLoaded((result) => {
			if (result.networkId === "cache-test") received.push(result.service);
		});

		descriptorLoader.enqueue({
			networkId: "cache-test",
			endpoint: "grpc.example.com:443",
			tlsEnabled: true,
			serviceName: "example.Query",
			priority: "normal",
			timestamp: Date.now(),
		});
		await new Promise((resolve) => setTimeout(resolve, 0));

		unsubscribe();
		expect(fetchMock).not.toHaveBeenCalled();
		expect(received).toEqual([service]);
	});
});
