// lib/grpc/reflection-client.ts
// Complete gRPC reflection client implementation without grpc-reflection-js

import * as grpc from '@grpc/grpc-js';
import * as protobuf from 'protobufjs';
import descriptorJson from 'protobufjs/google/protobuf/descriptor.json';

// Inline reflection.proto definitions for both v1 and v1alpha
const REFLECTION_PROTO_V1_SOURCE = `
syntax = "proto3";
package grpc.reflection.v1;

service ServerReflection {
  rpc ServerReflectionInfo(stream ServerReflectionRequest)
      returns (stream ServerReflectionResponse);
}

message ServerReflectionRequest {
  string host = 1;
  oneof message_request {
    string file_by_filename = 3;
    string file_containing_symbol = 4;
    ExtensionRequest file_containing_extension = 5;
    string all_extension_numbers_of_type = 6;
    string list_services = 7;
  }
}

message ServerReflectionResponse {
  string valid_host = 1;
  ServerReflectionRequest original_request = 2;
  oneof message_response {
    FileDescriptorResponse file_descriptor_response = 4;
    ExtensionNumberResponse all_extension_numbers_response = 5;
    ListServiceResponse list_services_response = 6;
    ErrorResponse error_response = 7;
  }
}

message FileDescriptorResponse {
  repeated bytes file_descriptor_proto = 1;
}

message ExtensionRequest {
  string containing_type = 1;
  int32 extension_number = 2;
}

message ExtensionNumberResponse {
  string base_type_name = 1;
  repeated int32 extension_number = 2;
}

message ListServiceResponse {
  repeated ServiceResponse service = 1;
}

message ServiceResponse {
  string name = 1;
}

message ErrorResponse {
  int32 error_code = 1;
  string error_message = 2;
}
`;

const REFLECTION_PROTO_V1ALPHA_SOURCE = `
syntax = "proto3";
package grpc.reflection.v1alpha;

service ServerReflection {
  rpc ServerReflectionInfo(stream ServerReflectionRequest)
      returns (stream ServerReflectionResponse);
}

message ServerReflectionRequest {
  string host = 1;
  oneof message_request {
    string file_by_filename = 3;
    string file_containing_symbol = 4;
    ExtensionRequest file_containing_extension = 5;
    string all_extension_numbers_of_type = 6;
    string list_services = 7;
  }
}

message ServerReflectionResponse {
  string valid_host = 1;
  ServerReflectionRequest original_request = 2;
  oneof message_response {
    FileDescriptorResponse file_descriptor_response = 4;
    ExtensionNumberResponse all_extension_numbers_response = 5;
    ListServiceResponse list_services_response = 6;
    ErrorResponse error_response = 7;
  }
}

message FileDescriptorResponse {
  repeated bytes file_descriptor_proto = 1;
}

message ExtensionRequest {
  string containing_type = 1;
  int32 extension_number = 2;
}

message ExtensionNumberResponse {
  string base_type_name = 1;
  repeated int32 extension_number = 2;
}

message ListServiceResponse {
  repeated ServiceResponse service = 1;
}

message ServiceResponse {
  string name = 1;
}

message ErrorResponse {
  int32 error_code = 1;
  string error_message = 2;
}
`;

export interface GrpcService {
  name: string;
  fullName: string;
  methods: GrpcMethod[];
}

export interface MessageField {
  name: string;
  type: string;
  rule?: 'optional' | 'required' | 'repeated';
  defaultValue?: any;
  comment?: string;
  nested?: boolean;
  enumValues?: string[];
  nestedFields?: MessageField[]; // Recursively populated for nested message types
}

export interface MessageTypeDefinition {
  name: string;
  fullName: string;
  fields: MessageField[];
}

export interface GrpcMethod {
  name: string;
  fullName: string;
  serviceName: string;
  requestType: string;
  responseType: string;
  requestStreaming: boolean;
  responseStreaming: boolean;
  description?: string;
  requestTypeDefinition: MessageTypeDefinition;
  responseTypeDefinition: MessageTypeDefinition;
}

export interface ReflectionOptions {
  endpoint: string;
  tls: boolean;
  timeout?: number;
}

/**
 * gRPC Reflection Client
 * Uses @grpc/grpc-js and protobufjs for complete control over reflection and type introspection
 */
export class ReflectionClient {
  private client: grpc.Client;
  private reflectionStub: any;
  private root: protobuf.Root;
  private seenFiles = new Set<string>();
  private descriptorRoot: protobuf.Root | null = null;
  private reflectionVersion: 'v1' | 'v1alpha' | null = null;

