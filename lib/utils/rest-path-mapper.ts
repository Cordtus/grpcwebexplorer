// Generates REST API paths from gRPC method descriptors.
// The google.api.http annotation is recovered from the descriptor options (see
// descriptor-parser), so paths match the real gRPC-gateway routes. Methods with
// no annotation report that no REST mapping is known.

import type { HttpRule } from "@/lib/types/grpc";

export interface RestPathResult {
	url: string;
	supported: boolean;
	method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
	warning?: string;
	/** Params consumed by the path (excluded from query string and request body). */
	usedParams?: string[];
}

// Replace path parameters in an HTTP path template with actual values.
// e.g. "/cosmos/bank/v1beta1/balances/{address}" with {address: "cosmos1..."}
//    -> "/cosmos/bank/v1beta1/balances/cosmos1..."
function substitutePathParams(
	pathTemplate: string,
	params: Record<string, any>,
): { path: string; usedParams: Set<string> } {
	const usedParams = new Set<string>();
	let path = pathTemplate;

	// Find all {param} or {param=**} patterns in the path
	const paramPattern = /\{([^}=]+)(=[^}]*)?\}/g;

	for (
		let match = paramPattern.exec(pathTemplate);
		match !== null;
		match = paramPattern.exec(pathTemplate)
	) {
		const paramName = match[1];
		const fullMatch = match[0];

		// Try to find value - check both exact name and snake_case variants
		let value = params[paramName];
		if (value === undefined) {
			// Try camelCase to snake_case conversion
			const snakeName = paramName.replace(/([A-Z])/g, "_$1").toLowerCase();
			value = params[snakeName];
		}
		if (value === undefined) {
			// Try snake_case to camelCase conversion
			const camelName = paramName.replace(/_([a-z])/g, (_, c) =>
				c.toUpperCase(),
			);
			value = params[camelName];
		}

		if (value !== undefined && value !== "") {
			usedParams.add(paramName);
			// URL encode the value (important for IBC denoms, factory tokens)
			const encodedValue = encodeURIComponent(String(value));
			path = path.replace(fullMatch, encodedValue);
		}
		// Leave placeholder if no value provided - shows user what's needed
	}

	return { path, usedParams };
}

// Build query string from remaining parameters not used in the path
function buildQueryString(
	params: Record<string, any>,
	usedParams: Set<string>,
): string {
	const parts: string[] = [];

	for (const [key, value] of Object.entries(params)) {
		// Skip params already used in path
		if (usedParams.has(key)) continue;

		// Handle pagination object specially
		if (key === "pagination" && typeof value === "object" && value !== null) {
			for (const [pKey, pVal] of Object.entries(value)) {
				if (pVal !== undefined && pVal !== "" && pVal !== null) {
					parts.push(`pagination.${pKey}=${encodeURIComponent(String(pVal))}`);
				}
			}
			continue;
		}

		// Skip undefined/empty values
		if (value === undefined || value === "" || value === null) continue;

		// Handle arrays (repeated fields)
		if (Array.isArray(value)) {
			for (const v of value) {
				if (v !== undefined && v !== "") {
					parts.push(`${key}=${encodeURIComponent(String(v))}`);
				}
			}
			continue;
		}

		// Handle nested objects
		if (typeof value === "object") continue;

		parts.push(`${key}=${encodeURIComponent(String(value))}`);
	}

	return parts.length > 0 ? `?${parts.join("&")}` : "";
}

// Generate a REST URL from a real google.api.http annotation
function generateFromHttpRule(
	httpRule: HttpRule,
	params: Record<string, any>,
	baseUrl: string,
): RestPathResult {
	let httpMethod: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" = "GET";
	let pathTemplate = "";

	if (httpRule.get) {
		httpMethod = "GET";
		pathTemplate = httpRule.get;
	} else if (httpRule.post) {
		httpMethod = "POST";
		pathTemplate = httpRule.post;
	} else if (httpRule.put) {
		httpMethod = "PUT";
		pathTemplate = httpRule.put;
	} else if (httpRule.delete) {
		httpMethod = "DELETE";
		pathTemplate = httpRule.delete;
	} else if (httpRule.patch) {
		httpMethod = "PATCH";
		pathTemplate = httpRule.patch;
	}

	if (!pathTemplate) {
		return {
			url: "",
			supported: false,
			method: "GET",
			warning: "HTTP annotation has no path defined",
		};
	}

	const { path, usedParams } = substitutePathParams(pathTemplate, params);
	const queryString =
		httpMethod === "GET" ? buildQueryString(params, usedParams) : "";

	return {
		url: baseUrl + path + queryString,
		supported: true,
		method: httpMethod,
		usedParams: Array.from(usedParams),
	};
}

/** Generate the REST URL/method for a gRPC method, if a REST mapping is known. */
export function generateRestUrl(
	serviceFullName: string,
	params: Record<string, any>,
	baseUrl: string,
	httpRule?: HttpRule,
): RestPathResult {
	// Prefer the real google.api.http annotation recovered from the descriptor.
	if (httpRule) {
		return generateFromHttpRule(httpRule, params, baseUrl);
	}

	// Msg services are transactions: POST only, and require signing.
	if (serviceFullName.endsWith(".Msg")) {
		return {
			url: "",
			supported: false,
			method: "POST",
			warning: "Transaction messages use POST and require signing",
		};
	}

	return {
		url: "",
		supported: false,
		method: "GET",
		warning: "No REST annotation for this method",
	};
}
