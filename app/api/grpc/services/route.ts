// Service discovery using gRPC reflection with concurrent endpoint fetching
// NOTE: No server-side caching - clients cache responses in localStorage
import { NextResponse } from 'next/server';
import { fetchServicesViaReflection, type GrpcService } from '@/lib/grpc/reflection-utils';
import { endpointManager, fetchWithConcurrentEndpoints } from '@/lib/utils/endpoint-manager';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { endpoint, tlsEnabled: tls, forceRefresh }: { endpoint: string; tlsEnabled: boolean; forceRefresh: boolean; } = body;

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 });
    }

    // Check if this is a chain marker for round-robin mode
    let isChainMarker = false;
    let chainName = '';
    let endpoints: Array<{ address: string; tls: boolean }> = [];

    if (endpoint.startsWith('chain:')) {
      isChainMarker = true;
      chainName = endpoint.replace('chain:', '');
      console.log(`[Services] Chain marker detected: ${chainName} - will use concurrent endpoint fetching`);

      // Fetch endpoints from chain registry
      try {
        const chainResponse = await fetch(`https://raw.githubusercontent.com/cosmos/chain-registry/master/${chainName}/chain.json`);
        if (chainResponse.ok) {
          const chainData = await chainResponse.json();
          const grpcEndpoints = chainData.apis?.grpc || [];

          // Use endpoint manager to normalize and detect TLS
          endpoints = grpcEndpoints.map((ep: any) =>
            endpointManager.normalizeEndpoint(ep.address)
          );

          console.log(`[Services] Loaded ${endpoints.length} endpoints for ${chainName}`);

          if (endpoints.length === 0) {
            return NextResponse.json({ error: `No gRPC endpoints found for chain ${chainName}` }, { status: 404 });
          }
        } else {
          return NextResponse.json({ error: `Chain ${chainName} not found in registry` }, { status: 404 });
        }
      } catch (error) {
        console.error(`[Services] Error fetching chain data for ${chainName}:`, error);
        return NextResponse.json({ error: `Failed to fetch chain data for ${chainName}` }, { status: 500 });
      }
    } else {
      // Single endpoint - normalize it
      const normalized = endpointManager.normalizeEndpoint(endpoint);
      endpoints = [normalized];
    }

    // Fetch services using concurrent endpoint racing if multiple endpoints
    let services: GrpcService[] = [];
    let successfulEndpoint: string;
    let tlsUsed: boolean;

    try {
      if (endpoints.length > 1) {
        // Multiple endpoints - use concurrent fetching with race-to-first-success
        const result = await fetchWithConcurrentEndpoints(
          endpoints,
          async (address, tlsEnabled) => {
            return await fetchServicesViaReflection({
              endpoint: address,
              tls: tlsEnabled,
              timeout: 15000,
            });
          },
          {
            adaptiveTimeoutPercent: 0.2, // 20% slower than fastest = dropped
            maxAttempts: 5, // Try up to 5 endpoints concurrently
          }
        );

        services = result.data;
        successfulEndpoint = result.endpoint;
        tlsUsed = result.tls;

        console.log(`[Services] Success with ${successfulEndpoint} (${result.responseTime}ms, TLS: ${tlsUsed})`);
      } else {
        // Single endpoint - direct fetch
        const { address, tls: tlsEnabled } = endpoints[0];
        console.log(`[Services] Fetching from single endpoint ${address} (TLS: ${tlsEnabled})`);

        const startTime = Date.now();
        try {
          services = await fetchServicesViaReflection({
            endpoint: address,
            tls: tlsEnabled,
            timeout: 15000,
          });
          const responseTime = Date.now() - startTime;

          endpointManager.recordSuccess(address, responseTime);
          successfulEndpoint = address;
          tlsUsed = tlsEnabled;

          console.log(`[Services] Successfully fetched ${services.length} services from ${address} (${responseTime}ms)`);
        } catch (err) {
          const isTimeout = (err as Error).message?.includes('timeout');
          endpointManager.recordFailure(address, isTimeout);
          throw err;
        }
      }
    } catch (err: any) {
      console.error('[Services] All endpoints failed:', err.message);
      return NextResponse.json({
        error: `Failed to fetch services: ${err.message}`,
        details: endpoints.length > 1
          ? `Tried ${endpoints.length} endpoint(s) concurrently`
          : 'Single endpoint failed',
      }, { status: 500 });
    }

    // Filter out services with no methods
    const servicesWithMethods = services.filter(s => s.methods.length > 0);

    // Prepare status
    const status = {
      total: services.length,
      successful: servicesWithMethods.length,
      failed: services.length - servicesWithMethods.length,
      withMethods: servicesWithMethods.length,
      withoutMethods: services.length - servicesWithMethods.length,
      completionRate: services.length > 0
        ? Math.round((servicesWithMethods.length / services.length) * 100)
        : 0,
      endpoint: successfulEndpoint!,
      tls: tlsUsed!,
    };

    console.log(`[Services] Final status: ${JSON.stringify(status)}`);

    // Log endpoint stats periodically
    if (Math.random() < 0.1) { // 10% chance to log stats
      const stats = endpointManager.getStats();
      const blacklist = endpointManager.getBlacklist();

      console.log(`[Services] Endpoint stats: ${stats.size} tracked`);
      if (blacklist.length > 0) {
        console.log(`[Services] Blacklisted endpoints: ${blacklist.join(', ')}`);
      }
    }

    return NextResponse.json({
      services: servicesWithMethods,
      chainId: chainName,
      status,
      warnings: status.failed > 0
        ? [`${status.failed} services had no methods or failed to load.`]
        : [],
    });
  } catch (err: any) {
    console.error('[Services] Error in services route:', err);
    return NextResponse.json({
      error: err.message || 'Failed to fetch services',
    }, { status: 500 });
  }
}