  constructor(private options: ReflectionOptions) {
    const credentials = options.tls
      ? grpc.credentials.createSsl()
      : grpc.credentials.createInsecure();

    this.client = new grpc.Client(options.endpoint, credentials, {
      'grpc.max_receive_message_length': -1,
      'grpc.max_send_message_length': -1,
    });

    this.root = new protobuf.Root();
  }

  /**
   * Initialize reflection stub (lightweight setup without loading all services)
   * Tries v1 first, falls back to v1alpha if v1 fails
   */
  private async initializeReflectionStub(): Promise<void> {
    if (this.reflectionStub) return; // Already initialized

    this.descriptorRoot = protobuf.Root.fromJSON(descriptorJson);

    const credentials = this.options.tls
      ? grpc.credentials.createSsl()
      : grpc.credentials.createInsecure();

    // Try v1 first (newer, stable version)
    try {
      console.log('[ReflectionClient] Attempting to use grpc.reflection.v1...');
      const reflectionRootV1 = protobuf.parse(REFLECTION_PROTO_V1_SOURCE).root;

      const ServerReflectionClientV1 = grpc.makeGenericClientConstructor({
        ServerReflectionInfo: {
          path: '/grpc.reflection.v1.ServerReflection/ServerReflectionInfo',
          requestStream: true,
          responseStream: true,
          requestSerialize: (value: any) => Buffer.from(
            reflectionRootV1.lookupType('grpc.reflection.v1.ServerReflectionRequest').encode(value).finish()
          ),
          requestDeserialize: (buffer: Buffer) =>
            reflectionRootV1.lookupType('grpc.reflection.v1.ServerReflectionRequest').decode(buffer),
          responseSerialize: (value: any) => Buffer.from(
            reflectionRootV1.lookupType('grpc.reflection.v1.ServerReflectionResponse').encode(value).finish()
          ),
          responseDeserialize: (buffer: Buffer) =>
            reflectionRootV1.lookupType('grpc.reflection.v1.ServerReflectionResponse').decode(buffer),
        },
      }, 'ServerReflection', {});

      this.reflectionStub = new ServerReflectionClientV1(this.options.endpoint, credentials);

      // Test if v1 works by attempting to list services
      await this.testReflectionStub();

      this.reflectionVersion = 'v1';
      console.log('[ReflectionClient] Using grpc.reflection.v1');
      return;
    } catch (v1Error: any) {
      console.log(`[ReflectionClient] grpc.reflection.v1 failed: ${v1Error.message}, trying v1alpha...`);
      this.reflectionStub = null;
    }

    // Fall back to v1alpha (older version)
    try {
      console.log('[ReflectionClient] Attempting to use grpc.reflection.v1alpha...');
      const reflectionRootV1Alpha = protobuf.parse(REFLECTION_PROTO_V1ALPHA_SOURCE).root;

      const ServerReflectionClientV1Alpha = grpc.makeGenericClientConstructor({
        ServerReflectionInfo: {
          path: '/grpc.reflection.v1alpha.ServerReflection/ServerReflectionInfo',
          requestStream: true,
          responseStream: true,
          requestSerialize: (value: any) => Buffer.from(
            reflectionRootV1Alpha.lookupType('grpc.reflection.v1alpha.ServerReflectionRequest').encode(value).finish()
          ),
          requestDeserialize: (buffer: Buffer) =>
            reflectionRootV1Alpha.lookupType('grpc.reflection.v1alpha.ServerReflectionRequest').decode(buffer),
          responseSerialize: (value: any) => Buffer.from(
            reflectionRootV1Alpha.lookupType('grpc.reflection.v1alpha.ServerReflectionResponse').encode(value).finish()
          ),
          responseDeserialize: (buffer: Buffer) =>
            reflectionRootV1Alpha.lookupType('grpc.reflection.v1alpha.ServerReflectionResponse').decode(buffer),
        },
      }, 'ServerReflection', {});

      this.reflectionStub = new ServerReflectionClientV1Alpha(this.options.endpoint, credentials);

      // Test if v1alpha works
      await this.testReflectionStub();

      this.reflectionVersion = 'v1alpha';
      console.log('[ReflectionClient] Using grpc.reflection.v1alpha');
    } catch (v1alphaError: any) {
      throw new Error(`Failed to initialize reflection stub with both v1 and v1alpha: ${v1alphaError.message}`);
    }
  }

