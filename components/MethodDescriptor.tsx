'use client';

import React, { useState } from 'react';
import { Copy, Check, FileCode, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GrpcMethod {
  name: string;
  fullName: string;
  requestType: string;
  responseType: string;
  requestStreaming: boolean;
  responseStreaming: boolean;
  options?: any;
  description?: string;
}

interface GrpcService {
  name: string;
  fullName: string;
  methods: GrpcMethod[];
}

interface MethodDescriptorProps {
  method: GrpcMethod;
  service: GrpcService;
  color: string;
}

export default function MethodDescriptor({ method, service, color }: MethodDescriptorProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  // Generate proto definition
  const protoDefinition = `rpc ${method.name}(${method.requestStreaming ? 'stream ' : ''}${method.requestType}) returns (${method.responseStreaming ? 'stream ' : ''}${method.responseType});`;

  // Generate curl example
  const curlExample = `grpcurl \\
  -plaintext \\
  -d '{"example": "data"}' \\
  localhost:50051 \\
  ${service.fullName}/${method.name}`;

  // Generate code example
  const codeExample = `// JavaScript/Node.js example
const client = new ${service.name}Client('localhost:50051', credentials);

const request = new ${method.requestType}();
// Set request fields...

${method.responseStreaming ? 
`const stream = client.${method.name}(request);
stream.on('data', (response) => {
  console.log('Response:', response);
});` : 
`const response = await client.${method.name}(request);
console.log('Response:', response);`}`;

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div 
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {method.name}
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {service.fullName}
          </span>
        </div>
        
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

      {/* Content Grid */}
      <div className="flex-1 grid grid-cols-3 gap-4 overflow-hidden">
        {/* Proto Definition */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
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
          <div className="flex-1 p-3 bg-gray-900 dark:bg-black rounded-lg overflow-auto">
            <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
              {protoDefinition}
            </pre>
          </div>
        </div>

        {/* Type Flow */}
        <div className="flex flex-col">
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Type Flow
          </h3>
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <code className="text-xs font-mono text-blue-700 dark:text-blue-400">
                    {method.requestType.split('.').pop()}
                  </code>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Request</p>
              </div>
              
              <ArrowRight className="h-4 w-4 text-gray-400" />
              
              <div className="text-center">
                <div className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">
                  <code className="text-xs font-mono text-gray-700 dark:text-gray-300">
                    {method.name}
                  </code>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Method</p>
              </div>
              
              <ArrowRight className="h-4 w-4 text-gray-400" />
              
              <div className="text-center">
                <div className="px-3 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <code className="text-xs font-mono text-green-700 dark:text-green-400">
                    {method.responseType.split('.').pop()}
                  </code>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">Response</p>
              </div>
            </div>
          </div>
        </div>

        {/* Examples */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Quick Examples
            </h3>
          </div>
          <div className="flex-1 space-y-2 overflow-auto">
            {/* CURL */}
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400">cURL</span>
                <button
                  onClick={() => handleCopy(curlExample, 'curl')}
                  className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  {copied === 'curl' ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3 text-gray-400" />
                  )}
                </button>
              </div>
              <pre className="text-[10px] text-gray-700 dark:text-gray-300 font-mono overflow-x-auto">
                {curlExample}
              </pre>
            </div>

            {/* Code */}
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400">Code</span>
                <button
                  onClick={() => handleCopy(codeExample, 'code')}
                  className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  {copied === 'code' ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3 text-gray-400" />
                  )}
                </button>
              </div>
              <pre className="text-[10px] text-gray-700 dark:text-gray-300 font-mono overflow-x-auto">
                {codeExample}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Full path */}
      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 dark:text-gray-400">Full Path:</span>
            <code className="text-xs font-mono text-gray-700 dark:text-gray-300">
              {service.fullName}.{method.name}
            </code>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-gray-500 dark:text-gray-400">
            <span>Request: <code className="font-mono">{method.requestType}</code></span>
            <span>Response: <code className="font-mono">{method.responseType}</code></span>
          </div>
        </div>
      </div>
    </div>
  );
}