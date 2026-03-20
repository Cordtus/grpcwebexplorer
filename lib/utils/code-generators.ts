// lib/utils/code-generators.ts
// Client stub code generation for multiple languages

import { MessageTypeDefinition } from '@/components/ProtobufFormGenerator';
import { GrpcAuthConfig, HttpRule } from '@/lib/types/grpc';

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
function formatParams(params: Record<string, any>): string {
	const filtered: Record<string, any> = {};
	for (const [k, v] of Object.entries(params)) {
		if (v !== undefined && v !== '') filtered[k] = v;
	}
	if (Object.keys(filtered).length === 0) return '{}';
	return JSON.stringify(filtered, null, 2);
}

/** Build metadata entries including auth */
function buildMetadata(ctx: CodeGenContext): Record<string, string> {
	const meta = { ...ctx.metadata };
	if (ctx.authConfig?.type === 'bearer' && ctx.authConfig.bearerToken) {
		meta['authorization'] = `Bearer ${ctx.authConfig.bearerToken}`;
	} else if (ctx.authConfig?.type === 'api-key' && ctx.authConfig.apiKeyHeader && ctx.authConfig.apiKeyValue) {
		meta[ctx.authConfig.apiKeyHeader] = ctx.authConfig.apiKeyValue;
	}
	return meta;
}

// -- grpcurl --

export function generateGrpcurl(ctx: CodeGenContext): string {
	const plaintextFlag = ctx.tlsEnabled ? '' : '  -plaintext \\\n';
	const hasFields = ctx.requestTypeDefinition && ctx.requestTypeDefinition.fields.length > 0;
	const data = formatParams(ctx.params);
	const dataFlag = (hasFields || data !== '{}') ? `  -d '${data}' \\\n` : '';

	const meta = buildMetadata(ctx);
	const metaFlags = Object.entries(meta)
		.map(([k, v]) => `  -H '${k}: ${v}' \\\n`)
		.join('');

	return `grpcurl \\
${plaintextFlag}${metaFlags}${dataFlag}  ${ctx.endpoint} \\
  ${ctx.serviceName}/${ctx.methodName}`;
}

// -- curl (REST) --

export function generateCurl(
	ctx: CodeGenContext,
	restBaseUrl: string,
	httpRule?: HttpRule
): string {
	if (!httpRule) {
		return `# No known REST mapping for this method\n# Use grpcurl tab instead`;
	}

	const httpMethod = httpRule.get ? 'GET' : httpRule.post ? 'POST' : httpRule.put ? 'PUT' : httpRule.delete ? 'DELETE' : httpRule.patch ? 'PATCH' : 'GET';
	const path = httpRule.get || httpRule.post || httpRule.put || httpRule.delete || httpRule.patch || '/';

	// Substitute path params
	let url = `${restBaseUrl}${path}`;
	for (const [k, v] of Object.entries(ctx.params)) {
		url = url.replace(`{${k}}`, String(v || ''));
	}

	const meta = buildMetadata(ctx);
	const headerFlags = Object.entries(meta)
		.map(([k, v]) => `  -H '${k}: ${v}'`)
		.join(' \\\n');

	const parts = [`curl -X ${httpMethod}`];
	if (headerFlags) parts.push(headerFlags);

	if (['POST', 'PUT', 'PATCH'].includes(httpMethod)) {
		parts.push(`  -H 'Content-Type: application/json'`);
		parts.push(`  -d '${formatParams(ctx.params)}'`);
	}

	parts.push(`  '${url}'`);
	return parts.join(' \\\n');
}

// -- TypeScript --

export function generateTypescriptSnippet(ctx: CodeGenContext): string {
	const meta = buildMetadata(ctx);
	const metaLines = Object.entries(meta).map(([k, v]) => `  metadata.add('${k}', '${v}');`).join('\n');
	const metaBlock = metaLines ? `\nconst metadata = new grpc.Metadata();\n${metaLines}\n` : '';

	return `import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const target = '${ctx.endpoint}';
const credentials = ${ctx.tlsEnabled ? 'grpc.credentials.createSsl()' : 'grpc.credentials.createInsecure()'};
const client = new grpc.Client(target, credentials);
${metaBlock}
const request = ${formatParams(ctx.params)};

client.makeUnaryRequest(
  '/${ctx.serviceName}/${ctx.methodName}',
  (arg) => arg,
  (arg) => arg,
  Buffer.from(JSON.stringify(request)),${metaBlock ? '\n  metadata,' : ''}
  (err, response) => {
    if (err) console.error(err);
    else console.log(response);
    client.close();
  }
);`;
}

