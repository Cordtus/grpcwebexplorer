// lib/utils/endpoint-manager.ts
// Endpoint management with failure tracking, smart timeouts, and prioritization

import { isLavenderFiveEndpoint } from "@/lib/utils/endpoint-priority";

interface EndpointConfig {
	address: string;
	tls: boolean;
	provider?: string;
}

interface EndpointStats {
	address: string;
	failures: number;
	timeouts: number;
	lastFailure?: number;
	averageResponseTime?: number;
	successCount: number;
}

class EndpointManager {
	private stats: Map<string, EndpointStats> = new Map();
	private blacklist: Set<string> = new Set();
	private readonly BLACKLIST_THRESHOLD = 5; // Blacklist after 5 failures

	/**
	 * Normalize endpoint URL and detect TLS requirement
	 */
	normalizeEndpoint(url: string): EndpointConfig {
		let address = url.trim();
		let tls = false;
		let hadHttpsPrefix = false;

		// Remove protocol prefix if present and remember if it was HTTPS
		if (address.startsWith("https://")) {
			address = address.replace("https://", "");
			tls = true;
			hadHttpsPrefix = true;
		} else if (address.startsWith("http://")) {
			address = address.replace("http://", "");
			tls = false;
		} else if (address.startsWith("grpc://")) {
			address = address.replace("grpc://", "");
			tls = false;
		} else if (address.startsWith("grpcs://")) {
			address = address.replace("grpcs://", "");
			tls = true;
			hadHttpsPrefix = true;
		}

		// Add port if missing
		if (!address.includes(":")) {
			// If URL had https:// prefix, use port 443, otherwise use 9090
			if (hadHttpsPrefix) {
				address = `${address}:443`;
				tls = true;
			} else {
				address = `${address}:9090`; // Default gRPC port
			}
		} else {
			// Check if port 443 or 9091 (common TLS ports for gRPC)
			const port = address.split(":")[1];
			if (port === "443" || port === "9091") {
				tls = true;
			}
		}

		return { address, tls };
	}

	/**
	 * Prioritize endpoints with implicit optimization for known reliable providers
	 */
	prioritizeEndpoints(endpoints: EndpointConfig[]): EndpointConfig[] {
		return endpoints.sort((a, b) => {
			const aLavender = isLavenderFiveEndpoint(a.address, a.provider);
			const bLavender = isLavenderFiveEndpoint(b.address, b.provider);
			if (aLavender !== bLavender) return aLavender ? 1 : -1;

			const aStats = this.stats.get(a.address);
			const bStats = this.stats.get(b.address);

			// Prioritize endpoints with good track record
			const aScore = this.calculateScore(a.address, aStats);
			const bScore = this.calculateScore(b.address, bStats);

			return bScore - aScore; // Higher score first
		});
	}

	/**
	 * Calculate endpoint priority score (higher is better)
	 */
	private calculateScore(address: string, stats?: EndpointStats): number {
		let score = 100;

		// Penalize for failures
		if (stats) {
			score -= stats.failures * 10;
			score -= stats.timeouts * 5;

			// Bonus for successes
			score += stats.successCount * 2;

			// Bonus for fast response times
			if (stats.averageResponseTime && stats.averageResponseTime < 500) {
				score += 20;
			}
		}

		// Implicit optimization: Polkachu endpoints get priority
		// (non-rate-limited, reliable, but we don't explicitly advertise this)
		if (address.includes("polkachu.com")) {
			score += 50;
		}

		// Other known reliable providers
		if (address.includes("basementnodes.ca")) {
			score += 30;
		}

		// Blacklisted endpoints get very low score
		if (this.blacklist.has(address)) {
			score = -1000;
		}

		return score;
	}

	/**
	 * Record success for an endpoint
	 */
	recordSuccess(address: string, responseTime: number): void {
		const stats = this.stats.get(address) || {
			address,
			failures: 0,
			timeouts: 0,
			successCount: 0,
		};

		stats.successCount++;

		// Update average response time
		if (stats.averageResponseTime) {
			stats.averageResponseTime =
				(stats.averageResponseTime + responseTime) / 2;
		} else {
			stats.averageResponseTime = responseTime;
		}

		this.stats.set(address, stats);

		// Remove from blacklist if it was there and has recovered
		if (this.blacklist.has(address) && stats.successCount > 3) {
			this.blacklist.delete(address);
			console.log(
				`[EndpointManager] Removed ${address} from blacklist after recovery`,
			);
		}
	}

	/**
	 * Record failure for an endpoint
	 */
	recordFailure(address: string, isTimeout: boolean = false): void {
		const stats = this.stats.get(address) || {
			address,
			failures: 0,
			timeouts: 0,
			successCount: 0,
		};

		stats.failures++;
		if (isTimeout) {
			stats.timeouts++;
		}
		stats.lastFailure = Date.now();

		this.stats.set(address, stats);

		// Blacklist if too many failures
		if (stats.failures >= this.BLACKLIST_THRESHOLD) {
			this.blacklist.add(address);
			console.warn(
				`[EndpointManager] Blacklisted ${address} - ${stats.failures} failures, ${stats.timeouts} timeouts`,
			);
		} else {
			console.warn(
				`[EndpointManager] Failure recorded for ${address} - ${stats.failures} total failures`,
			);
		}
	}

	/**
	 * Check if endpoint is blacklisted
	 */
	isBlacklisted(address: string): boolean {
		return this.blacklist.has(address);
	}

	/**
	 * Get stats for logging/debugging
	 */
	getStats(): Map<string, EndpointStats> {
		return new Map(this.stats);
	}

	/**
	 * Get blacklisted endpoints
	 */
	getBlacklist(): string[] {
		return Array.from(this.blacklist);
	}
}

// Singleton instance
export const endpointManager = new EndpointManager();
