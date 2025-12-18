'use client';

import React, { useState, useMemo } from 'react';
import { Copy, Check, FileCode, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GrpcMethod, GrpcService } from '@/lib/types/grpc';
import { generateRestUrl } from '@/lib/utils/rest-path-mapper';

interface MethodDescriptorProps {
  method: GrpcMethod;
  service: GrpcService;
  color: string;
  endpoint?: string;
  tlsEnabled?: boolean;
  params?: Record<string, any>;
  restEndpoint?: string; // REST API endpoint (defaults to port 1317)
}

export default function MethodDescriptor({ method, service, color, endpoint, tlsEnabled, params = {}, restEndpoint }: MethodDescriptorProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'curl' | 'grpcurl'>('curl');

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  // Generate proto definition
  const protoDefinition = `rpc ${method.name}(${method.requestStreaming ? 'stream ' : ''}${method.requestType}) returns (${method.responseStreaming ? 'stream ' : ''}${method.responseType});`;

  // Derive REST endpoint from gRPC endpoint (port 9090 -> 1317)
  const restBaseUrl = useMemo(() => {
    if (restEndpoint) return restEndpoint;
    if (!endpoint) return 'https://api.example.com';
    // Replace gRPC port with REST port
    const url = endpoint.replace(/:9090$/, ':1317').replace(/:443$/, '');
    // Add https if no protocol
    if (!url.startsWith('http')) {
      return tlsEnabled !== false ? `https://${url}` : `http://${url}`;
    }
    return url;
  }, [endpoint, tlsEnabled, restEndpoint]);

  // Generate REST curl example using method descriptor and HTTP annotation
  const restResult = useMemo(() => {
    return generateRestUrl(
      service.fullName,
      method.name,
      params,
      restBaseUrl,
      method.requestTypeDefinition,
      method.httpRule
    );
  }, [service.fullName, method.name, params, restBaseUrl, method.requestTypeDefinition, method.httpRule]);

  const curlExample = useMemo(() => {
    if (!restResult.supported) {
      return `# No known REST mapping for this method\n# Use grpcurl tab instead`;
    }
    return `curl '${restResult.url}'`;
  }, [restResult]);

  // Generate grpcurl request data based on actual fields
  const generateGrpcRequestData = () => {
    const requestTypeName = method.requestType.split('.').pop() || method.requestType;

    // Check if request type is Empty
    if (requestTypeName.includes('Empty') || method.requestType === 'google.protobuf.Empty') {
      return '{}';
    }

    // If we have field definitions, use them
    if (method.requestTypeDefinition && method.requestTypeDefinition.fields.length > 0) {
      const fields = method.requestTypeDefinition.fields;
      const exampleFields: Record<string, any> = {};

      // Track which fields are 64-bit integers (need string representation in JSON)
      const int64Fields = new Set<string>();

      // Generate example values for each field
      for (const field of fields) {
        // Track 64-bit integer fields
        if (['int64', 'uint64', 'sint64', 'fixed64', 'sfixed64'].includes(field.type)) {
          int64Fields.add(field.name);
        }

        // Generate example value based on type (show all fields, not just required ones)
        if (field.enumValues && field.enumValues.length > 0) {
          exampleFields[field.name] = field.enumValues[0];
        } else if (field.type === 'string') {
          exampleFields[field.name] = '';
        } else if (['int64', 'uint64', 'sint64', 'fixed64', 'sfixed64'].includes(field.type)) {
          // 64-bit integers must be strings in gRPC JSON encoding
          exampleFields[field.name] = '0';
        } else if (['int32', 'uint32', 'sint32', 'fixed32', 'sfixed32'].includes(field.type)) {
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

      // Merge with actual user-provided params, ensuring correct types
      const mergedFields = { ...exampleFields };
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === '') {
          // Keep the default value for empty inputs
          continue;
        }

        if (int64Fields.has(key)) {
          // Convert 64-bit integer values to strings for gRPC JSON encoding
          mergedFields[key] = String(value);
        } else {
          mergedFields[key] = value;
        }
      }

      // If no fields at all, return empty object
      if (Object.keys(mergedFields).length === 0) {
        return '{}';
      }

      return JSON.stringify(mergedFields, null, 2);
    }

    // If no field definitions but we have params, use them
    if (Object.keys(params).length > 0) {
      return JSON.stringify(params, null, 2);
    }

    // Fallback: empty object for unknown types
    return '{}';
  };

  const grpcRequestData = generateGrpcRequestData();

  // Generate grpcurl example
  const grpcurlExample = useMemo(() => {
    const plaintextFlag = tlsEnabled ? '' : '  -plaintext \\\n';
    const grpcEndpoint = endpoint || 'localhost:9090';
    const hasFields = method.requestTypeDefinition && method.requestTypeDefinition.fields.length > 0;
    const dataFlag = (hasFields || grpcRequestData !== '{}') ? `  -d '${grpcRequestData}' \\\n` : '';

    return `grpcurl \\
${plaintextFlag}${dataFlag}  ${grpcEndpoint} \\
  ${service.fullName}/${method.name}`;
  }, [tlsEnabled, endpoint, method, service.fullName, grpcRequestData]);

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
                curl (REST)
              </button>
              <button
                onClick={() => setActiveTab('grpcurl')}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded transition-colors",
                  activeTab === 'grpcurl'
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                )}
              >
                grpcurl
              </button>
            </div>
            <button
              onClick={() => handleCopy(activeTab === 'curl' ? curlExample : grpcurlExample, activeTab)}
              className="p-1 hover:bg-muted rounded transition-colors"
              disabled={activeTab === 'curl' && !restResult.supported}
            >
              {copied === activeTab ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className={cn(
                  "h-3.5 w-3.5 transition-colors",
                  activeTab === 'curl' && !restResult.supported
                    ? "text-muted-foreground/50"
                    : "text-muted-foreground hover:text-foreground"
                )} />
              )}
            </button>
          </div>
          <div className="flex-1 overflow-auto min-h-0 code-snippet-scroll">
            <div className="p-4 bg-muted/50 rounded-lg border border-primary/20 shadow-lg">
              <pre className={cn(
                "text-xs font-mono whitespace-pre leading-relaxed",
                activeTab === 'curl' && !restResult.supported
                  ? "text-muted-foreground"
                  : "text-blue-100 dark:text-blue-50"
              )}>
                {activeTab === 'curl' ? curlExample : grpcurlExample}
              </pre>
            </div>
          </div>
          {activeTab === 'curl' && (restResult.warning || !restResult.supported) && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-500">
              <AlertTriangle className="h-3 w-3" />
              <span>{restResult.warning || 'No REST endpoint for this method'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}