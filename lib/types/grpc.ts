// Shared gRPC type definitions
import { MessageTypeDefinition } from '@/components/ProtobufFormGenerator';

// HTTP annotation from google.api.http option in proto files
export interface HttpRule {
	get?: string;
	post?: string;
	put?: string;
	delete?: string;
	patch?: string;
	body?: string;
	additionalBindings?: HttpRule[];
}

export interface GrpcMethod {
  name: string;
  fullName: string;
  requestType: string;
  responseType: string;
  requestStreaming: boolean;
  responseStreaming: boolean;
  options?: any;
  description?: string;
  httpRule?: HttpRule; // REST API path from google.api.http annotation
  requestTypeDefinition: MessageTypeDefinition;
  responseTypeDefinition: MessageTypeDefinition;
}

export interface GrpcService {
  name: string;
  fullName: string;
  methods: GrpcMethod[];
}

/**
 * Per-endpoint configuration for round-robin mode
 * Allows individual TLS settings and selection state for each endpoint
 */
export interface EndpointConfig {
  address: string;
  tlsEnabled: boolean;
  selected: boolean;
  provider?: string;
  reachable?: boolean; // DNS validation result (undefined = not checked yet)
  validationError?: string; // Error message if validation failed
}

export interface GrpcNetwork {
  id: string;
  name: string;
  endpoint: string;
  endpoints?: string[]; // Additional fallback endpoints for this chain (legacy)
  endpointConfigs?: EndpointConfig[]; // Per-endpoint settings for round-robin
  chainId?: string;
  tlsEnabled: boolean;
  services: GrpcService[];
  color: string;
  loading?: boolean;
  error?: string;
  expanded?: boolean;
  cached?: boolean;
  cacheTimestamp?: number;
}

export interface MethodInstance {
  id: string;
  networkId: string;
  method: GrpcMethod;
  service: GrpcService;
  color: string;
  expanded?: boolean;
  pinned?: boolean;
  params?: Record<string, any>;
}

export interface ExecutionResult {
  methodId: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
  duration?: number;
  endpoint?: string; // The endpoint used for this execution (for round-robin error reporting)
}
