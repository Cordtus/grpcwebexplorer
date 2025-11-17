// lib/grpc/reflection-utils.ts
// Utility functions for gRPC reflection matching the old API from utils/grpcReflection.ts

import { ReflectionClient } from './reflection-client';

// Re-export types for convenience
export type {
  GrpcService,
  GrpcMethod,
  MessageField,
  MessageTypeDefinition,
  ReflectionOptions,
} from './reflection-client';

/**
 * Fetch all services and their methods using gRPC reflection
 * Drop-in replacement for utils/grpcReflection.ts fetchServicesViaReflection
 *
 * @param options - Reflection options (endpoint, tls, timeout)
 * @returns Array of services with full type definitions
 */
export async function fetchServicesViaReflection(
  options: { endpoint: string; tls: boolean; timeout?: number }
): Promise<import('./reflection-client').GrpcService[]> {
  const client = new ReflectionClient({
    endpoint: options.endpoint,
    tls: options.tls,
    timeout: options.timeout || 10000,
  });

  try {
    await client.initialize();
    return client.getServices();
  } finally {
    client.close();
  }
}

/**
 * Fetch services using optimized Cosmos v2alpha1 reflection when available,
 * with fallback to standard gRPC reflection
 *
 * This method tries to use cosmos.base.reflection.v2alpha1 services first,
 * which is more efficient for Cosmos chains. Falls back to standard reflection
 * if v2alpha1 is not available.
 *
 * @param options - Reflection options (endpoint, tls, timeout)
 * @returns Array of services with full type definitions
 */
export async function fetchServicesWithCosmosOptimization(
  options: { endpoint: string; tls: boolean; timeout?: number }
): Promise<import('./reflection-client').GrpcService[]> {
  const client = new ReflectionClient({
    endpoint: options.endpoint,
    tls: options.tls,
    timeout: options.timeout || 10000,
  });

  try {
    const services: import('./reflection-client').GrpcService[] = [];

    // Try v2alpha1 Cosmos reflection first (much faster)
    console.log('[Reflection] Attempting Cosmos v2alpha1 optimized reflection...');

    // Fetch query services via v2alpha1
    const queryServices = await client.getQueryServicesViaV2Alpha1();
    if (queryServices.length > 0) {
      services.push(...queryServices);
      console.log(`[Reflection] Got ${queryServices.length} query services via v2alpha1`);

      // Log services with no methods
      const emptyServices = queryServices.filter(s => s.methods.length === 0);
      if (emptyServices.length > 0) {
        console.log(`[Reflection] ${emptyServices.length} services have no methods from v2alpha1:`, emptyServices.map(s => s.fullName));
      }
    }

    // Fetch tx descriptor via v2alpha1
    const txService = await client.getTxDescriptorViaV2Alpha1();
    if (txService) {
      services.push(txService);
      console.log(`[Reflection] Got transaction service via v2alpha1`);
    }

    // If we got services via v2alpha1, also try to get any additional services via standard reflection
    // (some chains may have custom services not covered by v2alpha1)
    if (services.length > 0) {
      console.log('[Reflection] v2alpha1 successful, also checking for additional services via standard reflection...');

      try {
        await client.initialize();
        const standardServices = client.getServices();

        console.log(`[Reflection] Standard reflection found ${standardServices.length} services`);

        // Merge with v2alpha1 services
        // For services that exist in both, merge their methods (v2alpha1 sometimes returns empty methods)
        const serviceMap = new Map<string, import('./reflection-client').GrpcService>();

        // Add v2alpha1 services to map
        for (const service of services) {
          serviceMap.set(service.fullName, service);
        }

        // Merge or add standard reflection services
        let mergedMethodCount = 0;
        for (const stdService of standardServices) {
          const existing = serviceMap.get(stdService.fullName);

          if (existing) {
            // Service exists in both - merge methods
            const existingMethodNames = new Set(existing.methods.map(m => m.name));
            const newMethods = stdService.methods.filter(m => !existingMethodNames.has(m.name));

            if (newMethods.length > 0) {
              console.log(`[Reflection] Merging ${newMethods.length} methods into ${stdService.fullName}`);
              existing.methods.push(...newMethods);
              mergedMethodCount += newMethods.length;
            }
          } else {
            // New service not in v2alpha1 - add it
            console.log(`[Reflection] Adding service from standard reflection: ${stdService.fullName} (${stdService.methods.length} methods)`);
            serviceMap.set(stdService.fullName, stdService);
          }
        }

        const allServices = Array.from(serviceMap.values());
        const emptyServiceCount = allServices.filter(s => s.methods.length === 0).length;

        if (emptyServiceCount > 0) {
          console.log(`[Reflection] ${emptyServiceCount} services have no methods`);
        }

        console.log(`[Reflection] Final result: ${allServices.length} services (${allServices.length - emptyServiceCount} with methods, merged ${mergedMethodCount} additional methods)`);

        return allServices;
      } catch (err) {
        console.log('[Reflection] Standard reflection check failed, using v2alpha1 services only');
      }

      return services;
    }

    // v2alpha1 not available, fall back to standard reflection
    console.log('[Reflection] v2alpha1 not available, falling back to standard gRPC reflection...');
    await client.initialize();
    return client.getServices();

  } finally {
    client.close();
  }
}
