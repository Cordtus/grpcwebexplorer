// app/api/grpc/reflect/route.ts
// gRPC reflection endpoint for service discovery

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { GrpcReflectionClient } from '@/lib/grpc/reflection';
import { grpcCache } from '@/lib/grpc/cache';

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

    // Generate cache key based on endpoint + TLS
    // We'll try to fetch chain_id later for better caching
    const baseCacheKey = `reflect:${endpoint}:${tls}`;

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = grpcCache.get(baseCacheKey);
      if (cached) {
        console.log(`[Reflection] Cache hit for ${endpoint}`);
        return NextResponse.json({
          ...cached,
          cached: true,
          cacheKey: baseCacheKey,
        });
      }
    }

    // Initialize reflection client
    const reflectionClient = new GrpcReflectionClient({
      endpoint,
      tls,
      timeout: 15000,
      maxRetries: 3,
    });

    try {
      // Fetch all services and descriptors
      await reflectionClient.initialize();

      const services = reflectionClient.getServices();

      // Try to fetch chain_id for better cache key (Cosmos-specific)
      let chainId: string | null = null;
      let enhancedCacheKey = baseCacheKey;

      try {
        const descriptor = reflectionClient.findMethodDescriptor(
          'cosmos.base.tendermint.v1beta1.Service',
          'GetLatestBlock'
        );

        if (descriptor) {
          const { invokeGrpcMethod, extractField } = await import('@/lib/grpc/reflection');

          const response = await invokeGrpcMethod(
            endpoint,
            tls,
            descriptor,
            {},
            5000
          );

          chainId = extractField(response, 'sdkBlock.header.chainId') ||
                   extractField(response, 'block.header.chain_id');

          if (chainId) {
            enhancedCacheKey = `reflect:${chainId}`;
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
        cached: false,
        cacheKey: enhancedCacheKey,
      };

      // Cache the result
      grpcCache.set(enhancedCacheKey, responseData);

      // Also cache with base key for quick lookup
      if (enhancedCacheKey !== baseCacheKey) {
        grpcCache.set(baseCacheKey, responseData);
      }

      return NextResponse.json(responseData);

    } finally {
      // Cleanup reflection client
      await reflectionClient.close();
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