export function generateTypescriptFull(ctx: CodeGenContext): string {
	const meta = buildMetadata(ctx);
	const metaLines = Object.entries(meta).map(([k, v]) => `  metadata.add('${k}', '${v}');`).join('\n');

	return `/**
 * ${ctx.serviceName}.${ctx.methodName} - gRPC client
 *
 * Prerequisites:
 *   yarn add @grpc/grpc-js @grpc/proto-loader
 */
import * as grpc from '@grpc/grpc-js';

const TARGET = '${ctx.endpoint}';
const SERVICE = '${ctx.serviceName}';
const METHOD = '${ctx.methodName}';

function createCredentials(): grpc.ChannelCredentials {
  ${ctx.tlsEnabled ? 'return grpc.credentials.createSsl();' : 'return grpc.credentials.createInsecure();'}
}

function buildMetadata(): grpc.Metadata {
  const metadata = new grpc.Metadata();
${metaLines ? metaLines : '  // No metadata headers'}
  return metadata;
}

interface ${ctx.requestType.split('.').pop() || 'Request'} ${formatParams(ctx.params).replace(/"/g, '')}

async function invoke(): Promise<void> {
  const client = new grpc.Client(TARGET, createCredentials(), {
    'grpc.max_receive_message_length': -1,
  });

  const request = ${formatParams(ctx.params)};

  return new Promise((resolve, reject) => {
    const deadline = new Date(Date.now() + 30000);

    client.makeUnaryRequest(
      \`/\${SERVICE}/\${METHOD}\`,
      (arg: Buffer) => arg,
      (arg: Buffer) => arg,
      Buffer.from(JSON.stringify(request)),
      buildMetadata(),
      { deadline },
      (err, response) => {
        client.close();
        if (err) {
          console.error(\`gRPC error (\${err.code}): \${err.message}\`);
          reject(err);
        } else {
          console.log('Response:', JSON.stringify(response, null, 2));
          resolve();
        }
      }
    );
  });
}

invoke().catch(console.error);`;
}

// -- Go --

export function generateGoSnippet(ctx: CodeGenContext): string {
	const meta = buildMetadata(ctx);
	const metaLines = Object.entries(meta)
		.map(([k, v]) => `\tmd.Append("${k}", "${v}")`)
		.join('\n');
	const metaBlock = metaLines
		? `\n\tmd := metadata.New(nil)\n${metaLines}\n\tctx = metadata.NewOutgoingContext(ctx, md)\n`
		: '';
	const metaImport = metaLines ? '\n\t"google.golang.org/grpc/metadata"' : '';

	return `package main

import (
\t"context"
\t"fmt"
\t"log"

\t"google.golang.org/grpc"${metaImport}
\t${ctx.tlsEnabled ? '"google.golang.org/grpc/credentials"' : '"google.golang.org/grpc/credentials/insecure"'}
)

func main() {
\t${ctx.tlsEnabled
		? 'creds := credentials.NewTLS(nil)\n\tconn, err := grpc.NewClient("' + ctx.endpoint + '", grpc.WithTransportCredentials(creds))'
		: 'conn, err := grpc.NewClient("' + ctx.endpoint + '", grpc.WithTransportCredentials(insecure.NewCredentials()))'}
\tif err != nil {
\t\tlog.Fatal(err)
\t}
\tdefer conn.Close()

\tctx := context.Background()${metaBlock}
\treq := /* ${ctx.requestType} */ nil
\tvar resp interface{}

\terr = conn.Invoke(ctx, "/${ctx.serviceName}/${ctx.methodName}", req, &resp)
\tif err != nil {
\t\tlog.Fatal(err)
\t}
\tfmt.Printf("%+v\\n", resp)
}`;
}

