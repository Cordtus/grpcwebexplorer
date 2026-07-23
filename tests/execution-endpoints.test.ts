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
});
