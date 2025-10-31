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
