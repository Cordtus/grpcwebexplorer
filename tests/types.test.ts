// tests/types.test.ts
// Type-level tests: verify type exports and structural correctness

import { describe, it, expect } from 'vitest';
import type {
	ExplorerMode,
	GrpcAuthConfig,
	BufBsrSource,
	GrpcNetwork,
	MethodInstance,
	GrpcService,
	GrpcMethod,
	EndpointConfig,
	ExecutionResult,
	HttpRule,
} from '@/lib/types/grpc';

describe('Type definitions', () => {
	it('ExplorerMode accepts valid values', () => {
		const generic: ExplorerMode = 'generic';
		const cosmos: ExplorerMode = 'cosmos';
		expect(generic).toBe('generic');
		expect(cosmos).toBe('cosmos');
	});

	it('GrpcAuthConfig supports all auth types', () => {
		const none: GrpcAuthConfig = { type: 'none' };
		const bearer: GrpcAuthConfig = { type: 'bearer', bearerToken: 'tok' };
		const apiKey: GrpcAuthConfig = { type: 'api-key', apiKeyHeader: 'x-key', apiKeyValue: 'val' };
		const mtls: GrpcAuthConfig = { type: 'mtls', clientCert: 'cert', clientKey: 'key' };

		expect(none.type).toBe('none');
		expect(bearer.bearerToken).toBe('tok');
		expect(apiKey.apiKeyHeader).toBe('x-key');
		expect(mtls.clientCert).toBe('cert');
	});

	it('BufBsrSource has required module field', () => {
		const src: BufBsrSource = { module: 'connectrpc/eliza' };
		expect(src.module).toBe('connectrpc/eliza');

		const full: BufBsrSource = {
			module: 'cosmos/cosmos-sdk',
			version: 'v0.50.0',
			symbols: ['cosmos.bank.v1beta1'],
			authToken: 'token',
		};
		expect(full.version).toBe('v0.50.0');
	});

	it('GrpcNetwork has new optional fields', () => {
		const network: GrpcNetwork = {
			id: '1',
			name: 'test',
			endpoint: 'localhost:9090',
			tlsEnabled: false,
			services: [],
			color: '#000',
			mode: 'generic',
			bsrSource: { module: 'test/mod' },
			authConfig: { type: 'bearer', bearerToken: 'abc' },
		};

		expect(network.mode).toBe('generic');
		expect(network.bsrSource?.module).toBe('test/mod');
		expect(network.authConfig?.type).toBe('bearer');
	});

	it('GrpcNetwork works without new optional fields (backwards compat)', () => {
		const network: GrpcNetwork = {
			id: '2',
			name: 'cosmos',
			endpoint: 'grpc.osmosis.zone:443',
			tlsEnabled: true,
			services: [],
			color: '#3b82f6',
		};

		expect(network.mode).toBeUndefined();
		expect(network.bsrSource).toBeUndefined();
		expect(network.authConfig).toBeUndefined();
	});

	it('MethodInstance has optional authConfig', () => {
		const method: GrpcMethod = {
			name: 'Test',
			fullName: 'svc.Test',
			requestType: 'Req',
			responseType: 'Res',
			requestStreaming: false,
			responseStreaming: false,
			requestTypeDefinition: { name: 'Req', fullName: 'Req', fields: [] },
			responseTypeDefinition: { name: 'Res', fullName: 'Res', fields: [] },
		};

		const instance: MethodInstance = {
			id: '1',
			networkId: '1',
			method,
			service: { name: 'Svc', fullName: 'svc', methods: [method] },
			color: '#000',
			authConfig: { type: 'api-key', apiKeyHeader: 'x-key', apiKeyValue: 'val' },
		};

		expect(instance.authConfig?.type).toBe('api-key');
	});
});
