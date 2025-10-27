// Service discovery using gRPC reflection
// NOTE: No server-side caching - clients cache responses in localStorage
import { NextResponse } from 'next/server';
import { fetchServicesViaReflection, type GrpcService } from '@/utils/grpcReflection';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { endpoint, tlsEnabled: tls, forceRefresh }: { endpoint: string; tlsEnabled: boolean; forceRefresh: boolean; } = body;

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 });
    }

    // Check if this is a chain marker for round-robin mode
    let endpointWithPort = endpoint;
    let isChainMarker = false;
    let chainName = '';
    let roundRobinEndpoints: Array<{ address: string; tls: boolean }> = [];

    if (endpoint.startsWith('chain:')) {
      isChainMarker = true;
      chainName = endpoint.replace('chain:', '');
      console.log(`Chain marker detected: ${chainName} - will use round-robin across all endpoints`);

      // Fetch endpoints from chain registry
      try {
        const chainResponse = await fetch(`https://raw.githubusercontent.com/cosmos/chain-registry/master/${chainName}/chain.json`);
        if (chainResponse.ok) {
          const chainData = await chainResponse.json();
          const grpcEndpoints = chainData.apis?.grpc || [];

          roundRobinEndpoints = grpcEndpoints.map((ep: any) => {
            let address = ep.address.replace(/^https?:\/\//, '');
            if (!address.includes(':')) {
              address = `${address}:9090`;
            }
            const port = address.split(':')[1];
            const tlsEnabled = port === '443';
            return { address, tls: tlsEnabled };
          });

          console.log(`Loaded ${roundRobinEndpoints.length} endpoints for chain ${chainName} from registry`);

          if (roundRobinEndpoints.length === 0) {
            return NextResponse.json({ error: `No gRPC endpoints found for chain ${chainName}` }, { status: 404 });
          }
        } else {
          return NextResponse.json({ error: `Chain ${chainName} not found in registry` }, { status: 404 });
        }
      } catch (error) {
        console.error(`Error fetching chain data for ${chainName}:`, error);
        return NextResponse.json({ error: `Failed to fetch chain data for ${chainName}` }, { status: 500 });
      }
    } else {
      // Parse endpoint to ensure it has a port
      if (!endpoint.includes(':')) {
        endpointWithPort = tls !== false ? `${endpoint}:443` : `${endpoint}:9090`;
      }
    }

    // Determine which endpoints to try
    const endpointsToTry = roundRobinEndpoints.length > 0
      ? roundRobinEndpoints
      : [{ address: endpointWithPort, tls }];

    // Try each endpoint until one works
    // NOTE: No server-side caching - client handles caching in localStorage
    let services: GrpcService[] = [];
    let lastError: any = null;
    let successfulEndpoint = null;

    for (let i = 0; i < Math.min(endpointsToTry.length, 5); i++) {
      const { address, tls: tlsEnabled } = endpointsToTry[i];

      try {
        console.log(`Attempting to fetch services from ${address} (TLS: ${tlsEnabled})...`);

        services = await fetchServicesViaReflection({
          endpoint: address,
          tls: tlsEnabled,
          timeout: 15000, // 15 second timeout
        });

        successfulEndpoint = address;
        console.log(`Successfully fetched ${services.length} services from ${address}`);
        break; // Success! Exit loop
      } catch (err: any) {
        console.error(`Failed to fetch from ${address}:`, err.message);
        lastError = err;

        // If this isn't the last endpoint, try the next one
        if (i < Math.min(endpointsToTry.length, 5) - 1) {
          console.log(`Trying next endpoint...`);
          continue;
        }
      }
    }

    // If all endpoints failed, return error
    if (services.length === 0 && lastError) {
      return NextResponse.json({
        error: `Failed to fetch services: ${lastError.message}`,
        details: `Tried ${Math.min(endpointsToTry.length, 5)} endpoint(s)`,
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
      endpoint: successfulEndpoint,
    };

    console.log(`Final status: ${JSON.stringify(status)}`);

    return NextResponse.json({
      services: servicesWithMethods,
      chainId: chainName,
      status,
      warnings: status.failed > 0
        ? [`${status.failed} services had no methods or failed to load.`]
        : [],
    });
  } catch (err: any) {
    console.error('Error in services route:', err);
    return NextResponse.json({
      error: err.message || 'Failed to fetch services',
    }, { status: 500 });
  }
}
