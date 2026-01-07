// Generates REST API paths from gRPC method descriptors
// HTTP annotations (google.api.http) are NOT available via gRPC reflection
// as they're compile-time extensions for gRPC-gateway. We generate paths
// heuristically based on Cosmos SDK conventions which are deterministic.

import { MessageTypeDefinition } from '@/components/ProtobufFormGenerator';
import { HttpRule } from '@/lib/types/grpc';

export interface RestPathResult {
	url: string;
	supported: boolean;
	method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	warning?: string;
}

/**
 * Replace path parameters in HTTP path template with actual values
 * e.g., "/cosmos/bank/v1beta1/balances/{address}" with {address: "cosmos1..."}
 *    -> "/cosmos/bank/v1beta1/balances/cosmos1..."
 */
function substitutePathParams(
	pathTemplate: string,
	params: Record<string, any>
): { path: string; unusedParams: Record<string, any> } {
	let path = pathTemplate;
	const unusedParams: Record<string, any> = { ...params };

	// Find all {param} placeholders and substitute
	const paramRegex = /\{([^}]+)\}/g;
	let match;

	while ((match = paramRegex.exec(pathTemplate)) !== null) {
		const paramName = match[1];
		// Handle nested paths like {pagination.key}
		const paramParts = paramName.split('.');

		let value: any = params;
		let found = true;
		for (const part of paramParts) {
			if (value && typeof value === 'object' && part in value) {
				value = value[part];
			} else {
				found = false;
				break;
			}
		}

		if (found && value !== undefined && value !== null && String(value) !== '') {
			path = path.replace(`{${paramName}}`, encodeURIComponent(String(value)));
			// Remove used param from unused list
			if (paramParts.length === 1) {
				delete unusedParams[paramName];
			}
		}
	}

	return { path, unusedParams };
}

/**
 * Build query string from unused parameters
 */
function buildQueryString(params: Record<string, any>, prefix = ''): string {
	const parts: string[] = [];

	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null || value === '') continue;

		const fullKey = prefix ? `${prefix}.${key}` : key;

		if (typeof value === 'object' && !Array.isArray(value)) {
			// Recurse for nested objects
			const nested = buildQueryString(value, fullKey);
			if (nested) parts.push(nested);
		} else if (Array.isArray(value)) {
			// Handle arrays
			for (const item of value) {
				if (item !== undefined && item !== null && item !== '') {
					parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(item))}`);
				}
			}
		} else {
			parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
		}
	}

	return parts.join('&');
}

/**
 * Generate REST path from Cosmos SDK service/method naming conventions
 * Cosmos SDK follows predictable patterns:
 *   cosmos.bank.v1beta1.Query/Balance -> /cosmos/bank/v1beta1/balance
 *   cosmos.staking.v1beta1.Query/Validators -> /cosmos/staking/v1beta1/validators
 */
function generateCosmosRestPath(
	serviceName: string,
	methodName: string,
	params: Record<string, any>,
	requestTypeDefinition?: MessageTypeDefinition
): RestPathResult {
	// Parse service name: cosmos.bank.v1beta1.Query
	const parts = serviceName.split('.');

	// Check if this looks like a Cosmos SDK service
	if (parts.length < 3) {
		return {
			url: '',
			supported: false,
			method: 'GET',
			warning: 'Service name format not recognized for REST mapping',
		};
	}

	// Extract module path and service type (Query/Msg)
	const serviceType = parts[parts.length - 1]; // Query, Msg, Service, etc.
	const modulePath = parts.slice(0, -1).join('/'); // cosmos/bank/v1beta1

	// Only Query services have GET endpoints; Msg services require POST
	if (serviceType === 'Msg') {
		return {
			url: '',
			supported: false,
			method: 'POST',
			warning: 'Msg services require transaction signing (not available via REST GET)',
		};
	}

	// Convert method name to path segment (camelCase -> snake_case)
	// e.g., Balance -> balance, DelegatorDelegations -> delegator_delegations
	const methodPath = methodName
		.replace(/([A-Z])/g, '_$1')
		.toLowerCase()
		.replace(/^_/, '');

	// Build base path
	let basePath = `/${modulePath}/${methodPath}`;

	// Handle common Cosmos SDK patterns for path parameters
	const pathParams: string[] = [];

	if (requestTypeDefinition && requestTypeDefinition.fields.length > 0) {
		// Common path parameter patterns in Cosmos SDK
		const commonPathParams = [
			'address',
			'validator_addr',
			'delegator_addr',
			'proposal_id',
			'denom',
			'granter',
			'grantee',
			'class_id',
			'id',
			'channel_id',
			'port_id',
			'connection_id',
			'client_id',
		];

		for (const field of requestTypeDefinition.fields) {
			if (commonPathParams.includes(field.name)) {
				pathParams.push(field.name);
			}
		}
	}

	// Add path parameters to URL
	for (const param of pathParams) {
		if (params[param]) {
			basePath += `/${encodeURIComponent(String(params[param]))}`;
		}
	}

	// Build query string from remaining parameters
	const remainingParams = { ...params };
	for (const param of pathParams) {
		delete remainingParams[param];
	}

	const queryString = buildQueryString(remainingParams);
	const fullUrl = queryString ? `${basePath}?${queryString}` : basePath;

	return {
		url: fullUrl,
		supported: true,
		method: 'GET',
	};
}

/**
 * Generate REST URL from HTTP annotation if available
 */
function generateFromHttpRule(
	httpRule: HttpRule,
	params: Record<string, any>,
	baseUrl: string
): RestPathResult {
	let method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET';
	let pathTemplate = '';

	if (httpRule.get) {
		method = 'GET';
		pathTemplate = httpRule.get;
	} else if (httpRule.post) {
		method = 'POST';
		pathTemplate = httpRule.post;
	} else if (httpRule.put) {
		method = 'PUT';
		pathTemplate = httpRule.put;
	} else if (httpRule.delete) {
		method = 'DELETE';
		pathTemplate = httpRule.delete;
	} else if (httpRule.patch) {
		method = 'PATCH';
		pathTemplate = httpRule.patch;
	}

	if (!pathTemplate) {
		return {
			url: '',
			supported: false,
			method: 'GET',
			warning: 'No HTTP path found in annotation',
		};
	}

	const { path, unusedParams } = substitutePathParams(pathTemplate, params);

	// For GET requests, add unused params as query string
	let fullPath = path;
	if (method === 'GET') {
		const queryString = buildQueryString(unusedParams);
		if (queryString) {
			fullPath += `?${queryString}`;
		}
	}

	return {
		url: `${baseUrl}${fullPath}`,
		supported: true,
		method,
	};
}

/**
 * Generate REST API URL for a gRPC method
 * Tries HTTP annotation first, falls back to heuristic generation
 */
export function generateRestUrl(
	serviceName: string,
	methodName: string,
	params: Record<string, any>,
	baseUrl: string,
	requestTypeDefinition?: MessageTypeDefinition,
	httpRule?: HttpRule
): RestPathResult {
	// If we have an HTTP annotation, use it
	if (httpRule) {
		return generateFromHttpRule(httpRule, params, baseUrl);
	}

	// Fall back to heuristic generation based on Cosmos SDK conventions
	const heuristicResult = generateCosmosRestPath(
		serviceName,
		methodName,
		params,
		requestTypeDefinition
	);

	if (heuristicResult.supported) {
		return {
			...heuristicResult,
			url: `${baseUrl}${heuristicResult.url}`,
			warning: 'REST path generated heuristically (may not match actual API)',
		};
	}

	return heuristicResult;
}
