// app/api/grpc/reflect/route.ts
// gRPC reflection endpoint for service discovery
// NOTE: Test endpoint only - UI uses /api/grpc/services instead
// No caching - meant for testing purposes

import { NextResponse } from 'next/server';
import { ReflectionClient } from '@/lib/grpc/reflection-client';

export const runtime = 'nodejs';

interface ServiceDiscoveryRequest {
  endpoint: string;
  tls?: boolean;
  forceRefresh?: boolean;
}

/**
 * POST /api/grpc/reflect - Discover services using native gRPC reflection
 *
 * Request body:
 * {
 *   "endpoint": "grpc.example.com:443",
 *   "tls": true,
 *   "forceRefresh": false
 * }
 *
 * Response:
 * {
 *   "services": [...],
 *   "cached": boolean,
 *   "cacheKey": string,
 *   "endpoint": string
 * }
 */
export async function POST(req: Request) {
  try {
    const body: ServiceDiscoveryRequest = await req.json();
    const { endpoint, tls = true, forceRefresh = false } = body;

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Missing required parameter: endpoint' },
        { status: 400 }
      );
    }

    console.log(`[Reflection] Discovering services for ${endpoint} (TLS: ${tls})`);

    // Initialize reflection client (no caching for test endpoint)
    const reflectionClient = new ReflectionClient({
      endpoint,
      tls,
      timeout: 15000,
    });

    try {
      // Fetch all services and descriptors
      await reflectionClient.initialize();

      const services = reflectionClient.getServices();

      // Try to fetch chain_id (Cosmos-specific)
      let chainId: string | null = null;

      try {
        const methodInfo = reflectionClient.findMethod(
          'cosmos.base.tendermint.v1beta1.Service',
          'GetLatestBlock'
        );

        if (methodInfo) {
          const response = await reflectionClient.invokeMethod(
            'cosmos.base.tendermint.v1beta1.Service',
            'GetLatestBlock',
            {},
            5000
          );

          // Extract chain_id from response
          chainId = response?.sdkBlock?.header?.chainId ||
                   response?.block?.header?.chain_id ||
                   null;

          if (chainId) {
            console.log(`[Reflection] Detected chain_id: ${chainId}`);
          }
        }
      } catch (err) {
        console.log('[Reflection] Could not fetch chain_id (non-Cosmos chain or unavailable)');
      }

      // Prepare response
      const responseData = {
        services,
        endpoint,
        tls,
        chainId,
        timestamp: Date.now(),
      };

      return NextResponse.json(responseData);

    } finally {
      // Cleanup reflection client
      reflectionClient.close();
    }

  } catch (error: any) {
    console.error('[Reflection] Error:', error);

    return NextResponse.json(
      {
        error: error.message || 'Failed to discover services',
        details: error.stack,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/grpc/reflect?endpoint=...&tls=true
 * Convenience GET method for discovery
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint');
    const tls = searchParams.get('tls') !== 'false'; // Default to true
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Missing required parameter: endpoint' },
        { status: 400 }
      );
    }

    // Forward to POST handler
    return POST(
      new Request(req.url, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify({ endpoint, tls, forceRefresh }),
      })
    );
  } catch (error: any) {
    console.error('[Reflection] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}
