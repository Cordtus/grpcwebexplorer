// lib/grpc/reflection.ts
// Comprehensive gRPC reflection implementation based on yaci patterns

import * as grpc from '@grpc/grpc-js';
import { Client as ReflectionClient } from 'grpc-reflection-js';
import type * as protobuf from 'protobufjs';

export interface GrpcMethod {
  name: string;
  fullName: string;
  serviceName: string;
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
  maxRetries?: number;
}

export interface MethodDescriptor {
  service: string;
  method: string;
  fullMethodPath: string;
  requestType: protobuf.Type;
  responseType: protobuf.Type;
  requestStreaming: boolean;
  responseStreaming: boolean;
}

/**
 * Retry a function with exponential backoff
 * Based on yaci's RetryGRPCCall pattern
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  operation: string = 'operation'
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        break;
      }

      const waitTime = 2 * attempt * 1000; // 2s, 4s, 6s exponential backoff
      console.log(`Retrying ${operation} (attempt ${attempt}/${maxRetries}) after ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw new Error(`Failed after ${maxRetries} retries: ${lastError?.message}`);
}

/**
 * GrpcReflectionClient - Manages reflection operations and descriptor caching
 * Based on yaci's CustomResolver and reflection patterns
 */
export class GrpcReflectionClient {
  private endpoint: string;
  private credentials: grpc.ChannelCredentials;
  private reflectionClient: ReflectionClient | null = null;
  private root: protobuf.Root | null = null;
  private services: Map<string, GrpcService> = new Map();
  private descriptorCache: Map<string, protobuf.Type> = new Map();
  private maxRetries: number;
  private timeout: number;

  constructor(options: ReflectionOptions) {
    this.endpoint = options.endpoint;
    this.maxRetries = options.maxRetries || 3;
    this.timeout = options.timeout || 10000;

    this.credentials = options.tls
      ? grpc.credentials.createSsl()
      : grpc.credentials.createInsecure();
  }

  /**
   * Initialize the reflection client and fetch all descriptors
   * Based on yaci's NewGRPCClient initialization flow
   */
  async initialize(): Promise<void> {
    console.log(`Initializing gRPC reflection client for ${this.endpoint}...`);

    // Create reflection client
    this.reflectionClient = new ReflectionClient(this.endpoint, this.credentials);

    try {
      // Fetch all services and build descriptor registry
      await this.fetchAllDescriptors();
    } catch (error) {
      await this.close();
      throw new Error(`Failed to initialize reflection client: ${(error as Error).message}`);
    }
  }

  /**
   * Fetch all file descriptors and build service registry
   * Based on yaci's FetchAllDescriptors pattern
   */
  private async fetchAllDescriptors(): Promise<void> {
    if (!this.reflectionClient) {
      throw new Error('Reflection client not initialized');
    }

    // Step 1: List all services
    console.log('Fetching service list via reflection...');
    const serviceNames = await retryWithBackoff(
      () => this.reflectionClient!.listServices(),
      this.maxRetries,
      'list services'
    );

    console.log(`Found ${serviceNames.length} services`);

    // Filter out reflection service itself
    const filteredServices = serviceNames.filter(
      (name) => !name.includes('ServerReflection') && !name.includes('grpc.reflection')
    );

    // Step 2: Fetch file descriptors for each service
    // Track processed files to avoid duplicate work (same proto file may have multiple services)
    const processedFiles = new Set<string>();

    for (const serviceName of filteredServices) {
      await this.fetchServiceDescriptor(serviceName, processedFiles);
    }

    console.log(`Successfully loaded ${this.services.size} services`);
  }

  /**
   * Fetch descriptor for a specific service
   * Based on yaci's fetchFileDescriptors pattern
   */
  private async fetchServiceDescriptor(
    serviceName: string,
    processedFiles: Set<string>
  ): Promise<void> {
    if (!this.reflectionClient) {
      throw new Error('Reflection client not initialized');
    }

    try {
      console.log(`Fetching descriptor for ${serviceName}...`);

      // Get the protobuf root for this service
      const root = await retryWithBackoff(
        () => this.reflectionClient!.fileContainingSymbol(serviceName),
        this.maxRetries,
        `fetch descriptor for ${serviceName}`
      );

      // Store root for later use
      if (!this.root) {
        // Create new Root if first time
        this.root = new (root.constructor as any)(root.options) as protobuf.Root;
        this.root.add(root);
      } else {
        // Merge with existing root
        this.root.add(root);
      }

      // Parse the service and its methods from the root
      const service = root.lookupService(serviceName);

      const methods: GrpcMethod[] = [];
      for (const [methodName, method] of Object.entries(service.methods)) {
        const methodObj = method as any;

        // Cache request and response types
        const requestTypeName = methodObj.requestType;
        const responseTypeName = methodObj.responseType;

        try {
          const requestType = root.lookupType(requestTypeName);
          const responseType = root.lookupType(responseTypeName);

          this.descriptorCache.set(requestTypeName, requestType);
          this.descriptorCache.set(responseTypeName, responseType);
        } catch (err) {
          console.warn(`Failed to cache types for ${serviceName}.${methodName}:`, err);
        }

        methods.push({
          name: methodName,
          fullName: `${serviceName}.${methodName}`,
          serviceName: serviceName,
          requestType: requestTypeName,
          responseType: responseTypeName,
          requestStreaming: methodObj.requestStream || false,
          responseStreaming: methodObj.responseStream || false,
          description: methodObj.comment || '',
        });
      }

      // Extract short name
      const parts = serviceName.split('.');
      const shortName = parts[parts.length - 1];

      const grpcService: GrpcService = {
        name: shortName,
        fullName: serviceName,
        methods,
      };

      this.services.set(serviceName, grpcService);
      console.log(`✓ ${serviceName} (${methods.length} methods)`);

    } catch (err) {
      console.error(`Failed to fetch descriptor for ${serviceName}:`, err);

      // Add service with no methods to track failures
      const parts = serviceName.split('.');
      const shortName = parts[parts.length - 1];

      this.services.set(serviceName, {
        name: shortName,
        fullName: serviceName,
        methods: [],
      });
    }
  }

