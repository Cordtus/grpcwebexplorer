// utils/grpcReflection.ts
import * as grpc from '@grpc/grpc-js';
import { Client as ReflectionClient } from 'grpc-reflection-js';

export interface MessageField {
  name: string;
  type: string;
  rule?: 'optional' | 'required' | 'repeated';
  defaultValue?: any;
  comment?: string;
  nested?: boolean;
  enumValues?: string[];
}

export interface MessageTypeDefinition {
  name: string;
  fullName: string;
  fields: MessageField[];
}

export interface GrpcMethod {
  name: string;
  fullName: string;
  requestType: string;
  responseType: string;
  requestStreaming: boolean;
  responseStreaming: boolean;
  description: string;
  requestTypeDefinition: MessageTypeDefinition;
  responseTypeDefinition: MessageTypeDefinition;
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
 * Extract message type definition from protobuf root
 * Always returns a valid MessageTypeDefinition - never undefined
 * Methods with no parameters will have an empty fields array
 */
function extractMessageTypeDefinition(root: any, typeName: string): MessageTypeDefinition {
  try {
    const message = root.lookupType(typeName);
    if (!message) {
      // Return empty message definition if lookup fails
      console.warn(`Could not lookup type ${typeName}, returning empty definition`);
      return {
        name: typeName.split('.').pop() || typeName,
        fullName: typeName,
        fields: [],
      };
    }

    const fields: MessageField[] = [];

    // message.fields can be undefined or an empty object for messages with no fields
    if (message.fields && Object.keys(message.fields).length > 0) {
      for (const [fieldName, field] of Object.entries(message.fields as any)) {
        const fieldType = (field as any).type;
        const rule = (field as any).rule;
        const comment = (field as any).comment || '';

        // Check if this is a nested message type
        const isNested = fieldType && typeof fieldType === 'string' && !['string', 'int32', 'int64', 'uint32', 'uint64', 'sint32', 'sint64', 'fixed32', 'fixed64', 'sfixed32', 'sfixed64', 'bool', 'bytes', 'double', 'float'].includes(fieldType);

        // Check if this is an enum
        let enumValues: string[] | undefined;
        if (isNested) {
          try {
            const nestedType = root.lookup(fieldType);
            if (nestedType && (nestedType as any).valuesById) {
              enumValues = Object.values((nestedType as any).valuesById) as string[];
            }
          } catch (e) {
            // Not an enum, must be a nested message
          }
        }

        const fieldDef: MessageField = {
          name: fieldName,
          type: fieldType,
          rule: rule === 'repeated' ? 'repeated' : rule === 'required' ? 'required' : 'optional',
          comment,
          nested: isNested && !enumValues,
        };

        // Only add enumValues if it's defined (don't set to undefined)
        if (enumValues) {
          fieldDef.enumValues = enumValues;
        }

        fields.push(fieldDef);
      }
    }

    return {
      name: message.name,
      fullName: typeName,
      fields,
    };
  } catch (error) {
    console.error(`Failed to extract message type definition for ${typeName}:`, error);
    // Return empty definition on error rather than undefined
    return {
      name: typeName.split('.').pop() || typeName,
      fullName: typeName,
      fields: [],
    };
  }
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
          const requestType = (method as any).requestType;
          const responseType = (method as any).responseType;

          // Extract type definitions for request and response
          const requestTypeDefinition = extractMessageTypeDefinition(root, requestType);
          const responseTypeDefinition = extractMessageTypeDefinition(root, responseType);

          methods.push({
            name: methodName,
            fullName: `${serviceName}.${methodName}`,
            requestType,
            responseType,
            requestStreaming: (method as any).requestStream || false,
            responseStreaming: (method as any).responseStream || false,
            description: (method as any).comment || '',
            requestTypeDefinition,
            responseTypeDefinition,
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
