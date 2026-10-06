// tests/code-generators.test.ts
// Unit tests for multi-language code generation

import { describe, expect, it } from "vitest";
import {
	type CodeGenContext,
	generateCurl,
	generateGoFull,
	generateGoSnippet,
	generateGrpcurl,
	generatePythonFull,
	generatePythonSnippet,
	generateTypescriptFull,
	generateTypescriptSnippet,
} from "@/lib/utils/code-generators";

/** Minimal context for tests */
function makeCtx(overrides: Partial<CodeGenContext> = {}): CodeGenContext {
	return {
		serviceName: "example.greeter.GreeterService",
		methodName: "SayHello",
		requestType: "example.greeter.HelloRequest",
		responseType: "example.greeter.HelloReply",
		requestTypeDefinition: {
			name: "HelloRequest",
			fullName: "example.greeter.HelloRequest",
			fields: [{ name: "name", type: "string", rule: "optional" }],
		},
		requestStreaming: false,
		responseStreaming: false,
		endpoint: "grpc.example.com:443",
		tlsEnabled: true,
		params: { name: "world" },
		metadata: {},
		...overrides,
	};
}

// -- grpcurl --

describe("generateGrpcurl", () => {
	it("generates valid grpcurl command with TLS", () => {
		const out = generateGrpcurl(makeCtx());
		expect(out).toContain("grpcurl");
		expect(out).toContain("grpc.example.com:443");
		expect(out).toContain("example.greeter.GreeterService/SayHello");
		expect(out).not.toContain("-plaintext"); // TLS enabled
		expect(out).toContain('"name"');
	});

	it("includes -plaintext flag when TLS disabled", () => {
		const out = generateGrpcurl(makeCtx({ tlsEnabled: false }));
		expect(out).toContain("-plaintext");
	});

	it("includes metadata as -H flags", () => {
		const out = generateGrpcurl(
			makeCtx({
				metadata: { "x-custom": "value123" },
			}),
		);
		expect(out).toContain("-H 'x-custom: value123'");
	});

	it("includes bearer auth in metadata", () => {
		const out = generateGrpcurl(
			makeCtx({
				authConfig: { type: "bearer", bearerToken: "tok123" },
			}),
		);
		expect(out).toContain("-H 'authorization: Bearer tok123'");
	});

	it("includes API key in metadata", () => {
		const out = generateGrpcurl(
			makeCtx({
				authConfig: {
					type: "api-key",
					apiKeyHeader: "x-api-key",
					apiKeyValue: "secret",
				},
			}),
		);
		expect(out).toContain("-H 'x-api-key: secret'");
	});

	it("skips data flag when no fields and empty params", () => {
		const out = generateGrpcurl(
			makeCtx({
				params: {},
				requestTypeDefinition: {
					name: "Empty",
					fullName: "google.protobuf.Empty",
					fields: [],
				},
			}),
		);
		expect(out).not.toContain("-d");
	});
});

// -- curl (REST) --

describe("generateCurl", () => {
	it("returns fallback message when unsupported", () => {
		const out = generateCurl(makeCtx(), {
			url: "",
			supported: false,
			method: "GET",
			warning: "No REST annotation for this method",
		});
		expect(out).toContain("No REST annotation");
	});

	it("generates GET curl", () => {
		const out = generateCurl(makeCtx({ params: { name: "cosmos" } }), {
			url: "https://api.example.com/v1/greet/cosmos",
			supported: true,
			method: "GET",
		});
		expect(out).toContain("curl -X GET");
		expect(out).toContain("https://api.example.com/v1/greet/cosmos");
	});

	it("generates POST curl with body", () => {
		const out = generateCurl(makeCtx(), {
			url: "https://api.example.com/v1/greet",
			supported: true,
			method: "POST",
		});
		expect(out).toContain("curl -X POST");
		expect(out).toContain("Content-Type: application/json");
		expect(out).toContain('"name"');
	});

	it("excludes path params from the POST body", () => {
		const out = generateCurl(makeCtx({ params: { id: "42", name: "world" } }), {
			url: "https://api.example.com/v1/greet/42",
			supported: true,
			method: "POST",
			usedParams: ["id"],
		});
		expect(out).toContain('"name"');
		expect(out).not.toContain('"id"');
	});

	it("includes auth headers in curl", () => {
		const out = generateCurl(
			makeCtx({ authConfig: { type: "bearer", bearerToken: "abc" } }),
			{
				url: "https://api.example.com/v1/test",
				supported: true,
				method: "GET",
			},
		);
		expect(out).toContain("authorization: Bearer abc");
	});
});

// -- TypeScript --

describe("generateTypescriptSnippet", () => {
	it("generates valid TypeScript using proto-loader", () => {
		const out = generateTypescriptSnippet(makeCtx());
		expect(out).toContain("import * as grpc from '@grpc/grpc-js'");
		expect(out).toContain("protoLoader.loadSync");
		expect(out).toContain("grpc.example.com:443");
		expect(out).toContain("createSsl()");
		expect(out).toContain("client.SayHello(");
	});

	it("uses insecure credentials when TLS off", () => {
		const out = generateTypescriptSnippet(makeCtx({ tlsEnabled: false }));
		expect(out).toContain("createInsecure()");
	});
});

describe("generateTypescriptFull", () => {
	it("generates full scaffold with error handling", () => {
		const out = generateTypescriptFull(makeCtx());
		expect(out).toContain("async function invoke");
		expect(out).toContain("deadline");
		expect(out).toContain("reject");
		expect(out).toContain("client.close()");
	});

	it("includes metadata from auth config", () => {
		const out = generateTypescriptFull(
			makeCtx({
				authConfig: { type: "bearer", bearerToken: "mytoken" },
			}),
		);
		expect(out).toContain("authorization");
		expect(out).toContain("Bearer mytoken");
	});
});

