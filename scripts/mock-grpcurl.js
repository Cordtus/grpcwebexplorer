// scripts/mock-grpcurl.js
// This script mocks the behavior of grpcurl to facilitate development without an actual gRPC server
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import path from 'path';

// Get command line arguments
const args = process.argv.slice(2);

// Parse arguments to extract endpoint, service, method and data
let endpoint = '';
let data = {};
let service = '';
let method = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-plaintext') {
    // Skip, this is just a flag
    continue;
  } else if (args[i] === '-d') {
    // Next argument is the data JSON
    i++;
    try {
      data = JSON.parse(args[i]);
    } catch (e) {
      console.error('Error parsing JSON data:', e.message);
      process.exit(1);
    }
  } else if (!endpoint && args[i].includes(':')) {
    // This is likely the endpoint
    endpoint = args[i];
  } else if (!service && args[i].includes('/')) {
    // This is likely the service/method
    const parts = args[i].split('/');
    service = parts[0];
    method = parts[1];
  }
}

// Generate mock response based on the service and method
function generateMockResponse(service, method, data) {
  // First, parse service name to match our directory structure
  const serviceParts = service.split('.');
  const serviceName = serviceParts[serviceParts.length - 1];

  // Create a generic mock response
  let response = {
    result: 'success',
    method: method,
    timestamp: new Date().toISOString()
  };

  // Add method-specific mock responses
  switch (method.toLowerCase()) {
    case 'getinfo':
      response = {
        name: 'gRPC Test Service',
        version: '1.0.0',
        features: ['reflection', 'streaming', 'authentication'],
        height: 1234567
      };
      break;

    case 'balances':
      response = {
        balances: [
          { denom: 'atom', amount: '1000.50' },
          { denom: 'osmo', amount: '2500.75' },
          { denom: 'sei', amount: '10000.00' }
        ]
      };

      // Filter by denom if specified
      if (data.denom && data.denom.length > 0) {
        response.balances = response.balances.filter(b =>
        data.denom.includes(b.denom)
        );
      }

      break;

    case 'status':
      response = {
        status: 'healthy',
        peers: 48,
        syncing: false
      };

      // Include extra details if requested
      if (data.include_peers) {
        response.peer_details = [
          { id: 'peer1', address: '10.0.0.1:26656', connected: true },
          { id: 'peer2', address: '10.0.0.2:26656', connected: true },
          { id: 'peer3', address: '10.0.0.3:26656', connected: false }
        ];
      }

      break;

    case 'query':
      // Generate random results
      const results = [];
      const total = Math.min(data.limit || 10, 100);

      for (let i = 0; i < total; i++) {
        results.push({
          key: `key_${i + 1}`,
          value: `value_for_key_${i + 1}`
        });
      }

      response = {
        results: results,
        total: total
      };

      break;

    case 'stream':
      // For a streaming endpoint, we'll just return a single event
      response = {
        event: 'data',
        timestamp: Date.now(),
        data: JSON.stringify({ value: Math.random() * 100 })
      };
      break;

    default:
      // Default mock response
      response = {
        ...response,
        data: data,
        note: 'This is a mock response'
      };
  }

  return response;
}

// Generate and output mock response
const mockResponse = generateMockResponse(service, method, data);
console.log(JSON.stringify(mockResponse, null, 2));
