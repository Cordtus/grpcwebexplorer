// app/api/grpc/invoke/route.ts
// gRPC method invocation endpoint

import { NextResponse } from 'next/server';
import { GrpcReflectionClient, invokeGrpcMethod } from '@/lib/grpc/reflection';

export const runtime = 'nodejs';

interface MethodInvocationRequest {
  endpoint: string;
  tls?: boolean;
  service: string;
  method: string;
  params?: any;
  timeout?: number;
}

/**
 * POST /api/grpc/invoke - Invoke a gRPC method with dynamic parameters
 *
 * Request body:
 * {
 *   "endpoint": "grpc.example.com:443",
 *   "tls": true,
 *   "service": "cosmos.bank.v1beta1.Query",
 *   "method": "Balance",
 *   "params": { "address": "cosmos1...", "denom": "uatom" },
 *   "timeout": 10000
 * }
 *
 * Response:
 * {
 *   "result": { ... },
 *   "executionTime": 123
 * }
 */
export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const body: MethodInvocationRequest = await req.json();
    const {
      endpoint,
      tls = true,
      service,
      method,
      params = {},
      timeout = 10000,
    } = body;

    // Validate required parameters
    if (!endpoint || !service || !method) {
      return NextResponse.json(
        { error: 'Missing required parameters: endpoint, service, method' },
        { status: 400 }
      );
    }

    console.log(`[Invoke] ${service}.${method} on ${endpoint}`);

    // Initialize reflection client to get method descriptor
    const reflectionClient = new GrpcReflectionClient({
      endpoint,
      tls,
      timeout: 15000,
      maxRetries: 3,
    });

    try {
      // Initialize and fetch descriptors
      await reflectionClient.initialize();

      // Find the method descriptor
      const descriptor = reflectionClient.findMethodDescriptor(service, method);

      if (!descriptor) {
        return NextResponse.json(
          {
            error: `Method not found: ${service}.${method}`,
            availableMethods: reflectionClient.getServices()
              .find(s => s.fullName === service)
              ?.methods.map(m => m.name) || []
          },
          { status: 404 }
        );
      }

      // Check for streaming methods (not supported yet)
      if (descriptor.requestStreaming || descriptor.responseStreaming) {
        return NextResponse.json(
          {
            error: 'Streaming methods are not yet supported',
            method: `${service}.${method}`,
            requestStreaming: descriptor.requestStreaming,
            responseStreaming: descriptor.responseStreaming,
          },
          { status: 400 }
        );
      }

      // Invoke the method
      const result = await invokeGrpcMethod(
        endpoint,
        tls,
        descriptor,
        params,
        timeout
      );

      const executionTime = Date.now() - startTime;

      console.log(`[Invoke] ${service}.${method} completed in ${executionTime}ms`);

      return NextResponse.json({
        result,
        executionTime,
        service,
        method,
        endpoint,
      });

    } finally {
      // Cleanup reflection client
      await reflectionClient.close();
    }

  } catch (error: any) {
    const executionTime = Date.now() - startTime;

    console.error('[Invoke] Error:', error);

    // Extract gRPC error details if available
    let errorMessage = error.message || 'Failed to invoke method';
    let errorCode = 'UNKNOWN';

    if (error.code) {
      errorCode = error.code;
    }

    if (error.details) {
      errorMessage = error.details;
    }

    return NextResponse.json(
      {
        error: errorMessage,
        errorCode,
        executionTime,
        details: error.stack,
      },
      { status: 500 }
    );
  }
}
