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

  // Generate curl example
  const plaintextFlag = tlsEnabled ? '' : '  -plaintext \\\n';
  const exampleEndpoint = endpoint || 'localhost:9090';
  const curlExample = `grpcurl \\
${plaintextFlag}  -d '{"example": "data"}' \\
  ${exampleEndpoint} \\
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
    <div className="h-full flex flex-col p-4">
      {/* Header with Type Flow */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {method.name}
          </h2>
          <button
            onClick={() => handleCopy(service.fullName, 'service')}
            className="flex items-center gap-1.5 px-2 py-1 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors group"
            title="Click to copy service name"
          >
            <span className="truncate max-w-[300px]">{service.fullName}</span>
            {copied === 'service' ? (
              <Check className="h-3 w-3 text-green-500 shrink-0" />
            ) : (
              <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Type Flow - inline with header */}
          <div className="flex items-center gap-2">
            <div className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded" title={method.requestType}>
              <code className="text-[10px] font-mono text-blue-700 dark:text-blue-400 truncate max-w-[120px] inline-block">
                {method.requestType.split('.').pop()}
              </code>
            </div>
            <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
            <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded" title={method.responseType}>
              <code className="text-[10px] font-mono text-green-700 dark:text-green-400 truncate max-w-[120px] inline-block">
                {method.responseType.split('.').pop()}
              </code>
            </div>
          </div>

          {/* Streaming badges */}
          <div className="flex items-center gap-2">
            {method.requestStreaming && (
              <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                Client Stream
              </span>
            )}
            {method.responseStreaming && (
              <span className="text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                Server Stream
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content Grid - 2 columns */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {/* Proto Definition */}
        <div className="flex flex-col min-h-0">
          <div className="shrink-0 flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <FileCode className="h-3 w-3" />
              Proto Definition
            </h3>
            <button
              onClick={() => handleCopy(protoDefinition, 'proto')}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            >
              {copied === 'proto' ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3 text-gray-400" />
              )}
            </button>
          </div>
          <div className="flex-1 overflow-auto min-h-0">
            <div className="p-3 bg-gray-900 dark:bg-black rounded-lg">
              <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
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
                  "px-2 py-1 text-[10px] font-semibold rounded transition-colors",
                  activeTab === 'curl'
                    ? "bg-gray-700 dark:bg-gray-600 text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                cURL
              </button>
              <button
                onClick={() => setActiveTab('javascript')}
                className={cn(
                  "px-2 py-1 text-[10px] font-semibold rounded transition-colors",
                  activeTab === 'javascript'
                    ? "bg-gray-700 dark:bg-gray-600 text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                JavaScript
              </button>
            </div>
            <button
              onClick={() => handleCopy(activeTab === 'curl' ? curlExample : codeExample, activeTab)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            >
              {copied === activeTab ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3 text-gray-400" />
              )}
            </button>
          </div>
          <div className="flex-1 overflow-auto min-h-0 code-snippet-scroll">
            <div className="p-3 bg-gray-900 dark:bg-black rounded-lg">
              <pre className="text-[10px] text-gray-300 font-mono whitespace-pre">
                {activeTab === 'curl' ? curlExample : codeExample}
              </pre>
            </div>
          </div>
          {activeTab === 'javascript' && (
            <div className="mt-1.5 text-[9px] text-gray-400 dark:text-gray-500 leading-tight">
              Proto files: <a href="https://buf.build" target="_blank" rel="noopener" className="underline hover:text-gray-600 dark:hover:text-gray-400">buf.build</a> or project repository (usually under <code className="text-[8px] px-0.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">/proto</code>)
            </div>
          )}
        </div>
      </div>

      {/* Full path */}
      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-[10px] text-gray-500 dark:text-gray-400 shrink-0">Full Path:</span>
            <code className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate" title={`${service.fullName}.${method.name}`}>
              {service.fullName}.{method.name}
            </code>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-gray-500 dark:text-gray-400 shrink-0">
            <span className="truncate" title={method.requestType}>Request: <code className="font-mono">{method.requestType}</code></span>
            <span className="truncate" title={method.responseType}>Response: <code className="font-mono">{method.responseType}</code></span>
          </div>
        </div>
      </div>
    </div>
  );
}