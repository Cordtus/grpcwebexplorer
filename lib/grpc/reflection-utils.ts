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
 * After getting the service list from v2alpha1, it loads full field definitions
 * using standard reflection to ensure all methods have proper parameter info.
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
    const v2alpha1Services: import('./reflection-client').GrpcService[] = [];

    console.log('[Reflection] Attempting v2alpha1 reflection...');

    // Fetch query services via v2alpha1
    const queryServices = await client.getQueryServicesViaV2Alpha1();
    if (queryServices.length > 0) {
      v2alpha1Services.push(...queryServices);
      console.log(`[Reflection] Got ${queryServices.length} query services via v2alpha1`);
    }

    // Fetch tx descriptor via v2alpha1
    const txService = await client.getTxDescriptorViaV2Alpha1();
    if (txService) {
      v2alpha1Services.push(txService);
      console.log(`[Reflection] Got transaction service via v2alpha1`);
    }

    // If v2alpha1 succeeded, enrich with full field definitions using standard reflection
    if (v2alpha1Services.length > 0) {
      console.log(`[Reflection] v2alpha1 success: ${v2alpha1Services.length} total services`);
      console.log('[Reflection] Now loading full field definitions via standard reflection...');

      // Load full descriptors for all v2alpha1 services using standard reflection
      // This ensures field definitions are always available
      await client.initialize();
      const enrichedServices = client.getServices();

      // Create a map for quick lookup
      const enrichedMap = new Map<string, import('./reflection-client').GrpcService>();
      for (const service of enrichedServices) {
        enrichedMap.set(service.fullName, service);
      }

      // Merge: prefer enriched services (with full field definitions), keep v2alpha1-only services
      const finalServices: import('./reflection-client').GrpcService[] = [];
      const seenServices = new Set<string>();

      // First add all enriched services
      for (const service of enrichedServices) {
        finalServices.push(service);
        seenServices.add(service.fullName);
      }

      // Then add any v2alpha1-only services that weren't in standard reflection
      // (like the Transactions service from GetTxDescriptor)
      for (const v2Service of v2alpha1Services) {
        if (!seenServices.has(v2Service.fullName)) {
          finalServices.push(v2Service);
          seenServices.add(v2Service.fullName);
        }
      }

      console.log(`[Reflection] Final enriched services: ${finalServices.length}`);
      return finalServices;
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
 * Throws an error if loading fails so callers can handle appropriately
 */
export async function loadServiceDescriptor(
  options: { endpoint: string; tls: boolean; timeout?: number },
  serviceName: string
): Promise<import('./reflection-client').GrpcService | null> {
  if (!options?.endpoint || typeof options.tls !== 'boolean') {
    throw new Error('Invalid options: endpoint and tls are required');
  }
  if (!serviceName) {
    throw new Error('Service name is required');
  }

  const cacheKey = `descriptor:${options.endpoint}:${options.tls}:${serviceName}`;

  try {
    const cached = getFromCache<import('./reflection-client').GrpcService>(cacheKey);
    if (cached) {
      console.log(`[Reflection] Using cached descriptor for ${serviceName}`);
      return cached;
    }
  } catch (cacheErr) {
    // Cache read failed, continue without cache
    console.warn(`[Reflection] Cache read failed for ${serviceName}:`, cacheErr);
  }

  console.log(`[Reflection] Loading descriptor for ${serviceName} from ${options.endpoint}...`);

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
      try {
        saveToCache(cacheKey, service);
      } catch (cacheErr) {
        // Cache write failed, continue without caching
        console.warn(`[Reflection] Cache write failed for ${serviceName}:`, cacheErr);
      }
      console.log(`[Reflection] Loaded descriptor for ${serviceName} (${service.methods.length} methods)`);
      return service;
    }

    console.warn(`[Reflection] Service ${serviceName} not found after initialization. Available services:`,
      services.map(s => s.fullName).join(', '));
    return null;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[Reflection] Failed to load descriptor for ${serviceName}:`, errorMessage);
    throw new Error(`Failed to load descriptor for ${serviceName}: ${errorMessage}`);
  } finally {
    client.close();
  }
}
