// lib/utils/code-generators.ts
// Client stub code generation for multiple languages

import type { GrpcAuthConfig, MessageTypeDefinition } from "@/lib/types/grpc";
import type { RestPathResult } from "@/lib/utils/rest-path-mapper";

export interface CodeGenContext {
	serviceName: string;
	methodName: string;
	requestType: string;
	responseType: string;
	requestTypeDefinition: MessageTypeDefinition;
	requestStreaming: boolean;
	responseStreaming: boolean;
	endpoint: string;
	tlsEnabled: boolean;
	params: Record<string, any>;
	metadata: Record<string, string>;
	authConfig?: GrpcAuthConfig;
}

/** Format params as a compact JSON string (no trailing newline) */
function formatParams(
	params: Record<string, any>,
	exclude?: Set<string>,
): string {
	const filtered: Record<string, any> = {};
	for (const [k, v] of Object.entries(params)) {
		if (exclude?.has(k)) continue;
		if (v !== undefined && v !== "") filtered[k] = v;
	}
	if (Object.keys(filtered).length === 0) return "{}";
	return JSON.stringify(filtered, null, 2);
}

/** Build metadata entries including auth */
function buildMetadata(ctx: CodeGenContext): Record<string, string> {
	const meta = { ...ctx.metadata };
	if (ctx.authConfig?.type === "bearer" && ctx.authConfig.bearerToken) {
		meta.authorization = `Bearer ${ctx.authConfig.bearerToken}`;
	} else if (
		ctx.authConfig?.type === "api-key" &&
		ctx.authConfig.apiKeyHeader &&
		ctx.authConfig.apiKeyValue
	) {
		meta[ctx.authConfig.apiKeyHeader] = ctx.authConfig.apiKeyValue;
	}
	return meta;
}

// -- grpcurl --

export function generateGrpcurl(ctx: CodeGenContext): string {
	const plaintextFlag = ctx.tlsEnabled ? "" : "  -plaintext \\\n";
	const hasFields =
		ctx.requestTypeDefinition && ctx.requestTypeDefinition.fields.length > 0;
	const data = formatParams(ctx.params);
	const dataFlag = hasFields || data !== "{}" ? `  -d '${data}' \\\n` : "";

	const meta = buildMetadata(ctx);
	const metaFlags = Object.entries(meta)
		.map(([k, v]) => `  -H '${k}: ${v}' \\\n`)
		.join("");

	return `grpcurl \\
${plaintextFlag}${metaFlags}${dataFlag}  ${ctx.endpoint} \\
  ${ctx.serviceName}/${ctx.methodName}`;
}

// -- curl (REST) --

export function generateCurl(
	ctx: CodeGenContext,
	rest: RestPathResult,
): string {
	if (!rest.supported) {
		return `# ${rest.warning || "No known REST mapping for this method"}\n# Use grpcurl tab instead`;
	}

	const meta = buildMetadata(ctx);
	const headerFlags = Object.entries(meta)
		.map(([k, v]) => `  -H '${k}: ${v}'`)
		.join(" \\\n");

	const parts = [`curl -X ${rest.method}`];
	if (headerFlags) parts.push(headerFlags);

	if (["POST", "PUT", "PATCH"].includes(rest.method)) {
		parts.push(`  -H 'Content-Type: application/json'`);
		parts.push(
			`  -d '${formatParams(ctx.params, new Set(rest.usedParams ?? []))}'`,
		);
	}

	parts.push(`  '${rest.url}'`);
	return parts.join(" \\\n");
}

// -- TypeScript --

/** Split "a.b.v1.Service" into { pkg: "a.b.v1", service: "Service" }. */
function splitService(serviceName: string): { pkg: string; service: string } {
	const parts = serviceName.split(".");
	const service = parts.pop() || serviceName;
	return { pkg: parts.join("."), service };
}

function shortTypeName(typeName: string): string {
	return typeName.split(".").pop() || typeName;
}

export function generateTypescriptSnippet(ctx: CodeGenContext): string {
	const { pkg, service } = splitService(ctx.serviceName);
	const meta = buildMetadata(ctx);
	const metaLines = Object.entries(meta)
		.map(([k, v]) => `  metadata.add('${k}', '${v}');`)
		.join("\n");

	return `import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

// Point PROTO_PATH at the service's .proto (from the chain repo or Buf Schema Registry).
const PROTO_PATH = 'path/to/service.proto';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDefinition) as any;

const Client = proto${pkg ? `.${pkg}` : ""}.${service};
const client = new Client(
  '${ctx.endpoint}',
  ${ctx.tlsEnabled ? "grpc.credentials.createSsl()" : "grpc.credentials.createInsecure()"}
);

const metadata = new grpc.Metadata();
${metaLines || "// metadata.add('key', 'value');"}

client.${ctx.methodName}(
  ${formatParams(ctx.params)},
  metadata,
  (err: grpc.ServiceError | null, response: any) => {
    if (err) console.error(err);
    else console.log(response);
    client.close();
  }
);`;
}

