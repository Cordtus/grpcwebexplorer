// app/api/grpc/execute/route.ts
// gRPC method execution via reflection service

import { NextResponse } from 'next/server';
import { ReflectionClient } from '@/lib/grpc/reflection-client';
import { errorMessage } from '@/lib/utils';

export const runtime = 'nodejs';
export const maxDuration = 90; // 90 seconds to allow for 60s method timeout + overhead

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const { endpoint, service, method, params, tlsEnabled, metadata, authConfig } = await req.json();

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

    // Build enriched metadata from auth config
    const enrichedMetadata: Record<string, string> = { ...(metadata || {}) };
    let clientCert: string | undefined;
    let clientKey: string | undefined;

    if (authConfig) {
      if (authConfig.type === 'bearer' && authConfig.bearerToken) {
        enrichedMetadata['authorization'] = `Bearer ${authConfig.bearerToken}`;
      } else if (authConfig.type === 'api-key' && authConfig.apiKeyHeader && authConfig.apiKeyValue) {
        enrichedMetadata[authConfig.apiKeyHeader] = authConfig.apiKeyValue;
      } else if (authConfig.type === 'mtls') {
        clientCert = authConfig.clientCert;
        clientKey = authConfig.clientKey;
      }
    }

    // Try with TLS first, fallback to non-TLS if TLS fails
    let result: any;
    let usedTls = tlsEnabled !== false;

    try {
      // Create reflection client with TLS (and optional mTLS)
      const client = new ReflectionClient({
        endpoint: endpointWithPort,
        tls: usedTls,
        timeout: 60000,
        clientCert,
        clientKey,
      });

      try {
        await client.initializeForMethod(service);
        result = await client.invokeMethod(service, method, params || {}, 60000, enrichedMetadata);
      } finally {
        client.close();
      }
    } catch (err: unknown) {
      const msg = errorMessage(err);
      const isTLSError = msg.includes('wrong version number') ||
                        msg.includes('SSL routines') ||
                        msg.includes('EPROTO');

      if (usedTls && isTLSError) {
        console.log(`[Execute] TLS error detected, retrying ${endpointWithPort} without TLS...`);
        usedTls = false;

        const retryClient = new ReflectionClient({
          endpoint: endpointWithPort,
          tls: false,
          timeout: 60000,
          clientCert,
          clientKey,
        });

        try {
          await retryClient.initializeForMethod(service);
          result = await retryClient.invokeMethod(service, method, params || {}, 60000, enrichedMetadata);
          console.log(`[Execute] Success without TLS`);
        } finally {
          retryClient.close();
        }
      } else {
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

  } catch (err: unknown) {
    const executionTime = Date.now() - startTime;

    console.error('[Execute] Error:', err);

    return NextResponse.json({
      success: false,
      error: errorMessage(err),
      executionTime,
      details: err instanceof Error ? err.stack : undefined,
    }, { status: 500 });
  }
}
