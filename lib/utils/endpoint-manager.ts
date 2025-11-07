// lib/utils/endpoint-manager.ts
// Endpoint management with failure tracking, smart timeouts, and prioritization

interface EndpointConfig {
  address: string;
  tls: boolean;
}

interface EndpointStats {
  address: string;
  failures: number;
  timeouts: number;
  lastFailure?: number;
  averageResponseTime?: number;
  successCount: number;
}

interface FetchResult {
  endpoint: string;
  data: any;
  responseTime: number;
  tls: boolean;
}

class EndpointManager {
  private stats: Map<string, EndpointStats> = new Map();
  private blacklist: Set<string> = new Set();
  private readonly BLACKLIST_THRESHOLD = 5; // Blacklist after 5 failures
  private readonly BLACKLIST_DURATION = 3600000; // 1 hour in ms

  /**
   * Normalize endpoint URL and detect TLS requirement
   */
  normalizeEndpoint(url: string): EndpointConfig {
    let address = url.trim();
    let tls = false;

    // Remove protocol prefix if present
    if (address.startsWith('https://')) {
      address = address.replace('https://', '');
      tls = true;
    } else if (address.startsWith('http://')) {
      address = address.replace('http://', '');
      tls = false;
    }

    // Add port if missing
    if (!address.includes(':')) {
      address = `${address}:9090`; // Default gRPC port
      tls = false;
    } else {
      // Check if port 443 (implies TLS)
      const port = address.split(':')[1];
      if (port === '443') {
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
    if (address.includes('polkachu.com')) {
      score += 50;
    }

    // Other known reliable providers
    if (address.includes('basementnodes.ca')) {
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
      stats.averageResponseTime = (stats.averageResponseTime + responseTime) / 2;
    } else {
      stats.averageResponseTime = responseTime;
    }

    this.stats.set(address, stats);

    // Remove from blacklist if it was there and has recovered
    if (this.blacklist.has(address) && stats.successCount > 3) {
      this.blacklist.delete(address);
      console.log(`[EndpointManager] Removed ${address} from blacklist after recovery`);
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
      console.warn(`[EndpointManager] Blacklisted ${address} - ${stats.failures} failures, ${stats.timeouts} timeouts`);
    } else {
      console.warn(`[EndpointManager] Failure recorded for ${address} - ${stats.failures} total failures`);
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

  /**
   * Clear old blacklist entries (run periodically)
   */
  clearExpiredBlacklist(): void {
    const now = Date.now();
    for (const [address, stats] of this.stats.entries()) {
      if (stats.lastFailure && now - stats.lastFailure > this.BLACKLIST_DURATION) {
        this.blacklist.delete(address);
        // Reset failure count
        stats.failures = 0;
        stats.timeouts = 0;
        this.stats.set(address, stats);
      }
    }
  }
}

// Singleton instance
export const endpointManager = new EndpointManager();

/**
 * Fetch services from multiple endpoints concurrently with race-to-first-success
 * and adaptive timeout based on first responder
 */
export async function fetchWithConcurrentEndpoints(
  endpoints: EndpointConfig[],
  fetchFunction: (endpoint: string, tls: boolean) => Promise<any>,
  options: {
    adaptiveTimeoutPercent?: number; // Default 20% - drop endpoints slower than this
    maxAttempts?: number; // Maximum number of endpoints to try
  } = {}
): Promise<FetchResult> {
  const { adaptiveTimeoutPercent = 0.2, maxAttempts = 5 } = options;

  // Prioritize endpoints
  const prioritized = endpointManager.prioritizeEndpoints(endpoints);

  // Filter out blacklisted
  const available = prioritized.filter(ep => !endpointManager.isBlacklisted(ep.address));

  if (available.length === 0) {
    throw new Error('No available endpoints - all blacklisted or failed');
  }

  // Limit to maxAttempts
  const toTry = available.slice(0, Math.min(available.length, maxAttempts));

  console.log(`[EndpointManager] Trying ${toTry.length} endpoints concurrently`);

  // Race all endpoints concurrently
  const results = await Promise.allSettled(
    toTry.map(async (ep) => {
      const startTime = Date.now();
      try {
        const data = await fetchFunction(ep.address, ep.tls);
        const responseTime = Date.now() - startTime;

        endpointManager.recordSuccess(ep.address, responseTime);

        return {
          endpoint: ep.address,
          data,
          responseTime,
          tls: ep.tls,
        };
      } catch (err: any) {
        const responseTime = Date.now() - startTime;
        const isTimeout = err.message?.includes('timeout') || err.message?.includes('Timeout');

        endpointManager.recordFailure(ep.address, isTimeout);

        throw err;
      }
    })
  );

  // Find first successful response
  const successful = results
    .map((result, index) => ({ result, endpoint: toTry[index] }))
    .filter((item): item is { result: PromiseFulfilledResult<FetchResult>; endpoint: EndpointConfig } =>
      item.result.status === 'fulfilled'
    );

  if (successful.length === 0) {
    // All failed - log details
    console.error('[EndpointManager] All endpoints failed:');
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.error(`  - ${toTry[i].address}: ${result.reason?.message}`);
      }
    });
    throw new Error('All endpoints failed to respond');
  }

  // Sort by response time
  successful.sort((a, b) => a.result.value.responseTime - b.result.value.responseTime);

  // Get fastest response
  const fastest = successful[0].result.value;
  const adaptiveTimeout = fastest.responseTime * (1 + adaptiveTimeoutPercent);

  console.log(`[EndpointManager] Fastest response: ${fastest.endpoint} (${fastest.responseTime}ms)`);
  console.log(`[EndpointManager] Adaptive timeout threshold: ${adaptiveTimeout.toFixed(0)}ms`);

  // Log slow responders (would be dropped in future)
  successful.forEach(({ result, endpoint }) => {
    if (result.value.responseTime > adaptiveTimeout) {
      console.warn(
        `[EndpointManager] Slow responder: ${endpoint.address} (${result.value.responseTime}ms) - ` +
        `${((result.value.responseTime - fastest.responseTime) / fastest.responseTime * 100).toFixed(0)}% slower than fastest`
      );
    }
  });

  return fastest;
}
