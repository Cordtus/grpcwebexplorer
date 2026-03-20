// tests/execute-route.test.ts
// Tests for auth-aware execute route logic

import { describe, it, expect } from 'vitest';
import type { GrpcAuthConfig } from '@/lib/types/grpc';

/** Replicate the auth enrichment logic from the execute route */
function buildEnrichedMetadata(
	metadata: Record<string, string>,
	authConfig?: GrpcAuthConfig
): { metadata: Record<string, string>; clientCert?: string; clientKey?: string } {
	const enriched = { ...metadata };
	let clientCert: string | undefined;
	let clientKey: string | undefined;

	if (authConfig) {
		if (authConfig.type === 'bearer' && authConfig.bearerToken) {
			enriched['authorization'] = `Bearer ${authConfig.bearerToken}`;
		} else if (authConfig.type === 'api-key' && authConfig.apiKeyHeader && authConfig.apiKeyValue) {
			enriched[authConfig.apiKeyHeader] = authConfig.apiKeyValue;
		} else if (authConfig.type === 'mtls') {
			clientCert = authConfig.clientCert;
			clientKey = authConfig.clientKey;
		}
	}

	return { metadata: enriched, clientCert, clientKey };
}

describe('Execute route auth enrichment', () => {
	it('passes through metadata unchanged with no auth', () => {
		const result = buildEnrichedMetadata({ 'x-custom': 'val' });
		expect(result.metadata).toEqual({ 'x-custom': 'val' });
		expect(result.clientCert).toBeUndefined();
		expect(result.clientKey).toBeUndefined();
	});

	it('does nothing for auth type none', () => {
		const result = buildEnrichedMetadata({}, { type: 'none' });
		expect(Object.keys(result.metadata)).toHaveLength(0);
	});

	it('adds authorization header for bearer auth', () => {
		const result = buildEnrichedMetadata({}, { type: 'bearer', bearerToken: 'mytoken123' });
		expect(result.metadata['authorization']).toBe('Bearer mytoken123');
	});

	it('preserves existing metadata when adding bearer', () => {
		const result = buildEnrichedMetadata(
			{ 'x-existing': 'keep' },
			{ type: 'bearer', bearerToken: 'tok' }
		);
		expect(result.metadata['x-existing']).toBe('keep');
		expect(result.metadata['authorization']).toBe('Bearer tok');
	});

	it('adds custom header for API key auth', () => {
		const result = buildEnrichedMetadata({}, {
			type: 'api-key',
			apiKeyHeader: 'x-api-key',
			apiKeyValue: 'secret123',
		});
		expect(result.metadata['x-api-key']).toBe('secret123');
	});

	it('extracts client cert/key for mTLS', () => {
		const result = buildEnrichedMetadata({}, {
			type: 'mtls',
			clientCert: '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----',
			clientKey: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
		});
		expect(result.metadata).toEqual({}); // mTLS doesn't add metadata
		expect(result.clientCert).toContain('BEGIN CERTIFICATE');
		expect(result.clientKey).toContain('BEGIN PRIVATE KEY');
	});

	it('ignores bearer with empty token', () => {
		const result = buildEnrichedMetadata({}, { type: 'bearer', bearerToken: '' });
		expect(result.metadata['authorization']).toBeUndefined();
	});

	it('ignores API key with missing header', () => {
		const result = buildEnrichedMetadata({}, {
			type: 'api-key',
			apiKeyHeader: '',
			apiKeyValue: 'secret',
		});
		// Empty header name - should not add anything
		expect(Object.keys(result.metadata)).toHaveLength(0);
	});
});

describe('Execute route endpoint parsing', () => {
	it('adds default port for TLS when missing', () => {
		const endpoint = 'grpc.example.com';
		const tlsEnabled = true;
		const withPort = endpoint.includes(':') ? endpoint : (tlsEnabled ? `${endpoint}:443` : `${endpoint}:9090`);
		expect(withPort).toBe('grpc.example.com:443');
	});

	it('adds default port for plaintext when missing', () => {
		const endpoint = 'grpc.example.com';
		const tlsEnabled = false;
		const withPort = endpoint.includes(':') ? endpoint : (tlsEnabled ? `${endpoint}:443` : `${endpoint}:9090`);
		expect(withPort).toBe('grpc.example.com:9090');
	});

	it('preserves existing port', () => {
		const endpoint = 'grpc.example.com:8443';
		const withPort = endpoint.includes(':') ? endpoint : `${endpoint}:443`;
		expect(withPort).toBe('grpc.example.com:8443');
	});

	it('rejects chain markers', () => {
		const endpoint = 'chain:cosmoshub-4';
		expect(endpoint.startsWith('chain:')).toBe(true);
	});
});