  /**
   * Get all services
   */
  getServices(): GrpcService[] {
    return Array.from(this.services.values());
  }

  /**
   * Find a method descriptor by service and method name
   * Based on yaci's FindMethodDescriptor pattern
   */
  findMethodDescriptor(serviceName: string, methodName: string): MethodDescriptor | null {
    const service = this.services.get(serviceName);
    if (!service) {
      return null;
    }

    const method = service.methods.find(m => m.name === methodName);
    if (!method || !this.root) {
      return null;
    }

    try {
      const requestType = this.root.lookupType(method.requestType);
      const responseType = this.root.lookupType(method.responseType);

      return {
        service: serviceName,
        method: methodName,
        fullMethodPath: `/${serviceName}/${methodName}`,
        requestType,
        responseType,
        requestStreaming: method.requestStreaming,
        responseStreaming: method.responseStreaming,
      };
    } catch (err) {
      console.error(`Failed to lookup types for ${serviceName}.${methodName}:`, err);
      return null;
    }
  }

  /**
   * Get the protobuf root (for custom operations)
   */
  getRoot(): protobuf.Root | null {
    return this.root;
  }

  /**
   * Close the reflection client and cleanup resources
   */
  async close(): Promise<void> {
    if (this.reflectionClient) {
      try {
        (this.reflectionClient as any).close?.();
      } catch (err) {
        console.error('Error closing reflection client:', err);
      }
      this.reflectionClient = null;
    }

    this.services.clear();
    this.descriptorCache.clear();
    this.root = null;
  }
}

/**
 * Invoke a gRPC method dynamically with JSON parameters
 * Based on yaci's invokeGRPC and InvokeGRPC patterns
 */
export async function invokeGrpcMethod(
  endpoint: string,
  tls: boolean,
  descriptor: MethodDescriptor,
  jsonParams: any,
  timeout: number = 10000
): Promise<any> {
  const credentials = tls
    ? grpc.credentials.createSsl()
    : grpc.credentials.createInsecure();

  const client = new grpc.Client(endpoint, credentials, {
    'grpc.max_receive_message_length': -1,
    'grpc.max_send_message_length': -1,
  });

  return new Promise((resolve, reject) => {
    try {
      // Create request message from JSON
      const requestMessage = descriptor.requestType.fromObject(jsonParams || {});

      // Encode to buffer
      const requestBuffer = Buffer.from(descriptor.requestType.encode(requestMessage).finish());

      // Make unary call
      const call = client.makeUnaryRequest(
        descriptor.fullMethodPath,
        (value: Buffer) => value, // Pass through serializer
        (value: Buffer) => value, // Pass through deserializer
        requestBuffer,
        (error: grpc.ServiceError | null, response?: Buffer) => {
          client.close();

          if (error) {
            reject(new Error(`gRPC call failed: ${error.message}`));
            return;
          }

          if (!response) {
            reject(new Error('No response received'));
            return;
          }

          try {
            // Decode response
            const decodedResponse = descriptor.responseType.decode(response);
            const jsonResponse = descriptor.responseType.toObject(decodedResponse, {
              longs: String,
              enums: String,
              bytes: String,
              defaults: true,
              arrays: true,
              objects: true,
              oneofs: true,
            });

            resolve(jsonResponse);
          } catch (decodeError) {
            reject(new Error(`Failed to decode response: ${(decodeError as Error).message}`));
          }
        }
      );

      // Set timeout
      call.on('error', (err: Error) => {
        client.close();
        reject(err);
      });

      setTimeout(() => {
        call.cancel();
        client.close();
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

    } catch (error) {
      client.close();
      reject(error);
    }
  });
}

/**
 * Extract a specific field from a gRPC response
 * Based on yaci's ExtractGRPCField pattern (supports nested paths)
 */
export function extractField(response: any, fieldPath: string): any {
  const parts = fieldPath.split('.');
  let value = response;

  for (const part of parts) {
    if (value === null || value === undefined) {
      throw new Error(`Field path '${fieldPath}' not found: '${part}' is null or undefined`);
    }

    if (typeof value !== 'object') {
      throw new Error(`Field path '${fieldPath}' not found: '${part}' is not an object`);
    }

    value = value[part];
  }

  return value;
}