// -- Go --

describe("generateGoSnippet", () => {
	it("generates valid Go code with TLS", () => {
		const out = generateGoSnippet(makeCtx());
		expect(out).toContain("package main");
		expect(out).toContain('"google.golang.org/grpc"');
		expect(out).toContain("credentials.NewTLS(&tls.Config{})");
		expect(out).toContain("client.SayHello(ctx, req)");
		expect(out).toContain("protojson.Unmarshal");
	});

	it("uses insecure when TLS off", () => {
		const out = generateGoSnippet(makeCtx({ tlsEnabled: false }));
		expect(out).toContain("insecure.NewCredentials()");
	});

	it("includes metadata for auth", () => {
		const out = generateGoSnippet(
			makeCtx({
				authConfig: {
					type: "api-key",
					apiKeyHeader: "x-key",
					apiKeyValue: "val",
				},
			}),
		);
		expect(out).toContain("metadata");
		expect(out).toContain("x-key");
		expect(out).toContain("val");
	});
});

describe("generateGoFull", () => {
	it("generates full scaffold with status error handling", () => {
		const out = generateGoFull(makeCtx());
		expect(out).toContain("status.FromError");
		expect(out).toContain("context.WithTimeout");
		expect(out).toContain("json.MarshalIndent");
	});
});

// -- Python --

describe("generatePythonSnippet", () => {
	it("generates valid Python code", () => {
		const out = generatePythonSnippet(makeCtx());
		expect(out).toContain("import grpc");
		expect(out).toContain("ssl_channel_credentials()");
		expect(out).toContain("service_pb2_grpc.GreeterServiceStub(channel)");
		expect(out).toContain("json_format.Parse");
		expect(out).toContain("stub.SayHello(request");
	});

	it("uses insecure channel when TLS off", () => {
		const out = generatePythonSnippet(makeCtx({ tlsEnabled: false }));
		expect(out).toContain("insecure_channel");
	});

	it("includes metadata tuples for auth", () => {
		const out = generatePythonSnippet(
			makeCtx({
				authConfig: { type: "bearer", bearerToken: "pytoken" },
			}),
		);
		expect(out).toContain("metadata=");
		expect(out).toContain("authorization");
		expect(out).toContain("Bearer pytoken");
	});
});

describe("generatePythonFull", () => {
	it("generates full scaffold with error handling", () => {
		const out = generatePythonFull(makeCtx());
		expect(out).toContain("grpc.RpcError");
		expect(out).toContain("TIMEOUT");
		expect(out).toContain("create_channel");
		expect(out).toContain("build_metadata");
	});
});

// -- Streaming --

describe("streaming methods", () => {
	it("server streaming iterates responses", () => {
		const ctx = makeCtx({ responseStreaming: true });
		expect(generateTypescriptSnippet(ctx)).toContain("call.on('data'");
		expect(generateGoSnippet(ctx)).toContain("stream.Recv()");
		expect(generateGoSnippet(ctx)).toContain('"io"');
		expect(generatePythonSnippet(ctx)).toContain(
			"for response in stub.SayHello(",
		);
	});

	it("client streaming sends then closes", () => {
		const ctx = makeCtx({ requestStreaming: true });
		expect(generateTypescriptSnippet(ctx)).toContain("call.write(");
		expect(generateTypescriptSnippet(ctx)).toContain("call.end()");
		expect(generateGoSnippet(ctx)).toContain("stream.CloseAndRecv()");
		expect(generatePythonSnippet(ctx)).toContain("iter([request])");
	});

	it("bidi streaming sends and receives", () => {
		const ctx = makeCtx({ requestStreaming: true, responseStreaming: true });
		expect(generateGoSnippet(ctx)).toContain("stream.CloseSend()");
		expect(generateGoSnippet(ctx)).toContain("stream.Recv()");
		expect(generateTypescriptFull(ctx)).toContain("call.write(request)");
		expect(generatePythonFull(ctx)).toContain("for response in stub.SayHello(");
	});

	it("unary methods do not emit streaming constructs", () => {
		const ctx = makeCtx();
		expect(generateGoSnippet(ctx)).not.toContain('"io"');
		expect(generateTypescriptSnippet(ctx)).not.toContain("call.on(");
	});

	it("go full streaming omits the unused status import", () => {
		const out = generateGoFull(makeCtx({ responseStreaming: true }));
		expect(out).toContain("stream.Recv()");
		expect(out).not.toContain("google.golang.org/grpc/status");
		expect(out).not.toContain("status.FromError");
	});

	it("client streaming does not import io", () => {
		const out = generateGoSnippet(makeCtx({ requestStreaming: true }));
		expect(out).toContain("stream.CloseAndRecv()");
		expect(out).not.toContain('"io"');
	});
});

// -- Cross-cutting concerns --

describe("auth handling across generators", () => {
	it("none auth adds no extra headers", () => {
		const ctx = makeCtx({ authConfig: { type: "none" } });
		const grpcurlOut = generateGrpcurl(ctx);
		const tsOut = generateTypescriptSnippet(ctx);

		expect(grpcurlOut).not.toContain("authorization");
		expect(tsOut).not.toContain("authorization");
	});

	it("empty params produce minimal output", () => {
		const ctx = makeCtx({
			params: {},
			requestTypeDefinition: {
				name: "Empty",
				fullName: "google.protobuf.Empty",
				fields: [],
			},
		});

		const grpcurlOut = generateGrpcurl(ctx);
		expect(grpcurlOut).not.toContain("-d");

		const tsOut = generateTypescriptSnippet(ctx);
		expect(tsOut).toContain("{}");
	});
});
