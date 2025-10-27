// app/api/grpc/execute/route.ts
// gRPC method execution via reflection service

export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { NativeReflectionClient } from '@/lib/grpc/native-reflection';

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

    // Parse endpoint to ensure it has a port
    let endpointWithPort = endpoint;
    if (!endpoint.includes(':')) {
      endpointWithPort = tlsEnabled !== false ? `${endpoint}:443` : `${endpoint}:9090`;
    }

    console.log(`[Execute] Invoking ${service}.${method} on ${endpointWithPort}`);

    // Create native reflection client
    const client = new NativeReflectionClient({
      endpoint: endpointWithPort,
      tls: tlsEnabled !== false,
      timeout: 15000,
    });

    try {
      // Initialize
      await client.initialize();

      // Invoke method
      const result = await client.invokeMethod(service, method, params || {}, 10000);

      const executionTime = Date.now() - startTime;

      console.log(`[Execute] ${service}.${method} completed in ${executionTime}ms`);

      return NextResponse.json({
        success: true,
        result,
        executionTime,
        service,
        method,
        endpoint: endpointWithPort,
      });

    } finally {
      client.close();
    }

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
