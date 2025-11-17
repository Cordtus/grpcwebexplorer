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

    // If we got services via v2alpha1, return them immediately
    // Field definitions will be lazy-loaded when needed
    if (services.length > 0) {
      const emptyServiceCount = services.filter(s => s.methods.length === 0).length;

      console.log(`[Reflection] v2alpha1 success: ${services.length} services (${emptyServiceCount} empty)`);
      console.log('[Reflection] Field definitions will be loaded on-demand');

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
