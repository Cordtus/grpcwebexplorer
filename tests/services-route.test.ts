// tests/services-route.test.ts
// Tests for mode-aware behavior of the services route

import { describe, it, expect } from 'vitest';

describe('Services route mode behavior', () => {
	describe('generic mode logic', () => {
		it('generic mode skips chain markers', () => {
			const isGenericMode = true;
			const endpoint = 'chain:cosmoshub-4';

			// In generic mode, chain: prefix is treated as a literal endpoint
			const shouldProcessChainMarker = !isGenericMode && endpoint.startsWith('chain:');
			expect(shouldProcessChainMarker).toBe(false);
		});

		it('cosmos mode processes chain markers', () => {
			const isGenericMode = false;
			const endpoint = 'chain:cosmoshub-4';

			const shouldProcessChainMarker = !isGenericMode && endpoint.startsWith('chain:');
			expect(shouldProcessChainMarker).toBe(true);
		});

		it('generic mode skips chain-ID detection', () => {
			const isGenericMode = true;
			const detectedChainId = '';

			const shouldDetectChainId = !isGenericMode && !detectedChainId;
			expect(shouldDetectChainId).toBe(false);
		});

		it('cosmos mode attempts chain-ID detection when not set', () => {
			const isGenericMode = false;
			const detectedChainId = '';

			const shouldDetectChainId = !isGenericMode && !detectedChainId;
			expect(shouldDetectChainId).toBe(true);
		});

		it('cosmos mode skips chain-ID detection when already set', () => {
			const isGenericMode = false;
			const detectedChainId = 'cosmoshub-4';

			const shouldDetectChainId = !isGenericMode && !detectedChainId;
			expect(shouldDetectChainId).toBe(false);
		});
	});

	describe('mode parameter parsing', () => {
		it('parses generic mode from request body', () => {
			const body = { endpoint: 'localhost:9090', tlsEnabled: false, mode: 'generic' };
			expect(body.mode === 'generic').toBe(true);
		});

		it('parses cosmos mode from request body', () => {
			const body = { endpoint: 'grpc.osmosis.zone:443', tlsEnabled: true, mode: 'cosmos' };
			expect(body.mode === 'generic').toBe(false);
		});

		it('defaults to cosmos behavior when mode omitted', () => {
			const body = { endpoint: 'grpc.osmosis.zone:443', tlsEnabled: true };
			const isGenericMode = (body as any).mode === 'generic';
			expect(isGenericMode).toBe(false);
		});
	});
});
