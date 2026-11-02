import type { EndpointConfig } from "@/lib/types/grpc";

/** Detect TLS from explicit protocol prefixes or common gRPC ports. */
export function detectTlsFromAddress(address: string): boolean {
	const normalized = address.toLowerCase().trim();

	if (normalized.startsWith("https://") || normalized.startsWith("grpcs://")) {
		return true;
	}
	if (normalized.startsWith("http://") || normalized.startsWith("grpc://")) {
		return false;
	}

	const portMatch = normalized.match(/:(\d+)$/);
	if (portMatch) {
		const port = portMatch[1];
		if (port === "443" || port === "9091") return true;
		if (port === "80" || port === "9090") return false;
	}

	return true;
}

/** Strip protocol prefixes and add the default TLS port when missing. */
export function normalizeAddress(address: string): string {
	let normalized = address.trim();

	if (normalized.startsWith("https://")) {
		normalized = normalized.replace("https://", "");
	} else if (normalized.startsWith("http://")) {
		normalized = normalized.replace("http://", "");
	} else if (normalized.startsWith("grpcs://")) {
		normalized = normalized.replace("grpcs://", "");
	} else if (normalized.startsWith("grpc://")) {
		normalized = normalized.replace("grpc://", "");
	}

	if (!normalized.includes(":")) {
		normalized = `${normalized}:443`;
	}

	return normalized;
}

/** Build endpoint configs from chain-registry-style gRPC entries. */
export function createEndpointConfigs(
	grpcEndpoints: Array<{ address: string; provider?: string }>,
): EndpointConfig[] {
	return grpcEndpoints.map((endpoint) => {
		const config: EndpointConfig = {
			address: normalizeAddress(endpoint.address),
			tlsEnabled: detectTlsFromAddress(endpoint.address),
			selected: true,
		};
		if (endpoint.provider) config.provider = endpoint.provider;
		return config;
	});
}

/** Convert the legacy `endpoints: string[]` shape into EndpointConfig[]. */
export function normalizeEndpointsToConfigs(
	primaryEndpoint: string,
	fallbackEndpoints: string[] = [],
	primaryTls: boolean = true,
): EndpointConfig[] {
	return [
		{
			address: primaryEndpoint,
			tlsEnabled: primaryTls,
			selected: true,
		},
		...fallbackEndpoints.map((endpoint) => ({
			address: endpoint,
			tlsEnabled: detectTlsFromAddress(endpoint),
			selected: true,
		})),
	];
}
