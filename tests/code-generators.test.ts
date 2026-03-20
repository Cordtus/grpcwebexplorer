// tests/code-generators.test.ts
// Unit tests for multi-language code generation

import { describe, it, expect } from 'vitest';
import {
	generateGrpcurl,
	generateCurl,
	generateTypescriptSnippet,
	generateTypescriptFull,
	generateGoSnippet,
	generateGoFull,
	generatePythonSnippet,
	generatePythonFull,
	type CodeGenContext,
} from '@/lib/utils/code-generators';

/** Minimal context for tests */
function makeCtx(overrides: Partial<CodeGenContext> = {}): CodeGenContext {
	return {
		serviceName: 'example.greeter.GreeterService',
		methodName: 'SayHello',
		requestType: 'example.greeter.HelloRequest',
		responseType: 'example.greeter.HelloReply',
		requestTypeDefinition: {
			name: 'HelloRequest',
			fullName: 'example.greeter.HelloRequest',
			fields: [
				{ name: 'name', type: 'string', rule: 'optional' },
			],
		},
		requestStreaming: false,
		responseStreaming: false,
		endpoint: 'grpc.example.com:443',
		tlsEnabled: true,
		params: { name: 'world' },
		metadata: {},
		...overrides,
	};
}

// -- grpcurl --

describe('generateGrpcurl', () => {
	it('generates valid grpcurl command with TLS', () => {
		const out = generateGrpcurl(makeCtx());
		expect(out).toContain('grpcurl');
		expect(out).toContain('grpc.example.com:443');
		expect(out).toContain('example.greeter.GreeterService/SayHello');
		expect(out).not.toContain('-plaintext'); // TLS enabled
		expect(out).toContain('"name"');
	});

	it('includes -plaintext flag when TLS disabled', () => {
		const out = generateGrpcurl(makeCtx({ tlsEnabled: false }));
		expect(out).toContain('-plaintext');
	});

	it('includes metadata as -H flags', () => {
		const out = generateGrpcurl(makeCtx({
			metadata: { 'x-custom': 'value123' },
		}));
		expect(out).toContain("-H 'x-custom: value123'");
	});

	it('includes bearer auth in metadata', () => {
		const out = generateGrpcurl(makeCtx({
			authConfig: { type: 'bearer', bearerToken: 'tok123' },
		}));
		expect(out).toContain("-H 'authorization: Bearer tok123'");
	});

	it('includes API key in metadata', () => {
		const out = generateGrpcurl(makeCtx({
			authConfig: { type: 'api-key', apiKeyHeader: 'x-api-key', apiKeyValue: 'secret' },
		}));
		expect(out).toContain("-H 'x-api-key: secret'");
	});

	it('skips data flag when no fields and empty params', () => {
		const out = generateGrpcurl(makeCtx({
			params: {},
			requestTypeDefinition: { name: 'Empty', fullName: 'google.protobuf.Empty', fields: [] },
		}));
		expect(out).not.toContain("-d");
	});
});

// -- curl (REST) --

describe('generateCurl', () => {
	it('returns fallback message when no httpRule', () => {
		const out = generateCurl(makeCtx(), 'https://api.example.com');
		expect(out).toContain('No known REST mapping');
	});

	it('generates GET curl with path params', () => {
		const out = generateCurl(
			makeCtx({ params: { name: 'cosmos' } }),
			'https://api.example.com',
			{ get: '/v1/greet/{name}' }
		);
		expect(out).toContain('curl -X GET');
		expect(out).toContain('https://api.example.com/v1/greet/cosmos');
	});

	it('generates POST curl with body', () => {
		const out = generateCurl(
			makeCtx(),
			'https://api.example.com',
			{ post: '/v1/greet', body: '*' }
		);
		expect(out).toContain('curl -X POST');
		expect(out).toContain("Content-Type: application/json");
		expect(out).toContain('"name"');
	});

	it('includes auth headers in curl', () => {
		const out = generateCurl(
			makeCtx({ authConfig: { type: 'bearer', bearerToken: 'abc' } }),
			'https://api.example.com',
			{ get: '/v1/test' }
		);
		expect(out).toContain("authorization: Bearer abc");
	});
});

// -- TypeScript --

