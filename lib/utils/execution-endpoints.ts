import type { GrpcNetwork } from '@/lib/types/grpc';
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
  constructor(public readonly failures: EndpointExecutionFailure[]) {
    super(`All selected gRPC endpoints failed: ${failures.map(({ endpoint, error }) => `${endpoint}: ${error}`).join('; ')}`);
    this.name = 'EndpointFailoverError';
  }
}

/**
 * Generic gRPC sources deliberately retain their single configured endpoint.
 * Cosmos sources rotate selected endpoints, then retain the rest as failover
 * candidates so networks with mixed SDK/provider availability stay usable.
 */
export function getExecutionEndpoints(network: GrpcNetwork, startIndex: number): ExecutionEndpoint[] {
  if (network.mode !== 'cosmos') {
    return [{ address: network.endpoint, tlsEnabled: network.tlsEnabled }];
  }

  const selected = network.endpointConfigs?.filter((endpoint) => endpoint.selected) ?? [];
  if (selected.length === 0) {
    return [{ address: network.endpoint, tlsEnabled: network.tlsEnabled }];
  }

  const normalizedStart = ((startIndex % selected.length) + selected.length) % selected.length;
  return [...selected.slice(normalizedStart), ...selected.slice(0, normalizedStart)].map(
    ({ address, tlsEnabled }) => ({ address, tlsEnabled })
  );
}

export async function executeWithEndpointFailover<T>(
  endpoints: ExecutionEndpoint[],
  execute: (endpoint: ExecutionEndpoint) => Promise<T>
): Promise<{ value: T; endpoint: ExecutionEndpoint; failures: EndpointExecutionFailure[] }> {
  const failures: EndpointExecutionFailure[] = [];

  for (const endpoint of endpoints) {
    try {
      return { value: await execute(endpoint), endpoint, failures };
    } catch (error) {
      failures.push({ endpoint: endpoint.address, error: errorMessage(error) });
    }
  }

  throw new EndpointFailoverError(failures);
}
