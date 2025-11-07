// Shared gRPC type definitions
import { MessageTypeDefinition } from '@/components/ProtobufFormGenerator';

export interface GrpcMethod {
  name: string;
  fullName: string;
  requestType: string;
  responseType: string;
  requestStreaming: boolean;
  responseStreaming: boolean;
  options?: any;
  description?: string;
  requestTypeDefinition: MessageTypeDefinition;
  responseTypeDefinition: MessageTypeDefinition;
}

export interface GrpcService {
  name: string;
  fullName: string;
  methods: GrpcMethod[];
}

export interface GrpcNetwork {
  id: string;
  name: string;
  endpoint: string;
  endpoints?: string[]; // Additional fallback endpoints for this chain
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
}
