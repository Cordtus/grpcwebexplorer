// tests/client-cache.test.ts
// Tests for client-cache utility functions (server-side safe parts)

import { describe, it, expect } from 'vitest';
import {
	getServicesCacheKey,
	getEndpointCacheKey,
	getBsrCacheKey,
} from '@/lib/utils/client-cache';

describe('Cache key generation', () => {
	describe('getServicesCacheKey', () => {
		it('includes endpoint and TLS flag', () => {
			const key = getServicesCacheKey('grpc.example.com:443', true);
			expect(key).toBe('services:grpc.example.com:443:true');
		});

		it('produces different keys for TLS on/off', () => {
			const keyTls = getServicesCacheKey('host:9090', true);
			const keyNoTls = getServicesCacheKey('host:9090', false);
			expect(keyTls).not.toBe(keyNoTls);
		});

		it('produces different keys for different endpoints', () => {
			const key1 = getServicesCacheKey('host1:443', true);
			const key2 = getServicesCacheKey('host2:443', true);
			expect(key1).not.toBe(key2);
		});
	});

	describe('getEndpointCacheKey', () => {
		it('includes endpoint in key', () => {
			const key = getEndpointCacheKey('grpc.osmosis.zone:443');
			expect(key).toBe('endpoint:grpc.osmosis.zone:443');
		});
	});

	describe('getBsrCacheKey', () => {
		it('includes module and version', () => {
			const key = getBsrCacheKey('connectrpc/eliza', 'main');
			expect(key).toBe('bsr:connectrpc/eliza:main');
		});

		it('produces different keys for different versions', () => {
			const key1 = getBsrCacheKey('cosmos/cosmos-sdk', 'main');
			const key2 = getBsrCacheKey('cosmos/cosmos-sdk', 'v0.50.0');
			expect(key1).not.toBe(key2);
		});

		it('produces different keys for different modules', () => {
			const key1 = getBsrCacheKey('grpc/grpc-health', 'main');
			const key2 = getBsrCacheKey('grpc/grpc-reflection', 'main');
			expect(key1).not.toBe(key2);
		});
	});
});