export function generateGoFull(ctx: CodeGenContext): string {
	const meta = buildMetadata(ctx);
	const metaLines = Object.entries(meta)
		.map(([k, v]) => `\tmd.Append("${k}", "${v}")`)
		.join('\n');
	const metaImport = Object.keys(meta).length > 0 ? '\n\t"google.golang.org/grpc/metadata"' : '';

	return `/**
 * ${ctx.serviceName}.${ctx.methodName} - gRPC client (Go)
 *
 * Prerequisites:
 *   go get google.golang.org/grpc
 *   go get google.golang.org/protobuf
 */
package main

import (
\t"context"
\t"encoding/json"
\t"fmt"
\t"log"
\t"time"

\t"google.golang.org/grpc"${metaImport}
\t${ctx.tlsEnabled
		? '"google.golang.org/grpc/credentials"'
		: '"google.golang.org/grpc/credentials/insecure"'}
\t"google.golang.org/grpc/status"
)

const (
\ttarget  = "${ctx.endpoint}"
\tservice = "${ctx.serviceName}"
\tmethod  = "${ctx.methodName}"
)

func main() {
\t${ctx.tlsEnabled
		? 'creds := credentials.NewTLS(nil)\n\tconn, err := grpc.NewClient(target, grpc.WithTransportCredentials(creds))'
		: 'conn, err := grpc.NewClient(target, grpc.WithTransportCredentials(insecure.NewCredentials()))'}
\tif err != nil {
\t\tlog.Fatalf("Failed to connect: %v", err)
\t}
\tdefer conn.Close()

\tctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
\tdefer cancel()
${Object.keys(meta).length > 0 ? `
\tmd := metadata.New(nil)
${metaLines}
\tctx = metadata.NewOutgoingContext(ctx, md)
` : ''}
\t// Build request (replace with generated types for type safety)
\treq := /* ${ctx.requestType} */ nil
\tvar resp interface{}

\terr = conn.Invoke(ctx, fmt.Sprintf("/%s/%s", service, method), req, &resp)
\tif err != nil {
\t\tst, ok := status.FromError(err)
\t\tif ok {
\t\t\tlog.Fatalf("gRPC error (code %s): %s", st.Code(), st.Message())
\t\t}
\t\tlog.Fatalf("Error: %v", err)
\t}

\tdata, _ := json.MarshalIndent(resp, "", "  ")
\tfmt.Println(string(data))
}`;
}

// -- Python --

export function generatePythonSnippet(ctx: CodeGenContext): string {
	const meta = buildMetadata(ctx);
	const metaTuples = Object.entries(meta)
		.map(([k, v]) => `("${k}", "${v}")`)
		.join(', ');
	const metaArg = metaTuples ? `, metadata=[${metaTuples}]` : '';

	return `import grpc
import json

target = "${ctx.endpoint}"
${ctx.tlsEnabled
		? 'credentials = grpc.ssl_channel_credentials()\nchannel = grpc.secure_channel(target, credentials)'
		: 'channel = grpc.insecure_channel(target)'}

request = json.dumps(${formatParams(ctx.params)}).encode()

response = channel.unary_unary(
    "/${ctx.serviceName}/${ctx.methodName}"
)(request${metaArg})

print(response)
channel.close()`;
}

export function generatePythonFull(ctx: CodeGenContext): string {
	const meta = buildMetadata(ctx);
	const metaTuples = Object.entries(meta)
		.map(([k, v]) => `        ("${k}", "${v}"),`)
		.join('\n');

	return `"""
${ctx.serviceName}.${ctx.methodName} - gRPC client (Python)

Prerequisites:
    pip install grpcio grpcio-tools
"""
import grpc
import json
import sys

TARGET = "${ctx.endpoint}"
SERVICE = "${ctx.serviceName}"
METHOD = "${ctx.methodName}"
TIMEOUT = 30  # seconds


def create_channel() -> grpc.Channel:
${ctx.tlsEnabled
		? '    credentials = grpc.ssl_channel_credentials()\n    return grpc.secure_channel(TARGET, credentials)'
		: '    return grpc.insecure_channel(TARGET)'}


def build_metadata():
    return [
${metaTuples || '        # No metadata headers'}
    ]


def invoke():
    channel = create_channel()

    try:
        request = json.dumps(${formatParams(ctx.params)}).encode("utf-8")

        # Generic unary call (replace with generated stubs for type safety)
        method = channel.unary_unary(
            f"/{SERVICE}/{METHOD}",
        )

        response = method(request, metadata=build_metadata(), timeout=TIMEOUT)
        print(json.dumps(json.loads(response), indent=2))

    except grpc.RpcError as e:
        print(f"gRPC error ({e.code()}): {e.details()}", file=sys.stderr)
        sys.exit(1)
    finally:
        channel.close()


if __name__ == "__main__":
    invoke()`;
}
