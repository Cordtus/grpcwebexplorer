// lib/services/chainRegistry.ts

export interface ChainRegistryEndpoint {
  address: string;
  provider?: string;
}

export interface ChainInfo {
  chain_name: string;
  chain_id: string;
  pretty_name: string;
  status?: string;
  network_type?: string;
  bech32_prefix?: string;
  logo_URIs?: {
    png?: string;
    svg?: string;
  };
}

export interface ChainApis {
  rpc?: ChainRegistryEndpoint[];
  rest?: ChainRegistryEndpoint[];
  grpc?: ChainRegistryEndpoint[];
}

const CHAIN_REGISTRY_BASE = 'https://raw.githubusercontent.com/cosmos/chain-registry/master';
const GITHUB_API_BASE = 'https://api.github.com/repos/cosmos/chain-registry/contents';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

let chainListCache: { data: string[]; timestamp: number } | null = null;

/**
 * Fetch list of all chains from the registry using GitHub API
 */
export async function fetchChainList(): Promise<string[]> {
  // Check cache
  if (chainListCache && Date.now() - chainListCache.timestamp < CACHE_TTL) {
    return chainListCache.data;
  }

  try {
    const response = await fetch(GITHUB_API_BASE);
    if (!response.ok) {
      throw new Error(`Failed to fetch chain list: ${response.statusText}`);
    }

    const data = await response.json();

    // Filter to get only chain directories (exclude files and special directories)
    const chains = data
      .filter((item: any) =>
        item.type === 'dir' &&
        !item.name.startsWith('_') &&
        !item.name.startsWith('.') &&
        item.name !== 'LICENSE' &&
        item.name !== 'README.md' &&
        !item.name.endsWith('.json')
      )
      .map((item: any) => item.name)
      .sort();

    // Cache the result
    chainListCache = {
      data: chains,
      timestamp: Date.now()
    };

    return chains;
  } catch (error) {
    console.error('Error fetching chain list:', error);
    // Return empty array on error
    return [];
  }
}

/**
 * Fetch chain info (chain.json)
 */
export async function fetchChainInfo(chainName: string): Promise<ChainInfo | null> {
  try {
    const response = await fetch(`${CHAIN_REGISTRY_BASE}/${chainName}/chain.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch chain info for ${chainName}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching chain info for ${chainName}:`, error);
    return null;
  }
}

/**
 * Fetch chain APIs from chain.json
 */
export async function fetchChainApis(chainName: string): Promise<ChainApis | null> {
  try {
    const response = await fetch(`${CHAIN_REGISTRY_BASE}/${chainName}/chain.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch APIs for ${chainName}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      rpc: data.apis?.rpc || [],
      rest: data.apis?.rest || [],
      grpc: data.apis?.grpc || []
    };
  } catch (error) {
    console.error(`Error fetching APIs for ${chainName}:`, error);
    return null;
  }
}

/**
 * Get complete chain data with info and endpoints
 */
export async function fetchChainData(chainName: string): Promise<{
  info: ChainInfo;
  apis: ChainApis;
} | null> {
  try {
    const [info, apis] = await Promise.all([
      fetchChainInfo(chainName),
      fetchChainApis(chainName)
    ]);

    if (!info || !apis) {
      return null;
    }

    return { info, apis };
  } catch (error) {
    console.error(`Error fetching chain data for ${chainName}:`, error);
    return null;
  }
}

/**
 * Parse endpoint address to normalize format
 * Rule: Use TLS for port 443, non-TLS for everything else
 */
export function normalizeEndpoint(endpoint: string): { address: string; tls: boolean } {
  // Remove protocol if present
  let address = endpoint.replace(/^https?:\/\//, '');
  const hasPort = address.includes(':');

  if (!hasPort) {
    // No port specified - default to 9090 without TLS
    address = `${address}:9090`;
    return { address, tls: false };
  }

  // Extract port and determine TLS: port 443 = TLS, everything else = no TLS
  const port = address.split(':')[1];
  const tls = port === '443';

  return { address, tls };
}
