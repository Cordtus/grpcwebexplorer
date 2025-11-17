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
    // Use standard gRPC reflection to get complete service list
    console.log('[Reflection] Using standard gRPC reflection to get all services...');
    await client.initialize();
    const services = client.getServices();

    console.log(`[Reflection] Got ${services.length} services via standard reflection`);

    // Log services with no methods for visibility
    const emptyServices = services.filter(s => s.methods.length === 0);
    if (emptyServices.length > 0) {
      console.log(`[Reflection] ${emptyServices.length} services have no methods:`, emptyServices.map(s => s.fullName));
    }

    return services;

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
