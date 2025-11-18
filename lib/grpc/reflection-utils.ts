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

import { saveToCache, getFromCache } from '@/lib/utils/client-cache';

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

    console.log('[Reflection] Attempting v2alpha1 reflection...');

    // Fetch query services via v2alpha1
    const queryServices = await client.getQueryServicesViaV2Alpha1();
    if (queryServices.length > 0) {
      services.push(...queryServices);
      console.log(`[Reflection] Got ${queryServices.length} query services via v2alpha1`);
    }

    // Fetch tx descriptor via v2alpha1
    const txService = await client.getTxDescriptorViaV2Alpha1();
    if (txService) {
      services.push(txService);
      console.log(`[Reflection] Got transaction service via v2alpha1`);
    }

    // If v2alpha1 succeeded, return services immediately
    if (services.length > 0) {
      console.log(`[Reflection] v2alpha1 success: ${services.length} total services`);
      console.log('[Reflection] Field definitions will be loaded on-demand when methods are used');
      return services;
    }

    // Fallback to standard reflection if v2alpha1 not available
    console.log('[Reflection] v2alpha1 not available, using standard reflection...');
    await client.initialize();
    const standardServices = client.getServices();
    console.log(`[Reflection] Got ${standardServices.length} services via standard reflection`);
    return standardServices;

  } catch (err: any) {
    console.error('[Reflection] Error in fetchServicesWithCosmosOptimization:', err.message);
    console.error('[Reflection] Stack trace:', err.stack);
    throw err;
  } finally {
    client.close();
  }
}

/**
 * Lazy-load field definitions for a specific service
 * Used when user expands a service or executes a method
 */
export async function loadServiceDescriptor(
  options: { endpoint: string; tls: boolean; timeout?: number },
  serviceName: string
): Promise<import('./reflection-client').GrpcService | null> {
  const cacheKey = `descriptor:${options.endpoint}:${options.tls}:${serviceName}`;

  const cached = getFromCache<import('./reflection-client').GrpcService>(cacheKey);
  if (cached) {
    console.log(`[Reflection] Using cached descriptor for ${serviceName}`);
    return cached;
  }

  console.log(`[Reflection] Loading descriptor for ${serviceName}...`);

  const client = new ReflectionClient({
    endpoint: options.endpoint,
    tls: options.tls,
    timeout: options.timeout || 10000,
  });

  try {
    await client.initializeForMethod(serviceName);
    const services = client.getServices();
    const service = services.find(s => s.fullName === serviceName);

    if (service) {
      saveToCache(cacheKey, service);
      console.log(`[Reflection] Loaded descriptor for ${serviceName} (${service.methods.length} methods)`);
      return service;
    }

    return null;
  } catch (err: any) {
    console.error(`[Reflection] Failed to load descriptor for ${serviceName}:`, err.message);
    return null;
  } finally {
    client.close();
  }
}
