// Generates REST API paths from gRPC method descriptors
// Uses google.api.http annotations from proto files when available,
// falls back to heuristic generation based on Cosmos SDK conventions

import { MessageTypeDefinition } from '@/components/ProtobufFormGenerator';
import { HttpRule } from '@/lib/types/grpc';

export interface RestPathResult {
  url: string;
  supported: boolean;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  warning?: string;
}

// Replace path parameters in HTTP path template with actual values
// e.g., "/cosmos/bank/v1beta1/balances/{address}" with {address: "cosmos1..."}
//    -> "/cosmos/bank/v1beta1/balances/cosmos1..."
function substitutePathParams(
  pathTemplate: string,
  params: Record<string, any>,
  fields: MessageTypeDefinition['fields']
): { path: string; usedParams: Set<string> } {
  const usedParams = new Set<string>();
  let path = pathTemplate;

  // Find all {param} or {param=**} patterns in the path
  const paramPattern = /\{([^}=]+)(=[^}]*)?\}/g;
  let match;

  while ((match = paramPattern.exec(pathTemplate)) !== null) {
    const paramName = match[1];
    const fullMatch = match[0];

    // Try to find value - check both exact name and snake_case variants
    let value = params[paramName];
    if (value === undefined) {
      // Try camelCase to snake_case conversion
      const snakeName = paramName.replace(/([A-Z])/g, '_$1').toLowerCase();
      value = params[snakeName];
    }
    if (value === undefined) {
      // Try snake_case to camelCase conversion
      const camelName = paramName.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      value = params[camelName];
    }

    if (value !== undefined && value !== '') {
      usedParams.add(paramName);
      // URL encode the value (important for IBC denoms, factory tokens)
      const encodedValue = encodeURIComponent(String(value));
      path = path.replace(fullMatch, encodedValue);
    }
    // Leave placeholder if no value provided - shows user what's needed
  }

  return { path, usedParams };
}

// Build query string from remaining parameters not used in path
function buildQueryString(
  params: Record<string, any>,
  usedParams: Set<string>,
  fields: MessageTypeDefinition['fields']
): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    // Skip params already used in path
    if (usedParams.has(key)) continue;

    // Handle pagination object specially
    if (key === 'pagination' && typeof value === 'object' && value !== null) {
      for (const [pKey, pVal] of Object.entries(value)) {
        if (pVal !== undefined && pVal !== '' && pVal !== null) {
          parts.push(`pagination.${pKey}=${encodeURIComponent(String(pVal))}`);
        }
      }
      continue;
    }

    // Skip undefined/empty values
    if (value === undefined || value === '' || value === null) continue;

    // Handle arrays (repeated fields)
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v !== undefined && v !== '') {
          parts.push(`${key}=${encodeURIComponent(String(v))}`);
        }
      }
      continue;
    }

    // Handle nested objects
    if (typeof value === 'object') continue;

    parts.push(`${key}=${encodeURIComponent(String(value))}`);
  }

  return parts.length > 0 ? '?' + parts.join('&') : '';
}

// Generate REST URL using HTTP annotation from proto
function generateFromHttpRule(
  httpRule: HttpRule,
  params: Record<string, any>,
  baseUrl: string,
  fields: MessageTypeDefinition['fields']
): RestPathResult {
  // Determine HTTP method and path from the rule
  let httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET';
  let pathTemplate = '';

  if (httpRule.get) {
    httpMethod = 'GET';
    pathTemplate = httpRule.get;
  } else if (httpRule.post) {
    httpMethod = 'POST';
    pathTemplate = httpRule.post;
  } else if (httpRule.put) {
    httpMethod = 'PUT';
    pathTemplate = httpRule.put;
  } else if (httpRule.delete) {
    httpMethod = 'DELETE';
    pathTemplate = httpRule.delete;
  } else if (httpRule.patch) {
    httpMethod = 'PATCH';
    pathTemplate = httpRule.patch;
  }

  if (!pathTemplate) {
    return {
      url: '',
      supported: false,
      method: 'GET',
      warning: 'HTTP annotation has no path defined'
    };
  }

  // Substitute path parameters
  const { path, usedParams } = substitutePathParams(pathTemplate, params, fields);

  // Build query string from remaining params (for GET requests)
  const queryString = httpMethod === 'GET' ? buildQueryString(params, usedParams, fields) : '';

  return {
    url: baseUrl + path + queryString,
    supported: true,
    method: httpMethod
  };
}

// Fallback: Generate path heuristically based on Cosmos SDK conventions
function generateHeuristic(
  serviceFullName: string,
  methodName: string,
  params: Record<string, any>,
  baseUrl: string,
  fields: MessageTypeDefinition['fields']
): RestPathResult {
  // Msg services (transactions) typically don't have REST GET endpoints
  if (serviceFullName.endsWith('.Msg')) {
    return {
      url: '',
      supported: false,
      method: 'POST',
      warning: 'Transaction messages use POST and require signing'
    };
  }

  // Convert service name to base path
  // e.g., "cosmos.bank.v1beta1.Query" -> "/cosmos/bank/v1beta1"
  const parts = serviceFullName.split('.');
  const lastPart = parts[parts.length - 1];
  if (lastPart === 'Query' || lastPart === 'Service' || lastPart === 'Msg') {
    parts.pop();
  }
  const basePath = '/' + parts.join('/').toLowerCase();

  // Convert method name to path segment
  // e.g., "AllBalances" -> "balances"
  let methodSegment = methodName
    .replace(/^(Get|Query|List|All)/, '')
    .replace(/^By/, '');
  if (!methodSegment) methodSegment = methodName;
  methodSegment = methodSegment
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');

  // Build path with common parameter patterns
  let path = basePath + '/' + methodSegment;
  const usedParams = new Set<string>();

  // Common path parameter patterns
  const pathParamOrder = [
    'address', 'validator_addr', 'validator_address', 'delegator_addr', 'delegator_address',
    'proposal_id', 'client_id', 'connection_id', 'channel_id', 'port_id',
    'denom', 'hash', 'height', 'name', 'id', 'code_id', 'granter', 'grantee'
  ];

  for (const param of pathParamOrder) {
    const value = params[param];
    if (value !== undefined && value !== '') {
      path += '/' + encodeURIComponent(String(value));
      usedParams.add(param);
    }
  }

  // Build query string
  const queryString = buildQueryString(params, usedParams, fields);

  return {
    url: baseUrl + path + queryString,
    supported: true,
    method: 'GET',
    warning: 'Path generated heuristically - verify endpoint exists'
  };
}

// Main function to generate REST URL from gRPC method info
export function generateRestUrl(
  serviceFullName: string,
  methodName: string,
  params: Record<string, any>,
  baseUrl: string,
  requestTypeDefinition?: MessageTypeDefinition,
  httpRule?: HttpRule
): RestPathResult {
  const fields = requestTypeDefinition?.fields || [];

  // If we have an HTTP annotation from the proto, use it
  if (httpRule) {
    return generateFromHttpRule(httpRule, params, baseUrl, fields);
  }

  // Fall back to heuristic generation
  return generateHeuristic(serviceFullName, methodName, params, baseUrl, fields);
}

// Check if a method likely has REST support
export function hasRestMapping(serviceFullName: string, _methodName: string): boolean {
  // Query and Service endpoints typically have REST mappings
  // Msg endpoints don't (they're POST/transactions)
  return serviceFullName.endsWith('.Query') ||
         serviceFullName.endsWith('.Service');
}
