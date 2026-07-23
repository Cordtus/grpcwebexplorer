import { NextResponse } from 'next/server';
import dns from 'dns';
import { promisify } from 'util';
import { ReflectionClient } from '@/lib/grpc/reflection-client';
import { errorMessage } from '@/lib/utils';
import { classifyReflectionFailure } from '@/lib/utils/reflection-probe';

const dnsLookup = promisify(dns.lookup);
const MAX_QUALIFIED_ENDPOINTS = 30;

export const runtime = 'nodejs';
export const maxDuration = 45;

interface EndpointValidation {
	address: string;
	reachable: boolean;
	error?: string;
	reflectionStatus?: 'ready' | 'incompatible' | 'transient';
}

interface EndpointInput {
	address: string;
	tlsEnabled?: boolean;
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
async function validateEndpoint(input: EndpointInput, timeoutMs: number = 1000): Promise<EndpointValidation> {
	const { address } = input;
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

		const client = new ReflectionClient({
			endpoint: address,
			tls: input.tlsEnabled ?? address.endsWith(':443'),
			timeout: 3000,
		});
		try {
			await client.probeReflection();
			return { address, reachable: true, reflectionStatus: 'ready' };
		} catch (error) {
			const message = errorMessage(error);
			return {
				address,
				reachable: false,
				error: message,
				reflectionStatus: classifyReflectionFailure(message),
			};
		} finally {
			client.close();
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Unknown error';
		return { address, reachable: false, error: errorMsg, reflectionStatus: 'transient' };
	}
}

/**
 * POST /api/grpc/validate-endpoints
 * Checks DNS first, then performs a bounded reflection handshake. DNS success
 * alone is not enough to select a provider for Cosmos execution.
 *
 * Request body: { endpoints: string[] }
 * Response: { results: EndpointValidation[] }
 */
export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { endpoints } = body as { endpoints: Array<string | EndpointInput> };

		if (!endpoints || !Array.isArray(endpoints)) {
			return NextResponse.json(
				{ error: 'Missing or invalid endpoints array' },
				{ status: 400 }
			);
		}

		const normalized = endpoints.map((endpoint) =>
			typeof endpoint === 'string' ? { address: endpoint } : endpoint
		).filter((endpoint): endpoint is EndpointInput => typeof endpoint?.address === 'string');
		const endpointsToQualify = normalized.slice(0, MAX_QUALIFIED_ENDPOINTS);
		const skippedEndpoints = normalized.slice(MAX_QUALIFIED_ENDPOINTS);
		const results: EndpointValidation[] = [];
		for (let index = 0; index < endpointsToQualify.length; index += 3) {
			results.push(...await Promise.all(endpointsToQualify.slice(index, index + 3).map((endpoint) => validateEndpoint(endpoint, 1000))));
		}
		results.push(...skippedEndpoints.map(({ address }) => ({
			address,
			reachable: false,
			reflectionStatus: 'transient' as const,
			error: `Qualification skipped after ${MAX_QUALIFIED_ENDPOINTS} endpoints; reselect manually to try this provider.`,
		})));

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
