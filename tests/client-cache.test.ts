// tests/client-cache.test.ts
// Tests for client-cache utility functions (server-side safe parts)

import { describe, it, expect } from 'vitest';
import {
	getServicesCacheKey,
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
});
