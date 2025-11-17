'use client';

import React, { useState } from 'react';
import { Copy, Check, FileCode, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GrpcMethod, GrpcService } from '@/lib/types/grpc';

interface MethodDescriptorProps {
  method: GrpcMethod;
  service: GrpcService;
  color: string;
  endpoint?: string;
  tlsEnabled?: boolean;
}

export default function MethodDescriptor({ method, service, color, endpoint, tlsEnabled }: MethodDescriptorProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'curl' | 'javascript'>('curl');

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  // Generate proto definition
  const protoDefinition = `rpc ${method.name}(${method.requestStreaming ? 'stream ' : ''}${method.requestType}) returns (${method.responseStreaming ? 'stream ' : ''}${method.responseType});`;

  // Generate realistic request data for grpcurl based on actual fields
  const generateRequestData = () => {
    const requestTypeName = method.requestType.split('.').pop() || method.requestType;

    // Check if request type is Empty
    if (requestTypeName.includes('Empty') || method.requestType === 'google.protobuf.Empty') {
      return '{}';
    }

    // If we have field definitions, use them
    if (method.requestTypeDefinition && method.requestTypeDefinition.fields.length > 0) {
      const fields = method.requestTypeDefinition.fields;
      const exampleFields: Record<string, any> = {};

      // Generate example values for each field
      for (const field of fields) {
        // Skip optional fields in the example to keep it minimal
        if (field.rule === 'optional') continue;

        // Generate example value based on type
        if (field.enumValues && field.enumValues.length > 0) {
          exampleFields[field.name] = field.enumValues[0];
        } else if (field.type === 'string') {
          exampleFields[field.name] = '';
        } else if (['int32', 'int64', 'uint32', 'uint64', 'sint32', 'sint64', 'fixed32', 'fixed64', 'sfixed32', 'sfixed64'].includes(field.type)) {
          exampleFields[field.name] = 0;
        } else if (field.type === 'bool') {
          exampleFields[field.name] = false;
        } else if (field.type === 'bytes') {
          exampleFields[field.name] = '';
        } else if (['double', 'float'].includes(field.type)) {
          exampleFields[field.name] = 0.0;
        } else if (field.rule === 'repeated') {
          exampleFields[field.name] = [];
        } else if (field.nested) {
          exampleFields[field.name] = {};
        }
      }

      // If no required fields, return empty object
      if (Object.keys(exampleFields).length === 0) {
        return '{}';
      }

      return JSON.stringify(exampleFields, null, 2);
    }

    // Fallback: empty object for unknown types
    return '{}';
  };

  const requestData = generateRequestData();

  // Generate curl example
  const plaintextFlag = tlsEnabled ? '' : '  -plaintext \\\n';
  const exampleEndpoint = endpoint || 'localhost:9090';

  // Only include -d flag if request data is not empty
  const dataFlag = requestData === '{}' ? '' : `  -d '${requestData}' \\\n`;
  const curlExample = `grpcurl \\
${plaintextFlag}${dataFlag}  ${exampleEndpoint} \\
  ${service.fullName}/${method.name}`;

  // Generate code example with realistic inputs
  const generateCodeExample = () => {
    const requestTypeName = method.requestType.split('.').pop() || method.requestType;
    const responseTypeName = method.responseType.split('.').pop() || method.responseType;

    // Extract package name from service
    const packageName = service.fullName.split('.').slice(0, -1).join('.');

    // Example inputs based on common patterns
    const exampleInput = requestTypeName.includes('Empty') || requestTypeName === 'google.protobuf.Empty'
      ? '{}'
      : `{
  // ${requestTypeName} fields
}`;

    if (method.responseStreaming) {
      return `import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const packageDefinition = protoLoader.loadSync('path/to/proto.proto', {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const proto = grpc.loadPackageDefinition(packageDefinition);

const client = new proto.${packageName}.${service.name}(
  'localhost:9090',
  grpc.credentials.createInsecure()
);

const request = ${exampleInput};

const stream = client.${method.name}(request);

stream.on('data', (response) => {
  console.log(response);
});

stream.on('end', () => {
  console.log('Stream ended');
});

stream.on('error', (err) => {
  console.error('Error:', err);
});`;
    } else {
      return `import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { promisify } from 'util';

const packageDefinition = protoLoader.loadSync('path/to/proto.proto', {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const proto = grpc.loadPackageDefinition(packageDefinition);

const client = new proto.${packageName}.${service.name}(
  'localhost:9090',
  grpc.credentials.createInsecure()
);

const ${method.name.toLowerCase()} = promisify(
  client.${method.name}.bind(client)
);

const request = ${exampleInput};

const response = await ${method.name.toLowerCase()}(request);
console.log(response);`;
    }
  };

  const codeExample = generateCodeExample();

  return (
    <div className="h-full flex flex-col p-4 bg-background">
      {/* Header with Full Path */}
      <div className="mb-4 space-y-3">
        {/* Full Path - Copyable */}
        <div className="flex items-center gap-3">
          <div
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <button
            onClick={() => handleCopy(`${service.fullName}.${method.name}`, 'fullpath')}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted rounded transition-colors group flex-1 min-w-0"
            title="Click to copy full path"
          >
            <code className="font-mono truncate">{service.fullName}.{method.name}</code>
            {copied === 'fullpath' ? (
              <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
            ) : (
              <Copy className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            )}
          </button>

          {/* Streaming badges */}
          <div className="flex items-center gap-2 shrink-0">
            {method.requestStreaming && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                Client Stream
              </span>
            )}
            {method.responseStreaming && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                Server Stream
              </span>
            )}
            {!method.requestStreaming && !method.responseStreaming && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/20 text-primary border border-primary/30">
                Unary
              </span>
            )}
          </div>
        </div>

        {/* Request/Response Types */}
        <div className="flex items-center gap-4 text-xs pl-5">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Request:</span>
            <code className="font-mono font-medium text-blue-400 break-all">
              {method.requestType}
            </code>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Response:</span>
            <code className="font-mono font-medium text-green-400 break-all">
              {method.responseType}
            </code>
          </div>
        </div>
      </div>

      {/* Content Grid - 2 columns */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {/* Proto Definition */}
        <div className="flex flex-col min-h-0">
          <div className="shrink-0 flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileCode className="h-3.5 w-3.5 text-primary" />
              Proto Definition
            </h3>
            <button
              onClick={() => handleCopy(protoDefinition, 'proto')}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              {copied === 'proto' ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
              )}
            </button>
          </div>
          <div className="flex-1 overflow-auto min-h-0">
            <div className="p-4 bg-muted/50 rounded-lg border border-primary/20 shadow-lg">
              <pre className="text-sm text-blue-100 dark:text-blue-50 font-mono whitespace-pre-wrap leading-relaxed">
                {protoDefinition}
              </pre>
            </div>
          </div>
        </div>

        {/* Examples */}
        <div className="flex flex-col min-h-0">
          <div className="shrink-0 flex items-center justify-between mb-2">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('curl')}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded transition-colors",
                  activeTab === 'curl'
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                )}
              >
                cURL
              </button>
              <button
                onClick={() => setActiveTab('javascript')}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded transition-colors",
                  activeTab === 'javascript'
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                )}
              >
                JavaScript
              </button>
            </div>
            <button
              onClick={() => handleCopy(activeTab === 'curl' ? curlExample : codeExample, activeTab)}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              {copied === activeTab ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
              )}
            </button>
          </div>
          <div className="flex-1 overflow-auto min-h-0 code-snippet-scroll">
            <div className="p-4 bg-muted/50 rounded-lg border border-primary/20 shadow-lg">
              <pre className="text-xs text-blue-100 dark:text-blue-50 font-mono whitespace-pre leading-relaxed">
                {activeTab === 'curl' ? curlExample : codeExample}
              </pre>
            </div>
          </div>
          {activeTab === 'javascript' && (
            <div className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
              Proto files: <a href="https://buf.build" target="_blank" rel="noopener" className="underline hover:text-primary transition-colors">buf.build</a> or project repository (usually under <code className="text-[10px] px-1 py-0.5 rounded bg-muted font-medium">/proto</code>)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}