describe('generateTypescriptSnippet', () => {
	it('generates valid TypeScript with grpc-js import', () => {
		const out = generateTypescriptSnippet(makeCtx());
		expect(out).toContain("import * as grpc from '@grpc/grpc-js'");
		expect(out).toContain('grpc.example.com:443');
		expect(out).toContain('createSsl()');
		expect(out).toContain('/example.greeter.GreeterService/SayHello');
	});

	it('uses insecure credentials when TLS off', () => {
		const out = generateTypescriptSnippet(makeCtx({ tlsEnabled: false }));
		expect(out).toContain('createInsecure()');
	});
});

describe('generateTypescriptFull', () => {
	it('generates full scaffold with error handling', () => {
		const out = generateTypescriptFull(makeCtx());
		expect(out).toContain('async function invoke');
		expect(out).toContain('deadline');
		expect(out).toContain('reject');
		expect(out).toContain('client.close()');
	});

	it('includes metadata from auth config', () => {
		const out = generateTypescriptFull(makeCtx({
			authConfig: { type: 'bearer', bearerToken: 'mytoken' },
		}));
		expect(out).toContain('authorization');
		expect(out).toContain('Bearer mytoken');
	});
});

// -- Go --

describe('generateGoSnippet', () => {
	it('generates valid Go code with TLS', () => {
		const out = generateGoSnippet(makeCtx());
		expect(out).toContain('package main');
		expect(out).toContain('"google.golang.org/grpc"');
		expect(out).toContain('credentials.NewTLS(nil)');
		expect(out).toContain('/example.greeter.GreeterService/SayHello');
	});

	it('uses insecure when TLS off', () => {
		const out = generateGoSnippet(makeCtx({ tlsEnabled: false }));
		expect(out).toContain('insecure.NewCredentials()');
	});

	it('includes metadata for auth', () => {
		const out = generateGoSnippet(makeCtx({
			authConfig: { type: 'api-key', apiKeyHeader: 'x-key', apiKeyValue: 'val' },
		}));
		expect(out).toContain('metadata');
		expect(out).toContain('x-key');
		expect(out).toContain('val');
	});
});

describe('generateGoFull', () => {
	it('generates full scaffold with status error handling', () => {
		const out = generateGoFull(makeCtx());
		expect(out).toContain('status.FromError');
		expect(out).toContain('context.WithTimeout');
		expect(out).toContain('json.MarshalIndent');
	});
});

// -- Python --

describe('generatePythonSnippet', () => {
	it('generates valid Python code', () => {
		const out = generatePythonSnippet(makeCtx());
		expect(out).toContain('import grpc');
		expect(out).toContain('ssl_channel_credentials()');
		expect(out).toContain('/example.greeter.GreeterService/SayHello');
	});

	it('uses insecure channel when TLS off', () => {
		const out = generatePythonSnippet(makeCtx({ tlsEnabled: false }));
		expect(out).toContain('insecure_channel');
	});

	it('includes metadata tuples for auth', () => {
		const out = generatePythonSnippet(makeCtx({
			authConfig: { type: 'bearer', bearerToken: 'pytoken' },
		}));
		expect(out).toContain('metadata=');
		expect(out).toContain('authorization');
		expect(out).toContain('Bearer pytoken');
	});
});

describe('generatePythonFull', () => {
	it('generates full scaffold with error handling', () => {
		const out = generatePythonFull(makeCtx());
		expect(out).toContain('grpc.RpcError');
		expect(out).toContain('TIMEOUT');
		expect(out).toContain('create_channel');
		expect(out).toContain('build_metadata');
	});
});

// -- Cross-cutting concerns --

describe('auth handling across generators', () => {
	it('none auth adds no extra headers', () => {
		const ctx = makeCtx({ authConfig: { type: 'none' } });
		const grpcurlOut = generateGrpcurl(ctx);
		const tsOut = generateTypescriptSnippet(ctx);

		expect(grpcurlOut).not.toContain('authorization');
		expect(tsOut).not.toContain('authorization');
	});

	it('empty params produce minimal output', () => {
		const ctx = makeCtx({
			params: {},
			requestTypeDefinition: { name: 'Empty', fullName: 'google.protobuf.Empty', fields: [] },
		});

		const grpcurlOut = generateGrpcurl(ctx);
		expect(grpcurlOut).not.toContain('-d');

		const tsOut = generateTypescriptSnippet(ctx);
		expect(tsOut).toContain('{}');
	});
});