  /**
   * Test if the reflection stub works by attempting a simple list operation
   */
  private async testReflectionStub(): Promise<void> {
    return new Promise((resolve, reject) => {
      const call = this.reflectionStub.ServerReflectionInfo();
      let hasData = false;

      const timeout = setTimeout(() => {
        call.cancel();
        reject(new Error('Reflection test timeout'));
      }, 5000);

      call.on('data', () => {
        hasData = true;
        clearTimeout(timeout);
        call.cancel();
        resolve();
      });

      call.on('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });

      call.write({ listServices: '*' });
      call.end();
    });
  }

  /**
   * Initialize and load all service descriptors
   * OPTIMIZED: Loads services in parallel with configurable concurrency
   */
  async initialize(): Promise<void> {
    const initStartTime = Date.now();
    console.log(`[ReflectionClient] Initializing for ${this.options.endpoint}`);

    await this.initializeReflectionStub();

    // List all services
    const listStartTime = Date.now();
    const serviceNames = await this.listServices();
    const listDuration = Date.now() - listStartTime;
    console.log(`[ReflectionClient] Found ${serviceNames.length} services in ${listDuration}ms`);

    // Filter out reflection service and duplicates
    const servicesToLoad = serviceNames.filter(
      name => !name.includes('ServerReflection')
    );

    // Load services in parallel with concurrency limit
    const loadStartTime = Date.now();
    const concurrencyLimit = 5;
    const processedServices = new Set<string>();
    const failedServices: string[] = [];

    for (let i = 0; i < servicesToLoad.length; i += concurrencyLimit) {
      const batch = servicesToLoad.slice(i, i + concurrencyLimit);

      const results = await Promise.allSettled(
        batch.map(serviceName => this.loadServiceDescriptor(serviceName))
      );

      results.forEach((result, index) => {
        const serviceName = batch[index];
        if (result.status === 'fulfilled') {
          processedServices.add(serviceName);
        } else {
          failedServices.push(serviceName);
          console.warn(`[ReflectionClient] Failed to load ${serviceName}:`, result.reason?.message);
        }
      });
    }

    // Retry failed services sequentially
    if (failedServices.length > 0) {
      console.log(`[ReflectionClient] Retrying ${failedServices.length} failed services sequentially...`);
      const retriedServices: string[] = [];

      for (const serviceName of failedServices) {
        try {
          await this.loadServiceDescriptor(serviceName);
          processedServices.add(serviceName);
          retriedServices.push(serviceName);
          console.log(`[ReflectionClient] Retry succeeded for ${serviceName}`);
        } catch (err) {
          console.error(`[ReflectionClient] Retry failed for ${serviceName}:`, (err as Error).message);
        }
      }

      // Update failed services list
      failedServices.splice(0, failedServices.length, ...failedServices.filter(s => !retriedServices.includes(s)));
    }

    const loadDuration = Date.now() - loadStartTime;
    const totalDuration = Date.now() - initStartTime;

    console.log(`[ReflectionClient] Successfully loaded ${processedServices.size}/${servicesToLoad.length} services in ${loadDuration}ms (total: ${totalDuration}ms)`);

    if (failedServices.length > 0) {
      console.warn(`[ReflectionClient] ${failedServices.length} services permanently failed after retry: ${failedServices.join(', ')}`);
    }
  }

  /**
   * Initialize only the specific service needed for method invocation
   * Much faster than initialize() when you only need one service
   */
  async initializeForMethod(serviceName: string): Promise<void> {
    console.log(`[ReflectionClient] Fast initialization for ${serviceName}`);

    await this.initializeReflectionStub();

    try {
      await this.loadServiceDescriptor(serviceName);

      // Verify the service was loaded
      const service = this.root.lookupService(serviceName);
      const methodCount = Object.keys(service.methods || {}).length;

      console.log(`[ReflectionClient] Loaded ${serviceName} with ${methodCount} methods`);

      if (methodCount === 0) {
        console.warn(`[ReflectionClient] Warning: Service ${serviceName} has no methods!`);
      }
    } catch (err) {
      throw new Error(`Failed to load service ${serviceName}: ${(err as Error).message}`);
    }
  }

  /**
   * List all available services
   */
  private async listServices(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const call = this.reflectionStub.ServerReflectionInfo();
      const services: string[] = [];

      call.on('data', (response: any) => {
        if (response.listServicesResponse) {
          for (const service of response.listServicesResponse.service) {
            services.push(service.name);
          }
        }
      });

      call.on('end', () => resolve(services));
      call.on('error', reject);

      call.write({ listServices: '*' });
      call.end();
    });
  }

  /**
   * Load service descriptor by symbol name
   */
  private async loadServiceDescriptor(symbol: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const call = this.reflectionStub.ServerReflectionInfo();
      let resolved = false;

      call.on('data', (response: any) => {
        if (response.fileDescriptorResponse) {
          try {
            // Process file descriptors
            for (const fdBytes of response.fileDescriptorResponse.fileDescriptorProto) {
              this.processFileDescriptor(Buffer.from(fdBytes));
            }
            if (!resolved) {
              resolved = true;
              resolve();
            }
          } catch (err) {
            if (!resolved) {
              resolved = true;
              reject(err);
            }
          }
        } else if (response.errorResponse) {
          if (!resolved) {
            resolved = true;
            reject(new Error(response.errorResponse.errorMessage));
          }
        }
      });

      call.on('error', (err: Error) => {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });

      call.write({ fileContainingSymbol: symbol });
      call.end();
    });
  }

  /**
   * Load missing types referenced in a response
   * Extracts missing type names from error message and loads them
   */
  private async loadMissingTypes(errorMessage: string): Promise<void> {
    // Extract type name from error: "no such Type or Enum 'package.Type'"
    const match = errorMessage.match(/no such Type or Enum '([^']+)'/);
    if (!match) {
      return; // Not a missing type error
    }

    const missingType = match[1];

    // Check if the type already exists in the root
    try {
      this.root.lookupTypeOrEnum(missingType);
      console.log(`[ReflectionClient] Type ${missingType} already exists in root, skipping load`);
      return; // Type already loaded
    } catch (lookupErr) {
      // Type doesn't exist, continue with loading
    }

    console.log(`[ReflectionClient] Loading missing type: ${missingType}`);

    try {
      await this.loadServiceDescriptor(missingType);
      console.log(`[ReflectionClient] Loaded missing type: ${missingType}`);
    } catch (err) {
      console.warn(`[ReflectionClient] Failed to load missing type ${missingType}:`, err);
      throw err;
    }
  }

  /**
   * Recursively load all missing types until decode succeeds
   * Handles complex responses with multiple nested dependencies
   */
  private async loadAllMissingTypes(
    responseType: protobuf.Type,
    responseBuffer: Buffer,
    depth: number,
    loadedTypes: Set<string> = new Set(),
    startTime: number = Date.now()
  ): Promise<any> {
    const MAX_DEPTH = 50; // Increased from 10 to handle deeply nested Penumbra structures

    if (depth >= MAX_DEPTH) {
      throw new Error(`Exceeded maximum dependency depth (${MAX_DEPTH}). Loaded types: ${Array.from(loadedTypes).join(', ')}`);
    }

    try {
      // Try to decode
      const decodeStart = Date.now();
      const decoded = responseType.decode(new Uint8Array(responseBuffer));
      const json = responseType.toObject(decoded, {
        longs: String,
        enums: String,
        bytes: String,
        defaults: true,
        arrays: true,
        objects: true,
        oneofs: true,
      });
      const decodeTime = Date.now() - decodeStart;

      const totalTime = Date.now() - startTime;
      console.log(`[ReflectionClient] Successfully decoded response after loading ${loadedTypes.size} unique type(s) across ${depth} attempt(s) in ${totalTime}ms (decode: ${decodeTime}ms)`);
      return json;
    } catch (decodeErr: any) {
      const errorMsg = decodeErr.message || String(decodeErr);

      // Check if it's a missing type error
      if (errorMsg.includes('no such Type or Enum')) {
        // Extract the missing type name
        const match = errorMsg.match(/no such Type or Enum '([^']+)'/);
        const missingType = match ? match[1] : 'unknown';

        console.log(`[ReflectionClient] Missing type at depth ${depth}: ${missingType}`);

        // Check if we've already loaded this type in this recursion chain
        if (loadedTypes.has(missingType)) {
          throw new Error(`Circular dependency detected: type '${missingType}' was already loaded but decode still fails. This suggests a different issue.`);
        }

        // Extract and load the missing type
        const loadStart = Date.now();
        await this.loadMissingTypes(errorMsg);
        const loadTime = Date.now() - loadStart;
        console.log(`[ReflectionClient] ⏱️  Loaded ${missingType} in ${loadTime}ms (total elapsed: ${Date.now() - startTime}ms)`);

        // Track that we've loaded this type
        loadedTypes.add(missingType);

        // Recursively retry with increased depth
        return this.loadAllMissingTypes(responseType, responseBuffer, depth + 1, loadedTypes, startTime);
      } else {
        // Not a missing type error, throw it
        throw new Error(`Decode error at depth ${depth}: ${errorMsg}`);
      }
    }
  }

  /**
   * Process and register file descriptor
   */
  private processFileDescriptor(fdBytes: Buffer): void {
    try {
      if (!this.descriptorRoot) {
        throw new Error('Descriptor root not loaded');
      }

      const FileDescriptorProto = this.descriptorRoot.lookupType('google.protobuf.FileDescriptorProto');
      const descriptor = FileDescriptorProto.decode(fdBytes) as any;
      const filename = descriptor.name || 'unknown';

      if (this.seenFiles.has(filename)) {
        return;
      }

      this.seenFiles.add(filename);

      this.addDescriptorToRoot(descriptor);

    } catch (err) {
      console.warn(`[ReflectionClient] Failed to process descriptor:`, err);
    }
  }

  /**
   * Add descriptor to protobuf.js root (simplified)
   */
  private addDescriptorToRoot(descriptor: any): void {
    const pkg = descriptor.package || '';

    // Create namespace if needed
    let namespace: protobuf.Namespace = this.root;
    if (pkg) {
      const parts = pkg.split('.');
      for (const part of parts) {
        let next = namespace.get(part);
        if (!next) {
          next = new protobuf.Namespace(part);
          namespace.add(next);
        }
        namespace = next as protobuf.Namespace;
      }
    }

    // Add enums
    if (descriptor.enumType) {
      for (const enumType of descriptor.enumType) {
        try {
          this.addEnumType(namespace, enumType);
        } catch (err) {
          if (!(err as Error).message.includes('duplicate')) {
            console.warn(`Failed to add enum ${enumType.name}:`, err);
          }
        }
      }
    }

    // Add messages
    if (descriptor.messageType) {
      for (const msgType of descriptor.messageType) {
        try {
          this.addMessageType(namespace, msgType);
        } catch (err) {
          // Silently skip duplicates
          if (!(err as Error).message.includes('duplicate')) {
            console.warn(`Failed to add message ${msgType.name}:`, err);
          }
        }
      }
    }

    // Add services
    if (descriptor.service) {
      for (const svcType of descriptor.service) {
        try {
          this.addServiceType(namespace, svcType);
        } catch (err) {
          // Silently skip duplicates
          if (!(err as Error).message.includes('duplicate')) {
            console.warn(`Failed to add service ${svcType.name}:`, err);
          }
        }
      }
    }
  }

  /**
   * Add message type to namespace
   */
  private addMessageType(namespace: protobuf.Namespace, msgType: any): void {
    const fields: any = {};

    if (msgType.field) {
      for (const field of msgType.field) {
        fields[field.name] = {
          type: this.getFieldType(field),
          id: field.number,
          rule: field.label === 3 ? 'repeated' : undefined,
        };
      }
    }

    const message = new protobuf.Type(msgType.name);
    for (const [name, fieldDef] of Object.entries(fields)) {
      message.add(new protobuf.Field(name, (fieldDef as any).id, (fieldDef as any).type, (fieldDef as any).rule));
    }

    namespace.add(message);

    // Recursively add nested enums
    if (msgType.enumType) {
      for (const nested of msgType.enumType) {
        this.addEnumType(message, nested);
      }
    }

    // Recursively add nested types
    if (msgType.nestedType) {
      for (const nested of msgType.nestedType) {
        this.addMessageType(message, nested);
      }
    }
  }

  /**
   * Add enum type to namespace
   */
  private addEnumType(namespace: protobuf.Namespace, enumType: any): void {
    const values: { [key: string]: number } = {};

    if (enumType.value) {
      for (const value of enumType.value) {
        values[value.name] = value.number;
      }
    }

    const enumObj = new protobuf.Enum(enumType.name, values);
    namespace.add(enumObj);
  }

  /**
   * Add service type to namespace
   */
  private addServiceType(namespace: protobuf.Namespace, svcType: any): void {
    const service = new protobuf.Service(svcType.name);

    if (svcType.method) {
      for (const method of svcType.method) {
        service.add(new protobuf.Method(
          method.name,
          'rpc',
          method.inputType.replace(/^\./, ''),
          method.outputType.replace(/^\./, ''),
          method.clientStreaming || false,
          method.serverStreaming || false
        ));
      }
    }

    namespace.add(service);
  }

  /**
   * Get field type string
   */
  private getFieldType(field: any): string {
    const typeMap: Record<number, string> = {
      1: 'double', 2: 'float', 3: 'int64', 4: 'uint64',
      5: 'int32', 6: 'fixed64', 7: 'fixed32', 8: 'bool',
      9: 'string', 12: 'bytes', 13: 'uint32', 15: 'sfixed32',
      16: 'sfixed64', 17: 'sint32', 18: 'sint64',
    };

    if (field.type in typeMap) {
      return typeMap[field.type];
    }

    if (field.typeName) {
      return field.typeName.replace(/^\./, '');
    }

    return 'string';
  }

  /**
   * Extract message type definition from protobuf root
   * Always returns a valid MessageTypeDefinition - never undefined
   * Methods with no parameters will have an empty fields array
   */
  private extractMessageTypeDefinition(typeName: string, visitedTypes: Set<string> = new Set()): MessageTypeDefinition {
    try {
      const message = this.root.lookupType(typeName);
      if (!message) {
        console.warn(`[ReflectionClient] Could not lookup type ${typeName}, returning empty definition`);
        return {
          name: typeName.split('.').pop() || typeName,
          fullName: typeName,
          fields: [],
        };
      }

      const fields: MessageField[] = [];

      // message.fields can be undefined or an empty object for messages with no fields
      if (message.fields && Object.keys(message.fields).length > 0) {
        for (const [fieldName, field] of Object.entries(message.fields)) {
          const fieldObj = field as any;
          const fieldType = fieldObj.type;
          const rule = fieldObj.rule;
          const comment = fieldObj.comment || '';

          // Check if this is a nested message type (not a primitive)
          const primitiveTypes = [
            'string', 'int32', 'int64', 'uint32', 'uint64',
            'sint32', 'sint64', 'fixed32', 'fixed64', 'sfixed32',
            'sfixed64', 'bool', 'bytes', 'double', 'float'
          ];
          const isNested = fieldType && typeof fieldType === 'string' && !primitiveTypes.includes(fieldType);

          // Check if this is an enum
          let enumValues: string[] | undefined;
          let nestedFields: MessageField[] | undefined;

          if (isNested) {
            try {
              const nestedType = this.root.lookup(fieldType);
              if (nestedType && (nestedType as any).valuesById) {
                // It's an enum
                enumValues = Object.values((nestedType as any).valuesById) as string[];
              } else if (nestedType && !visitedTypes.has(fieldType)) {
                // It's a nested message - recursively extract its fields
                visitedTypes.add(fieldType);
                const nestedDefinition = this.extractMessageTypeDefinition(fieldType, visitedTypes);
                nestedFields = nestedDefinition.fields;
                visitedTypes.delete(fieldType);
              }
            } catch (e) {
              // Failed to lookup nested type, will remain as generic nested field
              console.warn(`[ReflectionClient] Failed to lookup nested type ${fieldType}:`, e);
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

          // Add nested fields if we recursively extracted them
          if (nestedFields && nestedFields.length > 0) {
            fieldDef.nestedFields = nestedFields;
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
      console.error(`[ReflectionClient] Failed to extract message type definition for ${typeName}:`, error);
      // Return empty definition on error rather than undefined
      return {
        name: typeName.split('.').pop() || typeName,
        fullName: typeName,
        fields: [],
      };
    }
  }

  /**
   * Get all services
   */
  getServices(): GrpcService[] {
    const services: GrpcService[] = [];

    const traverse = (namespace: protobuf.Namespace, parentPath: string = ''): void => {
      for (const [name, nested] of Object.entries(namespace.nested || {})) {
        const fullPath = parentPath ? `${parentPath}.${name}` : name;

        if (nested instanceof protobuf.Service) {
          const methods: GrpcMethod[] = [];

          for (const [methodName, method] of Object.entries(nested.methods)) {
            const m = method as protobuf.Method;

            // Validate method has required fields
            if (!methodName || !m.requestType || !m.responseType) {
              console.warn(`[ReflectionClient] Skipping invalid method in ${fullPath}: missing name or types`);
              continue;
            }

            try {
              // Extract type definitions for request and response
              const requestTypeDefinition = this.extractMessageTypeDefinition(m.requestType);
              const responseTypeDefinition = this.extractMessageTypeDefinition(m.responseType);

              methods.push({
                name: methodName,
                fullName: `${fullPath}.${methodName}`,
                serviceName: fullPath,
                requestType: m.requestType,
                responseType: m.responseType,
                requestStreaming: m.requestStream || false,
                responseStreaming: m.responseStream || false,
                requestTypeDefinition,
                responseTypeDefinition,
              });
            } catch (err) {
              console.warn(`[ReflectionClient] Failed to process method ${methodName} in ${fullPath}:`, err);
            }
          }

          // Only add service if it has valid methods
          if (methods.length > 0) {
            services.push({
              name,
              fullName: fullPath,
              methods,
            });
          }
        } else if (nested instanceof protobuf.Namespace) {
          traverse(nested, fullPath);
        }
      }
    };

    traverse(this.root);
    return services;
  }

  /**
   * Find method descriptor
   */
  findMethod(serviceName: string, methodName: string): {
    service: protobuf.Service;
    method: protobuf.Method;
    requestType: protobuf.Type;
    responseType: protobuf.Type;
  } | null {
    try {
      const service = this.root.lookupService(serviceName);
      const method = service.methods[methodName];
      if (!method) return null;

      const requestType = this.root.lookupType(method.requestType);
      const responseType = this.root.lookupType(method.responseType);

      return { service, method, requestType, responseType };
    } catch (err) {
      return null;
    }
  }

  /**
   * Invoke method with JSON parameters
   */
  async invokeMethod(
    serviceName: string,
    methodName: string,
    params: any,
    timeout: number = 10000
  ): Promise<any> {
    const methodInfo = this.findMethod(serviceName, methodName);
    if (!methodInfo) {
      throw new Error(`Method ${serviceName}.${methodName} not found`);
    }

    const { requestType, responseType } = methodInfo;
    const methodPath = `/${serviceName}/${methodName}`;

    const invokeStartTime = Date.now();
    console.log(`[ReflectionClient] Invoking method:`);
    console.log(`  Path: ${methodPath}`);
    console.log(`  Request type: ${requestType.name}`);
    console.log(`  Response type: ${responseType.name}`);
    console.log(`  Params:`, JSON.stringify(params || {}, null, 2));

    return new Promise((resolve, reject) => {
      const grpcCallStartTime = Date.now();
      const client = new grpc.Client(this.options.endpoint,
        this.options.tls ? grpc.credentials.createSsl() : grpc.credentials.createInsecure(),
        {
          'grpc.max_receive_message_length': -1,
          'grpc.max_send_message_length': -1,
        }
      );

      try {
        // Encode request
        const requestMessage = requestType.fromObject(params || {});
        const requestBuffer = Buffer.from(requestType.encode(requestMessage).finish());

        // Log encoded request for debugging
        console.log(`[ReflectionClient] Encoded request message:`, requestType.toObject(requestMessage, {
          longs: String,
          enums: String,
          bytes: String,
          defaults: true,
        }));
        console.log(`[ReflectionClient] Request buffer size: ${requestBuffer.length} bytes`);

        // Make call with deadline
        const deadline = new Date(Date.now() + timeout);
        const call = client.makeUnaryRequest(
          methodPath,
          (buf: Buffer) => buf,
          (buf: Buffer) => buf,
          requestBuffer,
          { deadline }, // Add deadline option for gRPC client
          (error: grpc.ServiceError | null, response?: Buffer) => {
            client.close();

            if (error) {
              console.error(`[ReflectionClient] gRPC Error for ${methodPath}:`);
              console.error(`  Code: ${error.code}`);
              console.error(`  Message: ${error.message}`);
              console.error(`  Details: ${error.details || 'none'}`);
              reject(new Error(`gRPC Error (code ${error.code}): ${error.message}`));
              return;
            }

            if (!response) {
              reject(new Error('No response received'));
              return;
            }

            const grpcCallTime = Date.now() - grpcCallStartTime;
            console.log(`[ReflectionClient] ⏱️  gRPC call completed in ${grpcCallTime}ms, response size: ${response.length} bytes`);

            try {
              const decoded = responseType.decode(new Uint8Array(response));
              const json = responseType.toObject(decoded, {
                longs: String,
                enums: String,
                bytes: String,
                defaults: true,
                arrays: true,
                objects: true,
                oneofs: true,
              });
              resolve(json);
            } catch (decodeErr: any) {
              // Check if this is a missing type error
              const errorMsg = decodeErr.message || String(decodeErr);
              if (errorMsg.includes('no such Type or Enum')) {
                console.warn(`[ReflectionClient] Missing type detected during decode, attempting recursive dependency loading...`);
                // Recursively load all missing types with retry limit
                this.loadAllMissingTypes(responseType, response, 0)
                  .then((json) => {
                    resolve(json);
                  })
                  .catch((loadErr) => {
                    reject(new Error(`Failed to load all missing types: ${loadErr.message}`));
                  });
              } else {
                reject(new Error(`Failed to decode response: ${decodeErr}`));
              }
            }
          }
        );

        setTimeout(() => {
          call.cancel();
          client.close();
          reject(new Error(`Timeout after ${timeout}ms`));
        }, timeout);

      } catch (err) {
        client.close();
        reject(err);
      }
    });
  }

  /**
   * Get query services using Cosmos v2alpha1 reflection (optimized for Cosmos chains)
   * This is more efficient than standard reflection as it returns all query services in one call
   */
  async getQueryServicesViaV2Alpha1(): Promise<GrpcService[]> {
    try {
      console.log('[ReflectionClient] Attempting to fetch query services via v2alpha1...');

      // Initialize only the v2alpha1 reflection service
      await this.initializeForMethod('cosmos.base.reflection.v2alpha1.ReflectionService');

      // Call GetQueryServicesDescriptor
      const response = await this.invokeMethod(
        'cosmos.base.reflection.v2alpha1.ReflectionService',
        'GetQueryServicesDescriptor',
        {},
        10000
      );

      console.log('[ReflectionClient] v2alpha1 response structure:', JSON.stringify(response).substring(0, 500));

      if (!response) {
        console.log('[ReflectionClient] No response from v2alpha1');
        return [];
      }

      // Handle different response structures
      let queryServices = null;
      if (response.queries?.queryServices) {
        queryServices = response.queries.queryServices;
      } else if (response.queries?.query_services) {
        queryServices = response.queries.query_services;
      } else if (Array.isArray(response)) {
        queryServices = response;
      }

      if (!queryServices || queryServices.length === 0) {
        console.log('[ReflectionClient] No query services found in v2alpha1 response');
        return [];
      }

      const services: GrpcService[] = [];

      // Parse query services from response
      for (const queryService of queryServices) {
        if (!queryService.fullname || !queryService.methods) continue;

        const methods: GrpcMethod[] = [];

        for (const method of queryService.methods) {
          if (!method.name) continue;

          // Note: v2alpha1 doesn't provide full type definitions, so we create simplified ones
          methods.push({
            name: method.name,
            fullName: `${queryService.fullname}/${method.name}`,
            serviceName: queryService.fullname,
            requestType: method.fullQueryPath || `${queryService.fullname}.${method.name}Request`,
            responseType: `${queryService.fullname}.${method.name}Response`,
            requestStreaming: false,
            responseStreaming: false,
            requestTypeDefinition: {
              name: `${method.name}Request`,
              fullName: method.fullQueryPath || `${queryService.fullname}.${method.name}Request`,
              fields: [], // Will be populated by standard reflection if needed
            },
            responseTypeDefinition: {
              name: `${method.name}Response`,
              fullName: `${queryService.fullname}.${method.name}Response`,
              fields: [],
            },
          });
        }

        // Always add the service, even if it has no methods from v2alpha1
        // Standard reflection will populate methods later in the merge
        services.push({
          name: queryService.fullname.split('.').pop() || queryService.fullname,
          fullName: queryService.fullname,
          methods,
        });
      }

      console.log(`[ReflectionClient] Found ${services.length} query services via v2alpha1`);
      return services;
    } catch (err: any) {
      console.log(`[ReflectionClient] v2alpha1 query services not available: ${err.message}`);
      return [];
    }
  }

  /**
   * Get transaction descriptor using Cosmos v2alpha1 reflection
   * Returns tx methods grouped in a single "Transactions" service
   */
  async getTxDescriptorViaV2Alpha1(): Promise<GrpcService | null> {
    try {
      console.log('[ReflectionClient] Attempting to fetch tx descriptor via v2alpha1...');

      // Initialize only the v2alpha1 reflection service
      await this.initializeForMethod('cosmos.base.reflection.v2alpha1.ReflectionService');

      // Call GetTxDescriptor
      const response = await this.invokeMethod(
        'cosmos.base.reflection.v2alpha1.ReflectionService',
        'GetTxDescriptor',
        {},
        10000
      );

      if (!response || !response.tx || !response.tx.msgs) {
        console.log('[ReflectionClient] No tx messages found in v2alpha1 response');
        return null;
      }

      const methods: GrpcMethod[] = [];

      // Parse tx messages from response
      for (const msg of response.tx.msgs) {
        if (!msg.msgTypeUrl) continue;

        // Extract message name from type URL (e.g., /cosmos.bank.v1beta1.MsgSend -> MsgSend)
        const msgName = msg.msgTypeUrl.split('.').pop() || msg.msgTypeUrl;
        const serviceName = msg.msgTypeUrl.substring(1, msg.msgTypeUrl.lastIndexOf('.'));

        methods.push({
          name: msgName,
          fullName: msg.msgTypeUrl,
          serviceName: 'cosmos.tx.v1beta1.Transactions',
          requestType: msg.msgTypeUrl,
          responseType: `${serviceName}.${msgName}Response`,
          requestStreaming: false,
          responseStreaming: false,
          requestTypeDefinition: {
            name: msgName,
            fullName: msg.msgTypeUrl,
            fields: [], // Will be populated by standard reflection if needed
          },
          responseTypeDefinition: {
            name: `${msgName}Response`,
            fullName: `${serviceName}.${msgName}Response`,
            fields: [],
          },
        });
      }

      if (methods.length === 0) {
        return null;
      }

      console.log(`[ReflectionClient] Found ${methods.length} tx messages via v2alpha1`);

      return {
        name: 'Transactions',
        fullName: 'cosmos.tx.v1beta1.Transactions',
        methods,
      };
    } catch (err: any) {
      console.log(`[ReflectionClient] v2alpha1 tx descriptor not available: ${err.message}`);
      return null;
    }
  }

  /**
   * Close connection
   */
  close(): void {
    if (this.reflectionStub) {
      try {
        this.reflectionStub.close();
      } catch (err) {
        // Ignore
      }
    }

    if (this.client) {
      try {
        this.client.close();
      } catch (err) {
        // Ignore
      }
    }
  }
}