export function generateTypescriptFull(ctx: CodeGenContext): string {
	const { pkg, service } = splitService(ctx.serviceName);
	const meta = buildMetadata(ctx);
	const metaLines = Object.entries(meta)
		.map(([k, v]) => `  metadata.add('${k}', '${v}');`)
		.join("\n");

	return `/**
 * ${ctx.serviceName}.${ctx.methodName} - gRPC client (TypeScript)
 *
 * Prerequisites:
 *   yarn add @grpc/grpc-js @grpc/proto-loader
 *   Have the service's .proto available (from the chain repo or Buf Schema Registry).
 */
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const PROTO_PATH = 'path/to/service.proto';
const TARGET = '${ctx.endpoint}';
const METHOD = '${ctx.methodName}';

function createClient(): any {
  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const proto = grpc.loadPackageDefinition(packageDefinition) as any;
  const Client = proto${pkg ? `.${pkg}` : ""}.${service};
  return new Client(
    TARGET,
    ${ctx.tlsEnabled ? "grpc.credentials.createSsl()" : "grpc.credentials.createInsecure()"}
  );
}

function buildMetadata(): grpc.Metadata {
  const metadata = new grpc.Metadata();
${metaLines || "  // No metadata headers"}
  return metadata;
}

async function invoke(): Promise<void> {
  const client = createClient();
  const request = ${formatParams(ctx.params)};

  return new Promise((resolve, reject) => {
    const deadline = new Date(Date.now() + 30000);

    client[METHOD](request, buildMetadata(), { deadline }, (err: grpc.ServiceError | null, response: any) => {
      client.close();
      if (err) {
        console.error(\`gRPC error (\${err.code}): \${err.message}\`);
        reject(err);
      } else {
        console.log('Response:', JSON.stringify(response, null, 2));
        resolve();
      }
    });
  });
}

invoke().catch(console.error);`;
}

// -- Go --

export function generateGoSnippet(ctx: CodeGenContext): string {
	const { pkg, service } = splitService(ctx.serviceName);
	const pkgPath = pkg.replace(/\./g, "/");
	const request = shortTypeName(ctx.requestType);
	const meta = buildMetadata(ctx);
	const hasMeta = Object.keys(meta).length > 0;
	const metaEntries = Object.entries(meta)
		.map(([k, v]) => `\t\t"${k}": "${v}",`)
		.join("\n");
	const stdImports = ctx.tlsEnabled ? '\t"crypto/tls"\n' : "";
	const credImport = ctx.tlsEnabled
		? '\t"google.golang.org/grpc/credentials"\n'
		: '\t"google.golang.org/grpc/credentials/insecure"\n';
	const metaImport = hasMeta ? '\t"google.golang.org/grpc/metadata"\n' : "";
	const credExpr = ctx.tlsEnabled
		? "credentials.NewTLS(&tls.Config{})"
		: "insecure.NewCredentials()";

	return `package main

import (
	"context"
${stdImports}	"log"

	"google.golang.org/grpc"
${credImport}${metaImport}	"google.golang.org/protobuf/encoding/protojson"

	pb "your/module/gen/${pkgPath}" // generated by \`buf generate\` or protoc
)

func main() {
	conn, err := grpc.NewClient("${ctx.endpoint}", grpc.WithTransportCredentials(${credExpr}))
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()

	client := pb.New${service}Client(conn)

	ctx := context.Background()${
		hasMeta
			? `\n\tctx = metadata.NewOutgoingContext(ctx, metadata.New(map[string]string{\n${metaEntries}\n\t}))`
			: ""
	}

	req := &pb.${request}{}
	if err := protojson.Unmarshal([]byte(\`${formatParams(ctx.params)}\`), req); err != nil {
		log.Fatal(err)
	}

	resp, err := client.${ctx.methodName}(ctx, req)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("%+v", resp)
}`;
}

