// lib/grpc/reflection-client.ts
// Complete gRPC reflection client implementation without grpc-reflection-js

import * as grpc from '@grpc/grpc-js';
import * as protobuf from 'protobufjs';
import descriptorJson from 'protobufjs/google/protobuf/descriptor.json';
import { DescriptorParser } from './descriptor-parser';
import { errorMessage } from '@/lib/utils';

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

// HTTP annotation from google.api.http option
export interface HttpRule {
  get?: string;
  post?: string;
  put?: string;
  delete?: string;
  patch?: string;
  body?: string;
  // Additional bindings for alternate paths
  additionalBindings?: HttpRule[];
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
  httpRule?: HttpRule; // REST API mapping from google.api.http annotation
  requestTypeDefinition: MessageTypeDefinition;
  responseTypeDefinition: MessageTypeDefinition;
}

export interface ReflectionOptions {
  endpoint: string;
  tls: boolean;
  timeout?: number | undefined;
  /** Additional endpoints to distribute descriptor loading across */
  additionalEndpoints?: Array<{ address: string; tls: boolean }> | undefined;
  /** PEM-encoded client certificate for mTLS */
  clientCert?: string | undefined;
  /** PEM-encoded client private key for mTLS */
  clientKey?: string | undefined;
}

/**
 * gRPC Reflection Client
 * Uses @grpc/grpc-js and protobufjs for complete control over reflection and type introspection
 */
export class ReflectionClient {
  private client: grpc.Client;
  private reflectionStub: any;
  private parser: DescriptorParser;
  private descriptorRoot: protobuf.Root | null = null;
  private reflectionVersion: 'v1' | 'v1alpha' | null = null;
  // Stub pool for distributing descriptor loads across multiple endpoints
  private stubPool: Array<{ stub: any; endpoint: string; tls: boolean; alive: boolean }> = [];
  private stubPoolIndex = 0;
  private reflectionProtoRoot: protobuf.Root | null = null;

  constructor(private options: ReflectionOptions) {
    const credentials = this.buildCredentials(options.tls, options.clientCert, options.clientKey);

    this.client = new grpc.Client(options.endpoint, credentials, {
      'grpc.max_receive_message_length': -1,
      'grpc.max_send_message_length': -1,
    });

    this.parser = new DescriptorParser();
  }

  private getTimeoutMs(defaultMs = 10000): number {
    const timeout = this.options.timeout;
    return typeof timeout === 'number' && Number.isFinite(timeout) && timeout > 0
      ? timeout
      : defaultMs;
  }

  /** Build gRPC credentials, with optional mTLS support */
  private buildCredentials(tls: boolean, clientCert?: string, clientKey?: string): grpc.ChannelCredentials {
    if (!tls) return grpc.credentials.createInsecure();
    if (clientCert && clientKey) {
      return grpc.credentials.createSsl(
        null,
        Buffer.from(clientKey),
        Buffer.from(clientCert)
      );
    }
    return grpc.credentials.createSsl();
  }

  // Delegate to parser
  private get root(): protobuf.Root { return this.parser.getRoot(); }
  private get seenFiles(): Set<string> { return (this.parser as any).seenFiles; }
  private get methodOptions(): Map<string, any> { return (this.parser as any).methodOptions; }

