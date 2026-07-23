import type { EndpointExecutionHealth, GrpcNetwork } from '@/lib/types/grpc';
import { errorMessage } from '@/lib/utils';

export type ExecutionEndpoint = {
  address: string;
  tlsEnabled: boolean;
};

export type EndpointExecutionFailure = {
  endpoint: string;
  error: string;
};

export class EndpointFailoverError extends Error {
  constructor(public readonly failures: EndpointExecutionFailure[], deadlineExhausted: boolean = false) {
    super(`${deadlineExhausted ? 'gRPC endpoint execution deadline exhausted' : 'All selected gRPC endpoints failed'}: ${failures.map(({ endpoint, error }) => `${endpoint}: ${error}`).join('; ')}`);
    this.name = 'EndpointFailoverError';
  }
}

export const INCOMPATIBLE_ENDPOINT_COOLDOWN_MS = 60 * 60 * 1000;
export const TRANSIENT_ENDPOINT_COOLDOWN_MS = 60 * 1000;

function isEligible(address: string, health: Record<string, EndpointExecutionHealth> | undefined, now: number): boolean {
  return !health?.[address]?.retryAfter || health[address].retryAfter <= now;
}

/**
 * Generic gRPC sources deliberately retain their single configured endpoint.
 * Cosmos sources rotate selected endpoints, then retain the rest as failover
 * candidates so networks with mixed SDK/provider availability stay usable.
 */
export function getExecutionEndpoints(network: GrpcNetwork, startIndex: number, now: number = Date.now()): ExecutionEndpoint[] {
  if (network.mode !== 'cosmos') {
    return [{ address: network.endpoint, tlsEnabled: network.tlsEnabled }];
  }

  const selected = network.endpointConfigs?.filter((endpoint) => endpoint.selected) ?? [];
  if (selected.length === 0) {
    return [{ address: network.endpoint, tlsEnabled: network.tlsEnabled }];
  }

  const normalizedStart = ((startIndex % selected.length) + selected.length) % selected.length;
  const rotated = [...selected.slice(normalizedStart), ...selected.slice(0, normalizedStart)].map(
    ({ address, tlsEnabled }) => ({ address, tlsEnabled })
  );
  const candidates = rotated.some((endpoint) => endpoint.address === network.endpoint)
    ? rotated
    : [...rotated, { address: network.endpoint, tlsEnabled: network.tlsEnabled }];
  const eligible = candidates.filter((endpoint) => isEligible(endpoint.address, network.endpointHealth, now));
  const usable = eligible.length > 0 ? eligible : candidates;

  return usable;
}

export type FailoverOptions = {
  deadlineAt?: number;
  now?: () => number;
  shouldFailover?: (error: unknown, endpoint: ExecutionEndpoint) => boolean;
};

export async function executeWithEndpointFailover<T>(
  endpoints: ExecutionEndpoint[],
  execute: (endpoint: ExecutionEndpoint) => Promise<T>,
  options: FailoverOptions = {}
): Promise<{ value: T; endpoint: ExecutionEndpoint; failures: EndpointExecutionFailure[] }> {
  const failures: EndpointExecutionFailure[] = [];
  const now = options.now ?? Date.now;
  let deadlineExhausted = false;

  for (const endpoint of endpoints) {
    if (options.deadlineAt !== undefined && now() >= options.deadlineAt) {
      deadlineExhausted = true;
      break;
    }
    try {
      return { value: await execute(endpoint), endpoint, failures };
    } catch (error) {
      if (options.shouldFailover && !options.shouldFailover(error, endpoint)) {
        throw error;
      }
      failures.push({ endpoint: endpoint.address, error: errorMessage(error) });
    }
  }

  throw new EndpointFailoverError(failures, deadlineExhausted);
}
