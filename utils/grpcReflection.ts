// utils/grpcReflection.ts
import * as grpc from '@grpc/grpc-js';
import { Client as ReflectionClient } from 'grpc-reflection-js';

export interface GrpcMethod {
  name: string;
  fullName: string;
  requestType: string;
  responseType: string;
  requestStreaming: boolean;
  responseStreaming: boolean;
  description: string;
}

export interface GrpcService {
  name: string;
  fullName: string;
  methods: GrpcMethod[];
}

export interface ReflectionOptions {
  endpoint: string;
  tls: boolean;
  timeout?: number;
}

/**
 * Fetch all services and their methods using gRPC reflection
 * Efficiently retrieves service metadata in a single reflection session
 */
export async function fetchServicesViaReflection(
  options: ReflectionOptions
): Promise<GrpcService[]> {
  const { endpoint, tls, timeout = 10000 } = options;

  // Create credentials
  const credentials = tls
    ? grpc.credentials.createSsl()
    : grpc.credentials.createInsecure();

  // Create reflection client
  const reflectionClient = new ReflectionClient(endpoint, credentials);

  try {
    // Step 1: List all services (ONE reflection request)
    console.log(`Listing services from ${endpoint}...`);
    const serviceNames = await reflectionClient.listServices();
    console.log(`Found ${serviceNames.length} services`);

    // Filter out reflection service itself
    const filteredServices = serviceNames.filter(
      (name) => !name.includes('ServerReflection')
    );

    const services: GrpcService[] = [];

    // Step 2: Get file descriptor for each service
    // This is still multiple requests, but each returns the FULL proto file
    // which may contain multiple services, so we can cache results
    const processedFiles = new Set<string>();

    for (const serviceName of filteredServices) {
      try {
        console.log(`Fetching descriptor for ${serviceName}...`);

        // Get the protobuf root for this service
        const root = await reflectionClient.fileContainingSymbol(serviceName);

        // Parse the service and its methods from the root
        const service = root.lookupService(serviceName);

        const methods: GrpcMethod[] = [];
        for (const [methodName, method] of Object.entries(service.methods)) {
          methods.push({
            name: methodName,
            fullName: `${serviceName}.${methodName}`,
            requestType: (method as any).requestType,
            responseType: (method as any).responseType,
            requestStreaming: (method as any).requestStream || false,
            responseStreaming: (method as any).responseStream || false,
            description: (method as any).comment || '',
          });
        }

        // Extract short name
        const parts = serviceName.split('.');
        const shortName = parts[parts.length - 1];

        services.push({
          name: shortName,
          fullName: serviceName,
          methods,
        });

        console.log(`✓ ${serviceName} (${methods.length} methods)`);
      } catch (err) {
        console.error(`Failed to fetch descriptor for ${serviceName}:`, err);
        // Add service with no methods so we can track failures
        const parts = serviceName.split('.');
        const shortName = parts[parts.length - 1];
        services.push({
          name: shortName,
          fullName: serviceName,
          methods: [],
        });
      }
    }

    return services;
  } catch (error) {
    console.error('Reflection error:', error);
    throw error;
  } finally {
    // Clean up connection
    try {
      (reflectionClient as any).close?.();
    } catch (err) {
      // Ignore cleanup errors
    }
  }
}
