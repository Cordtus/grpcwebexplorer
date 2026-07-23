import { describe, expect, it } from 'vitest';
import { executeWithEndpointFailover, getExecutionEndpoints } from '@/lib/utils/execution-endpoints';
import type { GrpcNetwork } from '@/lib/types/grpc';

const cosmosNetwork: GrpcNetwork = {
	id: 'sentinel',
	name: 'sentinel',
	endpoint: 'primary:443',
	tlsEnabled: true,
	mode: 'cosmos',
	services: [],
	color: '#3b82f6',
	endpointConfigs: [
		{ address: 'primary:443', tlsEnabled: true, selected: true },
		{ address: 'secondary:443', tlsEnabled: true, selected: true },
		{ address: 'tertiary:9090', tlsEnabled: false, selected: true },
	],
};

describe('execution endpoint selection', () => {
	it('starts Cosmos failover at the round-robin endpoint and retains every selected fallback', () => {
		expect(getExecutionEndpoints(cosmosNetwork, 1)).toEqual([
			{ address: 'secondary:443', tlsEnabled: true },
			{ address: 'tertiary:9090', tlsEnabled: false },
			{ address: 'primary:443', tlsEnabled: true },
		]);
	});

	it('uses one configured endpoint for generic gRPC sources', () => {
		const genericNetwork: GrpcNetwork = {
			...cosmosNetwork,
			mode: 'generic',
			endpoint: 'generic:443',
			endpointConfigs: [{ address: 'alternate:443', tlsEnabled: true, selected: true }],
		};

		expect(getExecutionEndpoints(genericNetwork, 0)).toEqual([
			{ address: 'generic:443', tlsEnabled: true },
		]);
	});

	it('keeps selected Cosmos endpoints in round-robin order before a successful discovery fallback', () => {
		const network: GrpcNetwork = {
			...cosmosNetwork,
			endpoint: 'discovered:443',
			endpointHealth: { 'discovered:443': { lastSuccess: Date.now() } },
		};

		expect(getExecutionEndpoints(network, 1).map((endpoint) => endpoint.address)).toEqual([
			'secondary:443',
			'tertiary:9090',
			'primary:443',
			'discovered:443',
		]);
	});

	it('continues to the next selected endpoint after a connection failure', async () => {
		const attempts: string[] = [];
		const result = await executeWithEndpointFailover(
			getExecutionEndpoints(cosmosNetwork, 0),
			async (endpoint) => {
				attempts.push(endpoint.address);
				if (endpoint.address === 'primary:443') {
					throw new Error('connect ETIMEDOUT primary:443');
				}
				return { value: 'response' };
			}
		);

		expect(attempts).toEqual(['primary:443', 'secondary:443']);
		expect(result).toEqual({
			value: { value: 'response' },
			endpoint: { address: 'secondary:443', tlsEnabled: true },
			failures: [{ endpoint: 'primary:443', error: 'connect ETIMEDOUT primary:443' }],
		});
	});

	it('prefers the successful discovery endpoint and skips endpoints on cooldown', () => {
		const now = 1_000_000;
		const network: GrpcNetwork = {
			...cosmosNetwork,
			endpoint: 'discovered:443',
			endpointConfigs: [
				{ address: 'denied:443', tlsEnabled: true, selected: true },
				{ address: 'timed-out:443', tlsEnabled: true, selected: true },
			],
			endpointHealth: {
				'discovered:443': { lastSuccess: now - 1_000 },
				'denied:443': { retryAfter: now + 60_000, lastErrorKind: 'incompatible' },
				'timed-out:443': { retryAfter: now + 10_000, lastErrorKind: 'transient' },
			},
		};

		expect(getExecutionEndpoints(network, 0, now)).toEqual([
			{ address: 'discovered:443', tlsEnabled: true },
		]);
	});

	it('uses a cooled-down endpoint only when there is no eligible alternative', () => {
		const now = 1_000_000;
		const network: GrpcNetwork = {
			...cosmosNetwork,
			endpoint: 'only:443',
			endpointConfigs: [{ address: 'only:443', tlsEnabled: true, selected: true }],
			endpointHealth: {
				'only:443': { retryAfter: now + 60_000, lastErrorKind: 'incompatible' },
			},
		};

		expect(getExecutionEndpoints(network, 0, now)).toEqual([
			{ address: 'only:443', tlsEnabled: true },
		]);
	});

	it('stops retrying when the request-wide deadline is exhausted', async () => {
		const attempts: string[] = [];
		let now = 0;

		await expect(executeWithEndpointFailover(
			[
				{ address: 'first:443', tlsEnabled: true },
				{ address: 'second:443', tlsEnabled: true },
			],
			async (endpoint) => {
				attempts.push(endpoint.address);
				now = 10;
				throw new Error('connection failed');
			},
			{ deadlineAt: 10, now: () => now }
		)).rejects.toMatchObject({
			failures: [{ endpoint: 'first:443', error: 'connection failed' }],
		});
		await expect(executeWithEndpointFailover(
			[{ address: 'first:443', tlsEnabled: true }],
			async () => { throw new Error('connection failed'); },
			{ deadlineAt: 0, now: () => 0 }
		)).rejects.toThrow('execution deadline exhausted');

		expect(attempts).toEqual(['first:443']);
	});

	it('does not fail over a method-level error when the caller marks it unsafe to retry', async () => {
		const attempts: string[] = [];
		await expect(executeWithEndpointFailover(
			[
				{ address: 'first:443', tlsEnabled: true },
				{ address: 'second:443', tlsEnabled: true },
			],
			async (endpoint) => {
				attempts.push(endpoint.address);
				throw new Error('Method invocation failed: 3 INVALID_ARGUMENT');
			},
			{ shouldFailover: () => false }
		)).rejects.toThrow('Method invocation failed: 3 INVALID_ARGUMENT');

		expect(attempts).toEqual(['first:443']);
	});
});
