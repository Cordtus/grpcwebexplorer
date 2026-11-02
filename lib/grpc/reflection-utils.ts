// lib/grpc/reflection-utils.ts
// Utility functions for gRPC reflection matching the old API from utils/grpcReflection.ts

import type { GrpcService } from "@/lib/types/grpc";
import { errorMessage } from "@/lib/utils";
import { ReflectionClient } from "./reflection-client";

// Re-export for API routes (e.g. the services route).
export type { GrpcService } from "@/lib/types/grpc";

/**
 * Fetch all services and their methods using gRPC reflection
 * Drop-in replacement for utils/grpcReflection.ts fetchServicesViaReflection
 *
 * @param options - Reflection options (endpoint, tls, timeout)
 * @returns Array of services with full type definitions
 */
export async function fetchServicesViaReflection(options: {
	endpoint: string;
	tls: boolean;
	timeout?: number;
	additionalEndpoints?: Array<{ address: string; tls: boolean }>;
}): Promise<GrpcService[]> {
	const client = new ReflectionClient({
		endpoint: options.endpoint,
		tls: options.tls,
		timeout: options.timeout || 10000,
		additionalEndpoints: options.additionalEndpoints || [],
	});

	try {
		await client.initialize();
		return client
			.getServices()
			.map((service) => ({ ...service, descriptorStatus: "loaded" as const }));
	} finally {
		client.close();
	}
}

/**
 * Fetch services using optimized Cosmos v2alpha1 reflection when available,
 * with fallback to standard gRPC reflection
 *
 * This method tries to use cosmos.base.reflection.v2alpha1 services first,
 * which is more efficient for Cosmos chains. Falls back to standard reflection
 * if v2alpha1 is not available.
 *
 * v2alpha1 reports query services only, with names and methods but no field
 * definitions. Those stay pending and load on demand (and are cached
 * client-side). Services v2alpha1 omits (tx/Msg/reflection) are discovered via
 * one standard name listing and loaded individually, so a refresh does not
 * re-enumerate every service through standard reflection.
 *
 * @param options - Reflection options (endpoint, tls, timeout)
 * @returns Array of services, with pending descriptors where applicable
 */
export async function fetchServicesWithCosmosOptimization(options: {
	endpoint: string;
	tls: boolean;
	timeout?: number;
	additionalEndpoints?: Array<{ address: string; tls: boolean }>;
}): Promise<GrpcService[]> {
	const client = new ReflectionClient({
		endpoint: options.endpoint,
		tls: options.tls,
		timeout: options.timeout || 10000,
		additionalEndpoints: options.additionalEndpoints || [],
	});

	try {
		console.log("[Reflection] Attempting v2alpha1 reflection...");

		// v2alpha1 only reports query services. If it fails, fall back to the
		// standard full reflection path below.
		const queryServices = await client.getQueryServicesViaV2Alpha1();
		if (queryServices.length > 0) {
			console.log(
				`[Reflection] Got ${queryServices.length} query services via v2alpha1`,
			);

			// v2alpha1 is not a complete service list: tx/Msg/reflection services
			// only appear in standard reflection. Union those in with one cheap
			// name listing, then load just the missing services instead of every
			// service on the chain.
			const known = new Set(queryServices.map((service) => service.fullName));
			let allNames: string[] = [];
			try {
				allNames = await client.listServiceNames();
			} catch (err: unknown) {
				console.warn(
					`[Reflection] Could not list services for v2alpha1 union: ${errorMessage(err)}`,
				);
			}

			const missing = allNames.filter(
				(name) => !known.has(name) && !name.includes("ServerReflection"),
			);
			for (const name of missing) {
				try {
					await client.initializeForMethod(name);
				} catch (err: unknown) {
					console.warn(
						`[Reflection] Could not load standard-only service ${name}: ${errorMessage(err)}`,
					);
				}
			}
			const loaded = new Map(
				client.getServices().map((service) => [service.fullName, service]),
			);
			const extraServices = missing.flatMap((name) => {
				const service = loaded.get(name);
				return service
					? [{ ...service, descriptorStatus: "loaded" as const }]
					: [];
			});

			const pendingServices = queryServices.map((service) => ({
				...service,
				descriptorStatus: "pending" as const,
			}));
			console.log(
				`[Reflection] v2alpha1 fast path: ${pendingServices.length} pending query services, ${extraServices.length} standard-only services loaded (${missing.length} missing)`,
			);
			return [...pendingServices, ...extraServices];
		}

		// Fallback to standard reflection if v2alpha1 not available
		console.log(
			"[Reflection] v2alpha1 not available, using standard reflection...",
		);
		await client.initialize();
		const standardServices = client.getServices().map((service) => ({
			...service,
			descriptorStatus: "loaded" as const,
		}));
		console.log(
			`[Reflection] Got ${standardServices.length} services via standard reflection`,
		);
		return standardServices;
	} catch (err: unknown) {
		console.error(
			"[Reflection] Error in fetchServicesWithCosmosOptimization:",
			errorMessage(err),
		);
		if (err instanceof Error)
			console.error("[Reflection] Stack trace:", err.stack);
		throw err;
	} finally {
		client.close();
	}
}

/**
 * Lazy-load field definitions for a specific service
 * Used when user expands a service or executes a method
 * Throws an error if loading fails so callers can handle appropriately
 */
export async function loadServiceDescriptor(
	options: { endpoint: string; tls: boolean; timeout?: number },
	serviceName: string,
): Promise<GrpcService | null> {
	if (!options?.endpoint || typeof options.tls !== "boolean") {
		throw new Error("Invalid options: endpoint and tls are required");
	}
	if (!serviceName) {
		throw new Error("Service name is required");
	}

	console.log(
		`[Reflection] Loading descriptor for ${serviceName} from ${options.endpoint}...`,
	);

	// Retry with backoff for rate-limiting resilience
	const maxAttempts = 3;
	const retryDelays = [0, 1000, 2000];
	let lastError: Error | null = null;

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		if (attempt > 0) {
			console.log(
				`[Reflection] Retry attempt ${attempt + 1}/${maxAttempts} for ${serviceName} after ${retryDelays[attempt]}ms...`,
			);
			await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
		}

		const client = new ReflectionClient({
			endpoint: options.endpoint,
			tls: options.tls,
			timeout: options.timeout || 10000,
		});

		try {
			await client.initializeForMethod(serviceName);
			const services = client.getServices();
			const service = services.find((s) => s.fullName === serviceName);

			if (service) {
				console.log(
					`[Reflection] Loaded descriptor for ${serviceName} (${service.methods.length} methods)`,
				);
				return { ...service, descriptorStatus: "loaded" };
			}

			console.warn(
				`[Reflection] Service ${serviceName} not found after initialization. Available services:`,
				services.map((s) => s.fullName).join(", "),
			);
			return null;
		} catch (err) {
			lastError = err instanceof Error ? err : new Error(String(err));
			console.warn(
				`[Reflection] Attempt ${attempt + 1} failed for ${serviceName}: ${lastError.message}`,
			);
		} finally {
			client.close();
		}
	}

	console.error(
		`[Reflection] All ${maxAttempts} attempts failed for ${serviceName}`,
	);
	throw new Error(
		`Failed to load descriptor for ${serviceName} after ${maxAttempts} attempts: ${lastError?.message}`,
	);
}
