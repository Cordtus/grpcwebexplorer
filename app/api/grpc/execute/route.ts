// app/api/grpc/execute/route.ts
// gRPC method execution via reflection service

import { NextResponse } from 'next/server';
import { ReflectionClient } from '@/lib/grpc/reflection-client';

export const runtime = 'nodejs';
export const maxDuration = 90; // 90 seconds to allow for 60s method timeout + overhead

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const { endpoint, service, method, params, tlsEnabled } = await req.json();

    if (!endpoint || !service || !method) {
      return NextResponse.json(
        { error: 'Missing required parameters: endpoint, service, method' },
        { status: 400 }
      );
    }

    // Check if endpoint is a chain marker (should have been resolved by now)
    if (endpoint.startsWith('chain:')) {
      return NextResponse.json(
        {
          error: 'Invalid endpoint format',
          details: 'Chain marker was not resolved to actual endpoint. This is a bug - please refresh the network.'
        },
        { status: 400 }
      );
    }

    // Parse endpoint to ensure it has a port
    let endpointWithPort = endpoint;
    if (!endpoint.includes(':')) {
      endpointWithPort = tlsEnabled !== false ? `${endpoint}:443` : `${endpoint}:9090`;
    }

    console.log(`[Execute] Invoking ${service}.${method} on ${endpointWithPort} (TLS: ${tlsEnabled !== false})`);

    // Try with TLS first, fallback to non-TLS if TLS fails
    let result: any;
    let usedTls = tlsEnabled !== false;

    try {
      // Create reflection client with TLS
      const client = new ReflectionClient({
        endpoint: endpointWithPort,
        tls: usedTls,
        timeout: 60000, // 60s for very slow Penumbra methods (e.g. ValidatorInfo)
      });

      try {
        // Initialize only the specific service we need (fast!)
        await client.initializeForMethod(service);

        // Invoke method (60s timeout for complex queries like ValidatorInfo)
        result = await client.invokeMethod(service, method, params || {}, 60000);

      } finally {
        client.close();
      }
    } catch (err: any) {
      // Check if it's a TLS error
      const isTLSError = err.message?.includes('wrong version number') ||
                        err.message?.includes('SSL routines') ||
                        err.message?.includes('EPROTO');

      if (usedTls && isTLSError) {
        console.log(`[Execute] TLS error detected, retrying ${endpointWithPort} without TLS...`);
        usedTls = false;

        // Retry without TLS
        const retryClient = new ReflectionClient({
          endpoint: endpointWithPort,
          tls: false,
          timeout: 60000, // 60s for very slow Penumbra methods
        });

        try {
          await retryClient.initializeForMethod(service);
          result = await retryClient.invokeMethod(service, method, params || {}, 60000);
          console.log(`[Execute] ✅ Success without TLS`);
        } finally {
          retryClient.close();
        }
      } else {
        // Not a TLS error, or already tried without TLS
        throw err;
      }
    }

    const executionTime = Date.now() - startTime;
    console.log(`[Execute] ${service}.${method} completed in ${executionTime}ms`);

    return NextResponse.json({
      success: true,
      result,
      executionTime,
      service,
      method,
      endpoint: endpointWithPort,
      tls: usedTls,
    });

  } catch (err: any) {
    const executionTime = Date.now() - startTime;

    console.error('[Execute] Error:', err);

    return NextResponse.json({
      success: false,
      error: err.message || 'Failed to invoke method',
      executionTime,
      details: err.stack,
    }, { status: 500 });
  }
}