export function generateGoFull(ctx: CodeGenContext): string {
	const { pkg, service } = splitService(ctx.serviceName);
	const pkgPath = pkg.replace(/\./g, "/");
	const request = shortTypeName(ctx.requestType);
	const meta = buildMetadata(ctx);
	const hasMeta = Object.keys(meta).length > 0;
	const metaEntries = Object.entries(meta)
		.map(([k, v]) => `\t\t"${k}": "${v}",`)
		.join("\n");
	const stdImports = ctx.tlsEnabled ? '\t"crypto/tls"\n' : "";
	const credImport = ctx.tlsEnabled
		? '\t"google.golang.org/grpc/credentials"\n'
		: '\t"google.golang.org/grpc/credentials/insecure"\n';
	const metaImport = hasMeta ? '\t"google.golang.org/grpc/metadata"\n' : "";
	const credExpr = ctx.tlsEnabled
		? "credentials.NewTLS(&tls.Config{})"
		: "insecure.NewCredentials()";

	return `// ${ctx.serviceName}.${ctx.methodName} - gRPC client (Go)
//
// Prerequisites:
//   go get google.golang.org/grpc google.golang.org/protobuf
//   Generate stubs from the service's .proto (e.g. \`buf generate\`).
package main

import (
	"context"
${stdImports}	"encoding/json"
	"fmt"
	"log"
	"time"

	"google.golang.org/grpc"
${credImport}${metaImport}	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"

	pb "your/module/gen/${pkgPath}" // adjust to your generated package
)

func main() {
	conn, err := grpc.NewClient("${ctx.endpoint}", grpc.WithTransportCredentials(${credExpr}))
	if err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}
	defer conn.Close()

	client := pb.New${service}Client(conn)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()${
		hasMeta
			? `\n\tctx = metadata.NewOutgoingContext(ctx, metadata.New(map[string]string{\n${metaEntries}\n\t}))`
			: ""
	}

	req := &pb.${request}{}
	if err := protojson.Unmarshal([]byte(\`${formatParams(ctx.params)}\`), req); err != nil {
		log.Fatalf("Invalid request: %v", err)
	}

	resp, err := client.${ctx.methodName}(ctx, req)
	if err != nil {
		if st, ok := status.FromError(err); ok {
			log.Fatalf("gRPC error (code %s): %s", st.Code(), st.Message())
		}
		log.Fatalf("Error: %v", err)
	}

	data, _ := json.MarshalIndent(resp, "", "  ")
	fmt.Println(string(data))
}`;
}

// -- Python --

export function generatePythonSnippet(ctx: CodeGenContext): string {
	const { pkg, service } = splitService(ctx.serviceName);
	const moduleName = pkg || "your_package";
	const request = shortTypeName(ctx.requestType);
	const meta = buildMetadata(ctx);
	const metaTuples = Object.entries(meta)
		.map(([k, v]) => `("${k}", "${v}")`)
		.join(", ");
	const metaArg = metaTuples ? `, metadata=[${metaTuples}]` : "";
	const channel = ctx.tlsEnabled
		? "grpc.secure_channel(TARGET, grpc.ssl_channel_credentials())"
		: "grpc.insecure_channel(TARGET)";

	return `import json

import grpc
from google.protobuf import json_format

# Generate stubs first, then adjust this import to your output:
#   python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. path/to/service.proto
from ${moduleName} import service_pb2, service_pb2_grpc

TARGET = "${ctx.endpoint}"
channel = ${channel}
stub = service_pb2_grpc.${service}Stub(channel)

request = service_pb2.${request}()
json_format.Parse(json.dumps(${formatParams(ctx.params)}), request)

response = stub.${ctx.methodName}(request${metaArg})
print(response)
channel.close()`;
}

export function generatePythonFull(ctx: CodeGenContext): string {
	const { pkg, service } = splitService(ctx.serviceName);
	const moduleName = pkg || "your_package";
	const request = shortTypeName(ctx.requestType);
	const meta = buildMetadata(ctx);
	const metaTuples = Object.entries(meta)
		.map(([k, v]) => `        ("${k}", "${v}"),`)
		.join("\n");

	return `"""
${ctx.serviceName}.${ctx.methodName} - gRPC client (Python)

Prerequisites:
    pip install grpcio grpcio-tools
    Generate stubs:
      python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. path/to/service.proto
"""
import json
import sys

import grpc
from google.protobuf import json_format

from ${moduleName} import service_pb2, service_pb2_grpc

TARGET = "${ctx.endpoint}"
TIMEOUT = 30  # seconds


def create_channel() -> grpc.Channel:
${
	ctx.tlsEnabled
		? "    return grpc.secure_channel(TARGET, grpc.ssl_channel_credentials())"
		: "    return grpc.insecure_channel(TARGET)"
}


def build_metadata():
    return [
${metaTuples || "        # No metadata headers"}
    ]


def invoke():
    channel = create_channel()

    try:
        stub = service_pb2_grpc.${service}Stub(channel)

        request = service_pb2.${request}()
        json_format.Parse(json.dumps(${formatParams(ctx.params)}), request)

        response = stub.${ctx.methodName}(request, metadata=build_metadata(), timeout=TIMEOUT)
        print(json.dumps(json_format.MessageToDict(response), indent=2))

    except grpc.RpcError as e:
        print(f"gRPC error ({e.code()}): {e.details()}", file=sys.stderr)
        sys.exit(1)
    finally:
        channel.close()


if __name__ == "__main__":
    invoke()`;
}
