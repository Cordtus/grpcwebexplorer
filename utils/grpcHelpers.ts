// utils/grpcHelpers.ts
import { Service, Method, Field } from '@/components/GrpcExplorerApp';

// Common API request helper
export const executeGrpcCall = async (
  endpoint: string,
  service: string, 
  method: string, 
  params = {},
  useTLS: boolean,
  cacheEnabled: boolean
) => {
  try {
    const res = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint,
        service,
        method,
        params,
        useTLS,
        useCache: cacheEnabled
      }),
    });
    
    const data = await res.json();
    if (data.error) {
      console.error(`Failed to execute ${service}.${method}:`, data.error);
      return { error: data.error, data: null };
    }
    
    return { error: null, data: data.response };
  } catch (err) {
    console.error(`Failed to execute ${service}.${method}:`, err);
    return { error: 'Failed to execute request', data: null };
  }
};

// Fetch service methods
export const fetchServiceMethods = async (
  service: Service,
  endpoint: string,
  useTLS: boolean,
  cacheEnabled: boolean
) => {
  try {
    const res = await fetch(
      `/api/service?service=${encodeURIComponent(service.service)}&endpoint=${encodeURIComponent(endpoint)}&useTLS=${useTLS}&useCache=${cacheEnabled}`
    );
    const data = await res.json();
    
    if (data.error) {
      return { error: data.error, methods: null };
    }
    
    return { error: null, methods: data.methods };
  } catch (err) {
    console.error('Failed to fetch service methods:', err);
    return { error: 'Failed to load service methods', methods: null };
  }
};

// Fetch method fields
export const fetchMethodFields = async (
  service: Service,
  method: Method,
  endpoint: string,
  useTLS: boolean,
  cacheEnabled: boolean
) => {
  try {
    const res = await fetch(
      `/api/method?service=${encodeURIComponent(service.service)}&method=${encodeURIComponent(method.name)}&endpoint=${encodeURIComponent(endpoint)}&useTLS=${useTLS}&useCache=${cacheEnabled}`
    );
    const data = await res.json();
    
    if (data.error) {
      return { error: data.error, fields: null };
    }
    
    return { error: null, fields: data.fields };
  } catch (err) {
    console.error('Failed to fetch method fields:', err);
    return { error: 'Failed to load method details', fields: null };
  }
};

// Get example value based on type
export const getExampleValue = (type: string): any => {
  switch (type) {
    case 'string': return "example";
    case 'int32':
    case 'int64':
    case 'uint32':
    case 'uint64': return 0;
    case 'float':
    case 'double': return 0.0;
    case 'bool': return false;
    default: return "";
  }
};

// Get example array value
export const getExampleArrayValue = (type: string): any[] => {
  return [getExampleValue(type)];
};

// Extract domain name from endpoint
export const getEndpointDisplay = (endpoint: string): string => {
  try {
    const parts = endpoint.split(':');
    if (parts.length > 1) {
      return parts[0];
    }
    return endpoint;
  } catch {
    return endpoint;
  }
};