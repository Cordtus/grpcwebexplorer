// lib/grpc/native-reflection.ts
// Complete native gRPC reflection implementation without grpc-reflection-js

import * as grpc from '@grpc/grpc-js';
import * as protobuf from 'protobufjs';
import descriptorJson from 'protobufjs/google/protobuf/descriptor.json';

// Inline reflection.proto definition
const REFLECTION_PROTO_SOURCE = `
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

export interface GrpcMethod {
  name: string;
  fullName: string;
  serviceName: string;
  requestType: string;
  responseType: string;
  requestStreaming: boolean;
  responseStreaming: boolean;
  description?: string;
}

export interface NativeReflectionOptions {
  endpoint: string;
  tls: boolean;
  timeout?: number;
}

/**
 * Native gRPC Reflection Client
 * Uses raw @grpc/grpc-js without grpc-reflection-js dependency
 */
export class NativeReflectionClient {
  private client: grpc.Client;
  private reflectionStub: any;
  private root: protobuf.Root;
  private seenFiles = new Set<string>();
  private descriptorRoot: protobuf.Root | null = null;

  constructor(private options: NativeReflectionOptions) {
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
   * Initialize and load all service descriptors
   */
  async initialize(): Promise<void> {
    console.log(`[NativeReflection] Initializing for ${this.options.endpoint}`);

    this.descriptorRoot = protobuf.Root.fromJSON(descriptorJson);

    const reflectionRoot = protobuf.parse(REFLECTION_PROTO_SOURCE).root;
    const ServerReflectionService = reflectionRoot.lookupService('grpc.reflection.v1alpha.ServerReflection');

    // Create gRPC service definition
    const credentials = this.options.tls
      ? grpc.credentials.createSsl()
      : grpc.credentials.createInsecure();

    const ServerReflectionClient = grpc.makeGenericClientConstructor({
      ServerReflectionInfo: {
        path: '/grpc.reflection.v1alpha.ServerReflection/ServerReflectionInfo',
        requestStream: true,
        responseStream: true,
        requestSerialize: (value: any) => Buffer.from(
          reflectionRoot.lookupType('grpc.reflection.v1alpha.ServerReflectionRequest').encode(value).finish()
        ),
        requestDeserialize: (buffer: Buffer) =>
          reflectionRoot.lookupType('grpc.reflection.v1alpha.ServerReflectionRequest').decode(buffer),
        responseSerialize: (value: any) => Buffer.from(
          reflectionRoot.lookupType('grpc.reflection.v1alpha.ServerReflectionResponse').encode(value).finish()
        ),
        responseDeserialize: (buffer: Buffer) =>
          reflectionRoot.lookupType('grpc.reflection.v1alpha.ServerReflectionResponse').decode(buffer),
      },
    }, 'ServerReflection', {});

    this.reflectionStub = new ServerReflectionClient(this.options.endpoint, credentials);

    // List all services
    const serviceNames = await this.listServices();
    console.log(`[NativeReflection] Found ${serviceNames.length} services`);

    // Fetch descriptors for each service
    const processedServices = new Set<string>();

    for (const serviceName of serviceNames) {
      if (serviceName.includes('ServerReflection')) continue;
      if (processedServices.has(serviceName)) continue;

      try {
        await this.loadServiceDescriptor(serviceName);
        processedServices.add(serviceName);
      } catch (err) {
        console.warn(`[NativeReflection] Failed to load ${serviceName}:`, (err as Error).message);
      }
    }

    console.log(`[NativeReflection] Successfully loaded ${processedServices.size} services`);
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
      console.warn(`[NativeReflection] Failed to process descriptor:`, err);
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
            methods.push({
              name: methodName,
              fullName: `${fullPath}.${methodName}`,
              serviceName: fullPath,
              requestType: m.requestType,
              responseType: m.responseType,
              requestStreaming: m.requestStream || false,
              responseStreaming: m.responseStream || false,
            });
          }

          services.push({
            name,
            fullName: fullPath,
            methods,
          });
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

    return new Promise((resolve, reject) => {
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

        // Make call
        const call = client.makeUnaryRequest(
          `/${serviceName}/${methodName}`,
          (buf: Buffer) => buf,
          (buf: Buffer) => buf,
          requestBuffer,
          (error: grpc.ServiceError | null, response?: Buffer) => {
            client.close();

            if (error) {
              reject(new Error(`gRPC Error: ${error.message}`));
              return;
            }

            if (!response) {
              reject(new Error('No response received'));
              return;
            }

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
            } catch (decodeErr) {
              reject(new Error(`Failed to decode response: ${decodeErr}`));
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
