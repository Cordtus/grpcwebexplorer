// tests/client-cache.test.ts
// Tests for client-cache utility functions (server-side safe parts)

import { describe, it, expect } from 'vitest';
import {
	getServicesCacheKey,
	normalizeRequestTimeoutMs,
	REQUEST_TIMEOUT_MS,
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

describe('Request timeout settings', () => {
	it('uses the default timeout for invalid values', () => {
		expect(normalizeRequestTimeoutMs(undefined)).toBe(REQUEST_TIMEOUT_MS.DEFAULT);
		expect(normalizeRequestTimeoutMs(null)).toBe(REQUEST_TIMEOUT_MS.DEFAULT);
		expect(normalizeRequestTimeoutMs('')).toBe(REQUEST_TIMEOUT_MS.DEFAULT);
		expect(normalizeRequestTimeoutMs(false)).toBe(REQUEST_TIMEOUT_MS.DEFAULT);
		expect(normalizeRequestTimeoutMs('not-a-number')).toBe(REQUEST_TIMEOUT_MS.DEFAULT);
	});

	it('clamps timeout values to the supported range', () => {
		expect(normalizeRequestTimeoutMs(100)).toBe(REQUEST_TIMEOUT_MS.MIN);
		expect(normalizeRequestTimeoutMs(120000)).toBe(REQUEST_TIMEOUT_MS.MAX);
	});

	it('accepts numeric strings and rounds values', () => {
		expect(normalizeRequestTimeoutMs('2500')).toBe(2500);
		expect(normalizeRequestTimeoutMs(2500.4)).toBe(2500);
		expect(normalizeRequestTimeoutMs(2500.6)).toBe(2501);
	});
});
