import { NextResponse } from 'next/server';
import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

interface EndpointValidation {
	address: string;
	reachable: boolean;
	error?: string;
}

/**
 * Extracts hostname from an endpoint address
 * Handles formats like: host:port, https://host:port, host
 */
function extractHostname(address: string): string {
	let normalized = address.trim();

	// Remove protocol prefixes
	normalized = normalized
		.replace(/^https?:\/\//, '')
		.replace(/^grpcs?:\/\//, '');

	// Extract hostname (before port)
	const hostPart = normalized.split(':')[0];
	return hostPart;
}

/**
 * Validates a single endpoint by attempting DNS resolution
 * Uses a fast 1 second timeout to quickly identify unreachable endpoints
 */
async function validateEndpoint(address: string, timeoutMs: number = 1000): Promise<EndpointValidation> {
	const hostname = extractHostname(address);

	if (!hostname) {
		return { address, reachable: false, error: 'Invalid hostname' };
	}

	try {
		// Create a promise that rejects after timeout
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error('DNS lookup timeout')), timeoutMs);
		});

		// Race between DNS lookup and timeout
		await Promise.race([
			dnsLookup(hostname),
			timeoutPromise
		]);

		return { address, reachable: true };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Unknown error';
		return { address, reachable: false, error: errorMsg };
	}
}

/**
 * POST /api/grpc/validate-endpoints
 * Validates multiple endpoints in parallel by checking DNS resolution
 *
 * Request body: { endpoints: string[] }
 * Response: { results: EndpointValidation[] }
 */
export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { endpoints } = body as { endpoints: string[] };

		if (!endpoints || !Array.isArray(endpoints)) {
			return NextResponse.json(
				{ error: 'Missing or invalid endpoints array' },
				{ status: 400 }
			);
		}

		// Validate all endpoints concurrently with 1s timeout each (fast rejection)
		const results = await Promise.all(
			endpoints.map(ep => validateEndpoint(ep, 1000))
		);

		const reachableCount = results.filter(r => r.reachable).length;
		console.log(`[ValidateEndpoints] ${reachableCount}/${results.length} endpoints reachable`);

		return NextResponse.json({ results });
	} catch (error) {
		console.error('[ValidateEndpoints] Error:', error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Validation failed' },
			{ status: 500 }
		);
	}
}
