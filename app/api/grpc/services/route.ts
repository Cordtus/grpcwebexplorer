// Service discovery using gRPC reflection with smart endpoint management
// NOTE: No server-side caching - clients cache responses in localStorage
import { NextResponse } from 'next/server';
import { fetchServicesViaReflection, fetchServicesWithCosmosOptimization, type GrpcService } from '@/lib/grpc/reflection-utils';
import { endpointManager } from '@/lib/utils/endpoint-manager';
import { fetchChainApis } from '@/lib/services/chainRegistry';

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

      // Fetch endpoints from chain registry using the chainRegistry service
      try {
        const chainApis = await fetchChainApis(chainName);
        if (chainApis && chainApis.grpc && chainApis.grpc.length > 0) {
          // Use endpoint manager to normalize and detect TLS
          endpoints = chainApis.grpc.map((ep) =>
            endpointManager.normalizeEndpoint(ep.address)
          );

          console.log(`[Services] Loaded ${endpoints.length} endpoints for ${chainName}`);
        } else {
          return NextResponse.json({ error: `No gRPC endpoints found for chain ${chainName}` }, { status: 404 });
        }
      } catch (error) {
        console.error(`[Services] Error fetching chain data for ${chainName}:`, error);
        return NextResponse.json({ error: `Failed to fetch chain data for ${chainName}` }, { status: 500 });
      }
    } else {
      // Single endpoint - normalize it but respect user's explicit TLS setting
      const normalized = endpointManager.normalizeEndpoint(endpoint);
      // Use user's TLS toggle value instead of auto-detected value
      endpoints = [{ address: normalized.address, tls }];
    }

    // Try endpoints sequentially (prioritized) until one succeeds
    // Note: Concurrent fetching doesn't work well with reflection - causes partial data
    let services: GrpcService[] = [];
    let successfulEndpoint: string | null = null;
    let tlsUsed: boolean = false;
    let lastError: any = null;

    // Prioritize endpoints before trying
    const prioritizedEndpoints = endpointManager.prioritizeEndpoints(endpoints);

    // Filter out blacklisted and limit to 5 attempts
    const endpointsToTry = prioritizedEndpoints
      .filter(ep => !endpointManager.isBlacklisted(ep.address))
      .slice(0, 5);

    console.log(`[Services] Trying up to ${endpointsToTry.length} endpoints (prioritized, non-blacklisted)`);

    for (let i = 0; i < endpointsToTry.length; i++) {
      const { address, tls: tlsEnabled } = endpointsToTry[i];

      console.log(`[Services] Attempt ${i + 1}/${endpointsToTry.length}: ${address} (TLS: ${tlsEnabled})`);

      // Collect remaining endpoints for distributed descriptor loading
      const additionalEndpoints = isChainMarker
        ? endpointsToTry.filter((_, idx) => idx !== i).map(ep => ({ address: ep.address, tls: ep.tls }))
        : [];

      const startTime = Date.now();
      try {
        // Use optimized Cosmos reflection (v2alpha1) when available, fallback to standard
        services = await fetchServicesWithCosmosOptimization({
          endpoint: address,
          tls: tlsEnabled,
          timeout: 10000, // 10 second timeout per endpoint
          additionalEndpoints,
        });
        const responseTime = Date.now() - startTime;

        if (services.length === 0) {
          throw new Error(`No services found`);
        }

        const servicesWithMethods = services.filter(s => s.methods && s.methods.length > 0);
        const emptyServices = services.length - servicesWithMethods.length;

        endpointManager.recordSuccess(address, responseTime);
        successfulEndpoint = address;
        tlsUsed = tlsEnabled;

        console.log(`[Services] Success with ${address} (${responseTime}ms, ${services.length} services total, ${emptyServices} empty)`);
        break; // Exit loop on success
      } catch (err: any) {
        const responseTime = Date.now() - startTime;
        const isTimeout = err.message?.includes('timeout') || err.message?.includes('Timeout');
        const isTLSError = err.message?.includes('wrong version number') ||
                          err.message?.includes('SSL routines') ||
                          err.message?.includes('EPROTO');

        lastError = err;
        console.error(`[Services] Failed: ${address} (${responseTime}ms) - ${err.message}`);

        // If TLS failed with version mismatch, retry without TLS
        if (tlsEnabled && isTLSError) {
          console.log(`[Services] TLS error detected, retrying ${address} without TLS...`);
          const retryStartTime = Date.now();
          try {
            // Use optimized Cosmos reflection (v2alpha1) when available, fallback to standard
            // Rebuild additional endpoints with TLS disabled for the retried endpoint
            const retryAdditionalEndpoints = isChainMarker
              ? endpointsToTry.filter((_, idx) => idx !== i).map(ep => ({ address: ep.address, tls: ep.tls }))
              : [];
            services = await fetchServicesWithCosmosOptimization({
              endpoint: address,
              tls: false,
              timeout: 10000,
              additionalEndpoints: retryAdditionalEndpoints,
            });
            const retryResponseTime = Date.now() - retryStartTime;

            if (services.length === 0) {
              throw new Error(`No services found after TLS retry`);
            }

            const servicesWithMethods = services.filter(s => s.methods && s.methods.length > 0);
            const emptyServices = services.length - servicesWithMethods.length;

            endpointManager.recordSuccess(address, retryResponseTime);
            successfulEndpoint = address;
            tlsUsed = false;

            console.log(`[Services] Success with ${address} without TLS (${retryResponseTime}ms, ${services.length} services total, ${emptyServices} empty)`);
            break; // Exit loop on success
          } catch (retryErr: any) {
            console.error(`[Services] Retry without TLS also failed: ${retryErr.message}`);
            endpointManager.recordFailure(address, false);
            lastError = retryErr;
          }
        } else {
          endpointManager.recordFailure(address, isTimeout);
        }

        // Continue to next endpoint if available
        if (i < endpointsToTry.length - 1) {
          console.log(`[Services] Trying next endpoint...`);
        }
      }
    }

    // Check if all endpoints failed
    if (!successfulEndpoint) {
      console.error('[Services] All endpoints failed');
      return NextResponse.json({
        error: `Failed to fetch services: ${lastError?.message || 'All endpoints failed'}`,
        details: `Tried ${endpointsToTry.length} endpoint(s) sequentially`,
      }, { status: 500 });
    }

    const servicesWithMethods = services.filter(s => s.methods.length > 0);

    // Count methods that still have empty field definitions (need on-demand loading)
    let methodsNeedingDescriptors = 0;
    for (const service of services) {
      for (const method of service.methods) {
        if (method.requestTypeDefinition && method.requestTypeDefinition.fields.length === 0) {
          methodsNeedingDescriptors++;
        }
      }
    }
    if (methodsNeedingDescriptors > 0) {
      console.warn(`[Services] ${methodsNeedingDescriptors} methods have empty field definitions (will need on-demand loading)`);
    }

    // Auto-detect chain-ID if not already set
    // Try GetChainDescriptor first (v2alpha1), fallback to GetNodeInfo (v1beta1)
    let detectedChainId = chainName;
    if (!detectedChainId) {
      try {
        console.log('[Services] Attempting to detect chain-ID via GetChainDescriptor (v2alpha1)...');
        const chainDescriptorClient = new (await import('@/lib/grpc/reflection-client')).ReflectionClient({
          endpoint: successfulEndpoint!,
          tls: tlsUsed!,
          timeout: 5000,
        });

        try {
          await chainDescriptorClient.initializeForMethod('cosmos.base.reflection.v2alpha1.ReflectionService');
          const chainDescriptor = await chainDescriptorClient.invokeMethod(
            'cosmos.base.reflection.v2alpha1.ReflectionService',
            'GetChainDescriptor',
            {},
            5000
          );

          if (chainDescriptor?.chain?.id) {
            detectedChainId = chainDescriptor.chain.id;
            console.log(`[Services] Detected chain-ID via v2alpha1: ${detectedChainId}`);
          }
        } finally {
          chainDescriptorClient.close();
        }
      } catch (err: any) {
        console.log(`[Services] GetChainDescriptor failed: ${err.message}, trying fallback...`);

        // Fallback to GetNodeInfo (v1beta1)
        try {
          console.log('[Services] Attempting to detect chain-ID via GetNodeInfo (v1beta1)...');
          const nodeInfoClient = new (await import('@/lib/grpc/reflection-client')).ReflectionClient({
            endpoint: successfulEndpoint!,
            tls: tlsUsed!,
            timeout: 5000,
          });

          try {
            await nodeInfoClient.initializeForMethod('cosmos.base.tendermint.v1beta1.Service');
            const nodeInfo = await nodeInfoClient.invokeMethod(
              'cosmos.base.tendermint.v1beta1.Service',
              'GetNodeInfo',
              {},
              5000
            );

            if (nodeInfo?.default_node_info?.network) {
              detectedChainId = nodeInfo.default_node_info.network;
              console.log(`[Services] Detected chain-ID via v1beta1 fallback: ${detectedChainId}`);
            }
          } finally {
            nodeInfoClient.close();
          }
        } catch (fallbackErr: any) {
          console.log(`[Services] Could not auto-detect chain-ID: ${fallbackErr.message}`);
          // Not a critical error - continue without chain-ID
        }
      }
    }

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

    // For chain markers, return all available endpoints for round-robin distribution
    const allEndpoints = isChainMarker
      ? prioritizedEndpoints.map(ep => ({ address: ep.address, tls: ep.tls }))
      : [];

    return NextResponse.json({
      services: services,
      chainId: detectedChainId,
      status,
      // Include all endpoints for round-robin distribution (only for chain markers)
      availableEndpoints: allEndpoints,
      methodsNeedingDescriptors,
      warnings: [
        ...(status.failed > 0 ? [`${status.failed} services have no methods.`] : []),
        ...(methodsNeedingDescriptors > 0 ? [`${methodsNeedingDescriptors} methods need on-demand field definition loading.`] : []),
      ],
    });
  } catch (err: any) {
    console.error('[Services] Error in services route:', err);
    return NextResponse.json({
      error: err.message || 'Failed to fetch services',
    }, { status: 500 });
  }
}