  /**
   * Initialize reflection stub (lightweight setup without loading all services)
   * Tries v1 first, falls back to v1alpha if v1 fails
   */
  private async initializeReflectionStub(): Promise<void> {
    if (this.reflectionStub) return; // Already initialized

    this.descriptorRoot = protobuf.Root.fromJSON(descriptorJson);

    const credentials = this.buildCredentials(this.options.tls, this.options.clientCert, this.options.clientKey);

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
      this.reflectionProtoRoot = reflectionRootV1;
      console.log('[ReflectionClient] Using grpc.reflection.v1');
      return;
    } catch (v1Error: unknown) {
      console.log(`[ReflectionClient] grpc.reflection.v1 failed: ${errorMessage(v1Error)}, trying v1alpha...`);
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
      this.reflectionProtoRoot = reflectionRootV1Alpha;
      console.log('[ReflectionClient] Using grpc.reflection.v1alpha');
    } catch (v1alphaError: unknown) {
      throw new Error(`Failed to initialize reflection stub with both v1 and v1alpha: ${errorMessage(v1alphaError)}`);
    }
  }

  /**
   * Creates a reflection stub for a specific endpoint using the already-detected
   * reflection version and cached proto root. No probing - lazy validation on first use.
   */
  private createStubForEndpoint(address: string, tls: boolean): any {
    if (!this.reflectionVersion || !this.reflectionProtoRoot) {
      throw new Error('Cannot create stub before primary reflection stub is initialized');
    }

    const credentials = this.buildCredentials(tls);

    const versionPrefix = this.reflectionVersion === 'v1'
      ? 'grpc.reflection.v1'
      : 'grpc.reflection.v1alpha';

    const protoRoot = this.reflectionProtoRoot;

    const ReflectionClientConstructor = grpc.makeGenericClientConstructor({
      ServerReflectionInfo: {
        path: `/${versionPrefix}.ServerReflection/ServerReflectionInfo`,
        requestStream: true,
        responseStream: true,
        requestSerialize: (value: any) => Buffer.from(
          protoRoot.lookupType(`${versionPrefix}.ServerReflectionRequest`).encode(value).finish()
        ),
        requestDeserialize: (buffer: Buffer) =>
          protoRoot.lookupType(`${versionPrefix}.ServerReflectionRequest`).decode(buffer),
        responseSerialize: (value: any) => Buffer.from(
          protoRoot.lookupType(`${versionPrefix}.ServerReflectionResponse`).encode(value).finish()
        ),
        responseDeserialize: (buffer: Buffer) =>
          protoRoot.lookupType(`${versionPrefix}.ServerReflectionResponse`).decode(buffer),
      },
    }, 'ServerReflection', {});

    return new ReflectionClientConstructor(address, credentials);
  }

  /**
   * Initializes the stub pool with the primary stub and additional endpoints.
   * Called after initializeReflectionStub() succeeds.
   */
  private initializeStubPool(): void {
    // Primary stub is always first and always alive
    this.stubPool = [{
      stub: this.reflectionStub,
      endpoint: this.options.endpoint,
      tls: this.options.tls,
      alive: true,
    }];

    const additionalEndpoints = this.options.additionalEndpoints || [];
    if (additionalEndpoints.length === 0) return;

    // Max 4 additional stubs (5 total including primary)
    const maxAdditional = 4;
    let added = 0;

    for (const ep of additionalEndpoints) {
      if (added >= maxAdditional) break;
      // Skip duplicates of primary endpoint
      if (ep.address === this.options.endpoint) continue;

      try {
        const stub = this.createStubForEndpoint(ep.address, ep.tls);
        this.stubPool.push({
          stub,
          endpoint: ep.address,
          tls: ep.tls,
          alive: true,
        });
        added++;
      } catch (err: unknown) {
        console.warn(`[ReflectionClient] Failed to create stub for ${ep.address}: ${errorMessage(err)}`);
      }
    }

    if (this.stubPool.length > 1) {
      console.log(`[ReflectionClient] Stub pool initialized with ${this.stubPool.length} endpoints`);
    }
  }

  /**
   * Returns the next alive stub from the pool via round-robin.
   * Returns null if no alive stubs remain (should not happen since primary is never removed).
   */
  private getNextStub(): { stub: any; index: number } | null {
    const aliveCount = this.stubPool.filter(s => s.alive).length;
    if (aliveCount === 0) return null;

    // Round-robin through the pool, skipping dead stubs
    for (let attempts = 0; attempts < this.stubPool.length; attempts++) {
      this.stubPoolIndex = (this.stubPoolIndex + 1) % this.stubPool.length;
      if (this.stubPool[this.stubPoolIndex].alive) {
        return { stub: this.stubPool[this.stubPoolIndex].stub, index: this.stubPoolIndex };
      }
    }

    return null;
  }

  /**
   * Marks a stub as dead and closes its connection.
   * Never removes primary (index 0).
   */
  private removeStubFromPool(index: number): void {
    if (index === 0) return; // Never remove primary
    if (index < 0 || index >= this.stubPool.length) return;

    const entry = this.stubPool[index];
    if (!entry.alive) return;

    entry.alive = false;
    console.warn(`[ReflectionClient] Removed ${entry.endpoint} from stub pool`);

    try {
      entry.stub.close();
    } catch {
      // Ignore close errors
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
        reject(new Error(`Reflection test timeout after ${this.getTimeoutMs(5000)}ms`));
      }, this.getTimeoutMs(5000));

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
   * Rate-limit resilient: uses conservative concurrency, delays between batches,
   * and multiple retry rounds with exponential backoff
   */
  async initialize(): Promise<void> {
    const initStartTime = Date.now();
    console.log(`[ReflectionClient] Initializing for ${this.options.endpoint}`);

    await this.initializeReflectionStub();

    // Initialize stub pool for distributed descriptor loading
    this.initializeStubPool();

    // List all services
    const listStartTime = Date.now();
    const serviceNames = await this.listServices();
    const listDuration = Date.now() - listStartTime;
    console.log(`[ReflectionClient] Found ${serviceNames.length} services in ${listDuration}ms`);

    // Filter out reflection service and duplicates
    const servicesToLoad = serviceNames.filter(
      name => !name.includes('ServerReflection')
    );

    // Scale concurrency and delay based on pool size
    const aliveCount = this.stubPool.filter(s => s.alive).length;
    const usePool = aliveCount > 1;
    const loadStartTime = Date.now();
    const concurrencyLimit = usePool ? Math.min(aliveCount + 2, 8) : 3;
    const batchDelayMs = usePool ? Math.max(75, Math.round(150 / aliveCount)) : 150;
    const processedServices = new Set<string>();
    let failedServices: string[] = [];

    if (usePool) {
      console.log(`[ReflectionClient] Using stub pool (${aliveCount} endpoints, concurrency: ${concurrencyLimit}, delay: ${batchDelayMs}ms)`);
    }

    // Choose loading function based on pool availability
    const loadFn = usePool
      ? (symbol: string) => this.loadServiceDescriptorFromPool(symbol)
      : (symbol: string) => this.loadServiceDescriptor(symbol);

    for (let i = 0; i < servicesToLoad.length; i += concurrencyLimit) {
      const batch = servicesToLoad.slice(i, i + concurrencyLimit);

      const results = await Promise.allSettled(
        batch.map(serviceName => loadFn(serviceName))
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

      // Delay between batches to avoid rate limiting
      if (i + concurrencyLimit < servicesToLoad.length) {
        await new Promise(resolve => setTimeout(resolve, batchDelayMs));
      }
    }

    // Multiple retry rounds with exponential backoff
    const maxRetryRounds = 3;
    const retryDelays = [500, 1500, 3000];

    for (let round = 0; round < maxRetryRounds && failedServices.length > 0; round++) {
      const delayMs = retryDelays[round];
      console.log(`[ReflectionClient] Retry round ${round + 1}/${maxRetryRounds}: ${failedServices.length} services, waiting ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));

      const stillFailed: string[] = [];

      // Retry in small batches with the pool if available
      const retryBatchSize = usePool ? Math.min(aliveCount, 4) : 2;
      for (let i = 0; i < failedServices.length; i += retryBatchSize) {
        const batch = failedServices.slice(i, i + retryBatchSize);
        const results = await Promise.allSettled(
          batch.map(serviceName => loadFn(serviceName))
        );

        results.forEach((result, index) => {
          const serviceName = batch[index];
          if (result.status === 'fulfilled') {
            processedServices.add(serviceName);
            console.log(`[ReflectionClient] Retry round ${round + 1} succeeded for ${serviceName}`);
          } else {
            stillFailed.push(serviceName);
          }
        });

        // Delay between retry batches
        if (i + retryBatchSize < failedServices.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      failedServices = stillFailed;
    }

    const loadDuration = Date.now() - loadStartTime;
    const totalDuration = Date.now() - initStartTime;

    console.log(`[ReflectionClient] Successfully loaded ${processedServices.size}/${servicesToLoad.length} services in ${loadDuration}ms (total: ${totalDuration}ms)`);

    if (failedServices.length > 0) {
      console.warn(`[ReflectionClient] ${failedServices.length} services failed after ${maxRetryRounds} retry rounds: ${failedServices.join(', ')}`);
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
      let resolved = false;
      const timeoutMs = this.getTimeoutMs();

      const settle = (fn: () => void) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        fn();
      };

      const timer = setTimeout(() => {
        settle(() => {
          try { call.cancel(); } catch { /* ignore */ }
          reject(new Error(`Timeout after ${timeoutMs}ms`));
        });
      }, timeoutMs);

      call.on('data', (response: any) => {
        if (response.listServicesResponse) {
          for (const service of response.listServicesResponse.service) {
            services.push(service.name);
          }
        }
      });

      call.on('end', () => settle(() => resolve(services)));
      call.on('error', (err: Error) => settle(() => reject(err)));

      call.write({ listServices: '*' });
      call.end();
    });
  }

  /**
   * Load service descriptor by symbol name
   */
  private async loadServiceDescriptor(symbol: string): Promise<void> {
    return this.loadServiceDescriptorViaStub(this.reflectionStub, symbol, this.getTimeoutMs());
  }

  /**
   * Core descriptor loading logic parameterized by stub.
   * All file descriptors merge into the shared protobuf Root.
   */
  private async loadServiceDescriptorViaStub(stub: any, symbol: string, timeoutMs?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const call = stub.ServerReflectionInfo();
      let resolved = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const settle = (fn: () => void) => {
        if (resolved) return;
        resolved = true;
        if (timer) clearTimeout(timer);
        fn();
      };

      if (timeoutMs && timeoutMs > 0) {
        timer = setTimeout(() => {
          settle(() => {
            try { call.cancel(); } catch { /* ignore */ }
            reject(new Error(`Timeout after ${timeoutMs}ms`));
          });
        }, timeoutMs);
      }

      call.on('data', (response: any) => {
        if (response.fileDescriptorResponse) {
          try {
            for (const fdBytes of response.fileDescriptorResponse.fileDescriptorProto) {
              this.processFileDescriptor(Buffer.from(fdBytes));
            }
            settle(() => resolve());
          } catch (err) {
            settle(() => reject(err));
          }
        } else if (response.errorResponse) {
          settle(() => reject(new Error(response.errorResponse.errorMessage)));
        }
      });

      call.on('error', (err: Error) => {
        settle(() => reject(err));
      });

      call.write({ fileContainingSymbol: symbol });
      call.end();
    });
  }

  /**
   * Loads a service descriptor using the stub pool for distribution.
   * Round-robins across alive stubs, falls back to primary on failure.
   */
  private async loadServiceDescriptorFromPool(symbol: string): Promise<void> {
    const aliveCount = this.stubPool.filter(s => s.alive).length;
    const maxAttempts = Math.min(aliveCount, 3);
    // Aggressive timeout for pool stubs - fail fast, let primary handle fallback
    const poolTimeoutMs = Math.min(this.getTimeoutMs(), 5000);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const next = this.getNextStub();
      if (!next) break;

      try {
        return await this.loadServiceDescriptorViaStub(next.stub, symbol, poolTimeoutMs);
      } catch (err: unknown) {
        console.warn(`[ReflectionClient] Pool stub ${this.stubPool[next.index].endpoint} failed for ${symbol}: ${errorMessage(err)}`);
        this.removeStubFromPool(next.index);
      }
    }

    // Final fallback: always try primary with the configured request timeout.
    return this.loadServiceDescriptorViaStub(this.reflectionStub, symbol, this.getTimeoutMs());
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
   * Recursively decode google.protobuf.Any fields in a JSON response object.
   * Detects objects with both `typeUrl` and `value` keys (protobufjs camelCase output),
   * resolves the inner protobuf type via reflection, and replaces the Any wrapper
   * with the decoded inner message plus an `@type` field for provenance.
   * @param obj - The JSON object to walk
   * @param depth - Current recursion depth (capped at 50)
   * @returns The object with Any fields decoded
   */
  private async decodeAnyFields(obj: any, depth: number = 0): Promise<any> {
    const MAX_DEPTH = 50;
    if (depth >= MAX_DEPTH || obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return Promise.all(obj.map(item => this.decodeAnyFields(item, depth + 1)));
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    // Detect google.protobuf.Any: object with typeUrl (string) and value (string/Buffer)
    if (
      typeof obj.typeUrl === 'string' && obj.typeUrl.length > 0 &&
      (typeof obj.value === 'string' || Buffer.isBuffer(obj.value))
    ) {
      const typeName = obj.typeUrl.includes('/')
        ? obj.typeUrl.substring(obj.typeUrl.lastIndexOf('/') + 1)
        : obj.typeUrl;

      try {
        let msgType: protobuf.Type;
        try {
          msgType = this.root.lookupType(typeName);
        } catch {
          console.log(`[ReflectionClient] Loading type for Any field: ${typeName}`);
          await this.loadServiceDescriptor(typeName);
          msgType = this.root.lookupType(typeName);
        }

        const valueBuffer = typeof obj.value === 'string'
          ? Buffer.from(obj.value, 'base64')
          : obj.value;

        const decoded = msgType.decode(new Uint8Array(valueBuffer));
        const json = msgType.toObject(decoded, {
          longs: String,
          enums: String,
          bytes: String,
          defaults: true,
          arrays: true,
          objects: true,
          oneofs: true,
        });

        // Recurse into the decoded message (it may contain nested Any fields)
        const result = await this.decodeAnyFields(json, depth + 1);
        result['@type'] = typeName;
        return result;
      } catch (err: unknown) {
        // Graceful degradation: leave the Any field as-is
        console.warn(`[ReflectionClient] Failed to decode Any field (${typeName}): ${errorMessage(err)}`);
        return obj;
      }
    }

    // Recurse into all object properties
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = await this.decodeAnyFields(value, depth + 1);
    }
    return result;
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

      return this.decodeAnyFields(json);
    } catch (decodeErr: unknown) {
      const errorMsg = errorMessage(decodeErr);

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
   * Process and register file descriptor (delegates to DescriptorParser)
   */
  private processFileDescriptor(fdBytes: Buffer): void {
    try {
      this.parser.processFileDescriptor(fdBytes);
    } catch (err) {
      console.warn(`[ReflectionClient] Failed to process descriptor:`, err);
    }
  }

  // addDescriptorToRoot, addMessageType, addEnumType, addServiceType,
  // extractHttpRule, getFieldType, extractMessageTypeDefinition
  // are now handled by DescriptorParser (this.parser)

  /** Delegate to parser for message type extraction */
  private extractMessageTypeDefinition(typeName: string, visitedTypes: Set<string> = new Set()): MessageTypeDefinition {
    return this.parser.extractMessageTypeDefinition(typeName, visitedTypes);
  }

  /**
   * Get all services (delegates to DescriptorParser)
   */
  getServices(): GrpcService[] {
    return this.parser.getServices();
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
   * Invoke method with JSON parameters and optional gRPC metadata headers.
   * Invalid metadata keys/values are forwarded as-is; any error from the server
   * is returned to the caller rather than being blocked client-side.
   */
  async invokeMethod(
    serviceName: string,
    methodName: string,
    params: any,
    timeout: number = 10000,
    metadata: Record<string, string> = {}
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
    if (Object.keys(metadata).length > 0) {
      console.log(`  Metadata:`, metadata);
    }

    return new Promise((resolve, reject) => {
      const grpcCallStartTime = Date.now();
      const client = new grpc.Client(this.options.endpoint,
        this.buildCredentials(this.options.tls, this.options.clientCert, this.options.clientKey),
        {
          'grpc.max_receive_message_length': -1,
          'grpc.max_send_message_length': -1,
        }
      );
      let settled = false;
      let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        if (timeoutHandle) clearTimeout(timeoutHandle);
        try { client.close(); } catch { /* ignore */ }
        fn();
      };

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

        // Build gRPC metadata from the provided key/value map.
        // All entries are forwarded unconditionally; the server decides validity.
        const callMetadata = new grpc.Metadata();
        for (const [key, value] of Object.entries(metadata)) {
          if (key.trim()) {
            callMetadata.add(key.trim(), value);
          }
        }

        // Make call with deadline and metadata
        const deadline = new Date(Date.now() + timeout);
        const call = client.makeUnaryRequest(
          methodPath,
          (buf: Buffer) => buf,
          (buf: Buffer) => buf,
          requestBuffer,
          callMetadata,
          { deadline },
          (error: grpc.ServiceError | null, response?: Buffer) => {
            if (error) {
              console.error(`[ReflectionClient] gRPC Error for ${methodPath}:`);
              console.error(`  Code: ${error.code}`);
              console.error(`  Message: ${error.message}`);
              console.error(`  Details: ${error.details || 'none'}`);
              settle(() => reject(new Error(`gRPC Error (code ${error.code}): ${error.message}`)));
              return;
            }

            if (!response) {
              settle(() => reject(new Error('No response received')));
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

              // Decode protobuf Any wrappers while preserving bytes as base64.
              this.decodeAnyFields(json).then(decoded => {
                settle(() => resolve(decoded));
              }).catch(() => {
                settle(() => resolve(json));
              });
            } catch (decodeErr: unknown) {
              // Check if this is a missing type error
              const errorMsg = errorMessage(decodeErr);
              if (errorMsg.includes('no such Type or Enum')) {
                console.warn(`[ReflectionClient] Missing type detected during decode, attempting recursive dependency loading...`);
                // Recursively load all missing types with retry limit
                this.loadAllMissingTypes(responseType, response, 0)
                  .then((json) => {
                    settle(() => resolve(json));
                  })
                  .catch((loadErr) => {
                    settle(() => reject(new Error(`Failed to load all missing types: ${loadErr.message}`)));
                  });
              } else {
                settle(() => reject(new Error(`Failed to decode response: ${decodeErr}`)));
              }
            }
          }
        );

        timeoutHandle = setTimeout(() => {
          try { call.cancel(); } catch { /* ignore */ }
          settle(() => reject(new Error(`Timeout after ${timeout}ms`)));
        }, timeout);
      } catch (err) {
        settle(() => reject(err));
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
        this.getTimeoutMs()
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
    } catch (err: unknown) {
      console.log(`[ReflectionClient] v2alpha1 query services not available: ${errorMessage(err)}`);
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
        this.getTimeoutMs()
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
    } catch (err: unknown) {
      console.log(`[ReflectionClient] v2alpha1 tx descriptor not available: ${errorMessage(err)}`);
      return null;
    }
  }

  /**
   * Close connection
   */
  close(): void {
    // Close pool stubs (skip index 0 - it's the primary, handled below)
    for (let i = 1; i < this.stubPool.length; i++) {
      if (this.stubPool[i].alive) {
        try {
          this.stubPool[i].stub.close();
        } catch {
          // Ignore
        }
      }
    }
    this.stubPool = [];

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
