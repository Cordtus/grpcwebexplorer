export interface ExampleEndpoint {
  name: string;
  endpoint: string;
  description: string;
  tls: boolean;
  category: 'cosmos' | 'ethereum' | 'test' | 'other';
}

export const EXAMPLE_ENDPOINTS: ExampleEndpoint[] = [
  // Cosmos Networks
  {
    name: 'Cosmos Hub',
    endpoint: 'cosmoshub.lavenderfive.com:443',
    description: 'Cosmos Hub mainnet via LavendreFive',
    tls: true,
    category: 'cosmos'
  },
  {
    name: 'Osmosis',
    endpoint: 'grpc.osmosis.zone:443',
    description: 'Osmosis mainnet',
    tls: true,
    category: 'cosmos'
  },
  {
    name: 'Juno',
    endpoint: 'grpc.juno.basementnodes.ca:443',
    description: 'Juno mainnet',
    tls: true,
    category: 'cosmos'
  },
  {
    name: 'Neutron',
    endpoint: 'grpc.neutron.basementnodes.ca:443',
    description: 'Neutron mainnet',
    tls: true,
    category: 'cosmos'
  },
  {
    name: 'Celestia',
    endpoint: 'public-celestia-grpc.numia.xyz:9090',
    description: 'Celestia mainnet',
    tls: true,
    category: 'cosmos'
  },
  
  // Test Networks
  {
    name: 'Local gRPC',
    endpoint: 'localhost:50051',
    description: 'Local gRPC server',
    tls: false,
    category: 'test'
  },
  {
    name: 'gRPC Test Server',
    endpoint: 'demo.grpc.io:443',
    description: 'Public gRPC test server',
    tls: true,
    category: 'test'
  }
];

export function getEndpointsByCategory(category: ExampleEndpoint['category']) {
  return EXAMPLE_ENDPOINTS.filter(e => e.category === category);
}

export function searchEndpoints(query: string) {
  const q = query.toLowerCase();
  return EXAMPLE_ENDPOINTS.filter(e => 
    e.name.toLowerCase().includes(q) ||
    e.endpoint.toLowerCase().includes(q) ||
    e.description.toLowerCase().includes(q)
  );
}